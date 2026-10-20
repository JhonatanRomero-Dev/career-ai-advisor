import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquareText, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const FEEDBACK_STATUS = { new: "Recebido", reviewing: "Em análise", planned: "Planejado", resolved: "Resolvido" };
export const TEST_TASKS = [
  { id: "analyze", label: "Analise um currículo com uma vaga alvo", path: "/upload" },
  { id: "revise", label: "Revise um trecho e salve uma versão do currículo", path: "/analysis" },
  { id: "export", label: "Baixe o currículo revisado em PDF", path: "/analysis" },
  { id: "apply", label: "Vincule uma versão a uma vaga e registre a candidatura", path: "/jobs" },
  { id: "search", label: "Encontre uma vaga e salve uma pesquisa com dois filtros", path: "/jobs" },
  { id: "profile", label: "Adicione uma habilidade e um projeto ao perfil", path: "/profile" },
  { id: "login", label: "Avalie sua experiência ao entrar ou recuperar a senha", path: "/login" },
  { id: "support", label: "Pergunte ao suporte como melhorar seu currículo", path: "/support" },
];
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export default function Feedback() {
  const client = useQueryClient();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("experience");
  const [message, setMessage] = useState("");
  const [volunteer, setVolunteer] = useState(false);
  const [audience, setAudience] = useState("");
  const [tasks, setTasks] = useState({});
  const query = useQuery({ queryKey: ["my-feedback"], queryFn: () => base44.product.request("/feedback") });
  const mutation = useMutation({
    mutationFn: () => base44.product.request("/feedback", "POST", { category, rating, message: message.trim(), volunteer, audience, page: "/feedback", tasks: TEST_TASKS.map(({ id }) => ({ id, result: tasks[id] || "untested" })) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["my-feedback"] }); setMessage(""); setRating(0); setTasks({}); setVolunteer(false); },
  });
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><MessageSquareText className="h-3.5 w-3.5" />Construído com você</div><h1 className="text-2xl font-bold">Sua experiência importa</h1><p className="mt-2 text-sm text-muted-foreground">Conte o que funcionou, onde encontrou dificuldades e o que podemos melhorar.</p></div>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card className="space-y-5 p-5"><h2 className="font-semibold">Envie seu feedback</h2><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <fieldset><legend className="mb-2 text-sm font-medium">Como foi sua experiência?</legend><div className="flex gap-2" role="radiogroup" aria-label="Avaliação da experiência">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="relative cursor-pointer"><input className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`} /><span className="flex h-11 w-11 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-ring"><Star className={`h-6 w-6 ${rating >= value ? "fill-amber-400 text-amber-600" : "text-muted-foreground"}`} /></span></label>)}</div></fieldset>
        <div className="space-y-2"><Label htmlFor="feedback-category">Tipo de feedback</Label><select id="feedback-category" className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}>{[["experience", "Experiência geral"], ["suggestion", "Sugestão"], ["bug", "Problema ou erro"], ["support", "Atendimento / suporte"], ["usability", "Teste de usabilidade"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="feedback-message">O que aconteceu ou poderia melhorar?</Label><Textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={4000} required className="min-h-36" placeholder="Descreva a tarefa, o que esperava e o que encontrou. Evite senhas e informações sensíveis." /><p className="text-right text-xs text-muted-foreground">{message.length}/4000</p></div>
        <div className="space-y-2"><Label htmlFor="feedback-audience">Seu momento profissional (opcional)</Label><select id="feedback-audience" value={audience} className={selectClass} onChange={(event) => setAudience(event.target.value)}><option value="">Prefiro não informar</option><option value="first-job">Primeiro emprego</option><option value="transition">Transição de carreira</option><option value="experienced">Profissional com experiência</option><option value="recruiter">Recrutador(a)</option></select></div>
        <div className="flex items-start gap-3"><Checkbox id="feedback-volunteer" checked={volunteer} onCheckedChange={(value) => setVolunteer(value === true)} /><Label htmlFor="feedback-volunteer" className="text-sm leading-relaxed">Quero participar de próximos testes e autorizo contato pelo e-mail da minha conta para esse fim.</Label></div>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        {mutation.isSuccess && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Feedback recebido. Obrigado por compartilhar!</p>}
        <Button className="w-full" type="submit" disabled={mutation.isPending || !rating || message.trim().length < 10}>{mutation.isPending ? "Enviando..." : "Enviar feedback"}</Button>
      </form></Card>
      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Ajude a testar o projeto</h2><p className="mt-2 text-sm text-muted-foreground">Experimente as tarefas abaixo. Volte a esta página para registrar o resultado e enviar junto com seu feedback.</p></div>{TEST_TASKS.map((task, index) => <div key={task.id} className="space-y-3 rounded-lg border p-4"><Label htmlFor={`task-${task.id}`} className="text-sm leading-relaxed">{index + 1}. {task.label}</Label><Link to={task.path} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary underline">Abrir tarefa em outra aba</Link><select id={`task-${task.id}`} className={selectClass} value={tasks[task.id] || "untested"} onChange={(event) => setTasks({ ...tasks, [task.id]: event.target.value })}><option value="untested">Ainda não testei</option><option value="done">Consegui sem dificuldade</option><option value="difficult">Consegui com dificuldade</option><option value="blocked">Não consegui concluir</option></select></div>)}</Card>
    </div>
    <Card className="space-y-4 p-5"><h2 className="font-semibold">Seus feedbacks</h2>{query.isLoading ? <p role="status">Carregando...</p> : query.isError ? <p role="alert">Não foi possível carregar os feedbacks. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p> : !query.data?.feedback?.length ? <p className="text-sm text-muted-foreground">Seus envios e o andamento aparecerão aqui.</p> : query.data.feedback.map((item) => <article key={item.id} className="rounded-lg border p-4"><div className="flex justify-between gap-2 text-xs"><span>{item.rating}/5 · {new Date(item.created_at).toLocaleDateString("pt-BR")}</span><span className="font-medium text-primary">{FEEDBACK_STATUS[item.status]}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p></article>)}</Card>
  </div>;
}
