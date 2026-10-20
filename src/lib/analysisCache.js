const LAST_ANALYSIS_ID_KEY = "career-ai-last-analysis-id";
const LEGACY_ANALYSIS_RESULT_KEY = "analysisResult";

export function rememberLastAnalysisId(analysisId) {
  if (typeof window === "undefined" || !analysisId) {
    return;
  }

  localStorage.setItem(LAST_ANALYSIS_ID_KEY, String(analysisId));
  localStorage.removeItem(LEGACY_ANALYSIS_RESULT_KEY);
}

export function readLastAnalysisId() {
  if (typeof window === "undefined") {
    return "";
  }

  const lastAnalysisId = localStorage.getItem(LAST_ANALYSIS_ID_KEY);

  if (lastAnalysisId) {
    return lastAnalysisId;
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_ANALYSIS_RESULT_KEY) || "{}");
    return String(legacy?.analysis?.id || "");
  } catch {
    return "";
  }
}

export function clearLastAnalysisId(analysisId) {
  if (typeof window === "undefined") {
    return;
  }

  const currentId = readLastAnalysisId();

  if (!analysisId || currentId === String(analysisId)) {
    localStorage.removeItem(LAST_ANALYSIS_ID_KEY);
  }

  localStorage.removeItem(LEGACY_ANALYSIS_RESULT_KEY);
}
