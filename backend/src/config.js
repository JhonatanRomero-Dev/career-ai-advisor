const HTTPS_URL_REGEX = /^https:\/\//i;
const LOCAL_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function isTrue(name) {
  return envValue(name).toLowerCase() === "true";
}

function parseOrigins(value = "") {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isHttpsPublicUrl(value = "") {
  return HTTPS_URL_REGEX.test(value) && !LOCAL_URL_REGEX.test(value);
}

function hasAnyEnv(names = []) {
  return names.some((name) => envValue(name));
}

function pushMissing(errors, names = [], message) {
  const missing = names.filter((name) => !envValue(name));

  if (missing.length > 0) {
    errors.push(`${message}: ${missing.join(", ")}`);
  }
}

function pushMissingAny(errors, names = [], message) {
  if (!hasAnyEnv(names)) {
    errors.push(`${message}: ${names.join(" ou ")}`);
  }
}

function validateProductionConfig() {
  const errors = [];
  const warnings = [];
  const frontendUrl = envValue("FRONTEND_URL");
  const corsOrigins = parseOrigins(envValue("CORS_ORIGIN") || frontendUrl);
  const backendPublicUrl = envValue("BACKEND_PUBLIC_URL") || envValue("PUBLIC_BACKEND_URL") || envValue("API_PUBLIC_URL");
  const mpNotificationUrl = envValue("MERCADO_PAGO_NOTIFICATION_URL") || envValue("MP_NOTIFICATION_URL");
  const paymentGateway = (envValue("PAYMENT_GATEWAY") || envValue("PAYMENT_PROVIDER")).toLowerCase();
  const usesMercadoPago =
    paymentGateway === "mercadopago" ||
    paymentGateway === "mp" ||
    hasAnyEnv(["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN"]);
  const aiProvider = (envValue("AI_PROVIDER") || "auto").toLowerCase();

  pushMissing(errors, ["AUTH_CODE_SECRET"], "Configure segredo de codigos de autenticacao");
  pushMissing(errors, ["OAUTH_STATE_SECRET"], "Configure segredo de estado OAuth");
  pushMissing(errors, ["FRONTEND_URL"], "Configure URL publica do frontend");
  pushMissing(errors, ["CORS_ORIGIN"], "Configure origem CORS permitida");
  pushMissing(errors, ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"], "Configure SMTP para envio de codigos");

  if (envValue("SMTP_PORT") && (!Number.isInteger(Number(envValue("SMTP_PORT"))) || Number(envValue("SMTP_PORT")) < 1 || Number(envValue("SMTP_PORT")) > 65535)) {
    errors.push("SMTP_PORT deve ser uma porta valida entre 1 e 65535.");
  }

  if (frontendUrl && !isHttpsPublicUrl(frontendUrl)) {
    errors.push("FRONTEND_URL deve ser uma URL HTTPS publica em producao.");
  }

  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    errors.push("CORS_ORIGIN deve listar origens explicitas, nunca '*'.");
  }

  for (const origin of corsOrigins) {
    if (!isHttpsPublicUrl(origin)) {
      errors.push(`CORS_ORIGIN deve usar HTTPS publico em producao: ${origin}`);
    }
  }

  if (envValue("AUTH_COOKIE_SECURE") === "false") {
    errors.push("AUTH_COOKIE_SECURE nao pode ser false em producao.");
  }

  if (envValue("AUTH_RETURN_TOKEN_IN_RESPONSE") === "true") {
    errors.push("AUTH_RETURN_TOKEN_IN_RESPONSE deve ficar false em producao.");
  }

  if (envValue("ALLOW_DEV_EMAIL_FALLBACK") === "true" || envValue("EXPOSE_DEV_AUTH_CODE") === "true") {
    errors.push("Fallback/codigo de email de desenvolvimento deve ficar desativado em producao.");
  }

  if (envValue("ALLOW_DEMO_CHECKOUT") === "true") {
    errors.push("ALLOW_DEMO_CHECKOUT deve ficar false em producao.");
  }

  if ((envValue("RESUME_TEXT_STORAGE") || "auto").toLowerCase() === "plain") {
    errors.push("RESUME_TEXT_STORAGE=plain nao deve ser usado em producao.");
  }

  if ((envValue("RESUME_TEXT_STORAGE") || "").toLowerCase() === "encrypted" && !hasAnyEnv(["RESUME_TEXT_ENCRYPTION_KEY", "AUTH_CODE_SECRET"])) {
    errors.push("RESUME_TEXT_STORAGE=encrypted requer RESUME_TEXT_ENCRYPTION_KEY ou AUTH_CODE_SECRET.");
  }

  if (usesMercadoPago) {
    pushMissingAny(
      errors,
      ["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN"],
      "Configure Mercado Pago"
    );
    pushMissingAny(
      errors,
      ["MERCADO_PAGO_WEBHOOK_SECRET", "MP_WEBHOOK_SECRET"],
      "Configure segredo de webhook Mercado Pago"
    );

    if (envValue("MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS") === "true") {
      errors.push("MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS deve ficar false em producao.");
    }

    if (!isHttpsPublicUrl(mpNotificationUrl || backendPublicUrl)) {
      errors.push("Configure BACKEND_PUBLIC_URL ou MERCADO_PAGO_NOTIFICATION_URL com HTTPS publico para webhooks.");
    }
  }

  if (aiProvider === "openai" && !envValue("OPENAI_API_KEY")) {
    errors.push("AI_PROVIDER=openai requer OPENAI_API_KEY.");
  }

  if (aiProvider === "groq" && !envValue("GROQ_API_KEY")) {
    errors.push("AI_PROVIDER=groq requer GROQ_API_KEY.");
  }

  if (aiProvider === "auto" && !hasAnyEnv(["OPENAI_API_KEY", "GROQ_API_KEY"])) {
    warnings.push("Nenhuma chave de IA configurada; a analise usara fallback heuristico.");
  }

  if (!envValue("DATABASE_URL")) {
    warnings.push("DATABASE_URL nao configurado; runtime usara SQLite local.");
  }

  return {
    errors,
    warnings
  };
}

export function validateRuntimeConfig({ logger = console } = {}) {
  if (process.env.NODE_ENV !== "production") {
    return {
      errors: [],
      warnings: []
    };
  }

  const result = validateProductionConfig();

  for (const warning of result.warnings) {
    logger.warn?.("production_config_warning", { warning });
  }

  if (result.errors.length > 0) {
    const error = new Error(`Configuracao de producao invalida: ${result.errors.join(" | ")}`);
    error.code = "CONFIG_VALIDATION_FAILED";
    error.details = result.errors;
    throw error;
  }

  return result;
}
