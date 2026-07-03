import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import fs from "fs";
import zlib from "zlib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createAIChatCompletion } from "../src/aiClient.js";
import {
  createJobNotificationForAnalysis,
  createResumeAnalysis,
  deleteResumeAnalysisForAccount,
  getAnalysisTasksForAccount,
  getMonthlyAnalysisUsage,
  getResumeAnalysisById,
  getResumeAnalysisSourceForAccount,
  getUserProfile,
  getUserSubscription,
  listResumeAnalysesByAccountEmail,
  upsertAnalysisTasksForAccount
} from "../src/db.js";

const PREMIUM_PLANS = new Set(["pro", "premium"]);
const MAX_RESUME_TEXT_CHARS = 18000;
const MAX_JOB_DESCRIPTION_CHARS = 7000;
const RECOMMENDED_JOBS_LIMIT = 8;
const IMPROVED_RESUME_MAX_SOURCE_CHARS = 16000;

const keywordsByArea = {
  frontend: ["react", "html", "css", "javascript", "typescript", "next"],
  backend: ["node", "express", "sql", "mongodb", "api", "mysql", "postgresql"],
  data: ["python", "pandas", "numpy", "machine learning", "sql", "ia"],
  devops: ["docker", "linux", "aws", "kubernetes", "ci/cd"]
};

const jobKeywordCatalog = [
  "react",
  "next",
  "javascript",
  "typescript",
  "node",
  "express",
  "api",
  "rest",
  "graphql",
  "sql",
  "mysql",
  "postgresql",
  "mongodb",
  "python",
  "pandas",
  "numpy",
  "machine learning",
  "ia",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "linux",
  "ci/cd",
  "git",
  "testes",
  "jest",
  "cypress",
  "playwright",
  "scrum",
  "kanban",
  "figma",
  "produto",
  "dados",
  "segurança",
  "observabilidade",
  "performance",
  "liderança",
  "comunicação",
  "inglês"
];

const ignoredJobWords = new Set([
  "para",
  "com",
  "uma",
  "das",
  "dos",
  "que",
  "por",
  "como",
  "mais",
  "vaga",
  "time",
  "sobre",
  "experiencia",
  "experiencias",
  "conhecimento",
  "conhecimentos",
  "responsabilidades",
  "requisitos",
  "desejavel",
  "desejaveis",
  "diferenciais",
  "empresa",
  "trabalho",
  "profissional",
  "candidato",
  "candidata"
]);

const areaLabels = {
  frontend: "Frontend",
  backend: "Backend",
  data: "Dados/IA",
  devops: "DevOps"
};

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function isPremiumPlan(plan = "") {
  return PREMIUM_PLANS.has(String(plan).trim().toLowerCase());
}

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function removeUploadedFile(filePath) {
  if (filePath) {
    fs.unlink(filePath, () => {});
  }
}

async function extractTextFromPDF(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);

    pages.push(strings.join(" "));
  }

  return pages.join("\n");
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }

  return -1;
}

function extractZipEntry(buffer, entryName) {
  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset === -1) {
    throw Object.assign(new Error("Arquivo DOCX inválido."), { statusCode: 422 });
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameEnd);

    if (fileName === entryName) {
      if (
        compressedSize === 0xffffffff ||
        localHeaderOffset === 0xffffffff ||
        buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
      ) {
        throw Object.assign(new Error("DOCX muito grande ou não suportado."), { statusCode: 422 });
      }

      const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd > buffer.length) {
        throw Object.assign(new Error("DOCX corrompido ou incompleto."), { statusCode: 422 });
      }

      const compressedData = buffer.subarray(dataStart, dataEnd);

      if (compressionMethod === 0) {
        return compressedData;
      }

      if (compressionMethod === 8) {
        return zlib.inflateRawSync(compressedData);
      }

      throw Object.assign(new Error("Compressão do DOCX não suportada."), { statusCode: 422 });
    }

    offset = fileNameEnd + extraLength + commentLength;
  }

  return null;
}

function decodeXmlEntities(value = "") {
  return String(value).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    const normalizedCode = code.toLowerCase();

    if (normalizedCode === "amp") return "&";
    if (normalizedCode === "lt") return "<";
    if (normalizedCode === "gt") return ">";
    if (normalizedCode === "quot") return "\"";
    if (normalizedCode === "apos") return "'";

    const number = normalizedCode.startsWith("#x")
      ? Number.parseInt(normalizedCode.slice(2), 16)
      : Number.parseInt(normalizedCode.slice(1), 10);

    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}

