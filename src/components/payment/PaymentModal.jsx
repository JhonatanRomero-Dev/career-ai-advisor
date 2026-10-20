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

export default function PaymentModal({ open, onOpenChange, plan }) {
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
      base44.analytics.track("checkout_started", { plan: selectedPlan.name, source: "upgrade_modal" });
      const { checkout } = await base44.subscription.createCheckout(selectedPlan.name);

      if (checkout?.checkout_url) {
        base44.analytics.track("checkout_redirected", { plan: selectedPlan.name, source: "mercadopago" });
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

                <div className="grid gap-3">
                  <div className="rounded-lg border border-primary bg-primary/10 px-4 py-3 text-left text-primary">
                    <CreditCard className="mb-2 h-4 w-4" />
                    <span className="text-sm font-semibold">Cartão ou saldo Mercado Pago</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Ao continuar, você autoriza cobranças mensais pelo checkout seguro do Mercado Pago.
                  A renovação pode ser cancelada quando quiser.
                </div>

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
