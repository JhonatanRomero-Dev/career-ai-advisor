import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-mobile-demo-"));
const keys = [
  "NODE_ENV", "DEMO_EMAIL_LOGIN", "SQLITE_DB_PATH", "DATABASE_URL",
  "ALLOW_DEV_EMAIL_FALLBACK", "EXPOSE_DEV_AUTH_CODE", "DEV_AUTH_TEST_EMAIL",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"
];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

process.env.NODE_ENV = "development";
process.env.DEMO_EMAIL_LOGIN = "true";
process.env.SQLITE_DB_PATH = path.join(tempDir, ".codex-logs", "mobile-demo.sqlite");
process.env.DATABASE_URL = "";
process.env.ALLOW_DEV_EMAIL_FALLBACK = "true";
process.env.EXPOSE_DEV_AUTH_CODE = "true";
process.env.DEV_AUTH_TEST_EMAIL = "restricted@example.test";
process.env.SMTP_HOST = "invalid";
process.env.SMTP_PORT = "0";
process.env.SMTP_USER = "invalid";
process.env.SMTP_PASS = "invalid";

const { default: app } = await import("../server.js");
const { closeDatabase } = await import("../src/db.js");

test("isolated mobile demo signs in with any email and a visible code", async () => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const originalWarn = console.warn;

  try {
    console.warn = () => {};
    const tunnelOrigin = "https://mobile-example.lhr.life";
    const sameOriginHealth = await new Promise((resolve, reject) => {
      const request = http.request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path: "/api/health",
        headers: {
          host: "mobile-example.lhr.life",
          origin: tunnelOrigin,
          "x-forwarded-proto": "https"
        }
      }, (response) => {
        response.resume();
        response.on("end", () => resolve(response));
      });
      request.on("error", reject);
      request.end();
    });
    assert.equal(sameOriginHealth.statusCode, 200);
    assert.equal(sameOriginHealth.headers["access-control-allow-origin"], tunnelOrigin);

    const email = "any-email@example.test";
    const request = await fetch(`${baseUrl}/api/auth/request-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    const requested = await request.json();
    assert.equal(request.status, 200);
    assert.match(requested.dev_code, /^\d{6}$/);

    const verify = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: requested.dev_code })
    });
    const verified = await verify.json();
    assert.equal(verify.status, 200);
    assert.equal(verified.user.email, email);

    process.env.DEMO_EMAIL_LOGIN = "false";
    const normalRequest = await fetch(`${baseUrl}/api/auth/request-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "another@example.test" })
    });
    assert.equal(normalRequest.status, 400);

    const emailLogin = await fetch(`${baseUrl}/api/auth/request-email-login-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "restricted@example.test" })
    });
    const emailLoginData = await emailLogin.json();
    assert.equal(emailLogin.status, 200);
    assert.match(emailLoginData.dev_code, /^\d{6}$/);

    const emailLoginVerify = await fetch(`${baseUrl}/api/auth/verify-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "restricted@example.test", code: emailLoginData.dev_code })
    });
    assert.equal(emailLoginVerify.status, 200);
    assert.equal((await emailLoginVerify.json()).user.email, "restricted@example.test");

    process.env.ALLOW_DEV_EMAIL_FALLBACK = "false";
    const unavailable = await fetch(`${baseUrl}/api/auth/request-email-login-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "no-smtp@example.test" })
    });
    assert.equal(unavailable.status, 503);
  } finally {
    console.warn = originalWarn;
    await new Promise((resolve) => server.close(resolve));
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
