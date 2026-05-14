import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Briefcase, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ScoreGauge from "@/components/dashboard/ScoreGauge";
import WeakWordsList from "@/components/analysis/WeakWordsList";
import MissingKeywords from "@/components/analysis/MissingKeywords";
import SuggestionsList from "@/components/analysis/SuggestionsList";
import JobCard from "@/components/dashboard/JobCard";

export default function AnalysisReport() {
  const urlParams = new URLSearchParams(window.location.search);
  const analysisId = urlParams.get('id');

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const results = await base44.entities.ResumeAnalysis.filter({ id: analysisId });
      return results[0];
    },
    enabled: !!analysisId,
  });

  if (isLoading || !analysis) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando analise...</p>
        </div>
      </div>
    );
  }

  if (analysis.status === 'processing') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="font-semibold text-foreground">Analisando seu curriculo...</p>
          <p className="text-sm text-muted-foreground mt-1">Isso pode levar alguns instantes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatorio da analise</h1>
            <div className="flex items-center gap-2 mt-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{analysis.file_name}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/upload">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" /> Melhorar curriculo
            </Button>
          </Link>
          <Link to="/jobs">
            <Button size="sm">
              <Briefcase className="w-4 h-4 mr-2" /> Buscar vagas melhores
            </Button>
          </Link>
        </div>
      </div>

      {/* Scores */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-8 border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-8 text-center">Visao geral das notas</h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-12">
            <ScoreGauge score={analysis.ats_score} label="Nota ATS" size={180} />
            <ScoreGauge score={analysis.clarity_score} label="Clareza" size={120} />
            <ScoreGauge score={analysis.market_compatibility} label="Compatibilidade" size={120} />
          </div>
        </Card>
      </motion.div>

      {/* Analysis Details */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 border-border/50 h-full">
            <WeakWordsList words={analysis.weak_words} />
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 border-border/50 h-full">
            <MissingKeywords keywords={analysis.missing_keywords} />
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-6 border-border/50">
          <SuggestionsList suggestions={analysis.suggestions} />
        </Card>
      </motion.div>

      {/* Recommended Jobs */}
      {analysis.recommended_jobs && analysis.recommended_jobs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground text-lg">Vagas recomendadas</h3>
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="text-primary">Ver todas</Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.recommended_jobs.map((job, i) => (
              <JobCard key={i} job={job} index={i} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
