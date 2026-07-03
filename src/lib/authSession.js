export const AUTH_LOGGED_KEY = "logged";
export const AUTH_USER_KEY = "career-ai-current-user";
export const AUTH_TOKEN_KEY = "career-ai-auth-token";

export function readAuthSession() {
  if (typeof window === "undefined") {
    return {
      isAuthenticated: false,
      token: "",
      user: null
    };
  }

  const logged = localStorage.getItem(AUTH_LOGGED_KEY) === "true";
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  const savedUser = localStorage.getItem(AUTH_USER_KEY);

  if (!logged || !token || !savedUser) {
    return {
      isAuthenticated: false,
      token: "",
      user: null
    };
  }

  try {
    const user = JSON.parse(savedUser);

    return {
      isAuthenticated: Boolean(user?.email),
      token,
      user: user?.email ? user : null
    };
  } catch {
    return {
      isAuthenticated: false,
      token: "",
      user: null
    };
  }
}

export function hasValidAuthSession() {
  return readAuthSession().isAuthenticated;
}
