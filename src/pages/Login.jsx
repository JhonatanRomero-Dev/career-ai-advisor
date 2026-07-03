import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { readAuthSession } from "@/lib/authSession";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function GoogleLogo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.2-5.2C29.4 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4 5.5l6.2 5.2C37.1 39.1 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

function AppleLogo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M31.9 24.7c0-4 3.3-6 3.5-6.1-1.9-2.8-4.8-3.2-5.8-3.2-2.5-.3-4.8 1.5-6.1 1.5-1.3 0-3.2-1.5-5.2-1.4-2.7 0-5.1 1.6-6.5 4-2.8 4.9-.7 12.1 2 16.1 1.3 1.9 2.9 4 5 4 2-.1 2.8-1.3 5.2-1.3s3.1 1.3 5.2 1.3c2.2 0 3.5-2 4.8-4 1.5-2.2 2.1-4.3 2.2-4.4-.1-.1-4.2-1.7-4.3-6.5zM28 12.8c1.1-1.3 1.8-3.1 1.6-4.8-1.6.1-3.5 1.1-4.6 2.4-1 1.2-1.9 3.1-1.6 4.8 1.7.1 3.5-.9 4.6-2.4z"
      />
    </svg>
  );
}

function FacebookLogo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="#1877F2" />
      <path
        fill="#FFFFFF"
        d="M29.5 25.3l.9-5.6h-5.4v-3.6c0-1.5.8-3 3.2-3h2.4V8.3S28.4 8 26.3 8c-4.5 0-7.4 2.7-7.4 7.6v4.1h-5v5.6h5V39h6.1V25.3h4.5z"
      />
    </svg>
  );
}

function LinkedInLogo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#0A66C2" />
      <path fill="#FFFFFF" d="M15.8 21h5.1v16h-5.1V21z" />
      <path
        fill="#FFFFFF"
        d="M18.4 18.8c-1.7 0-3-1.2-3-2.8 0-1.6 1.3-2.8 3-2.8s3 1.2 3 2.8c0 1.6-1.3 2.8-3 2.8z"
      />
      <path
        fill="#FFFFFF"
        d="M24.2 21h4.9v2.2h.1c.7-1.3 2.4-2.7 5-2.7 5.3 0 6.3 3.5 6.3 8V37h-5.1v-7.6c0-1.8 0-4.1-2.5-4.1s-2.9 2-2.9 4V37h-5.1V21z"
      />
    </svg>
  );
}

const SOCIAL_PROVIDERS = [
  { id: "linkedin", label: "LinkedIn", Icon: LinkedInLogo },
  { id: "google", label: "Google", Icon: GoogleLogo },
  { id: "apple", label: "Apple", Icon: AppleLogo },
  { id: "facebook", label: "Facebook", Icon: FacebookLogo },
];

