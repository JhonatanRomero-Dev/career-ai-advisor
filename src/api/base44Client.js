import {
  AUTH_EXPIRES_KEY,
  AUTH_LOGGED_KEY,
  AUTH_USER_KEY,
  clearAuthSession,
  readAuthSession,
  sanitizeAuthRedirectPath,
} from "@/lib/authSession";

function normalizeApiBaseUrl(value = "") {
  return String(value || "").trim().replace(/\/$/, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BASE44_APP_BASE_URL || ""
);

let csrfToken = "";
let csrfTokenRequest = null;
const ANALYTICS_ID_KEY = "career-ai-anonymous-id";

function getAnonymousAnalyticsId() {
  let value = localStorage.getItem(ANALYTICS_ID_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANALYTICS_ID_KEY, value);
  }
  return value;
}

function isUnsafeMethod(method = "GET") {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

function isCsrfExemptPath(path = "") {
  const normalizedPath = String(path || "").split("?")[0];

  return [
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
  ].some((pattern) => pattern.test(normalizedPath));
}

export async function checkApiHealth({ timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json().catch(() => null);

    return Boolean(data?.success);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getCsrfToken({ forceRefresh = false } = {}) {
  if (csrfToken && !forceRefresh) {
    return csrfToken;
  }

  if (!csrfTokenRequest || forceRefresh) {
    csrfTokenRequest = fetch(`${API_BASE_URL}/api/auth/csrf`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const data = await readJsonResponse(response, "Nao foi possivel preparar a seguranca da sessao.");

        if (!data.csrf_token) {
          throw new Error("O backend nao retornou o token de seguranca da sessao.");
        }

        csrfToken = data.csrf_token;
        return csrfToken;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }

  return csrfTokenRequest;
}

export async function getCsrfHeaders() {
  return {
    "x-csrf-token": await getCsrfToken(),
  };
}

async function apiFetch(path, options = {}, retryingAfterCsrfRefresh = false) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});

  if (isUnsafeMethod(method) && !isCsrfExemptPath(path)) {
    headers.set("x-csrf-token", await getCsrfToken({
      forceRefresh: retryingAfterCsrfRefresh,
    }));
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error("Nao foi possivel conectar ao backend. Verifique se o servidor esta rodando.");
  }

  if (response.status === 403 && !retryingAfterCsrfRefresh) {
    const clone = response.clone();
    const data = await clone.json().catch(() => ({}));

    if (data.code === "CSRF_TOKEN_INVALID") {
      csrfToken = "";
      return apiFetch(path, options, true);
    }
  }

  return response;
}

function getAuthHeaders() {
  return {};
}

function clearSession() {
  clearAuthSession();
}

function storeSession({ user, expires_at: expiresAt } = {}) {
  if (!user || !expiresAt) {
    throw new Error("Sessão inválida");
  }

  localStorage.setItem(AUTH_LOGGED_KEY, "true");
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_EXPIRES_KEY, expiresAt);

  return user;
}

function storeUser(user) {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  return user;
}

async function readJsonResponse(response, fallbackMessage) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const rawBody = await response.text().catch(() => "");
  let data = null;

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = null;
    }
  }

  if (response.status === 401) {
    clearSession();
  }

  if (!response.ok || !data?.success) {
    if (!data) {
      if (response.status >= 500) {
        throw new Error("O backend esta indisponivel no momento. Verifique se o servidor esta rodando.");
      }

      if (!contentType.includes("json")) {
        throw new Error("O backend respondeu em formato inesperado. Verifique se a API esta apontando para o servidor correto.");
      }
    }

    const error = new Error(data?.error || fallbackMessage);
    error.fieldErrors = Array.isArray(data?.field_errors) ? data.field_errors : [];
    throw error;
  }

  return data;
}

