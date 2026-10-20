import { getLocationRelevance } from "./locationScoring.js";
import { matchesJob, matchesJobQuery } from "../../src/lib/jobSearch.js";

const REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs";
const ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api";
const JOBICY_API_URL = "https://jobicy.com/api/v2/remote-jobs";
const DEFAULT_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_RESULTS = 16;
// A hard role + requirement gate already removes unrelated jobs. The numeric
// floor can therefore include legitimate entry-level opportunities as
// "pode melhorar" instead of hiding every result from a beginner.
const MINIMUM_MATCH = 35;
const MAX_JOB_AGE_DAYS = 60;
const MINIMUM_DISPLAY_OPTIONS = 8;

const searchTitlesByArea = {
  it_support: ["Assistente de TI", "Técnico de Suporte", "Analista de Suporte de TI"],
  administrative: ["Auxiliar Administrativo", "Assistente Administrativo", "Auxiliar de Escritório"],
  customer_success: ["Atendimento ao Cliente", "Customer Success", "Suporte ao Cliente"],
  frontend: ["Desenvolvedor Frontend", "Frontend Júnior", "Desenvolvedor Web"],
  backend: ["Desenvolvedor Backend", "Backend Júnior", "Desenvolvedor de Software"],
  data: ["Analista de Dados", "Cientista de Dados", "Business Intelligence"],
  marketing: ["Analista de Marketing", "Marketing Digital", "Growth Marketing"],
  sales: ["Assistente de Vendas", "Executivo de Vendas", "SDR"],
  hr: ["Assistente de RH", "Analista de Recursos Humanos", "Recrutamento"],
  finance: ["Assistente Financeiro", "Auxiliar Financeiro", "Analista Financeiro"],
  operations: ["Assistente de Operações", "Auxiliar de Logística", "Analista de Operações"]
};

const skillCatalog = [
  "react", "next.js", "javascript", "typescript", "node.js", "express", "java",
  "spring", "c#", ".net", "python", "django", "flask", "sql", "postgresql",
  "mysql", "mongodb", "redis", "graphql", "rest", "html", "css", "tailwind",
  "angular", "vue", "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
  "linux", "ci/cd", "git", "github", "gitlab", "jest", "cypress", "playwright",
  "pandas", "numpy", "machine learning", "power bi", "tableau", "spark", "airflow",
  "figma", "scrum", "kanban", "inglês", "english", "go", "golang", "ruby",
  "rails", "php", "laravel", "rust", "kotlin", "swift", "flutter", "react native",
  "android", "ios", "selenium", "appium", "postman", "cucumber", "sap", "salesforce",
  "excel", "powerpoint", "seo", "crm", "hubspot", "google analytics", "ux", "ui",
  "accessibility", "acessibilidade", "cybersecurity", "segurança da informação", "security", "oauth",
  "microservices", "kafka", "rabbitmq", "produto", "roadmap", "discovery", "métricas",
  "design system", "testes automatizados", "quality assurance"
  , "marketing", "vendas", "sales", "customer success", "atendimento", "recrutamento",
  "recursos humanos", "finanças", "finance", "contabilidade", "operações", "operations",
  "administrative", "office support", "data entry", "bookkeeping", "billing", "reporting",
  "document management", "communication", "organization", "windows", "hardware",
  "help desk", "service desk", "suporte tecnico", "redes", "troubleshooting"
];

const areaTerms = {
  it_support: ["assistente de ti", "auxiliar de ti", "suporte de ti", "suporte tecnico", "tecnico de informatica", "it support", "help desk", "helpdesk", "service desk", "desktop support"],
  frontend: ["frontend", "front end", "front-end", "react", "web developer"],
  backend: ["backend", "back end", "back-end", "software engineer", "node", "api"],
  data: ["data", "dados", "analytics", "machine learning", "business intelligence"],
  devops: ["devops", "cloud", "site reliability", "sre", "platform engineer"],
  qa: ["quality assurance", "qa", "test engineer", "automation tester", "software tester"],
  mobile: ["mobile", "android", "ios", "flutter", "react native"],
  security: ["security", "cybersecurity", "application security", "soc analyst"],
  product: ["product manager", "product owner", "product analyst", "gerente de produto"],
  design: ["product designer", "ux", "ui", "user experience", "designer"],
  marketing: ["marketing", "growth", "seo", "content", "mídia", "social media"],
  sales: ["sales", "vendas", "account executive", "business development", "sdr", "bdr"],
  hr: ["human resources", "recursos humanos", "people", "recruiter", "recrutamento"],
  finance: ["finance", "finanças", "financial", "contabilidade", "controller"],
  operations: ["operations", "operações", "supply chain", "logística", "procurement"],
  customer_success: ["customer success", "customer support", "atendimento", "suporte ao cliente"],
  administrative: ["administrative", "office assistant", "administrative assistant", "office support",
    "data entry", "back office", "auxiliar administrativo", "assistente administrativo"]
};

