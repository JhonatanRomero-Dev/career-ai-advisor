import assert from "node:assert/strict";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function assertGroundedAnalysis(analysis, source) {
  assert.ok(analysis, "O provedor não retornou uma análise válida; fallback não conta como avaliação externa.");
  for (const key of ["ats_score", "clarity_score", "market_compatibility", "job_match_score"]) {
    assert.ok(Number.isInteger(analysis[key]) && analysis[key] >= 0 && analysis[key] <= 100, `Nota inválida: ${key}`);
  }
  for (const key of ["detected_skills", "weak_words", "matched_keywords"]) {
    assert.ok(Array.isArray(analysis[key]), `Lista inválida: ${key}`);
    for (const value of analysis[key]) assert.ok(value.trim() && normalize(source).includes(normalize(value)), `Termo sem evidência em ${key}: ${value}`);
  }
  assert.ok(analysis.suggestions?.length, "A análise precisa oferecer ações práticas.");
  assert.equal(analysis.recommended_jobs?.length || 0, 0, "O modelo não deve inventar vagas.");
}
