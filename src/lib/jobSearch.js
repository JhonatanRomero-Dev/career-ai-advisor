import { matchesLocationQuery } from "./locationSuggestions.js";

export const DEFAULT_FILTERS = { search: "", location: "", source: "all", mode: "all", age: "all", match: "all", area: "all", level: "all", company: "all", contract: "all", salaryMin: 0, salaryMax: 0, sortBy: "match-desc" };
export const normalizeText = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** @type {Array<[string, RegExp]>} */
const areas = [
  ["Tecnologia", /react|javascript|software|desenvolv|developer|frontend|backend|devops|\bti\b|\bux\b|\bui\b|dados|data|programad|informatica|suporte tecnico|help.?desk|service desk/],
  ["Marketing", /marketing|social media|publicidade|seo|conteudo/],
  ["Vendas e atendimento", /vend|comercial|atendimento|customer|sales/],
  ["Finanças", /financ|contab|fiscal|accountant/],
  ["Recursos humanos", /recursos humanos|recrut|\brh\b|people/],
  ["Operações", /logistica|operac|producao|estoque/],
  ["Saúde", /enferm|medic|saude|fisioterap/],
  ["Engenharia", /engenheir|engineer/],
  ["Educação", /professor|educa|pedagog/]
];

export function jobMetadata(job) {
  const title = normalizeText(job.title);
  const body = normalizeText(`${job.title || ""} ${job.description || ""}`);
  const modeText = normalizeText(`${job.work_mode || ""} ${job.location || ""}`);
  const contractText = normalizeText(job.employment_type || job.contract_type || "");
  const levelText = normalizeText(job.seniority || job.level || title);
  const level = /estag|intern|aprendiz/.test(levelText) ? "Estágio" : /junior|\bjr\b|entry/.test(levelText) ? "Júnior"
    : /pleno|\bmid\b/.test(levelText) ? "Pleno" : /senior|\bsr\b/.test(levelText) ? "Sênior"
      : /lead|lider|gerent|head|especialista/.test(levelText) ? "Liderança / especialista" : "Não informado";
  const mode = /hibrid|hybrid/.test(modeText) ? "hybrid" : /presencial|onsite|on-site/.test(modeText) ? "onsite"
    : job.remote === true || /remot|home office/.test(modeText) ? "remote" : job.remote === false ? "onsite" : "unknown";
  const contract = /\bclt\b/.test(contractText) ? "CLT" : /\bpj\b|contractor/.test(contractText) ? "PJ"
    : /freelan/.test(contractText) ? "Freelance" : /intern|estag/.test(contractText) ? "Estágio" : job.employment_type || "Não informado";
  return { area: job.area || job.category || areas.find(([, rule]) => rule.test(title))?.[0] || areas.find(([, rule]) => rule.test(body))?.[0] || "Outras áreas", level, mode, contract };
}

export function uniqueJobs(jobs = []) {
  const ids = new Set(), urls = new Set();
  return jobs.filter((job) => {
    if (!job) return false;
    const id = job.external_id || job.id || job.url;
    if (id && ids.has(id) || job.url && urls.has(job.url)) return false;
    if (id) ids.add(id);
    if (job.url) urls.add(job.url);
    return true;
  });
}

