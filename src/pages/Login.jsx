import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("credentials");
  const [devCode, setDevCode] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    code: "",
    remember: true,
  });

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/dashboard";
  }, [location.search]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (step === "verification") {
      if (!/^\d{6}$/.test(form.code.trim())) {
        setError("Digite o codigo de 6 digitos.");
        return;
      }

      try {
        setIsSubmitting(true);
        await base44.auth.verifyCode({
          email: form.email,
          code: form.code,
        });
        navigate(nextPath, { replace: true });
      } catch (verifyError) {
        console.error("Erro na verificacao:", verifyError);
        setError(verifyError.message || "Codigo invalido ou expirado.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!form.email || !form.password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await base44.auth.requestVerificationCode({
        email: form.email,
      });
      setDevCode(result.dev_code || "");
      setStep("verification");
    } catch (loginError) {
      console.error("Erro no login:", loginError);
      setError(loginError.message || "Nao foi possivel enviar o codigo agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    try {
      setIsSubmitting(true);
      setError("");
      const result = await base44.auth.requestVerificationCode({
        email: form.email,
      });
      setDevCode(result.dev_code || "");
    } catch (resendError) {
      console.error("Erro ao reenviar codigo:", resendError);
      setError(resendError.message || "Nao foi possivel reenviar o codigo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">Career AI</span>
          </Link>
          <ThemeToggle collapsed className="h-9 w-9" />
        </div>
      </header>

      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 pb-12 pt-24 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso seguro ao painel
          </div>
          <h1 className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight text-foreground">
            Entre para continuar sua evolucao profissional.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Guarde suas analises, acompanhe seu historico de curriculos e mantenha seu perfil
            pronto para novas oportunidades.
          </p>

          <div className="mt-10 grid max-w-lg gap-4">
            {[
              {
                icon: FileCheck2,
                title: "Historico centralizado",
                text: "Consulte todos os curriculos enviados e compare suas notas.",
              },
              {
                icon: BriefcaseBusiness,
                title: "Perfil profissional",
                text: "Mantenha seus dados pessoais organizados para cada analise.",
              },
              {
                icon: Sparkles,
                title: "Insights com IA",
                text: "Retome rapidamente seu painel e suas recomendacoes.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mx-auto w-full max-w-md"
        >
          <Card className="border-border/50 p-6 shadow-xl shadow-primary/5 sm:p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Entrar na conta</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {step === "verification"
                  ? "Digite o codigo enviado para o seu e-mail."
                  : "Use seu e-mail para acessar o Career AI Advisor."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === "credentials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => handleChange("email", event.target.value)}
                        placeholder="voce@email.com"
                        className="h-11 pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Senha</Label>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setError("Recuperacao de senha ainda nao configurada.")}
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => handleChange("password", event.target.value)}
                        placeholder="Digite sua senha"
                        className="h-11 px-9"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={(event) => handleChange("remember", event.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    Manter conectado neste dispositivo
                  </label>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    Codigo enviado para <span className="font-medium text-foreground">{form.email}</span>
                    {devCode && (
                      <div className="mt-2 rounded-md bg-background px-3 py-2 font-mono text-base font-semibold text-foreground">
                        Codigo dev: {devCode}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Codigo de verificacao</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.code}
                      onChange={(event) =>
                        handleChange("code", event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      className="h-12 text-center font-mono text-xl tracking-[0.35em]"
                      autoComplete="one-time-code"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      className="font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setStep("credentials");
                        setForm((current) => ({ ...current, code: "" }));
                        setDevCode("");
                        setError("");
                      }}
                    >
                      Trocar e-mail
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={resendCode}
                      disabled={isSubmitting}
                    >
                      Reenviar codigo
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? step === "verification" ? "Verificando..." : "Enviando..."
                  : step === "verification" ? "Verificar codigo" : "Enviar codigo"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Ainda nao tem conta?{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setError("Cadastro de usuarios sera conectado na proxima etapa.")}
              >
                Criar conta
              </button>
            </p>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}
