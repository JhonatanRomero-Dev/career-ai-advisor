import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";

const api = "http://127.0.0.1:3100";
async function signIn(page) {
  const email = `product-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const headers = { "x-forwarded-for": `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` };
  const register = await page.request.post(`${api}/api/auth/register`, { headers, data: { email, name: "Product Test", password: "product-test-password-123" } });
  expect(register.status()).toBe(201);
  const registration = await register.json();
  const verify = await page.request.post(`${api}/api/auth/verify-code`, { headers, data: { email, code: registration.dev_code } });
  expect(verify.status()).toBe(200);
  const session = await verify.json();
  await page.addInitScript(({ user, expiresAt }) => {
    localStorage.setItem("career-ai-splash-seen", "true");
    localStorage.setItem(`career-ai-onboarding-v1:${user.id}`, "complete");
    localStorage.setItem("career-ai-current-user", JSON.stringify(user));
    localStorage.setItem("career-ai-auth-expires-at", expiresAt);
    localStorage.setItem("logged", "true");
  }, { user: session.user, expiresAt: session.expires_at });
  return session;
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

const keywordJob = (keyword, id = keyword) => ({
  id, external_id: id, title: `Desenvolvedor ${keyword}`, company: "Empresa da busca", location: "Curitiba, PR",
  is_real: true, url: `https://example.com/jobs/${id}`, source: "Test source", required_skills: [keyword],
  match_evaluated: false, match_percentage: null, published_at: new Date().toISOString(),
});

test("profile UX recovers drafts, discards edits and keeps saving accessible", async ({ page }, testInfo) => {
  const session = await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  const headline = page.getByLabel("Título profissional", { exact: true });
  await expect(headline).toBeEnabled();
  await headline.fill("Analista de dados");
  await page.getByLabel("Resumo profissional", { exact: true }).fill("Experiência com Python e análise de dados.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Rascunho disponível" })).toBeVisible();
  await page.getByRole("button", { name: "Recuperar rascunho", exact: true }).click();
  await expect(headline).toHaveValue("Analista de dados");
  await page.getByRole("button", { name: "Excluir conta", exact: true }).scrollIntoViewIfNeeded();
  const save = page.getByRole("button", { name: "Salvar perfil", exact: true });
  await expect(save).toBeInViewport();
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("profile-save-bar.png"), fullPage: false });
  await save.click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((email) => localStorage.getItem(`career-ai-user-profile:${email}:draft:v1`), session.user.email)).toBeNull();
  await headline.fill("Alteração descartada");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(headline).toHaveValue("Analista de dados");
  await headline.fill("Outro rascunho");
  await page.reload();
  await page.getByRole("button", { name: "Descartar rascunho", exact: true }).click();
  await expect(headline).toHaveValue("Analista de dados");
  await page.reload();
  await expect(headline).toHaveValue("Analista de dados");
  await expect(page.getByRole("region", { name: "Rascunho disponível" })).toBeHidden();
});

