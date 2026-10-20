import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-ai-test-"));

process.env.AI_PROVIDER = "none";
process.env.AUTH_CODE_SECRET = "test-auth-secret";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.SQLITE_DB_PATH = path.join(tempDir, "career-ai-test.sqlite");

const { default: app } = await import("../server.js");
const {
  claimNextAnalysisJob,
  closeDatabase,
  createAnalysisJobRecord,
  createResumeAnalysis,
  getUserByEmail,
  getResumeAnalysisSourceForAccount,
  getResumeTextStoragePolicy,
  purgeExpiredResumeTexts,
  recordAIEvent,
  requeueInterruptedAnalysisJobs
} = await import("../src/db.js");

let server;
let baseUrl;

test("missing email configuration does not create an account or expose server settings", async () => {
  const email = `smtp-unavailable-${Date.now()}@example.com`;
  const keys = ["NODE_ENV", "ALLOW_DEV_EMAIL_FALLBACK", "EXPOSE_DEV_AUTH_CODE", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_EMAIL_FALLBACK = "false";
    process.env.EXPOSE_DEV_AUTH_CODE = "false";
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) delete process.env[key];
    const result = await postJson("/api/auth/register", { email, name: "SMTP Test", password: "smtp-test-password-123" });
    assert.equal(result.response.status, 503);
    assert.equal(result.data.success, false);
    assert.doesNotMatch(result.data.error, /SMTP|backend|\.env/);
    assert.equal(result.data.dev_code, undefined);
    assert.equal(result.response.headers.get("set-cookie"), null);
    assert.equal(getUserByEmail(email), null);
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test.before(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function getCookieHeader(response) {
  const setCookie = response.headers.get("set-cookie") || "";

  return setCookie.split(";")[0];
}

function joinCookies(...cookies) {
  return cookies.filter(Boolean).join("; ");
}

async function getCsrfForCookie(cookie = "") {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: {
      ...(cookie ? { Cookie: cookie } : {})
    }
  });
  const data = await response.json();
  const csrfCookie = getCookieHeader(response);

  assert.equal(response.status, 200);
  assert.match(data.csrf_token, /^[A-Za-z0-9_-]+$/);

  return {
    token: data.csrf_token,
    cookie: joinCookies(cookie, csrfCookie)
  };
}

async function postJson(pathname, body, cookie = "") {
  const csrf = cookie ? await getCsrfForCookie(cookie) : null;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? {
        Cookie: csrf.cookie,
        "x-csrf-token": csrf.token
      } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  return { response, data };
}

async function deleteJson(pathname, body, cookie = "") {
  const csrf = await getCsrfForCookie(cookie);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "DELETE",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Cookie: csrf.cookie,
      "x-csrf-token": csrf.token
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();

  return { response, data };
}

async function patchJson(pathname, body, cookie = "") {
  const csrf = await getCsrfForCookie(cookie);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: csrf.cookie,
      "x-csrf-token": csrf.token
    },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

async function registerVerifiedUser({
  email = `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@example.com`,
  name = "Test User",
  password = "test-password-123"
} = {}) {
  const register = await postJson("/api/auth/register", {
    name,
    email,
    password
  });

  assert.equal(register.response.status, 201);
  assert.match(register.data.dev_code, /^\d{6}$/);

  const verify = await postJson("/api/auth/verify-code", {
    email,
    code: register.data.dev_code
  });
  const sessionCookie = getCookieHeader(verify.response);

  assert.equal(verify.response.status, 200);
  assert.match(sessionCookie, /^career_ai_session=/);

  return {
    email,
    name,
    password,
    sessionCookie,
    user: verify.data.user
  };
}

function readRawStoredResumeText(analysisId) {
  const inspectionDb = new DatabaseSync(process.env.SQLITE_DB_PATH);

  try {
    const row = inspectionDb
      .prepare("SELECT resume_text FROM resume_analyses WHERE id = ?")
      .get(analysisId);

    return row?.resume_text || null;
  } finally {
    inspectionDb.close();
  }
}

function readPaymentWebhookEvent(providerEventId) {
  const inspectionDb = new DatabaseSync(process.env.SQLITE_DB_PATH);

  try {
    return inspectionDb
      .prepare("SELECT * FROM payment_webhook_events WHERE provider_event_id = ?")
      .get(providerEventId);
  } finally {
    inspectionDb.close();
  }
}

function readAnalysisJobRow(jobId) {
  const inspectionDb = new DatabaseSync(process.env.SQLITE_DB_PATH);

  try {
    return inspectionDb
      .prepare("SELECT * FROM analysis_jobs WHERE id = ?")
      .get(jobId);
  } finally {
    inspectionDb.close();
  }
}

function createDocxBuffer(text) {
  const safeText = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${safeText}</w:t></w:r></w:p></w:body></w:document>`;
  const name = Buffer.from("word/document.xml");
  const data = Buffer.from(xml);
  const local = Buffer.alloc(30 + name.length);

  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);

  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  const centralOffset = local.length + data.length;

  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, data, central, eocd]);
}

function signMercadoPagoWebhook({ dataId, requestId, secret, timestamp = "1700000000000" }) {
  const manifest = [
    dataId ? `id:${dataId};` : "",
    requestId ? `request-id:${requestId};` : "",
    timestamp ? `ts:${timestamp};` : ""
  ].join("");
  const digest = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return `ts=${timestamp},v1=${digest}`;
}

test("health endpoint responds", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.status, "ok");
  assert.ok(response.headers.get("x-request-id"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.has("x-powered-by"), false);
});

test("readiness endpoint verifies the active database", async () => {
  const response = await fetch(`${baseUrl}/api/health/ready`, {
    headers: {
      "x-request-id": "readiness-test"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "readiness-test");
  assert.equal(data.success, true);
  assert.equal(data.status, "ready");
  assert.equal(data.database.ok, true);
  assert.equal(data.database.using_configured_provider, true);
});

test("invalid request identifiers are replaced", async () => {
  const response = await fetch(`${baseUrl}/api/health/live`, {
    headers: {
      "x-request-id": "invalid request id with spaces"
    }
  });

  assert.equal(response.status, 200);
  assert.notEqual(response.headers.get("x-request-id"), "invalid request id with spaces");
  assert.match(response.headers.get("x-request-id") || "", /^[0-9a-f-]{36}$/i);
});

test("resume source text is encrypted at rest and readable by owner", async () => {
  const previousMode = process.env.RESUME_TEXT_STORAGE;
  const email = `privacy-${Date.now()}@example.com`;
  const sourceText = "Sensitive Person\nSenior Frontend Developer\nReact, TypeScript and private contact details.";

  process.env.RESUME_TEXT_STORAGE = "encrypted";

  try {
    const analysis = createResumeAnalysis({
      fileName: "privacy.pdf",
      resumeText: sourceText,
      accountEmail: email,
      atsScore: 80,
      clarityScore: 80,
      marketCompatibility: 80,
      suggestions: [],
      recommendedJobs: []
    });
    const rawStoredText = readRawStoredResumeText(analysis.id);
    const source = getResumeAnalysisSourceForAccount(analysis.id, email);

    assert.equal(getResumeTextStoragePolicy().encrypted, true);
    assert.match(rawStoredText, /^enc:v1:/);
    assert.equal(rawStoredText.includes("Sensitive Person"), false);
    assert.equal(source.resume_text, sourceText);
  } finally {
    if (previousMode === undefined) {
      delete process.env.RESUME_TEXT_STORAGE;
    } else {
      process.env.RESUME_TEXT_STORAGE = previousMode;
    }
  }
});

test("resume source retention can clear stored text without deleting analysis", async () => {
  const previousMode = process.env.RESUME_TEXT_STORAGE;
  const previousRetentionDays = process.env.RESUME_TEXT_RETENTION_DAYS;
  const email = `retention-${Date.now()}@example.com`;

  process.env.RESUME_TEXT_STORAGE = "plain";
  process.env.RESUME_TEXT_RETENTION_DAYS = "0";

  try {
    const analysis = createResumeAnalysis({
      fileName: "retention.pdf",
      resumeText: "Temporary resume source text",
      accountEmail: email,
      atsScore: 72,
      clarityScore: 72,
      marketCompatibility: 72,
      suggestions: [],
      recommendedJobs: []
    });
    const removed = purgeExpiredResumeTexts(new Date(Date.now() + 1000));
    const source = getResumeAnalysisSourceForAccount(analysis.id, email);

    assert.ok(removed >= 1);
    assert.equal(source.analysis.id, analysis.id);
    assert.equal(source.resume_text, "");
  } finally {
    if (previousMode === undefined) {
      delete process.env.RESUME_TEXT_STORAGE;
    } else {
      process.env.RESUME_TEXT_STORAGE = previousMode;
    }

    if (previousRetentionDays === undefined) {
      delete process.env.RESUME_TEXT_RETENTION_DAYS;
    } else {
      process.env.RESUME_TEXT_RETENTION_DAYS = previousRetentionDays;
    }
  }
});

test("interrupted analysis jobs are requeued for restart recovery", async () => {
  const filePath = path.join(tempDir, `restart-recovery-${Date.now()}.docx`);

  fs.writeFileSync(filePath, createDocxBuffer("Restart recovery resume text with React Node SQL and measurable results."));

  const job = createAnalysisJobRecord({
    file: {
      originalname: "restart-recovery.docx",
      path: filePath,
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: fs.statSync(filePath).size
    },
    body: {
      privacyConsent: "true"
    },
    user: {
      id: "restart-user",
      email: "restart@example.com"
    }
  });
  const claimed = claimNextAnalysisJob();

  assert.equal(job.status, "queued");
  assert.equal(claimed.id, job.id);
  assert.equal(readAnalysisJobRow(job.id).status, "processing");
  assert.ok(requeueInterruptedAnalysisJobs() >= 1);
  assert.equal(readAnalysisJobRow(job.id).status, "queued");

  const reclaimed = claimNextAnalysisJob();

  assert.equal(reclaimed.id, job.id);
  assert.equal(readAnalysisJobRow(job.id).status, "processing");
});

test("password reset updates password and revokes previous sessions", async () => {
  const email = `reset-${Date.now()}@example.com`;
  const password = "old-password-123";
  const newPassword = "new-password-456";

  const register = await postJson("/api/auth/register", {
    name: "Reset User",
    email,
    password
  });

  assert.equal(register.response.status, 201);
  assert.match(register.data.dev_code, /^\d{6}$/);

  const verify = await postJson("/api/auth/verify-code", {
    email,
    code: register.data.dev_code
  });

  assert.equal(verify.response.status, 200);
  assert.equal(verify.data.token, undefined);
  assert.match(getCookieHeader(verify.response), /^career_ai_session=/);
  const oldSessionCookie = getCookieHeader(verify.response);

  const resetRequest = await postJson("/api/auth/request-password-reset", {
    email
  });

  assert.equal(resetRequest.response.status, 200);
  assert.match(resetRequest.data.dev_code, /^\d{6}$/);

  const reset = await postJson("/api/auth/reset-password", {
    email,
    code: resetRequest.data.dev_code,
    password: newPassword
  });

  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.token, undefined);
  assert.match(getCookieHeader(reset.response), /^career_ai_session=/);

  const oldSessionProfile = await fetch(`${baseUrl}/api/auth/profile`, {
    headers: {
      Cookie: oldSessionCookie
    }
  });

  assert.equal(oldSessionProfile.status, 401);

  const oldLogin = await postJson("/api/auth/login", {
    email,
    password
  });

  assert.equal(oldLogin.response.status, 401);

  const newLogin = await postJson("/api/auth/login", {
    email,
    password: newPassword
  });

  assert.equal(newLogin.response.status, 200);
  assert.equal(newLogin.data.token, undefined);
  assert.match(getCookieHeader(newLogin.response), /^career_ai_session=/);
});

test("mercado pago webhooks are idempotent and subscription-safe", async () => {
  const previousGateway = process.env.PAYMENT_GATEWAY;
  const previousAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const previousWebhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const previousUseSandbox = process.env.MERCADO_PAGO_USE_SANDBOX;
  const originalFetch = globalThis.fetch;
  const webhookSecret = "mp-webhook-secret";
  const preferenceRequests = [];
  const subscriptions = new Map();
  const paymentRequests = [];
  let preferenceCounter = 0;
  let currentPayment = null;

  process.env.PAYMENT_GATEWAY = "mercadopago";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-access-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = webhookSecret;
  process.env.MERCADO_PAGO_USE_SANDBOX = "true";

  globalThis.fetch = async (url, options = {}) => {
    const href = typeof url === "string" ? url : url?.url || "";

    if (href === "https://api.mercadopago.com/preapproval" && options.method === "POST") {
      preferenceCounter += 1;
      preferenceRequests.push(options);
      const payload = JSON.parse(options.body);
      const subscription = {
        id: `sub_${preferenceCounter}`,
        status: "pending",
        external_reference: payload.external_reference,
        init_point: `https://sandbox.mercadopago.com/subscriptions/checkout?preapproval_id=sub_${preferenceCounter}`
      };
      subscriptions.set(subscription.id, subscription);

      return new Response(JSON.stringify(subscription), {
        status: 201,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    if (href.startsWith("https://api.mercadopago.com/preapproval/")) {
      const id = href.split("/").pop();
      return new Response(JSON.stringify(subscriptions.get(id)), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (href.startsWith("https://api.mercadopago.com/v1/payments/")) {
      paymentRequests.push(href);

      return new Response(JSON.stringify(currentPayment), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    return originalFetch(url, options);
  };

  async function fetchCurrentSubscription(cookie) {
    const response = await fetch(`${baseUrl}/api/subscription`, {
      headers: {
        Cookie: cookie
      }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    return data.subscription;
  }

  async function sendMercadoPagoWebhook({ notificationId, paymentId, requestId }) {
    const response = await fetch(
      `${baseUrl}/api/subscription/webhook/mercadopago?data.id=${encodeURIComponent(paymentId)}&type=payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
          "x-signature": signMercadoPagoWebhook({
            dataId: paymentId,
            requestId,
            secret: webhookSecret
          })
        },
        body: JSON.stringify({
          id: notificationId,
          type: "payment",
          action: "payment.updated",
          data: {
            id: paymentId
          }
        })
      }
    );

    return {
      response,
      data: await response.json()
    };
  }

  try {
    const email = `payment-${Date.now()}@example.com`;
    const register = await postJson("/api/auth/register", {
      name: "Payment User",
      email,
      password: "payment-password-123"
    });

    assert.equal(register.response.status, 201);

    const verify = await postJson("/api/auth/verify-code", {
      email,
      code: register.data.dev_code
    });
    const sessionCookie = getCookieHeader(verify.response);

    assert.equal(verify.response.status, 200);

    const checkout = await postJson("/api/subscription/checkout", {
      plan: "Pro"
    }, sessionCookie);
    const checkoutId = checkout.data.checkout.id;

    assert.equal(checkout.response.status, 201);
    assert.equal(checkout.data.checkout.provider, "mercadopago");
    assert.equal(checkout.data.checkout.status, "pending");
    assert.match(checkout.data.checkout.checkout_url, /sandbox\.mercadopago\.com/);
    assert.equal(preferenceRequests[0].headers["X-Idempotency-Key"], checkoutId);

    currentPayment = {
      id: "pay_approved",
      status: "approved",
      external_reference: checkoutId,
      transaction_amount: 29,
      currency_id: "BRL",
      metadata: {
        checkout_id: checkoutId
      }
    };

    const approvedWebhook = await sendMercadoPagoWebhook({
      notificationId: "notif_approved_1",
      paymentId: "pay_approved",
      requestId: "req-approved-1"
    });

    assert.equal(approvedWebhook.response.status, 200);
    assert.equal(approvedWebhook.data.status, "approved");
    assert.equal(approvedWebhook.data.activated, true);
    assert.equal(readPaymentWebhookEvent("req-approved-1").processing_status, "processed");

    const paidSubscription = await fetchCurrentSubscription(sessionCookie);
    const firstPeriodEnd = paidSubscription.current_period_end_at;

    assert.equal(paidSubscription.plan, "Pro");
    assert.equal(paidSubscription.status, "active");
    assert.ok(firstPeriodEnd);
    assert.equal(paymentRequests.length, 1);

    const providerSubscriptionId = checkout.data.checkout.provider_checkout_id;
    subscriptions.set(providerSubscriptionId, {
      ...subscriptions.get(providerSubscriptionId),
      status: "authorized",
      next_payment_date: new Date(Date.now() + 31 * 86400000).toISOString()
    });
    const recurringRequestId = "req-recurring-1";
    const recurringResponse = await fetch(
      `${baseUrl}/api/subscription/webhook/mercadopago?data.id=${providerSubscriptionId}&type=subscription_preapproval`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": recurringRequestId,
          "x-signature": signMercadoPagoWebhook({ dataId: providerSubscriptionId, requestId: recurringRequestId, secret: webhookSecret })
        },
        body: JSON.stringify({ id: "notif_recurring_1", type: "subscription_preapproval", data: { id: providerSubscriptionId } })
      }
    );
    const recurringData = await recurringResponse.json();
    const recurringSubscription = await fetchCurrentSubscription(sessionCookie);

    assert.equal(recurringResponse.status, 200);
    assert.equal(recurringData.recurring, true);
    assert.equal(recurringSubscription.provider_subscription_id, providerSubscriptionId);
    assert.ok(recurringSubscription.next_payment_at);
    const activePeriodEnd = recurringSubscription.current_period_end_at;

    const cancellation = await deleteJson("/api/subscription", undefined, sessionCookie);
    assert.equal(cancellation.response.status, 200);
    assert.equal(cancellation.data.subscription.status, "canceling");
    assert.equal(cancellation.data.subscription.cancel_at_period_end, true);

    const duplicateWebhook = await sendMercadoPagoWebhook({
      notificationId: "notif_approved_1",
      paymentId: "pay_approved",
      requestId: "req-approved-1"
    });

    assert.equal(duplicateWebhook.response.status, 200);
    assert.equal(duplicateWebhook.data.duplicate, true);
    assert.equal(paymentRequests.length, 1);

    const secondApprovedWebhook = await sendMercadoPagoWebhook({
      notificationId: "notif_approved_2",
      paymentId: "pay_approved",
      requestId: "req-approved-2"
    });
    const subscriptionAfterSecondApproved = await fetchCurrentSubscription(sessionCookie);

    assert.equal(secondApprovedWebhook.response.status, 200);
    assert.equal(secondApprovedWebhook.data.activated, false);
    assert.equal(subscriptionAfterSecondApproved.plan, "Pro");
    assert.equal(subscriptionAfterSecondApproved.current_period_end_at, activePeriodEnd);

    const rejectedCheckout = await postJson("/api/subscription/checkout", {
      plan: "Pro"
    }, sessionCookie);
    const rejectedCheckoutId = rejectedCheckout.data.checkout.id;

    assert.equal(rejectedCheckout.response.status, 201);

    currentPayment = {
      id: "pay_rejected",
      status: "rejected",
      external_reference: rejectedCheckoutId,
      transaction_amount: 29,
      currency_id: "BRL",
      metadata: {
        checkout_id: rejectedCheckoutId
      }
    };

    const rejectedWebhook = await sendMercadoPagoWebhook({
      notificationId: "notif_rejected_1",
      paymentId: "pay_rejected",
      requestId: "req-rejected-1"
    });
    const subscriptionAfterRejectedAttempt = await fetchCurrentSubscription(sessionCookie);

    assert.equal(rejectedWebhook.response.status, 200);
    assert.equal(rejectedWebhook.data.status, "rejected");
    assert.equal(subscriptionAfterRejectedAttempt.plan, "Pro");
    assert.equal(subscriptionAfterRejectedAttempt.current_period_end_at, activePeriodEnd);

    currentPayment = {
      id: "pay_approved",
      status: "refunded",
      external_reference: checkoutId,
      transaction_amount: 29,
      currency_id: "BRL",
      metadata: {
        checkout_id: checkoutId
      }
    };

    const refundedWebhook = await sendMercadoPagoWebhook({
      notificationId: "notif_refunded_1",
      paymentId: "pay_approved",
      requestId: "req-refunded-1"
    });
    const subscriptionAfterRefund = await fetchCurrentSubscription(sessionCookie);

    assert.equal(refundedWebhook.response.status, 200);
    assert.equal(refundedWebhook.data.status, "refunded");
    assert.equal(subscriptionAfterRefund.plan, "Gratis");
    assert.equal(subscriptionAfterRefund.status, "refunded");
  } finally {
    globalThis.fetch = originalFetch;

    if (previousGateway === undefined) {
      delete process.env.PAYMENT_GATEWAY;
    } else {
      process.env.PAYMENT_GATEWAY = previousGateway;
    }

    if (previousAccessToken === undefined) {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    } else {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = previousAccessToken;
    }

    if (previousWebhookSecret === undefined) {
      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    } else {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = previousWebhookSecret;
    }

    if (previousUseSandbox === undefined) {
      delete process.env.MERCADO_PAGO_USE_SANDBOX;
    } else {
      process.env.MERCADO_PAGO_USE_SANDBOX = previousUseSandbox;
    }
  }
});

test("async resume analysis jobs are persisted and pollable", async () => {
  const previousAsyncJobs = process.env.ASYNC_ANALYSIS_JOBS;

  process.env.ASYNC_ANALYSIS_JOBS = "true";

  try {
    const email = `async-job-${Date.now()}@example.com`;
    const register = await postJson("/api/auth/register", {
      name: "Async Job User",
      email,
      password: "async-password-123"
    });

    assert.equal(register.response.status, 201);

    const verify = await postJson("/api/auth/verify-code", {
      email,
      code: register.data.dev_code
    });
    const sessionCookie = getCookieHeader(verify.response);
    const csrf = await getCsrfForCookie(sessionCookie);
    const form = new FormData();
    const docx = createDocxBuffer(
      "Maria Silva desenvolvedora frontend com React JavaScript TypeScript testes automatizados Playwright API SQL ingles intermediario email maria.async@example.com telefone 11988887777 resultados mensuraveis em produto digital."
    );

    form.append(
      "resume",
      new Blob([docx], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      "async-resume.docx"
    );
    form.append("privacyConsent", "true");
    form.append("targetJobTitle", "Frontend Developer");
    form.append("targetJobDescription", "React TypeScript Playwright API produto digital");

    const uploadResponse = await fetch(`${baseUrl}/api/analysis`, {
      method: "POST",
      headers: {
        Cookie: csrf.cookie,
        "x-csrf-token": csrf.token
      },
      body: form
    });
    const upload = await uploadResponse.json();

    assert.equal(uploadResponse.status, 202);
    assert.equal(upload.success, true);
    assert.match(upload.job.id, /^analysis_job_/);
    assert.ok(["queued", "processing"].includes(upload.job.status));

    const storedJob = readAnalysisJobRow(upload.job.id);

    assert.equal(storedJob.account_email, email);
    assert.equal(storedJob.file_name, "async-resume.docx");
    assert.equal(JSON.parse(storedJob.request_body).targetJobTitle, "Frontend Developer");

    let completedJob = null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const jobResponse = await fetch(`${baseUrl}/api/analysis/jobs/${upload.job.id}`, {
        headers: {
          Cookie: sessionCookie
        }
      });
      const jobPayload = await jobResponse.json();

      assert.equal(jobResponse.status, 200);

      if (jobPayload.job.status === "completed") {
        completedJob = jobPayload.job;
        break;
      }

      if (jobPayload.job.status === "failed") {
        assert.fail(jobPayload.job.error || "Async job failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    assert.ok(completedJob, "analysis job did not complete in time");
    assert.equal(completedJob.analysis.account_email, email);
    assert.equal(completedJob.analysis.file_name, "async-resume.docx");
    assert.ok(completedJob.analysis.ats_score >= 0);
    assert.equal(completedJob.notification, null);
    assert.deepEqual(completedJob.analysis.recommended_jobs, []);
    assert.equal(completedJob.analysis.job_search_status, "disabled");

    const refreshCsrf = await getCsrfForCookie(sessionCookie);
    const refreshResponse = await fetch(`${baseUrl}/api/analysis/${completedJob.analysis.id}/jobs/refresh`, {
      method: "POST",
      headers: {
        Cookie: refreshCsrf.cookie,
        "x-csrf-token": refreshCsrf.token
      }
    });
    const refreshPayload = await refreshResponse.json();
    assert.equal(refreshResponse.status, 200);
    assert.equal(refreshPayload.analysis.job_search_status, "disabled");

    const completedStoredJob = readAnalysisJobRow(upload.job.id);

    assert.equal(completedStoredJob.status, "completed");
    assert.equal(completedStoredJob.analysis_id, completedJob.analysis.id);
    assert.equal(JSON.parse(completedStoredJob.analysis_result).id, completedJob.analysis.id);
  } finally {
    if (previousAsyncJobs === undefined) {
      delete process.env.ASYNC_ANALYSIS_JOBS;
    } else {
      process.env.ASYNC_ANALYSIS_JOBS = previousAsyncJobs;
    }
  }
});

test("resume upload rejects files with invalid content signature", async () => {
  const account = await registerVerifiedUser({
    email: `invalid-upload-${Date.now()}@example.com`
  });
  const csrf = await getCsrfForCookie(account.sessionCookie);
  const form = new FormData();

  form.append(
    "resume",
    new Blob(["not a real docx"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }),
    "fake-resume.docx"
  );
  form.append("privacyConsent", "true");

  const response = await fetch(`${baseUrl}/api/analysis`, {
    method: "POST",
    headers: {
      Cookie: csrf.cookie,
      "x-csrf-token": csrf.token
    },
    body: form
  });
  const data = await response.json();

  assert.equal(response.status, 415);
  assert.equal(data.success, false);
  assert.match(data.error, /DOCX válido|DOCX valido/i);
});

test("resume upload rejects an electricity bill disguised as a resume", async () => {
  const account = await registerVerifiedUser({
    email: `non-resume-${Date.now()}@example.com`
  });
  const csrf = await getCsrfForCookie(account.sessionCookie);
  const form = new FormData();
  const bill = createDocxBuffer(
    "Conta de energia eletrica. Unidade consumidora 123456. Consumo faturado 245 kWh. " +
    "Leitura anterior 10200 leitura atual 10445. Valor a pagar R$ 219,90. " +
    "Data de vencimento 20/07/2026. Codigo de barras 12345 67890."
  );

  form.append(
    "resume",
    new Blob([bill], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }),
    "conta-de-luz.docx"
  );
  form.append("privacyConsent", "true");

  const response = await fetch(`${baseUrl}/api/analysis`, {
    method: "POST",
    headers: {
      Cookie: csrf.cookie,
      "x-csrf-token": csrf.token
    },
    body: form
  });
  const data = await response.json();

  assert.equal(response.status, 422);
  assert.equal(data.success, false);
  assert.match(data.error, /n.o parece ser um curr.culo/i);
});

test("tracked jobs persist and move through application stages", async () => {
  const account = await registerVerifiedUser();
  const job = {
    id: "remotive-123",
    external_id: "remotive:123",
    title: "Frontend Engineer",
    company: "Example Corp",
    url: "https://example.com/jobs/123",
    is_real: true
  };
  const saved = await postJson("/api/jobs/tracked", { job, status: "saved" }, account.sessionCookie);
  assert.equal(saved.response.status, 201);
  assert.equal(saved.data.tracked_job.status, "saved");

  const updated = await patchJson("/api/jobs/tracked/remotive%3A123", { status: "applied" }, account.sessionCookie);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.tracked_job.status, "applied");
  assert.ok(updated.data.tracked_job.applied_at);

  const listedResponse = await fetch(`${baseUrl}/api/jobs/tracked`, { headers: { Cookie: account.sessionCookie } });
  const listed = await listedResponse.json();
  assert.equal(listed.tracked_jobs.length, 1);
  assert.equal(listed.tracked_jobs[0].job.title, "Frontend Engineer");

  const removed = await deleteJson("/api/jobs/tracked/remotive%3A123", undefined, account.sessionCookie);
  assert.equal(removed.response.status, 200);
});

test("auth flow, usage and analysis tasks work together", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "test-password-123";

  const register = await postJson("/api/auth/register", {
    name: "Test User",
    email,
    password
  });

  assert.equal(register.response.status, 201);
  assert.match(register.data.dev_code, /^\d{6}$/);

  const unverifiedLogin = await postJson("/api/auth/login", {
    email,
    password
  });

  assert.equal(unverifiedLogin.response.status, 202);
  assert.equal(unverifiedLogin.data.requires_verification, true);
  assert.match(unverifiedLogin.data.dev_code, /^\d{6}$/);

  const verify = await postJson("/api/auth/verify-code", {
    email,
    code: unverifiedLogin.data.dev_code
  });

  assert.equal(verify.response.status, 200);
  assert.equal(verify.data.token, undefined);
  assert.match(getCookieHeader(verify.response), /^career_ai_session=/);
  const sessionCookie = getCookieHeader(verify.response);

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  const me = await meResponse.json();

  assert.equal(meResponse.status, 200);
  assert.equal(me.user.email, email);

  const directLogin = await postJson("/api/auth/login", {
    email,
    password
  });

  assert.equal(directLogin.response.status, 200);
  assert.equal(directLogin.data.token, undefined);
  assert.match(getCookieHeader(directLogin.response), /^career_ai_session=/);
  assert.equal(directLogin.data.user.email, email);

  const usageResponse = await fetch(`${baseUrl}/api/analysis/usage`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  const usage = await usageResponse.json();

  assert.equal(usageResponse.status, 200);
  assert.equal(usage.usage.limit, 3);

  const profileCsrf = await getCsrfForCookie(sessionCookie);
  const invalidProfileResponse = await fetch(`${baseUrl}/api/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: profileCsrf.cookie,
      "x-csrf-token": profileCsrf.token
    },
    body: JSON.stringify({ name: "Test User", targetRole: "Garota de programa" })
  });
  const invalidProfile = await invalidProfileResponse.json();
  assert.equal(invalidProfileResponse.status, 422);
  assert.equal(invalidProfile.code, "INVALID_CAREER_INTENT");

  const csrfRejected = await fetch(`${baseUrl}/api/subscription/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie
    },
    body: JSON.stringify({ plan: "Pro" })
  });
  const csrfError = await csrfRejected.json();

  assert.equal(csrfRejected.status, 403);
  assert.equal(csrfError.code, "CSRF_TOKEN_INVALID");

  const checkout = await postJson("/api/subscription/checkout", {
    plan: "Pro"
  }, sessionCookie);

  assert.equal(checkout.response.status, 200);
  assert.equal(checkout.data.checkout.provider, "demo");
  assert.equal(checkout.data.subscription.plan, "Pro");
  assert.equal(checkout.data.subscription.status, "active");
  assert.ok(checkout.data.subscription.current_period_end_at);

  const cancelCsrf = await getCsrfForCookie(sessionCookie);
  const cancelResponse = await fetch(`${baseUrl}/api/subscription`, {
    method: "DELETE",
    headers: {
      Cookie: cancelCsrf.cookie,
      "x-csrf-token": cancelCsrf.token
    }
  });
  const canceled = await cancelResponse.json();

  assert.equal(cancelResponse.status, 200);
  assert.equal(canceled.subscription.plan, "Pro");
  assert.equal(canceled.subscription.status, "canceling");
  assert.equal(canceled.subscription.cancel_at_period_end, true);

  const analysis = createResumeAnalysis({
    fileName: "resume.pdf",
    resumeText: "Joao Silva\nDesenvolvedor Frontend\nExperiencia com React, JavaScript, testes automatizados e atendimento a usuarios.",
    accountEmail: email,
    targetJobTitle: "Frontend Developer",
    targetJobDescription: "React, TypeScript e testes automatizados.",
    jobMatchScore: 78,
    matchedKeywords: ["react", "typescript"],
    atsScore: 82,
    clarityScore: 76,
    marketCompatibility: 78,
    suggestions: ["Adicionar métricas de impacto.", "Reforçar testes automatizados."],
    recommendedJobs: []
  });

  const tasksResponse = await fetch(`${baseUrl}/api/analysis/${analysis.id}/tasks`, {
    headers: {
      Cookie: sessionCookie
    }
  });
  const tasks = await tasksResponse.json();

  assert.equal(tasksResponse.status, 200);
  assert.deepEqual(tasks.tasks.checked, {});

  const updateTasksCsrf = await getCsrfForCookie(sessionCookie);
  const updatedTasks = await fetch(`${baseUrl}/api/analysis/${analysis.id}/tasks`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: updateTasksCsrf.cookie,
      "x-csrf-token": updateTasksCsrf.token
    },
    body: JSON.stringify({ checked: { 0: true, 1: false } })
  });
  const updated = await updatedTasks.json();

  assert.equal(updatedTasks.status, 200);
  assert.deepEqual(updated.tasks.checked, { 0: true, 1: false });

  const improvedCsrf = await getCsrfForCookie(sessionCookie);
  const improvedResponse = await fetch(`${baseUrl}/api/analysis/${analysis.id}/improved-resume`, {
    method: "POST",
    headers: {
      Cookie: improvedCsrf.cookie,
      "x-csrf-token": improvedCsrf.token
    }
  });
  const improved = await improvedResponse.json();

  assert.equal(improvedResponse.status, 200);
  assert.equal(improved.improved_resume.analysis_id, analysis.id);
  assert.equal(typeof improved.improved_resume.content, "string");
  assert.ok(improved.improved_resume.content.includes("Joao Silva"));
});

test("admin dashboard is restricted and exposes operational data", async () => {
  const previousAdminEmails = process.env.ADMIN_EMAILS;
  const previousAdminEmail = process.env.ADMIN_EMAIL;
  const previousAdminUserIds = process.env.ADMIN_USER_IDS;
  const previousAdminUserId = process.env.ADMIN_USER_ID;

  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_USER_IDS;
  delete process.env.ADMIN_USER_ID;

  try {
    const regular = await registerVerifiedUser({
      email: `regular-admin-check-${Date.now()}@example.com`,
      name: "Regular User"
    });
    const regularResponse = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: {
        Cookie: regular.sessionCookie
      }
    });
    const regularData = await regularResponse.json();

    assert.equal(regularResponse.status, 403);
    assert.equal(regularData.success, false);

    const adminEmail = `admin-${Date.now()}@example.com`;

    process.env.ADMIN_EMAILS = adminEmail;

    const admin = await registerVerifiedUser({
      email: adminEmail,
      name: "Admin User"
    });

    assert.equal(admin.user.is_admin, true);

    recordAIEvent({
      task: "resume-analysis",
      provider: "test",
      model: "test-model",
      status: "failed",
      accountEmail: adminEmail,
      message: "Synthetic admin dashboard event",
      context: {
        source: "test"
      }
    });

    const adminResponse = await fetch(`${baseUrl}/api/admin/dashboard?limit=5`, {
      headers: {
        Cookie: admin.sessionCookie
      }
    });
    const adminData = await adminResponse.json();

    assert.equal(adminResponse.status, 200);
    assert.equal(adminData.success, true);
    assert.ok(adminData.admin.summary.users >= 2);
    assert.ok(adminData.admin.summary.ai_events >= 1);
    assert.ok(adminData.admin.users.some((user) => user.email === adminEmail));
    assert.ok(adminData.admin.ai_events.some((event) => event.message === "Synthetic admin dashboard event"));
  } finally {
    if (previousAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = previousAdminEmails;
    }

    if (previousAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = previousAdminEmail;
    }

    if (previousAdminUserIds === undefined) {
      delete process.env.ADMIN_USER_IDS;
    } else {
      process.env.ADMIN_USER_IDS = previousAdminUserIds;
    }

    if (previousAdminUserId === undefined) {
      delete process.env.ADMIN_USER_ID;
    } else {
      process.env.ADMIN_USER_ID = previousAdminUserId;
    }
  }
});

test("privacy endpoints export, clear and delete account data", async () => {
  const account = await registerVerifiedUser({
    email: `lgpd-${Date.now()}@example.com`,
    name: "LGPD User"
  });
  const resumeText = "LGPD source text with private phone 11999998888 and email lgpd@example.com.";
  const analysis = createResumeAnalysis({
    fileName: "lgpd-resume.pdf",
    resumeText,
    accountEmail: account.email,
    atsScore: 81,
    clarityScore: 77,
    marketCompatibility: 79,
    suggestions: ["Reduce personal data exposure."],
    recommendedJobs: []
  });
  const jobFilePath = path.join(tempDir, `lgpd-job-${Date.now()}.docx`);

  fs.writeFileSync(jobFilePath, createDocxBuffer("LGPD queued job resume text."));
  createAnalysisJobRecord({
    file: {
      originalname: "lgpd-job.docx",
      path: jobFilePath,
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: fs.statSync(jobFilePath).size
    },
    body: {
      privacyConsent: "true"
    },
    user: {
      id: account.user.id,
      email: account.email
    }
  });
  const analyticsEvent = await postJson("/api/analytics/events", {
    anonymous_id: "privacy_test_visitor",
    event_name: "analysis_viewed",
    properties: {
      route: "/analysis",
      email: account.email,
      resume_text: resumeText
    }
  }, account.sessionCookie);

  assert.equal(analyticsEvent.response.status, 202);

  const exportResponse = await fetch(`${baseUrl}/api/privacy/export`, {
    headers: {
      Cookie: account.sessionCookie
    }
  });
  const exported = await exportResponse.json();
  const exportedAnalysis = exported.data.analyses.find((item) => item.id === analysis.id);

  assert.equal(exportResponse.status, 200);
  assert.equal(exported.success, true);
  assert.equal(exported.data.user.email, account.email);
  assert.equal(exportedAnalysis.resume_text, resumeText);
  assert.ok(exported.data.analysis_jobs.length >= 1);
  assert.equal(exported.data.analytics_events.length, 1);
  assert.deepEqual(exported.data.analytics_events[0].properties, { route: "/analysis" });

  const clearTexts = await deleteJson("/api/privacy/resume-texts", undefined, account.sessionCookie);

  assert.equal(clearTexts.response.status, 200);
  assert.ok(clearTexts.data.cleared_resume_texts >= 1);

  const exportAfterClearResponse = await fetch(`${baseUrl}/api/privacy/export`, {
    headers: {
      Cookie: account.sessionCookie
    }
  });
  const exportAfterClear = await exportAfterClearResponse.json();
  const clearedAnalysis = exportAfterClear.data.analyses.find((item) => item.id === analysis.id);

  assert.equal(exportAfterClearResponse.status, 200);
  assert.equal(clearedAnalysis.resume_text, "");

  const deleteAnalyses = await deleteJson("/api/privacy/analyses", undefined, account.sessionCookie);

  assert.equal(deleteAnalyses.response.status, 200);
  assert.ok(deleteAnalyses.data.deleted_analyses >= 1);
  assert.ok(deleteAnalyses.data.deleted_jobs >= 1);

  const exportAfterAnalysesResponse = await fetch(`${baseUrl}/api/privacy/export`, {
    headers: {
      Cookie: account.sessionCookie
    }
  });
  const exportAfterAnalyses = await exportAfterAnalysesResponse.json();

  assert.equal(exportAfterAnalysesResponse.status, 200);
  assert.equal(exportAfterAnalyses.data.analyses.length, 0);
  assert.equal(exportAfterAnalyses.data.analysis_jobs.length, 0);

  const rejectedAccountDelete = await deleteJson("/api/privacy/account", {
    confirm: "cancelar"
  }, account.sessionCookie);

  assert.equal(rejectedAccountDelete.response.status, 400);

  const accountDelete = await deleteJson("/api/privacy/account", {
    confirm: "EXCLUIR"
  }, account.sessionCookie);

  assert.equal(accountDelete.response.status, 200);
  assert.equal(accountDelete.data.deleted_account, true);
  assert.equal(accountDelete.data.result.deleted_user, 1);
  assert.equal(accountDelete.data.result.deleted_analytics_events, 1);

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Cookie: account.sessionCookie
    }
  });

  assert.equal(meResponse.status, 401);
});
