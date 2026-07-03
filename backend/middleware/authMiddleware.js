import { getUserBySessionToken } from "../src/db.js";

export function getBearerToken(req) {
  const authorization = String(req.headers.authorization || "");
  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function requireAuth(req, res, next) {
  const token = getBearerToken(req);
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
