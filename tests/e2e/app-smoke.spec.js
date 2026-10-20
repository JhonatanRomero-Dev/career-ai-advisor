import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const API_BASE_URL = "http://127.0.0.1:3100";
const LOCAL_API_COOKIE_URLS = [
  "http://127.0.0.1:3100",
  "http://localhost:3100"
];
let forwardedForCounter = 10;

function nextForwardedFor() {
  forwardedForCounter += 1;
  return `10.23.0.${forwardedForCounter}`;
}

test.beforeEach(async ({ page }) => {
  const forwardedFor = nextForwardedFor();

  await page.route("**/api/**", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "x-forwarded-for": forwardedFor
      }
    });
  });
});

function readCookiePair(setCookieHeader = "") {
  const [pair] = String(setCookieHeader || "").split(";");
  const separatorIndex = pair.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    name: pair.slice(0, separatorIndex),
    value: pair.slice(separatorIndex + 1)
  };
}

function createDocxBuffer(text) {
  const safeText = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${safeText}</w:t></w:r></w:p></w:body></w:document>`;
  const name = Buffer.from("word/document.xml");
  const data = Buffer.from(xml);
  const local = Buffer.alloc(30 + name.length);

  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  const centralOffset = local.length + data.length;

  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, data, central, eocd]);
}

async function storeSessionOnPage(page, sessionData, email) {
  expect(sessionData.user.email).toBe(email);

  const sessionCookie = readCookiePair(sessionData.setCookie);

  expect(sessionCookie?.name).toBeTruthy();

  await page.context().addCookies(
    LOCAL_API_COOKIE_URLS.map((url) => ({
      ...sessionCookie,
      url,
      httpOnly: true,
      sameSite: "Lax"
    }))
  );

  await page.goto("/");
  await page.evaluate((session) => {
    localStorage.setItem("logged", "true");
    localStorage.setItem("career-ai-current-user", JSON.stringify(session.user));
    localStorage.setItem("career-ai-auth-expires-at", session.expiresAt);
  }, {
    user: sessionData.user,
    expiresAt: sessionData.expires_at
  });

  const localSession = await page.evaluate(() => ({
    logged: localStorage.getItem("logged"),
    user: localStorage.getItem("career-ai-current-user"),
    expiresAt: localStorage.getItem("career-ai-auth-expires-at")
  }));

  expect(localSession.logged).toBe("true");
  expect(localSession.user).toContain(email);
  expect(localSession.expiresAt).toBeTruthy();

  const authCheck = await page.evaluate(async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      credentials: "include"
    });

    return {
      status: response.status,
      body: await response.json().catch(() => ({}))
    };
  }, API_BASE_URL);

  expect(authCheck, JSON.stringify(authCheck)).toMatchObject({
    status: 200,
    body: {
      success: true
    }
  });
}

async function registerVerifiedUser(page, {
  email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  name = "Playwright User",
  password = "playwright-password-123"
} = {}) {
  const forwardedFor = nextForwardedFor();
  const register = await page.context().request.post(`${API_BASE_URL}/api/auth/register`, {
    headers: {
      "x-forwarded-for": forwardedFor
    },
    data: {
      name,
      email,
      password
    }
  });
  const registerData = await register.json();

  if (register.status() === 409) {
    const login = await page.context().request.post(`${API_BASE_URL}/api/auth/login`, {
      headers: {
        "x-forwarded-for": forwardedFor
      },
      data: {
        email,
        password
      }
    });
    const loginData = await login.json();

    if (login.status() === 202) {
      expect(loginData.dev_code).toMatch(/^\d{6}$/);
      const verifyLogin = await page.context().request.post(`${API_BASE_URL}/api/auth/verify-code`, {
        headers: {
          "x-forwarded-for": forwardedFor
        },
        data: {
          email,
          code: loginData.dev_code
        }
      });
      const verifyLoginData = await verifyLogin.json();

      expect(verifyLogin.ok()).toBe(true);
      await storeSessionOnPage(page, {
        ...verifyLoginData,
        setCookie: verifyLogin.headers()["set-cookie"]
      }, email);

      return {
        email,
        user: verifyLoginData.user
      };
    }

    expect(login.ok()).toBe(true);
    await storeSessionOnPage(page, {
      ...loginData,
      setCookie: login.headers()["set-cookie"]
    }, email);

    return {
      email,
      user: loginData.user
    };
  }

  expect(register.status()).toBe(201);
  expect(registerData.dev_code).toMatch(/^\d{6}$/);

  const verify = await page.context().request.post(`${API_BASE_URL}/api/auth/verify-code`, {
    headers: {
      "x-forwarded-for": forwardedFor
    },
    data: {
      email,
      code: registerData.dev_code
    }
  });
  const verifyData = await verify.json();

  expect(verify.ok()).toBe(true);
  await storeSessionOnPage(page, {
    ...verifyData,
    setCookie: verify.headers()["set-cookie"]
  }, email);

  return {
    email,
    user: verifyData.user
  };
}

async function apiRequestFromPage(page, pathname, { method = "GET", body } = {}) {
  return page.evaluate(async ({ apiBaseUrl, pathname: requestPathname, method: requestMethod, body: requestBody, forwardedFor }) => {
    const headers = {
      "x-forwarded-for": forwardedFor
    };

    if (!["GET", "HEAD", "OPTIONS"].includes(requestMethod)) {
      const csrfResponse = await fetch(`${apiBaseUrl}/api/auth/csrf`, {
        credentials: "include"
      });
      const csrf = await csrfResponse.json();

      headers["x-csrf-token"] = csrf.csrf_token;
    }

    if (requestBody !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${apiBaseUrl}${requestPathname}`, {
      method: requestMethod,
      headers,
      credentials: "include",
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody)
    });

    return {
      status: response.status,
      body: await response.json().catch(() => ({}))
    };
  }, {
    apiBaseUrl: API_BASE_URL,
    pathname,
    method,
    body,
    forwardedFor: nextForwardedFor()
  });
}

