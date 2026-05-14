import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, ArrowRight, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function AnalysisHistory() {
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => base44.entities.ResumeAnalysis.list('-created_date', 50),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma analise ainda</h2>
          <p className="text-muted-foreground mb-6">Seu historico de analises aparecera aqui depois do primeiro envio.</p>
          <Link to="/upload">
            <Button><Upload className="w-4 h-4 mr-2" /> Enviar curriculo</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historico de analises</h1>
          <p className="text-sm text-muted-foreground mt-1">{analyses.length} analises no total</p>
        </div>
        <Link to="/upload">
          <Button size="sm"><Upload className="w-4 h-4 mr-2" /> Nova analise</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {analyses.map((analysis, i) => (
          <motion.div
            key={analysis.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-4 border-border/50 hover:shadow-md hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-2.5 bg-muted rounded-xl flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{analysis.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {analysis.created_date ? format(new Date(analysis.created_date), 'MMM d, yyyy • HH:mm') : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {analysis.status === 'completed' ? (
                    <>
                      <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.ats_score || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">ATS</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.clarity_score || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Clareza</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.market_compatibility || 0}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Mercado</p>
                        </div>
                      </div>
                      <Link to={`/analysis?id=${analysis.id}`}>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </>
                  ) : analysis.status === 'processing' ? (
                    <Badge variant="secondary" className="gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processando
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Falhou</Badge>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
