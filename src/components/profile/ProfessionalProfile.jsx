import React, { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink, Github, Linkedin, Globe, Award, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import SkillAutocomplete from "./SkillAutocomplete";

const sections = [["experiences", "Experiências", "Cargo", "Empresa"], ["projects", "Projetos", "Nome do projeto", "Tecnologias / cliente"], ["certificates", "Certificados", "Nome do certificado", "Instituição"], ["achievements", "Conquistas", "Título da conquista", "Organização"]];
const safeLink = (value) => /^https?:\/\//i.test(value || "") ? value : undefined;

export function ProfileDisplay({ profile }) {
  return <div className="space-y-6">
    <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
      <Avatar className="mb-4 h-16 w-16"><AvatarImage src={profile.photo || undefined} alt={`Foto de ${profile.name || "perfil"}`} className="object-cover" /><AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">{(profile.name || "P").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
      <h1 className="text-2xl font-bold">{profile.name || "Seu nome"}</h1><p className="mt-1 text-lg text-primary">{profile.headline || "Seu título profissional"}</p><p className="mt-2 text-sm text-muted-foreground">{profile.location}</p>
      <div className="mt-4 flex flex-wrap gap-3">{[["linkedin", "LinkedIn", Linkedin], ["github", "GitHub", Github], ["portfolio", "Portfólio", Globe]].map(([key, label, Icon]) => safeLink(profile[key]) && <a key={key} href={profile[key]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"><Icon className="h-4 w-4" />{label}<ExternalLink className="h-3 w-3" /></a>)}</div>
    </div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Sobre</h2><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{profile.summary || "Adicione um resumo profissional para apresentar sua trajetória."}</p><div className="flex flex-wrap gap-2">{profile.skills?.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}</div></section>
    {sections.map(([key, label]) => !!profile[key]?.length && <section key={key} className="space-y-3"><h2 className="flex items-center gap-2 text-lg font-semibold">{key === "certificates" || key === "achievements" ? <Award className="h-4 w-4 text-primary" /> : <BriefcaseBusiness className="h-4 w-4 text-primary" />}{label}</h2><div className={key === "projects" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>{profile[key].map((entry) => <article key={entry.id} className="rounded-lg border p-4"><h3 className="break-words font-semibold">{entry.title}</h3><p className="mt-1 text-sm text-primary">{entry.organization}</p><p className="mt-1 text-xs text-muted-foreground">{[entry.start, entry.end].filter(Boolean).join(" – ")}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.description}</p>{safeLink(entry.url) && <a href={entry.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline">Ver detalhes<ExternalLink className="h-3 w-3" /></a>}</article>)}</div></section>)}
  </div>;
}

export default function ProfessionalProfile({ profile, onChange, fieldErrors = [], focusRequest }) {
  const [preview, setPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("experiences");
  const firstError = fieldErrors.find((item) => sections.some(([key]) => key === item.path?.[0]));
  const [errorSection, errorIndex, errorField] = firstError?.path || [];
  const errorEntry = profile[errorSection]?.[errorIndex];
  const errorInputId = errorEntry && errorField ? `${errorEntry.id}-${errorField}` : "";
  useEffect(() => {
    if (!errorInputId) return;
    setPreview(false);
    setActiveTab(errorSection);
  }, [errorInputId, errorSection]);
  useEffect(() => {
    // Focus after the requested tab has rendered its fields.
    if (!errorInputId || preview || activeTab !== errorSection) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(errorInputId)?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, preview, errorInputId, errorSection]);
  useEffect(() => {
    if (!focusRequest) return;
    setPreview(false);
    if (focusRequest.field !== "skills") setActiveTab(focusRequest.field);
  }, [focusRequest]);
  useEffect(() => {
    if (!focusRequest || preview || (focusRequest.field !== "skills" && activeTab !== focusRequest.field)) return;
    const frame = window.requestAnimationFrame(() => {
      const container = document.getElementById(`profile-${focusRequest.field}`);
      const target = container?.querySelector('input:not([disabled]), button[data-add-entry]');
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest, preview, activeTab]);
  const getFieldError = (section, index, field) => fieldErrors.find((item) => item.path?.[0] === section && item.path[1] === index && item.path[2] === field)?.message;
  const updateEntry = (key, id, field, value) => onChange(key, (profile[key] || []).map((entry) => entry.id === id ? { ...entry, [field]: value } : entry));
  return <section className="mt-8 min-w-0 space-y-5 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Sua trajetória profissional</h3><p className="text-xs text-muted-foreground">Destaque competências, entregas e resultados.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setPreview(!preview)}>{preview ? "Continuar editando" : "Visualizar perfil"}</Button></div>
    {preview ? <ProfileDisplay profile={profile} /> : <>
      <div className="space-y-2"><Label htmlFor="github">GitHub</Label><Input id="github" type="url" value={profile.github || ""} onChange={(event) => onChange("github", event.target.value)} placeholder="https://github.com/seu-usuario" /></div>
      <div id="profile-skills"><SkillAutocomplete value={profile.skills || []} onChange={(skills) => onChange("skills", skills)} /></div>
      <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 xl:grid-cols-4">{sections.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList>
        {sections.map(([key, label, title, organization]) => <TabsContent key={key} value={key} className="space-y-3"><div id={`profile-${key}`} className="space-y-3">
          {!(profile[key]?.length) && <p className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">Adicione {label.toLowerCase()} para enriquecer seu perfil.</p>}
          {(profile[key] || []).map((entry, index) => <div key={entry.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between"><span className="text-sm font-medium">{label} · {index + 1}</span><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${entry.title || label}`} onClick={() => onChange(key, profile[key].filter((item) => item.id !== entry.id))}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid gap-3 sm:grid-cols-2">{[["title", title, 200], ["organization", organization, 200], ["start", "Início / emissão", 30], ["end", "Fim / validade (ou Atual)", 30], ["url", "Link público (opcional)", 2048]].map(([field, fieldLabel, maxLength]) => <div key={field} className={`space-y-1.5 ${field === "url" ? "sm:col-span-2" : ""}`}><Label htmlFor={`${entry.id}-${field}`}>{fieldLabel}{field === "title" && <span aria-hidden="true" className="ml-1 text-destructive">*</span>}</Label><Input id={`${entry.id}-${field}`} type={field === "url" ? "url" : "text"} value={entry[field] || ""} maxLength={maxLength} aria-required={field === "title" || undefined} aria-invalid={Boolean(getFieldError(key, index, field))} aria-describedby={getFieldError(key, index, field) ? `${entry.id}-${field}-error` : undefined} onChange={(event) => updateEntry(key, entry.id, field, event.target.value)} />{getFieldError(key, index, field) && <p id={`${entry.id}-${field}-error`} className="text-sm text-destructive">{getFieldError(key, index, field)}</p>}</div>)}</div>
            <Label htmlFor={`${entry.id}-description`}>Descrição e resultados</Label><Textarea id={`${entry.id}-description`} value={entry.description || ""} maxLength={2000} placeholder="Descreva suas contribuições e resultados, com números quando disponíveis." onChange={(event) => updateEntry(key, entry.id, "description", event.target.value)} />
          </div>)}
          <Button data-add-entry type="button" size="sm" variant="outline" disabled={profile[key]?.length >= 30} onClick={() => onChange(key, [...(profile[key] || []), { id: crypto.randomUUID(), title: "", organization: "", start: "", end: "", description: "", url: "" }])}><Plus className="h-4 w-4" />Adicionar {label.toLowerCase()}</Button>
        </div></TabsContent>)}
      </Tabs>
    </>}
    <div className="space-y-3 rounded-lg bg-muted/50 p-4"><div className="flex items-center justify-between gap-4"><Label htmlFor="public-profile">Disponibilizar perfil público</Label><Switch id="public-profile" checked={profile.publicEnabled === true} onCheckedChange={(value) => onChange("publicEnabled", value)} /></div><p className="text-xs text-muted-foreground">Ao salvar com esta opção ativa, nome, foto, cidade, resumo, links e trajetória ficam acessíveis a quem tiver o link. E-mail e telefone ficam privados.</p>{profile.publicId && profile.publicEnabled && <a className="inline-flex items-center gap-1 break-all text-sm text-primary underline" href={`/p/${profile.publicId}`} target="_blank" rel="noopener noreferrer">Abrir perfil público salvo<ExternalLink className="h-3 w-3" /></a>}</div>
  </section>;
}
