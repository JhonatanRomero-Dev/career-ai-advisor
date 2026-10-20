import { logger } from "../src/logger.js";
import crypto from "crypto";

import {
  cancelUserSubscription,
  createSubscriptionCheckout,
  getSubscriptionCheckoutById,
  getSubscriptionCheckoutByProviderId,
  getUserSubscription,
  markPaymentWebhookEventFailed,
  markPaymentWebhookEventProcessed,
  recordPaymentWebhookEvent,
  updateSubscriptionCheckoutProviderData,
  updateSubscriptionCheckoutStatus,
  updateUserSubscription
} from "../src/db.js";

const PLAN_CATALOG = {
  Gratis: {
    name: "Gratis",
    amountCents: 0,
    title: "Career AI Gratis"
  },
  Pro: {
    name: "Pro",
    amountCents: 2900,
    title: "Career AI Pro"
  },
  Premium: {
    name: "Premium",
    amountCents: 5900,
    title: "Career AI Premium"
  }
};

const ALLOWED_PLANS = new Set(Object.keys(PLAN_CATALOG));
const PAID_PLANS = new Set(["Pro", "Premium"]);
const DEFAULT_SUBSCRIPTION_PERIOD_DAYS = 30;
const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const allowDemoCheckout =
  process.env.ALLOW_DEMO_CHECKOUT === "true" || process.env.NODE_ENV === "test";

function normalizePlan(plan = "Gratis") {
  const value = String(plan || "Gratis").trim().toLowerCase();

  if (value === "pro") {
    return "Pro";
  }

  if (value === "premium") {
    return "Premium";
  }

  return "Gratis";
}

function normalizeGatewayProvider(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "mercadopago" || normalized === "mp") {
    return "mercadopago";
  }

  return normalized;
}

function getConfiguredGatewayProvider() {
  const provider = normalizeGatewayProvider(
    process.env.PAYMENT_GATEWAY || process.env.PAYMENT_PROVIDER
  );

  if (provider) {
    return provider;
  }

  return getMercadoPagoAccessToken() ? "mercadopago" : "";
}

function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
}

function isMercadoPagoConfigured() {
  return getConfiguredGatewayProvider() === "mercadopago" && Boolean(getMercadoPagoAccessToken());
}

function getFrontendUrl() {
  const firstCorsOrigin = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];

  return String(process.env.FRONTEND_URL || firstCorsOrigin || "http://localhost:5173")
    .replace(/\/+$/, "");
}

function toPublicCheckout(checkout) {
  if (!checkout) {
    return null;
  }

  return {
    id: checkout.id,
    plan: checkout.plan,
    provider: checkout.provider,
    provider_checkout_id: checkout.provider_checkout_id,
    status: checkout.status,
    amount_cents: checkout.amount_cents,
    currency: checkout.currency,
    checkout_url: checkout.checkout_url,
    created_date: checkout.created_date,
    updated_date: checkout.updated_date
  };
}

function parseMercadoPagoSignature(header = "") {
  return String(header)
    .split(",")
    .map((part) => part.trim().split("="))
    .reduce((signature, [key, value]) => {
      if (key && value) {
        signature[key] = value;
      }

      return signature;
    }, {});
}

function safeCompareHex(left, right) {
  if (!/^[a-f0-9]+$/i.test(String(left || "")) || !/^[a-f0-9]+$/i.test(String(right || ""))) {
    return false;
  }

  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");

  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getMercadoPagoNotificationId(req) {
  return String(
    req.get("x-request-id") ||
      req.body?.id ||
      req.body?.notification_id ||
      req.query?.notification_id ||
      ""
  ).trim();
}

function getMercadoPagoPaymentId(req) {
  return String(
    req.query?.["data.id"] ||
      req.query?.id ||
      req.body?.data?.id ||
      req.body?.id ||
      ""
  ).trim();
}

function isValidMercadoPagoWebhookSignature(req, dataId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "";

  if (!secret) {
    return process.env.NODE_ENV !== "production" ||
      process.env.MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS === "true";
  }

  const signature = parseMercadoPagoSignature(req.get("x-signature"));
  const requestId = req.get("x-request-id");

  if (!signature.ts || !signature.v1) {
    return false;
  }

  const manifest = [
    dataId ? `id:${dataId};` : "",
    requestId ? `request-id:${requestId};` : "",
    signature.ts ? `ts:${signature.ts};` : ""
  ].join("");

  if (!manifest) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return safeCompareHex(digest, signature.v1);
}

async function mercadopagoRequest(pathname, options = {}) {
  const {
    headers = {},
    idempotencyKey = "",
    ...fetchOptions
  } = options;

  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${pathname}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...headers
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.message || data.error || data.cause?.[0]?.description;
    throw new Error(detail || "Mercado Pago recusou a solicitacao.");
  }

  return data;
}

