const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BASE44_APP_BASE_URL ||
  "http://localhost:3000";
const USER_STORAGE_KEY = "career-ai-current-user";
const TOKEN_STORAGE_KEY = "career-ai-auth-token";

function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function getAuthHeaders() {
  const token = getAuthToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function clearSession() {
  localStorage.removeItem("logged");
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function storeSession({ user, token } = {}) {
  if (!user || !token) {
    throw new Error("Sessão inválida");
  }

  localStorage.setItem("logged", "true");
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  return user;
}

function storeUser(user) {
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  return user;
}

async function readJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({
    success: false,
    error: "O backend respondeu em formato inesperado.",
  }));

  if (response.status === 401) {
    clearSession();
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

export const base44 = {
  auth: {
    getUser: async () => {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);

      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          clearSession();
        }
      }

      return null;
    },

    getAuthHeaders,
    storeSession,

    getProfile: async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Não foi possível carregar o perfil");

      return data.profile;
    },

    updateProfile: async (profile = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
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
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      return readJsonResponse(response, "Não foi possível criar a conta");
    },

    requestVerificationCode: async ({ email, password } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      return readJsonResponse(response, "Erro ao enviar código");
    },

    requestPasswordReset: async ({ email } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      return readJsonResponse(response, "Erro ao enviar código de recuperação");
    },

    resetPassword: async ({ email, code, password } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
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
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await readJsonResponse(response, "Código inválido");

      return storeSession(data);
    },

    startOAuth: async ({ provider, next = "/dashboard" } = {}) => {
      const params = new URLSearchParams({
        next,
      });
      const response = await fetch(`${API_BASE_URL}/api/auth/oauth/${provider}/start?${params.toString()}`);
      const data = await readJsonResponse(response, "Não foi possível iniciar o login social");

      window.location.href = data.authorizationUrl;
    },

    exchangeOAuthCode: async ({ code } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/oauth/exchange`, {
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
      const headers = getAuthHeaders();

      try {
        if (headers.Authorization) {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: "POST",
            headers,
          });
        }
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
        const response = await fetch(`${API_BASE_URL}/api/analysis?limit=${limit}`, {
          headers: getAuthHeaders(),
        });
        const data = await readJsonResponse(response, "Erro ao carregar análises");

        return data.analyses;
      },

      filter: async ({ id }) => {
        if (!id) {
          return [];
        }

        const response = await fetch(`${API_BASE_URL}/api/analysis/${id}`, {
          headers: getAuthHeaders(),
        });

        if (response.status === 404) {
          return [];
        }

        const data = await readJsonResponse(response, "Erro ao carregar análise");

        return [data.analysis];
      },

      delete: async (id) => {
        const response = await fetch(`${API_BASE_URL}/api/analysis/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await readJsonResponse(response, "Erro ao apagar análise");

        return data.deleted_analysis;
      },
    },
  },

  analysis: {
    getUsage: async () => {
      const response = await fetch(`${API_BASE_URL}/api/analysis/usage`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao consultar limite de análises");

      return data;
    },

    getTasks: async (analysisId) => {
      const response = await fetch(`${API_BASE_URL}/api/analysis/${analysisId}/tasks`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar melhorias");

      return data.tasks;
    },

    updateTasks: async (analysisId, checked = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/analysis/${analysisId}/tasks`, {
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
      const response = await fetch(`${API_BASE_URL}/api/analysis/${analysisId}/improved-resume`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao gerar currículo melhorado");

      return data.improved_resume;
    },
  },

  subscription: {
    getCurrent: async () => {
      const response = await fetch(`${API_BASE_URL}/api/subscription`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar assinatura");

      return data.subscription;
    },

    createCheckout: async (plan) => {
      const response = await fetch(`${API_BASE_URL}/api/subscription/checkout`, {
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

    activateDemoPlan: async (plan) => {
      const response = await fetch(`${API_BASE_URL}/api/subscription/demo-checkout`, {
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
  },

  support: {
    chat: async ({ message, history = [] } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/support/chat`, {
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
      const response = await fetch(`${API_BASE_URL}/api/notifications?limit=${limit}`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar notificacoes");
      if (data?.success === false) {

        throw new Error(data.error || "Erro ao carregar notificações");
      }

      return data;
    },

    unreadCount: async () => {
      const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(response, "Erro ao carregar notificacoes");

      if (data?.success === false) {
        throw new Error(data.error || "Erro ao carregar notificações");
      }

      return data.unread_count;
    },

    markAsRead: async (id) => {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
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
      const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
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