export const base44 = {
  product: {
    request: async (path, method = "GET", body) => {
      const response = await apiFetch(`/api/product${path}`, {
        method, headers: { ...getAuthHeaders(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return readJsonResponse(response, "Não foi possível concluir a operação.");
    },
  },
  analytics: {
    track: async (eventName, properties = {}) => {
      if (navigator.doNotTrack === "1" || localStorage.getItem("career-ai-analytics-disabled") === "true") {
        return false;
      }

      try {
        await apiFetch("/api/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anonymous_id: getAnonymousAnalyticsId(),
            event_name: eventName,
            properties,
            occurred_at: new Date().toISOString(),
          }),
        });
        return true;
      } catch {
        return false;
      }
    },
  },

  auth: {
    getUser: async () => {
      return readAuthSession().user;
    },

    getAuthHeaders,
    storeSession,

    refreshSession: async () => {
      const response = await apiFetch("/api/auth/me");
      const data = await readJsonResponse(response, "Sessao invalida ou expirada");

      storeUser(data.user);

      return data.user;
    },

    getProfile: async () => {
      const response = await apiFetch("/api/auth/profile", {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Não foi possível carregar o perfil");

      return data.profile;
    },

    updateProfile: async (profile = {}) => {
      const response = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(profile),
      });
      const data = await readJsonResponse(response, "Não foi possível salvar o perfil");

      storeUser(data.user);

      return data.profile;
    },

    login: async ({ email, password } = {}) => {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJsonResponse(response, "Não foi possível entrar");

      if (data.requires_verification) {
        return data;
      }

      return storeSession(data);
    },

    register: async ({ name, email, password } = {}) => {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      return readJsonResponse(response, "Não foi possível criar a conta");
    },

    requestVerificationCode: async ({ email, password } = {}) => {
      const response = await apiFetch("/api/auth/request-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      return readJsonResponse(response, "Erro ao enviar código");
    },

    requestEmailLoginCode: async ({ email } = {}) => {
      const response = await apiFetch("/api/auth/request-email-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return readJsonResponse(response, "Erro ao enviar código");
    },

    requestPasswordReset: async ({ email } = {}) => {
      const response = await apiFetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      return readJsonResponse(response, "Erro ao enviar código de recuperação");
    },

    resetPassword: async ({ email, code, password } = {}) => {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await readJsonResponse(response, "Não foi possível redefinir a senha");

      return storeSession(data);
    },

    verifyCode: async ({ email, code } = {}) => {
      const response = await apiFetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await readJsonResponse(response, "Código inválido");

      return storeSession(data);
    },

    oauthProviders: async () => {
      const response = await apiFetch("/api/auth/oauth/providers");
      return readJsonResponse(response, "Não foi possível verificar o login social.");
    },

    startOAuth: async ({ provider, next = "/dashboard" } = {}) => {
      const params = new URLSearchParams({
        next: sanitizeAuthRedirectPath(next),
      });
      const response = await apiFetch(`/api/auth/oauth/${provider}/start?${params.toString()}`);
      const data = await readJsonResponse(response, "Não foi possível iniciar o login social");

      window.location.href = data.authorizationUrl;
    },

    exchangeOAuthCode: async ({ code } = {}) => {
      const response = await apiFetch("/api/auth/oauth/exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const data = await readJsonResponse(response, "Não foi possível concluir o login social");

      return storeSession(data);
    },

    logout: async () => {
      try {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          headers: getAuthHeaders(),
        });
      } catch (error) {
        console.warn("Não foi possível encerrar a sessão no backend:", error);
      }

      clearSession();

      window.location.href = "/";
    },
  },

  entities: {
    ResumeAnalysis: {
      list: async (_order = "-created_date", limit = 50) => {
        const response = await apiFetch(`/api/analysis?limit=${limit}`, {
          headers: getAuthHeaders(),
        });
        const data = await readJsonResponse(response, "Erro ao carregar análises");

        return data.analyses;
      },

      filter: async ({ id }) => {
        if (!id) {
          return [];
        }

        const response = await apiFetch(`/api/analysis/${id}`, {
          headers: getAuthHeaders(),
        });

        if (response.status === 404) {
          return [];
        }

        const data = await readJsonResponse(response, "Erro ao carregar análise");

        return [data.analysis];
      },

      delete: async (id) => {
        const response = await apiFetch(`/api/analysis/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await readJsonResponse(response, "Erro ao apagar análise");

        return data.deleted_analysis;
      },
    },
  },

  analysis: {
    getWorkspace: async (analysisId) => {
      const response = await apiFetch(`/api/analysis/${encodeURIComponent(analysisId)}/workspace`, { headers: getAuthHeaders() });
      return (await readJsonResponse(response, "Não foi possível carregar o currículo")).workspace;
    },
    saveVersion: async (analysisId, version) => {
      const response = await apiFetch(`/api/analysis/${encodeURIComponent(analysisId)}/versions`, {
        method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(version),
      });
      return (await readJsonResponse(response, "Não foi possível salvar a versão")).version;
    },
    deleteVersion: async (analysisId, versionId) => {
      const response = await apiFetch(`/api/analysis/${encodeURIComponent(analysisId)}/versions/${encodeURIComponent(versionId)}`, { method: "DELETE", headers: getAuthHeaders() });
      return readJsonResponse(response, "Não foi possível excluir a versão");
    },
    proposeRevision: async (analysisId, input) => {
      const response = await apiFetch(`/api/analysis/${encodeURIComponent(analysisId)}/revision`, {
        method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      return (await readJsonResponse(response, "Não foi possível revisar o trecho")).revision;
    },
    listJobs: async () => {
      const response = await apiFetch("/api/analysis/jobs", { headers: getAuthHeaders() });
      return (await readJsonResponse(response, "Não foi possível carregar as análises em andamento")).jobs;
    },
    getJob: async (jobId) => {
      const response = await apiFetch(`/api/analysis/jobs/${encodeURIComponent(jobId)}`, { headers: getAuthHeaders() });
      return (await readJsonResponse(response, "Não foi possível consultar o andamento")).job;
    },
    refreshJobs: async (analysisId) => {
      const response = await apiFetch(`/api/analysis/${encodeURIComponent(analysisId)}/jobs/refresh`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Não foi possível atualizar as vagas");
      return data.analysis;
    },

    getUsage: async () => {
      const response = await apiFetch("/api/analysis/usage", {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao consultar limite de análises");

      return data;
    },

    getTasks: async (analysisId) => {
      const response = await apiFetch(`/api/analysis/${analysisId}/tasks`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar melhorias");

      return data.tasks;
    },

    updateTasks: async (analysisId, checked = {}) => {
      const response = await apiFetch(`/api/analysis/${analysisId}/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ checked }),
      });
      const data = await readJsonResponse(response, "Erro ao salvar melhorias");

      return data.tasks;
    },

    generateImprovedResume: async (analysisId) => {
      const response = await apiFetch(`/api/analysis/${analysisId}/improved-resume`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao gerar currículo melhorado");

      return data.improved_resume;
    },
  },

  jobs: {
    search: async ({ keyword, location = "", signal }) => {
      const params = new URLSearchParams({ q: keyword, ...(location ? { location } : {}) });
      const response = await apiFetch(`/api/jobs/search?${params}`, { headers: getAuthHeaders(), signal });
      return readJsonResponse(response, "Não foi possível buscar vagas agora.");
    },

    listTracked: async () => {
      const response = await apiFetch("/api/jobs/tracked", { headers: getAuthHeaders() });
      const data = await readJsonResponse(response, "Não foi possível carregar suas candidaturas");
      return data.tracked_jobs;
    },

    save: async ({ job, analysisId, status = "saved" }) => {
      const response = await apiFetch("/api/jobs/tracked", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ job, analysis_id: analysisId, status }),
      });
      const data = await readJsonResponse(response, "Não foi possível salvar a vaga");
      return data.tracked_job;
    },

    update: async (externalId, updates) => {
      const response = await apiFetch(`/api/jobs/tracked/${encodeURIComponent(externalId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(updates),
      });
      const data = await readJsonResponse(response, "Não foi possível atualizar a candidatura");
      return data.tracked_job;
    },

    remove: async (externalId) => {
      const response = await apiFetch(`/api/jobs/tracked/${encodeURIComponent(externalId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await readJsonResponse(response, "Não foi possível remover a vaga");
      return true;
    },
  },

  subscription: {
    getCurrent: async () => {
      const response = await apiFetch("/api/subscription", {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar assinatura");

      return data.subscription;
    },

    createCheckout: async (plan) => {
      const response = await apiFetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ plan }),
      });
      const data = await readJsonResponse(response, "Erro ao iniciar checkout");

      return {
        checkout: data.checkout,
        subscription: data.subscription,
      };
    },

    getCheckoutStatus: async (checkoutId, { paymentId } = {}) => {
      const params = new URLSearchParams();

      if (paymentId) {
        params.set("payment_id", paymentId);
      }

      const query = params.toString();
      const response = await apiFetch(
        `/api/subscription/checkout/${encodeURIComponent(checkoutId)}${query ? `?${query}` : ""}`,
        {
          headers: getAuthHeaders(),
        }
      );
      const data = await readJsonResponse(response, "Erro ao consultar checkout");

      return {
        checkout: data.checkout,
        subscription: data.subscription,
      };
    },

    activateDemoPlan: async (plan) => {
      const response = await apiFetch("/api/subscription/demo-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ plan }),
      });
      const data = await readJsonResponse(response, "Erro ao ativar assinatura");

      return data.subscription;
    },

    cancelCurrent: async () => {
      const response = await apiFetch("/api/subscription", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao cancelar assinatura");

      return data.subscription;
    },
  },

  admin: {
    getDashboard: async ({ limit = 20 } = {}) => {
      const response = await apiFetch(`/api/admin/dashboard?limit=${encodeURIComponent(limit)}`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar painel administrativo");

      return data.admin;
    },

    retryAnalysisJob: async (jobId) => {
      const response = await apiFetch(`/api/admin/analysis-jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao reenfileirar job");

      return data.job;
    },
  },

  privacy: {
    exportData: async () => {
      const response = await apiFetch("/api/privacy/export", {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao exportar dados");

      return data.data;
    },

    clearResumeTexts: async () => {
      const response = await apiFetch("/api/privacy/resume-texts", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao apagar textos extraidos");

      return data;
    },

    deleteAnalyses: async () => {
      const response = await apiFetch("/api/privacy/analyses", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao apagar analises");

      return data;
    },

    deleteAccount: async ({ confirm } = {}) => {
      const response = await apiFetch("/api/privacy/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ confirm }),
      });
      const data = await readJsonResponse(response, "Erro ao excluir conta");

      clearSession();

      return data;
    },
  },

  support: {
    chat: async ({ message, history = [] } = {}) => {
      const response = await apiFetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ message, history }),
      });

      const data = await readJsonResponse(response, "Erro ao falar com o suporte");

      return data;
    },
  },

  notifications: {
    list: async (limit = 20) => {
      const response = await apiFetch(`/api/notifications?limit=${limit}`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar notificacoes");
      if (data?.success === false) {

        throw new Error(data.error || "Erro ao carregar notificações");
      }

      return data;
    },

    unreadCount: async () => {
      const response = await apiFetch("/api/notifications/unread-count", {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar notificacoes");

      if (data?.success === false) {
        throw new Error(data.error || "Erro ao carregar notificações");
      }

      return data.unread_count;
    },

    markAsRead: async (id) => {
      const response = await apiFetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao atualizar notificacao");

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao atualizar notificação");
      }

      return data;
    },

    markAllAsRead: async () => {
      const response = await apiFetch("/api/notifications/read-all", {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao atualizar notificacoes");

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao atualizar notificações");
      }

      return data;
    },
  },
};