function extractTextFromDOCX(filePath) {
  const buffer = fs.readFileSync(filePath);
  const documentXml = extractZipEntry(buffer, "word/document.xml");

  if (!documentXml) {
    throw Object.assign(new Error("Não foi possível encontrar texto no DOCX."), { statusCode: 422 });
  }

  const xml = documentXml.toString("utf8");
  const text = xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeXmlEntities(text)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractTextFromUploadedFile(file) {
  const extension = path.extname(file.originalname || file.path || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return extractTextFromPDF(file.path);
  }

  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDOCX(file.path);
  }

  throw Object.assign(new Error("Envie um arquivo PDF ou DOCX."), { statusCode: 415 });
}

function detectArea(resumeText) {
  const searchableText = normalizeSearchText(resumeText);
  const scores = Object.fromEntries(
    Object.entries(keywordsByArea).map(([area, keywords]) => [
      area,
      keywords.filter((keyword) => searchableText.includes(normalizeSearchText(keyword))).length
    ])
  );

  return Object.keys(scores).reduce((currentBest, area) =>
    scores[area] > scores[currentBest] ? area : currentBest
  );
}

function extractContactInfo(resumeText) {
  const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phoneMatch = resumeText.match(/\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}/);

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null
  };
}

function buildProfileContext(profile = {}) {
  const context = {
    target_role: profile.targetRole,
    experience_level: profile.experienceLevel,
    location: profile.location,
    headline: profile.headline,
    summary: profile.summary,
    linkedin: profile.linkedin,
    portfolio: profile.portfolio
  };

  return Object.fromEntries(
    Object.entries(context)
      .map(([key, value]) => [key, normalizeWhitespace(value)])
      .filter(([, value]) => Boolean(value))
  );
}

function clampScore(value) {
  const score = Number.parseFloat(String(value).replace("%", ""));

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function asArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set(asArray(values).map((value) => String(value).trim()).filter(Boolean)));
}

