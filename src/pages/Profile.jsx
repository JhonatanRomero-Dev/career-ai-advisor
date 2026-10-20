import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  FileX,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ProfessionalProfile from "@/components/profile/ProfessionalProfile";
import ProfilePhotoPicker from "@/components/profile/ProfilePhotoPicker";
import ProfileImportDialog from "@/components/profile/ProfileImportDialog";
import useProfileDraft from "@/components/profile/useProfileDraft";
import { fallbackLocationOptions, fetchBrazilianCityOptions, getLocationSuggestions } from "@/lib/locationSuggestions";

const PROFILE_KEY = "career-ai-user-profile";

const defaultProfile = {
  photo: "",
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
  github: "", skills: [], experiences: [], projects: [], certificates: [], achievements: [], publicEnabled: false,
};

const profileFields = [
  ["name", "Nome"],
  ["phone", "Telefone"],
  ["location", "Localização"],
  ["headline", "Título profissional"],
  ["targetRole", "Cargo desejado"],
  ["experienceLevel", "Nível de experiência"],
  ["summary", "Resumo profissional"],
  ["skills", "Habilidades"],
  ["experiences", "Experiências"],
  ["projects", "Projetos"],
];

const experienceOptions = [
  { value: "Estudante", label: "Estudante" },
  { value: "Estagio", label: "Estágio" },
  { value: "Junior", label: "Júnior" },
  { value: "Pleno", label: "Pleno" },
  { value: "Senior", label: "Sênior" },
  { value: "Especialista", label: "Especialista" },
  { value: "Lideranca", label: "Liderança" },
  { value: "Transicao de carreira", label: "Transição de carreira" },
];

const experienceLabels = Object.fromEntries(
  experienceOptions.map((option) => [option.value, option.label])
);

const trimProfile = (profileData) => ({
  ...profileData,
  name: String(profileData.name || "").trim(),
  phone: String(profileData.phone || "").trim(),
  location: String(profileData.location || "").trim(),
  headline: String(profileData.headline || "").trim(),
  targetRole: String(profileData.targetRole || "").trim(),
  experienceLevel: String(profileData.experienceLevel || "").trim(),
  linkedin: normalizeUrl(profileData.linkedin),
  portfolio: normalizeUrl(profileData.portfolio),
  github: normalizeUrl(profileData.github),
  summary: String(profileData.summary || "").trim(),
});

function normalizeUrl(value = "") {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) {
    return "";
  }

  if (/^https?:\/\//i.test(cleanValue)) {
    return cleanValue;
  }

  return `https://${cleanValue}`;
}