function getMercadoPagoCheckoutUrl(resource) {
  return resource.init_point || resource.sandbox_init_point || "";
}

async function createMercadoPagoSubscription(req, planDetails, checkout) {
  const frontendUrl = getFrontendUrl();
  const checkoutReturnParams = `checkout_id=${encodeURIComponent(checkout.id)}&plan=${encodeURIComponent(planDetails.name)}`;
  const payload = {
    reason: planDetails.title,
    payer_email: req.user.email,
    external_reference: checkout.id,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: planDetails.amountCents / 100,
      currency_id: "BRL"
    },
    back_url: `${frontendUrl}/dashboard?checkout=subscription&${checkoutReturnParams}`,
    status: "pending"
  };

  return mercadopagoRequest("/preapproval", {
    method: "POST",
    idempotencyKey: checkout.id,
    body: JSON.stringify(payload)
  });
}

function normalizeMercadoPagoSubscriptionStatus(status = "") {
  const value = String(status || "").toLowerCase();

  if (value === "authorized") return "active";
  if (value === "paused") return "past_due";
  if (["cancelled", "canceled"].includes(value)) return "canceled";
  return value || "pending";
}

function applyMercadoPagoSubscription(checkout, subscription) {
  const reference = String(subscription.external_reference || "").trim();

  if (reference && reference !== checkout.id) {
    throw new Error("Assinatura nao pertence a este checkout.");
  }

  const providerStatus = String(subscription.status || "pending").toLowerCase();
  const status = normalizeMercadoPagoSubscriptionStatus(providerStatus);
  const updatedCheckout = updateSubscriptionCheckoutStatus(checkout.id, {
    status: providerStatus,
    rawResponse: subscription
  });

  if (providerStatus === "authorized") {
    updateUserSubscription(checkout.user_id, checkout.plan, "mercadopago", {
      status: "active",
      providerSubscriptionId: String(subscription.id || checkout.provider_checkout_id || ""),
      nextPaymentAt: subscription.next_payment_date || null,
      periodEnd: subscription.next_payment_date || null,
      lastPaymentAt: subscription.last_modified || subscription.date_created || null
    });
  } else if (["paused"].includes(providerStatus)) {
    updateUserSubscription(checkout.user_id, checkout.plan, "mercadopago", {
      status,
      providerSubscriptionId: String(subscription.id || checkout.provider_checkout_id || ""),
      nextPaymentAt: subscription.next_payment_date || null,
      periodEnd: subscription.next_payment_date || null
    });
  } else if (["cancelled", "canceled"].includes(providerStatus)) {
    cancelUserSubscription(checkout.user_id);
  }

  return { checkout: updatedCheckout, status, activated: providerStatus === "authorized" };
}

function normalizeMercadoPagoPaymentStatus(status = "") {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return "approved";
  }

  if (["cancelled", "charged_back", "refunded", "rejected"].includes(value)) {
    return value;
  }

  return value || "pending";
}

function getPaymentCheckoutReference(payment = {}) {
  return String(
    payment.external_reference ||
      payment.metadata?.checkout_id ||
      ""
  ).trim();
}