const supportedRolePatterns = {
  it_support: /\b(?:(?:assistente|auxiliar|analista|tecnic[oa]) (?:de |em )?(?:ti|informatica|tecnologia da informacao)|tecnic[oa] de suporte|(?:analista de |tecnic[oa] de )?suporte (?:de ti|tecnico|em informatica)|it (?:support|assistant|technician)|help[ -]?desk|service desk|desktop support)\b/,
  frontend: /\b(front[ -]?end|react|web developer|desenvolvedor(?:a)? web|programador(?:a)? web)\b/,
  backend: /\b(back[ -]?end|software engineer|engenheir[oa] de software|node(?:\.js)? developer|desenvolvedor(?:a)? (?:node|java|python|\.net))\b/,
  data: /\b(data|dados|analytics|machine learning|business intelligence|cientista de dados|engenheir[oa] de dados|analista de dados|analista de bi)\b/,
  devops: /\b(devops|cloud|site reliability|sre|platform engineer|engenheir[oa] de plataforma|infraestrutura)\b/,
  qa: /\b(quality assurance|qa|test engineer|automation tester|software tester|analista de testes|analista de qualidade)\b/,
  mobile: /\b(mobile|android|ios|flutter|react native|desenvolvedor(?:a)? mobile)\b/,
  security: /\b(security|cybersecurity|application security|soc analyst|seguran[cç]a da informa[cç][aã]o)\b/,
  product: /\b(product manager|product owner|product analyst|gerente de produto|analista de produto)\b/,
  design: /\b(product designer|ux|ui|user experience|designer de produto)\b/,
  marketing: /\b(marketing|growth|seo|conte[uú]do|social media|m[ií]dia)\b/,
  sales: /\b(sales|vendas|account executive|business development|sdr|bdr|executiv[oa] de contas)\b/,
  hr: /\b(human resources|recursos humanos|people|recruiter|recrutador(?:a)?)\b/,
  finance: /\b(finance|finan[cç]as|financial|contabilidade|controller|analista financeiro)\b/,
  operations: /\b(operations|opera[cç][oõ]es|supply chain|log[ií]stica|procurement)\b/,
  customer_success: /\b(customer success|customer support|atendimento|suporte ao cliente)\b/,
  administrative: /\b(administrative|office assistant|administrative assistant|office support|data entry|back office|auxiliar administrativo|assistente administrativo)\b/
};

const skillAliases = {
  "atendimento ao cliente": ["customer service", "customer support", "client support"],
  atendimento: ["customer service", "customer support"],
  suporte: ["support", "office support"],
  "controle de documentos": ["document control", "document management", "client documents", "company records"],
  "rotinas administrativas": ["administrative", "office support", "daily operations"],
  "auxiliar administrativo": ["administrative", "office assistant", "office support"],
  "assistente administrativo": ["administrative", "administrative assistant", "office assistant"],
  administrativo: ["administrative", "office assistant"],
  "entrada de dados": ["data entry"],
  "pacote office": ["microsoft office", "excel", "word", "powerpoint"]
};

const blockedIntentPatterns = [
  /\bgarot[ao]s? de programa\b/,
  /\bacompanhante(?:s)?\b/,
  /\bprostitut[ao]s?\b/,
  /\bservi[cç]os? sexuais?\b/,
  /\bconte[uú]do adulto\b/,
  /\bmassagem er[oó]tica\b/,
  /\bonlyfans\b/,
  /\bsugar (?:baby|daddy|mommy)\b/
];

const providerCache = new Map();
const keywordCache = new Map();
const keywordRequests = new Map();

function getCachedJobs(provider) {
  const cached = providerCache.get(provider);
  return cached?.expiresAt > Date.now() ? cached.jobs : null;
}

function setCachedJobs(provider, jobs) {
  if (providerCache.size >= 150) providerCache.delete(providerCache.keys().next().value);
  providerCache.set(provider, { expiresAt: Date.now() + CACHE_TTL_MS, jobs });
  return jobs;
}

