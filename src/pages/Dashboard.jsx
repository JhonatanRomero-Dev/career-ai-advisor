import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FileSearch,
  Briefcase,
  TrendingUp,
  Upload,
  ArrowRight,
  History
} from "lucide-react";

import { motion } from "framer-motion";

import ScoreGauge from "@/components/dashboard/ScoreGauge";
import StatCard from "@/components/dashboard/StatCard";
import JobCard from "@/components/dashboard/JobCard";
import ImprovementTasks from "@/components/dashboard/ImprovementTasks";
import ATSProgressChart from "@/components/dashboard/ATSProgressChart";

export default function Dashboard() {

  const [latest, setLatest] = useState(null);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {

    async function loadLatestAnalysis() {
      try {
        const analyses = await base44.entities.ResumeAnalysis.list("-created_date", 50);

        if (analyses.length > 0) {
          setLatest(analyses[0]);
          setAnalysisCount(analyses.length);
          localStorage.setItem("analysisResult", JSON.stringify({ analysis: analyses[0] }));
          return;
        }

        const saved = localStorage.getItem("analysisResult");

        if (saved) {
          const parsed = JSON.parse(saved);
          setLatest(parsed.analysis);
          setAnalysisCount(1);
        }
      } catch (error) {
        console.error("Erro ao carregar analises:", error);

        const saved = localStorage.getItem("analysisResult");

        if (saved) {
          const parsed = JSON.parse(saved);
          setLatest(parsed.analysis);
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
      <div className="max-w-2xl mx-auto pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <FileSearch className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            Bem-vindo ao Career AI
          </h1>

          <p className="text-muted-foreground text-lg mb-8">
            Envie seu curriculo para receber uma analise completa com nota ATS,
            insights de palavras-chave e recomendacoes de vagas.
          </p>

          <Link to="/upload">
            <Button
              size="lg"
              className="h-13 px-8 text-base font-semibold"
            >
              <Upload className="w-5 h-5 mr-2" />
              Enviar curriculo
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Painel
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Visao geral da sua analise de curriculo mais recente
          </p>
        </div>

        <div className="flex gap-3">

          <Link to="/upload">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Nova analise
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          icon={FileSearch}
          label="Nota ATS"
          value={latest.ats_score || 0}
          subtitle="Analise mais recente"
          color="primary"
        />

        <StatCard
          icon={TrendingUp}
          label="Clareza"
          value={latest.clarity_score || 0}
          subtitle="Clareza profissional"
          color="green"
        />

        <StatCard
          icon={Briefcase}
          label="Aderencia"
          value={`${latest.market_compatibility || 0}%`}
          subtitle="Compatibilidade"
          color="purple"
        />

        <StatCard
          icon={History}
          label="Analises"
          value={analysisCount}
          subtitle="Total salvo"
          color="orange"
        />

      </div>

      {/* Chart */}
      <ATSProgressChart analyses={[latest]} />

      {/* Scores */}
      <div className="grid lg:grid-cols-3 gap-6">

        <Card className="lg:col-span-1 p-6 flex flex-col items-center justify-center border-border/50">

          <h3 className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wider">
            Nota geral
          </h3>

          <ScoreGauge
            score={latest.ats_score}
            label="Nota ATS"
            size={160}
          />

          <div className="flex gap-6 mt-6">

            <ScoreGauge
              score={latest.clarity_score}
              label="Clareza"
              size={80}
            />

            <ScoreGauge
              score={latest.market_compatibility}
              label="Mercado"
              size={80}
            />

          </div>
        </Card>

        {/* Insights */}
        <Card className="lg:col-span-2 p-6 border-border/50">

          <div className="flex items-center justify-between mb-5">

            <h3 className="font-semibold text-foreground">
              Insights rapidos
            </h3>

            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
            >
              Relatorio completo
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>

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
                    Sugestoes
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
