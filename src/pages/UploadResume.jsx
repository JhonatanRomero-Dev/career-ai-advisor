import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowRight, BarChart3, BriefcaseBusiness, CheckCircle2, Clock, Crown, FileSearch, LoaderCircle, Shield, Sparkles, UploadCloud, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import UploadZone from "@/components/upload/UploadZone";
import { saveResumeHistoryEntry } from "@/lib/resumeHistory";
import { API_BASE_URL, base44, getCsrfHeaders } from "@/api/base44Client";
import { getStoredCurrentUser } from "@/lib/subscription";
import { rememberLastAnalysisId } from "@/lib/analysisCache";

const UpgradeModal = lazy(() => import("@/components/layout/UpgradeModal"));

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(Object.assign(new Error("Operacao cancelada"), { name: "AbortError" }));
    }, { once: true });
  });
}

function getFriendlyUploadError(error) {
  if (!navigator.onLine) {
    return "Você está sem conexão. Verifique a internet e tente novamente; seu rascunho foi mantido.";
  }

  if (error?.name === "AbortError") {
    return "A análise demorou mais do que o esperado. Tente novamente; se persistir, consulte o histórico em alguns instantes.";
  }

  const message = String(error?.message || "").toLowerCase();

  if (message.includes("sessão") || message.includes("sessao") || message.includes("401")) {
    return "Sua sessão expirou. Entre novamente para continuar sem perder os dados preenchidos.";
  }

  if (message.includes("pdf") || message.includes("docx") || message.includes("arquivo")) {
    return error.message;
  }

  return error?.message || "Não foi possível concluir a análise agora. Tente novamente em instantes.";
}

