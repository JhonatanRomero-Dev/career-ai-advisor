import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createAIChatCompletion } from "../src/aiClient.js";
import {
  getUserProfile,
  getUserSubscription,
  listResumeAnalysesByAccountEmail
} from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MAX_HISTORY = 8;

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function cleanText(value = "") {
  return String(value).trim().slice(0, 4000);
}

function buildAnalysisContext(analysis) {
  if (!analysis) {
    return "Nenhuma análise de currículo foi enviada no contexto.";
  }

  return JSON.stringify({
    arquivo: analysis.file_name,
    area: analysis.main_area || analysis.area,
    senioridade: analysis.seniority,
    nota_ats: analysis.ats_score,
    clareza: analysis.clarity_score,
    compatibilidade_mercado: analysis.market_compatibility,
    vaga_alvo: analysis.target_job_title || "",
    match_vaga_alvo: analysis.job_match_score || 0,
    palavras_chave_encontradas_na_vaga: analysis.matched_keywords || [],
    palavras_chave_faltando: analysis.missing_keywords || [],
    pontos_fortes: analysis.strengths || [],
    sugestoes: analysis.suggestions || [],
    vagas_recomendadas: analysis.recommended_jobs || []
  });
}

function buildProfileContext(profile = {}, subscription = {}) {
  return JSON.stringify({
    nome: profile.name || "",
    email: profile.email || "",
    cargo_desejado: profile.targetRole || "",
    nivel_experiencia: profile.experienceLevel || "",
    localizacao: profile.location || "",
    titulo: profile.headline || "",
    resumo: profile.summary || "",
    plano: subscription.plan || "Gratis",
    status_assinatura: subscription.status || "active"
  });
}

function buildLocalSupportReply(message, latestAnalysis, profile) {
  const normalizedMessage = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedMessage.includes("codigo") || normalizedMessage.includes("email")) {
    return "O código de verificação expira em 10 minutos. Confira a caixa de entrada, spam e se o e-mail foi digitado corretamente. Se ainda não chegar, tente reenviar o código pela tela de login.";
  }

  if (normalizedMessage.includes("ats") || normalizedMessage.includes("nota")) {
    if (!latestAnalysis) {
      return "Ainda não encontrei uma análise recente na sua conta. Envie um currículo para eu explicar sua nota ATS com contexto real.";
    }

    return `Sua nota ATS mais recente é ${latestAnalysis.ats_score || 0}. Priorize palavras-chave ausentes (${(latestAnalysis.missing_keywords || []).slice(0, 5).join(", ") || "nenhuma listada"}) e reescreva trechos genéricos com resultados mensuráveis.`;
  }

  if (normalizedMessage.includes("vaga") || normalizedMessage.includes("emprego")) {
    if (!latestAnalysis?.recommended_jobs?.length) {
      return "As vagas ficam melhores depois de uma análise concluída e um perfil preenchido. Complete cargo desejado, nível, localização e envie seu currículo para gerar recomendações mais fortes.";
    }

    const jobs = latestAnalysis.recommended_jobs
      .slice(0, 3)
      .map((job) => job.title)
      .join(", ");

    return `Com base na sua análise, comece olhando vagas como: ${jobs}. Abra a tela de Vagas para ver match, motivos e dicas de melhoria.`;
  }

  if (normalizedMessage.includes("perfil")) {
    const missing = [
      ["cargo desejado", profile?.targetRole],
      ["nível de experiência", profile?.experienceLevel],
      ["localização", profile?.location],
      ["resumo profissional", profile?.summary]
    ]
      .filter(([, value]) => !String(value || "").trim())
      .map(([label]) => label);

    return missing.length
      ? `Para melhorar suas análises, complete estes campos do perfil: ${missing.join(", ")}.`
      : "Seu perfil já tem os campos principais. Mantenha cargo alvo, resumo e links atualizados para melhorar recomendações.";
  }

  return "Posso ajudar com login, código de verificação, interpretação da análise, melhoria de currículo e vagas compatíveis. Se for problema de conta, pagamento, privacidade ou erro persistente, o ideal é acionar suporte humano.";
}

export async function chatWithSupport(req, res) {
  try {
    const message = cleanText(req.body.message);
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const accountEmail = normalizeEmail(req.user?.email);
    const [latestAnalysis] = listResumeAnalysesByAccountEmail(accountEmail, 1);
    const analysisContext = buildAnalysisContext(latestAnalysis);
    const profile = getUserProfile(req.user.id, req.user);
    const subscription = getUserSubscription(req.user.id);
    const profileContext = buildProfileContext(profile, subscription);

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Digite uma mensagem para o suporte"
      });
    }

    const messages = [
      {
        role: "system",
        content: `
Você e o assistente de suporte do Career AI Advisor.

Responda em português do Brasil, com clareza, educação e objetividade.
Ajude o usuário a:
- entender a plataforma;
- resolver dúvidas de login, código de verificação e uso do painel;
- interpretar notas ATS, clareza, palavras-chave e sugestões;
- transformar sugestões em próximos passos práticos.

Regras:
- Não invente dados que não estejam no contexto.
- Se for problema de conta, pagamento, privacidade, exclusão de dados ou erro persistente, oriente abrir suporte humano.
- Não prometa vagas, contratação ou resultados garantidos.
- Para currículo, use o contexto da análise quando existir.
`
      },
      {
        role: "system",
        content: `Contexto da análise atual: ${analysisContext}`
      },
      {
        role: "system",
        content: `Contexto do perfil e plano: ${profileContext}`
      },
      ...history.slice(-MAX_HISTORY).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: cleanText(item.content)
      })),
      {
        role: "user",
        content: message
      }
    ];

    const aiResponse = await createAIChatCompletion({
      messages,
      temperature: 0.5,
      maxTokens: 700,
      task: "support-chat"
    });

    if (!aiResponse?.content) {
      return res.json({
        success: true,
        fallback: true,
        reply: buildLocalSupportReply(message, latestAnalysis, profile)
      });
    }

    return res.json({
      success: true,
      fallback: false,
      provider: aiResponse.provider,
      model: aiResponse.model,
      reply: aiResponse.content || "Não consegui gerar uma resposta agora."
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: "Não foi possível responder agora. Tente novamente em instantes."
    });
  }
}
