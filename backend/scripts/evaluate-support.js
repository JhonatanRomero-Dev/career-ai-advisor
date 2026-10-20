import "../src/loadEnv.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

// Isolate synthetic evaluation accounts and metrics from application data.
const evaluationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "career-support-eval-"));
process.env.SQLITE_DB_PATH = path.join(evaluationDirectory, "evaluation.sqlite");
const live = process.argv.includes("--live");
if (!live) process.env.AI_PROVIDER = "none";
const { chatWithSupport } = await import("../controllers/supportController.js");
const { upsertOAuthUser, upsertUserProfile, createResumeAnalysis, closeDatabase } = await import("../src/db.js");
const { getAIProviderStatus } = await import("../src/aiClient.js");
const fixtures = [
  { message: "Como melhoro meu currículo?", expected: /resumo|resultado|experi[eê]ncia/i },
  { message: "Monte um plano de 7 dias para melhorar meu currículo", expected: /dia|semana/i },
  { message: "Explique minha nota ATS", expected: /72/ },
  { message: "Como salvo filtros de vagas?", expected: /salv|pesquisa/i },
  { message: "Preciso falar com suporte humano sobre uma cobrança", expected: /feedback/i },
];
const results = [];
try {
  if (live) assert.equal(getAIProviderStatus().configured, true, "Configure um provedor de IA para avaliação ao vivo.");
  const user = upsertOAuthUser("synthetic-support-eval@example.com", "Pessoa de teste");
  upsertUserProfile(user.id, { headline: "Desenvolvedora React", targetRole: "Desenvolvedora frontend", summary: "Experiência em interfaces React.", location: "São Paulo, SP" }, user);
  createResumeAnalysis({ accountEmail: user.email, fileName: "synthetic-evaluation.txt", atsScore: 72, status: "completed", missingKeywords: ["testes"], suggestions: ["Descreva resultados reais das experiências."] });
  for (const fixture of fixtures) {
    const start = Date.now();
    let status = 200, response;
    const res = { status(value) { status = value; return this; }, json(value) { response = value; return this; } };
    await chatWithSupport({ user, body: { message: fixture.message, history: [] } }, res);
    const passed = status === 200 && fixture.expected.test(response?.reply || "") && (!live || response?.fallback === false);
    results.push({ question: fixture.message, passed, fallback: response?.fallback, duration_ms: Date.now() - start, reply: response?.reply || response?.error });
  }
  console.log(JSON.stringify({ success: results.every((result) => result.passed), live, provider: getAIProviderStatus(), results }, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
} finally {
  closeDatabase();
  fs.rmSync(evaluationDirectory, { recursive: true, force: true });
}
