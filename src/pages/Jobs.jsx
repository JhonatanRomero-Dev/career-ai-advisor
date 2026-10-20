import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Briefcase,
  FileSearch,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobFilters from "@/components/jobs/JobFilters";
import { DEFAULT_FILTERS, matchesJob, sortJobs, uniqueJobs } from "@/lib/jobSearch";
import JobCard from "@/components/dashboard/JobCard";
import ApplicationDialog, { APPLICATION_STAGES } from "@/components/jobs/ApplicationDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";



function jobExternalId(job = {}) {
  return String(job.external_id || job.id || job.url || "");
}

function normalizeJob(job, index = 0) {
  const match = Number(job.match_percentage ?? job.match ?? job.compatibility ?? 0);
  return {
    ...job,
    id: job.id || `${job.title || "vaga"}-${job.company || "empresa"}-${index}`,
    match_percentage: job.match_evaluated === false ? null : Number.isFinite(match) ? match : 0,
    location: job.location || job.localizacao || job["localização"] || "Remoto ou a combinar",
    company: job.company || job.empresa || "Empresa não informada",
    title: job.title || job.titulo || "Vaga recomendada",
    match_reasons: job.match_reasons || job.reasons || job.motivos || [],
    improvement_tips: job.improvement_tips || job.tips || job.sugestoes || [],
  };
}

