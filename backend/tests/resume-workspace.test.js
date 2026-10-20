import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { replaceResumeExcerpt } from "../../src/lib/resumeDocument.js";
import { createResumePdf } from "../../src/lib/resumeExport.js";
import { buildResumeEvidence } from "../src/resumeEvidence.js";
import { assertGroundedAnalysis } from "../evals/analysisQuality.js";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "career-workspace-"));
process.env.SQLITE_DB_PATH = path.join(directory, "test.sqlite");
process.env.NODE_ENV = "test";
process.env.AI_PROVIDER = "none";
process.env.AUTH_CODE_SECRET = "workspace-test-secret";
process.env.OAUTH_STATE_SECRET = "workspace-test-oauth";
process.env.RESUME_TEXT_STORAGE = "encrypted";
const { default: app } = await import("../server.js");
const db = await import("../src/db.js");
const { evaluateResumeLocally, analyzeWithAI, mergeAnalysis } = await import("../controllers/analysisController.js");
let server, url, alice, bob, analysis;
const source = "Ana Lima\n\nDesenvolvedora React e JavaScript.\n\nResponsável por testes com redução de erros em 20%.";
const identity = (email) => { const user = db.upsertOAuthUser(email, "Workspace Test"); return { user, token: db.createAuthSession(user.id).token }; };

