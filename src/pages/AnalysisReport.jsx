import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowLeft,
  Upload,
  Briefcase,
  FileText,
  Loader2,
  ListChecks,
  Download,
  Trash2,
  Target,
  Wand2,
  Copy,
  CheckCircle2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import ScoreGauge from "@/components/dashboard/ScoreGauge";
import WeakWordsList from "@/components/analysis/WeakWordsList";
import MissingKeywords from "@/components/analysis/MissingKeywords";
import ImprovementTasks from "@/components/dashboard/ImprovementTasks";
import JobCard from "@/components/dashboard/JobCard";
import { readAuthSession } from "@/lib/authSession";
import { clearLastAnalysisId, readLastAnalysisId } from "@/lib/analysisCache";

const scoreGuide = [
  ["Nota ATS: leitura por filtros", "Indica se sistemas usados antes da triagem humana conseguem ler e classificar seu currículo. Não prevê contratação nem garante entrevista."],
  ["Clareza: impacto do texto", "Mostra quão rápido uma pessoa entende suas experiências e resultados. Verbos de ação e números reais ajudam a elevar esta nota."],
  ["Compatibilidade: proximidade às vagas", "Compara seu perfil com habilidades buscadas em vagas semelhantes. Quando há vaga alvo, o match específico aparece logo abaixo."],
];

function buildPriorityActions(analysis = {}) {
  const actions = [];
  const missingKeywords = analysis.missing_keywords || [];
  const weakWords = analysis.weak_words || [];

  if ((analysis.ats_score || 0) < 80) {
    actions.push({
      title: "Aumentar leitura ATS",
      impact: "Alto impacto",
      text: "Padronize seções, use cargos claros e inclua termos técnicos presentes nas vagas alvo."
    });
  }

  if (missingKeywords.length > 0) {
    actions.push({
      title: "Inserir palavras-chave reais",
      impact: "Alto impacto",
      text: `Priorize ${missingKeywords.slice(0, 4).join(", ")} nas experiências onde você realmente usou essas habilidades.`
    });
  }

  if (weakWords.length > 0) {
    actions.push({
      title: "Trocar termos genéricos",
      impact: "Médio impacto",
      text: `Revise termos como ${weakWords.slice(0, 3).join(", ")} e substitua por verbos de ação com resultado.`
    });
  }

  if ((analysis.clarity_score || 0) < 85) {
    actions.push({
      title: "Adicionar métricas",
      impact: "Médio impacto",
      text: "Inclua números, prazos, volume de usuários, redução de erros ou ganho de eficiência nos bullets."
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: "Refinar por vaga",
      impact: "Próximo passo",
      text: "Use o relatório como base e adapte o resumo e as palavras-chave para cada candidatura importante."
    });
  }

  return actions.slice(0, 4);
}

function buildRewriteExamples(evidence = []) {
  return evidence.map((item) => ({ before: item.excerpt, after: item.suggestion }));
}

function scoreBand(score = 0) {
  if (score >= 85) return "Forte";
  if (score >= 70) return "Bom, com ajustes";
  if (score >= 50) return "Atenção";
  return "Prioritário";
}

function buildScoreExplanations(analysis = {}) {
  const missingCount = analysis.missing_keywords?.length || 0;
  const weakCount = analysis.weak_words?.length || 0;
  const suggestionCount = analysis.suggestions?.length || 0;
  const matchedCount = analysis.matched_keywords?.length || 0;

  return [
    {
      title: "Nota ATS",
      score: analysis.ats_score || 0,
      reason: missingCount > 0
        ? `${missingCount} palavra(s)-chave importante(s) ainda não aparecem com clareza no currículo.`
        : "A estrutura e os termos principais já estão razoavelmente legíveis para filtros automáticos.",
      next: missingCount > 0
        ? "Inclua termos reais nas experiências onde você aplicou essas habilidades."
        : "Mantenha títulos de seção simples e evite layouts muito complexos."
    },
    {
      title: "Clareza",
      score: analysis.clarity_score || 0,
      reason: weakCount > 0
        ? `${weakCount} termo(s) genérico(s) podem reduzir a força dos bullets.`
        : "O texto já comunica melhor responsabilidades, habilidades e impacto.",
      next: "Troque descrições vagas por verbo de ação, contexto e resultado mensurável."
    },
    {
      title: "Compatibilidade",
      score: analysis.market_compatibility || 0,
      reason: matchedCount > 0
        ? `${matchedCount} termo(s) de vaga alvo foram encontrados no currículo.`
        : suggestionCount > 0
          ? "As sugestões indicam lacunas de posicionamento para vagas semelhantes."
          : "A compatibilidade está baseada no perfil detectado e nas habilidades presentes.",
      next: analysis.target_job_title
        ? "Ajuste o resumo e os bullets para refletir a vaga alvo sem inventar experiência."
        : "Cole uma vaga alvo no próximo upload para receber um match mais específico."
    }
  ];
}

