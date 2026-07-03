import {
  createPasswordUser,
  createAuthSession,
  createOAuthExchangeCode,
  consumeOAuthExchangeCode,
  getUserByEmail,
  getUserProfile,
  getUserBySessionToken,
  invalidateEmailVerificationCodes,
  invalidatePasswordResetCodes,
  preparePasswordLogin,
  revokeAuthSession,
  resetPasswordWithCode,
  saveEmailVerificationCode,
  savePasswordResetCode,
  updateUserName,
  upsertOAuthUser,
  upsertUserProfile,
  verifyEmailCode
} from "../src/db.js";
import { getBearerToken } from "../middleware/authMiddleware.js";
import crypto from "crypto";
import { sendPasswordResetCode, sendVerificationCode } from "../src/email.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_CODE_LIMIT = 5;
const VERIFY_CODE_LIMIT = 10;
const PASSWORD_LOGIN_LIMIT = 10;
const requestBuckets = new Map();
const verifyBuckets = new Map();
const GENERIC_LOGIN_ERROR = "Não foi possível validar suas credenciais. Confira e-mail, senha e tente novamente.";
const ACCOUNT_NOT_FOUND_ERROR = "Não encontramos uma conta com este e-mail. Use Criar conta para se cadastrar.";
const EMAIL_UNAVAILABLE_ERROR = "Não foi possível enviar o código agora. Tente novamente em instantes.";
const GENERIC_SERVER_ERROR = "Não foi possível processar sua solicitação agora.";
const PASSWORD_RESET_SENT_MESSAGE = "Se este e-mail estiver cadastrado, enviaremos um código de recuperação.";
const OAUTH_PROVIDERS = {
  google: {
    label: "Google",
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile"
  },
  linkedin: {
    label: "LinkedIn",
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    scope: "openid profile email"
  },
  apple: {
    label: "Apple",
    clientId: "APPLE_CLIENT_ID",
    clientSecret: "APPLE_CLIENT_SECRET",
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    scope: "name email"
  },
  facebook: {
    label: "Facebook",
    clientId: "FACEBOOK_CLIENT_ID",
    clientSecret: "FACEBOOK_CLIENT_SECRET",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me",
    scope: "email,public_profile"
  }
};

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function createCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function isSafeNextPath(nextPath = "") {
  return typeof nextPath === "string" && nextPath.startsWith("/") && !nextPath.startsWith("//");
}

function sanitizeNextPath(nextPath = "/dashboard") {
  return isSafeNextPath(nextPath) ? nextPath : "/dashboard";
}

function createSessionPayload(user) {
  const session = createAuthSession(user.id);

  return {
    user,
    token: session.token,
    expires_at: session.expires_at
  };
}

