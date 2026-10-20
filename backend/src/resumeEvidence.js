const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function buildResumeEvidence(source, analysis) {
  const lines = String(source || "").split(/\r?\n|(?<=[.!?])\s+/).map((text) => text.trim()).filter(Boolean);
  return (analysis.weak_words || []).flatMap((term) => {
    const excerpt = lines.find((line) => normalize(line).includes(normalize(term)));
    return excerpt ? [{ term, excerpt, suggestion: `Reescreva o trecho com "${term}" usando uma ação concreta. Preserve os fatos e só inclua resultados comprovados.` }] : [];
  }).slice(0, 6);
}
