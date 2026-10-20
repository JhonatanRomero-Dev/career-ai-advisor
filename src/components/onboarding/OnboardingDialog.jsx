import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, FileUp, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const steps = [
  {
    icon: FileUp,
    title: "Envie seu currículo",
    text: "Use um PDF ou DOCX. Você também pode colar uma vaga alvo para receber recomendações mais específicas.",
  },
  {
    icon: BarChart3,
    title: "Entenda as notas",
    text: "ATS mede a leitura por filtros, clareza avalia a força do texto e compatibilidade compara seu perfil com vagas.",
  },
  {
    icon: ListChecks,
    title: "Aplique e compare",
    text: "Copie sugestões, gere um rascunho melhorado e reenvie a nova versão para acompanhar sua evolução.",
  },
];

function storageKeyFor(user = {}) {
  return `career-ai-onboarding-v1:${user.id || user.email || "account"}`;
}

export default function OnboardingDialog({ user }) {
  const navigate = useNavigate();
  const storageKey = useMemo(() => storageKeyFor(user), [user]);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const current = steps[step];

  useEffect(() => {
    setOpen(localStorage.getItem(storageKey) !== "complete");
  }, [storageKey]);

  const finish = (goToUpload = false) => {
    localStorage.setItem(storageKey, "complete");
    setOpen(false);

    if (goToUpload) {
      navigate("/upload");
    }
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      finish(false);
      return;
    }

    setOpen(true);
  };

  return (
    <Dialog modal={false} open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl" aria-describedby="onboarding-description">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2" aria-label={`Etapa ${step + 1} de ${steps.length}`}>
            {steps.map((item, index) => (
              <span
                key={item.title}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <current.icon className="h-6 w-6" />
          </div>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription id="onboarding-description" className="pt-2 leading-relaxed">
            {current.text}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => finish(false)}>
            Pular
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((value) => value - 1)}>
                Voltar
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (step < steps.length - 1) {
                  setStep((value) => value + 1);
                } else {
                  finish(true);
                }
              }}
            >
              {step < steps.length - 1 ? "Continuar" : "Enviar currículo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
