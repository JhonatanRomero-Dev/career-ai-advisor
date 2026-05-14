import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground text-base">
        ATS: <span className="text-primary">{payload[0].value}</span>
      </p>
      {payload[1] && (
        <p className="text-muted-foreground text-xs mt-0.5">
          Clareza: {payload[1].value}
        </p>
      )}
    </div>
  );
}

export default function ATSProgressChart({ analyses = [] }) {
  const completed = analyses
    .filter(a => a.status === 'completed' && a.ats_score != null)
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  if (completed.length < 2) return null;

  const data = completed.map(a => ({
    date: format(new Date(a.created_date), "dd MMM"),
    ats: a.ats_score || 0,
    clarity: a.clarity_score || 0,
    file: a.file_name,
  }));

  const first = data[0].ats;
  const last = data[data.length - 1].ats;
  const diff = last - first;
  const pct = first > 0 ? Math.abs(Math.round((diff / first) * 100)) : 0;

  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : "text-muted-foreground";
  const trendBg = diff > 0 ? "bg-emerald-500/10" : diff < 0 ? "bg-destructive/10" : "bg-muted";
  const trendLabel = diff > 0 ? `+${pct}% de melhoria` : diff < 0 ? `-${pct}% de queda` : "Estavel";

  return (
    <Card className="p-6 border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Progresso da nota ATS</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Evolucao em {completed.length} analises</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${trendBg}`}>
          <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
          <span className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={70} stroke="hsl(var(--border))" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="ats"
            name="ATS"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="clarity"
            name="Clareza"
            stroke="hsl(var(--chart-2))"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-5 mt-4 justify-center">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-5 h-0.5 bg-primary rounded-full inline-block" /> Nota ATS
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-5 h-0.5 border-t-2 border-dashed border-chart-2 inline-block" /> Clareza
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-5 h-0.5 border-t border-dashed border-border inline-block" /> Limite 70
        </span>
      </div>
    </Card>
  );
}