export default function Jobs() {
  const navigate = useNavigate();
  const [adaptJob, setAdaptJob] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState("");
  const [adapting, setAdapting] = useState(false);
  const [managed, setManaged] = useState(null);
  const [stage, setStage] = useState("all");
  const queryClient = useQueryClient();
  const [view, setView] = useState("recommended");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const keyword = filters.search.trim().replace(/\s+/g, " ");
  const location = filters.location.trim();
  const [searchInput, setSearchInput] = useState({ keyword: "", location: "" });
  const keywordSearchActive = view === "recommended" && keyword.length >= 2;
  const inputSettled = searchInput.keyword === keyword && searchInput.location === location;

  useEffect(() => {
    const timeout = setTimeout(() => setSearchInput({ keyword, location }), 450);
    return () => clearTimeout(timeout);
  }, [keyword, location]);

  const keywordQuery = useQuery({
    queryKey: ["job-keyword-search", searchInput.keyword, searchInput.location],
    queryFn: ({ signal }) => base44.jobs.search({ ...searchInput, signal }),
    enabled: keywordSearchActive && inputSettled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const keywordResult = keywordSearchActive && inputSettled ? keywordQuery.data : undefined;
  const searching = keywordSearchActive && (!inputSettled || keywordQuery.isFetching);

  function submitSearch(term) {
    const nextKeyword = term.trim().replace(/\s+/g, " ");
    setSearchInput({ keyword: nextKeyword, location });
    if (keywordSearchActive && nextKeyword === searchInput.keyword && inputSettled) keywordQuery.refetch();
  }

  const analysesQuery = useQuery({
    queryKey: ["analyses"],
    queryFn: () => base44.entities.ResumeAnalysis.list("-created_date", 50),
  });
  const analyses = analysesQuery.data || [];
  const latest = analyses.find((analysis) => analysis.status === "completed");

  const refreshQuery = useQuery({
    queryKey: ["real-jobs", latest?.id],
    queryFn: () => base44.analysis.refreshJobs(latest.id),
    enabled: Boolean(latest?.id),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
  const trackedQuery = useQuery({
    queryKey: ["tracked-jobs"],
    queryFn: base44.jobs.listTracked,
    refetchInterval: 60000,
  });

  const trackingMutation = useMutation({
    mutationFn: async ({ action, job, trackedJob, status }) => {
      if (action === "remove") return base44.jobs.remove(trackedJob.external_id);
      if (action === "status") return base44.jobs.update(trackedJob.external_id, { status });
      return base44.jobs.save({ job, analysisId: latest?.id, status: "saved" });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tracked-jobs"] });
      toast.success(variables.action === "remove" ? "Vaga removida" : variables.action === "status" ? "Etapa atualizada" : "Vaga salva");
      if (variables.action === "save") base44.analytics.track("job_saved", { job_source: variables.job?.source || "unknown" });
      if (variables.action === "status") base44.analytics.track("job_status_changed", { status: variables.status });
    },
    onError: (mutationError) => toast.error(mutationError.message || "Não foi possível atualizar a vaga"),
  });

  const currentAnalysis = refreshQuery.data || latest;
  const recommendedJobs = useMemo(() =>
    uniqueJobs(currentAnalysis?.recommended_jobs || [])
      .filter((job) => (job?.is_real === true || job?.is_search_link === true) && job?.url)
      .map(normalizeJob), [currentAnalysis?.recommended_jobs]);
  const trackedJobs = trackedQuery.data || [];
  const trackingByExternalId = useMemo(() => new Map(trackedJobs.map((item) => [item.external_id, item])), [trackedJobs]);
  const discoveredJobs = useMemo(() => uniqueJobs([
    ...recommendedJobs,
    ...(keywordResult?.jobs || []).filter((job) => job.is_real === true && job.url).map(normalizeJob),
  ]), [recommendedJobs, keywordResult?.jobs]);
  const sourceJobs = useMemo(() => view === "tracked"
    ? trackedJobs.filter((item) => stage === "all" || item.status === stage).map((item, index) => normalizeJob(item.job, index))
    : discoveredJobs, [discoveredJobs, trackedJobs, view, stage]);

  async function openAdaptation() {
    if (!selectedAnalysis) return;
    setAdapting(true);
    try {
      const existing = trackingByExternalId.get(jobExternalId(adaptJob));
      const saved = existing || await base44.jobs.save({ job: adaptJob, analysisId: selectedAnalysis });
      await queryClient.invalidateQueries({ queryKey: ["tracked-jobs"] });
      base44.analytics.track("job_adaptation_started", { job_source: adaptJob.source || "unknown" });
      navigate(`/resume?id=${encodeURIComponent(selectedAnalysis)}&job=${encodeURIComponent(saved.external_id)}`);
    } catch (error) { toast.error(error.message); }
    finally { setAdapting(false); }
  }

  const dueReminders = trackedJobs.filter((item) => item.reminder_at && Date.parse(item.reminder_at) <= Date.now() && !["archived", "rejected"].includes(item.status));

  const visibleJobs = useMemo(() => sortJobs(sourceJobs.filter((job) => matchesJob(job, filters)), filters.sortBy), [sourceJobs, filters]);

  useEffect(() => {
    if (!refreshQuery.isLoading) {
      base44.analytics.track("job_list_viewed", {
        source: currentAnalysis?.job_search_provider || "unknown",
        result_count: recommendedJobs.length,
      });
    }
  }, [currentAnalysis?.job_search_provider, recommendedJobs.length, refreshQuery.isLoading]);

  const stats = useMemo(() => {
    const jobs = keywordSearchActive ? visibleJobs : recommendedJobs;
    const scoredJobs = jobs.filter((job) => job.is_real && job.match_evaluated !== false);
    return {
      total: jobs.filter((job) => job.is_real).length,
      average: scoredJobs.length ? `${Math.round(scoredJobs.reduce((sum, job) => sum + job.match_percentage, 0) / scoredJobs.length)}%` : "—",
      options: jobs.length,
      tracked: trackedJobs.length,
    };
  }, [keywordSearchActive, visibleJobs, recommendedJobs, trackedJobs.length]);

  const hasFilters = Object.keys(DEFAULT_FILTERS).some((key) => filters[key] !== DEFAULT_FILTERS[key]);
  const searchError = keywordSearchActive && inputSettled ? keywordQuery.error?.message || keywordResult?.error : "";
  const externalSearches = (keywordResult?.external_searches || []).filter((job) => !visibleJobs.some((visible) => visible.url === job.url));
  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });
  async function handleRefresh() {
    if (keywordSearchActive) {
      submitSearch(keyword);
      return;
    }
    const result = await refreshQuery.refetch();
    if (result.isError) toast.error(result.error?.message || "Não foi possível atualizar as vagas");
    else toast.success("Vagas atualizadas");
  }

  if (analysesQuery.isLoading || trackedQuery.isLoading) {
    return <div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" />Recomendações personalizadas</div>
        <h1 className="text-2xl font-bold">Buscar vagas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Digite um cargo, habilidade ou empresa para encontrar vagas.{latest && ` Recomendações baseadas em ${latest.file_name || "seu currículo"}.`}</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={handleRefresh} disabled={keywordSearchActive ? searching : !latest || refreshQuery.isFetching}><RefreshCw className={searching || refreshQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar vagas</Button>
        <Button asChild variant="outline" size="sm"><Link to="/upload"><Upload className="h-4 w-4" />Nova análise</Link></Button></div>
    </div>

    {!keywordSearchActive && (refreshQuery.isError || currentAnalysis?.job_search_error) && <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800">
      <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{refreshQuery.error?.message || currentAnalysis.job_search_error} As vagas já carregadas continuam disponíveis.</span></div>
    </Card>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Vagas verificadas", stats.total, Briefcase], ["Match médio", stats.average, Target], ["Opções para explorar", stats.options, TrendingUp], ["Na minha jornada", stats.tracked, FileSearch]].map(([label, value, Icon]) =>
        <Card key={label} className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div></Card>)}
    </div>

    <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="recommended">{keywordSearchActive ? `Resultados (${visibleJobs.length})` : `Recomendadas (${recommendedJobs.length})`}</TabsTrigger><TabsTrigger value="tracked">Minha jornada ({trackedJobs.length})</TabsTrigger></TabsList></Tabs>
    {!!dueReminders.length && <section className="space-y-3 border-y py-4"><h2 className="font-semibold">Lembretes pendentes ({dueReminders.length})</h2>{dueReminders.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.next_action || item.job.title}</p><p className="text-xs text-muted-foreground">{item.job.company} · {new Date(item.reminder_at).toLocaleString("pt-BR")}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setManaged(item)}>Abrir candidatura</Button><Button size="sm" variant="ghost" onClick={async () => { try { await base44.jobs.update(item.external_id, { reminder_at: null }); queryClient.invalidateQueries({ queryKey: ["tracked-jobs"] }); } catch (error) { toast.error(error.message); } }}>Concluir lembrete</Button></div></div>)}</section>}
    {view === "tracked" && <div className="max-w-xs space-y-2"><Label htmlFor="journey-stage">Etapa</Label><select id="journey-stage" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={stage} onChange={(event) => setStage(event.target.value)}><option value="all">Todas as etapas</option>{Object.entries(APPLICATION_STAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}

    <JobFilters jobs={sourceJobs} filters={filters} onChange={setFilters} onSearch={submitSearch} searchOnline={view === "recommended"} />
    {!latest && !keywordSearchActive && <Card className="p-5 text-sm">Busque vagas pela palavra-chave acima. Para receber também recomendações personalizadas, <Link className="text-primary underline" to="/upload">envie seu currículo</Link>.</Card>}
    {analysesQuery.isError && <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar as recomendações do currículo. A busca por palavra-chave continua disponível.</p>}
    {searchError && <Card role="alert" className="border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800"><p>{searchError}</p><Button className="mt-2" variant="outline" size="sm" disabled={searching} onClick={() => submitSearch(keyword)}>Tentar novamente</Button></Card>}

    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{searching ? `Buscando vagas para “${keyword}”…` : `${visibleJobs.length} resultado(s)`}{!searching && ` • fontes: ${(keywordSearchActive ? keywordResult?.provider : currentAnalysis?.job_search_provider) || "não disponível"}`}</p>

    {visibleJobs.length === 0 ? searching ? <Card aria-busy="true" className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin" />Consultando vagas relacionadas à sua busca…</Card>
      : <Card className="p-8 text-center"><h2 className="text-lg font-bold">{view === "recommended" && !keyword && !latest ? "Qual vaga você procura?" : searchError ? "Busca temporariamente indisponível" : "Nenhuma vaga com estes filtros"}</h2><p className="mt-2 text-sm text-muted-foreground">{view === "recommended" && !keyword && !latest ? "Digite pelo menos 2 caracteres, como React, vendas ou assistente administrativo." : searchError ? "Tente novamente ou consulte as plataformas abaixo." : "Tente outra palavra-chave ou remova alguns filtros para ampliar os resultados."}</p>{hasFilters && <Button className="mt-4" variant="outline" onClick={clearFilters}>Limpar filtros</Button>}</Card>
      : <div className="grid gap-4 lg:grid-cols-2">{visibleJobs.map((job, index) => {
        const trackedJob = trackingByExternalId.get(jobExternalId(job));
        return <JobCard key={jobExternalId(job)} job={job} index={index} trackedJob={trackedJob} isUpdating={trackingMutation.isPending}
          onAdapt={(selected) => { setAdaptJob(selected); setSelectedAnalysis(latest?.id || ""); }} onManage={setManaged}
          onToggleSave={(selectedJob, selectedTracked) => trackingMutation.mutate({ action: selectedTracked ? "remove" : "save", job: selectedJob, trackedJob: selectedTracked })}
          onStatusChange={(selectedTracked, status) => trackingMutation.mutate({ action: "status", trackedJob: selectedTracked, status })}
          onOpen={(selectedJob) => base44.analytics.track("job_opened", { job_source: selectedJob.source || "unknown", match_band: selectedJob.match_percentage >= 85 ? "high" : selectedJob.match_percentage >= 70 ? "good" : "improve" })} />;
      })}</div>}
    {!!externalSearches.length && <Card className="space-y-3 p-5"><h2 className="font-semibold">Continue a busca nas plataformas</h2><p className="text-sm text-muted-foreground">Links de busca por “{keyword}”. Os anúncios e a disponibilidade são exibidos em cada plataforma.</p><div className="flex flex-wrap gap-2">{externalSearches.map((job) => <Button key={job.id} asChild variant="outline" size="sm"><a href={job.url} target="_blank" rel="noopener noreferrer">Buscar no {job.source}</a></Button>)}</div></Card>}
    {managed && <ApplicationDialog key={managed.id} application={managed} onClose={() => setManaged(null)} />}
    <Dialog open={!!adaptJob} onOpenChange={(open) => { if (!open && !adapting) setAdaptJob(null); }}><DialogContent><DialogHeader><DialogTitle>Adaptar currículo para a vaga</DialogTitle><DialogDescription className="break-words">{adaptJob?.title} · {adaptJob?.company}</DialogDescription></DialogHeader>{analyses.some((item) => item.status === "completed") ? <div className="space-y-4"><Label htmlFor="adapt-analysis">Currículo de origem</Label><select id="adapt-analysis" className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={selectedAnalysis} onChange={(event) => setSelectedAnalysis(event.target.value)}>{analyses.filter((item) => item.status === "completed").map((item) => <option key={item.id} value={item.id}>{item.file_name} · {new Date(item.created_date).toLocaleDateString("pt-BR")}</option>)}</select><Button disabled={adapting || !selectedAnalysis} onClick={openAdaptation}>{adapting ? "Abrindo..." : "Abrir revisão"}</Button></div> : <Button asChild><Link to="/upload">Enviar currículo</Link></Button>}</DialogContent></Dialog>
  </div>;
}
