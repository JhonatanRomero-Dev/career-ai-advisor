import assert from "assert/strict";
import test from "node:test";
import path from "node:path";

import { validateRuntimeConfig } from "../src/config.js";

const CONFIG_ENV_KEYS = [
  "NODE_ENV",
  "AUTH_CODE_SECRET",
  "OAUTH_STATE_SECRET",
  "FRONTEND_URL",
  "CORS_ORIGIN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "AUTH_COOKIE_SECURE",
  "AUTH_RETURN_TOKEN_IN_RESPONSE",
  "ALLOW_DEV_EMAIL_FALLBACK",
  "EXPOSE_DEV_AUTH_CODE",
  "ALLOW_DEMO_CHECKOUT",
  "RESUME_TEXT_STORAGE",
  "RESUME_TEXT_ENCRYPTION_KEY",
  "PAYMENT_GATEWAY",
  "PAYMENT_PROVIDER",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MP_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "MP_WEBHOOK_SECRET",
  "MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS",
  "BACKEND_PUBLIC_URL",
  "MERCADO_PAGO_NOTIFICATION_URL",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "DATABASE_URL",
  "DATABASE_PROVIDER",
  "DB_PROVIDER",
  "SQLITE_DB_PATH"
];
const persistentSqlitePath = path.resolve(path.parse(process.cwd()).root, "var", "lib", "career-ai", "career-ai.sqlite");

function withConfigEnv(values, callback) {
  const previous = Object.fromEntries(
    CONFIG_ENV_KEYS.map((key) => [key, process.env[key]])
  );

  for (const key of CONFIG_ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, values);

  try {
    return callback();
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

const silentLogger = {
  warn() {}
};

test("production config rejects unsafe defaults", () => {
  withConfigEnv({
    NODE_ENV: "production",
    FRONTEND_URL: "http://localhost:5173",
    CORS_ORIGIN: "*",
    AUTH_COOKIE_SECURE: "false",
    ALLOW_DEMO_CHECKOUT: "true"
  }, () => {
    assert.throws(
      () => validateRuntimeConfig({ logger: silentLogger }),
      (error) => {
        assert.equal(error.code, "CONFIG_VALIDATION_FAILED");
        assert.match(error.message, /AUTH_CODE_SECRET/);
        assert.match(error.message, /FRONTEND_URL/);
        assert.match(error.message, /CORS_ORIGIN/);
        assert.match(error.message, /AUTH_COOKIE_SECURE/);
        return true;
      }
    );
  });
});

test("production config requires a usable SMTP port", () => {
  withConfigEnv({
    NODE_ENV: "production",
    AUTH_CODE_SECRET: "auth-secret-at-least-long-enough",
    OAUTH_STATE_SECRET: "oauth-secret-at-least-long-enough",
    FRONTEND_URL: "https://app.example.com",
    CORS_ORIGIN: "https://app.example.com",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "smtp-password",
    SMTP_FROM: "Career AI <mailer@example.com>"
  }, () => {
    assert.throws(() => validateRuntimeConfig({ logger: silentLogger }), /SMTP_PORT/);
    process.env.SMTP_PORT = "99999";
    assert.throws(() => validateRuntimeConfig({ logger: silentLogger }), /SMTP_PORT/);
  });
});

test("production config accepts explicit secure settings", () => {
  withConfigEnv({
    NODE_ENV: "production",
    AUTH_CODE_SECRET: "auth-secret-at-least-long-enough",
    OAUTH_STATE_SECRET: "oauth-secret-at-least-long-enough",
    FRONTEND_URL: "https://app.example.com",
    CORS_ORIGIN: "https://app.example.com",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "smtp-password",
    SMTP_FROM: "Career AI <mailer@example.com>",
    AUTH_COOKIE_SECURE: "true",
    RESUME_TEXT_STORAGE: "encrypted",
    RESUME_TEXT_ENCRYPTION_KEY: "resume-secret-at-least-long-enough",
    PAYMENT_GATEWAY: "mercadopago",
    MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-token",
    MERCADO_PAGO_WEBHOOK_SECRET: "webhook-secret",
    BACKEND_PUBLIC_URL: "https://api.example.com",
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    DATABASE_URL: "postgres://user:pass@example.com:5432/career_ai",
    DATABASE_PROVIDER: "sqlite",
    SQLITE_DB_PATH: persistentSqlitePath
  }, () => {
    assert.deepEqual(validateRuntimeConfig({ logger: silentLogger }), {
      errors: [],
      warnings: []
    });
  });
});

test("production config requires an explicit persistent SQLite path and supported runtime", () => {
  withConfigEnv({
    NODE_ENV: "production",
    AUTH_CODE_SECRET: "auth-secret-at-least-long-enough",
    OAUTH_STATE_SECRET: "oauth-secret-at-least-long-enough",
    FRONTEND_URL: "https://app.example.com",
    CORS_ORIGIN: "https://app.example.com",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "smtp-password",
    SMTP_FROM: "Career AI <mailer@example.com>",
    AUTH_COOKIE_SECURE: "true",
    DATABASE_PROVIDER: "sqlite",
    DATABASE_URL: "postgres://user:pass@example.com:5432/career_ai"
  }, () => {
    assert.throws(() => validateRuntimeConfig({ logger: silentLogger }), /SQLITE_DB_PATH/);
    process.env.SQLITE_DB_PATH = "backend/data/career-ai.sqlite";
    assert.throws(() => validateRuntimeConfig({ logger: silentLogger }), /caminho absoluto/);
    process.env.SQLITE_DB_PATH = persistentSqlitePath;
    process.env.DATABASE_PROVIDER = "postgres";
    assert.throws(() => validateRuntimeConfig({ logger: silentLogger }), /runtime de producao ainda usa SQLite/);
  });
});

test("production config accepts Mercado Pago alias environment variables", () => {
  withConfigEnv({
    NODE_ENV: "production",
    AUTH_CODE_SECRET: "auth-secret-at-least-long-enough",
    OAUTH_STATE_SECRET: "oauth-secret-at-least-long-enough",
    FRONTEND_URL: "https://app.example.com",
    CORS_ORIGIN: "https://app.example.com",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "smtp-password",
    SMTP_FROM: "Career AI <mailer@example.com>",
    AUTH_COOKIE_SECURE: "true",
    PAYMENT_PROVIDER: "mp",
    MP_ACCESS_TOKEN: "APP_USR-alias-token",
    MP_WEBHOOK_SECRET: "alias-webhook-secret",
    BACKEND_PUBLIC_URL: "https://api.example.com",
    AI_PROVIDER: "groq",
    GROQ_API_KEY: "gsk-test",
    DATABASE_URL: "postgres://user:pass@example.com:5432/career_ai",
    DATABASE_PROVIDER: "sqlite",
    SQLITE_DB_PATH: persistentSqlitePath
  }, () => {
    assert.deepEqual(validateRuntimeConfig({ logger: silentLogger }), {
      errors: [],
      warnings: []
    });
  });
});
