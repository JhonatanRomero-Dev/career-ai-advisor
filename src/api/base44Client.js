const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BASE44_APP_BASE_URL ||
  "http://localhost:3000";

export const base44 = {
  auth: {
    getUser: async () => {
      const savedUser = localStorage.getItem("career-ai-current-user");

      if (savedUser) {
        return JSON.parse(savedUser);
      }

      return {
        id: "1",
        name: "Usuario Teste",
        email: "teste@email.com",
      };
    },

    login: async ({ email } = {}) => {
      const user = {
        id: email || "local-user",
        name: email ? email.split("@")[0] : "Usuario",
        email: email || "usuario@email.com",
      };

      localStorage.setItem("logged", "true");
      localStorage.setItem("career-ai-current-user", JSON.stringify(user));

      return user;
    },

    requestVerificationCode: async ({ email } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao enviar codigo");
      }

      return data;
    },

    verifyCode: async ({ email, code } = {}) => {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Codigo invalido");
      }

      localStorage.setItem("logged", "true");
      localStorage.setItem("career-ai-current-user", JSON.stringify(data.user));

      return data.user;
    },

    logout: async () => {
      localStorage.removeItem("logged");
      localStorage.removeItem("career-ai-current-user");

      window.location.href = "/";
    },
  },

  entities: {
    ResumeAnalysis: {
      list: async (_order = "-created_date", limit = 50) => {
        const response = await fetch(`${API_BASE_URL}/api/analysis?limit=${limit}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erro ao carregar analises");
        }

        return data.analyses;
      },

      filter: async ({ id }) => {
        if (!id) {
          return [];
        }

        const response = await fetch(`${API_BASE_URL}/api/analysis/${id}`);
        const data = await response.json();

        if (response.status === 404) {
          return [];
        }

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Erro ao carregar analise");
        }

        return [data.analysis];
      },
    },
  },
};
