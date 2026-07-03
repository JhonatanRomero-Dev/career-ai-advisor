import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  AlertCircle,
  Briefcase,
  FileSearch,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobCard from "@/components/dashboard/JobCard";

const MATCH_TABS = [
  { value: "all", label: "Todas", min: 0 },
  { value: "high", label: "Match alto", min: 85 },
  { value: "good", label: "Bom match", min: 70, max: 84 },
  { value: "improve", label: "Pode melhorar", max: 69 },
];

function normalizeJob(job, index) {
  const match = Number(job.match_percentage ?? job.match ?? job.compatibility ?? 0);

  return {
    ...job,
    id: job.id || `${job.title || "vaga"}-${job.company || "empresa"}-${index}`,
    match_percentage: match,
    location: job.location || job.localizacao || job["localização"] || job.remote || "Remoto ou a combinar",
    company: job.company || job.empresa || "Empresa não informada",
    title: job.title || job.titulo || "Vaga recomendada",
    match_reasons: job.match_reasons || job.reasons || job.motivos || [],
    improvement_tips: job.improvement_tips || job.tips || job.sugestoes || [],
  };
}

function filterByMatch(jobs, tab) {
  const selected = MATCH_TABS.find((item) => item.value === tab);

  if (!selected || tab === "all") {
    return jobs;
  }

  return jobs.filter((job) => {
    const match = job.match_percentage;
    const aboveMin = selected.min === undefined || match >= selected.min;
    const belowMax = selected.max === undefined || match <= selected.max;

    return aboveMin && belowMax;
  });
}

function sortJobs(jobs, sortBy) {
  return [...jobs].sort((a, b) => {
    if (sortBy === "match-asc") {
      return a.match_percentage - b.match_percentage;
    }

    if (sortBy === "title") {
      return a.title.localeCompare(b.title, "pt-BR");
    }

    if (sortBy === "company") {
      return a.company.localeCompare(b.company, "pt-BR");
    }

    return b.match_percentage - a.match_percentage;
  });
}

export default function Jobs() {
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("match-desc");

  const { data: analyses = [], isLoading, isError, error } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => base44.entities.ResumeAnalysis.list("-created_date", 10),
  });

  const latest = analyses.find((analysis) => analysis.status === "completed");

  const jobs = useMemo(
    () => (latest?.recommended_jobs || []).map(normalizeJob),
    [latest?.recommended_jobs]
  );

  const stats = useMemo(() => {
    const total = jobs.length;
    const high = jobs.filter((job) => job.match_percentage >= 85).length;
    const good = jobs.filter((job) => job.match_percentage >= 70).length;
    const average = total
      ? Math.round(jobs.reduce((sum, job) => sum + job.match_percentage, 0) / total)
      : 0;

    return {
      total,
      high,
      good,
      average,
    };
  }, [jobs]);

  const visibleJobs = useMemo(
    () => sortJobs(filterByMatch(jobs, activeTab), sortBy),
    [activeTab, jobs, sortBy]
  );

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex h-96 max-w-xl items-center justify-center">
        <Card className="w-full border-border/50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-bold text-foreground">Não foi possível carregar as vagas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "Tente novamente em alguns instantes."}
          </p>
          <Link to="/upload">
            <Button className="mt-5">
              <Upload className="h-4 w-4" />
              Enviar currículo
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl pt-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Nenhuma vaga compatível ainda</h2>
          <p className="mb-6 text-muted-foreground">
            Envie seu currículo primeiro para receber recomendações personalizadas em PT-BR.
          </p>
          <Link to="/upload">
            <Button>
              <Upload className="h-4 w-4" />
              Enviar currículo
            </Button>
          </Link>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Match alto", "Vagas mais alinhadas às suas palavras-chave e experiências."],
            ["Dicas por vaga", "Pontos que ajudam a melhorar sua compatibilidade."],
            ["Nova versão", "Reenvie o currículo ajustado para encontrar opções melhores."],
          ].map(([title, text]) => (
            <Card key={title} className="border-border/50 p-4 text-left">
              <p className="font-semibold text-foreground">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Recomendações personalizadas
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vagas compatíveis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Baseado na sua análise mais recente: {latest?.file_name || "currículo enviado"}
          </p>
        </div>

        <Link to="/upload">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4" />
            Encontrar vagas melhores
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vagas encontradas
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Match médio
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.average}%</p>
            </div>
            <Target className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Match alto
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.high}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bons candidatos
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.good}</p>
            </div>
            <FileSearch className="h-5 w-5 text-orange-600" />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:w-auto lg:grid-cols-4">
              {MATCH_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-4">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match-desc">Maior match primeiro</SelectItem>
                <SelectItem value="match-asc">Menor match primeiro</SelectItem>
                <SelectItem value="title">Título da vaga</SelectItem>
                <SelectItem value="company">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {visibleJobs.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">Nenhuma vaga nesta categoria</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Troque a aba de match ou envie uma nova versão do currículo para gerar recomendações melhores.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleJobs.map((job, index) => (
            <JobCard key={job.id} job={job} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