function isValidUrl(value = "") {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getProfileProgress(profileData = {}) {
  const isFilled = ([field]) => Array.isArray(profileData[field])
    ? profileData[field].some((item) => String(typeof item === "string" ? item : item?.title || "").trim())
    : Boolean(String(profileData[field] || "").trim());
  const completed = profileFields.filter(isFilled).length;

  return {
    completed,
    total: profileFields.length,
    value: Math.round((completed / profileFields.length) * 100),
    missing: profileFields.filter((field) => !isFilled(field)),
  };
}

function getInitials(profile = {}) {
  const label = profile.name || profile.email || "Usuário";
  const initials = String(label)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "U";
}

const getProfileStorageKey = (email) =>
  email ? `${PROFILE_KEY}:${email.trim().toLowerCase()}` : PROFILE_KEY;

const readStoredProfile = (key) => {
  try {
    const stored = localStorage.getItem(key);

    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getLocalProfile = (key, email) => {
  const currentProfile = readStoredProfile(key);

  if (currentProfile) {
    return currentProfile;
  }

  const legacyProfile = readStoredProfile(PROFILE_KEY);
  const legacyEmail = legacyProfile?.email?.trim().toLowerCase();
  const currentEmail = email?.trim().toLowerCase();

  if (legacyProfile && legacyEmail && legacyEmail === currentEmail) {
    return legacyProfile;
  }

  return {};
};

function LocationAutocomplete({ hasError, isLoading, onChange, options, value }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(
    () => getLocationSuggestions(options, value),
    [options, value]
  );
  const shouldShowSuggestions = isOpen && String(value || "").trim().length >= 2;
  const listId = "location-suggestions";

  useEffect(() => {
    if (!shouldShowSuggestions || suggestions.length === 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((current) => Math.min(Math.max(current, 0), suggestions.length - 1));
  }, [shouldShowSuggestions, suggestions.length]);

  const selectLocation = (location) => {
    onChange(location);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!shouldShowSuggestions || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectLocation(suggestions[activeIndex].label);
    }
  };

  const helperText = hasError
    ? "Sugestões locais carregadas; você ainda pode digitar livremente."
    : isLoading
      ? "Carregando cidades do IBGE..."
      : "Digite ao menos 2 letras para ver cidades e estados.";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id="location"
          value={value}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cidade, estado"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={shouldShowSuggestions ? listId : undefined}
          aria-expanded={shouldShowSuggestions}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          className="pr-9"
        />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        {shouldShowSuggestions && (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
            onMouseDown={(event) => event.preventDefault()}
          >
            {suggestions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto p-1">
                {suggestions.map((option, index) => (
                  <button
                    key={option.label}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors ${
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={() => selectLocation(option.label)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">{option.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {isLoading ? "Buscando cidades..." : "Nenhuma cidade encontrada."}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}

export default function Profile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [focusRequest, setFocusRequest] = useState(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [privacyError, setPrivacyError] = useState("");
  const [privacyAction, setPrivacyAction] = useState("");
  const [privateAnalyticsEnabled, setPrivateAnalyticsEnabled] = useState(
    () => localStorage.getItem("career-ai-analytics-disabled") !== "true"
  );

  function updatePrivateAnalytics(enabled) {
    setPrivateAnalyticsEnabled(enabled);
    localStorage.setItem("career-ai-analytics-disabled", enabled ? "false" : "true");
  }

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.getUser(),
  });

  const profileStorageKey = useMemo(() => getProfileStorageKey(user?.email), [user?.email]);

  const {
    data: savedProfile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    error: profileError,
  } = useQuery({
    queryKey: ["user-profile", user?.email],
    queryFn: () => base44.auth.getProfile(),
    enabled: Boolean(user?.email),
    refetchOnWindowFocus: false,
  });
  const {
    data: cityOptions,
    isError: isCityOptionsError,
    isFetching: isFetchingCities,
  } = useQuery({
    queryKey: ["brazilian-city-options"],
    queryFn: fetchBrazilianCityOptions,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const locationOptions = cityOptions?.length ? cityOptions : fallbackLocationOptions;

  const initialProfile = useMemo(() => {
    const localProfile = getLocalProfile(profileStorageKey, user?.email);
    const remoteProfile = savedProfile?.updated_date ? savedProfile : {};

    return {
      ...defaultProfile,
      ...localProfile,
      ...remoteProfile,
      name: savedProfile?.name || localProfile.name || user?.name || "",
      email: user?.email || savedProfile?.email || localProfile.email || "",
    };
  }, [profileStorageKey, savedProfile, user]);

  const { profile, setProfile, isReady, hasChanges, pendingDraft, restoreDraft, discardChanges, markSaved, draftError } = useProfileDraft({
    initialProfile, storageKey: profileStorageKey, ready: Boolean(user?.email) && !isLoadingProfile,
  });

  const focusMissingField = (field) => {
    if (["skills", "experiences", "projects"].includes(field)) {
      setFocusRequest({ field, id: Date.now() });
      return;
    }
    const input = document.getElementById(field);
    input?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  };

  const discardEdits = () => {
    discardChanges();
    setSavedMessage("");
    setSaveError("");
    setFieldErrors([]);
  };

  const profileProgress = getProfileProgress(profile);
  const profileLinks = [
    ["LinkedIn", normalizeUrl(profile.linkedin)],
    ["Portfólio", normalizeUrl(profile.portfolio)],
  ].filter(([, url]) => isValidUrl(url) && url);
  const professionalLabel = profile.targetRole || profile.headline || "Objetivo profissional";
  const contextLine = [
    experienceLabels[profile.experienceLevel] || profile.experienceLevel,
    profile.location,
  ].filter(Boolean).join(" • ");

  const handleChange = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
    setSaveError("");
    setFieldErrors([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady || pendingDraft || !hasChanges || isPreparingPhoto || isSavingProfile) return;
    setIsSavingProfile(true);
    setSaveError("");
    setFieldErrors([]);
    setSavedMessage("");

    const cleanProfile = trimProfile({
      ...profile,
      email: user?.email || profile.email,
    });

    if (!isValidUrl(cleanProfile.linkedin) || !isValidUrl(cleanProfile.portfolio)) {
      setIsSavingProfile(false);
      setSaveError("Confira os links de LinkedIn e portfólio antes de salvar.");
      return;
    }

    try {
      const updatedProfile = await base44.auth.updateProfile(cleanProfile);
      const normalizedProfile = {
        ...defaultProfile,
        ...cleanProfile,
        ...updatedProfile,
        email: user?.email || updatedProfile.email || cleanProfile.email,
      };

      markSaved(normalizedProfile, profile);
      try {
        localStorage.setItem(profileStorageKey, JSON.stringify(normalizedProfile));
      } catch {
        // The account was saved successfully even if the browser cache is full.
      }
      queryClient.setQueryData(["user-profile", user?.email], normalizedProfile);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      setSavedMessage("Perfil salvo com sucesso.");
    } catch (error) {
      setSaveError(error?.message || "Não foi possível salvar o perfil agora.");
      setFieldErrors(error?.fieldErrors || []);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const runPrivacyAction = async (action, callback) => {
    setPrivacyAction(action);
    setPrivacyMessage("");
    setPrivacyError("");

    try {
      await callback();
    } catch (error) {
      setPrivacyError(error.message || "Nao foi possivel concluir a acao.");
    } finally {
      setPrivacyAction("");
    }
  };

  const handleExportData = () => runPrivacyAction("export", async () => {
    const data = await base44.privacy.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `career-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setPrivacyMessage("Exportacao gerada.");
  });

  const handleClearResumeTexts = () => runPrivacyAction("texts", async () => {
    const result = await base44.privacy.clearResumeTexts();

    setPrivacyMessage(`${result.cleared_resume_texts || 0} texto(s) extraido(s) apagado(s).`);
  });

  const handleDeleteAnalyses = () => {
    if (!window.confirm("Apagar todas as analises e jobs da sua conta? Esta acao nao pode ser desfeita.")) {
      return;
    }

    runPrivacyAction("analyses", async () => {
      const result = await base44.privacy.deleteAnalyses();

      queryClient.invalidateQueries({ queryKey: ["analysis-usage"] });
      setPrivacyMessage(`${result.deleted_analyses || 0} analise(s) apagada(s).`);
    });
  };

  const handleDeleteAccount = () => {
    const confirmation = window.prompt("Digite EXCLUIR para apagar sua conta e dados pessoais.");

    if (confirmation === null) {
      return;
    }

    runPrivacyAction("account", async () => {
      await base44.privacy.deleteAccount({ confirm: confirmation });
      localStorage.clear();
      navigate("/", { replace: true });
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {pendingDraft && <Card className="space-y-3 border-primary/30 p-4" role="region" aria-label="Rascunho disponível">
        <div><h2 className="font-semibold">Continuar de onde parou?</h2><p className="mt-1 text-sm text-muted-foreground">Há alterações não salvas neste navegador. Recupere o rascunho ou descarte-o para usar o perfil salvo.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={restoreDraft}>Recuperar rascunho</Button><Button type="button" variant="outline" onClick={discardEdits}>Descartar rascunho</Button></div>
      </Card>}
      {(hasChanges || isSavingProfile || savedMessage || saveError) && <div role="region" aria-label="Salvar alterações do perfil" className="sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3 shadow-md sm:p-4">
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="text-sm font-medium">{isSavingProfile ? "Salvando seu perfil..." : hasChanges ? "Alterações não salvas" : savedMessage}</p>
          {hasChanges && !draftError && <p className="mt-1 text-xs text-muted-foreground">Rascunho guardado neste navegador.</p>}
          {saveError && <p role="alert" className="mt-1 text-sm text-destructive">{saveError}</p>}
        </div>
        {hasChanges && <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={isSavingProfile || isPreparingPhoto} onClick={discardEdits}>Descartar</Button>
          <Button type="submit" form="profile-form" className="flex-1 sm:flex-none" disabled={!isReady || isSavingProfile || isPreparingPhoto}><Save className="h-4 w-4" />{isSavingProfile ? "Salvando..." : "Salvar perfil"}</Button>
        </div>}
      </div>}
      {draftError && <p role="alert" className="text-sm text-destructive">{draftError}</p>}
      {isProfileError && (
        <Card className="border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {profileError?.message || "Não foi possível sincronizar o perfil agora."}
            </span>
          </div>
        </Card>
      )}

      <form
        id="profile-form"
        onSubmit={handleSubmit}
        className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <fieldset disabled={!isReady || Boolean(pendingDraft) || isSavingProfile} className="contents">
        <Card className="min-w-0 border-border/50 p-4 sm:p-6">
          <div className="mb-7 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-16 w-16 border border-border">
                <AvatarImage src={profile.photo || undefined} alt="Foto de perfil" className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(profile)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-foreground">
                  {profile.name || "Seu perfil profissional"}
                </h2>
                <p className="truncate text-sm text-muted-foreground">
                  {profile.email || "E-mail não informado"}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {professionalLabel}
                </p>
              </div>
            </div>

            <Badge variant={profileProgress.value >= 85 ? "default" : "secondary"} className="w-fit gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {profileProgress.value}% completo
            </Badge>
          </div>

          <ProfilePhotoPicker photo={profile.photo} onChange={(photo) => handleChange("photo", photo)}
            onProcessingChange={setIsPreparingPhoto} disabled={isSavingProfile || isLoadingProfile} />

          <div className="mb-6"><ProfileImportDialog profile={profile} accountKey={user?.email} disabled={!isReady || Boolean(pendingDraft) || isSavingProfile || isPreparingPhoto} onApply={(values) => {
            setProfile((current) => ({ ...current, ...values }));
            setSavedMessage(""); setSaveError(""); setFieldErrors([]);
          }} /></div>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Dados pessoais</h3>
                <p className="text-xs text-muted-foreground">Contato e identificação da conta.</p>
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
                  placeholder="seu@email.com"
                  readOnly
                  disabled
                  className="cursor-not-allowed bg-muted/50"
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
                <Label htmlFor="location">Localização</Label>
                <LocationAutocomplete
                  value={profile.location}
                  onChange={(value) => handleChange("location", value)}
                  options={locationOptions}
                  isLoading={isFetchingCities && !cityOptions?.length}
                  hasError={isCityOptionsError}
                />
              </div>
            </div>
          </section>

          <section className="mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Objetivo profissional</h3>
                <p className="text-xs text-muted-foreground">Foco, experiência e resumo de carreira.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="headline">Título profissional</Label>
                <Input
                  id="headline"
                  value={profile.headline}
                  onChange={(event) => handleChange("headline", event.target.value)}
                  placeholder="Ex.: Desenvolvedor Frontend Júnior"
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
                <Label htmlFor="experienceLevel">Nível de experiência</Label>
                <Select
                  value={profile.experienceLevel}
                  onValueChange={(value) => handleChange("experienceLevel", value)}
                >
                  <SelectTrigger id="experienceLevel" className="h-10">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={profile.linkedin}
                  onChange={(event) => handleChange("linkedin", event.target.value)}
                  placeholder="linkedin.com/in/seu-perfil"
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {profile.linkedin && !isValidUrl(normalizeUrl(profile.linkedin))
                    ? "Link inválido"
                    : "Perfil público ou currículo online."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfólio</Label>
                <Input
                  id="portfolio"
                  value={profile.portfolio}
                  onChange={(event) => handleChange("portfolio", event.target.value)}
                  placeholder="github.com/seu-usuario"
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {profile.portfolio && !isValidUrl(normalizeUrl(profile.portfolio))
                    ? "Link inválido"
                    : "GitHub, portfólio ou site pessoal."}
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="summary">Resumo profissional</Label>
                <Textarea
                  id="summary"
                  value={profile.summary}
                  onChange={(event) => handleChange("summary", event.target.value.slice(0, 600))}
                  placeholder="Escreva um resumo curto sobre sua experiência, foco e objetivos."
                  className="min-h-28"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Ideal: 2 a 4 frases com foco, stack e objetivo.</span>
                  <span>{profile.summary.length}/600</span>
                </div>
              </div>
            </div>
          </section>
          <ProfessionalProfile profile={profile} onChange={handleChange} fieldErrors={fieldErrors} focusRequest={focusRequest} />
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Preenchimento do perfil</h3>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{profileProgress.completed}/{profileProgress.total} campos essenciais</span>
              <span>{profileProgress.value}%</span>
            </div>
            <Progress value={profileProgress.value} />

            {profileProgress.missing.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profileProgress.missing.map(([field, label]) => (
                  <Button key={field} type="button" variant="outline" size="sm" onClick={() => focusMissingField(field)} aria-label={`Preencher ${label.toLowerCase()}`}>{label}</Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Prévia do perfil</h3>
            </div>

            <p className="text-base font-semibold text-foreground">
              {professionalLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {contextLine || "Informe senioridade e localização para melhorar o match."}
            </p>
            <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted-foreground">
              {profile.summary || "Adicione um resumo profissional curto para orientar a IA."}
            </p>

            {profileLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profileLinks.map(([label, url]) => (
                  <Button key={label} asChild variant="outline" size="sm">
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {label}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{profile.email || "E-mail não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{profile.phone || "Telefone não informado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{profile.location || "Localização não informada"}</span>
              </div>
            </div>

          </Card>

          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Dados e privacidade</h3>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Analytics privado</p>
                  <p className="text-xs text-muted-foreground">Mede uso sem enviar currículo, nome ou e-mail.</p>
                </div>
                <Switch checked={privateAnalyticsEnabled} onCheckedChange={updatePrivateAnalytics} aria-label="Permitir analytics privado" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(privacyAction)}
                onClick={handleExportData}
              >
                <Download className="h-4 w-4" />
                Exportar meus dados
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(privacyAction)}
                onClick={handleClearResumeTexts}
              >
                <FileX className="h-4 w-4" />
                Apagar textos extraidos
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={Boolean(privacyAction)}
                onClick={handleDeleteAnalyses}
              >
                <Trash2 className="h-4 w-4" />
                Apagar analises
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start"
                disabled={Boolean(privacyAction)}
                onClick={handleDeleteAccount}
              >
                <Trash2 className="h-4 w-4" />
                Excluir conta
              </Button>
            </div>

            <div className="mt-4 min-h-5 text-sm">
              {privacyError ? (
                <p className="text-destructive">{privacyError}</p>
              ) : (
                <p className="text-emerald-600">{privacyMessage}</p>
              )}
            </div>
          </Card>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