async function readJsonProviderResponse(response, providerName) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const body = await response.text();
  const trimmedBody = body.trimStart();

  if (!response.ok) {
    throw new Error(`${providerName} respondeu HTTP ${response.status}`);
  }

  if (!contentType.includes("json") && trimmedBody.startsWith("<")) {
    throw new Error(`${providerName} respondeu HTML em vez de JSON`);
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    if (trimmedBody.startsWith("<")) {
      throw new Error(`${providerName} respondeu HTML em vez de JSON`);
    }

    throw new Error(`${providerName} respondeu JSON invalido`);
  }
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function stripHtml(value = "") {
  return String(value).replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function hasTerm(text, term) {
  const normalizedTerm = normalize(term);
  if (normalizedTerm.length <= 1) return false;
  if ((` ${text} `).includes(` ${normalizedTerm} `)) return true;
  if (normalizedTerm.includes(" ")) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function canonicalSkill(value = "") {
  const skill = normalize(value);
  return ({
    node: "node.js",
    next: "next.js",
    js: "javascript",
    ts: "typescript",
    postgres: "postgresql",
    k8s: "kubernetes",
    suporte: "support",
    "atendimento ao cliente": "customer support",
    atendimento: "customer support",
    "controle de documentos": "document management",
    "rotinas administrativas": "administrative",
    "auxiliar administrativo": "administrative",
    "assistente administrativo": "administrative",
    administrativo: "administrative",
    "entrada de dados": "data entry",
    "pacote office": "microsoft office"
  })[skill] || skill;
}

function jobContainsSkill(searchableJob, skill) {
  const normalizedSkill = normalize(skill);
  return hasTerm(searchableJob, normalizedSkill) || (skillAliases[normalizedSkill] || []).some((alias) => hasTerm(searchableJob, alias));
}

function skillsAreEquivalent(left = "", right = "") {
  const leftSkill = canonicalSkill(left);
  const rightSkill = canonicalSkill(right);
  return leftSkill === rightSkill || hasTerm(leftSkill, rightSkill) || hasTerm(rightSkill, leftSkill);
}

function titleWords(value = "") {
  const ignored = new Set([
    "de", "da", "do", "para", "com", "and", "the", "developer", "desenvolvedor",
    "engineer", "engenheiro", "analyst", "analista", "specialist", "especialista"
  ]);
  return unique(normalize(value).split(" ").filter((word) => word.length > 1 && !ignored.has(word)));
}

function explicitRoleArea(context) {
  const title = normalize(context.targetTitle || context.targetRole || "");
  return Object.entries(supportedRolePatterns).find(([, pattern]) => pattern.test(title))?.[0];
}

function resolveSearchContext(context) {
  return { ...context, area: explicitRoleArea(context) || context.area };
}

// Older saved results mixed inferred roles and repeated the same search links.
// Refresh those immediately instead of retaining them for the cache duration.
export function canReuseJobSearch(jobs = [], context = {}) {
  const target = normalize(context.targetTitle || context.targetRole || "");
  const area = explicitRoleArea(context);
  const ids = new Set();
  const urls = new Set();
  return jobs.every((job) => {
    if (!job.id || !job.url || ids.has(job.id) || urls.has(job.url)) return false;
    ids.add(job.id);
    urls.add(job.url);
    if (job.is_search_link) return Boolean(job.search_query) && (!target || normalize(job.search_query) === target);
    if (!target) return true;
    if (area) return supportedRolePatterns[area].test(normalize(job.title));
    const words = titleWords(target);
    return words.length ? words.every((word) => hasTerm(normalize(job.title), word)) : hasTerm(normalize(job.title), target);
  });
}

function supportsBrazil(location = "") {
  const value = normalize(location);
  return Boolean(value) && ["worldwide", "anywhere", "global", "brazil", "brasil", "latin america", "latam",
    "south america", "americas", "america timezones", "utc-3", "utc -3"]
    .some((term) => value.includes(term));
}

function seniorityLevel(value = "") {
  const text = normalize(value);
  if (/\b(senior|sr|lead|principal|staff|head|manager)\b/.test(text)) return 3;
  if (/\b(mid|pleno|intermediate)\b/.test(text)) return 2;
  if (/\b(junior|jr|entry|intern|estagio)\b/.test(text)) return 1;
  return 0;
}

function publicationFreshness(publicationDate) {
  const published = Date.parse(publicationDate || "");
  if (!Number.isFinite(published)) return 0;
  const ageDays = Math.max(0, (Date.now() - published) / 86400000);
  if (ageDays <= 7) return 5;
  if (ageDays <= 30) return 3;
  return 1;
}

function isRecentEnough(publicationDate) {
  const published = Date.parse(publicationDate || "");
  return !Number.isFinite(published) || (Date.now() - published) / 86400000 <= MAX_JOB_AGE_DAYS;
}

export function isJobSearchContextAllowed(context = {}) {
  context = resolveSearchContext(context);
  const combinedInput = normalize(`${context.targetTitle || ""} ${context.targetRole || ""}`);
  if (blockedIntentPatterns.some((pattern) => pattern.test(combinedInput))) return false;

  const area = String(context.area || "").toLowerCase();
  if (!Object.hasOwn(areaTerms, area)) return false;

  const statedRole = normalize(`${context.targetTitle || ""} ${context.targetRole || ""}`);
  const hasSupportedRole = statedRole && supportedRolePatterns[area]?.test(statedRole);
  const hasTechnicalEvidence = unique([...(context.skills || []), ...(context.targetKeywords || [])])
    .some((skill) => skillCatalog.some((knownSkill) => skillsAreEquivalent(skill, knownSkill)));

  return Boolean(hasSupportedRole || hasTechnicalEvidence);
}

export function validateCareerInput(value = "") {
  const normalized = normalize(value);
  if (!normalized) return { allowed: true, reason: "" };
  if (blockedIntentPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: "O cargo informado está fora do escopo de carreiras profissionais atendido pela plataforma."
    };
  }
  return { allowed: true, reason: "" };
}

export function rankRealJob(rawJob, context = {}) {
  context = resolveSearchContext(context);
  if (!isJobSearchContextAllowed(context)) return null;

  const description = stripHtml(rawJob.description);
  const title = String(rawJob.title || "").trim();
  const company = String(rawJob.company_name || "").trim();
  const location = String(rawJob.candidate_required_location || "").trim();
  const url = String(rawJob.url || "").trim();

  if (
    !rawJob.id || !title || !company || !description || !/^https:\/\//i.test(url) ||
    (!rawJob.is_brazil_listing && !supportsBrazil(location)) || !isRecentEnough(rawJob.publication_date)
  ) return null;

  const searchableJob = normalize(`${title} ${description}`);
  const searchableTitle = normalize(title);
  const profileSkills = unique([...(context.skills || []), ...(context.targetKeywords || [])]);
  const matchedSkills = profileSkills.filter((skill) => jobContainsSkill(searchableJob, skill));
  const optionalMarker = searchableJob.search(/\b(nice to have|preferred|differentials?|diferenciais?|desejavel|desejaveis)\b/);
  const requiredText = optionalMarker >= 0 ? searchableJob.slice(0, optionalMarker) : searchableJob;
  const optionalText = optionalMarker >= 0 ? searchableJob.slice(optionalMarker) : "";
  const requiredSkills = skillCatalog.filter((skill) => hasTerm(requiredText, skill));
  const optionalSkills = skillCatalog.filter((skill) => hasTerm(optionalText, skill) && !requiredSkills.includes(skill));
  const missingSkills = requiredSkills.filter((skill) =>
    !matchedSkills.some((matched) => skillsAreEquivalent(matched, skill))
  );
  const desiredWords = titleWords(context.targetTitle || context.targetRole || "");
  const matchingTitleWords = desiredWords.filter((word) => hasTerm(searchableTitle, word));
  const areaMatch = supportedRolePatterns[context.area]?.test(searchableTitle) ||
    (areaTerms[context.area] || []).some((term) => hasTerm(searchableTitle, term));

  // The chosen occupation takes precedence over technologies found in the CV.
  // Keep equivalent titles within its family; never substitute an inferred area.
  if (context.targetTitle || context.targetRole) {
    const roleMatches = explicitRoleArea(context) ? areaMatch
      : desiredWords.length ? matchingTitleWords.length === desiredWords.length
        : hasTerm(searchableTitle, context.targetTitle || context.targetRole);
    if (!roleMatches) return null;
  }

  // Skills mentioned only in a long description must not make an unrelated
  // advertised role look compatible.
  if (!areaMatch && matchingTitleWords.length === 0) return null;

  const matchedRequiredCount = requiredSkills.filter((required) =>
    matchedSkills.some((skill) => skillsAreEquivalent(skill, required))
  ).length;
  const matchedOptionalSkills = optionalSkills.filter((optional) =>
    matchedSkills.some((skill) => skillsAreEquivalent(skill, optional))
  );
  if (requiredSkills.length > 0 && matchedRequiredCount === 0) return null;
  if (requiredSkills.length === 0 && matchedSkills.length === 0) return null;
  const skillCoverage = requiredSkills.length ? matchedRequiredCount / requiredSkills.length : Math.min(1, matchedSkills.length / 3);
  const titleCoverage = desiredWords.length ? matchingTitleWords.length / desiredWords.length : (areaMatch ? 0.65 : 0);
  const profileLevel = seniorityLevel(context.seniority);
  const vacancyLevel = seniorityLevel(title);
  const seniorityScore = !profileLevel || !vacancyLevel ? 5 : profileLevel === vacancyLevel ? 10 : Math.abs(profileLevel - vacancyLevel) === 1 ? 4 : 0;
  const locationContext = getLocationRelevance({
    profileLocation: context.location || "",
    profileText: context.profileText || "",
    jobLocation: location,
    jobRemote: rawJob.remote,
    jobType: rawJob.job_type || rawJob.employment_type || ""
  });
  const locationScore = locationContext.score;
  const optionalScore = Math.min(5, matchedOptionalSkills.length * 2);
  const match = Math.max(0, Math.min(100, Math.round(10 + skillCoverage * 50 + titleCoverage * 20
    + seniorityScore + publicationFreshness(rawJob.publication_date) + locationScore + optionalScore)));
  const confidence = requiredSkills.length >= 4 ? "alta" : requiredSkills.length >= 2 ? "média" : "baixa";

  return {
    id: `${normalize(rawJob.source || "remotive").replace(/\s+/g, "-")}-${rawJob.id}`,
    external_id: `${normalize(rawJob.source || "remotive")}:${rawJob.id}`,
    title,
    company,
    location,
    remote: typeof rawJob.remote === "boolean" ? rawJob.remote : /remotive/i.test(rawJob.source || "remotive") || /remot|home office/i.test(location) ? true : null,
    work_mode: rawJob.work_mode || (/h[ií]brid|hybrid/i.test(`${location} ${description}`) ? "hybrid" : ""),
    employment_type: rawJob.job_type || rawJob.employment_type || "",
    salary: rawJob.salary || "",
    salary_min: rawJob.salary_min ?? null,
    salary_max: rawJob.salary_max ?? null,
    salary_currency: rawJob.salary_currency || "",
    salary_period: rawJob.salary_period || "",
    description: description.slice(0, 2200),
    required_skills: requiredSkills.slice(0, 12),
    optional_skills: optionalSkills.slice(0, 8),
    match,
    match_percentage: match,
    match_reasons: unique([
      ...matchedSkills.slice(0, 5),
      matchingTitleWords.length ? `Título alinhado: ${matchingTitleWords.slice(0, 3).join(", ")}` : "",
      vacancyLevel && profileLevel === vacancyLevel ? "Senioridade alinhada" : "",
      ...locationContext.reasons,
      locationContext.label ? `Localizacao: ${locationContext.label}` : ""
    ]),
    improvement_tips: missingSkills.slice(0, 4).map((skill) => `A vaga cita ${skill}; inclua essa competência somente se você realmente a possui.`),
    match_breakdown: {
      title: Math.round(titleCoverage * 100),
      required_skills: Math.round(skillCoverage * 100),
      seniority: seniorityScore * 10,
      location: Math.round((locationScore / 20) * 100)
    },
    match_confidence: confidence,
    url,
    source: rawJob.source || "Remotive",
    source_url: rawJob.source_url || "https://remotive.com/remote-jobs",
    published_at: rawJob.publication_date || null,
    verified_at: new Date().toISOString(),
    is_real: true
  };
}

async function fetchRemotiveJobs(context = {}) {
  const cacheKey = context.keyword ? `remotive:${normalize(context.keyword)}` : "remotive";
  const cached = getCachedJobs(cacheKey);
  if (cached) return cached;
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.JOBS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({ limit: "200", ...(context.keyword ? { search: context.keyword } : {}) });
    const response = await fetch(`${REMOTIVE_API_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Career-AI-Advisor/1.0" }
    });
    const payload = await readJsonProviderResponse(response, "Remotive");
    const jobs = Array.isArray(payload.jobs)
      ? payload.jobs.map((job) => ({
          ...job,
          source: "Remotive",
          source_url: "https://remotive.com/remote-jobs"
        }))
      : [];
    return setCachedJobs(cacheKey, jobs);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArbeitnowJobs() {
  const cached = getCachedJobs("arbeitnow");
  if (cached) return cached;
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.JOBS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ARBEITNOW_API_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Career-AI-Advisor/1.0" }
    });
    const payload = await readJsonProviderResponse(response, "Arbeitnow");
    const jobs = Array.isArray(payload.data) ? payload.data.map((job) => ({
      id: job.slug,
      url: job.url,
      title: job.title,
      company_name: job.company_name,
      candidate_required_location: job.location || (job.remote ? "Worldwide" : ""),
      publication_date: job.created_at ? new Date(Number(job.created_at) * 1000).toISOString() : null,
      job_type: Array.isArray(job.job_types) ? job.job_types.join(" • ") : "",
      description: job.description,
      remote: Boolean(job.remote),
      source: "Arbeitnow",
      source_url: "https://www.arbeitnow.com/"
    })) : [];
    return setCachedJobs("arbeitnow", jobs);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJobicyJobs() {
  const cached = getCachedJobs("jobicy");
  if (cached) return cached;
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.JOBS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${JOBICY_API_URL}?count=50`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Career-AI-Advisor/1.0" }
    });
    const payload = await readJsonProviderResponse(response, "Jobicy");
    const jobs = Array.isArray(payload.jobs) ? payload.jobs.map((job) => ({
      id: job.id || job.jobId,
      url: job.url,
      title: job.jobTitle,
      company_name: job.companyName,
      candidate_required_location: job.jobGeo || "Worldwide",
      publication_date: job.pubDate,
      job_type: job.jobType,
      salary: job.annualSalaryMin || job.annualSalaryMax
        ? `${job.salaryCurrency || ""} ${job.annualSalaryMin || ""} – ${job.annualSalaryMax || ""}`.trim()
        : "",
      salary_min: job.annualSalaryMin || null,
      salary_max: job.annualSalaryMax || null,
      salary_currency: job.salaryCurrency || "",
      salary_period: "year",
      description: job.jobDescription,
      remote: true,
      source: "Jobicy",
      source_url: "https://jobicy.com/"
    })) : [];
    return setCachedJobs("jobicy", jobs);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchInfoJobs(context = {}) {
  const titles = searchTitlesByArea[context.area] || [];
  const query = String(context.targetTitle || context.targetRole || titles[0] || context.area || "").trim();
  if (!query) return [];
  const cacheKey = `infojobs:${normalize(query)}`;
  const cached = getCachedJobs(cacheKey);
  if (cached) return cached;
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.JOBS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Invented SEO slugs can redirect to unrelated default results. The search
    // form's keyword parameter preserves the actual term, including punctuation.
    const searchUrl = `https://www.infojobs.com.br/vagas-de-emprego.aspx?${new URLSearchParams({ Palabra: query })}`;
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { Accept: "text/html", "User-Agent": "Career-AI-Advisor/1.0 (+job-search)" }
    });
    if (!response.ok) throw new Error(`InfoJobs respondeu HTTP ${response.status}`);
    const html = await response.text();
    const cards = html.split(/<div[^>]+class="[^"]*js_rowCard[^"]*"/i).slice(1, 31);
    const jobs = cards.map((card) => {
      const relativeUrl = decodeHtml(card.match(/data-href="([^"]+__\d+\.aspx)"/i)?.[1] || "");
      const id = card.match(/data-id="(\d+)"/i)?.[1] || relativeUrl.match(/__(\d+)\.aspx/i)?.[1];
      const title = stripHtml(decodeHtml(card.match(/<h2[^>]*js_vacancyTitle[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || ""));
      const companyBlock = card.match(/d-flex align-items-baseline[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "";
      const company = stripHtml(decodeHtml(companyBlock))
        .replace(/^\d[,.]\d\s+/, "")
        .replace(/\s+Este selo indica que a empresa foi verificada pelo Infojobs\.[\s\S]*$/i, "")
        .trim();
      const locationBlock = card.match(/<div class="mb-8">\s*([\s\S]*?)<\/div>/i)?.[1] || "Brasil";
      const location = stripHtml(decodeHtml(locationBlock)).replace(/,\s*\d+\s*Km de você\.?/i, "").trim() || "Brasil";
      const publicationDate = card.match(/class="js_date"[^>]+data-value="([^"]+)"/i)?.[1]?.replaceAll("/", "-").replace(" ", "T") || null;
      const description = stripHtml(decodeHtml(card)).slice(0, 2200);
      const remote = /home office|remoto|teletrabalho/i.test(description);

      return {
        id,
        url: relativeUrl ? new URL(relativeUrl, "https://www.infojobs.com.br").toString() : "",
        title,
        company_name: company || "Empresa anunciada no InfoJobs",
        candidate_required_location: location,
        publication_date: publicationDate,
        job_type: remote ? "Remoto" : "Presencial ou híbrido",
        description,
        remote,
        is_brazil_listing: true,
        source: "InfoJobs",
        source_url: searchUrl
      };
    }).filter((job) => job.id && job.url && job.title);
    return setCachedJobs(cacheKey, jobs);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAdzunaJobs(context = {}) {
  const appId = String(process.env.ADZUNA_APP_ID || "").trim();
  const appKey = String(process.env.ADZUNA_APP_KEY || "").trim();
  if (!appId || !appKey) return { configured: false, jobs: [] };

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.JOBS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const query = normalize(context.targetTitle || context.targetRole || context.area).slice(0, 80);

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "50",
      what: query,
      ...(context.location ? { where: String(context.location).slice(0, 80) } : {}),
      "content-type": "application/json"
    });
    const response = await fetch(`https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "Career-AI-Advisor/1.0" }
    });
    const payload = await readJsonProviderResponse(response, "Adzuna");
    const jobs = Array.isArray(payload.results) ? payload.results.map((job) => ({
      id: job.id,
      url: job.redirect_url,
      title: job.title,
      company_name: job.company?.display_name,
      candidate_required_location: job.location?.display_name || "Brasil",
      publication_date: job.created,
      job_type: [job.contract_time, job.contract_type].filter(Boolean).join(" • "),
      salary: job.salary_min || job.salary_max
        ? `R$ ${Number(job.salary_min || 0).toLocaleString("pt-BR")} – R$ ${Number(job.salary_max || 0).toLocaleString("pt-BR")}`
        : "",
      description: job.description,
      is_brazil_listing: true,
      source: "Adzuna",
      source_url: "https://www.adzuna.com.br/"
    })) : [];
    return { configured: true, jobs };
  } finally {
    clearTimeout(timeout);
  }
}

function deduplicateJobs(jobs = []) {
  const canonical = new Map();
  for (const job of jobs) {
    const company = normalize(job.company_name || job.company).replace(/\b(ltda|sa|s a|inc|llc|brasil)\b/g, "").trim();
    const title = normalize(job.title)
      .replace(/\b(junior|jr\.?|pleno|senior|sr\.?)\b/g, "")
      .replace(/\s+/g, " ").trim();
    const location = normalize(job.candidate_required_location || job.location).replace(/\b(remoto|remote|brasil)\b/g, "").trim();
    const key = `${company}|${title}|${location}`;
    if (!key.replaceAll("|", "")) continue;

    const previous = canonical.get(key);
    const previousDate = Date.parse(previous?.publication_date || previous?.published_at || 0);
    const currentDate = Date.parse(job.publication_date || job.published_at || 0);
    if (!previous || currentDate > previousDate || (!previous.description && job.description)) {
      canonical.set(key, job);
    }
  }
  return [...canonical.values()];
}

function buildSearchSuggestions(context = {}, count = MINIMUM_DISPLAY_OPTIONS) {
  const explicitTitle = String(context.targetTitle || context.targetRole || "").trim();
  const areaTitles = searchTitlesByArea[context.area] || [];
  const titles = unique(explicitTitle ? [explicitTitle] : [...areaTitles, ...(areaTitles.length ? [] : [areaTerms[context.area]?.[0]])])
    .filter(Boolean);
  const location = String(context.location || "Brasil").trim() || "Brasil";
  const builders = [
    ["LinkedIn", (query) => `https://www.linkedin.com/jobs/search/?${new URLSearchParams({ keywords: query, location }).toString()}`],
    ["Indeed", (query) => `https://br.indeed.com/jobs?${new URLSearchParams({ q: query, l: location }).toString()}`],
    ["InfoJobs", (query) => `https://www.infojobs.com.br/vagas-de-emprego.aspx?${new URLSearchParams({ Palabra: query }).toString()}`],
    ["Vagas.com", (query) => `https://www.vagas.com.br/vagas-de-${normalize(query).replace(/\s+/g, "-")}`]
  ];
  const checkedAt = new Date().toISOString();
  const suggestions = [];

  for (let index = 0; suggestions.length < count && index < titles.length * builders.length; index += 1) {
    const title = titles[Math.floor(index / builders.length)];
    const [source, buildUrl] = builders[index % builders.length];
    suggestions.push({
      id: `search-${normalize(source)}-${normalize(title).replace(/\s+/g, "-")}`,
      external_id: `search:${normalize(source)}:${normalize(title)}`,
      title: `Buscar ${title}`,
      search_query: title,
      company: `${source} • busca de vagas`,
      location,
      remote: null,
      description: `Busca externa por ${title} no ${source}. Este link abre uma lista de resultados, não um anúncio específico. Confira o cargo e a localização na plataforma.`,
      required_skills: [],
      match: 0,
      match_percentage: 0,
      match_reasons: ["Busca baseada no seu currículo", `Resultados atualizados no ${source}`],
      improvement_tips: [],
      url: buildUrl(title),
      source,
      source_url: buildUrl(title),
      published_at: null,
      verified_at: checkedAt,
      is_real: false,
      is_search_link: true
    });
  }
  return suggestions;
}

async function collectJobListings(context, provider) {
  const requests = [];
  if (["auto", "remotive"].includes(provider)) requests.push({ name: "Remotive", promise: fetchRemotiveJobs(context) });
  if (["auto", "adzuna"].includes(provider)) requests.push({ name: "Adzuna", promise: fetchAdzunaJobs(context) });
  if (["auto", "arbeitnow"].includes(provider)) requests.push({ name: "Arbeitnow", promise: fetchArbeitnowJobs() });
  if (["auto", "jobicy"].includes(provider)) requests.push({ name: "Jobicy", promise: fetchJobicyJobs() });
  if (["auto", "infojobs"].includes(provider)) requests.push({ name: "InfoJobs", promise: fetchInfoJobs(context) });
  const settled = await Promise.allSettled(requests.map((request) => request.promise));
  const successfulProviders = [];
  const errors = [];
  let rawJobs = [];

  settled.forEach((result, index) => {
    const name = requests[index].name;
    if (result.status === "rejected") {
      errors.push(`${name}: ${result.reason?.message || "indisponível"}`);
      return;
    }
    if (result.value?.configured === false) return;
    successfulProviders.push(name);
    rawJobs = rawJobs.concat(Array.isArray(result.value) ? result.value : result.value?.jobs || []);
  });

  return { rawJobs, successfulProviders, errors };
}

export async function searchRealJobs(context = {}) {
  context = resolveSearchContext(context);
  const checkedAt = new Date().toISOString();
  const validation = validateCareerInput(`${context.targetTitle || ""} ${context.targetRole || ""}`);
  if (!validation.allowed) {
    return { status: "blocked", jobs: [], checked_at: checkedAt, provider: "", error: validation.reason };
  }
  if (!isJobSearchContextAllowed(context)) {
    return {
      status: "invalid_profile",
      jobs: [],
      checked_at: checkedAt,
      provider: "",
      error: "Não há cargo reconhecido ou competências profissionais suficientes para buscar vagas."
    };
  }

  const provider = String(process.env.JOBS_PROVIDER || "auto").toLowerCase();
  if (provider === "none" || process.env.NODE_ENV === "test") {
    return { status: "disabled", jobs: [], checked_at: checkedAt, provider: "", error: "" };
  }
  if (!["auto", "remotive", "adzuna", "arbeitnow", "jobicy", "infojobs"].includes(provider)) {
    return { status: "provider_error", jobs: [], checked_at: checkedAt, provider, error: `Provedor não suportado: ${provider}` };
  }

  const { rawJobs, successfulProviders, errors } = await collectJobListings(context, provider);

  if (successfulProviders.length === 0) {
    return { status: "provider_error", jobs: [], checked_at: checkedAt, provider: "", error: errors.join("; ") || "Nenhuma fonte de vagas disponível." };
  }

  const deduplicatedJobs = deduplicateJobs(rawJobs);
  const jobs = deduplicatedJobs.map((job) => rankRealJob(job, context))
    .filter((job) => job && job.match >= MINIMUM_MATCH)
    .sort((a, b) => b.match - a.match || Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0))
    .slice(0, Math.min(50, Math.max(1, Number(process.env.JOBS_MAX_RESULTS) || DEFAULT_MAX_RESULTS)));

  const searchSuggestions = jobs.length < MINIMUM_DISPLAY_OPTIONS
    ? buildSearchSuggestions(context, MINIMUM_DISPLAY_OPTIONS - jobs.length)
    : [];

  return {
    status: jobs.length || searchSuggestions.length ? "success" : "no_results",
    jobs: [...jobs, ...searchSuggestions],
    checked_at: checkedAt,
    provider: successfulProviders.join(", "),
    error: successfulProviders.length ? "" : errors.join("; "),
    quality: {
      fetched: rawJobs.length,
      deduplicated: deduplicatedJobs.length,
      verified: jobs.length,
      suggestions: searchSuggestions.length,
      providers_ok: successfulProviders,
      providers_failed: errors.length,
      provider_errors: errors
    }
  };
}

