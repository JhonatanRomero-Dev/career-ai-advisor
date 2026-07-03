import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileSearch,
  Briefcase,
  TrendingUp,
  Upload,
  ArrowRight,
  History,
  ListChecks,
  CheckCircle2,
  RefreshCw,
  UserCircle
} from "lucide-react";

import { motion } from "framer-motion";

import ScoreGauge from "@/components/dashboard/ScoreGauge";
import StatCard from "@/components/dashboard/StatCard";
import JobCard from "@/components/dashboard/JobCard";
import ImprovementTasks from "@/components/dashboard/ImprovementTasks";
import ATSProgressChart from "@/components/dashboard/ATSProgressChart";

const scoreGuide = [
  {
    title: "Nota ATS: leitura por filtros",
    text: "Mostra se os sistemas usados antes da triagem humana conseguem ler e classificar seu currículo. Melhore estrutura, seções e termos relevantes.",
  },
  {
    title: "Clareza: impacto do texto",
    text: "Mostra quão rápido uma pessoa entende o que você fez e os resultados que gerou. Use verbos de ação e números reais.",
  },
  {
    title: "Compatibilidade: proximidade às vagas",
    text: "Compara seu perfil a habilidades procuradas em vagas semelhantes. Com uma vaga alvo, o relatório também mostra o match específico.",
  },
];

const onboardingSteps = [
  "Envie seu currículo em PDF ou texto.",
  "Leia a nota ATS e as sugestões prioritárias.",
  "Ajuste palavras-chave, clareza e resultados.",
  "Reenvie a versão atualizada para comparar a evolução.",
];

function isProfileComplete(profile = {}) {
  return Boolean(
    profile?.targetRole &&
      profile?.experienceLevel &&
      profile?.location &&
      profile?.summary
  );
}

function buildGrowthSteps({ latest, analysisCount, profile }) {
  const hasAnalysis = Boolean(latest?.id);
  const hasSuggestions = Array.isArray(latest?.suggestions) && latest.suggestions.length > 0;
  const hasComparison = Number(analysisCount || 0) > 1;

  return [
    {
      title: "Completar perfil",
      text: "Cargo alvo, senioridade, localização e resumo melhoram as recomendações da IA.",
      done: isProfileComplete(profile),
      path: "/profile",
      action: "Abrir perfil",
      icon: UserCircle
    },
    {
      title: "Analisar currículo",
      text: "Crie uma linha de base para nota ATS, clareza e compatibilidade.",
      done: hasAnalysis,
      path: "/upload",
      action: hasAnalysis ? "Nova versão" : "Enviar arquivo",
      icon: FileSearch
    },
    {
      title: "Aplicar melhorias",
      text: "Use as sugestões do relatório como checklist antes de reenviar.",
      done: hasSuggestions,
      path: latest?.id ? `/analysis?id=${latest.id}` : "/upload",
      action: "Ver relatório",
      icon: ListChecks
    },
    {
      title: "Comparar evolução",
      text: "Reenvie o currículo editado e acompanhe se as notas subiram.",
      done: hasComparison,
      path: "/history",
      action: hasComparison ? "Ver histórico" : "Planejar próxima",
      icon: RefreshCw
    }
  ];
}

