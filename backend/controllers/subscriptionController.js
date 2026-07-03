import crypto from "crypto";

import {
  createSubscriptionCheckout,
  getSubscriptionCheckoutById,
  getUserSubscription,
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

function getBackendPublicUrl(req) {
  const configuredUrl =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    process.env.API_PUBLIC_URL ||
    "";

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");

  return host ? `${protocol}://${host}`.replace(/\/+$/, "") : "";
}

function getMercadoPagoNotificationUrl(req) {
  const configuredUrl =
    process.env.MERCADO_PAGO_NOTIFICATION_URL ||
    process.env.MP_NOTIFICATION_URL ||
    "";

  if (configuredUrl) {
    return configuredUrl;
  }

  const backendUrl = getBackendPublicUrl(req);

  if (!backendUrl || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(backendUrl)) {
    return "";
  }

  return `${backendUrl}/api/subscription/webhook/mercadopago`;
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
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");

  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
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

  if (!dataId || !requestId || !signature.ts || !signature.v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return safeCompareHex(digest, signature.v1);
}

async function mercadopagoRequest(pathname, options = {}) {
  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.message || data.error || data.cause?.[0]?.description;
    throw new Error(detail || "Mercado Pago recusou a solicitacao.");
  }

  return data;
}

function getMercadoPagoCheckoutUrl(preference) {
  const useSandbox =
    process.env.MERCADO_PAGO_USE_SANDBOX === "true" ||
    getMercadoPagoAccessToken().startsWith("TEST-");

  if (useSandbox) {
    return preference.sandbox_init_point || preference.init_point || "";
  }

  return preference.init_point || preference.sandbox_init_point || "";
}

async function createMercadoPagoPreference(req, planDetails, checkout) {
  const frontendUrl = getFrontendUrl();
  const notificationUrl = getMercadoPagoNotificationUrl(req);
  const preferencePayload = {
    items: [
      {
        id: `career-ai-${planDetails.name.toLowerCase()}`,
        title: planDetails.title,
        description: `Plano ${planDetails.name} do Career AI Advisor`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: planDetails.amountCents / 100
      }
    ],
    payer: {
      name: req.user.name,
      email: req.user.email
    },
    external_reference: checkout.id,
    metadata: {
      checkout_id: checkout.id,
      user_id: req.user.id,
      plan: planDetails.name
    },
    back_urls: {
      success: `${frontendUrl}/dashboard?checkout=success&plan=${encodeURIComponent(planDetails.name)}`,
      failure: `${frontendUrl}/?checkout=failure`,
      pending: `${frontendUrl}/dashboard?checkout=pending&plan=${encodeURIComponent(planDetails.name)}`
    },
    auto_return: "approved",
    statement_descriptor: "CAREER AI"
  };

  if (notificationUrl) {
    preferencePayload.notification_url = notificationUrl;
  }

  return mercadopagoRequest("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(preferencePayload)
  });
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

export function getSubscription(req, res) {
  try {
    return res.json({
      success: true,
      subscription: getUserSubscription(req.user.id)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Nao foi possivel carregar sua assinatura."
    });
  }
}

export async function createCheckout(req, res) {
  const plan = normalizePlan(req.body.plan);

  try {
    if (!ALLOWED_PLANS.has(plan) || !PAID_PLANS.has(plan)) {
      return res.status(400).json({
        success: false,
        error: "Escolha um plano pago valido para continuar."
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
        const preference = await createMercadoPagoPreference(req, planDetails, checkout);
        const checkoutUrl = getMercadoPagoCheckoutUrl(preference);

        if (!checkoutUrl) {
          throw new Error("Mercado Pago nao retornou URL de checkout.");
        }

        const updatedCheckout = updateSubscriptionCheckoutProviderData(checkout.id, {
          providerCheckoutId: preference.id,
          checkoutUrl,
          rawResponse: preference
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
        error: `Gateway de pagamento nao suportado: ${configuredGateway}.`
      });
    }

    if (!allowDemoCheckout) {
      return res.status(501).json({
        success: false,
        error: "Gateway de pagamento nao configurado. Configure MERCADO_PAGO_ACCESS_TOKEN no backend ou ative ALLOW_DEMO_CHECKOUT=true apenas para testes locais."
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
      subscription: updateUserSubscription(req.user.id, plan, "demo")
    });
  } catch (error) {
    console.error(error);

    return res.status(502).json({
      success: false,
      error: error.message || "Nao foi possivel iniciar o checkout."
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
        error: "Escolha um plano pago valido para continuar."
      });
    }

    return res.json({
      success: true,
      subscription: updateUserSubscription(req.user.id, plan, "demo")
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Nao foi possivel ativar sua assinatura."
    });
  }
}

export async function handleMercadoPagoWebhook(req, res) {
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
      updateUserSubscription(updatedCheckout.user_id, updatedCheckout.plan, "mercadopago");
    }

    return res.json({
      success: true,
      received: true,
      status
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Nao foi possivel processar o webhook de pagamento."
    });
  }
}