test("profile UX pending fields open the right editor even from preview", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await page.getByRole("button", { name: "Preencher resumo profissional", exact: true }).click();
  await expect(page.getByLabel("Resumo profissional", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Visualizar perfil", exact: true }).click();
  await page.getByRole("button", { name: "Preencher habilidades", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Habilidades", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Preencher projetos", exact: true }).click();
  const add = page.getByRole("button", { name: "Adicionar projetos", exact: true });
  await expect(add).toBeFocused();
  await add.click();
  await page.getByRole("button", { name: "Preencher projetos", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nome do projeto", exact: true })).toBeFocused();
  await noOverflow(page);
});

test("profile UX keeps a recoverable draft after a failed save", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await page.getByLabel("Título profissional", { exact: true }).fill("Engenheira de software");
  await page.route("**/api/auth/profile", (route) => route.request().method() === "PATCH"
    ? route.fulfill({ status: 500, json: { error: "Falha temporária ao salvar." } }) : route.continue());
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await page.reload();
  await page.getByRole("button", { name: "Recuperar rascunho", exact: true }).click();
  await expect(page.getByLabel("Título profissional", { exact: true })).toHaveValue("Engenheira de software");
  await page.unroute("**/api/auth/profile");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
});

test("profile UX draft recovery is isolated between accounts", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await page.getByLabel("Título profissional", { exact: true }).fill("Rascunho da primeira conta");
  await signIn(page);
  await page.goto("/profile");
  await expect(page.getByLabel("Título profissional", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Título profissional", { exact: true })).toHaveValue("");
  await expect(page.getByRole("region", { name: "Rascunho disponível" })).toBeHidden();
});

test("profile UX imports only selected resume data after review", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/analysis?*", (route) => route.fulfill({ json: { success: true, analyses: [{ id: "import-resume", file_name: "curriculo.pdf", status: "completed", created_date: new Date().toISOString(),
    parsed_data: { phone: "11999999999" }, seniority: "Sênior", detected_skills: ["React", "Python"] }] } }));
  await page.goto("/profile");
  const phone = page.getByLabel("Telefone", { exact: true });
  await phone.fill("11888888888");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preencher com currículo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Importar telefone", exact: true }).check();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(phone).toHaveValue("11888888888");
  await page.getByRole("button", { name: "Preencher com currículo", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "Importar telefone", exact: true })).not.toBeChecked();
  await dialog.getByRole("checkbox", { name: "Importar habilidades", exact: true }).check();
  await dialog.getByRole("button", { name: "Aplicar selecionados", exact: true }).click();
  await expect(phone).toHaveValue("11888888888");
  await expect(page.getByRole("button", { name: "Remover habilidade Python", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remover habilidade React", exact: true })).toBeVisible();
  await expect(phone).toHaveValue("11888888888");
  await noOverflow(page);
});

test("profile UX checklist synchronizes report and dashboard and retains confirmed progress on errors", async ({ page }) => {
  await signIn(page);
  const analysis = { id: "analysis-ux", status: "completed", file_name: "curriculo.pdf", created_date: new Date().toISOString(), summary: "Perfil profissional",
    ats_score: 70, clarity_score: 80, market_compatibility: 75, suggestions: ["Adicionar resultados mensuráveis", "Revisar o resumo profissional"],
    detected_skills: ["React"], missing_keywords: [], weak_words: [], recommended_jobs: [], strengths: [], parsed_data: {} };
  let checked = {};
  let failSave = false;
  await page.route("**/api/analysis?*", (route) => route.fulfill({ json: { success: true, analyses: [analysis] } }));
  await page.route("**/api/analysis/analysis-ux", (route) => route.fulfill({ json: { success: true, analysis } }));
  await page.route("**/api/analysis/analysis-ux/tasks", (route) => {
    if (route.request().method() === "PATCH") {
      if (failSave) return route.fulfill({ status: 500, json: { error: "Falha ao salvar" } });
      checked = route.request().postDataJSON().checked;
    }
    return route.fulfill({ json: { success: true, tasks: { analysis_id: analysis.id, checked } } });
  });
  await page.goto("/dashboard");
  await expect(page.getByRole("group", { name: "Aplicar melhorias: pendente", exact: true })).toBeVisible();
  const checklist = page.getByRole("region", { name: "Checklist de melhorias", exact: true });
  await checklist.getByRole("checkbox").first().check();
  await expect(checklist).toContainText("1 de 2 concluídas");
  await expect(page.getByRole("group", { name: "Aplicar melhorias: pendente", exact: true })).toBeVisible();
  await page.goto("/analysis?id=analysis-ux");
  await expect(checklist.getByRole("checkbox").first()).toBeChecked();
  await checklist.getByRole("checkbox").last().check();
  await expect(checklist).toContainText("2 de 2 concluídas");
  await page.goto("/dashboard");
  await expect(page.getByRole("group", { name: "Aplicar melhorias: concluída", exact: true })).toBeVisible();
  failSave = true;
  await checklist.getByRole("checkbox").first().click();
  await expect(checklist.getByRole("alert")).toContainText("Não foi possível salvar");
  await expect(checklist.getByRole("checkbox").first()).toBeChecked();
  failSave = false;
  await checklist.getByRole("checkbox").first().uncheck();
  await expect(page.getByRole("group", { name: "Aplicar melhorias: pendente", exact: true })).toBeVisible();
  await page.reload();
  await expect(checklist.getByRole("checkbox").first()).not.toBeChecked();
  await expect(checklist).toContainText("1 de 2 concluídas");
});

test("keyword typing discovers and saves jobs without a resume or a search-button click", async ({ page }, testInfo) => {
  await signIn(page);
  const searches = [];
  await page.route("**/api/jobs/search?*", (route) => {
    const url = new URL(route.request().url());
    searches.push(url.searchParams.get("q"));
    return route.fulfill({ json: { success: true, status: "success", provider: "Test source", jobs: [keywordJob("React")], external_searches: [] } });
  });
  await page.goto("/jobs");
  const input = page.getByLabel("Palavra-chave ou cargo");
  await expect(input).toBeVisible();
  await input.pressSequentially("React", { delay: 40 });
  await input.press("Escape");
  await expect(page.getByRole("heading", { name: "Desenvolvedor React", exact: true })).toBeVisible();
  expect(searches).toEqual(["React"]);
  await expect(page.getByRole("status").filter({ hasText: "1 resultado(s)" })).toBeVisible();
  await expect(page.getByText("Encontrada", { exact: true })).toBeVisible();
  await expect(page.getByText("0%", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver vaga original", exact: true })).toHaveAttribute("href", "https://example.com/jobs/React");
  await page.getByRole("button", { name: "Salvar vaga", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remover vaga dos salvos", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Minha jornada/ }).click();
  await expect(page.getByRole("heading", { name: "Desenvolvedor React", exact: true })).toBeVisible();
  expect(searches).toEqual(["React"]);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("keyword-search.png"), fullPage: true });
});

test("a late keyword response cannot overwrite a newer search and clearing restores recommendations", async ({ page }) => {
  await signIn(page);
  let releaseReact;
  const reactGate = new Promise((resolve) => { releaseReact = resolve; });
  let reactStarted = false;
  await page.route("**/api/jobs/search?*", async (route) => {
    const keyword = new URL(route.request().url()).searchParams.get("q");
    if (keyword === "React") { reactStarted = true; await reactGate; }
    await route.fulfill({ json: { success: true, status: "success", jobs: [keywordJob(keyword)], external_searches: [] } }).catch(() => {});
  });
  await page.goto("/jobs");
  const input = page.getByLabel("Palavra-chave ou cargo");
  await input.fill("React");
  await expect.poll(() => reactStarted).toBe(true);
  await expect(page.getByRole("heading", { name: "Nenhuma vaga com estes filtros" })).toBeHidden();
  await input.fill("Python");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Desenvolvedor Python", exact: true })).toBeVisible();
  releaseReact();
  await expect(page.getByRole("heading", { name: "Desenvolvedor React", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Desenvolvedor Python", exact: true })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Qual vaga você procura?", exact: true })).toBeVisible();
});

test("keyword search errors can be retried and location changes fetch new results", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  const requests = [];
  await page.route("**/api/jobs/search?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push({ keyword: params.get("q"), location: params.get("location") });
    if (requests.length === 1) return route.fulfill({ status: 503, json: { success: false, error: "Fonte temporariamente indisponível." } });
    return route.fulfill({ json: { success: true, status: "success", jobs: [keywordJob("React")], external_searches: [] } });
  });
  await page.goto("/jobs");
  await page.getByLabel("Palavra-chave ou cargo").fill("React");
  await expect(page.getByRole("alert")).toContainText("Fonte temporariamente indisponível");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Desenvolvedor React", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Localização", exact: true }).fill("Curitiba");
  await page.getByRole("combobox", { name: "Localização", exact: true }).press("Escape");
  await expect.poll(() => requests.at(-1)).toEqual({ keyword: "React", location: "Curitiba" });
  await expect(page.getByRole("heading", { name: "Desenvolvedor React", exact: true })).toBeVisible();
  await noOverflow(page);
});