function buildTargetJobContext(body = {}) {
  const title = normalizeWhitespace(body.targetJobTitle || body.target_job_title || "").slice(0, 140);
  const description = normalizeWhitespace(body.targetJobDescription || body.target_job_description || "").slice(0, MAX_JOB_DESCRIPTION_CHARS);
  const searchableDescription = normalizeSearchText(`${title} ${description}`);
  const catalogMatches = jobKeywordCatalog.filter((keyword) =>
    searchableDescription.includes(normalizeSearchText(keyword))
  );
  const extractedWords = (searchableDescription.match(/\b[a-z0-9][a-z0-9+#./-]{2,}\b/g) || [])
    .filter((word) => word.length <= 28)
    .filter((word) => !ignoredJobWords.has(word))
    .filter((word) => !/^\d+$/.test(word));

  return {
    title,
    description,
    keywords: uniqueStrings([...catalogMatches, ...extractedWords]).slice(0, 18)
  };
}

function calculateTargetJobMatch(resumeText, targetJobContext = {}) {
  const keywords = targetJobContext.keywords || [];

  if (!targetJobContext.description || keywords.length === 0) {
    return {
      score: 0,
      matched: [],
      missing: []
    };
  }

  const searchableResume = normalizeSearchText(resumeText);
  const matched = keywords.filter((keyword) =>
    searchableResume.includes(normalizeSearchText(keyword))
  );
  const missing = keywords.filter((keyword) =>
    !searchableResume.includes(normalizeSearchText(keyword))
  );
  const score = clampScore(35 + Math.round((matched.length / keywords.length) * 65));

  return {
    score,
    matched,
    missing
  };
}

function detectSeniority(resumeText) {
  const searchableText = normalizeSearchText(resumeText);

  if (/\b(senior|sr|lead|lider|coordenador|gerente|arquiteto)\b/.test(searchableText)) {
    return "Sênior";
  }

  if (/\b(pleno|mid|analista|especialista)\b/.test(searchableText)) {
    return "Pleno";
  }

  return "Júnior";
}

function detectEnglishLevel(resumeText) {
  const searchableText = normalizeSearchText(resumeText);

  if (/\b(ingl[eê]s fluente|fluent|advanced|avan[cç]ado|c1|c2)\b/.test(searchableText)) {
    return "Avançado";
  }

  if (/\b(ingl[eê]s intermedi[áa]rio|intermediate|b1|b2)\b/.test(searchableText)) {
    return "Intermediário";
  }

  if (/\b(ingl[eê]s b[áa]sico|basic|a1|a2)\b/.test(searchableText)) {
    return "Básico";
  }

  return "Não identificado";
}

function isHttpUrl(value = "") {
  try {
    const url = new URL(String(value));

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildJobSearchUrl({ title, area, skills = [], location = "" }) {
  const query = uniqueStrings([
    title,
    area,
    ...skills.slice(0, 5),
    location.toLowerCase().includes("remoto") ? "remoto" : "",
    "Brasil"
  ]).join(" ");
  const params = new URLSearchParams({
    keywords: query || "desenvolvedor tecnologia Brasil",
    location: "Brasil"
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function buildRecommendedJobs(area, detectedSkills, marketCompatibility, profileContext = {}, targetJobContext = {}) {
  const label = areaLabels[area] || "Tecnologia";
  const skills = detectedSkills.slice(0, 5);
  const baseMatch = Math.max(55, marketCompatibility);
  const desiredRole = targetJobContext.title || profileContext.target_role || profileContext.headline || "";
  const desiredLocation = profileContext.location || "Remoto ou híbrido";
  const primaryTitle = desiredRole || `Desenvolvedor ${label} Júnior`;
  const primaryReasons = uniqueStrings([
    ...skills,
    ...(targetJobContext.keywords || []).slice(0, 4),
    targetJobContext.title ? `Vaga alvo informada: ${targetJobContext.title}` : "",
    desiredRole ? `Objetivo informado no perfil: ${desiredRole}` : ""
  ]);
  const secondaryTitle = `Analista ${label}`;
  const jobTemplates = [
    {
      title: primaryTitle,
      company: "Empresa de tecnologia",
      location: desiredLocation,
      matchOffset: 0,
      reasons: primaryReasons,
      tips: ["Inclua resultados mensuráveis nas experiências.", "Destaque projetos alinhados a vaga."]
    },
    {
      title: secondaryTitle,
      company: "Consultoria digital",
      location: "A combinar",
      matchOffset: -8,
      reasons: skills.slice(0, 3),
      tips: ["Reforce palavras-chave técnicas no resumo.", "Organize ferramentas por nível de domínio."]
    },
    {
      title: `Assistente ${label}`,
      company: "Startup em crescimento",
      location: "Remoto",
      matchOffset: -10,
      reasons: skills.slice(0, 4),
      tips: ["Mostre projetos acadêmicos, freelancers ou cases pessoais.", "Adicione links de portfólio ou GitHub quando existirem."]
    },
    {
      title: `Estágio em ${label}`,
      company: "Empresa parceira",
      location: desiredLocation,
      matchOffset: -14,
      reasons: skills.slice(0, 3),
      tips: ["Inclua cursos, projetos e tecnologias em aprendizado.", "Explique seu objetivo profissional em uma frase clara."]
    },
    {
      title: `${label} Remoto Júnior`,
      company: "Time remoto",
      location: "Remoto - Brasil",
      matchOffset: -9,
      reasons: skills.slice(0, 4),
      tips: ["Destaque comunicação, autonomia e entregas documentadas.", "Use palavras-chave da vaga no currículo atualizado."]
    },
    {
      title: `${label} em Produto Digital`,
      company: "SaaS B2B",
      location: "Híbrido ou remoto",
      matchOffset: -12,
      reasons: skills.slice(0, 4),
      tips: ["Conecte suas experiências a impacto em usuário, receita ou eficiência.", "Inclua métricas sempre que possível."]
    },
    {
      title: `Suporte técnico ${label}`,
      company: "Operação de tecnologia",
      location: "A combinar",
      matchOffset: -18,
      reasons: skills.slice(0, 3),
      tips: ["Mostre capacidade de resolver problemas e atender usuários.", "Liste ferramentas, sistemas e rotinas que você domina."]
    },
    {
      title: `Projetos ${label} Freelancer`,
      company: "Clientes e projetos",
      location: "Remoto",
      matchOffset: -16,
      reasons: skills.slice(0, 5),
      tips: ["Monte um portfólio com 2 ou 3 projetos objetivos.", "Descreva escopo, stack e resultado de cada entrega."]
    }
  ];

  return jobTemplates.slice(0, RECOMMENDED_JOBS_LIMIT).map((job) => {
    const matchReasons = uniqueStrings(job.reasons);

    return {
      title: job.title,
      company: job.company,
      location: job.location,
      match: clampScore(baseMatch + job.matchOffset),
      match_reasons: matchReasons.length ? matchReasons : [`Perfil com sinais de ${label}`],
      improvement_tips: job.tips,
      url: buildJobSearchUrl({
        title: job.title,
        area: label,
        skills,
        location: job.location
      })
    };
  });
}

function buildLocalAnalysis({
  resumeText,
  detectedArea,
  detectedSkills,
  missingKeywords,
  atsScore,
  profileContext = {},
  targetJobContext = {}
}) {
  const wordCount = normalizeWhitespace(resumeText).split(" ").filter(Boolean).length;
  const clarityScore = clampScore(60 + Math.min(25, Math.round(wordCount / 80)) - missingKeywords.length * 3);
  const baseMarketCompatibility = clampScore(62 + detectedSkills.length * 7 - missingKeywords.length * 4);
  const targetJobMatch = calculateTargetJobMatch(resumeText, targetJobContext);
  const marketCompatibility = targetJobContext.description
    ? clampScore(Math.round(baseMarketCompatibility * 0.45 + targetJobMatch.score * 0.55))
    : baseMarketCompatibility;
  const areaLabel = areaLabels[detectedArea] || detectedArea;
  const combinedMissingKeywords = uniqueStrings([
    ...targetJobMatch.missing,
    ...missingKeywords
  ]).slice(0, 12);
  const jobSpecificSuggestions = targetJobContext.description
    ? [
        `Adapte o resumo para a vaga${targetJobContext.title ? ` de ${targetJobContext.title}` : ""}, citando somente habilidades que aparecem na sua experiência real.`,
        targetJobMatch.missing.length
          ? `Reforce evidências reais para: ${targetJobMatch.missing.slice(0, 5).join(", ")}.`
          : "A vaga alvo já aparece bem coberta; refine exemplos, métricas e impacto."
      ]
    : [];

  return {
    summary: targetJobContext.description
      ? `Currículo analisado com foco em ${areaLabel} e na vaga alvo${targetJobContext.title ? ` de ${targetJobContext.title}` : ""}. O match estimado com a vaga é ${targetJobMatch.score}%.`
      : `Currículo analisado com foco em ${areaLabel}. Foram identificadas ${detectedSkills.length} competências aderentes e ${missingKeywords.length} palavra(s)-chave para evoluir.`,
    main_area: areaLabel,
    seniority: detectSeniority(resumeText),
    english_level: detectEnglishLevel(resumeText),
    ats_score: atsScore,
    clarity_score: clarityScore,
    market_compatibility: marketCompatibility,
    job_match_score: targetJobMatch.score,
    matched_keywords: targetJobMatch.matched,
    detected_skills: detectedSkills,
    missing_keywords: combinedMissingKeywords,
    weak_words: ["responsável por", "participação", "apoio"],
    strengths: [
      detectedSkills.length
        ? `Competências técnicas identificadas: ${detectedSkills.slice(0, 4).join(", ")}.`
        : "Estrutura inicial suficiente para uma análise de carreira.",
      "Currículo processado e salvo com sucesso."
    ],
    suggestions: [
      ...jobSpecificSuggestions,
      "Adicione resultados mensuráveis, como percentuais, volume de usuários, receita, tempo economizado ou indicadores de qualidade.",
      "Inclua palavras-chave ausentes que realmente façam parte da sua experiência.",
      "Use verbos de impacto no início dos bullets e reduza descrições genéricas."
    ],
    recommended_jobs: buildRecommendedJobs(detectedArea, detectedSkills, marketCompatibility, profileContext, targetJobContext)
  };
}

function parseAIJson(aiText) {
  const cleanText = String(aiText || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const start = cleanText.indexOf("{");
    const end = cleanText.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleanText.slice(start, end + 1));
    }

    throw new Error("Resposta da IA não veio em JSON válido.");
  }
}

async function analyzeWithAI({ resumeText, detectedArea, localAnalysis, profileContext = {}, targetJobContext = {} }) {
  try {
    const aiResponse = await createAIChatCompletion({
      messages: [
        {
          role: "system",
          content: `
Você é um recrutador brasileiro especialista em ATS, currículos e carreira em tecnologia.
Analise somente o conteúdo do currículo enviado. Não invente experiências, empresas, cursos ou certificações.
Responda em português do Brasil e retorne apenas JSON válido, sem markdown.

Regras:
- Use notas inteiras de 0 a 100.
- Use arrays curtos e objetivos, com até 8 itens quando possível.
- Em "weak_words", liste termos fracos, genéricos ou pouco mensuráveis encontrados ou muito prováveis no texto.
- Em "suggestions", escreva ações práticas para melhorar o currículo.
- Se houver vaga alvo, avalie aderência real à descrição e use "job_match_score" e "matched_keywords".
- Em "recommended_jobs", gere de 6 a 8 tipos de vagas realistas para o perfil. Use URLs de busca quando não houver vaga real específica.
- Use o perfil do usuário apenas para orientar objetivo, localização e match. Não trate dados do perfil como experiência comprovada no currículo.
`
        },
        {
          role: "system",
          content: `
Você é um recrutador brasileiro especialista em ATS, currículos e carreira em tecnologia.
Analise somente o conteúdo do currículo enviado e retorne apenas JSON válido, sem markdown.

Formato obrigatório:
{
  "summary": "",
  "main_area": "",
  "seniority": "",
  "english_level": "",
  "ats_score": 0,
  "clarity_score": 0,
  "market_compatibility": 0,
  "job_match_score": 0,
  "matched_keywords": [],
  "detected_skills": [],
  "missing_keywords": [],
  "weak_words": [],
  "strengths": [],
  "suggestions": [],
  "recommended_jobs": [
    {
      "title": "",
      "company": "",
      "location": "",
      "match": 0,
      "match_reasons": [],
      "improvement_tips": [],
      "url": ""
    }
  ]
}
`
        },
        {
          role: "user",
          content: `
Area detectada: ${detectedArea}
Analise local preliminar: ${JSON.stringify(localAnalysis)}
Perfil do usuário para orientar match e sugestões: ${JSON.stringify(profileContext)}
Vaga alvo opcional: ${JSON.stringify({
            titulo: targetJobContext.title || "",
            descricao: targetJobContext.description || "",
            palavras_chave_detectadas: targetJobContext.keywords || []
          })}

Currículo:
${resumeText.slice(0, MAX_RESUME_TEXT_CHARS)}
`
        }
      ],
      responseFormat: "json",
      temperature: 0.35,
      maxTokens: 1800,
      task: "resume-analysis"
    });

    return aiResponse?.content ? parseAIJson(aiResponse.content) : null;
  } catch (error) {
    console.warn("Falha ao gerar análise com IA externa. Usando fallback local:", error.message);
    return null;
  }
}

function normalizeRecommendedJobs(value, fallback) {
  const jobs = asArray(value, fallback);

  return jobs.slice(0, RECOMMENDED_JOBS_LIMIT).map((job, index) => {
    if (typeof job === "string") {
      const title = job;

      return {
        title,
        company: "Empresa não informada",
        location: "A combinar",
        match: clampScore(70 - index * 5),
        url: buildJobSearchUrl({
          title,
          area: fallback[index]?.title || "",
          skills: fallback[index]?.match_reasons || [],
          location: "A combinar"
        })
      };
    }

    const title = job.title || job.titulo || "Vaga recomendada";
    const company = job.company || job.empresa || "Empresa não informada";
    const location = job.location || job.localizacao || job["localização"] || job.remote || "A combinar";
    const matchReasons = uniqueStrings(job.match_reasons || job.reasons || job.motivos || fallback[index]?.match_reasons || []);
    const providedUrl = job.url || job.link || job.job_url || job.apply_url || fallback[index]?.url || "";

    return {
      title,
      company,
      location,
      match: clampScore(job.match_percentage ?? job.match ?? job.compatibility ?? fallback[index]?.match ?? 65),
      match_reasons: matchReasons,
      improvement_tips: uniqueStrings(job.improvement_tips || job.tips || job.sugestoes || fallback[index]?.improvement_tips || []),
      url: isHttpUrl(providedUrl)
        ? providedUrl
        : buildJobSearchUrl({
            title,
            area: company,
            skills: matchReasons,
            location
          })
    };
  });
}

function mergeAnalysis(aiAnalysis, localAnalysis) {
  const source = aiAnalysis || {};

  return {
    summary: source.summary || localAnalysis.summary,
    main_area: source.main_area || localAnalysis.main_area,
    seniority: source.seniority || localAnalysis.seniority,
    english_level: source.english_level || localAnalysis.english_level,
    ats_score: clampScore(source.ats_score ?? localAnalysis.ats_score),
    clarity_score: clampScore(source.clarity_score ?? localAnalysis.clarity_score),
    market_compatibility: clampScore(source.market_compatibility ?? localAnalysis.market_compatibility),
    job_match_score: clampScore(source.job_match_score ?? localAnalysis.job_match_score),
    matched_keywords: uniqueStrings(source.matched_keywords?.length ? source.matched_keywords : localAnalysis.matched_keywords),
    detected_skills: uniqueStrings(source.detected_skills?.length ? source.detected_skills : localAnalysis.detected_skills),
    missing_keywords: uniqueStrings(source.missing_keywords?.length ? source.missing_keywords : localAnalysis.missing_keywords),
    weak_words: uniqueStrings(source.weak_words?.length ? source.weak_words : localAnalysis.weak_words),
    strengths: uniqueStrings(source.strengths?.length ? source.strengths : localAnalysis.strengths),
    suggestions: uniqueStrings(source.suggestions?.length ? source.suggestions : localAnalysis.suggestions),
    recommended_jobs: normalizeRecommendedJobs(
      source.recommended_jobs?.length ? source.recommended_jobs : localAnalysis.recommended_jobs,
      localAnalysis.recommended_jobs
    )
  };
}

function buildFallbackImprovedResume({ analysis = {}, profile = {}, sourceText = "" } = {}) {
  const parsedData = analysis.parsed_data || {};
  const name = profile.name || parsedData.email?.split("@")[0] || "Nome Sobrenome";
  const email = parsedData.email || profile.email || "";
  const phone = parsedData.phone || profile.phone || "";
  const location = profile.location || "";
  const headline = profile.headline || profile.targetRole || analysis.target_job_title || analysis.main_area || "Profissional de tecnologia";
  const summaryParts = uniqueStrings([
    profile.summary,
    analysis.summary,
    analysis.main_area ? `Atuação principal em ${analysis.main_area}.` : "",
    analysis.seniority ? `Nível identificado: ${analysis.seniority}.` : ""
  ]).slice(0, 3);
  const skills = uniqueStrings([
    ...(analysis.detected_skills || []),
    ...(analysis.matched_keywords || [])
  ]).slice(0, 18);
  const suggestions = uniqueStrings(analysis.suggestions || []).slice(0, 6);
  const sourceLines = normalizeWhitespace(sourceText)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 35)
    .slice(0, 5);
  const experienceBullets = sourceLines.length
    ? sourceLines.map((line) => `- ${line}`)
    : suggestions.map((suggestion) => `- ${suggestion}`);

  return `# ${name}

${[headline, location, email, phone].filter(Boolean).join(" | ")}

## Resumo profissional
${summaryParts.length ? summaryParts.join(" ") : "Profissional com experiência registrada no currículo analisado. Revise este resumo e inclua resultados comprováveis antes de enviar."}

## Competências
${skills.length ? skills.map((skill) => `- ${skill}`).join("\n") : "- Liste aqui suas principais competências técnicas e comportamentais."}

## Experiência profissional
${experienceBullets.length ? experienceBullets.join("\n") : "- Descreva suas experiências com verbo de ação, contexto, tecnologia utilizada e resultado mensurável."}

## Ajustes recomendados antes de enviar
${suggestions.length ? suggestions.map((suggestion) => `- ${suggestion}`).join("\n") : "- Adicione métricas reais, palavras-chave da vaga e resultados concretos."}

## Observações
- Revise datas, empresas, cargos e métricas antes de usar esta versão.
- Substitua qualquer trecho genérico por evidências reais da sua trajetória.`;
}

async function generateImprovedResumeDraft({ analysis, profile, sourceText }) {
  const sourceAvailable = Boolean(normalizeWhitespace(sourceText));
  const fallback = buildFallbackImprovedResume({ analysis, profile, sourceText });

  if (!sourceAvailable) {
    return {
      content: fallback,
      source_available: false,
      generated_by: "fallback"
    };
  }

  try {
    const aiResponse = await createAIChatCompletion({
      messages: [
        {
          role: "system",
          content: `
Você é um especialista brasileiro em currículos ATS.
Reescreva o currículo em português do Brasil em Markdown limpo, pronto para revisão e download.
Use apenas fatos presentes no currículo original, no relatório da análise e no perfil do usuário.
Não invente empresas, cargos, datas, cursos, certificações, números, ferramentas ou resultados.
Melhore clareza, estrutura, verbos de ação, palavras-chave e objetividade.
Quando faltar dado real importante, escreva um marcador entre colchetes, por exemplo: [adicione uma métrica real].
Retorne somente o currículo em Markdown, sem comentários antes ou depois.
`
        },
        {
          role: "user",
          content: `
Perfil do usuário:
${JSON.stringify(profile || {})}

Relatório da análise:
${JSON.stringify({
            file_name: analysis.file_name,
            target_job_title: analysis.target_job_title,
            summary: analysis.summary,
            main_area: analysis.main_area,
            seniority: analysis.seniority,
            english_level: analysis.english_level,
            detected_skills: analysis.detected_skills,
            missing_keywords: analysis.missing_keywords,
            weak_words: analysis.weak_words,
            strengths: analysis.strengths,
            suggestions: analysis.suggestions,
            matched_keywords: analysis.matched_keywords
          })}

Currículo original extraído:
${sourceText.slice(0, IMPROVED_RESUME_MAX_SOURCE_CHARS)}
`
        }
      ],
      temperature: 0.25,
      maxTokens: 2200,
      task: "improved-resume"
    });
    const content = String(aiResponse?.content || "").trim();

    if (!content) {
      throw new Error("A IA não retornou conteúdo.");
    }

    return {
      content,
      source_available: true,
      generated_by: "ai"
    };
  } catch (error) {
    console.warn("Falha ao gerar currículo melhorado com IA. Usando fallback:", error.message);

    return {
      content: fallback,
      source_available: true,
      generated_by: "fallback"
    };
  }
}

export async function analyzeResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo enviado"
      });
    }

    const filePath = req.file.path;
    const accountEmail = normalizeEmail(req.user?.email);
    const accountPlan = getUserSubscription(req.user.id).plan;

    if (!accountEmail) {
      removeUploadedFile(filePath);

      return res.status(401).json({
        success: false,
        error: "Entre na sua conta para analisar o currículo."
      });
    }

    if (!isPremiumPlan(accountPlan)) {
      const usage = getMonthlyAnalysisUsage(accountEmail);

      if (usage.used >= usage.limit) {
        removeUploadedFile(filePath);

        return res.status(403).json({
          success: false,
          code: "FREE_MONTHLY_LIMIT_REACHED",
          error: "Limite mensal do plano gratuito atingido",
          usage
        });
      }
    }

    const extractedText = await extractTextFromUploadedFile(req.file);
    const resumeText = normalizeWhitespace(extractedText);

    if (resumeText.length < 20) {
      removeUploadedFile(filePath);

      return res.status(422).json({
        success: false,
        error: "Não foi possível extrair texto suficiente do currículo. Envie um PDF/DOCX com texto selecionável."
      });
    }

    const detectedArea = detectArea(resumeText);
    const selectedKeywords = keywordsByArea[detectedArea] || [];
    const searchableText = normalizeSearchText(resumeText);
    const detectedSkills = selectedKeywords.filter((keyword) =>
      searchableText.includes(normalizeSearchText(keyword))
    );
    const missingKeywords = selectedKeywords.filter((keyword) =>
      !searchableText.includes(normalizeSearchText(keyword))
    );
    const atsScore = Math.max(100 - missingKeywords.length * 10, 35);
    const { email, phone } = extractContactInfo(resumeText);
    const profileContext = buildProfileContext(getUserProfile(req.user.id, req.user));
    const targetJobContext = buildTargetJobContext(req.body);
    const localAnalysis = buildLocalAnalysis({
      resumeText,
      detectedArea,
      detectedSkills,
      missingKeywords,
      atsScore,
      profileContext,
      targetJobContext
    });
    const aiAnalysis = await analyzeWithAI({
      resumeText,
      detectedArea,
      localAnalysis,
      profileContext,
      targetJobContext
    });
    const parsedAnalysis = mergeAnalysis(aiAnalysis, localAnalysis);

    const analysisData = {
      fileName: req.file.originalname || "Currículo enviado",
      filePath: null,
      fileUrl: null,
      accountEmail,
      email,
      phone,
      area: detectedArea,
      targetJobTitle: targetJobContext.title,
      targetJobDescription: targetJobContext.description,
      jobMatchScore: parsedAnalysis.job_match_score,
      matchedKeywords: parsedAnalysis.matched_keywords,
      resumeText,
      summary: parsedAnalysis.summary,
      mainArea: parsedAnalysis.main_area,
      seniority: parsedAnalysis.seniority,
      englishLevel: parsedAnalysis.english_level,
      atsScore: parsedAnalysis.ats_score,
      clarityScore: parsedAnalysis.clarity_score,
      marketCompatibility: parsedAnalysis.market_compatibility,
      detectedSkills: parsedAnalysis.detected_skills,
      missingKeywords: parsedAnalysis.missing_keywords,
      weakWords: parsedAnalysis.weak_words,
      strengths: parsedAnalysis.strengths,
      suggestions: parsedAnalysis.suggestions,
      recommendedJobs: parsedAnalysis.recommended_jobs,
      status: "completed"
    };

    const savedAnalysis = createResumeAnalysis(analysisData);
    const jobNotification = createJobNotificationForAnalysis(savedAnalysis);
    removeUploadedFile(filePath);

    return res.json({
      success: true,
      analysis: savedAnalysis,
      notification: jobNotification
    });
  } catch (error) {
    removeUploadedFile(req.file?.path);
    console.log(error);

    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Erro ao analisar currículo"
    });
  }
}

