import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  Clock,
  Loader2,
  ListChecks,
  Trash2
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
import { format } from "date-fns";

export default function AnalysisHistory() {
  const queryClient = useQueryClient();
  const { data: analyses = [], isLoading, isError, error } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => base44.entities.ResumeAnalysis.list('-created_date', 50),
  });
  const [deletingId, setDeletingId] = React.useState("");

  const handleDelete = async (analysis) => {
    try {
      setDeletingId(analysis.id);
      await base44.entities.ResumeAnalysis.delete(analysis.id);

      let saved = {};

      try {
        saved = JSON.parse(localStorage.getItem("analysisResult") || "{}");
      } catch {
        saved = {};
      }

      if (saved?.analysis?.id === analysis.id) {
        localStorage.removeItem("analysisResult");
      }

      await queryClient.invalidateQueries({ queryKey: ["analyses"] });
    } finally {
      setDeletingId("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="max-w-3xl mx-auto pt-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Nenhuma análise ainda</h2>
          <p className="text-muted-foreground mb-6">
            Seu histórico aparecerá aqui depois do primeiro envio, com notas, datas e acesso ao relatório completo.
          </p>
          <Link to="/upload">
            <Button><Upload className="w-4 h-4 mr-2" /> Enviar currículo</Button>
          </Link>
        </motion.div>

        <Card className="mt-8 border-border/50 p-5 text-left">
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">O que você poderá comparar</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Nota ATS", "Clareza do texto", "Compatibilidade com vagas"].map((item) => (
              <div key={item} className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex h-96 max-w-xl items-center justify-center">
        <Card className="w-full border-border/50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-bold text-foreground">Não foi possível carregar o histórico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || "Tente novamente em alguns instantes."}
          </p>
          <Link to="/upload">
            <Button className="mt-5">
              <Upload className="h-4 w-4" />
              Enviar novo currículo
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de análises</h1>
          <p className="text-sm text-muted-foreground mt-1">{analyses.length} análises no total</p>
        </div>
        <Link to="/upload">
          <Button size="sm"><Upload className="w-4 h-4 mr-2" /> Nova análise</Button>
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
                    {analysis.target_job_title && (
                      <Badge variant="secondary" className="mt-2 max-w-full truncate">
                        Vaga: {analysis.target_job_title}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {analysis.status === 'completed' ? (
                    <>
                      <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.ats_score || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Leitura ATS</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.clarity_score || 0}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Texto</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">{analysis.market_compatibility || 0}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Vagas</p>
                        </div>
                      </div>
                      <Link to={`/analysis?id=${analysis.id}`}>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="rounded-xl text-muted-foreground hover:text-destructive"
                            disabled={deletingId === analysis.id}
                          >
                            {deletingId === analysis.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar esta análise?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O relatório e as notificações de vagas associadas serão removidos da sua conta.
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(analysis)}
                            >
                              Apagar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
