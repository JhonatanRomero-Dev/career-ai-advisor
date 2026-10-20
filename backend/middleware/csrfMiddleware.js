import crypto from "crypto";

export const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "career_ai_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PATHS = [
  /^\/api\/auth\/csrf$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/request-code$/,
  /^\/api\/auth\/request-email-login-code$/,
  /^\/api\/auth\/verify-code$/,
  /^\/api\/auth\/request-password-reset$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/oauth\/exchange$/,
  /^\/api\/subscription\/webhook\/mercadopago$/
];

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .reduce((cookies, [key, ...valueParts]) => {
      if (key) {
        cookies[key] = decodeURIComponent(valueParts.join("=") || "");
      }

      return cookies;
    }, {});
}

function getCsrfCookieOptions() {
  const secure = process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production";
  const domain = String(process.env.AUTH_COOKIE_DOMAIN || "").trim();
  const options = {
    httpOnly: false,
    secure,
    sameSite: secure && process.env.AUTH_COOKIE_SAME_SITE === "none" ? "none" : "lax",
    path: "/"
  };

  if (domain) {
    options.domain = domain;
  }

  return options;
}

function isCsrfExempt(req) {
  return SAFE_METHODS.has(req.method) ||
    EXEMPT_PATHS.some((pattern) => pattern.test(req.originalUrl.split("?")[0]));
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function issueCsrfToken(_req, res) {
  const csrfToken = createCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());

  return csrfToken;
}

export function requireCsrfProtection(req, res, next) {
  if (isCsrfExempt(req)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = String(cookies[CSRF_COOKIE_NAME] || "");
  const headerToken = String(req.get(CSRF_HEADER_NAME) || "");

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return res.status(403).json({
      success: false,
      code: "CSRF_TOKEN_INVALID",
      error: "Sessao protegida contra requisicao sem token CSRF valido."
    });
  }

  next();
}