function getPaymentAmountCents(payment = {}) {
  const amount = Number(payment.transaction_amount ?? payment.total_paid_amount ?? 0);

  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function isExpectedPaymentForCheckout(payment, checkout) {
  const paymentCurrency = String(payment.currency_id || checkout.currency || "").toUpperCase();
  const checkoutCurrency = String(checkout.currency || "").toUpperCase();
  const amountCents = getPaymentAmountCents(payment);

  return paymentCurrency === checkoutCurrency &&
    amountCents === Number(checkout.amount_cents || 0);
}

function shouldDowngradeSubscriptionForPaymentStatus(status, previousCheckoutStatus) {
  if (["charged_back", "refunded"].includes(status)) {
    return true;
  }

  return ["cancelled", "rejected"].includes(status) &&
    previousCheckoutStatus === "approved";
}

function applyMercadoPagoPaymentToCheckout(checkout, payment) {
  const checkoutReference = getPaymentCheckoutReference(payment);

  if (checkoutReference && checkoutReference !== checkout.id) {
    throw new Error("Pagamento nao pertence a este checkout.");
  }

  const status = normalizeMercadoPagoPaymentStatus(payment.status);
  const providerPaymentId = String(payment.id || "").trim();
  const paymentMatchesCheckout = isExpectedPaymentForCheckout(payment, checkout);
  const previousStatus = checkout.status;
  const nextStatus = status === "approved" && !paymentMatchesCheckout
    ? "review_required"
    : status;
  const updatedCheckout = updateSubscriptionCheckoutStatus(checkout.id, {
    status: nextStatus,
    providerPaymentId,
    rawResponse: payment
  });

  if (status === "approved" && !paymentMatchesCheckout) {
    return {
      checkout: updatedCheckout,
      status: nextStatus,
      activated: false,
      reviewRequired: true
    };
  }

  if (status === "approved" && previousStatus !== "approved") {
    const currentSubscription = getUserSubscription(updatedCheckout.user_id);
    const shouldActivate = currentSubscription.plan !== updatedCheckout.plan ||
      !["active", "canceling"].includes(currentSubscription.status);

    if (shouldActivate) {
      updateUserSubscription(updatedCheckout.user_id, updatedCheckout.plan, "mercadopago", {
        periodDays: DEFAULT_SUBSCRIPTION_PERIOD_DAYS
      });
    }

    return {
      checkout: updatedCheckout,
      status,
      activated: shouldActivate,
      reviewRequired: false
    };
  }

  if (shouldDowngradeSubscriptionForPaymentStatus(status, previousStatus)) {
    updateUserSubscription(updatedCheckout.user_id, "Gratis", "mercadopago", {
      status
    });
  }

  return {
    checkout: updatedCheckout,
    status,
    activated: false,
    reviewRequired: false
  };
}

export function getSubscription(req, res) {
  try {
    return res.json({
      success: true,
      subscription: getUserSubscription(req.user.id)
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "getSubscription" });

    return res.status(500).json({
      success: false,
      error: "Não foi possível carregar sua assinatura."
    });
  }
}

export async function createCheckout(req, res) {
  const plan = normalizePlan(req.body.plan);

  try {
    if (!ALLOWED_PLANS.has(plan) || !PAID_PLANS.has(plan)) {
      return res.status(400).json({
        success: false,
        error: "Escolha um plano pago válido para continuar."
      });
    }

    const planDetails = PLAN_CATALOG[plan];

    if (isMercadoPagoConfigured()) {
      const checkout = createSubscriptionCheckout({
        userId: req.user.id,
        plan,
        provider: "mercadopago",
        amountCents: planDetails.amountCents,
        currency: "BRL"
      });

      try {
        const subscription = await createMercadoPagoSubscription(req, planDetails, checkout);
        const checkoutUrl = getMercadoPagoCheckoutUrl(subscription);

        if (!checkoutUrl) {
          throw new Error("Mercado Pago não retornou URL de checkout.");
        }

        const updatedCheckout = updateSubscriptionCheckoutProviderData(checkout.id, {
          providerCheckoutId: subscription.id,
          checkoutUrl,
          rawResponse: subscription
        });

        return res.status(201).json({
          success: true,
          checkout: toPublicCheckout(updatedCheckout),
          subscription: getUserSubscription(req.user.id)
        });
      } catch (error) {
        updateSubscriptionCheckoutStatus(checkout.id, {
          status: "failed",
          rawResponse: {
            message: error.message
          }
        });

        throw error;
      }
    }

    const configuredGateway = getConfiguredGatewayProvider();

    if (configuredGateway && configuredGateway !== "mercadopago") {
      return res.status(501).json({
        success: false,
        error: `Gateway de pagamento não suportado: ${configuredGateway}.`
      });
    }

    if (!allowDemoCheckout) {
      return res.status(501).json({
        success: false,
        error: "Gateway de pagamento não configurado. Configure MERCADO_PAGO_ACCESS_TOKEN no backend ou ative ALLOW_DEMO_CHECKOUT=true apenas para testes locais."
      });
    }

    return res.json({
      success: true,
      checkout: {
        id: null,
        provider: "demo",
        status: "approved",
        checkout_url: null
      },
      subscription: updateUserSubscription(req.user.id, plan, "demo", {
        periodDays: DEFAULT_SUBSCRIPTION_PERIOD_DAYS
      })
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "createCheckout" });

    return res.status(502).json({
      success: false,
      error: error.message || "Não foi possível iniciar o checkout."
    });
  }
}

export async function getCheckoutStatus(req, res) {
  try {
    const checkout = getSubscriptionCheckoutById(req.params.checkoutId);

    if (!checkout || checkout.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: "Checkout nao encontrado."
      });
    }

    let currentCheckout = checkout;

    if (checkout.provider === "mercadopago" && isMercadoPagoConfigured()) {
      const paymentId = String(
        req.query.payment_id ||
          req.query.collection_id ||
          checkout.provider_payment_id ||
          ""
      ).trim();

      if (checkout.provider_checkout_id) {
        const subscription = await mercadopagoRequest(`/preapproval/${encodeURIComponent(checkout.provider_checkout_id)}`);
        currentCheckout = applyMercadoPagoSubscription(checkout, subscription).checkout;
      } else if (paymentId) {
        const payment = await mercadopagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
        const result = applyMercadoPagoPaymentToCheckout(checkout, payment);

        currentCheckout = result.checkout;
      }
    }

    return res.json({
      success: true,
      checkout: toPublicCheckout(currentCheckout),
      subscription: getUserSubscription(req.user.id)
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "getCheckoutStatus" });

    return res.status(502).json({
      success: false,
      error: error.message || "Nao foi possivel consultar o checkout."
    });
  }
}

