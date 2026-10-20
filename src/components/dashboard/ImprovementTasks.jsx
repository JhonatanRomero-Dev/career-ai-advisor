import { ListChecks, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import SuggestionsList from "@/components/analysis/SuggestionsList";
import useAnalysisTasks from "@/components/analysis/useAnalysisTasks";

export default function ImprovementTasks({ suggestions = [], analysisId, onCopy, onApply, copiedIndex }) {
  const tasks = useAnalysisTasks(analysisId);
  const completed = suggestions.filter((_, index) => tasks.checked[index] === true).length;
  const total = suggestions.length;
  if (!total) return null;

  return <Card className="space-y-4 border-border/50 p-4 sm:p-6" role="region" aria-label="Checklist de melhorias">
    <div className="flex items-center gap-3"><ListChecks className="h-5 w-5 shrink-0 text-primary" /><div>
      <h3 className="font-semibold">Checklist de melhorias</h3>
      <p className="mt-1 text-xs text-muted-foreground">Marque o que você já ajustou no currículo.</p>
    </div></div>
    <p role="status" className="text-sm text-muted-foreground">{tasks.isLoading ? "Carregando progresso..." : tasks.isSaving ? "Salvando progresso..." : `${completed} de ${total} concluídas`}</p>
    <Progress value={Math.round(completed / total * 100)} aria-label="Melhorias concluídas" />
    {tasks.loadError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Não foi possível carregar o progresso.</p><Button type="button" variant="outline" onClick={() => tasks.refetch()}>Tentar novamente</Button></div>}
    {tasks.saveError && <p role="alert" className="text-sm text-destructive">Não foi possível salvar essa alteração. Tente marcar a melhoria novamente.</p>}
    {completed === total && <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm"><Trophy className="h-5 w-5 shrink-0 text-primary" />Todas as melhorias foram concluídas. Envie uma nova versão para comparar o resultado.</p>}
    <SuggestionsList suggestions={suggestions} checked={tasks.inputChecked} onToggle={tasks.toggle} disabled={tasks.disabled} onCopy={onCopy} onApply={onApply} copiedIndex={copiedIndex} />
  </Card>;
}