export async function listAnalyses(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const accountEmail = normalizeEmail(req.user?.email);

    const analyses = listResumeAnalysesByAccountEmail(accountEmail, limit);

    return res.json({
      success: true,
      analyses
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getAnalysis(req, res) {
  try {
    const analysis = getResumeAnalysisById(req.params.id);
    const accountEmail = normalizeEmail(req.user?.email);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Análise não encontrada"
      });
    }

    if (analysis.account_email !== accountEmail) {
      return res.status(403).json({
        success: false,
        error: "Você não tem acesso a esta análise"
      });
    }

    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function generateImprovedResume(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const source = getResumeAnalysisSourceForAccount(req.params.id, accountEmail);

    if (source === null) {
      return res.status(404).json({
        success: false,
        error: "Análise não encontrada"
      });
    }

    if (source === false) {
      return res.status(403).json({
        success: false,
        error: "Você não tem acesso a esta análise"
      });
    }

    const profile = getUserProfile(req.user.id, req.user);
    const improvedResume = await generateImprovedResumeDraft({
      analysis: source.analysis,
      profile,
      sourceText: source.resume_text
    });

    return res.json({
      success: true,
      improved_resume: {
        analysis_id: source.analysis.id,
        file_name: source.analysis.file_name,
        ...improvedResume
      }
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message || "Não foi possível gerar o currículo melhorado"
    });
  }
}

export async function deleteAnalysis(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const deleted = deleteResumeAnalysisForAccount(req.params.id, accountEmail);

    if (deleted === null) {
      return res.status(404).json({
        success: false,
        error: "Análise não encontrada"
      });
    }

    if (deleted === false) {
      return res.status(403).json({
        success: false,
        error: "Você não tem acesso a esta análise"
      });
    }

    removeUploadedFile(deleted.filePath);

    return res.json({
      success: true,
      deleted_analysis: deleted.analysis
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getAnalysisTasks(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const tasks = getAnalysisTasksForAccount(req.params.id, accountEmail);

    if (tasks === null) {
      return res.status(404).json({
        success: false,
        error: "Análise não encontrada"
      });
    }

    if (tasks === false) {
      return res.status(403).json({
        success: false,
        error: "Você não tem acesso a esta análise"
      });
    }

    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updateAnalysisTasks(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const tasks = upsertAnalysisTasksForAccount(req.params.id, accountEmail, req.body.checked || {});

    if (tasks === null) {
      return res.status(404).json({
        success: false,
        error: "Análise não encontrada"
      });
    }

    if (tasks === false) {
      return res.status(403).json({
        success: false,
        error: "Você não tem acesso a esta análise"
      });
    }

    return res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getAnalysisUsage(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const accountPlan = getUserSubscription(req.user.id).plan;
    const usage = getMonthlyAnalysisUsage(accountEmail);
    const premium = isPremiumPlan(accountPlan);

    return res.json({
      success: true,
      premium,
      usage: {
        ...usage,
        limit: premium ? null : usage.limit,
        remaining: premium ? null : usage.remaining
      }
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
