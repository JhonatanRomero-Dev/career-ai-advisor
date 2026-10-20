import assert from "node:assert/strict";
import test from "node:test";
import { assertEmailDeliveryConfigured, sendVerificationCode } from "../src/email.js";

test("development code preview is limited to the configured test email", async () => {
  const keys = [
    "NODE_ENV",
    "ALLOW_DEV_EMAIL_FALLBACK",
    "DEV_AUTH_TEST_EMAIL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS"
  ];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalWarn = console.warn;

  try {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_EMAIL_FALLBACK = "true";
    process.env.DEV_AUTH_TEST_EMAIL = "mobile-test@example.test";
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]) {
      delete process.env[key];
    }
    console.warn = () => {};

    assert.doesNotThrow(() => assertEmailDeliveryConfigured("MOBILE-TEST@example.test"));
    assert.throws(
      () => assertEmailDeliveryConfigured("other@example.test"),
      (error) => error.statusCode === 503 && error.reason === "SMTP_CONFIG_MISSING"
    );

    const delivery = await sendVerificationCode("mobile-test@example.test", "123456");
    assert.equal(delivery.devCode, "123456");
    await assert.rejects(
      sendVerificationCode("other@example.test", "123456"),
      (error) => error.statusCode === 503
    );

    process.env.NODE_ENV = "test";
    assert.doesNotThrow(() => assertEmailDeliveryConfigured("other@example.test"));

    process.env.NODE_ENV = "production";
    assert.throws(() => assertEmailDeliveryConfigured("mobile-test@example.test"));
  } finally {
    console.warn = originalWarn;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
