import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, FileSearch, Sparkles, Target } from "lucide-react";

const steps = [
  {
    icon: FileSearch,
    label: "Lendo seu potencial profissional",
  },
  {
    icon: Target,
    label: "Mapeando oportunidades ideais",
  },
  {
    icon: Sparkles,
    label: "Preparando insights com IA",
  },
];

export default function SplashScreen() {
  const [activeStep, setActiveStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, 850);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.02 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,hsl(var(--primary)/0.16),transparent_28%),radial-gradient(circle_at_78%_72%,hsl(var(--chart-2)/0.16),transparent_30%)]" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10"
        animate={
          prefersReducedMotion
            ? {}
            : {
                scale: [0.8, 1.25, 0.8],
                opacity: [0.2, 0.55, 0.2],
              }
        }
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <motion.div
          className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30"
          animate={
            prefersReducedMotion
              ? {}
              : {
                  scale: [1, 1.08, 1],
                  y: [0, -4, 0],
                }
          }
          transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        >
          <BriefcaseBusiness className="h-10 w-10" />
          <motion.span
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary shadow-lg ring-1 ring-border"
            animate={prefersReducedMotion ? {} : { rotate: [0, 12, -8, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.span>
        </motion.div>

        <motion.p
          className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          Bem-vindo ao Career IA
        </motion.p>

        <motion.h1
          className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
        >
          Sua jornada profissional esta sendo preparada
        </motion.h1>

        <div className="mt-9 w-full">
          <div className="mb-5 grid grid-cols-3 gap-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;

              return (
                <motion.div
                  key={step.label}
                  className={`flex min-h-24 flex-col items-center justify-center rounded-lg border px-3 py-4 transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/70 bg-card/70 text-muted-foreground"
                  }`}
                  animate={{ opacity: isActive ? 1 : 0.62, y: isActive ? -2 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Icon className="mb-2 h-5 w-5" />
                  <span className="text-[11px] font-medium leading-snug">{step.label}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.8, ease: "easeInOut" }}
            />
          </div>

          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Carregando experiencia personalizada...
          </p>
        </div>
      </div>
    </motion.div>
  );
}
