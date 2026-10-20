import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  TrendingUp,
  FilePenLine,
  CalendarDays,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { jobMetadata, monthlySalary } from "@/lib/jobSearch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRACKING_LABELS = {
  saved: "Salva",
  applied: "Candidatura enviada",
  interview: "Entrevista",
  offer: "Proposta",
  rejected: "Não avançou",
  archived: "Arquivada",
};

function getMatchStyle(match) {
  if (match >= 85) {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  }

  if (match >= 70) {
    return "bg-primary/10 text-primary border-primary/20";
  }

  return "bg-orange-500/10 text-orange-700 border-orange-500/20";
}

function getMatchLabel(match) {
  if (match >= 85) {
    return "Match alto";
  }

  if (match >= 70) {
    return "Bom match";
  }

  return "Pode melhorar";
}

function formatJobDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function buildPlatformLinks(job) {
  const query = job.title || "";
  const location = job.location || "Brasil";
  const linkedin = new URLSearchParams({ keywords: query, location });
  const indeed = new URLSearchParams({ q: query, l: location });
  const infojobs = new URLSearchParams({ Palabra: query });

  return [
    {
      name: "LinkedIn",
      shortName: "in",
      iconClass: "bg-sky-700",
      className: "border-sky-700/30 text-sky-700 hover:bg-sky-700/5",
      url: `https://www.linkedin.com/jobs/search/?${linkedin.toString()}`,
    },
    {
      name: "Indeed",
      shortName: "i",
      iconClass: "bg-blue-900",
      className: "border-blue-900/30 text-blue-900 hover:bg-blue-900/5",
      url: `https://br.indeed.com/jobs?${indeed.toString()}`,
    },
    {
      name: "InfoJobs",
      shortName: "ij",
      iconClass: "bg-blue-800",
      className: "border-blue-800/30 text-blue-800 hover:bg-blue-800/5",
      url: `https://www.infojobs.com.br/vagas-de-emprego.aspx?${infojobs.toString()}`,
    },
  ];
}

