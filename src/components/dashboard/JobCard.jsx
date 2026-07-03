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
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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

const platformSequence = [
  "linkedin",
  "infojobs",
  "linkedin",
  "indeed",
  "linkedin",
  "infojobs",
  "linkedin",
  "indeed",
  "linkedin",
  "infojobs",
];

const platformMeta = {
  linkedin: {
    label: "LinkedIn",
    icon: "in",
    iconClass: "bg-sky-700 text-white",
    chipClass: "border-sky-700/30 bg-sky-700/5 text-sky-700",
  },
  infojobs: {
    label: "InfoJobs",
    icon: "ij",
    iconClass: "bg-blue-800 text-white",
    chipClass: "border-blue-800/30 bg-blue-800/5 text-blue-800",
    accentClass: "bg-orange-500",
  },
  indeed: {
    label: "Indeed",
    icon: "i",
    iconClass: "bg-blue-900 text-white",
    chipClass: "border-blue-900/30 bg-blue-900/5 text-blue-900",
  },
};

function isHttpUrl(value = "") {
  try {
    const url = new URL(String(value));

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getJobSearchContext(job, reasons, skills) {
  const rawLocation = job.location || job.remote || "";
  const query = [
    job.title || "vaga tecnologia",
    ...reasons.slice(0, 5),
    ...skills.slice(0, 3),
    String(rawLocation).toLowerCase().includes("remoto") ? "remoto" : "",
    "Brasil",
  ].filter(Boolean).join(" ");

  return {
    location: rawLocation && !String(rawLocation).toLowerCase().includes("remoto")
      ? rawLocation
      : "Brasil",
    query,
  };
}

function buildLinkedInSearchUrl({ query, location }) {
  const params = new URLSearchParams({
    keywords: query,
    location,
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function buildIndeedSearchUrl({ query, location }) {
  const params = new URLSearchParams({
    q: query,
    l: location,
  });

  return `https://br.indeed.com/jobs?${params.toString()}`;
}

function buildInfoJobsSearchUrl({ query, location }) {
  const params = new URLSearchParams({
    Palabra: `${query} ${location}`.trim(),
  });

  return `https://www.infojobs.com.br/vagas-de-emprego.aspx?${params.toString()}`;
}

function getPlatform(index) {
  const key = platformSequence[index % platformSequence.length];

  return {
    key,
    ...platformMeta[key],
  };
}

function buildPlatformSearchUrl(platformKey, searchContext) {
  if (platformKey === "infojobs") {
    return buildInfoJobsSearchUrl(searchContext);
  }

  if (platformKey === "indeed") {
    return buildIndeedSearchUrl(searchContext);
  }

  return buildLinkedInSearchUrl(searchContext);
}

function PlatformIcon({ platform, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] text-[9px] font-black leading-none ${platform.iconClass} ${className}`}
    >
      {platform.icon}
      {platform.accentClass && (
        <span className={`absolute bottom-0.5 right-0.5 h-[2px] w-2 rounded-full ${platform.accentClass}`} />
      )}
    </span>
  );
}

export default function JobCard({ job, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const match = Number(job.match_percentage ?? job.match ?? 0);
  const reasons = job.match_reasons || job.reasons || [];
  const tips = job.improvement_tips || job.tips || [];
  const skills = job.required_skills || job.skills || job.keywords || [];
  const providedUrl = job.url || job.link || job.job_url || job.apply_url || "";
  const hasDirectUrl = isHttpUrl(providedUrl);
  const searchContext = getJobSearchContext(job, reasons, skills);
  const platform = getPlatform(index);
  const jobUrl =
    platform.key === "linkedin" && hasDirectUrl
      ? providedUrl
      : buildPlatformSearchUrl(platform.key, searchContext);

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
                {job.location || job.remote || "Local não informado"}
              </span>
              <Badge
                variant="outline"
                className={`h-5 gap-1 rounded-sm px-1.5 text-[10px] font-semibold ${platform.chipClass}`}
              >
                <PlatformIcon platform={platform} className="h-3.5 w-3.5 text-[8px]" />
                {platform.label}
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <Badge className={`${getMatchStyle(match)} border px-3 text-sm font-bold`}>
              {match}%
            </Badge>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {getMatchLabel(match)}
            </p>
          </div>
        </div>

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
                {job.description ||
                  "Esta vaga foi recomendada com base nas habilidades e no perfil identificados na sua análise mais recente."}
              </p>
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

            {tips.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Como aumentar sua aderencia</p>
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

          <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
            <a href={jobUrl} target="_blank" rel="noreferrer">
              <PlatformIcon platform={platform} />
              Ver no {platform.label}
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
