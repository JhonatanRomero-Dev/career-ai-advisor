import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import Groq from "groq-sdk";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createResumeAnalysis,
  getResumeAnalysisById,
  listResumeAnalyses
} from "../src/db.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// EXTRAIR TEXTO REAL DO PDF
async function extractTextFromPDF(filePath) {

  const data = new Uint8Array(
    fs.readFileSync(filePath)
  );

  const pdf = await pdfjsLib
    .getDocument({ data }).promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);

    const content = await page.getTextContent();

    const strings = content.items.map(
      item => item.str
    );

    text += strings.join(" ");
  }

  return text;
}

// DETECTAR ÁREA PRINCIPAL
function detectArea(resumeText) {

  const frontendKeywords = [
    "react",
    "html",
    "css",
    "javascript",
    "typescript",
    "next"
  ];

  const backendKeywords = [
    "node",
    "api",
    "sql",
    "mongodb",
    "express",
    "mysql",
    "postgresql"
  ];

  const dataKeywords = [
    "python",
    "pandas",
    "numpy",
    "machine learning",
    "ia"
  ];

  const devopsKeywords = [
    "docker",
    "aws",
    "linux",
    "kubernetes"
  ];

  const countMatches = (keywords) => {

    return keywords.filter(
      keyword => resumeText.includes(keyword)
    ).length;
  };

  const scores = {

    frontend: countMatches(frontendKeywords),

    backend: countMatches(backendKeywords),

    data: countMatches(dataKeywords),

    devops: countMatches(devopsKeywords)
  };

  const area = Object.keys(scores).reduce(
    (a, b) => scores[a] > scores[b] ? a : b
  );

  return area;
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

    // EXTRAIR TEXTO
    const resumeText = (
      await extractTextFromPDF(filePath)
    ).toLowerCase();

    console.log("======= CURRÍCULO =======");
    console.log(resumeText);

    // DETECTAR ÁREA
    const detectedArea = detectArea(resumeText);

    // KEYWORDS POR ÁREA
    const keywordsByArea = {

      frontend: [
        "react",
        "html",
        "css",
        "javascript",
        "typescript",
        "next"
      ],

      backend: [
        "node",
        "express",
        "sql",
        "mongodb",
        "api",
        "mysql"
      ],

      data: [
        "python",
        "pandas",
        "numpy",
        "machine learning",
        "sql"
      ],

      devops: [
        "docker",
        "linux",
        "aws",
        "kubernetes"
      ]
    };

    const selectedKeywords =
      keywordsByArea[detectedArea] || [];

    // SKILLS DETECTADAS
    const detectedSkills = selectedKeywords.filter(
      keyword => resumeText.includes(keyword)
    );

    // KEYWORDS FALTANDO
    const missingKeywords = selectedKeywords.filter(
      keyword => !resumeText.includes(keyword)
    );

    // ATS SCORE DINAMICO
    const atsScore = Math.max(
      100 - (missingKeywords.length * 10),
      35
    );

    // EXTRAIR EMAIL
    const emailMatch = resumeText.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    );

    const email = emailMatch
      ? emailMatch[0]
      : null;

    // EXTRAIR TELEFONE
    const phoneMatch = resumeText.match(
      /\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}/
    );

    const phone = phoneMatch
      ? phoneMatch[0]
      : null;

    // IA GROQ
    const completion =
      await groq.chat.completions.create({

      messages: [

        {
          role: "system",

          content: `
Você é um recrutador brasileiro especialista em:

- ATS
- RH tech
- contratação em TI
- currículos profissionais
- análise de carreira

Sua tarefa é fazer análises PROFUNDAMENTE PERSONALIZADAS.

IMPORTANTE:

- NUNCA gere respostas genéricas
- NUNCA repita respostas
- Analise SOMENTE informações do currículo
- Detecte diferenças reais entre candidatos
- Os scores DEVEM variar
- As sugestões DEVEM variar
- As vagas DEVEM variar

Você deve analisar:

- senioridade
- clareza textual
- impacto profissional
- competitividade
- tecnologias
- experiência
- pontos fortes
- pontos fracos
- palavras fracas
- organização do currículo
- compatibilidade ATS

Retorne SOMENTE JSON válido.

Formato:

{
  "summary": "",
  "main_area": "",
  "seniority": "",
  "english_level": "",
  "ats_score": 0,
  "clarity_score": 0,
  "market_compatibility": 0,
  "detected_skills": [],
  "missing_keywords": [],
  "weak_words": [],
  "strengths": [],
  "suggestions": [],
  "recommended_jobs": [
    {
      "title": "",
      "company": "",
      "match": 0
    }
  ]
}
`
        },

        {
          role: "user",

          content: `
Analise profundamente este currículo.

ÁREA DETECTADA:
${detectedArea}

CURRÍCULO:
${resumeText}

IMPORTANTE:
- A análise deve ser única
- Não gere respostas genéricas
- Use o conteúdo real do currículo
`
        }
      ],

      model: "llama-3.3-70b-versatile",

      temperature: 1.2
    });

    const aiText =
      completion.choices[0].message.content;

    console.log("======= IA =======");
    console.log(aiText);

    let parsedAI = {};

    try {

      parsedAI = JSON.parse(aiText);

    } catch {

      parsedAI = {

        summary:
          "Currículo analisado com sucesso.",

        main_area:
          detectedArea,

        seniority:
          "Junior",

        english_level:
          "Básico",

        ats_score:
          atsScore,

        clarity_score:
          70,

        market_compatibility:
          75,

        detected_skills:
          detectedSkills,

        missing_keywords:
          missingKeywords,

        weak_words: [],

        strengths: [
          "Boa organização",
          "Base técnica consistente"
        ],

        suggestions: [
          "Adicionar projetos reais",
          "Adicionar métricas",
          "Melhorar descrição profissional"
        ],

        recommended_jobs: [
          {
            title: "Desenvolvedor Junior",
            company: "Startup",
            match: 80
          }
        ]
      };
    }

    const analysisData = {
      fileName: req.file.originalname || "Curriculo enviado",
      filePath,
      fileUrl: filePath,
      email,
      phone,
      area: detectedArea,
      summary: parsedAI.summary || "",
      mainArea: parsedAI.main_area || detectedArea,
      seniority: parsedAI.seniority || "",
      englishLevel: parsedAI.english_level || "",
      atsScore: Number(parsedAI.ats_score || atsScore),
      clarityScore: Number(parsedAI.clarity_score || 0),
      marketCompatibility: Number(parsedAI.market_compatibility || 0),
      detectedSkills: parsedAI.detected_skills || detectedSkills,
      missingKeywords: parsedAI.missing_keywords || missingKeywords,
      weakWords: parsedAI.weak_words || [],
      strengths: parsedAI.strengths || [],
      suggestions: parsedAI.suggestions || [],
      recommendedJobs: parsedAI.recommended_jobs || [],
      status: "completed"
    };

    const savedAnalysis = createResumeAnalysis(analysisData);

    return res.json({

      success: true,

      analysis: savedAnalysis
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      error: error.message
    });
  }
}

export async function listAnalyses(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);

    const analyses = listResumeAnalyses(limit);

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

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Analise nao encontrada"
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
