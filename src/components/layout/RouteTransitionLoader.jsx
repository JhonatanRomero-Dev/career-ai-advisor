import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, Sparkles } from "lucide-react";

const routeMessages = {
  "/dashboard": "Preparando painel",
  "/upload": "Abrindo envio de currículo",
  "/analysis": "Preparando relatório",
  "/history": "Carregando histórico",
  "/jobs": "Buscando vagas compatíveis",
  "/profile": "Abrindo perfil",
  "/support": "Conectando suporte IA",
};

export default function RouteTransitionLoader({ routeKey, pathname }) {
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const message = routeMessages[pathname] || "Carregando experiência";

  useEffect(() => {
    setVisible(true);

    const timeout = window.setTimeout(
      () => setVisible(false),
      prefersReducedMotion ? 240 : 620
    );

    return () => window.clearTimeout(timeout);
  }, [prefersReducedMotion, routeKey]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/86 px-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="flex w-full max-w-xs flex-col items-center text-center"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/25">
              <BriefcaseBusiness className="h-7 w-7" />
              <motion.span
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-primary shadow-md ring-1 ring-border"
                animate={prefersReducedMotion ? {} : { rotate: [0, 10, -8, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </motion.span>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Career AI
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">{message}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Organizando sua experiência...
            </p>

            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: prefersReducedMotion ? 0.2 : 0.58,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