test.before(async () => {
  server = await new Promise((resolve) => { const listener = app.listen(0, () => resolve(listener)); });
  url = `http://127.0.0.1:${server.address().port}`;
  alice = identity("workspace-alice@example.com"); bob = identity("workspace-bob@example.com");
  analysis = db.createResumeAnalysis({ fileName: "ana.pdf", accountEmail: alice.user.email, resumeText: source, analysisMethod: "local", weakWords: ["responsável por", "apoio"] });
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); db.closeDatabase(); fs.rmSync(directory, { recursive: true, force: true }); });
async function request(route, { method = "GET", body, account = alice, csrf = true } = {}) {
  const response = await fetch(`${url}${route}`, { method, headers: {
    Authorization: `Bearer ${account.token}`, ...(csrf ? { Cookie: "career_ai_csrf=workspace-csrf", "x-csrf-token": "workspace-csrf" } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}

test("workspace returns actual excerpts, encrypted versions and rejects cross-account access", async () => {
  const workspace = await request(`/api/analysis/${analysis.id}/workspace`);
  assert.equal(workspace.data.workspace.source_text, source);
  assert.equal(workspace.data.workspace.analysis.analysis_method, "local");
  assert.equal(workspace.data.workspace.evidence.length, 1);
  assert.ok(source.includes(workspace.data.workspace.evidence[0].excerpt));
  assert.equal((await request(`/api/analysis/${analysis.id}/workspace`, { account: bob })).status, 403);
  assert.equal((await request(`/api/analysis/${analysis.id}/versions`, { method: "POST", body: { name: "V1", content: source }, csrf: false })).status, 403);
  assert.equal((await request(`/api/analysis/${analysis.id}/versions`, { method: "POST", body: { name: "V1", content: "  " } })).status, 422);
});

test("versions link atomically to owned applications and preserve the submitted version", async () => {
  const job = { external_id: "workspace-job", title: "Frontend", company: "Example", url: "https://example.com/job", is_real: true };
  assert.equal((await request("/api/jobs/tracked", { method: "POST", body: { job, analysis_id: analysis.id } })).status, 201);
  const save = (name, jobId = job.external_id, account = alice) => request(`/api/analysis/${analysis.id}/versions`, { method: "POST", account, body: { name, content: source, job_external_id: jobId } });
  assert.equal((await save("Unauthorized", job.external_id, bob)).status, 403);
  assert.equal((await save("Missing job", "missing-job")).status, 404);
  assert.equal(db.listSavedResumeVersions(alice.user.email, analysis.id).length, 0);
  const v1 = (await save("Sent version")).data.version;
  assert.equal(db.listSavedResumeVersions(alice.user.email, analysis.id)[0].content, source);
  assert.equal(fs.readFileSync(process.env.SQLITE_DB_PATH).includes(Buffer.from(source)), false);
  const apply = await request("/api/jobs/tracked/workspace-job", { method: "PATCH", body: { status: "applied", notes: "Entrevista técnica", reminder_at: "2026-09-25T14:00:00.000Z", next_action: "Retornar ao recrutador" } });
  assert.equal(apply.data.tracked_job.submitted_resume_version.id, v1.id);
  assert.ok(apply.data.tracked_job.applied_at);
  const v2 = (await save("Next draft")).data.version;
  const tracked = (await request("/api/jobs/tracked")).data.tracked_jobs[0];
  assert.equal(tracked.resume_version.id, v2.id);
  assert.equal(tracked.submitted_resume_version.id, v1.id);
  assert.equal(tracked.notes, "Entrevista técnica");
  const notesOnly = await request("/api/jobs/tracked/workspace-job", { method: "PATCH", body: { status: "applied", resume_version_id: v2.id, notes: "Nova anotação" } });
  assert.equal(notesOnly.data.tracked_job.submitted_resume_version.id, v1.id);
  assert.equal((await request("/api/jobs/tracked/workspace-job", { method: "PATCH", body: { reminder_at: "invalid" } })).status, 422);
  assert.equal((await request("/api/jobs/tracked/workspace-job", { account: bob, method: "PATCH", body: { status: "applied" } })).status, 404);
  const bobAnalysis = db.createResumeAnalysis({ accountEmail: bob.user.email, fileName: "bob.pdf", resumeText: source });
  const bobVersion = db.saveResumeVersion(bob.user.email, bobAnalysis.id, { name: "Private", content: source });
  assert.equal((await request("/api/jobs/tracked/workspace-job", { method: "PATCH", body: { resume_version_id: bobVersion.id } })).status, 422);
  await request(`/api/analysis/${analysis.id}/versions/${v2.id}`, { method: "DELETE" });
  assert.equal((await request("/api/jobs/tracked")).data.tracked_jobs[0].resume_version, null);
  assert.equal((await request("/api/jobs/tracked/workspace-job", { method: "PATCH", body: { reminder_at: null } })).status, 200);
});

test("revision fallback preserves the selected excerpt and edits reject stale offsets", async () => {
  const original = "  Responsável por testes.  ";
  const response = await request(`/api/analysis/${analysis.id}/revision`, { method: "POST", body: { original, suggestion: "Melhore a clareza", target_job_description: "React" } });
  assert.equal(response.data.revision.generated, false);
  assert.equal(response.data.revision.proposal, original);
  assert.equal(replaceResumeExcerpt("A A", { start: 2, end: 3, text: "A" }, "B"), "A B");
  assert.throws(() => replaceResumeExcerpt("A C", { start: 2, end: 3, text: "A" }, "B"));
});

test("model contract rejects malformed replies and removes ungrounded terms", async () => {
  const local = evaluateResumeLocally({ resumeText: source });
  assert.deepEqual(evaluateResumeLocally({ resumeText: "Desenvolvedora React com Git e JavaScript" }).weak_words, []);
  const raw = { ...local, detected_skills: ["React", "Kubernetes"], weak_words: ["apoio"], matched_keywords: ["Kubernetes"] };
  const options = { resumeText: source, detectedArea: "frontend", localAnalysis: local };
  const parsed = await analyzeWithAI(options, async () => ({ content: JSON.stringify(raw) }));
  assert.ok(parsed);
  assert.throws(() => assertGroundedAnalysis(parsed, source), /sem evidência/);
  const merged = mergeAnalysis(parsed, local, source);
  assert.equal(merged.detected_skills.includes("Kubernetes"), false);
  assert.deepEqual(merged.weak_words, []);
  assert.deepEqual(merged.matched_keywords, []);
  assert.equal(await analyzeWithAI(options, async () => ({ content: '{"ats_score":900}' })), null);
  assert.deepEqual(buildResumeEvidence("Texto sem termos fracos", { weak_words: ["apoio"] }), []);
});

test("exported PDF paginates long resumes and keeps Portuguese text selectable", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const blob = await createResumePdf(`# Currículo de Ana\n${"Experiência com ações e análise de dados.\n".repeat(100)}`);
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true }).promise;
  assert.ok(pdf.numPages > 1);
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => item.str).join(" ");
  assert.match(text, /Currículo de Ana/);
  assert.match(text, /Experiência com ações/);
  await pdf.destroy();
});

test("analytics counts ordered completion and return only after enough observation", () => {
  const record = (actor, eventName, occurredAt, properties = {}) => db.recordProductEvent({ anonymousId: actor, eventName, occurredAt, properties });
  const now = Date.now();
  for (const [index, event] of ["resume_upload_completed", "resume_version_saved", "resume_exported", "job_status_changed"].entries()) record("ordered-user", event, new Date(now - 6000 + index * 1000).toISOString(), { status: "applied" });
  record("out-of-order", "resume_exported", new Date(now - 7000).toISOString());
  record("out-of-order", "resume_upload_completed", new Date(now - 6000).toISOString());
  record("return-user", "app_opened", new Date(now - 10 * 86400000).toISOString());
  record("return-user", "app_opened", new Date(now - 7 * 86400000).toISOString());
  record("new-user", "app_opened", new Date(now - 3600000).toISOString());
  const result = db.getProductAnalyticsSummary();
  assert.deepEqual(result.funnel.map((step) => step.users), [2, 1, 1, 1]);
  assert.deepEqual(result.retention, { eligible: 1, returned: 1 });
});
