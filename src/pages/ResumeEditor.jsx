import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, Loader2, Save, Trash2, Undo2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resumeParagraphs, replaceResumeExcerpt } from "@/lib/resumeDocument";
import { createResumePdf, createResumeDocx, downloadResume } from "@/lib/resumeExport";

const selectClass = "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm";

export default function ResumeEditor() {
  const [params] = useSearchParams();
  const id = params.get("id");
  if (!id) return <div className="space-y-4 p-6"><h1 className="text-xl font-semibold">Escolha um currículo</h1><Button asChild><Link to="/history">Abrir histórico</Link></Button></div>;
  return <Editor key={`${id}:${params.get("job") || ""}`} id={id} jobId={params.get("job") || ""} initialVersion={params.get("version") || ""} initialSuggestion={params.get("suggestion") || ""} />;
}

function Editor({ id, jobId, initialVersion, initialSuggestion }) {
  const client = useQueryClient();
  const workspace = useQuery({ queryKey: ["resume-workspace", id], queryFn: () => base44.analysis.getWorkspace(id) });
  const tracked = useQuery({ queryKey: ["tracked-jobs"], queryFn: base44.jobs.listTracked, enabled: Boolean(jobId) });
  const target = tracked.data?.find((item) => item.external_id === jobId);
  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [name, setName] = useState("");
  const [versionId, setVersionId] = useState("");
  const [mode, setMode] = useState("edit");
  const [suggestion, setSuggestion] = useState(initialSuggestion || "Melhore clareza e objetividade, preservando os fatos.");
  const [selection, setSelection] = useState(null);
  const [revision, setRevision] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState("");
  const initialized = useRef(false);
  const targetInitialized = useRef(false);
  const editor = useRef(null);
  const dirty = content !== savedContent;
  const paragraphs = useMemo(() => resumeParagraphs(content), [content]);
  const versions = workspace.data?.versions || [];

  useEffect(() => {
    if (!workspace.data || initialized.current) return;
    initialized.current = true;
    const version = initialVersion ? workspace.data.versions.find((item) => item.id === initialVersion) : workspace.data.versions[0];
    const text = version?.content || workspace.data.source_text || "";
    setContent(text); setBaseline(text); setSavedContent(text);
    setVersionId(version?.id || ""); setName(version?.name || "Meu currículo revisado");
    if (!jobId) { setTitle(workspace.data.analysis.target_job_title || ""); setDescription(workspace.data.analysis.target_job_description || ""); }
    base44.analytics.track("resume_editor_opened", { has_target_job: Boolean(jobId) });
  }, [workspace.data, initialVersion, jobId]);

  useEffect(() => {
    if (!target || targetInitialized.current) return;
    targetInitialized.current = true;
    setTitle(String(target.job.title || "").slice(0, 200));
    const details = target.job.description || target.job.summary || (target.job.required_skills || []).join(", ");
    setDescription(String(details).slice(0, 12000));
    setName(`${target.job.company || "Candidatura"} - ${target.job.title || "Currículo"}`.slice(0, 120));
    setSuggestion("Adapte este trecho aos requisitos da vaga usando somente experiências e habilidades comprovadas no texto.");
  }, [target]);

  useEffect(() => {
    if (!dirty) return;
    const preventClose = (event) => { event.preventDefault(); event.returnValue = ""; };
    const preventNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (anchor && anchor.target !== "_blank" && !anchor.download && !window.confirm("Há alterações não salvas. Sair do editor?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", preventClose);
    document.addEventListener("click", preventNavigation, true);
    return () => { window.removeEventListener("beforeunload", preventClose); document.removeEventListener("click", preventNavigation, true); };
  }, [dirty]);

  function loadVersion(nextId) {
    if (dirty && !window.confirm("Descartar as alterações não salvas e abrir esta versão?")) return;
    const version = versions.find((item) => item.id === nextId);
    const text = version?.content || workspace.data.source_text || "";
    setVersionId(nextId); setContent(text); setBaseline(text); setSavedContent(text);
    if (version) setName(version.name);
    setSelection(null); setRevision(null); setPrevious(null);
  }

  async function save() {
    setBusy("save");
    try {
      const version = await base44.analysis.saveVersion(id, { name: name.trim(), content, ...(jobId ? { job_external_id: jobId } : {}) });
      client.setQueryData(["resume-workspace", id], (current) => ({ ...current, versions: [version, ...current.versions] }));
      setSavedContent(version.content); setVersionId(version.id);
      client.invalidateQueries({ queryKey: ["tracked-jobs"] });
      base44.analytics.track("resume_version_saved", { has_target_job: Boolean(jobId) });
      toast.success(jobId ? "Versão salva e vinculada à candidatura" : "Versão salva");
    } catch (error) { toast.error(error.message); }
    finally { setBusy(""); }
  }

  async function removeVersion() {
    if (!window.confirm("Excluir esta versão salva? O texto aberto continuará no editor.")) return;
    setBusy("delete");
    try {
      await base44.analysis.deleteVersion(id, versionId);
      client.setQueryData(["resume-workspace", id], (current) => ({ ...current, versions: current.versions.filter((item) => item.id !== versionId) }));
      client.invalidateQueries({ queryKey: ["tracked-jobs"] });
      setVersionId(""); setSavedContent(""); toast.success("Versão excluída");
    } catch (error) { toast.error(error.message); }
    finally { setBusy(""); }
  }

  async function revise() {
    const excerpt = selection || (content.length <= 6000 ? { text: content, start: 0, end: content.length } : paragraphs.find((item) => item.text.length <= 6000));
    if (!excerpt || excerpt.text.length > 6000 || !excerpt.text.trim()) { toast.error("Selecione um trecho de até 6 mil caracteres."); return; }
    setBusy("revision");
    try {
      const result = await base44.analysis.proposeRevision(id, { original: excerpt.text, suggestion, target_job_title: title, target_job_description: description });
      setRevision({ ...result, excerpt });
    } catch (error) { toast.error(error.message); }
    finally { setBusy(""); }
  }

  function approve() {
    try {
      const next = replaceResumeExcerpt(content, revision.excerpt, revision.proposal);
      if (next.length > 120000) throw new Error("O currículo excederia 120 mil caracteres.");
      setPrevious(content); setContent(next); setRevision(null); setSelection(null);
      base44.analytics.track("resume_revision_applied", { has_target_job: Boolean(description.trim()) });
      toast.success("Revisão aplicada ao rascunho");
    } catch (error) { toast.error(error.message); }
  }

  async function exportFile(format) {
    setBusy("export");
    try {
      const blob = format === "pdf" ? await createResumePdf(content) : createResumeDocx(content);
      downloadResume(blob, name, format);
      base44.analytics.track("resume_exported", { format, has_target_job: Boolean(jobId) });
    } catch { toast.error("Não foi possível exportar o currículo."); }
    finally { setBusy(""); }
  }

  if (workspace.isLoading) return <p role="status" className="p-8">Carregando currículo...</p>;
  if (workspace.isError) return <div role="alert" className="space-y-4 p-8"><p>{workspace.error.message}</p><Button onClick={() => workspace.refetch()}>Tentar novamente</Button><Button asChild variant="outline"><Link to="/history">Histórico</Link></Button></div>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><Link className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground" to={`/analysis?id=${encodeURIComponent(id)}`}><ArrowLeft className="h-4 w-4" />Relatório</Link><h1 className="text-2xl font-bold">Editar currículo</h1><p className="mt-1 break-words text-sm text-muted-foreground">{workspace.data.analysis.file_name}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => exportFile("pdf")} disabled={!!busy || !content.trim()}><Download className="h-4 w-4" />Baixar PDF</Button><Button variant="outline" onClick={() => exportFile("docx")} disabled={!!busy || !content.trim()}><Download className="h-4 w-4" />DOCX</Button></div>
    </header>
    {!workspace.data.source_text && <p role="status" className="border-l-2 border-amber-500 pl-3 text-sm">O texto original não está disponível. Abra uma versão salva ou preencha o currículo.</p>}
    {jobId && <section className="space-y-3 border-y py-4"><h2 className="font-semibold">Candidatura{target ? `: ${target.job.company || target.job.title}` : ""}</h2>{tracked.isError ? <p role="alert">Não foi possível carregar a vaga. <button className="underline" onClick={() => tracked.refetch()}>Tentar novamente</button></p> : tracked.isLoading ? <p role="status">Carregando vaga...</p> : !target ? <p role="alert">Esta vaga não está mais salva. Volte à busca para selecioná-la.</p> : null}
      <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="target-title">Cargo alvo</Label><Input id="target-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="target-description">Requisitos da vaga</Label><Textarea id="target-description" value={description} maxLength={12000} onChange={(event) => setDescription(event.target.value)} /></div></div></section>}
    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-2"><Label htmlFor="resume-version">Versão aberta</Label><select id="resume-version" className={selectClass} value={versionId} disabled={!!busy} onChange={(event) => loadVersion(event.target.value)}><option value="">Original</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} · {new Date(version.created_at).toLocaleString("pt-BR")}</option>)}</select></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="version-name">Nome da nova versão</Label><Input id="version-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></div>
      <div className="flex gap-2"><Button onClick={save} disabled={!!busy || !content.trim() || !name.trim() || (jobId && !target)}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar versão</Button><Button size="icon" variant="outline" title="Excluir versão salva" aria-label="Excluir versão salva" disabled={!!busy || !versionId} onClick={removeVersion}><Trash2 className="h-4 w-4" /></Button></div>
    </div>
    <Tabs value={mode} onValueChange={setMode}>
    <div className="flex flex-wrap items-center justify-between gap-3"><TabsList><TabsTrigger value="edit">Editar</TabsTrigger><TabsTrigger value="compare">Comparar</TabsTrigger></TabsList><span className="text-xs text-muted-foreground" role="status">{dirty ? "Alterações não salvas" : "Sem alterações pendentes"}</span></div>
    <TabsContent value={mode}>
    <div className={mode === "compare" ? "grid min-w-0 gap-4 lg:grid-cols-2" : "min-w-0"}>
      {mode === "compare" && <section className="min-w-0 space-y-2"><h2 className="text-sm font-semibold">Antes</h2><pre className="min-h-96 max-h-[650px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-sans text-sm leading-relaxed">{baseline || "Original indisponível"}</pre></section>}
      <section className="min-w-0 space-y-2"><div className="flex items-center justify-between"><Label htmlFor="resume-content">{mode === "compare" ? "Depois" : "Currículo"}</Label><Button size="icon" variant="ghost" title="Desfazer última revisão" aria-label="Desfazer última revisão" disabled={previous === null || !!busy} onClick={() => { setContent(previous); setPrevious(null); setSelection(null); setRevision(null); }}><Undo2 className="h-4 w-4" /></Button></div><Textarea ref={editor} id="resume-content" value={content} maxLength={120000} disabled={!!busy} className="min-h-[480px] resize-y text-sm leading-relaxed" onChange={(event) => { setContent(event.target.value); setSelection(null); }} onSelect={(event) => { const { selectionStart: start, selectionEnd: end } = event.currentTarget; if (end > start) setSelection({ start, end, text: content.slice(start, end) }); }} /></section>
    </div>
    </TabsContent></Tabs>
    <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Revisão de trecho</h2>
      <div className="grid gap-4 md:grid-cols-2"><div className="min-w-0 space-y-2"><Label htmlFor="resume-excerpt">Trecho</Label><select id="resume-excerpt" className={selectClass} value={selection ? String(selection.start) : ""} onChange={(event) => { setSelection(paragraphs.find((part) => String(part.start) === event.target.value) || null); setRevision(null); }}><option value="">{content.length <= 6000 ? "Currículo completo" : "Primeiro trecho disponível"}</option>{selection && !paragraphs.some((part) => part.start === selection.start) && <option value={selection.start}>Seleção no editor</option>}{paragraphs.map((part) => <option key={part.start} value={part.start} disabled={part.text.length > 6000}>{part.text.slice(0, 100)}</option>)}</select></div><div className="space-y-2"><Label htmlFor="revision-instruction">Objetivo da revisão</Label><Textarea id="revision-instruction" value={suggestion} maxLength={2000} onChange={(event) => setSuggestion(event.target.value)} /></div></div>
      <Button onClick={revise} disabled={!!busy || !content.trim() || !suggestion.trim() || (jobId && !description.trim())}>{busy === "revision" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Propor revisão</Button>
      {revision && <div className="space-y-4 rounded-lg border p-4"><p role="status" className="text-sm text-muted-foreground">{revision.message}</p><div className="grid min-w-0 gap-4 md:grid-cols-2"><div className="min-w-0"><h3 className="mb-2 text-sm font-semibold">Trecho original</h3><p className="whitespace-pre-wrap break-words text-sm">{revision.original}</p></div><div className="min-w-0 space-y-2"><Label htmlFor="revision-proposal">Proposta para aprovação</Label><Textarea id="revision-proposal" className="min-h-44" value={revision.proposal} maxLength={12000} onChange={(event) => setRevision({ ...revision, proposal: event.target.value })} /></div></div><div className="flex flex-wrap gap-2"><Button onClick={approve} disabled={!revision.proposal.trim()}><Check className="h-4 w-4" />Aprovar alteração</Button><Button variant="outline" onClick={() => setRevision(null)}><X className="h-4 w-4" />Descartar proposta</Button></div></div>}
    </section>
  </div>;
}