export async function findRealJobs(context = {}) {
  const result = await searchRealJobs(context);
  if (result.status === "provider_error") console.warn("Não foi possível consultar vagas reais:", result.error);
  return result.jobs;
}

// Keyword discovery is independent of CV scoring: a valid advertisement may be
// useful even when the user has never uploaded a resume or is changing careers.
function keywordListing(rawJob, keyword, location) {
  const title = String(rawJob.title || "").trim();
  const company = String(rawJob.company_name || "").trim();
  const description = stripHtml(rawJob.description);
  const jobLocation = String(rawJob.candidate_required_location || "").trim();
  if (!rawJob.id || !title || !company || !/^https:\/\//i.test(rawJob.url || "") ||
    (!rawJob.is_brazil_listing && !supportsBrazil(jobLocation)) || !isRecentEnough(rawJob.publication_date)) return null;
  const job = {
    id: `${normalize(rawJob.source).replace(/\s+/g, "-")}-${rawJob.id}`,
    external_id: `${normalize(rawJob.source)}:${rawJob.id}`,
    title, company, description, location: jobLocation,
    remote: typeof rawJob.remote === "boolean" ? rawJob.remote : rawJob.source === "Remotive" ? true : null,
    work_mode: rawJob.work_mode || (/h[ií]brid|hybrid/i.test(`${jobLocation} ${description}`) ? "hybrid" : ""),
    employment_type: rawJob.job_type || rawJob.employment_type || "",
    salary: rawJob.salary || "",
    salary_min: rawJob.salary_min ?? null,
    salary_max: rawJob.salary_max ?? null,
    salary_currency: rawJob.salary_currency || "",
    salary_period: rawJob.salary_period || "",
    required_skills: skillCatalog.filter((skill) => hasTerm(normalize(`${title} ${description}`), skill)).slice(0, 12),
    match: null, match_percentage: null, match_evaluated: false,
    match_reasons: [], improvement_tips: [],
    url: rawJob.url, source: rawJob.source, source_url: rawJob.source_url,
    published_at: rawJob.publication_date || null,
    verified_at: new Date().toISOString(), is_real: true,
  };
  if (!matchesJob(job, { search: keyword, location })) return null;
  job.search_relevance = normalize(title) === normalize(keyword) ? 3
    : matchesJobQuery({ title }, keyword) ? 2 : 1;
  job.description = description.slice(0, 2200);
  return job;
}