test("combined job filters, typo suggestions and saved searches survive reload", async ({ page }, testInfo) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [
    { nome: "São Paulo", microrregiao: { mesorregiao: { UF: { sigla: "SP" } } } },
    { nome: "Campinas", microrregiao: { mesorregiao: { UF: { sigla: "SP" } } } },
  ] }));
  const common = { is_real: true, remote: true, source: "Test source", employment_type: "CLT", match_percentage: 90, salary_min: 5000, salary_max: 10000, salary_currency: "BRL", salary_period: "month", required_skills: ["React"], published_at: new Date().toISOString(), match_reasons: [], improvement_tips: [] };
  const analysis = { id: "test-analysis", status: "completed", file_name: "Test resume.pdf", recommended_jobs: [
    { ...common, id: "job-1", external_id: "job-1", title: "Desenvolvedor React Sênior", company: "Acme", location: "São Paulo, SP", url: "https://example.com/jobs/1" },
    { ...common, id: "job-2", external_id: "job-2", title: "Desenvolvedor React Júnior", company: "Beta", location: "Campinas, SP", url: "https://example.com/jobs/2", work_mode: "hybrid" },
  ] };
  await page.route("**/api/analysis?*", (route) => route.fulfill({ json: { success: true, analyses: [analysis] } }));
  await page.route("**/api/analysis/test-analysis/jobs/refresh", (route) => route.fulfill({ json: { success: true, analysis } }));
  await page.goto("/jobs");
  await expect(page.getByLabel("Palavra-chave ou cargo")).toBeVisible();
  await page.getByLabel("Palavra-chave ou cargo").fill("Recat");
  await expect(page.getByRole("option", { name: /Você quis dizer: React$/ })).toBeVisible();
  await page.getByRole("option", { name: /Você quis dizer: React$/ }).click();
  const locationInput = page.getByRole("combobox", { name: "Localização", exact: true });
  await locationInput.fill("sao");
  await page.getByRole("option", { name: "São Paulo, SP", exact: true }).click();
  await expect(locationInput).toHaveValue("São Paulo, SP");
  await expect(page.locator("body")).toContainText("1 resultado(s)");
  await page.getByRole("button", { name: "Limpar localização", exact: true }).click();
  await expect(locationInput).toHaveValue("");
  await expect(page.locator("body")).toContainText("2 resultado(s)");
  await locationInput.fill("SP");
  await locationInput.press("ArrowDown");
  await locationInput.press("Enter");
  await expect(locationInput).toHaveValue("SP");
  await expect(page.getByRole("listbox", { name: "Sugestões de localização" })).toBeHidden();
  await expect(page.locator("body")).toContainText("2 resultado(s)");
  await locationInput.fill("sao");
  await page.getByRole("option", { name: "São Paulo, SP", exact: true }).click();
  await page.getByLabel("Modalidade", { exact: true }).selectOption("remote");
  await page.getByLabel("Salário mensal mínimo (R$)").fill("6000");
  await expect(page.locator("body")).toContainText("1 resultado(s)");
  await page.getByLabel("Nome da pesquisa").fill("React em São Paulo");
  await page.getByRole("button", { name: "Salvar pesquisa", exact: true }).click();
  await expect(page.getByRole("button", { name: "React em São Paulo", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "React em São Paulo", exact: true }).click();
  await expect(page.getByLabel("Localização", { exact: true })).toHaveValue("São Paulo, SP");
  await expect(page.getByLabel("Salário mensal mínimo (R$)")).toHaveValue("6000");
  await expect(page.locator("body")).toContainText("1 resultado(s)");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("jobs.png"), fullPage: true });
});

