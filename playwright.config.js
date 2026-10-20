import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eDbPath = path.join(__dirname, "test-results", "career-ai-e2e.sqlite");
const frontendUrl = "http://127.0.0.1:4173";
const backendUrl = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        VITE_API_BASE_URL: backendUrl,
        VITE_SHOW_DEV_AUTH_CODE: "true"
      }
    },
    {
      command: "cd backend && npm start",
      url: `${backendUrl}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NODE_ENV: "test",
        PORT: "3100",
        FRONTEND_URL: frontendUrl,
        CORS_ORIGIN: frontendUrl,
        SQLITE_DB_PATH: e2eDbPath,
        AUTH_CODE_SECRET: "playwright-auth-secret",
        OAUTH_STATE_SECRET: "playwright-oauth-secret",
        AI_PROVIDER: "none",
        OPENAI_API_KEY: "",
        GROQ_API_KEY: "",
        ALLOW_DEV_EMAIL_FALLBACK: "true",
        EXPOSE_DEV_AUTH_CODE: "true",
        ASYNC_ANALYSIS_JOBS: "false",
        API_RATE_LIMIT_WINDOW_MS: "1000",
        API_RATE_LIMIT_MAX: "2000",
        ALLOW_DEMO_CHECKOUT: "true",
        ADMIN_EMAILS: "e2e-admin@example.com",
        PAYMENT_GATEWAY: "",
        MERCADO_PAGO_ACCESS_TOKEN: "",
        MERCADO_PAGO_WEBHOOK_SECRET: ""
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
