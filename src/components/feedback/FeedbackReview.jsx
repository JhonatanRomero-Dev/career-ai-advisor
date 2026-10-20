import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";

const statuses = { new: "Recebido", reviewing: "Em análise", planned: "Planejado", resolved: "Resolvido" };
export default function FeedbackReview() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-feedback"], queryFn: () => base44.product.request("/admin/feedback") });
  const update = useMutation({ mutationFn: ({ id, status }) => base44.product.request(`/admin/feedback/${id}`, "PATCH", { status }), onSuccess: () => client.invalidateQueries({ queryKey: ["admin-feedback"] }), onError: (error) => toast.error(error.message) });
  if (query.isLoading) return <p role="status">Carregando feedbacks...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os feedbacks. <button onClick={() => query.refetch()} className="underline">Tentar novamente</button></p>;
  const items = query.data.feedback, metrics = query.data.support;
  return <Card className="space-y-4 p-5"><h2 className="font-semibold">Feedbacks e qualidade do suporte</h2><div className="grid gap-3 sm:grid-cols-4">{[["Feedbacks recentes", items.length], ["Participantes voluntários", items.filter((item) => item.volunteer).length], ["Tempo médio do suporte", `${metrics.average_ms} ms`], ["Respostas úteis", `${metrics.helpful}/${metrics.rated} avaliações`]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div><p className="text-xs text-muted-foreground">{metrics.total} respostas · {metrics.fallbacks} respostas da base local. Tempo e avaliações são registrados sem armazenar o conteúdo das conversas no servidor.</p>
    {!items.length && <p className="text-sm text-muted-foreground">Ainda não há feedbacks.</p>}
    {items.map((item) => <article key={item.id} className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{item.category} · {item.rating}/5 · {new Date(item.created_at).toLocaleDateString("pt-BR")} · Conta {item.user_id}</p><select aria-label={`Status do feedback ${item.id}`} className="rounded-md border bg-background p-2 text-sm" value={item.status} disabled={update.isPending} onChange={(event) => update.mutate({ id: item.id, status: event.target.value })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><p className="whitespace-pre-wrap break-words text-sm">{item.message}</p><p className="text-xs text-muted-foreground">{item.audience || "Momento profissional não informado"}{item.volunteer ? " · Aceita participar de testes e receber contato" : ""}</p><div className="flex flex-wrap gap-2">{item.tasks?.filter((task) => task.result !== "untested").map((task) => <span key={task.id} className="rounded bg-muted px-2 py-1 text-xs">{task.id}: {task.result}</span>)}</div></article>)}
  </Card>;
}