test("IT assistant filters keep each card linked to its own listing after sorting", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  const common = { is_real: true, source: "Test source", company: "Acme", location: "Curitiba, PR", match_percentage: 90, published_at: new Date().toISOString(), required_skills: ["Windows", "Redes"] };
  const assistant = { ...common, id: "assistant-1", title: "Assistente de TI", url: "https://example.com/jobs/assistant-1" };
  const search = { id: "search-ti", title: "Buscar Assistente de TI", search_query: "Assistente de TI", is_real: false, is_search_link: true, source: "LinkedIn", location: "Curitiba, PR", url: "https://www.linkedin.com/jobs/search/?keywords=Assistente+de+TI&location=Curitiba%2C+PR" };
  const analysis = { id: "test-it-analysis", status: "completed", file_name: "Test resume.pdf", recommended_jobs: [
    { ...common, id: "developer-1", title: "Desenvolvedor Frontend", description: "Trabalhe com nosso assistente de TI.", url: "https://example.com/jobs/developer-1" },
    assistant, { ...assistant },
    { ...common, id: "assistant-2", title: "Assistente de TI Júnior", url: "https://example.com/jobs/assistant-2", match_percentage: 70 },
    search,
    { ...search, id: "search-dev", title: "Buscar Desenvolvedor Frontend", search_query: "Desenvolvedor Frontend", required_skills: ["Assistente de TI"], url: "https://www.linkedin.com/jobs/search/?keywords=Desenvolvedor+Frontend" },
  ] };
  await page.route("**/api/analysis?*", (route) => route.fulfill({ json: { success: true, analyses: [analysis] } }));
  await page.route("**/api/analysis/test-it-analysis/jobs/refresh", (route) => route.fulfill({ json: { success: true, analysis } }));
  await page.context().route("https://example.com/jobs/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Anúncio original</h1>" }));
  await page.goto("/jobs");
  await page.getByLabel("Palavra-chave ou cargo").fill("Assistente de TI");
  await page.getByLabel("Palavra-chave ou cargo").press("Escape");
  await expect(page.getByRole("heading", { name: "Desenvolvedor Frontend", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Buscar Desenvolvedor Frontend", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Assistente de TI", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Buscar no LinkedIn", exact: true })).toHaveAttribute("href", search.url);
  await expect(page.getByRole("link", { name: "Ver vaga original", exact: true })).toHaveCount(2);

  await page.getByLabel("Ordenar por").selectOption("match-asc");
  const originalLinks = page.getByRole("link", { name: "Ver vaga original", exact: true });
  await expect(originalLinks.first()).toHaveAttribute("href", "https://example.com/jobs/assistant-2");
  await page.getByLabel("Palavra-chave ou cargo").fill("Assistente de TI Júnior");
  await page.getByLabel("Palavra-chave ou cargo").press("Escape");
  await expect(originalLinks).toHaveCount(1);
  const popupPromise = page.waitForEvent("popup");
  await originalLinks.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://example.com/jobs/assistant-2");
  await popup.close();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Desenvolvedor Frontend", exact: true })).toHaveCount(1);
  await noOverflow(page);
});

test("profile photo previews, persists, appears publicly when enabled and supports replacement and removal", async ({ page }, testInfo) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Product Test");
  const input = page.getByLabel("Selecionar foto de perfil", { exact: true });
  const preview = page.getByRole("img", { name: "Foto de perfil", exact: true });
  const accountPhoto = page.getByRole("img", { name: "Foto da sua conta", exact: true });
  const save = page.getByRole("button", { name: "Salvar perfil", exact: true });
  await expect(page.getByRole("button", { name: "Adicionar foto", exact: true })).toBeVisible();
  await input.setInputFiles(fileURLToPath(new URL("../../backend/tests/fixtures/profile-photo.jpg", import.meta.url)));
  await expect(preview).toBeVisible();
  await expect(accountPhoto).toBeHidden();
  const original = await preview.getAttribute("src");
  await save.click();
  await expect(accountPhoto).toHaveAttribute("src", original);
  await page.reload();
  await expect(preview).toHaveAttribute("src", original);
  await expect(accountPhoto).toHaveAttribute("src", original);
  await page.getByLabel("Disponibilizar perfil público").check();
  await save.click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
  const publicPath = await page.getByRole("link", { name: "Abrir perfil público salvo" }).getAttribute("href");
  await page.goto(publicPath);
  await expect(page.getByRole("img", { name: "Foto de Product Test", exact: true })).toHaveAttribute("src", original);
  await page.goto("/profile");
  await expect(preview).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 700;
    const context = canvas.getContext("2d");
    context.fillStyle = "#cc6633"; context.fillRect(0, 0, 1200, 700);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await input.setInputFiles({ name: "nova-foto.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(preview).not.toHaveAttribute("src", original);
  await expect.poll(() => preview.evaluate((image) => image.naturalWidth)).toBe(512);
  const replacement = await preview.getAttribute("src");
  expect(replacement).toMatch(/^data:image\/jpeg;base64,/);
  await save.click();
  await expect(accountPhoto).toHaveAttribute("src", replacement);
  await page.reload();
  await expect(preview).toHaveAttribute("src", replacement);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("profile-photo.png"), fullPage: true });
  await page.getByRole("button", { name: "Remover foto", exact: true }).click();
  await expect(preview).toBeHidden();
  await expect(accountPhoto).toHaveAttribute("src", replacement);
  await save.click();
  await expect(accountPhoto).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Adicionar foto", exact: true })).toBeVisible();
  await expect(preview).toBeHidden();
});

