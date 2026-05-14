import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import JobCard from "@/components/dashboard/JobCard";

export default function Jobs() {
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => base44.entities.ResumeAnalysis.list('-created_date', 10),
  });

  const latest = analyses.find(a => a.status === 'completed');
  const jobs = latest?.recommended_jobs || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma vaga compativel ainda</h2>
          <p className="text-muted-foreground mb-6">Envie seu curriculo primeiro para receber recomendacoes personalizadas.</p>
          <Link to="/upload">
            <Button><Upload className="w-4 h-4 mr-2" /> Enviar curriculo</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vagas compativeis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs.length} vagas encontradas com base na sua analise mais recente
          </p>
        </div>
        <Link to="/upload">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" /> Encontrar vagas melhores
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs
          .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0))
          .map((job, i) => (
            <JobCard key={i} job={job} index={i} />
          ))}
      </div>
    </div>
  );
}