export function activateDemoSubscription(req, res) {
  try {
    if (!allowDemoCheckout) {
      return res.status(501).json({
        success: false,
        error: "Checkout demonstrativo desativado. Configure um gateway de pagamento para ativar planos pagos."
      });
    }

    const plan = normalizePlan(req.body.plan);

    if (!ALLOWED_PLANS.has(plan) || !PAID_PLANS.has(plan)) {
      return res.status(400).json({
        success: false,
        error: "Escolha um plano pago válido para continuar."
      });
    }

    return res.json({
      success: true,
      subscription: updateUserSubscription(req.user.id, plan, "demo", {
        periodDays: DEFAULT_SUBSCRIPTION_PERIOD_DAYS
      })
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "activateDemoSubscription" });

    return res.status(500).json({
      success: false,
      error: "Não foi possível ativar sua assinatura."
    });
  }
}

export async function cancelSubscription(req, res) {
  try {
    const current = getUserSubscription(req.user.id);

    if (current.provider_subscription_id && isMercadoPagoConfigured()) {
      await mercadopagoRequest(`/preapproval/${encodeURIComponent(current.provider_subscription_id)}`, {
        method: "PUT",
        idempotencyKey: `cancel-${current.provider_subscription_id}`,
        body: JSON.stringify({ status: "cancelled" })
      });
    }

    return res.json({
      success: true,
      subscription: cancelUserSubscription(req.user.id)
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "cancelSubscription" });

    return res.status(500).json({
      success: false,
      error: "Não foi possível cancelar sua assinatura."
    });
  }
}

export async function handleMercadoPagoWebhook(req, res) {
  return handleMercadoPagoWebhookWithIdempotency(req, res);
}

