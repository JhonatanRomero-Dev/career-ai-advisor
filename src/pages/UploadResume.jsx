import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowRight, BarChart3, BriefcaseBusiness, Clock, Crown, Shield, Sparkles, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import UpgradeModal from "@/components/layout/UpgradeModal";
import UploadZone from "@/components/upload/UploadZone";
import { saveResumeHistoryEntry } from "@/lib/resumeHistory";
import { base44 } from "@/api/base44Client";
import { getStoredCurrentUser } from "@/lib/subscription";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BASE44_APP_BASE_URL ||
  "http://localhost:3000";

export default function UploadResume() {
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [targetJobDescription, setTargetJobDescription] = useState("");
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const navigate = useNavigate();
  const uploadTimeoutMs = 90000;
  const currentUser = getStoredCurrentUser();

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

    try {
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
        headers: base44.auth.getAuthHeaders(),
        body: formData,
        signal: controller.signal,
      });

      setUploadMessage("Processando currículo...");
      const data = await response.json().catch(() => ({
        success: false,
        error: "O backend respondeu em formato inesperado."
      }));

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

      try {
        localStorage.setItem("analysisResult", JSON.stringify(data));
      } catch (storageError) {
        console.warn("Não foi possível salvar o resultado localmente:", storageError);
      }

      try {
        saveResumeHistoryEntry({
          file,
          analysis: data.analysis,
        });
      } catch (storageError) {
        console.warn("Não foi possível salvar o histórico localmente:", storageError);
      }

      if (data.analysis?.id) {
        navigate(`/analysis?id=${data.analysis.id}`);
        return;
      }

      navigate("/dashboard");
    } catch (error) {
      setUploadMessage("");
      setUploadError(
        error.name === "AbortError"
          ? "A análise demorou mais do que o esperado. Tente novamente em instantes."
          : error.message || "Erro ao enviar currículo"
      );
    } finally {
      window.clearTimeout(timeoutId);
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
            Nossa IA vai analisar cada detalhe em segundos
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
              <input
                type="text"
                value={targetJobTitle}
                onChange={(event) => setTargetJobTitle(event.target.value)}
                maxLength={140}
                placeholder="Cargo da vaga, ex: Desenvolvedor Frontend Júnior"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading}
              />
              <Textarea
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
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
              {uploadMessage}
            </div>
          )}

          {uploadError && (
            <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {uploadError}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: Sparkles, text: "Análise com IA" },
            { icon: Shield, text: "100% privado e seguro" },
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

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