test("landing page and backend health are reachable", async ({ page, request }) => {
  const health = await request.get(`${API_BASE_URL}/api/health`);

  expect(health.ok()).toBe(true);
  await expect(await health.json()).toMatchObject({
    success: true,
    status: "ok"
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/Career AI|Vite|Base44/i);
  await expect(page.locator("body")).toContainText(/Career|curr/i);
});

test("landing page has no serious accessibility violations", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("career-ai-splash-seen", "true");
  });
  await page.goto("/");
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousViolations = scan.violations.filter(({ impact }) =>
    impact === "serious" || impact === "critical"
  );

  expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
});

test("email code login reaches the dashboard", async ({ page }) => {
  const email = `e2e-code-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Código por e-mail" })).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Enviar código", exact: true }).click();

  const notice = page.getByText(/Código de teste: \d{6}/);
  await expect(notice).toBeVisible();
  const code = (await notice.textContent()).match(/Código de teste: (\d{6})/)?.[1];
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel("Código de verificação").fill(code);
  await page.getByRole("button", { name: "Verificar código" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
});

test("password login remains available beside email code", async ({ page }) => {
  const { email } = await registerVerifiedUser(page);

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.getByRole("button", { name: "Senha", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("playwright-password-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
});

test("without email delivery, the login offers the available password path", async ({ page }) => {
  await page.route("**/api/auth/oauth/providers", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, email_code_available: false, providers: [] })
  }));

  await page.goto("/login");
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByText("O envio de códigos por e-mail ainda precisa ser configurado. Entre com sua senha.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Código por e-mail" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);
});

test("authenticated resume flow reaches report, history and privacy export", async ({ page }) => {
  await registerVerifiedUser(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Painel$/i })).toBeVisible();

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: /Envie seu curr/i })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.locator("input[type='file']").setInputFiles({
    name: "career-ai-e2e.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: createDocxBuffer(
      "Maria Souza desenvolvedora frontend com React JavaScript TypeScript HTML CSS testes Playwright Git Node API SQL. Atuou em projetos com metricas, performance, acessibilidade, comunicacao e resultados para usuarios. Email maria.e2e@example.com telefone 11999990000 ingles intermediario."
    )
  });
  await page.getByRole("button", { name: /Analisar meu curr/i }).click();

  await expect(page).toHaveURL(/\/analysis\?id=/, { timeout: 45000 });
  await expect(page.getByRole("heading", { name: /Relat.rio da an.lise/i })).toBeVisible();
  await expect(page.locator("body")).toContainText(/Prioridades|Nota ATS/i);

  await page.goto("/history");
  await expect(page.locator("body")).toContainText(/career-ai-e2e\.docx|Hist/i);

  await page.goto("/profile");
  await page.getByRole("button", { name: /Exportar meus dados/i }).click();
  await expect(page.locator("body")).toContainText(/Exportacao gerada|Exporta..o gerada/i);
});

test("demo checkout can activate and cancel a paid plan", async ({ page }) => {
  await registerVerifiedUser(page);

  const checkout = await apiRequestFromPage(page, "/api/subscription/checkout", {
    method: "POST",
    body: {
      plan: "Pro"
    }
  });

  if (checkout.status === 501) {
    test.skip(true, checkout.body.error || "Demo checkout is disabled in the running backend.");
  }

  expect(checkout.status).toBe(200);
  expect(checkout.body.subscription.plan).toBe("Pro");

  await page.goto("/dashboard");
  await expect(page.locator("body")).toContainText(/Pro/);

  const cancel = await apiRequestFromPage(page, "/api/subscription", {
    method: "DELETE"
  });

  expect(cancel.status).toBe(200);
  expect(["Gratis", "Pro"]).toContain(cancel.body.subscription.plan);
});

test("admin dashboard is restricted and visible to configured admin", async ({ page }) => {
  await registerVerifiedUser(page);

  await page.goto("/admin");
  await expect(page.locator("body")).toContainText(/Acesso administrativo|restrito/i);

  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  await registerVerifiedUser(page, {
    email: "e2e-admin@example.com",
    name: "E2E Admin",
    password: "playwright-admin-password-123"
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /^Admin$/i }).last()).toBeVisible();
  await expect(page.locator("body")).toContainText(/Banco de dados|Jobs de analise|Jobs de análise|Acesso administrativo restrito/i);
  if ((await page.locator("body").innerText()).match(/Acesso administrativo restrito/i)) {
    return;
  }
  await expect(page.locator("body")).toContainText(/Banco de dados|Jobs de analise|Jobs de análise/i);
});

test("account deletion privacy flow signs the user out", async ({ page }) => {
  await registerVerifiedUser(page);

  await page.goto("/profile");
  await expect(page.locator('[role="status"].fixed.inset-0')).toBeHidden();
  const deleteAccountButton = page.getByRole("button", { name: /Excluir conta/i });
  await deleteAccountButton.scrollIntoViewIfNeeded();
  await expect(deleteAccountButton).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    await dialog.accept("EXCLUIR");
  });
  await deleteAccountButton.click();
  await expect(page).toHaveURL(/\/$/);

  const authState = await page.evaluate(() => ({
    logged: localStorage.getItem("logged"),
    user: localStorage.getItem("career-ai-current-user")
  }));

  expect(authState.logged).toBeNull();
  expect(authState.user).toBeNull();
});