async function handleMercadoPagoWebhookWithIdempotency(req, res) {
  let webhookEvent = null;

  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(501).json({
        success: false,
        error: "Mercado Pago nao esta configurado."
      });
    }

    const paymentId = getMercadoPagoPaymentId(req);

    if (!paymentId) {
      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    if (!isValidMercadoPagoWebhookSignature(req, paymentId)) {
      return res.status(401).json({
        success: false,
        error: "Assinatura do webhook invalida."
      });
    }

    const recorded = recordPaymentWebhookEvent({
      provider: "mercadopago",
      providerEventId: getMercadoPagoNotificationId(req),
      eventType: req.query?.type || req.body?.type || "payment",
      action: req.body?.action || "",
      resourceType: req.query?.type || req.body?.type || "payment",
      resourceId: paymentId,
      requestId: req.get("x-request-id") || "",
      rawPayload: {
        query: req.query,
        body: req.body
      }
    });
    webhookEvent = recorded.event;

    if (
      recorded.duplicate &&
      ["processed", "ignored", "review_required"].includes(webhookEvent.processing_status)
    ) {
      return res.json({
        success: true,
        received: true,
        duplicate: true,
        status: webhookEvent.payment_status
      });
    }

    const eventType = String(req.query?.type || req.body?.type || "payment").toLowerCase();

    if (["subscription_preapproval", "subscription_authorized_payment"].includes(eventType)) {
      let subscriptionId = paymentId;

      if (eventType === "subscription_authorized_payment") {
        const invoice = await mercadopagoRequest(`/authorized_payments/${encodeURIComponent(paymentId)}`);
        subscriptionId = String(invoice.preapproval_id || invoice.subscription_id || "").trim();
      }

      if (!subscriptionId) {
        markPaymentWebhookEventProcessed(webhookEvent.id, {
          processingStatus: "ignored",
          paymentStatus: "missing_subscription_id",
          errorMessage: "Notificacao recorrente sem identificador de assinatura."
        });
        return res.json({ success: true, received: true, ignored: true });
      }

      const subscription = await mercadopagoRequest(`/preapproval/${encodeURIComponent(subscriptionId)}`);
      const checkoutId = String(subscription.external_reference || "").trim();
      const checkout = (checkoutId && getSubscriptionCheckoutById(checkoutId)) ||
        getSubscriptionCheckoutByProviderId(subscriptionId);

      if (!checkout || checkout.provider !== "mercadopago") {
        markPaymentWebhookEventProcessed(webhookEvent.id, {
          processingStatus: "ignored",
          paymentStatus: normalizeMercadoPagoSubscriptionStatus(subscription.status),
          errorMessage: "Checkout nao encontrado para a assinatura."
        });
        return res.json({ success: true, received: true, ignored: true });
      }

      const result = applyMercadoPagoSubscription(checkout, subscription);
      markPaymentWebhookEventProcessed(webhookEvent.id, {
        checkoutId: checkout.id,
        paymentStatus: result.status,
        processingStatus: "processed"
      });

      return res.json({
        success: true,
        received: true,
        recurring: true,
        status: result.status,
        activated: result.activated
      });
    }

    const payment = await mercadopagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const checkoutId = getPaymentCheckoutReference(payment);

    if (!checkoutId) {
      markPaymentWebhookEventProcessed(webhookEvent.id, {
        processingStatus: "ignored",
        providerPaymentId: String(payment.id || paymentId),
        paymentStatus: normalizeMercadoPagoPaymentStatus(payment.status),
        errorMessage: "Pagamento sem external_reference."
      });

      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    const checkout = getSubscriptionCheckoutById(checkoutId);

    if (!checkout || checkout.provider !== "mercadopago") {
      markPaymentWebhookEventProcessed(webhookEvent.id, {
        processingStatus: "ignored",
        checkoutId,
        providerPaymentId: String(payment.id || paymentId),
        paymentStatus: normalizeMercadoPagoPaymentStatus(payment.status),
        errorMessage: "Checkout nao encontrado para o pagamento."
      });

      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    const result = applyMercadoPagoPaymentToCheckout(checkout, payment);

    markPaymentWebhookEventProcessed(webhookEvent.id, {
      checkoutId: result.checkout.id,
      providerPaymentId: String(payment.id || paymentId),
      paymentStatus: result.status,
      processingStatus: result.reviewRequired ? "review_required" : "processed",
      errorMessage: result.reviewRequired
        ? "Pagamento aprovado com valor ou moeda divergente."
        : ""
    });

    return res.json({
      success: true,
      received: true,
      status: result.status,
      activated: result.activated,
      review_required: result.reviewRequired
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "handleMercadoPagoWebhook" });

    if (webhookEvent?.id) {
      markPaymentWebhookEventFailed(webhookEvent.id, error.message);
    }

    return res.status(500).json({
      success: false,
      error: "Nao foi possivel processar o webhook de pagamento."
    });
  }
}

export async function handleMercadoPagoWebhookLegacy(req, res) {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(501).json({
        success: false,
        error: "Mercado Pago não está configurado."
      });
    }

    const paymentId = getMercadoPagoPaymentId(req);

    if (!paymentId) {
      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    if (!isValidMercadoPagoWebhookSignature(req, paymentId)) {
      return res.status(401).json({
        success: false,
        error: "Assinatura do webhook invalida."
      });
    }

    const payment = await mercadopagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const checkoutId = String(
      payment.external_reference || payment.metadata?.checkout_id || ""
    ).trim();

    if (!checkoutId) {
      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    const checkout = getSubscriptionCheckoutById(checkoutId);

    if (!checkout || checkout.provider !== "mercadopago") {
      return res.json({
        success: true,
        received: true,
        ignored: true
      });
    }

    const status = normalizeMercadoPagoPaymentStatus(payment.status);
    const updatedCheckout = updateSubscriptionCheckoutStatus(checkout.id, {
      status,
      providerPaymentId: String(payment.id || paymentId),
      rawResponse: payment
    });

    if (status === "approved") {
      updateUserSubscription(updatedCheckout.user_id, updatedCheckout.plan, "mercadopago", {
        periodDays: DEFAULT_SUBSCRIPTION_PERIOD_DAYS
      });
    }

    if (["cancelled", "charged_back", "refunded", "rejected"].includes(status)) {
      updateUserSubscription(updatedCheckout.user_id, "Gratis", "mercadopago", {
        status
      });
    }

    return res.json({
      success: true,
      received: true,
      status
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "subscriptionController", action: "handleMercadoPagoWebhookLegacy" });

    return res.status(500).json({
      success: false,
      error: "Não foi possível processar o webhook de pagamento."
    });
  }
}
