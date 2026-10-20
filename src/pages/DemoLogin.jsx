import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readAuthSession, sanitizeAuthRedirectPath } from "@/lib/authSession";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DemoLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = sanitizeAuthRedirectPath(
    new URLSearchParams(location.search).get("next") || "/dashboard"
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [step, setStep] = useState("email");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readAuthSession().isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [navigate, nextPath]);

  async function requestCode(event) {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Digite um e-mail válido.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const response = await base44.auth.requestVerificationCode({ email: normalizedEmail });
      if (!/^\d{6}$/.test(String(response.dev_code || ""))) {
        throw new Error("O código de teste não está disponível agora.");
      }
      setEmail(normalizedEmail);
      setCode("");
      setPreviewCode(response.dev_code);
      setStep("code");
    } catch (requestError) {
      setError(requestError.message || "Não foi possível gerar o código.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Digite o código de 6 dígitos.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await base44.auth.verifyCode({ email, code });
      navigate(nextPath, { replace: true });
    } catch (verifyError) {
      setError(verifyError.message || "Código inválido ou expirado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Career AI</p>
            <p className="text-xs text-muted-foreground">Teste no celular</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold">
          {step === "email" ? "Entre com seu e-mail" : "Digite o código"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "email"
            ? "Use qualquer e-mail, inclusive um fictício. O código aparecerá nesta tela."
            : `Código gerado para ${email}.`}
        </p>

        {step === "email" ? (
          <form className="mt-6 space-y-4" onSubmit={requestCode}>
            <div className="space-y-2">
              <Label htmlFor="demo-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="demo-email"
                  type="email"
                  autoComplete="email"
                  placeholder="teste@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="h-12 w-full" disabled={submitting}>
              {submitting ? "Gerando código..." : "Mostrar código"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={verifyCode}>
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código de teste</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-[0.25em] text-foreground">{previewCode}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-code">Digite o código acima</Label>
              <Input
                id="demo-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-12 text-center font-mono text-xl tracking-[0.35em]"
              />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("email"); setError(""); }}>
                Trocar e-mail
              </button>
              <button type="button" className="text-primary hover:underline" onClick={requestCode} disabled={submitting}>
                Gerar outro código
              </button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </main>
  );
}
