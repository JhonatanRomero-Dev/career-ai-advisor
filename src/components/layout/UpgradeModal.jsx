import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Gratis",
    price: "R$0",
    period: "/mes",
    description: "Otimo para comecar",
    features: [
      "3 analises de curriculo por mes",
      "Nota ATS basica",
      "5 recomendacoes de vagas",
      "Analise de palavras-chave ausentes",
    ],
    cta: "Plano atual",
    ctaVariant: "outline",
    disabled: true,
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$19",
    period: "/mes",
    description: "Para quem leva a busca a serio",
    features: [
      "Analises de curriculo ilimitadas",
      "Insights e palavras-chave avancados",
      "Vagas compativeis ilimitadas",
      "Gerador de curriculo com IA",
      "Acompanhamento de progresso ATS",
      "Suporte prioritario",
    ],
    cta: "Assinar Pro",
    ctaVariant: "default",
    disabled: false,
    highlight: true,
    badge: "MAIS POPULAR",
  },
];

export default function UpgradeModal({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-8 pt-8 pb-6 border-b border-border/50">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Planos</span>
            </div>
            <DialogTitle className="text-xl font-extrabold text-foreground">
              Libere todo o seu potencial
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha o plano que combina com seus objetivos de carreira
            </p>
          </DialogHeader>
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 gap-4 p-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border transition-all duration-200 ${
                plan.highlight
                  ? "border-primary bg-primary/5 relative"
                  : "border-border/50 bg-card"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full tracking-wider">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {plan.highlight && <Sparkles className="w-3.5 h-3.5 text-primary" />}
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.disabled ? (
                <Button variant="outline" className="w-full" disabled>
                  {plan.cta}
                </Button>
              ) : (
                <Link to="/" onClick={onClose}>
                  <Button className="w-full gap-2">
                    <Zap className="w-4 h-4" /> {plan.cta}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-5">
          Cancele quando quiser • Sem taxas escondidas • Pagamento seguro
        </p>
      </DialogContent>
    </Dialog>
  );
}