export default function JobCard({ job, index = 0, trackedJob, onToggleSave, onStatusChange, onOpen, onAdapt, onManage, isUpdating = false }) {
  const metadata = jobMetadata(job);
  const salary = monthlySalary(job);
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  const [expanded, setExpanded] = useState(false);
  const match = Number(job.match_percentage ?? job.match ?? 0);
  const reasons = job.match_reasons || job.reasons || [];
  const tips = job.improvement_tips || job.tips || [];
  const skills = job.required_skills || job.skills || job.keywords || [];
  const optionalSkills = job.optional_skills || [];
  const breakdown = job.match_breakdown || {};
  const platformLinks = buildPlatformLinks(job);
  const jobUrl = job.url || "";
  const source = job.source || "Fonte não informada";
  const sourceLabel = source === "Adzuna" ? "Jobs by Adzuna" : source;
  const publishedDate = formatJobDate(job.published_at);
  const isSearchLink = job.is_search_link === true;
  const hasMatch = job.match_evaluated !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      layout="position"
    >
      <Card className="group h-full border-border/50 p-5 hover:border-primary/30">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 flex-shrink-0 text-primary" />
              <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                {job.title || "Vaga recomendada"}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {job.company || "Empresa não informada"}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location || (job.remote === true ? "Remoto" : "Local não informado")}
              </span>
              {job.source_url ? (
                <a href={job.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Fonte: ${sourceLabel}`}>
                  <Badge
                    variant="outline"
                    className="h-5 gap-1 rounded-sm border-emerald-600/30 bg-emerald-600/5 px-1.5 text-[10px] font-semibold text-emerald-700"
                  >
                    {sourceLabel}
                  </Badge>
                </a>
              ) : (
                <Badge variant="outline">{sourceLabel}</Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            <Badge className={`${isSearchLink || !hasMatch ? "border-sky-500/20 bg-sky-500/10 text-sky-700" : getMatchStyle(match)} border px-3 text-sm font-bold`}>
              {isSearchLink ? "Busca" : hasMatch ? `${match}%` : "Encontrada"}
            </Badge>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isSearchLink ? "Externa" : hasMatch ? getMatchLabel(match) : "Por palavra-chave"}
            </p>
          </div>
        </div>

        {isSearchLink && <p className="mt-3 text-xs text-muted-foreground">Abre uma busca por {job.search_query || job.title?.replace(/^Buscar\s+/i, "")} no {source}. Confira o cargo e a localização nos resultados da plataforma.</p>}

        {!isSearchLink && <div className="mt-3 flex flex-wrap items-center gap-2">
          {metadata.mode !== "unknown" && <Badge variant="secondary">{{ remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" }[metadata.mode]}</Badge>}
          {metadata.contract !== "Não informado" && <Badge variant="outline">{metadata.contract}</Badge>}
          {metadata.level !== "Não informado" && <Badge variant="outline">{metadata.level}</Badge>}
          {salary && <span className="text-xs font-medium text-muted-foreground">{money(salary.min)}{salary.max !== salary.min ? ` – ${money(salary.max)}` : ""}/mês{job.salary_period === "year" ? " (equivalente anual ÷ 12)" : ""}</span>}
          <span className="text-xs text-muted-foreground">{publishedDate}</span>
        </div>}

        {reasons.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por que combina
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.slice(0, expanded ? reasons.length : 3).map((reason, i) => (
                <Badge key={`${reason}-${i}`} variant="secondary" className="text-[10px] font-normal">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {expanded && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-4 space-y-4 overflow-hidden border-t border-border/50 pt-4"
          >
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">Resumo da oportunidade</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {job.description || "Descrição não fornecida pela fonte da vaga."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Publicada em {publishedDate}</p>
              {(job.employment_type || job.salary) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[job.employment_type, job.salary].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>

            {skills.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">Competências relacionadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill, i) => (
                    <Badge key={`${skill}-${i}`} variant="outline" className="text-[10px] font-normal">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {optionalSkills.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">Diferenciais da vaga</p>
                <div className="flex flex-wrap gap-1.5">
                  {optionalSkills.map((skill, i) => (
                    <Badge key={`${skill}-${i}`} variant="secondary" className="text-[10px] font-normal">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(breakdown).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">
                  Composição do match • confiança {job.match_confidence || "não informada"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Título: {breakdown.title ?? 0}%</span>
                  <span>Requisitos: {breakdown.required_skills ?? 0}%</span>
                  <span>Senioridade: {breakdown.seniority ?? 0}%</span>
                  <span>Localização: {breakdown.location ?? 0}%</span>
                </div>
              </div>
            )}

            {tips.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Como aumentar sua aderência</p>
                </div>
                <ul className="space-y-2">
                  {tips.map((tip, i) => (
                    <li key={`${tip}-${i}`} className="flex gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 whitespace-nowrap px-0 text-primary hover:bg-transparent"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {!isSearchLink && onAdapt && <Button type="button" variant="outline" size="sm" onClick={() => onAdapt(job)}><FilePenLine className="h-4 w-4" />Adaptar currículo</Button>}
            {!isSearchLink && onToggleSave && <Button
              type="button"
              variant={trackedJob ? "secondary" : "outline"}
              size="sm"
              disabled={isUpdating}
              onClick={() => onToggleSave?.(job, trackedJob)}
              aria-label={trackedJob ? "Remover vaga dos salvos" : "Salvar vaga"}
            >
              {trackedJob ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {trackedJob ? "Salva" : "Salvar"}
            </Button>}
            {jobUrl && (
              <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
                <a href={jobUrl} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(job)}>
                  {isSearchLink ? `Buscar no ${source}` : "Ver vaga original"}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {trackedJob && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
            <span className="text-xs font-semibold text-foreground">Etapa</span>
            <Select value={trackedJob.status} onValueChange={(status) => onStatusChange?.(trackedJob, status)} disabled={isUpdating}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRACKING_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onManage && <Button size="sm" variant="outline" onClick={() => onManage(trackedJob)}><CalendarDays className="h-4 w-4" />Candidatura</Button>}
            {trackedJob.resume_version && <p className="w-full break-words text-xs text-muted-foreground">Currículo: {trackedJob.resume_version.name}</p>}
            {trackedJob.next_action && <p className="w-full break-words text-xs">Próxima ação: {trackedJob.next_action}</p>}
          </div>
        )}

        {!isSearchLink && <div className="mt-3 border-t border-border/50 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Buscar vagas semelhantes nas principais plataformas
          </p>
          <div className="flex flex-wrap gap-2">
            {platformLinks.map((platform) => (
              <Button
                key={platform.name}
                asChild
                variant="outline"
                size="sm"
                className={`h-8 text-xs ${platform.className}`}
              >
                <a href={platform.url} target="_blank" rel="noopener noreferrer">
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[8px] font-black text-white ${platform.iconClass}`}>
                    {platform.shortName}
                  </span>
                  {platform.name}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ))}
          </div>
        </div>}
      </Card>
    </motion.div>
  );
}