test("invalid profile photos preserve the saved photo and show clear errors", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Product Test");
  const input = page.getByLabel("Selecionar foto de perfil", { exact: true });
  const preview = page.getByRole("img", { name: "Foto de perfil", exact: true });
  await input.setInputFiles(fileURLToPath(new URL("../../backend/tests/fixtures/profile-photo.jpg", import.meta.url)));
  await expect(preview).toBeVisible();
  const original = await preview.getAttribute("src");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByText("Perfil salvo com sucesso.", { exact: true })).toBeVisible();
  for (const [name, mimeType, buffer, error] of [
    ["arquivo.svg", "image/svg+xml", Buffer.from("<svg/>"), "Escolha uma imagem JPG, PNG ou WebP."],
    ["grande.jpg", "image/jpeg", Buffer.alloc(5 * 1024 * 1024 + 1), "A foto deve ter no máximo 5 MB."],
    ["corrompida.jpg", "image/jpeg", Buffer.from("not an image"), "Não foi possível abrir esta imagem."],
  ]) {
    await input.setInputFiles({ name, mimeType, buffer });
    await expect(page.getByRole("alert")).toContainText(error);
    await expect(preview).toHaveAttribute("src", original);
  }
  await page.reload();
  await expect(preview).toHaveAttribute("src", original);
});

