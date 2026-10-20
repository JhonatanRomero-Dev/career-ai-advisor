import { getUserBySessionToken } from "../src/db.js";

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "career_ai_session";

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

export function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function getCookieToken(req) {
  const cookies = parseCookies(req.headers.cookie);

  return String(cookies[AUTH_COOKIE_NAME] || "").trim();
}

export function getSessionToken(req) {
  return getCookieToken(req) || getBearerToken(req);
}

export function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  const user = token ? getUserBySessionToken(token) : null;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Entre na sua conta para continuar."
    });
  }

  req.authToken = token;
  req.user = user;
  next();
}
