import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ListChecks, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImprovementTasks({ suggestions = [], analysisId }) {
  const storageKey = `tasks_${analysisId}`;
  const canSync = Boolean(analysisId && !String(analysisId).startsWith("local-"));

  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const { data: remoteTasks } = useQuery({
    queryKey: ["analysis-tasks", analysisId],
    queryFn: () => base44.analysis.getTasks(analysisId),
    enabled: canSync,
    staleTime: 30000,
  });
  const updateTasksMutation = useMutation({
    mutationFn: (nextChecked) => base44.analysis.updateTasks(analysisId, nextChecked),
  });

  useEffect(() => {
    if (remoteTasks?.checked) {
      setChecked(remoteTasks.checked);
    }
  }, [remoteTasks]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const toggle = (index) => {
    setChecked((prev) => {
      const next = { ...prev, [index]: !prev[index] };

      if (canSync) {
        updateTasksMutation.mutate(next);
      }

      return next;
    });
  };

  const completedCount = suggestions.filter((_, i) => checked[i]).length;
  const total = suggestions.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card className="p-6 border-border/50">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ListChecks className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Melhorias pendentes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{completedCount} de {total} concluídas</p>
          </div>
        </div>
        <span className="text-sm font-bold text-primary">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* All done banner */}
      <AnimatePresence>
        {completedCount === total && total > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Trophy className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-700">Todas as melhorias foram concluídas! Envie um novo currículo para ver o impacto.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="space-y-2.5">
        {suggestions.map((suggestion, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-3 text-left group"
            >
              <div className="mt-0.5 flex-shrink-0">
                {checked[i] ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
                )}
              </div>
              <span className={`text-sm leading-relaxed transition-all duration-200 ${
                checked[i]
                  ? "line-through text-muted-foreground/50"
                  : "text-foreground group-hover:text-primary"
              }`}>
                {suggestion}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </Card>
  );
}