test("professional profile persists and its public link omits private contacts", async ({ page }, testInfo) => {
  const session = await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Product Test");
  await page.getByLabel("Título profissional", { exact: true }).fill("Desenvolvedora React");
  await page.getByLabel("Telefone", { exact: true }).fill("11987654321");
  await page.getByLabel("Resumo profissional", { exact: true }).fill("Desenvolvedora com foco em interfaces acessíveis e produtos digitais.");
  const skillsInput = page.getByRole("combobox", { name: "Habilidades", exact: true });
  await skillsInput.fill("PY");
  await expect(page.getByRole("listbox", { name: "Sugestões de habilidades" })).toBeHidden();
  await skillsInput.fill("PYT");
  await expect(page.getByRole("option", { name: "Python Linguagens", exact: true })).toBeVisible();
  await skillsInput.press("Enter");
  await expect(page.getByRole("button", { name: "Remover habilidade Python" })).toBeVisible();
  await skillsInput.fill("PYT");
  await expect(page.getByRole("option", { name: "Python Linguagens", exact: true })).toBeHidden();
  await skillsInput.press("Escape");
  await page.getByLabel("Habilidades", { exact: true }).fill("React");
  await skillsInput.press("Enter");
  await page.getByRole("tab", { name: "Projetos", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar projetos", exact: true }).click();
  await page.getByRole("textbox", { name: "Nome do projeto", exact: true }).fill("Meu portfólio");
  await page.getByLabel("Descrição e resultados", { exact: true }).fill("Aplicação React acessível com navegação por teclado.");
  await page.getByLabel("Disponibilizar perfil público").check();
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.locator("body")).toContainText("Perfil salvo com sucesso.");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remover habilidade Python" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover habilidade React" })).toBeVisible();
  await page.getByRole("tab", { name: "Projetos", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nome do projeto", exact: true })).toHaveValue("Meu portfólio");
  await noOverflow(page);
  const publicPath = await page.getByRole("link", { name: "Abrir perfil público salvo" }).getAttribute("href");
  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: "Product Test" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Meu portfólio");
  await expect(page.locator("body")).not.toContainText(session.user.email);
  await expect(page.locator("body")).not.toContainText("11987654321");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("public-profile.png"), fullPage: true });
});

