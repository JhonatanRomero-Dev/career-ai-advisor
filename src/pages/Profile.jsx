import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Target,
  Upload,
  User,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const PROFILE_KEY = "career-ai-user-profile";
const BRAZILIAN_CITIES_API_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

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

const profileFields = [
  ["name", "nome"],
  ["phone", "telefone"],
  ["location", "localização"],
  ["headline", "título profissional"],
  ["targetRole", "cargo desejado"],
  ["experienceLevel", "nível de experiência"],
  ["summary", "resumo profissional"],
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

const fallbackLocationOptions = [
  ["Piraquara", "PR"],
  ["Pirai do Sul", "PR"],
  ["Piracicaba", "SP"],
  ["Piraju", "SP"],
  ["Pirapora", "MG"],
  ["Piracaia", "SP"],
  ["Piracanjuba", "GO"],
  ["Piranhas", "AL"],
  ["Curitiba", "PR"],
  ["Sao Paulo", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Florianopolis", "SC"],
].map(([city, state]) => createLocationOption(city, state));

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

function normalizeLocationSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function createLocationOption(city = "", state = "") {
  const cleanCity = String(city || "").trim();
  const cleanState = String(state || "").trim().toUpperCase();

  if (!cleanCity) {
    return null;
  }

  const label = cleanState ? `${cleanCity}, ${cleanState}` : cleanCity;

  return {
    city: cleanCity,
    citySearch: normalizeLocationSearch(cleanCity),
    label,
    search: normalizeLocationSearch(`${cleanCity} ${cleanState} ${label}`),
    state: cleanState,
  };
}

async function fetchBrazilianCityOptions() {
  const response = await fetch(BRAZILIAN_CITIES_API_URL);

  if (!response.ok) {
    throw new Error("Não foi possível carregar cidades.");
  }

  const cityData = await response.json();
  const uniqueOptions = new Map();

  cityData.forEach((city) => {
    const state =
      city?.microrregiao?.mesorregiao?.UF?.sigla ||
      city?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ||
      "";
    const option = createLocationOption(city?.nome, state);

    if (option && !uniqueOptions.has(option.label)) {
      uniqueOptions.set(option.label, option);
    }
  });

  return Array.from(uniqueOptions.values());
}

function getLocationSuggestions(options = [], query = "") {
  const normalizedQuery = normalizeLocationSearch(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  return options
    .map((option) => {
      if (option.citySearch.startsWith(normalizedQuery)) {
        return { option, score: 0 };
      }

      if (option.search.includes(normalizedQuery)) {
        return { option, score: 1 };
      }

      return null;
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.option.label.localeCompare(b.option.label, "pt-BR")
    )
    .slice(0, 8)
    .map(({ option }) => option);
}

function getProfileProgress(profileData = {}) {
  const completed = profileFields.filter(([field]) => String(profileData[field] || "").trim()).length;

  return {
    completed,
    total: profileFields.length,
    value: Math.round((completed / profileFields.length) * 100),
    missing: profileFields
      .filter(([field]) => !String(profileData[field] || "").trim())
      .map(([, label]) => label),
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
  const [profile, setProfile] = useState(defaultProfile);
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

  useEffect(() => {
    const localProfile = getLocalProfile(profileStorageKey, user?.email);
    const remoteProfile = savedProfile?.updated_date ? savedProfile : {};

    setProfile({
      ...defaultProfile,
      ...localProfile,
      ...remoteProfile,
      name: savedProfile?.name || localProfile.name || user?.name || "",
      email: user?.email || savedProfile?.email || localProfile.email || "",
    });
  }, [profileStorageKey, savedProfile, user]);

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
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setSaveError("");
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

      setProfile(normalizedProfile);
      localStorage.setItem(profileStorageKey, JSON.stringify(normalizedProfile));
      queryClient.setQueryData(["user-profile", user?.email], normalizedProfile);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      setSavedMessage("Perfil salvo com sucesso.");
    } catch {
      const localProfile = {
        ...cleanProfile,
        email: user?.email || cleanProfile.email,
      };

      localStorage.setItem(profileStorageKey, JSON.stringify(localProfile));
      setProfile(localProfile);
      setSaveError("Não foi possível sincronizar agora. Salvei uma cópia neste navegador.");
      setSavedMessage("Não foi possível sincronizar agora. Salvei uma cópia neste navegador.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados usados para personalizar análises, vagas e próximos passos.
          </p>
        </div>

        <Button asChild size="sm" variant="outline">
          <Link to="/upload">
            <Upload className="h-4 w-4" />
            Enviar currículo
          </Link>
        </Button>
      </div>

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

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <Card className="border-border/50 p-6">
          <div className="mb-7 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-16 w-16 border border-border">
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
        </Card>

        <div className="space-y-6">
          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Qualidade do perfil</h3>
            </div>

            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{profileProgress.completed}/{profileProgress.total} campos essenciais</span>
              <span>{profileProgress.value}%</span>
            </div>
            <Progress value={profileProgress.value} />

            {profileProgress.missing.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {profileProgress.missing.slice(0, 6).map((item) => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Preview</h3>
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

            <div className="mt-5 border-t border-border/60 pt-4">
              <div className="min-h-5">
                {saveError ? (
                  <p className="text-sm text-destructive">{saveError}</p>
                ) : (
                  <p className="text-sm text-emerald-600">{savedMessage}</p>
                )}
              </div>
              <Button type="submit" className="mt-3 w-full" disabled={isSavingProfile || isLoadingProfile}>
                <Save className="h-4 w-4" />
                {isSavingProfile ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </Card>
        </div>
      </motion.form>
    </div>
  );
}