// Compare only explicitly identified monthly BRL salaries. Missing units/currencies are not guessed.
export function monthlySalary(job) {
  let min = Number(job.salary_min), max = Number(job.salary_max);
  if (job.salary_currency === "BRL" && job.salary_period === "year") { min /= 12; max /= 12; }
  else if (job.salary_currency !== "BRL" || job.salary_period !== "month") {
    const salary = normalizeText(job.salary);
    if (!/r\$|\bbrl\b/.test(salary) || !/mensal|mes|month/.test(salary)) return null;
    const values = (salary.match(/\d[\d.,]*(?:\s*k\b)?/g) || []).map((value) => {
      const multiplier = /k/.test(value) ? 1000 : 1;
      const number = value.replace(/\s*k/, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
      return Number(number) * multiplier;
    }).filter((value) => value > 0);
    if (!values.length) return null;
    min = values[0]; max = values[1] || min;
  }
  if (!(min > 0 || max > 0)) return null;
  return { min: min > 0 ? min : max, max: max > 0 ? max : min };
}

export function matchesJob(job, filters, now = Date.now()) {
  const f = { ...DEFAULT_FILTERS, ...filters }, meta = jobMetadata(job);
  // Search links have no advertised salary, work mode, seniority or match score.
  if (job.is_search_link && (["mode", "age", "match", "level", "contract"].some((key) => f[key] !== "all") || Number(f.salaryMin) || Number(f.salaryMax))) return false;
  if (Number(f.salaryMax) > 0 && Number(f.salaryMax) < Number(f.salaryMin)) return false;
  if (job.match_evaluated === false && f.match !== "all") return false;
  const match = Number(job.match_percentage || 0);
  if (f.match === "high" && match < 85 || f.match === "good" && (match < 70 || match > 84) || f.match === "improve" && match > 69) return false;
  if (!matchesJobQuery(job, f.search)) return false;
  // A city filter must never silently expand to the whole state or region.
  if (f.location && !matchesLocationQuery(job.location, f.location)) return false;
  if (f.source !== "all" && job.source !== f.source || f.company !== "all" && job.company !== f.company) return false;
  if (f.mode !== "all" && meta.mode !== f.mode || f.area !== "all" && meta.area !== f.area || f.level !== "all" && meta.level !== f.level || f.contract !== "all" && meta.contract !== f.contract) return false;
  if (f.age !== "all") {
    const time = Date.parse(job.published_at);
    if (!Number.isFinite(time) || time > now || now - time > Number(f.age) * 86400000) return false;
  }
  if (Number(f.salaryMin) || Number(f.salaryMax)) {
    const salary = monthlySalary(job);
    if (!salary || salary.max < Number(f.salaryMin) || Number(f.salaryMax) && salary.min > Number(f.salaryMax)) return false;
  }
  return true;
}

const searchStopWords = new Set(["de", "da", "do", "das", "dos", "em", "e", "a", "o", "para", "com", "the", "of", "and"]);
const occupationWords = /\b(assistente|auxiliar|analista|tecnic[oa]|desenvolvedor[a]?|programador[a]?|engenheir[oa]|gerente|coordenador[a]?|especialista|estagiari[oa]|aprendiz|consultor[a]?|supervisor[a]?|diretor[a]?|vendedor[a]?|atendente|professor[a]?|enfermeir[oa]|medic[oa]|assistant|analyst|technician|developer|engineer|manager|specialist|intern)\b/;

export function matchesJobQuery(job, query) {
  const search = normalizeText(query);
  const words = search.split(/\s+/).filter((word) => word && !searchStopWords.has(word));
  const titleOnly = job.is_search_link || occupationWords.test(search);
  const haystack = normalizeText(titleOnly ? job.search_query || job.title || ""
    : `${job.title || ""} ${job.company || ""} ${(job.required_skills || []).join(" ")} ${job.description || ""}`);
  return words.every((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`).test(haystack);
  });
}

export function sortJobs(jobs, sortBy) {
  const date = (job) => Date.parse(job.published_at) || 0;
  return [...jobs].sort((a, b) => {
    if (sortBy === "recent") return date(b) - date(a);
    if (sortBy === "title" || sortBy === "company") return String(a[sortBy] || "").localeCompare(String(b[sortBy] || ""), "pt-BR");
    if (sortBy === "salary-desc") return (monthlySalary(b)?.max || 0) - (monthlySalary(a)?.max || 0);
    if ((a.match_evaluated === false) !== (b.match_evaluated === false)) return a.match_evaluated === false ? 1 : -1;
    if (a.match_evaluated === false) return (b.search_relevance || 0) - (a.search_relevance || 0) || date(b) - date(a);
    return sortBy === "match-asc" ? a.match_percentage - b.match_percentage : b.match_percentage - a.match_percentage;
  });
}

export function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

export function searchSuggestions(jobs, query) {
  const terms = [...new Set(jobs.flatMap((job) => job.is_search_link
    ? [job.search_query || job.title?.replace(/^Buscar\s+/i, "")]
    : [job.title, ...(job.required_skills || [])]).filter((term) => typeof term === "string" && term.length <= 200))];
  const normalized = normalizeText(query);
  if (normalized.length < 2) return [];
  return terms.map((term) => {
    const text = normalizeText(term);
    const distance = text.includes(normalized) ? 0 : Math.min(...text.split(/\s+/).map((word) => editDistance(word, normalized)));
    return { term, distance };
  }).filter(({ distance }) => distance <= (normalized.length > 4 ? 2 : 1))
    .sort((a, b) => a.distance - b.distance || a.term.localeCompare(b.term, "pt-BR")).slice(0, 6);
}

export function trendingTitles(jobs) {
  const counts = new Map();
  for (const job of jobs.filter((item) => item.is_real)) counts.set(job.title, (counts.get(job.title) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
}
