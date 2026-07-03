import React, { useMemo, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function PixIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.283 18.36a3.5 3.5 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.5 3.5 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.5 3.5 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.5 3.5 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422L3.79 6.699h1.492a2.48 2.48 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.48 2.48 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.48 2.48 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.48 2.48 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
    </svg>
  );
}

export default function PaymentModal({ open, onOpenChange, plan }) {
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(
    () =>
      plan || {
        name: "Pro",
        price: "R$ 29",
        period: "/mês",
        features: ["Análises ilimitadas", "Relatório completo com IA"],
      },
    [plan]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsProcessing(true);
    setError("");

    try {
      const { checkout } = await base44.subscription.createCheckout(selectedPlan.name);

      if (checkout?.checkout_url) {
        window.location.assign(checkout.checkout_url);
        return;
      }

      setIsProcessing(false);
      setSuccess(true);
    } catch (checkoutError) {
      setIsProcessing(false);
      setError(checkoutError.message || "Não foi possível ativar a assinatura.");
    }
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setSuccess(false);
      setPaymentMethod("card");
      setError("");
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-primary p-6 text-primary-foreground">
            <DialogHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="text-2xl font-extrabold">
                Assinar {selectedPlan.name}
              </DialogTitle>
              <p className="text-sm text-primary-foreground/80">
                Finalize sua assinatura para liberar os recursos avançados do Career AI.
              </p>
            </DialogHeader>

            <div className="mt-8 rounded-xl bg-primary-foreground/10 p-5">
              <p className="text-sm text-primary-foreground/75">Plano selecionado</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold">{selectedPlan.price}</span>
                <span className="pb-1 text-sm text-primary-foreground/75">
                  {selectedPlan.period}
                </span>
              </div>
              <p className="mt-1 font-semibold">{selectedPlan.name}</p>
            </div>

            <div className="mt-6 space-y-3">
              {(selectedPlan.features || []).slice(0, 4).map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-xs text-primary-foreground/75">
              <ShieldCheck className="h-4 w-4" />
              Pagamento seguro via gateway configurado.
            </div>
          </div>

          <div className="p-6">
            {success ? (
              <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <BadgeCheck className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Plano ativado</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Sua assinatura {selectedPlan.name} foi ativada com sucesso.
                </p>
                <Button className="mt-6" onClick={() => handleOpenChange(false)}>
                  Continuar
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Pagamento</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha como deseja pagar sua assinatura.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                  className={`rounded-lg border px-4 py-3 text-left transition-all ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <CreditCard className="mb-2 h-4 w-4" />
                    <span className="text-sm font-semibold">Cartão</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("pix")}
                    className={`rounded-lg border px-4 py-3 text-left transition-all ${
                      paymentMethod === "pix"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <PixIcon className="mb-2 h-4 w-4" />
                    <span className="text-sm font-semibold">Pix</span>
                  </button>
                </div>

                {paymentMethod === "card" ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Ao continuar, você será redirecionado para concluir o pagamento com cartão no
                    checkout seguro.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Ao continuar, você será redirecionado para concluir o pagamento com Pix no
                    checkout seguro.
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total hoje</span>
                    <span className="font-bold text-foreground">
                      {selectedPlan.price}
                      {selectedPlan.period}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    O app não armazena dados de cartão.
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="h-11 w-full" disabled={isProcessing}>
                  {isProcessing ? "Redirecionando..." : `Continuar para pagamento ${selectedPlan.name}`}
                </Button>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