const PRIMARY_SOCIAL_PROVIDER = SOCIAL_PROVIDERS[0];
const SECONDARY_SOCIAL_PROVIDERS = SOCIAL_PROVIDERS.slice(1);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
    newPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("credentials");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    code: "",
    resetCode: "",
    newPassword: "",
    confirmPassword: "",
  });

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/dashboard";
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("oauth_code") || params.get("oauth_error")) {
      return;
    }

    if (readAuthSession().isAuthenticated) {
      navigate(nextPath, { replace: true });
    }
  }, [location.search, navigate, nextPath]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthCode = params.get("oauth_code");
    const oauthError = params.get("oauth_error");
    let cancelled = false;

    if (oauthError) {
      setError(oauthError);
      params.delete("oauth_error");
      navigate(`/login?${params.toString()}`, { replace: true });
      return undefined;
    }

    if (!oauthCode) {
      return undefined;
    }

    async function finishOAuthExchange() {
      try {
        setSocialSubmitting("oauth");
        await base44.auth.exchangeOAuthCode({ code: oauthCode });

        if (!cancelled) {
          navigate(nextPath, { replace: true });
        }
      } catch (oauthExchangeError) {
        console.error("Erro ao concluir login social:", oauthExchangeError);

        if (!cancelled) {
          setError(oauthExchangeError.message || "Não foi possível concluir o login social.");
          params.delete("oauth_code");
          navigate(`/login?${params.toString()}`, { replace: true });
        }
      } finally {
        if (!cancelled) {
          setSocialSubmitting("");
        }
      }
    }

    finishOAuthExchange();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate, nextPath]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");

    if (["name", "email", "password", "confirmPassword"].includes(field)) {
      setNotice("");
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setStep("credentials");
    setVisiblePasswords({
      password: false,
      confirmPassword: false,
      newPassword: false,
    });
    setError("");
    setNotice("");
    setForm((current) => ({
      ...current,
      password: "",
      code: "",
      resetCode: "",
      newPassword: "",
      confirmPassword: "",
    }));
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const openPasswordResetRequest = () => {
    setMode("login");
    setStep("password-request");
    setVisiblePasswords({
      password: false,
      confirmPassword: false,
      newPassword: false,
    });
    setError("");
    setNotice("");
    setForm((current) => ({
      ...current,
      password: "",
      code: "",
      resetCode: "",
      newPassword: "",
      confirmPassword: "",
    }));
  };

  const formatCodeNotice = (message, response) => {
    const canShowDevCode =
      import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_AUTH_CODE === "true";

    if (!canShowDevCode || !response?.dev_code) {
      return message;
    }

    return `${message} Código de teste: ${response.dev_code}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();

    if (step === "verification") {
      if (!/^\d{6}$/.test(form.code.trim())) {
        setError("Digite o código de 6 dígitos.");
        return;
      }

      try {
        setIsSubmitting(true);
        await base44.auth.verifyCode({
          email,
          code: form.code,
        });
        navigate(nextPath, { replace: true });
      } catch (verifyError) {
        console.error("Erro na verificação:", verifyError);
        setError(verifyError.message || "Código inválido ou expirado.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError("Informe um e-mail válido para continuar.");
      return;
    }

    if (!form.password) {
      setError("Informe sua senha para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      let codeResponse;

      if (mode === "register") {
        if (!form.name.trim()) {
          setError("Informe seu nome para criar a conta.");
          return;
        }

        if (form.password.length < PASSWORD_MIN_LENGTH) {
          setError(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
          return;
        }

        if (form.password !== form.confirmPassword) {
          setError("As senhas não conferem.");
          return;
        }

        codeResponse = await base44.auth.register({
          name: form.name.trim(),
          email,
          password: form.password,
        });

        setForm((current) => ({ ...current, email, code: "" }));
        setNotice(
          formatCodeNotice(
            "Conta criada. Enviamos um código de 6 dígitos para confirmar seu e-mail.",
            codeResponse
          )
        );
        setStep("verification");
      } else {
        const loginResponse = await base44.auth.login({
          email,
          password: form.password,
        });

        if (loginResponse?.requires_verification) {
          setForm((current) => ({ ...current, email, code: "" }));
          setNotice(
            formatCodeNotice(
              "Enviamos um código de 6 dígitos para confirmar seu e-mail.",
              loginResponse
            )
          );
          setStep("verification");
          return;
        }

        navigate(nextPath, { replace: true });
      }
    } catch (loginError) {
      console.error(mode === "register" ? "Erro no cadastro:" : "Erro no login:", loginError);
      setError(loginError.message || "Não foi possível entrar agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      const codeResponse = await base44.auth.requestVerificationCode({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      setForm((current) => ({ ...current, code: "" }));
      setNotice(
        formatCodeNotice(
          "Novo código enviado. Confira sua caixa de entrada e a pasta de spam.",
          codeResponse
        )
      );
    } catch (resendError) {
      console.error("Erro ao reenviar código:", resendError);
      setError(resendError.message || "Não foi possível reenviar o código.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestPasswordReset = async (event) => {
    event?.preventDefault();
    const email = form.email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      setError("Informe um e-mail válido para recuperar a senha.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      setMode("login");
      const codeResponse = await base44.auth.requestPasswordReset({
        email,
      });
      setForm((current) => ({
        ...current,
        email,
        resetCode: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setNotice(
        formatCodeNotice(
          "Se este e-mail estiver cadastrado, enviaremos um código de recuperação.",
          codeResponse
        )
      );
      setStep("password-reset");
    } catch (resetError) {
      console.error("Erro na recuperação de senha:", resetError);
      setError(resetError.message || "Não foi possível enviar o código de recuperação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setSocialSubmitting(provider.id);
      setError("");
      setNotice("");
      await base44.auth.startOAuth({
        provider: provider.id,
        next: nextPath,
      });
    } catch (socialError) {
      console.error("Erro no login social:", socialError);
      setError(socialError.message || `Não foi possível entrar com ${provider.label}.`);
    } finally {
      setSocialSubmitting("");
    }
  };

  const confirmPasswordReset = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();

    if (!/^\d{6}$/.test(form.resetCode.trim())) {
      setError("Digite o código de recuperação de 6 dígitos.");
      return;
    }

    if (form.newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    try {
      setIsSubmitting(true);
      await base44.auth.resetPassword({
        email,
        code: form.resetCode,
        password: form.newPassword,
      });
      navigate(nextPath, { replace: true });
    } catch (resetError) {
      console.error("Erro ao redefinir senha:", resetError);
      setError(resetError.message || "Não foi possível redefinir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRegistering = mode === "register";
  const cardTitle =
    step === "verification"
      ? "Confirme seu e-mail"
      : step === "password-request"
        ? "Recuperar senha"
      : step === "password-reset"
        ? "Nova senha"
        : isRegistering
          ? "Criar conta"
          : "Entrar na conta";
  const cardDescription =
    step === "verification"
      ? "Digite o código enviado para o seu e-mail."
      : step === "password-request"
        ? "Informe seu e-mail para receber um código de recuperação."
      : step === "password-reset"
        ? "Crie uma nova senha usando o código enviado."
        : isRegistering
          ? "Cadastre-se para guardar suas análises e acompanhar seu progresso."
          : "Entre com seu e-mail e senha para acessar sua conta.";
  const submitLabel = isSubmitting
    ? step === "verification"
      ? "Verificando..."
      : step === "password-request"
        ? "Enviando código..."
      : step === "password-reset"
        ? "Redefinindo..."
        : isRegistering
          ? "Criando conta..."
          : "Entrando..."
    : step === "verification"
      ? "Verificar código"
      : step === "password-request"
        ? "Enviar código"
      : step === "password-reset"
        ? "Redefinir senha"
        : isRegistering
          ? "Criar conta"
          : "Entrar";

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg text-left outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              navigate(readAuthSession().isAuthenticated ? "/dashboard" : "/login");
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">Career AI</span>
          </button>
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
            Entre para continuar sua evolução profissional.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Guarde suas análises, acompanhe seu histórico de currículos e mantenha seu perfil
            pronto para novas oportunidades.
          </p>

          <div className="mt-10 grid max-w-lg gap-4">
            {[
              {
                icon: FileCheck2,
                title: "Histórico centralizado",
                text: "Consulte todos os currículos enviados e compare suas notas.",
              },
              {
                icon: BriefcaseBusiness,
                title: "Perfil profissional",
                text: "Mantenha seus dados pessoais organizados para cada análise.",
              },
              {
                icon: Sparkles,
                title: "Insights com IA",
                text: "Retome rapidamente seu painel e suas recomendações.",
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
                {isRegistering && step === "credentials" ? (
                  <UserPlus className="h-6 w-6" />
                ) : step === "password-request" ? (
                  <Mail className="h-6 w-6" />
                ) : (
                  <Lock className="h-6 w-6" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground">{cardTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{cardDescription}</p>
            </div>

            {step === "credentials" && (
              <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${
                    !isRegistering
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${
                    isRegistering
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  Criar conta
                </button>
              </div>
            )}

            <form
              onSubmit={
                step === "password-request"
                  ? requestPasswordReset
                  : step === "password-reset"
                    ? confirmPasswordReset
                    : handleSubmit
              }
              className="space-y-5"
            >
              {step === "credentials" ? (
                <>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin(PRIMARY_SOCIAL_PROVIDER)}
                      disabled={isSubmitting || Boolean(socialSubmitting)}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0A66C2] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#084f96] disabled:pointer-events-none disabled:opacity-60"
                    >
                      <PRIMARY_SOCIAL_PROVIDER.Icon className="h-5 w-5 flex-shrink-0" />
                      <span>
                        {socialSubmitting === PRIMARY_SOCIAL_PROVIDER.id
                          ? "Abrindo LinkedIn..."
                          : "Continuar com LinkedIn"}
                      </span>
                    </button>

                    <p className="text-center text-xs leading-relaxed text-muted-foreground">
                      Se o e-mail do LinkedIn for o mesmo da sua conta, o acesso será vinculado automaticamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {SECONDARY_SOCIAL_PROVIDERS.map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleSocialLogin(provider)}
                        disabled={isSubmitting || Boolean(socialSubmitting)}
                        aria-label={`Continuar com ${provider.label}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                      >
                        <provider.Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="hidden sm:inline">
                          {socialSubmitting === provider.id ? "Abrindo..." : provider.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {isRegistering ? "ou cadastre com e-mail" : "ou com e-mail"}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {isRegistering && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <div className="relative">
                        <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="name"
                          type="text"
                          value={form.name}
                          onChange={(event) => handleChange("name", event.target.value)}
                          placeholder="Seu nome"
                          className="h-11 pl-9"
                          autoComplete="name"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => handleChange("email", event.target.value)}
                        placeholder="seu@email.com"
                        className="h-11 pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Senha</Label>
                      {!isRegistering && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={openPasswordResetRequest}
                          disabled={isSubmitting}
                        >
                          Esqueci minha senha
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={visiblePasswords.password ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => handleChange("password", event.target.value)}
                        placeholder={isRegistering ? "Crie uma senha" : "Digite sua senha"}
                        className="h-11 px-9"
                        autoComplete={isRegistering ? "new-password" : "current-password"}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => togglePasswordVisibility("password")}
                        aria-label={visiblePasswords.password ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={visiblePasswords.password}
                      >
                        {visiblePasswords.password ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {isRegistering && (
                      <p className="text-xs text-muted-foreground">
                        Use pelo menos {PASSWORD_MIN_LENGTH} caracteres.
                      </p>
                    )}
                  </div>

                  {isRegistering && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar senha</Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={visiblePasswords.confirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(event) => handleChange("confirmPassword", event.target.value)}
                          placeholder="Repita a senha"
                          className="h-11 px-9"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => togglePasswordVisibility("confirmPassword")}
                          aria-label={
                            visiblePasswords.confirmPassword ? "Ocultar senha" : "Mostrar senha"
                          }
                          aria-pressed={visiblePasswords.confirmPassword}
                        >
                          {visiblePasswords.confirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-muted/35 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                    <div className="flex gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <p>
                        {isRegistering
                          ? "Depois do cadastro, enviaremos um código temporário para confirmar o e-mail."
                          : "Se sua conta já estiver confirmada, você entra direto. Se ainda faltar confirmação, enviaremos um código."}
                      </p>
                    </div>
                  </div>
                </>
              ) : step === "verification" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <p>
                        Código enviado para{" "}
                        <span className="font-medium text-foreground">{form.email}</span>.
                        Confira sua caixa de entrada e a pasta de spam.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Código de verificação</Label>
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
                        setNotice("");
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
                      Reenviar código
                    </button>
                  </div>
                </div>
              ) : step === "password-request" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <p>
                        Enviaremos um codigo temporario para o e-mail cadastrado.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">E-mail</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="resetEmail"
                        type="email"
                        value={form.email}
                        onChange={(event) => handleChange("email", event.target.value)}
                        placeholder="seu@email.com"
                        className="h-11 pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStep("credentials");
                      setNotice("");
                      setError("");
                    }}
                  >
                    Voltar ao login
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <p>
                        Se houver uma conta ativa para{" "}
                        <span className="font-medium text-foreground">{form.email}</span>, o
                        código chegará por e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resetCode">Código de recuperação</Label>
                    <Input
                      id="resetCode"
                      inputMode="numeric"
                      maxLength={6}
                      value={form.resetCode}
                      onChange={(event) =>
                        handleChange("resetCode", event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      className="h-12 text-center font-mono text-xl tracking-[0.35em]"
                      autoComplete="one-time-code"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={visiblePasswords.newPassword ? "text" : "password"}
                        value={form.newPassword}
                        onChange={(event) => handleChange("newPassword", event.target.value)}
                        placeholder="Digite a nova senha"
                        className="h-11 px-9"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => togglePasswordVisibility("newPassword")}
                        aria-label={visiblePasswords.newPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={visiblePasswords.newPassword}
                      >
                        {visiblePasswords.newPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use pelo menos {PASSWORD_MIN_LENGTH} caracteres.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={visiblePasswords.confirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(event) => handleChange("confirmPassword", event.target.value)}
                        placeholder="Repita a nova senha"
                        className="h-11 px-9"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => togglePasswordVisibility("confirmPassword")}
                        aria-label={
                          visiblePasswords.confirmPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={visiblePasswords.confirmPassword}
                      >
                        {visiblePasswords.confirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      className="font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setStep("credentials");
                        setNotice("");
                        setError("");
                      }}
                    >
                      Voltar ao login
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={requestPasswordReset}
                      disabled={isSubmitting}
                    >
                      Reenviar código
                    </button>
                  </div>
                </div>
              )}

              {notice && (
                <div className="flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
                {submitLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {step === "credentials"
                ? isRegistering
                  ? "Já tem conta? Use a opção Entrar acima."
                  : "Não tem conta? Use a opção Criar conta acima."
                : step === "password-request"
                  ? "Use o e-mail cadastrado na sua conta."
                  : step === "password-reset"
                    ? "Depois de redefinir, voce entra automaticamente."
                : "Para analisar um currículo, confirme seu acesso primeiro."}
            </p>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}