test("saving an unfinished profile entry opens its tab and explains the missing field", async ({ page }) => {
  await signIn(page);
  await page.route("https://servicodados.ibge.gov.br/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/profile");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Product Test");
  await page.getByRole("tab", { name: "Projetos", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar projetos", exact: true }).click();
  await page.getByLabel("Tecnologias / cliente", { exact: true }).fill("Python e React");
  await page.getByRole("tab", { name: "Experiências", exact: true }).click();
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Projetos", exact: true })).toHaveAttribute("aria-selected", "true");
  const title = page.getByRole("textbox", { name: "Nome do projeto", exact: true });
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("Preencha o nome do projeto");
  await expect(page.getByLabel("Tecnologias / cliente", { exact: true })).toHaveValue("Python e React");
  await title.fill("Meu projeto");
  await page.getByRole("button", { name: "Salvar perfil", exact: true }).click();
  await expect(page.locator("body")).toContainText("Perfil salvo com sucesso.");
});

test("feedback tasks submit, persist and meet accessibility checks", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/feedback");
  await page.getByRole("radio", { name: "4 estrelas", exact: true }).check();
  await page.getByLabel("O que aconteceu ou poderia melhorar?").fill("Encontrei a vaga desejada, mas gostaria de mais opções de empresas.");
  await page.getByLabel(/1\. Encontre uma vaga/).selectOption("difficult");
  await page.getByRole("button", { name: "Enviar feedback", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Feedback recebido");
  await page.reload();
  await expect(page.locator("body")).toContainText("Encontrei a vaga desejada");
  const scan = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(scan.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("feedback.png"), fullPage: true });
});

test("support fallback gives actionable curriculum advice and saves answer rating", async ({ page }) => {
  await signIn(page);
  await page.goto("/support");
  await page.getByRole("button", { name: "Como melhoro meu currículo?", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resposta útil", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resposta útil", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resposta útil", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toContainText("Descreva suas entregas");
  await page.reload();
  await expect(page.getByRole("button", { name: "Resposta útil", exact: true })).toHaveAttribute("aria-pressed", "true");
  await noOverflow(page);
});