async function waitForAnalysisJob(jobId, signal) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/api/analysis/jobs/${jobId}`, {
      credentials: "include",
      signal,
    });
    const data = await response.json().catch(() => ({
      success: false,
      error: "O backend respondeu em formato inesperado.",
    }));

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Erro ao acompanhar a analise.");
    }

    if (data.job?.status === "completed") {
      return data.job;
    }

    if (data.job?.status === "failed") {
      throw new Error(data.job.error || "Nao foi possivel concluir a analise.");
    }

    await delay(1500, signal);
  }

  throw new Error("A analise ainda esta processando. Tente abrir o historico em instantes.");
}

const uploadStages = [
  { id: "upload", label: "Enviando", icon: UploadCloud },
  { id: "extract", label: "Lendo currículo", icon: FileSearch },
  { id: "analyze", label: "Analisando", icon: Sparkles },
  { id: "report", label: "Preparando relatório", icon: CheckCircle2 },
];

export default function UploadResume() {
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadStage, setUploadStage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [targetJobDescription, setTargetJobDescription] = useState("");
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastAttemptFile, setLastAttemptFile] = useState(null);
  const navigate = useNavigate();
  const uploadTimeoutMs = 90000;
  const currentUser = getStoredCurrentUser();
  const draftStorageKey = useMemo(
    () => `career-ai-upload-draft:${currentUser?.id || currentUser?.email || "account"}`,
    [currentUser?.email, currentUser?.id]
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey) || "null");

      if (saved) {
        setTargetJobTitle(String(saved.targetJobTitle || ""));
        setTargetJobDescription(String(saved.targetJobDescription || ""));
        setHasPrivacyConsent(Boolean(saved.hasPrivacyConsent));
        setDraftRestored(Boolean(saved.targetJobTitle || saved.targetJobDescription));
      }
    } catch {
      localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftReady) return;

    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        targetJobTitle,
        targetJobDescription,
        hasPrivacyConsent,
        updatedAt: new Date().toISOString(),
      }));
    } catch (storageError) {
      console.warn("Não foi possível salvar o rascunho do upload:", storageError);
    }
  }, [draftReady, draftStorageKey, hasPrivacyConsent, targetJobDescription, targetJobTitle]);

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["user-profile", currentUser?.email],
    queryFn: () => base44.auth.getProfile(),
    enabled: Boolean(currentUser?.email),
    staleTime: 30000,
  });

  const { data: usageData, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["analysis-usage", currentUser?.email],
    queryFn: () => base44.analysis.getUsage(),
    enabled: Boolean(currentUser?.email),
    staleTime: 30000,
  });

  const usage = usageData?.usage;
  const isPremium = Boolean(usageData?.premium);
  const remainingAnalyses = usage?.remaining ?? 0;
  const reachedMonthlyLimit = Boolean(
    currentUser &&
      !isLoadingUsage &&
      !isPremium &&
      usage &&
      remainingAnalyses <= 0
  );

  const missingProfileFields = [
    ["targetRole", "cargo desejado"],
    ["experienceLevel", "nível de experiência"],
    ["location", "localização"],
    ["summary", "resumo profissional"],
  ].filter(([field]) => !String(profile?.[field] || "").trim());
  const shouldShowProfileTip = Boolean(currentUser) && !isLoadingProfile && missingProfileFields.length > 0;

  const openUpgradeLimit = () => {
    setLimitMessage(
      "Seu plano gratuito permite 3 análises de currículo por mês. Assine um plano premium para continuar com análises ilimitadas."
    );
    setShowUpgrade(true);
  };

  const handleFileSelect = async (file) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), uploadTimeoutMs);
    const progressTimers = [];

    try {
      setLastAttemptFile(file);
      if (reachedMonthlyLimit) {
        openUpgradeLimit();
        return;
      }

      if (!hasPrivacyConsent) {
        setUploadError("Autorize o processamento do currículo para continuar.");
        return;
      }

      setIsUploading(true);
      setLimitMessage("");
      setUploadError("");
      setUploadMessage("Enviando currículo para análise...");
      setUploadStage("upload");
      base44.analytics.track("resume_upload_started", { has_target_job: Boolean(targetJobDescription.trim()) });
      progressTimers.push(
        window.setTimeout(() => {
          setUploadStage("extract");
          setUploadMessage("Lendo e organizando as informações do currículo...");
        }, 1200),
        window.setTimeout(() => {
          setUploadStage("analyze");
          setUploadMessage("Avaliando clareza, palavras-chave e compatibilidade ATS...");
        }, 3500)
      );

      const formData = new FormData();

      if (!currentUser) {
        navigate("/login?next=/upload", { replace: true });
        return;
      }

      formData.append("resume", file);
      formData.append("privacyConsent", "true");

      if (targetJobTitle.trim()) {
        formData.append("targetJobTitle", targetJobTitle.trim());
      }

      if (targetJobDescription.trim()) {
        formData.append("targetJobDescription", targetJobDescription.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/analysis`, {
        method: "POST",
        headers: {
          ...base44.auth.getAuthHeaders(),
          ...(await getCsrfHeaders()),
        },
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });

      setUploadStage("analyze");
      setUploadMessage("Avaliando clareza, palavras-chave e compatibilidade ATS...");
      const data = await response.json().catch(() => ({
        success: false,
        error: "O backend respondeu em formato inesperado."
      }));

      if (response.status === 202 && data.job?.id) {
        setUploadStage("analyze");
        setUploadMessage("Sua análise está na fila e será concluída em instantes...");
        const completedJob = await waitForAnalysisJob(data.job.id, controller.signal);

        data.analysis = completedJob.analysis;
        data.notification = completedJob.notification;
      }

      if (!response.ok || !data.success) {
        if (response.status === 403 && data.code === "FREE_MONTHLY_LIMIT_REACHED") {
          openUpgradeLimit();
          return;
        }

        if (response.status === 401) {
          navigate("/login?next=/upload", { replace: true });
          return;
        }

        throw new Error(data.error || "Erro ao enviar currículo");
      }

      setUploadMessage("Análise concluída. Abrindo seu relatório...");
      setUploadStage("report");
      base44.analytics.track("resume_upload_completed", { has_target_job: Boolean(targetJobDescription.trim()) });
      localStorage.removeItem(draftStorageKey);

      try {
        saveResumeHistoryEntry({
          file,
          analysis: data.analysis,
        });
      } catch (storageError) {
        console.warn("Não foi possível salvar o histórico localmente:", storageError);
      }

      if (data.analysis?.id) {
        rememberLastAnalysisId(data.analysis.id);
        navigate(`/analysis?id=${data.analysis.id}`);
        return;
      }

      navigate("/dashboard");
    } catch (error) {
      base44.analytics.track("resume_upload_failed", { error_code: error.name === "AbortError" ? "timeout" : "upload_error" });
      setUploadMessage("");
      setUploadStage("");
      setUploadError(getFriendlyUploadError(error));
    } finally {
      window.clearTimeout(timeoutId);
      progressTimers.forEach((timerId) => window.clearTimeout(timerId));
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            Envie seu currículo
          </h1>

          <p className="text-muted-foreground mt-2">
            Acompanhe cada etapa até o seu relatório ficar pronto
          </p>
        </div>

        <Card className="p-8 border-border/50">
          {currentUser && (
            <div className={`mb-5 rounded-lg border p-4 ${
              reachedMonthlyLimit
                ? "border-destructive/20 bg-destructive/10"
                : "border-border/60 bg-muted/35"
            }`}>
              <div className="flex items-start gap-3">
                <BarChart3 className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                  reachedMonthlyLimit ? "text-destructive" : "text-primary"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Seu limite mensal</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {isPremium
                      ? "Seu plano tem análises ilimitadas."
                      : isLoadingUsage
                        ? "Consultando quantas análises você ainda pode fazer..."
                        : `Você usou ${usage?.used ?? 0} de ${usage?.limit ?? 3} análises gratuitas. Restam ${remainingAnalyses} neste mês.`}
                  </p>
                </div>
              </div>

              {reachedMonthlyLimit && (
                <Button type="button" className="mt-4" onClick={() => setShowUpgrade(true)}>
                  <Crown className="h-4 w-4" />
                  Liberar análises ilimitadas
                </Button>
              )}
            </div>
          )}

          {shouldShowProfileTip && (
            <div className="mb-5 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Complete seu perfil antes do envio</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Cargo desejado, nível de experiência, localização e resumo ajudam a IA a gerar uma análise mais precisa e um match melhor.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Faltando: {missingProfileFields.map(([, label]) => label).join(", ")}.
                  </p>
                </div>
              </div>
              <Link to="/profile">
                <Button type="button" variant="outline" className="mt-4 bg-background">
                  Completar perfil
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          <div className="mb-6 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="mb-3 flex items-start gap-3">
              <BriefcaseBusiness className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Vaga alvo opcional</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Cole a descrição de uma vaga para calcular aderência e receber sugestões mais específicas.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {draftRestored && (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary" role="status">
                  Recuperamos os dados da vaga que você estava preenchendo.
                </p>
              )}
              <input
                aria-label="Cargo da vaga alvo"
                type="text"
                value={targetJobTitle}
                onChange={(event) => setTargetJobTitle(event.target.value)}
                maxLength={140}
                placeholder="Cargo da vaga, ex: Desenvolvedor Frontend Júnior"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
              />
              <Textarea
                aria-label="Descrição da vaga alvo"
                value={targetJobDescription}
                onChange={(event) => setTargetJobDescription(event.target.value)}
                maxLength={7000}
                placeholder="Cole aqui requisitos, responsabilidades e diferenciais da vaga..."
                className="min-h-32 resize-y bg-background"
                disabled={isUploading}
              />
            </div>
          </div>

          <label className="mb-5 flex items-start gap-3 rounded-lg border border-border/60 bg-background p-4 text-sm leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={hasPrivacyConsent}
              onChange={(event) => {
                setHasPrivacyConsent(event.target.checked);
                setUploadError("");
              }}
              disabled={isUploading}
              className="mt-1 h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              Autorizo o processamento temporário do meu currículo para gerar a análise, recomendações e histórico da minha conta. Posso excluir análises salvas quando quiser.
            </span>
          </label>

          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            disabled={reachedMonthlyLimit || !hasPrivacyConsent}
            disabledMessage={reachedMonthlyLimit ? "Limite mensal atingido" : "Autorize o uso do currículo"}
          />

          {limitMessage && (
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Limite mensal atingido</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {limitMessage}
                  </p>
                </div>
              </div>
              <Button type="button" className="mt-4" onClick={() => setShowUpgrade(true)}>
                <Crown className="h-4 w-4" />
                Ver planos premium
              </Button>
            </div>
          )}

          {uploadMessage && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/10 p-4" role="status" aria-live="polite">
              <div className="grid grid-cols-4 gap-2" aria-label="Progresso da análise">
                {uploadStages.map((stage, index) => {
                  const activeIndex = uploadStages.findIndex((item) => item.id === uploadStage);
                  const isComplete = activeIndex > index;
                  const isActive = activeIndex === index;
                  const Icon = isComplete || (isActive && stage.id === "report")
                    ? CheckCircle2
                    : isActive
                      ? LoaderCircle
                      : stage.icon;

                  return (
                    <div key={stage.id} className="min-w-0 text-center">
                      <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border ${
                        isComplete || isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground"
                      }`}>
                        <Icon className={`h-4 w-4 ${isActive && stage.id !== "report" ? "animate-spin" : ""}`} />
                      </div>
                      <p className={`mt-2 text-[10px] font-medium leading-tight sm:text-xs ${
                        isComplete || isActive ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {stage.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-sm font-medium text-foreground">{uploadMessage}</p>
            </div>
          )}

          {uploadError && (
            <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              <p>{uploadError}</p>
              {lastAttemptFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-background text-foreground"
                  disabled={isUploading}
                  onClick={() => handleFileSelect(lastAttemptFile)}
                >
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: Sparkles, text: "Análise com IA" },
            { icon: Shield, text: "Dados protegidos" },
            { icon: Clock, text: "Resultado em segundos" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center gap-2 py-4"
            >
              <div className="p-2 rounded-lg bg-muted">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>

              <span className="text-xs text-muted-foreground font-medium">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {showUpgrade && (
        <Suspense fallback={null}>
          <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </Suspense>
      )}
    </div>
  );
}
