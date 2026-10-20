import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  Database,
  Play,
  RefreshCw,
  Users,
  Webhook,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FeedbackReview from "@/components/feedback/FeedbackReview";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(cents = 0, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(cents || 0) / 100);
}

function statusVariant(status = "") {
  const normalized = String(status || "").toLowerCase();

  if (["completed", "approved", "processed", "active"].includes(normalized)) {
    return "default";
  }

  if (["failed", "rejected", "refunded", "charged_back", "review_required"].includes(normalized)) {
    return "destructive";
  }

  return "secondary";
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="border-border/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value ?? 0}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

function SectionTable({ columns, emptyText, rows, title }) {
  return (
    <Card className="overflow-hidden border-border/50">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.length ? rows.map((row) => (
              <tr key={row.id} className="border-t border-border/50">
                {columns.map((column) => (
                  <td key={column.key} className="max-w-64 px-4 py-3 align-top">
                    {column.render ? column.render(row) : row[column.key] || "-"}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Admin() {
  const [retryingJobId, setRetryingJobId] = React.useState("");
  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => base44.admin.getDashboard({ limit: 25 }),
    retry: false,
  });

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/10 p-6 text-destructive">
        {error.message || "Acesso administrativo indisponivel."}
      </Card>
    );
  }

  const summary = data?.summary || {};
  const database = data?.database || {};
  const analyticsRows = (data?.analytics?.events || []).map((event) => ({ ...event, id: event.event_name }));

  const handleRetryJob = async (jobId) => {
    try {
      setRetryingJobId(jobId);
      await base44.admin.retryAnalysisJob(jobId);
      await refetch();
    } finally {
      setRetryingJobId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operacao do produto, filas, pagamentos, webhooks e falhas de IA.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando painel...</Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Usuarios" value={summary.users} />
            <StatCard icon={BriefcaseBusiness} label="Analises" value={summary.analyses} />
            <StatCard icon={CreditCard} label="Assinaturas pagas" value={summary.paid_subscriptions} />
            <StatCard icon={AlertTriangle} label="Eventos de IA" value={summary.ai_events} />
          </div>

          <Card className="border-border/50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Banco de dados</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configurado: {database.configured || "-"} · runtime: {database.runtime || "-"}
                  </p>
                  {database.warning && (
                    <p className="mt-1 text-xs text-amber-600">{database.warning}</p>
                  )}
                </div>
              </div>
              <Badge variant={database.using_configured_provider ? "default" : "secondary"}>
                {database.using_configured_provider ? "Alinhado" : "Transição"}
              </Badge>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={BriefcaseBusiness} label="Jobs em fila" value={summary.analysis_jobs_queued} />
            <StatCard icon={RefreshCw} label="Jobs processando" value={summary.analysis_jobs_processing} />
            <StatCard icon={AlertTriangle} label="Jobs falhos" value={summary.analysis_jobs_failed} />
            <StatCard icon={Webhook} label="Webhooks com atencao" value={summary.payment_webhooks_failed} />
          </div>

          <section className="space-y-4 border-y py-5"><h2 className="font-semibold">Conclusão da jornada ({data?.analytics?.days || 30} dias)</h2><div className="grid gap-4 sm:grid-cols-4">{(data?.analytics?.funnel || []).map((step) => <div key={step.stage}><p className="text-sm text-muted-foreground">{{ resume_upload_completed: "Analisaram", resume_version_saved: "Salvaram uma versão", resume_exported: "Exportaram", application_sent: "Registraram candidatura" }[step.stage]}</p><p className="text-2xl font-semibold">{step.users}</p></div>)}</div><p className="text-xs text-muted-foreground">Pessoas que concluíram as etapas em sequência no período. Apenas atividades com coleta de métricas habilitada.</p><p className="text-sm">Retorno entre 24 horas e 7 dias: <strong>{data?.analytics?.retention?.returned || 0} de {data?.analytics?.retention?.eligible || 0}</strong> pessoas com sete dias completos de observação.</p></section>
          <SectionTable
            title={`Analytics privado (${data?.analytics?.days || 30} dias)`}
            emptyText="Nenhum evento de produto registrado."
            rows={analyticsRows}
            columns={[
              { key: "event_name", label: "Evento" },
              { key: "total", label: "Ocorrências" },
              { key: "users", label: "Usuários/visitantes" },
              { key: "signal", label: "Sinal", render: () => <BarChart3 className="h-4 w-4 text-primary" /> },
            ]}
          />

          <SectionTable
            title="Usuarios recentes"
            emptyText="Nenhum usuario encontrado."
            rows={data?.users}
            columns={[
              { key: "email", label: "Email", render: (row) => <span className="break-all">{row.email}</span> },
              { key: "name", label: "Nome" },
              { key: "subscription_plan", label: "Plano", render: (row) => <Badge variant={statusVariant(row.subscription_status)}>{row.subscription_plan}</Badge> },
              { key: "analysis_count", label: "Analises" },
              { key: "last_analysis_at", label: "Ultima analise", render: (row) => formatDate(row.last_analysis_at) },
              { key: "active_session_count", label: "Sessoes" },
            ]}
          />

          <SectionTable
            title="Jobs de analise"
            emptyText="Nenhum job encontrado."
            rows={data?.jobs}
            columns={[
              { key: "id", label: "Job", render: (row) => <span className="break-all">{row.id}</span> },
              { key: "account_email", label: "Conta", render: (row) => <span className="break-all">{row.account_email}</span> },
              { key: "status", label: "Status", render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
              { key: "attempts", label: "Tentativas" },
              { key: "error", label: "Erro", render: (row) => <span className="line-clamp-2">{row.error || "-"}</span> },
              { key: "updated_date", label: "Atualizado", render: (row) => formatDate(row.updated_date) },
              {
                key: "actions",
                label: "Ações",
                render: (row) => row.status === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryJob(row.id)}
                    disabled={retryingJobId === row.id}
                  >
                    {retryingJobId === row.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Retry
                  </Button>
                ) : "-"
              },
            ]}
          />

          <SectionTable
            title="Pagamentos"
            emptyText="Nenhum checkout encontrado."
            rows={data?.checkouts}
            columns={[
              { key: "id", label: "Checkout", render: (row) => <span className="break-all">{row.id}</span> },
              { key: "plan", label: "Plano" },
              { key: "provider", label: "Gateway" },
              { key: "status", label: "Status", render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
              { key: "amount_cents", label: "Valor", render: (row) => formatMoney(row.amount_cents, row.currency) },
              { key: "updated_date", label: "Atualizado", render: (row) => formatDate(row.updated_date) },
            ]}
          />

          <SectionTable
            title="Webhooks de pagamento"
            emptyText="Nenhum webhook recebido."
            rows={data?.webhook_events}
            columns={[
              { key: "provider_event_id", label: "Evento", render: (row) => <span className="break-all">{row.provider_event_id || row.id}</span> },
              { key: "resource_id", label: "Recurso" },
              { key: "processing_status", label: "Processamento", render: (row) => <Badge variant={statusVariant(row.processing_status)}>{row.processing_status}</Badge> },
              { key: "payment_status", label: "Pagamento" },
              { key: "error_message", label: "Mensagem", render: (row) => <span className="line-clamp-2">{row.error_message || "-"}</span> },
              { key: "updated_date", label: "Atualizado", render: (row) => formatDate(row.updated_date) },
            ]}
          />

          <SectionTable
            title="Eventos de IA"
            emptyText="Nenhum evento de IA registrado."
            rows={data?.ai_events}
            columns={[
              { key: "task", label: "Tarefa" },
              { key: "account_email", label: "Conta", render: (row) => <span className="break-all">{row.account_email || "-"}</span> },
              { key: "status", label: "Status", render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
              { key: "provider", label: "Provider", render: (row) => [row.provider, row.model].filter(Boolean).join("/") || "-" },
              { key: "message", label: "Mensagem", render: (row) => <span className="line-clamp-2">{row.message || "-"}</span> },
              { key: "created_date", label: "Criado", render: (row) => formatDate(row.created_date) },
            ]}
          />
          <FeedbackReview />
        </>
      )}
    </div>
  );
}
