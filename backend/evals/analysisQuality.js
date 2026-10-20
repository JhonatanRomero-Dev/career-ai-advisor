import assert from "node:assert/strict";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function includesTerm(source, term) {
  const normalizeTokens = (value) => ` ${normalize(value).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const normalizedTerm = normalizeTokens(term);
  return normalizedTerm !== "  " && normalizeTokens(source).includes(normalizedTerm);
}

export function assertGroundedAnalysis(analysis, source) {
  assert.ok(analysis, "AI provider did not return a valid analysis; fallback does not count as external evaluation.");
  for (const key of ["ats_score", "clarity_score", "market_compatibility", "job_match_score"]) {
    assert.ok(Number.isInteger(analysis[key]) && analysis[key] >= 0 && analysis[key] <= 100, `Invalid score: ${key}`);
  }
  for (const key of ["detected_skills", "weak_words", "matched_keywords"]) {
    assert.ok(Array.isArray(analysis[key]), `Invalid list: ${key}`);
    for (const value of analysis[key]) assert.ok(value.trim() && includesTerm(source, value), `Ungrounded term in ${key}: ${value}`);
  }
  for (const value of analysis.missing_keywords || []) {
    assert.ok(value.trim() && !includesTerm(source, value), `Missing term also appears in resume: ${value}`);
  }
  assert.ok(analysis.suggestions?.length, "Analysis must offer practical actions.");
  assert.equal(analysis.recommended_jobs?.length || 0, 0, "The model must not invent job listings.");
}
