const HISTORY_KEY = "career-ai-resume-history";

const parseHistory = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao carregar histórico local:", error);
    return [];
  }
};

export const getStoredResumeHistory = () => parseHistory();

export const saveResumeHistoryEntry = ({ file, analysis }) => {
  const fileName = file?.name || analysis?.file_name || "Currículo enviado";
  const now = new Date().toISOString();

  const entry = {
    id: analysis?.id || `local-${Date.now()}`,
    file_name: fileName,
    created_date: analysis?.created_date || now,
    status: analysis?.status || "completed",
    ats_score: analysis?.ats_score || 0,
    clarity_score: analysis?.clarity_score || 0,
    market_compatibility: analysis?.market_compatibility || 0,
    source: "local",
  };

  const history = parseHistory();
  const nextHistory = [entry, ...history].slice(0, 100);

  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));

  return entry;
};

export const mergeResumeHistory = (remoteAnalyses = [], localAnalyses = []) => {
  const byId = new Map();

  [...localAnalyses, ...remoteAnalyses].forEach((analysis) => {
    const id = String(analysis.id || `${analysis.file_name}-${analysis.created_date}`);
    byId.set(id, {
      status: "completed",
      ...analysis,
      id,
      file_name: analysis.file_name || "Currículo enviado",
      created_date: analysis.created_date || new Date().toISOString(),
    });
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  );
};