function base64UrlEncode(value) {
  return Buffer.from(String(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function getOAuthSecret() {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.AUTH_CODE_SECRET || process.env.SMTP_PASS;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure OAUTH_STATE_SECRET em produção.");
  }

  return "career-ai-oauth-state";
}

function createOAuthState({ provider, next, frontendOrigin }) {
  const payload = base64UrlEncode(JSON.stringify({
    provider,
    next: sanitizeNextPath(next),
    frontendOrigin,
    nonce: crypto.randomBytes(12).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000
  }));
  const signature = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${payload}.${signature}`;
}

function readOAuthState(state) {
  const [payload, signature] = String(state || "").split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", getOAuthSecret())
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));

    if (!parsed.exp || parsed.exp < Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getProvider(providerId) {
  return OAUTH_PROVIDERS[String(providerId || "").toLowerCase()] || null;
}

function getProviderCredentials(provider) {
  return {
    clientId: process.env[provider.clientId],
    clientSecret: process.env[provider.clientSecret]
  };
}

function getBackendOrigin(req) {
  return process.env.OAUTH_REDIRECT_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getFrontendOrigin(req) {
  return process.env.FRONTEND_URL || req.get("origin") || "http://localhost:5173";
}

function buildRedirectUri(req, providerId) {
  return `${getBackendOrigin(req)}/api/auth/oauth/${providerId}/callback`;
}

function buildFrontendLoginUrl(frontendOrigin, params) {
  const url = new URL("/login", frontendOrigin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Falha ao autenticar com o provedor.");
  }

  return data;
}

async function exchangeOAuthCode(providerId, provider, credentials, code, redirectUri) {
  if (providerId === "facebook") {
    const url = new URL(provider.tokenUrl);
    url.searchParams.set("client_id", credentials.clientId);
    url.searchParams.set("client_secret", credentials.clientSecret);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    return fetchJson(url);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret
  });

  return fetchJson(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
}

function decodeJwtPayload(token = "") {
  const payload = token.split(".")[1];

  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(base64UrlDecode(payload));
  } catch {
    return {};
  }
}

async function getOAuthProfile(providerId, provider, tokenData) {
  if (providerId === "apple") {
    const payload = decodeJwtPayload(tokenData.id_token);

    return {
      email: payload.email,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: payload.name || (payload.email ? String(payload.email).split("@")[0] : "")
    };
  }

  if (providerId === "facebook") {
    const url = new URL(provider.userInfoUrl);
    url.searchParams.set("fields", "id,name,email");
    url.searchParams.set("access_token", tokenData.access_token);
    const profile = await fetchJson(url);

    return {
      email: profile.email,
      emailVerified: Boolean(profile.email),
      name: profile.name
    };
  }

  const profile = await fetchJson(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  return {
    email: profile.email,
    emailVerified: profile.email_verified !== false,
    name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ")
  };
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  return String(ip || req.ip || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function rateLimitKey(req, email, purpose) {
  return `${purpose}:${getClientIp(req)}:${email}`;
}

function isRateLimited(bucket, key, limit) {
  const now = Date.now();
  const current = bucket.get(key);

  if (!current || current.resetAt <= now) {
    bucket.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

function sendRateLimitResponse(res) {
  return res.status(429).json({
    success: false,
    error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
  });
}

function getEmailUnavailableMessage(error) {
  if (process.env.NODE_ENV === "production") {
    return EMAIL_UNAVAILABLE_ERROR;
  }

  if (error.reason === "SMTP_CONFIG_MISSING") {
    const missing = Array.isArray(error.missing) && error.missing.length
      ? ` Faltando: ${error.missing.join(", ")}.`
      : "";

    return `SMTP não configurado no backend/.env.${missing}`;
  }

  if (error.reason === "SMTP_SEND_FAILED") {
    return `Falha ao enviar pelo SMTP. Confira usuário, senha de app, host e porta. ${error.smtpMessage || ""}`.trim();
  }

  return EMAIL_UNAVAILABLE_ERROR;
}

function getSafeErrorResponse(error) {
  if (error.statusCode === 503) {
    return {
      status: 503,
      message: getEmailUnavailableMessage(error)
    };
  }

  return {
    status: error.statusCode || 500,
    message: GENERIC_SERVER_ERROR
  };
}

function canExposeDevCode() {
  return process.env.NODE_ENV === "test" ||
    (
      process.env.NODE_ENV !== "production" &&
      process.env.EXPOSE_DEV_AUTH_CODE === "true"
    );
}

function getDevCodePayload(delivery) {
  if (!canExposeDevCode() || !delivery?.devCode) {
    return {};
  }

  return {
    delivery: delivery.delivery,
    dev_code: delivery.devCode
  };
}

export async function requestVerificationCode(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail válido"
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Informe e-mail e senha para continuar"
      });
    }

    if (isRateLimited(requestBuckets, rateLimitKey(req, email, "login-code"), REQUEST_CODE_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    const loginStatus = preparePasswordLogin(email, password);

    if (!loginStatus.allowed) {
      const errorByReason = {
        not_found: ACCOUNT_NOT_FOUND_ERROR,
        password_setup_too_short: "Esta conta ainda precisa de uma senha com pelo menos 8 caracteres.",
        invalid_password: GENERIC_LOGIN_ERROR
      };

      return res.status(401).json({
        success: false,
        error: errorByReason[loginStatus.reason] || GENERIC_LOGIN_ERROR
      });
    }

    const code = createCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    saveEmailVerificationCode(email, code, expiresAt);

    let delivery;

    try {
      delivery = await sendVerificationCode(email, code);
    } catch (emailError) {
      invalidateEmailVerificationCodes(email);
      throw emailError;
    }

    return res.json({
      success: true,
      message: "Código enviado para o e-mail informado",
      ...getDevCodePayload(delivery)
    });
  } catch (error) {
    console.error(error);
    const safeError = getSafeErrorResponse(error);

    return res.status(safeError.status).json({
      success: false,
      error: safeError.message
    });
  }
}

export async function loginWithPassword(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail válido"
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Informe e-mail e senha para continuar"
      });
    }

    if (isRateLimited(requestBuckets, rateLimitKey(req, email, "password-login"), PASSWORD_LOGIN_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    const loginStatus = preparePasswordLogin(email, password);

    if (!loginStatus.allowed) {
      const errorByReason = {
        not_found: ACCOUNT_NOT_FOUND_ERROR,
        password_setup_too_short: "Esta conta ainda precisa de uma senha com pelo menos 8 caracteres.",
        invalid_password: GENERIC_LOGIN_ERROR
      };

      return res.status(401).json({
        success: false,
        error: errorByReason[loginStatus.reason] || GENERIC_LOGIN_ERROR
      });
    }

    const user = getUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: GENERIC_LOGIN_ERROR
      });
    }

    if (!user.email_verified_at) {
      const code = createCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

      saveEmailVerificationCode(email, code, expiresAt);

      let delivery;

      try {
        delivery = await sendVerificationCode(email, code);
      } catch (emailError) {
        invalidateEmailVerificationCodes(email);
        throw emailError;
      }

      return res.status(202).json({
        success: true,
        requires_verification: true,
        message: "Enviamos um código para confirmar seu e-mail.",
        ...getDevCodePayload(delivery)
      });
    }

    return res.json({
      success: true,
      ...createSessionPayload(user)
    });
  } catch (error) {
    console.error(error);
    const safeError = getSafeErrorResponse(error);

    return res.status(safeError.status).json({
      success: false,
      error: safeError.message
    });
  }
}

export async function registerUser(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Informe seu nome para criar a conta"
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail válido"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter pelo menos 8 caracteres"
      });
    }

    if (isRateLimited(requestBuckets, rateLimitKey(req, email, "register"), REQUEST_CODE_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    const { alreadyExists } = createPasswordUser({
      email,
      name,
      password
    });

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        error: "Este e-mail já tem uma conta. Entre ou use a recuperação de senha."
      });
    }

    const code = createCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    saveEmailVerificationCode(email, code, expiresAt);

    let delivery;

    try {
      delivery = await sendVerificationCode(email, code);
    } catch (emailError) {
      invalidateEmailVerificationCodes(email);
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: "Conta criada. Enviamos um código para confirmar seu e-mail.",
      ...getDevCodePayload(delivery)
    });
  } catch (error) {
    console.error(error);
    const safeError = getSafeErrorResponse(error);

    return res.status(safeError.status).json({
      success: false,
      error: safeError.message
    });
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail válido"
      });
    }

    if (isRateLimited(requestBuckets, rateLimitKey(req, email, "password-reset"), REQUEST_CODE_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    const existingUser = getUserByEmail(email);

    if (!existingUser) {
      return res.json({
        success: true,
        message: PASSWORD_RESET_SENT_MESSAGE
      });
    }

    const code = createCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    savePasswordResetCode(email, code, expiresAt);

    let delivery;

    try {
      delivery = await sendPasswordResetCode(email, code);
    } catch (emailError) {
      invalidatePasswordResetCodes(email);
      throw emailError;
    }

    return res.json({
      success: true,
      message: PASSWORD_RESET_SENT_MESSAGE,
      ...getDevCodePayload(delivery)
    });
  } catch (error) {
    console.error(error);
    const safeError = getSafeErrorResponse(error);

    return res.status(safeError.status).json({
      success: false,
      error: safeError.message
    });
  }
}

export async function confirmPasswordReset(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();
    const password = String(req.body.password || "");

    if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: "E-mail ou código inválido"
      });
    }

    if (isRateLimited(verifyBuckets, rateLimitKey(req, email, "password-reset-confirm"), VERIFY_CODE_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "A senha deve ter pelo menos 8 caracteres"
      });
    }

    const user = resetPasswordWithCode(email, code, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Código inválido ou expirado"
      });
    }

    return res.json({
      success: true,
      ...createSessionPayload(user)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function confirmVerificationCode(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();

    if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: "E-mail ou código inválido"
      });
    }

    if (isRateLimited(verifyBuckets, rateLimitKey(req, email, "login-confirm"), VERIFY_CODE_LIMIT)) {
      return sendRateLimitResponse(res);
    }

    const user = verifyEmailCode(email, code);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Código inválido ou expirado"
      });
    }

    return res.json({
      success: true,
      ...createSessionPayload(user)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const token = getBearerToken(req);

    if (token) {
      const user = getUserBySessionToken(token);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Sessão inválida ou expirada"
        });
      }

      return res.json({
        success: true,
        user
      });
    }

    const email = normalizeEmail(req.query.email);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail válido"
      });
    }

    const user = getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado"
      });
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function getProfile(req, res) {
  try {
    const profile = getUserProfile(req.user.id, req.user);

    return res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function updateProfile(req, res) {
  try {
    const profileData = req.body || {};
    const user = updateUserName(req.user.id, profileData.name) || req.user;
    const profile = upsertUserProfile(user.id, profileData, user);

    return res.json({
      success: true,
      user,
      profile
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function logout(req, res) {
  try {
    const token = getBearerToken(req);

    if (token) {
      revokeAuthSession(token);
    }

    return res.json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function startOAuthLogin(req, res) {
  try {
    const providerId = String(req.params.provider || "").toLowerCase();
    const provider = getProvider(providerId);

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: "Provedor de login social não suportado."
      });
    }

    const credentials = getProviderCredentials(provider);

    if (!credentials.clientId || !credentials.clientSecret) {
      return res.status(501).json({
        success: false,
        error: `Login com ${provider.label} ainda precisa das credenciais OAuth no backend.`
      });
    }

    const redirectUri = buildRedirectUri(req, providerId);
    const state = createOAuthState({
      provider: providerId,
      next: req.query.next,
      frontendOrigin: getFrontendOrigin(req)
    });
    const authorizationUrl = new URL(provider.authUrl);

    authorizationUrl.searchParams.set("client_id", credentials.clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", provider.scope);
    authorizationUrl.searchParams.set("state", state);

    if (providerId === "google") {
      authorizationUrl.searchParams.set("prompt", "select_account");
    }

    if (providerId === "apple") {
      authorizationUrl.searchParams.set("response_mode", "query");
    }

    return res.json({
      success: true,
      authorizationUrl: authorizationUrl.toString()
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function exchangeOAuthSessionCode(req, res) {
  try {
    const code = String(req.body.code || "").trim();

    if (!/^[a-f0-9]{64}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: "Código OAuth inválido."
      });
    }

    const user = consumeOAuthExchangeCode(code);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Código OAuth expirado ou já utilizado."
      });
    }

    return res.json({
      success: true,
      ...createSessionPayload(user)
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: GENERIC_SERVER_ERROR
    });
  }
}

export async function finishOAuthLogin(req, res) {
  const fallbackOrigin = getFrontendOrigin(req);

  try {
    const providerId = String(req.params.provider || "").toLowerCase();
    const provider = getProvider(providerId);
    const state = readOAuthState(req.query.state);

    if (!provider || !state || state.provider !== providerId) {
      return res.redirect(buildFrontendLoginUrl(fallbackOrigin, {
        oauth_error: "Não foi possível validar o login social.",
        next: "/dashboard"
      }));
    }

    if (req.query.error) {
      return res.redirect(buildFrontendLoginUrl(state.frontendOrigin, {
        oauth_error: "Login social cancelado ou recusado.",
        next: state.next
      }));
    }

    const code = String(req.query.code || "");

    if (!code) {
      return res.redirect(buildFrontendLoginUrl(state.frontendOrigin, {
        oauth_error: "O provedor não retornou código de autorização.",
        next: state.next
      }));
    }

    const credentials = getProviderCredentials(provider);
    const redirectUri = buildRedirectUri(req, providerId);
    const tokenData = await exchangeOAuthCode(providerId, provider, credentials, code, redirectUri);
    const profile = await getOAuthProfile(providerId, provider, tokenData);

    if (!profile.email || !profile.emailVerified) {
      return res.redirect(buildFrontendLoginUrl(state.frontendOrigin, {
        oauth_error: "O provedor não retornou um e-mail verificado.",
        next: state.next
      }));
    }

    const user = upsertOAuthUser(profile.email, profile.name);
    const exchangeCode = createOAuthExchangeCode(user.id);

    return res.redirect(buildFrontendLoginUrl(state.frontendOrigin, {
      oauth_code: exchangeCode.code,
      next: state.next
    }));
  } catch (error) {
    console.error(error);

    return res.redirect(buildFrontendLoginUrl(fallbackOrigin, {
      oauth_error: "Não foi possível concluir o login social.",
      next: "/dashboard"
    }));
  }
}
