export const AUTH_LOGGED_KEY = "logged";
export const AUTH_USER_KEY = "career-ai-current-user";
export const AUTH_TOKEN_KEY = "career-ai-auth-token";
export const AUTH_EXPIRES_KEY = "career-ai-auth-expires-at";

function emptySession() {
  return {
    isAuthenticated: false,
    user: null,
    expiresAt: null
  };
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(AUTH_LOGGED_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
}

export function sanitizeAuthRedirectPath(nextPath = "/dashboard") {
  const value = String(nextPath || "").trim();

  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function readAuthSession() {
  if (typeof window === "undefined") {
    return emptySession();
  }

  const logged = localStorage.getItem(AUTH_LOGGED_KEY) === "true";
  const savedUser = localStorage.getItem(AUTH_USER_KEY);
  const expiresAt = localStorage.getItem(AUTH_EXPIRES_KEY);

  if (!logged || !savedUser || !expiresAt) {
    clearAuthSession();
    return emptySession();
  }

  const expiresTime = Date.parse(expiresAt);

  if (!Number.isFinite(expiresTime) || expiresTime <= Date.now()) {
    clearAuthSession();
    return emptySession();
  }

  try {
    const user = JSON.parse(savedUser);

    return {
      isAuthenticated: Boolean(user?.email),
      user: user?.email ? user : null,
      expiresAt
    };
  } catch {
    clearAuthSession();
    return emptySession();
  }
}

export function hasValidAuthSession() {
  return readAuthSession().isAuthenticated;
}
