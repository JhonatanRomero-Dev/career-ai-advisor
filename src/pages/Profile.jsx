import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Briefcase,
  CalendarDays,
  FileText,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { getStoredResumeHistory, mergeResumeHistory } from "@/lib/resumeHistory";

const PROFILE_KEY = "career-ai-user-profile";

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  headline: "",
  targetRole: "",
  experienceLevel: "",
  linkedin: "",
  portfolio: "",
  summary: "",
};

const scoreClassName = (score) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-destructive";
};

export default function Profile() {
  const [profile, setProfile] = useState(defaultProfile);
  const [savedMessage, setSavedMessage] = useState("");

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.getUser(),
  });

  const { data: remoteAnalyses = [], isLoading } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => base44.entities.ResumeAnalysis.list("-created_date", 100),
  });

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_KEY);
    const savedProfile = stored ? JSON.parse(stored) : {};

    setProfile({
      ...defaultProfile,
      name: user?.name || "",
      email: user?.email || "",
      ...savedProfile,
    });
  }, [user]);

  const resumeHistory = useMemo(() => {
    return mergeResumeHistory(remoteAnalyses, getStoredResumeHistory());
  }, [remoteAnalyses]);

  const completedAnalyses = resumeHistory.filter((item) => item.status === "completed");
  const averageAts = completedAnalyses.length
    ? Math.round(
        completedAnalyses.reduce((total, item) => total + Number(item.ats_score || 0), 0) /
          completedAnalyses.length
      )
    : 0;

  const latestUpload = resumeHistory[0]?.created_date
    ? format(new Date(resumeHistory[0].created_date), "dd/MM/yyyy")
    : "Ainda sem envios";

  const handleChange = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSavedMessage("Perfil salvo com sucesso.");
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil do usuario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize suas informacoes pessoais e acompanhe todos os curriculos enviados.
          </p>
        </div>

        <Link to="/upload">
          <Button size="sm">
            <Upload className="h-4 w-4" />
            Enviar curriculo
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Curriculos enviados</p>
              <p className="text-2xl font-bold text-foreground">{resumeHistory.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Media ATS</p>
              <p className="text-2xl font-bold text-foreground">{averageAts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/10">
              <CalendarDays className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ultimo envio</p>
              <p className="text-lg font-semibold text-foreground">{latestUpload}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 border-border/50">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Informacoes pessoais</h2>
                <p className="text-xs text-muted-foreground">
                  Esses dados ficam salvos neste navegador.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="Seu nome"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="voce@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(event) => handleChange("phone", event.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localizacao</Label>
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(event) => handleChange("location", event.target.value)}
                  placeholder="Cidade, estado"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="headline">Titulo profissional</Label>
                <Input
                  id="headline"
                  value={profile.headline}
                  onChange={(event) => handleChange("headline", event.target.value)}
                  placeholder="Ex.: Desenvolvedor Frontend Junior"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetRole">Cargo desejado</Label>
                <Input
                  id="targetRole"
                  value={profile.targetRole}
                  onChange={(event) => handleChange("targetRole", event.target.value)}
                  placeholder="Ex.: Analista de Dados"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceLevel">Nivel de experiencia</Label>
                <Input
                  id="experienceLevel"
                  value={profile.experienceLevel}
                  onChange={(event) => handleChange("experienceLevel", event.target.value)}
                  placeholder="Junior, pleno, senior..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={profile.linkedin}
                  onChange={(event) => handleChange("linkedin", event.target.value)}
                  placeholder="linkedin.com/in/seu-perfil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfolio</Label>
                <Input
                  id="portfolio"
                  value={profile.portfolio}
                  onChange={(event) => handleChange("portfolio", event.target.value)}
                  placeholder="github.com/seu-usuario"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="summary">Resumo profissional</Label>
                <Textarea
                  id="summary"
                  value={profile.summary}
                  onChange={(event) => handleChange("summary", event.target.value)}
                  placeholder="Escreva um resumo curto sobre sua experiencia, foco e objetivos."
                  className="min-h-28"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-600">{savedMessage}</p>
              <Button type="submit" className="sm:ml-auto">
                <Save className="h-4 w-4" />
                Salvar perfil
              </Button>
            </div>
          </Card>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="border-border/50">
            <div className="border-b border-border/60 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-foreground">Historico completo</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Todos os curriculos enviados e suas principais notas.
                  </p>
                </div>
                <Badge variant="secondary">{resumeHistory.length} envios</Badge>
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-80 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
              </div>
            ) : resumeHistory.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold text-foreground">Nenhum curriculo enviado ainda</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Quando voce enviar um curriculo, ele aparecera aqui com data, status e notas.
                </p>
              </div>
            ) : (
              <div className="max-h-[720px] divide-y divide-border/60 overflow-y-auto">
                {resumeHistory.map((analysis, index) => (
                  <div
                    key={`${analysis.id}-${index}`}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{analysis.file_name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(analysis.created_date), "dd/MM/yyyy HH:mm")}
                          </span>
                          {profile.targetRole && (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase className="h-3.5 w-3.5" />
                              {profile.targetRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:w-56">
                      <div>
                        <p className={`text-lg font-bold ${scoreClassName(analysis.ats_score || 0)}`}>
                          {analysis.ats_score || 0}
                        </p>
                        <p className="text-[10px] uppercase text-muted-foreground">ATS</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">
                          {analysis.clarity_score || 0}
                        </p>
                        <p className="text-[10px] uppercase text-muted-foreground">Clareza</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">
                          {analysis.market_compatibility || 0}%
                        </p>
                        <p className="text-[10px] uppercase text-muted-foreground">Mercado</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <Card className="p-5 border-border/50">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="truncate">{profile.email || "E-mail nao informado"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{profile.phone || "Telefone nao informado"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{profile.location || "Localizacao nao informada"}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