function buildReviewPlan(analysis = {}) {
  const missing = analysis.missing_keywords || [];
  const weak = analysis.weak_words || [];

  return [
    {
      title: "10 minutos",
      text: missing.length
        ? `Revise onde incluir ${missing.slice(0, 3).join(", ")} com exemplos reais.`
        : "Revise títulos de seção, cargo alvo e resumo profissional."
    },
    {
      title: "30 minutos",
      text: weak.length
        ? `Reescreva bullets com termos fracos como ${weak.slice(0, 2).join(", ")}.`
        : "Adicione números, escopo, ferramentas e resultados aos principais bullets."
    },
    {
      title: "Próximo envio",
      text: "Envie a versão revisada e compare evolução de ATS, clareza e compatibilidade no histórico."
    }
  ];
}

async function exportAnalysisAsPdf(analysis, priorityActions) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 16;
  const maxWidth = 178;
  let y = 18;

  const addText = (text, size = 11, gap = 7) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text || ""), maxWidth);

    if (y + lines.length * gap > 282) {
      doc.addPage();
      y = 18;
    }

    doc.text(lines, margin, y);
    y += lines.length * gap;
  };

  doc.setFont("helvetica", "bold");
  addText("Career AI Advisor - Relatório de análise", 16, 8);
  doc.setFont("helvetica", "normal");
  addText(`Arquivo: ${analysis.file_name || "Currículo"}`);
  addText(`ATS: ${analysis.ats_score || 0} | Clareza: ${analysis.clarity_score || 0} | Compatibilidade: ${analysis.market_compatibility || 0}%`);
  addText(`Resumo: ${analysis.summary || "Sem resumo disponível."}`);

  if (analysis.target_job_title || analysis.target_job_description) {
    addText(`Vaga alvo: ${analysis.target_job_title || "Não informada"}`);
    addText(`Match com a vaga: ${analysis.job_match_score || 0}%`);
    addText(`Palavras-chave encontradas: ${(analysis.matched_keywords || []).slice(0, 12).join(", ") || "Nenhuma listada"}`);
  }

  doc.setFont("helvetica", "bold");
  addText("Prioridades", 13, 8);
  doc.setFont("helvetica", "normal");
  priorityActions.forEach((action, index) => {
    addText(`${index + 1}. ${action.title} (${action.impact}) - ${action.text}`);
  });

  doc.setFont("helvetica", "bold");
  addText("Sugestões", 13, 8);
  doc.setFont("helvetica", "normal");
  (analysis.suggestions || []).slice(0, 8).forEach((suggestion, index) => {
    addText(`${index + 1}. ${suggestion}`);
  });

  doc.save(`career-ai-${analysis.id || "relatório"}.pdf`);
}

