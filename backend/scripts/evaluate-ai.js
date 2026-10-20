import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateResumeLocally, analyzeWithAI } from "../controllers/analysisController.js";
import { getAIProviderStatus } from "../src/aiClient.js";
import { assertGroundedAnalysis } from "../evals/analysisQuality.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(root, "evals", "resume-analysis.fixtures.json"), "utf8"));
const results = [];

for (const fixture of fixtures) {
  const analysis = evaluateResumeLocally({
    resumeText: fixture.resume_text,
    targetJobTitle: fixture.target_job_title,
    targetJobDescription: fixture.target_job_description
  });
  assertGroundedAnalysis(analysis, fixture.resume_text);
  const expected = fixture.expect || {};

  if (expected.area_contains) assert.match(analysis.main_area, new RegExp(expected.area_contains, "i"), fixture.id);
  for (const skill of expected.skills || []) {
    assert.ok(analysis.detected_skills.map((item) => item.toLowerCase()).includes(skill.toLowerCase()), `${fixture.id}: habilidade ausente ${skill}`);
  }
  if (expected.min_ats !== undefined) assert.ok(analysis.ats_score >= expected.min_ats, `${fixture.id}: ATS abaixo do piso`);
  if (expected.max_ats !== undefined) assert.ok(analysis.ats_score <= expected.max_ats, `${fixture.id}: ATS acima do teto`);
  if (expected.min_job_match !== undefined) assert.ok(analysis.job_match_score >= expected.min_job_match, `${fixture.id}: match abaixo do piso`);
  if (expected.max_job_match !== undefined) assert.ok(analysis.job_match_score <= expected.max_job_match, `${fixture.id}: match acima do teto`);

  results.push({ id: fixture.id, ats: analysis.ats_score, match: analysis.job_match_score, area: analysis.main_area });
}

if (process.argv.includes("--live")) {
  const provider = getAIProviderStatus();
  assert.ok(provider.configured, "Configure um provedor de IA para executar a avaliação externa.");
  for (const fixture of fixtures) {
    const localAnalysis = evaluateResumeLocally({ resumeText: fixture.resume_text, targetJobTitle: fixture.target_job_title, targetJobDescription: fixture.target_job_description });
    const raw = await analyzeWithAI({ resumeText: fixture.resume_text, detectedArea: localAnalysis.main_area,
      localAnalysis, targetJobContext: { title: fixture.target_job_title || "", description: fixture.target_job_description || "", keywords: [] } });
    assertGroundedAnalysis(raw, fixture.resume_text);
    results.push({ id: fixture.id, mode: "live", provider: provider.provider, model: provider.model, ats: raw.ats_score });
  }
}
console.log(JSON.stringify({ success: true, mode: process.argv.includes("--live") ? "local-and-live" : "local", fixtures: fixtures.length, results }, null, 2));
