import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const APPLICATION_STAGES = { saved: "Salva", applied: "Candidatura enviada", interview: "Entrevista", offer: "Proposta", rejected: "Não avançou", archived: "Arquivada" };
const localDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function ApplicationDialog({ application, onClose }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ status: application.status, notes: application.notes, next_action: application.next_action || "", applied_at: application.applied_at?.slice(0, 10) || "", interview_at: localDateTime(application.interview_at), reminder_at: localDateTime(application.reminder_at), resume_version_id: application.resume_version?.id || "" });
  const [saving, setSaving] = useState(false);
  const versions = useQuery({ queryKey: ["resume-workspace", application.analysis_id], queryFn: () => base44.analysis.getWorkspace(application.analysis_id), enabled: Boolean(application.analysis_id) });
  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function save(event) {
    event.preventDefault(); setSaving(true);
    try {
      await base44.jobs.update(application.external_id, { ...form,
        applied_at: form.applied_at ? new Date(`${form.applied_at}T12:00:00`).toISOString() : form.status === "applied" && application.status !== "applied" ? new Date().toISOString() : null,
        interview_at: form.interview_at ? new Date(form.interview_at).toISOString() : null,
        reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
        resume_version_id: form.resume_version_id || null,
      });
      await client.invalidateQueries({ queryKey: ["tracked-jobs"] });
      base44.analytics.track("application_updated", { status: form.status });
      if (form.status !== application.status) base44.analytics.track("job_status_changed", { status: form.status });
      toast.success("Candidatura atualizada"); onClose();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="break-words">{application.job.title}</DialogTitle><DialogDescription>{application.job.company || "Candidatura"}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={save}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="application-status">Etapa da candidatura</Label><select id="application-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={change("status")}>{Object.entries(APPLICATION_STAGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><Label htmlFor="application-date">Data de envio</Label><Input id="application-date" type="date" value={form.applied_at} onChange={change("applied_at")} /></div></div>
      <div className="space-y-2"><Label htmlFor="application-version">Currículo vinculado</Label><select id="application-version" className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={form.resume_version_id} disabled={versions.isLoading || versions.isError} onChange={change("resume_version_id")}><option value="">Sem versão vinculada</option>{(versions.data?.versions || []).map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}</select>{versions.isError && <p role="alert" className="text-xs text-destructive">Não foi possível carregar as versões. <button type="button" className="underline" onClick={() => versions.refetch()}>Tentar novamente</button></p>}{application.submitted_resume_version && <p className="text-xs text-muted-foreground">Versão enviada: {application.submitted_resume_version.name}</p>}{application.analysis_id && <Button asChild size="sm" variant="outline"><Link to={`/resume?id=${encodeURIComponent(application.analysis_id)}&job=${encodeURIComponent(application.external_id)}`}><FileText className="h-4 w-4" />Abrir currículo</Link></Button>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="interview-date">Entrevista</Label><Input id="interview-date" type="datetime-local" value={form.interview_at} onChange={change("interview_at")} /></div><div className="space-y-2"><Label htmlFor="reminder-date">Lembrete na jornada</Label><Input id="reminder-date" type="datetime-local" value={form.reminder_at} onChange={change("reminder_at")} /></div></div>
      <div className="space-y-2"><Label htmlFor="next-action">Próxima ação</Label><Input id="next-action" maxLength={200} value={form.next_action} onChange={change("next_action")} placeholder="Retornar ao recrutador" /></div><div className="space-y-2"><Label htmlFor="application-notes">Anotações</Label><Textarea id="application-notes" className="min-h-28" value={form.notes} maxLength={2000} onChange={change("notes")} /></div>
      <Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar candidatura"}</Button>
    </form>
  </DialogContent></Dialog>;
}
