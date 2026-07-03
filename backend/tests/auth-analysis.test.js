import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-ai-test-"));

process.env.AI_PROVIDER = "none";
process.env.AUTH_CODE_SECRET = "test-auth-secret";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.SQLITE_DB_PATH = path.join(tempDir, "career-ai-test.sqlite");

const { default: app } = await import("../server.js");
const { closeDatabase, createResumeAnalysis } = await import("../src/db.js");

let server;
let baseUrl;

test.before(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  closeDatabase();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function postJson(pathname, body, token = "") {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  return { response, data };
}

test("health endpoint responds", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.status, "ok");
});

test("auth flow, usage and analysis tasks work together", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "test-password-123";

  const register = await postJson("/api/auth/register", {
    name: "Test User",
    email,
    password
  });

  assert.equal(register.response.status, 201);
  assert.match(register.data.dev_code, /^\d{6}$/);

  const unverifiedLogin = await postJson("/api/auth/login", {
    email,
    password
  });

  assert.equal(unverifiedLogin.response.status, 202);
  assert.equal(unverifiedLogin.data.requires_verification, true);
  assert.match(unverifiedLogin.data.dev_code, /^\d{6}$/);

  const verify = await postJson("/api/auth/verify-code", {
    email,
    code: unverifiedLogin.data.dev_code
  });

  assert.equal(verify.response.status, 200);
  assert.ok(verify.data.token);

  const directLogin = await postJson("/api/auth/login", {
    email,
    password
  });

  assert.equal(directLogin.response.status, 200);
  assert.ok(directLogin.data.token);
  assert.equal(directLogin.data.user.email, email);

  const usageResponse = await fetch(`${baseUrl}/api/analysis/usage`, {
    headers: {
      Authorization: `Bearer ${verify.data.token}`
    }
  });
  const usage = await usageResponse.json();

  assert.equal(usageResponse.status, 200);
  assert.equal(usage.usage.limit, 3);

  const checkout = await postJson("/api/subscription/checkout", {
    plan: "Pro"
  }, verify.data.token);

  assert.equal(checkout.response.status, 200);
  assert.equal(checkout.data.checkout.provider, "demo");
  assert.equal(checkout.data.subscription.plan, "Pro");

  const analysis = createResumeAnalysis({
    fileName: "resume.pdf",
    resumeText: "Joao Silva\nDesenvolvedor Frontend\nExperiencia com React, JavaScript, testes automatizados e atendimento a usuarios.",
    accountEmail: email,
    targetJobTitle: "Frontend Developer",
    targetJobDescription: "React, TypeScript e testes automatizados.",
    jobMatchScore: 78,
    matchedKeywords: ["react", "typescript"],
    atsScore: 82,
    clarityScore: 76,
    marketCompatibility: 78,
    suggestions: ["Adicionar métricas de impacto.", "Reforçar testes automatizados."],
    recommendedJobs: []
  });

  const tasksResponse = await fetch(`${baseUrl}/api/analysis/${analysis.id}/tasks`, {
    headers: {
      Authorization: `Bearer ${verify.data.token}`
    }
  });
  const tasks = await tasksResponse.json();

  assert.equal(tasksResponse.status, 200);
  assert.deepEqual(tasks.tasks.checked, {});

  const updatedTasks = await fetch(`${baseUrl}/api/analysis/${analysis.id}/tasks`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${verify.data.token}`
    },
    body: JSON.stringify({ checked: { 0: true, 1: false } })
  });
  const updated = await updatedTasks.json();

  assert.equal(updatedTasks.status, 200);
  assert.deepEqual(updated.tasks.checked, { 0: true, 1: false });

  const improvedResponse = await fetch(`${baseUrl}/api/analysis/${analysis.id}/improved-resume`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${verify.data.token}`
    }
  });
  const improved = await improvedResponse.json();

  assert.equal(improvedResponse.status, 200);
  assert.equal(improved.improved_resume.analysis_id, analysis.id);
  assert.equal(typeof improved.improved_resume.content, "string");
  assert.ok(improved.improved_resume.content.includes("Joao Silva"));
});