export async function searchJobsByKeyword({ keyword = "", location = "" } = {}) {
  keyword = String(keyword).trim().replace(/\s+/g, " ");
  location = String(location).trim();
  const checkedAt = new Date().toISOString();
  const empty = { jobs: [], external_searches: [], checked_at: checkedAt, provider: "", error: "" };
  if (keyword.length < 2 || keyword.length > 200 || location.length > 200) {
    return { ...empty, status: "invalid_query", error: "Digite uma palavra-chave entre 2 e 200 caracteres." };
  }
  const validation = validateCareerInput(keyword);
  if (!validation.allowed) return { ...empty, status: "blocked", error: validation.reason };
  const provider = String(process.env.JOBS_PROVIDER || "auto").toLowerCase();
  if (provider === "none" || process.env.NODE_ENV === "test") return { ...empty, status: "disabled" };
  if (!["auto", "remotive", "adzuna", "arbeitnow", "jobicy", "infojobs"].includes(provider)) {
    return { ...empty, status: "provider_error", error: "A fonte de vagas não está disponível." };
  }

  const key = JSON.stringify([provider, normalize(keyword), normalize(location)]);
  const cached = keywordCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.result;
  if (keywordRequests.has(key)) return keywordRequests.get(key);
  const pending = (async () => {
    const context = { keyword, targetTitle: keyword, location };
    const { rawJobs, successfulProviders, errors } = await collectJobListings(context, provider);
    const jobs = deduplicateJobs(rawJobs.map((job) => keywordListing(job, keyword, location)).filter(Boolean))
      .sort((a, b) => b.search_relevance - a.search_relevance || (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0))
      .slice(0, 50);
    const result = {
      ...empty, jobs, status: successfulProviders.length ? jobs.length ? "success" : "no_results" : "provider_error",
      provider: successfulProviders.join(", "),
      external_searches: buildSearchSuggestions(context, 4).map((job) => ({ ...job, match_reasons: [] })),
      error: errors.length ? successfulProviders.length ? "Algumas fontes estão indisponíveis. Exibindo os resultados das demais."
        : "Não foi possível consultar as fontes de vagas agora. Tente novamente em instantes." : "",
      quality: { fetched: rawJobs.length, verified: jobs.length, providers_failed: errors.length },
    };
    // Failures are retried by the next search; successful queries share a short,
    // bounded cache, and simultaneous requests for the same term share this work.
    if (successfulProviders.length) {
      if (keywordCache.size >= 100) keywordCache.delete(keywordCache.keys().next().value);
      keywordCache.set(key, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
    }
    return result;
  })();
  keywordRequests.set(key, pending);
  try { return await pending; }
  finally { keywordRequests.delete(key); }
}

export function clearRealJobsCache() {
  providerCache.clear();
  keywordCache.clear();
}