export default function Dashboard() {

  const [latest, setLatest] = useState(null);
  const [allAnalyses, setAllAnalyses] = useState([]);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {

    async function loadLatestAnalysis() {
      try {
        const profileData = await base44.auth.getProfile().catch(() => null);
        const analyses = await base44.entities.ResumeAnalysis.list("-created_date", 50);

        setProfile(profileData);

        if (analyses.length > 0) {
          setLatest(analyses[0]);
          setAllAnalyses(analyses);
          setAnalysisCount(analyses.length);
          localStorage.setItem("analysisResult", JSON.stringify({ analysis: analyses[0] }));
          return;
        }

        const saved = localStorage.getItem("analysisResult");

        if (saved) {
          const parsed = JSON.parse(saved);
          setLatest(parsed.analysis);
          setAllAnalyses([parsed.analysis]);
          setAnalysisCount(1);
        }
      } catch (error) {
        console.error("Erro ao carregar análises:", error);

        const saved = localStorage.getItem("analysisResult");

        if (saved) {
          const parsed = JSON.parse(saved);
          setLatest(parsed.analysis);
          setAllAnalyses([parsed.analysis]);
          setAnalysisCount(1);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadLatestAnalysis();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="max-w-4xl mx-auto pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <FileSearch className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Bem-vindo ao Career AI
          </h1>

          <p className="text-muted-foreground text-lg mb-8">
            Envie seu currículo para saber se filtros de recrutamento conseguem lê-lo bem,
            insights de palavras-chave e recomendações de vagas.
          </p>

          <Link to="/upload">
            <Button
              size="lg"
              className="h-13 px-8 text-base font-semibold"
            >
              <Upload className="w-5 h-5 mr-2" />
              Enviar currículo
            </Button>
          </Link>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {onboardingSteps.map((step, index) => (
            <Card key={step} className="border-border/50 p-4 text-left">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{step}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const growthSteps = buildGrowthSteps({ latest, analysisCount, profile });
  const completedSteps = growthSteps.filter((step) => step.done).length;
  const progressValue = Math.round((completedSteps / growthSteps.length) * 100);
  const nextStep = growthSteps.find((step) => !step.done);

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Painel
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Visão geral da sua análise de currículo mais recente
          </p>
          {latest.target_job_title && (
            <p className="mt-1 text-xs font-medium text-primary">
              Vaga alvo: {latest.target_job_title} • match {latest.job_match_score || 0}%
            </p>
          )}
        </div>

        <div className="flex gap-3">

          <Link to="/upload">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Nova análise
            </Button>
          </Link>

          <Link to="/jobs">
            <Button size="sm">
              <Briefcase className="w-4 h-4 mr-2" />
              Buscar vagas
            </Button>
          </Link>

        </div>
      </div>

      {nextStep && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <nextStep.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Próximo passo recomendado
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{nextStep.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {nextStep.text}
                </p>
              </div>
            </div>

            <Button asChild className="w-full md:w-auto">
              <Link to={nextStep.path}>
                {nextStep.action}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <Card className="border-border/50 p-5">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completedSteps}/{growthSteps.length} etapas
              </Badge>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Plano de evolução</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Um roteiro curto para transformar cada análise em melhoria real.
            </p>
          </div>
          <div className="w-full md:w-64">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {growthSteps.map((step) => (
            <div key={step.title} className="rounded-lg border border-border/60 bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 min-h-12 text-xs leading-relaxed text-muted-foreground">
                {step.text}
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-3 h-8 px-0 text-primary">
                <Link to={step.path}>
                  {step.action}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          icon={FileSearch}
          label="Nota ATS"
          value={latest.ats_score || 0}
          subtitle="Leitura por filtros de recrutamento"
          color="primary"
        />

        <StatCard
          icon={TrendingUp}
          label="Clareza"
          value={latest.clarity_score || 0}
          subtitle="Impacto e objetividade do texto"
          color="green"
        />

        <StatCard
          icon={Briefcase}
          label="Compatibilidade"
          value={`${latest.market_compatibility || 0}%`}
          subtitle="Alinhamento a vagas semelhantes"
          color="purple"
        />

        <StatCard
          icon={History}
          label="Análises"
          value={analysisCount}
          subtitle="Total salvo"
          color="orange"
        />

      </div>

      {/* Chart */}
      <ATSProgressChart analyses={allAnalyses} />

      <Card className="border-border/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">O que estas notas querem dizer</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Elas apontam ajustes no currículo; não medem seu potencial nem garantem uma entrevista.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {scoreGuide.map((item) => (
            <div key={item.title} className="rounded-xl bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Scores */}
      <div className="grid lg:grid-cols-3 gap-6">

        <Card className="lg:col-span-1 p-6 flex flex-col items-center justify-center border-border/50">

          <h3 className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wider">
            Nota geral
          </h3>

          <ScoreGauge
            score={latest.ats_score}
            label="Nota ATS"
            description="Facilidade de leitura por filtros de recrutamento"
            size={160}
          />

          <div className="flex gap-6 mt-6">

            <ScoreGauge
              score={latest.clarity_score}
              label="Clareza"
              description="Impacto e objetividade do texto"
              size={80}
            />

            <ScoreGauge
              score={latest.market_compatibility}
              label="Vagas"
              description="Proximidade a vagas semelhantes"
              size={80}
            />

          </div>
        </Card>

        {/* Insights */}
        <Card className="lg:col-span-2 p-6 border-border/50">

          <div className="flex items-center justify-between mb-5">

            <h3 className="font-semibold text-foreground">
              Insights rápidos
            </h3>

            <Link to={`/analysis?id=${latest.id || ""}`}>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
              >
                Relatório completo
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>

          </div>

          <div className="space-y-5">

            {latest.missing_keywords &&
              latest.missing_keywords.length > 0 && (
                <div>

                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    Palavras-chave ausentes
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {latest.missing_keywords.join(", ")}
                  </p>

                </div>
              )}

            {latest.suggestions &&
              latest.suggestions.length > 0 && (
                <div>

                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                    Sugestões
                  </p>

                  <ul className="space-y-2">

                    {latest.suggestions.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-muted-foreground"
                      >
                        • {item}
                      </li>
                    ))}

                  </ul>

                </div>
              )}

          </div>
        </Card>

      </div>

      {/* Improvement Tasks */}
      {latest.suggestions &&
        latest.suggestions.length > 0 && (
          <ImprovementTasks
            suggestions={latest.suggestions}
            analysisId={latest.id}
          />
        )}

      {/* Recommended Jobs */}
      {latest.recommended_jobs &&
        latest.recommended_jobs.length > 0 && (
          <div>

            <div className="flex items-center justify-between mb-4">

              <h3 className="font-semibold text-foreground text-lg">
                Vagas recomendadas
              </h3>

              <Link to="/jobs">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                >
                  Ver todas
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>

            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {latest.recommended_jobs.map((job, i) => (
                <JobCard
                  key={i}
                  job={job}
                  index={i}
                />
              ))}

            </div>

          </div>
        )}

    </div>
  );
}