export default function AnalysisReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isGeneratingImproved, setIsGeneratingImproved] = React.useState(false);
  const [improvedResume, setImprovedResume] = React.useState(null);
  const [improvedError, setImprovedError] = React.useState("");
  const [copiedImproved, setCopiedImproved] = React.useState(false);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [copiedSuggestionIndex, setCopiedSuggestionIndex] = React.useState(-1);
  const urlParams = new URLSearchParams(window.location.search);
  const analysisId = urlParams.get('id');
  const isLogged = readAuthSession().isAuthenticated;

  React.useEffect(() => {
    if (analysisId) {
      return;
    }

    const lastAnalysisId = readLastAnalysisId();

    if (lastAnalysisId) {
      navigate(`/analysis?id=${encodeURIComponent(lastAnalysisId)}`, { replace: true });
    }
  }, [analysisId, navigate]);

  const { data: analysis, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const results = await base44.entities.ResumeAnalysis.filter({ id: analysisId });
      return results[0];
    },
    enabled: !!analysisId,
  });

  const currentAnalysis = analysis;
  const workspace = useQuery({ queryKey: ["resume-workspace", analysisId], queryFn: () => base44.analysis.getWorkspace(analysisId), enabled: Boolean(analysisId && analysis?.status === "completed") });

  React.useEffect(() => {
    if (analysis?.id) base44.analytics.track("analysis_viewed", { has_target_job: Boolean(analysis.target_job_description) });
  }, [analysis?.id, analysis?.target_job_description]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando análise...</p>
        </div>
      </div>
    );
  }

  if (isError || !currentAnalysis) {
    return (
      <div className="mx-auto flex h-96 max-w-xl items-center justify-center">
        <Card className="w-full border-border/50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-bold text-foreground">Análise não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "Não foi possível carregar este relatório. Envie um currículo ou escolha uma análise do histórico."}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/upload">
              <Button>
                <Upload className="h-4 w-4" />
                Enviar currículo
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="outline">Ver histórico</Button>
            </Link>
            {isError && (
              <Button type="button" variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (currentAnalysis.status === 'processing') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="font-semibold text-foreground">Analisando seu currículo...</p>
          <p className="text-sm text-muted-foreground mt-1">Isso pode levar alguns instantes</p>
        </div>
      </div>
    );
  }

  const priorityActions = buildPriorityActions(currentAnalysis);
  const rewriteExamples = buildRewriteExamples(workspace.data?.evidence);
  const scoreExplanations = buildScoreExplanations(currentAnalysis);
  const reviewPlan = buildReviewPlan(currentAnalysis);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportAnalysisAsPdf(currentAnalysis, priorityActions);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateImprovedResume = async () => {
    if (!currentAnalysis?.id) {
      setImprovedError("Esta análise precisa estar salva na conta para gerar o currículo melhorado.");
      return;
    }

    try {
      setIsGeneratingImproved(true);
      setImprovedError("");
      setCopiedImproved(false);
      const generated = await base44.analysis.generateImprovedResume(currentAnalysis.id);
      setImprovedResume(generated);
    } catch (generateError) {
      setImprovedError(generateError.message || "Não foi possível gerar o currículo melhorado.");
    } finally {
      setIsGeneratingImproved(false);
    }
  };

  const handleDownloadImprovedResume = () => {
    const content = improvedResume?.content || "";

    if (!content) return;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = String(currentAnalysis.file_name || "curriculo")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "curriculo";

    anchor.href = url;
    anchor.download = `${baseName}-melhorado.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyImprovedResume = async () => {
    const content = improvedResume?.content || "";

    if (!content) return;

    await navigator.clipboard.writeText(content);
    setCopiedImproved(true);
    window.setTimeout(() => setCopiedImproved(false), 1800);
  };

  const handleSaveImprovedResume = async () => {
    setSavingDraft(true);
    try {
      const version = await base44.analysis.saveVersion(currentAnalysis.id, { name: "Currículo revisado", content: improvedResume.content });
      await queryClient.invalidateQueries({ queryKey: ["resume-workspace", currentAnalysis.id] });
      base44.analytics.track("resume_version_saved", { has_target_job: Boolean(currentAnalysis.target_job_description) });
      navigate(`/resume?id=${encodeURIComponent(currentAnalysis.id)}&version=${encodeURIComponent(version.id)}`);
    } catch (error) { setImprovedError(error.message); }
    finally { setSavingDraft(false); }
  };

  const handleCopySuggestion = async (text, index) => {
    await navigator.clipboard.writeText(text);
    setCopiedSuggestionIndex(index);
    window.setTimeout(() => setCopiedSuggestionIndex(-1), 1800);
  };

  const handleApplySuggestion = (text) => {
    navigate(`/resume?id=${encodeURIComponent(currentAnalysis.id)}&suggestion=${encodeURIComponent(text)}`);
  };

  const handleDelete = async () => {
    if (!currentAnalysis?.id) {
      clearLastAnalysisId();
      navigate("/history", { replace: true });
      return;
    }

    try {
      setIsDeleting(true);
      await base44.entities.ResumeAnalysis.delete(currentAnalysis.id);
      clearLastAnalysisId(currentAnalysis.id);

      await queryClient.invalidateQueries({ queryKey: ["analyses"] });
      await queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      navigate("/history", { replace: true });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={isLogged ? "/dashboard" : "/upload"}>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório da análise</h1>
            <div className="flex items-center gap-2 mt-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{currentAnalysis.file_name}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm"><Link to={`/resume?id=${encodeURIComponent(currentAnalysis.id)}`}><Wand2 className="h-4 w-4" />Editar currículo e versões</Link></Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateImprovedResume}
            disabled={isGeneratingImproved}
          >
            {isGeneratingImproved ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Gerar CV melhorado
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar relatório PDF
          </Button>
          <Link to="/upload">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" /> Melhorar currículo
            </Button>
          </Link>
          <Link to="/jobs">
            <Button size="sm">
              <Briefcase className="w-4 h-4 mr-2" /> Buscar vagas melhores
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Apagar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este relatório?</AlertDialogTitle>
                <AlertDialogDescription>
                  A análise e as notificações geradas por ela serão removidas da sua conta.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Apagar relatório
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {(improvedResume || improvedError || isGeneratingImproved) && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 p-6">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">CV melhorado</h2>
                  {improvedResume && (
                    <Badge variant="secondary">
                      {improvedResume.generated_by === "ai" ? "IA" : "Rascunho"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Revise nomes, datas, empresas e métricas antes de enviar.
                </p>
              </div>

              {improvedResume?.content && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={savingDraft || !improvedResume.content.trim()} onClick={handleSaveImprovedResume}>
                    <FileText className="h-4 w-4" />{savingDraft ? "Salvando..." : "Salvar e abrir no editor"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyImprovedResume}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedImproved ? "Copiado" : "Copiar"}
                  </Button>
                  <Button type="button" size="sm" onClick={handleDownloadImprovedResume}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar .md
                  </Button>
                </div>
              )}
            </div>

            {isGeneratingImproved && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Gerando versão melhorada...
              </div>
            )}

            {improvedError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {improvedError}
              </div>
            )}

            {improvedResume?.content && (
              <Textarea
                id="improved-resume-editor"
                aria-label="Rascunho editável do currículo melhorado"
                value={improvedResume.content}
                onChange={(event) =>
                  setImprovedResume((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
                className="mt-4 min-h-[420px] resize-y font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
            )}
          </Card>
        </motion.div>
      )}

      {/* Scores */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-8 border-border/50">
          <div className="mb-8 text-center">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Como seu currículo está sendo lido</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Estas notas mostram onde ajustar o currículo; elas não definem sua chance de contratação.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-12">
            <ScoreGauge
              score={currentAnalysis.ats_score}
              label="Nota ATS"
              description="Leitura por filtros de recrutamento"
              size={180}
            />
            <ScoreGauge
              score={currentAnalysis.clarity_score}
              label="Clareza"
              description="Impacto e objetividade do texto"
              size={120}
            />
            <ScoreGauge
              score={currentAnalysis.market_compatibility}
              label="Compatibilidade"
              description="Proximidade a vagas semelhantes"
              size={120}
            />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {scoreGuide.map(([title, text]) => (
              <div key={title} className="rounded-xl bg-muted/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <section className="space-y-2 border-y py-4 text-sm">
        <h2 className="font-semibold">Critérios da avaliação</h2>
        <p>{currentAnalysis.analysis_method === "local"
          ? "Análise por regras locais. A nota ATS usa cobertura de palavras-chave da área; o match da vaga usa termos identificados na descrição e no currículo. Clareza e compatibilidade são estimativas baseadas no texto."
          : currentAnalysis.analysis_method === "ai"
            ? "Análise com IA. As notas ATS e de match usam cobertura local de palavras-chave; clareza e compatibilidade de mercado são estimativas do modelo e podem variar entre análises."
            : "O método desta análise antiga não foi registrado. As notas são estimativas e podem não usar os mesmos critérios das análises atuais."}</p>
        <p className="text-muted-foreground">As notas não são uma validação de um ATS específico nem uma previsão de contratação. Termos ausentes só devem ser incluídos quando fizerem parte da sua experiência.</p>
      </section>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <div className="grid gap-4 lg:grid-cols-3">
          {scoreExplanations.map((item) => (
            <Card key={item.title} className="border-border/50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{scoreBand(item.score)}</p>
                </div>
                <Badge variant={item.score >= 70 ? "secondary" : "destructive"}>
                  {item.score}/100
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.reason}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">{item.next}</p>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        <Card className="border-border/50 p-6">
          <div className="mb-5 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Plano de revisão</h2>
              <p className="text-sm text-muted-foreground">
                Um roteiro curto para transformar a análise em uma versão melhor do currículo.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {reviewPlan.map((step) => (
              <div key={step.title} className="rounded-lg border border-border/60 bg-background p-4">
                <p className="text-xs font-semibold uppercase text-primary">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {(currentAnalysis.target_job_title || currentAnalysis.target_job_description) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-primary/20 bg-primary/5 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Análise por vaga alvo</h2>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {currentAnalysis.target_job_title || "Vaga sem título informado"}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  A compatibilidade considera a descrição colada no upload e as palavras-chave que aparecem no currículo.
                </p>
                {currentAnalysis.matched_keywords?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentAnalysis.matched_keywords.slice(0, 12).map((keyword) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-primary/20 bg-background px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Match da vaga</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">{currentAnalysis.job_match_score || 0}%</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="border-border/50 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Prioridades de melhoria</h2>
              <p className="text-sm text-muted-foreground">
                Comece pelo que tende a gerar mais impacto na próxima versão.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confira cada sugestão e mantenha no currículo somente fatos, habilidades e resultados que você possa comprovar.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {priorityActions.map((action) => (
              <div key={action.title} className="rounded-lg border border-border/60 bg-background p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{action.title}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {action.impact}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{action.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Analysis Details */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 border-border/50 h-full">
            <WeakWordsList words={currentAnalysis.weak_words} />
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 border-border/50 h-full">
            <MissingKeywords keywords={currentAnalysis.missing_keywords} />
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ImprovementTasks
            analysisId={currentAnalysis.id}
            suggestions={currentAnalysis.suggestions}
            copiedIndex={copiedSuggestionIndex}
            onCopy={handleCopySuggestion}
            onApply={handleApplySuggestion}
          />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="border-border/50 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Trechos que merecem revisão</h2>
              <p className="text-sm text-muted-foreground">
                Evidências encontradas no texto original.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {workspace.isLoading && <p role="status" className="text-sm">Carregando trechos...</p>}
            {workspace.isError && <p role="alert" className="text-sm">Não foi possível carregar os trechos. <button className="underline" onClick={() => workspace.refetch()}>Tentar novamente</button></p>}
            {workspace.data && !rewriteExamples.length && <p className="text-sm text-muted-foreground">{workspace.data.source_text ? "Nenhum trecho com os termos fracos indicados foi encontrado." : "O texto original não está mais disponível para conferir os trechos."}</p>}
            {rewriteExamples.map((example, index) => (
              <div key={index} className="rounded-lg border border-border/60 bg-background p-4">
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Antes</p>
                  <p className="text-sm text-muted-foreground">{example.before}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ação sugerida
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-foreground">{example.after}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => handleCopySuggestion(example.after, `rewrite-${index}`)}
                  >
                    {copiedSuggestionIndex === `rewrite-${index}` ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedSuggestionIndex === `rewrite-${index}` ? "Copiado" : "Copiar sugestão"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handleApplySuggestion(example.after)}>
                    <Wand2 className="h-3.5 w-3.5" />
                    Revisar no editor
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Recommended Jobs */}
      {currentAnalysis.recommended_jobs && currentAnalysis.recommended_jobs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground text-lg">Vagas recomendadas</h3>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="text-primary">Ver todas</Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentAnalysis.recommended_jobs.map((job, i) => (
              <JobCard key={i} job={job} index={i} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
