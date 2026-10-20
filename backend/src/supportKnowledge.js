export const SUPPORT_KNOWLEDGE = [
  { id: "login", title: "Login e recuperação", path: "/login", text: "O login aceita e-mail e senha com código de verificação. O código expira em 10 minutos. Confira spam, endereço e reenvio. Em Esqueci minha senha, solicite um código de recuperação. Google, LinkedIn e GitHub dependem da disponibilidade na tela de login." },
  { id: "jobs", title: "Busca e filtros de vagas", path: "/jobs", text: "Envie um currículo para receber recomendações. Em Vagas, combine palavra-chave, localização, área, nível, empresa, modalidade, contrato, salário e data. Salve pesquisas, retome buscas recentes e acompanhe candidaturas em Minha jornada. O filtro salarial considera valores em BRL com período informado; valores anuais são divididos por 12. Links de pesquisa abrem resultados externos e não representam vagas verificadas." },
  { id: "profile", title: "Perfil profissional", path: "/profile", text: "No Perfil, preencha título, cargo desejado, localização, resumo, habilidades, experiências, projetos, certificados e conquistas. Clique em Salvar perfil. A publicação é opcional: ative Disponibilizar perfil público e salve. O link público não exibe e-mail nem telefone." },
  { id: "analysis", title: "Currículo e análise", path: "/upload", text: "Envie PDF ou DOCX em Enviar currículo. A análise oferece nota ATS, clareza, competências e sugestões. Descreva experiências com ação, contexto e resultados verdadeiros; não invente habilidades ou métricas. A nota é uma estimativa e não garante contratação. Compare versões no Histórico." },
  { id: "privacy", title: "Conta e privacidade", path: "/profile", text: "O Perfil permite exportar dados, apagar textos de currículos, análises ou excluir a conta. Para problemas que não conseguir resolver, registre um relato em Feedback, categoria Atendimento / suporte. Não compartilhe senhas ou códigos no chat." },
  { id: "feedback", title: "Feedback e atendimento", path: "/feedback", text: "Em Feedback, envie uma avaliação e descreva a dificuldade, tarefa e resultado esperado. O relato fica salvo para revisão pela equipe e o andamento aparece em Seus feedbacks. A participação em testes é voluntária. Não há prazo de atendimento prometido." },
];
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function relevantKnowledge(message) {
  const text = normalize(message);
  const ids = new Set();
  if (/login|senha|codigo|e-mail|email|entrar/.test(text)) ids.add("login");
  if (/vaga|emprego|filtro|salario|busca/.test(text)) ids.add("jobs");
  if (/perfil|certific|projeto|habilidade/.test(text)) ids.add("profile");
  if (/curriculo|ats|nota|analise|prioridad|plano|dias/.test(text)) ids.add("analysis");
  if (/privacidade|exclu|apagar|exportar|pagamento|cobranca|assinatura/.test(text)) { ids.add("privacy"); ids.add("feedback"); }
  if (/erro|humano|feedback|problema|reclam/.test(text)) ids.add("feedback");
  return SUPPORT_KNOWLEDGE.filter((item) => ids.has(item.id));
}

export function localSupportReply(message, analysis, profile = {}) {
  const text = normalize(message);
  const articles = relevantKnowledge(message);
  if (/curriculo|prioridad|plano|7 dias/.test(text)) {
    const suggestions = (analysis?.suggestions || []).slice(0, 3).map((item) => typeof item === "string" ? item : item.description || item.title || item.suggestion).filter(Boolean);
    const priorities = suggestions.length ? suggestions : ["Ajuste o resumo ao cargo desejado, usando apenas experiências reais.", "Descreva suas entregas com verbos de ação e resultados que você possa comprovar.", "Revise formatação, contatos e palavras-chave relevantes à vaga."];
    const intro = analysis ? "Com base na sua análise mais recente, comece por estes pontos:" : "Enquanto você ainda não tem uma análise concluída, pode começar assim:";
    return `${intro}\n\n${priorities.map((item, i) => `${i + 1}. ${item}`).join("\n")}${/plano|dias/.test(text) ? "\n\nDias 1–2: resumo e objetivo. Dias 3–4: experiências e resultados. Dias 5–6: revisão das competências e formatação. Dia 7: envie a nova versão e compare a análise." : ""}\n\nAbra Enviar currículo para analisar uma nova versão.`;
  }
  if (/ats|nota/.test(text)) return analysis ? `Sua nota ATS mais recente é ${analysis.ats_score ?? 0}/100. É uma estimativa da clareza e adequação do currículo. Revise as palavras-chave sugeridas: ${(analysis.missing_keywords || []).slice(0, 5).join(", ") || "nenhuma palavra-chave ausente foi listada"}. Inclua somente competências que você possui e confira as sugestões do relatório.` : "Ainda não encontrei uma análise concluída na sua conta. Envie seu currículo para receber uma nota ATS e sugestões com base no seu documento.";
  if (/perfil/.test(text)) {
    const missing = [["cargo desejado", profile.targetRole], ["localização", profile.location], ["resumo", profile.summary], ["habilidades", profile.skills?.length]].filter(([, value]) => !value).map(([label]) => label);
    return `${missing.length ? `Comece preenchendo ${missing.join(", ")}.` : "Seu perfil já tem as informações principais."} Acrescente experiências, projetos e certificados na seção Sua trajetória profissional e salve as alterações. Você também pode visualizar a apresentação antes de disponibilizar o link público.`;
  }
  if (articles.length) return articles.map((article) => article.text).join("\n\n");
  return "Posso ajudar com currículo, vagas, perfil, login e uso da plataforma. Conte qual tarefa você está tentando concluir e onde encontrou dificuldade. Para atendimento da equipe, abra Feedback e escolha Atendimento / suporte.";
}
