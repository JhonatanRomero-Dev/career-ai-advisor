import React from "react";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = 28;

function pointsFor(data, key) {
  const usableWidth = WIDTH - PADDING * 2;
  const usableHeight = HEIGHT - PADDING * 2;
  return data.map((item, index) => {
    const x = PADDING + (data.length === 1 ? 0 : (index / (data.length - 1)) * usableWidth);
    const y = PADDING + (1 - Number(item[key] || 0) / 100) * usableHeight;
    return { x, y, value: item[key], date: item.date };
  });
}

function pathFor(points) {
  return points.map(({ x, y }, index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export default function ATSProgressChart({ analyses = [] }) {
  const completed = analyses
    .filter((analysis) => analysis.status === "completed" && analysis.ats_score != null)
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  if (completed.length < 2) return null;

  const data = completed.map((analysis) => ({
    date: format(new Date(analysis.created_date), "dd MMM"),
    ats: Number(analysis.ats_score || 0),
    clarity: Number(analysis.clarity_score || 0),
  }));
  const atsPoints = pointsFor(data, "ats");
  const clarityPoints = pointsFor(data, "clarity");
  const diff = data.at(-1).ats - data[0].ats;
  const pct = data[0].ats > 0 ? Math.abs(Math.round((diff / data[0].ats) * 100)) : 0;
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-destructive" : "text-muted-foreground";
  const trendBg = diff > 0 ? "bg-emerald-500/10" : diff < 0 ? "bg-destructive/10" : "bg-muted";
  const trendLabel = diff > 0 ? `+${pct}% de melhoria` : diff < 0 ? `-${pct}% de queda` : "Estável";
  const limitY = PADDING + 0.3 * (HEIGHT - PADDING * 2);

  return <Card className="border-border/50 p-6">
    <div className="mb-6 flex items-center justify-between">
      <div><h3 className="font-semibold">Progresso da nota ATS</h3><p className="mt-0.5 text-xs text-muted-foreground">Evolução em {completed.length} análises</p></div>
      <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${trendBg}`}><TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} /><span className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</span></div>
    </div>

    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[520px]" role="img" aria-label="Evolução das notas ATS e clareza de zero a cem">
        {[0, 25, 50, 75, 100].map((value) => {
          const y = PADDING + (1 - value / 100) * (HEIGHT - PADDING * 2);
          return <g key={value}><line x1={PADDING} y1={y} x2={WIDTH - PADDING} y2={y} className="stroke-border" strokeWidth="1" /><text x="2" y={y + 4} className="fill-muted-foreground text-[10px]">{value}</text></g>;
        })}
        <line x1={PADDING} y1={limitY} x2={WIDTH - PADDING} y2={limitY} className="stroke-muted-foreground" strokeDasharray="5 5" />
        <path d={pathFor(clarityPoints)} fill="none" className="stroke-chart-2" strokeWidth="2" strokeDasharray="6 4" />
        <path d={pathFor(atsPoints)} fill="none" className="stroke-primary" strokeWidth="3" strokeLinejoin="round" />
        {atsPoints.map((point) => <g key={`${point.date}-${point.x}`}><circle cx={point.x} cy={point.y} r="4" className="fill-primary"><title>{point.date}: ATS {point.value}</title></circle><text x={point.x} y={HEIGHT - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{point.date}</text></g>)}
      </svg>
    </div>

    <div className="mt-4 flex justify-center gap-5 text-xs text-muted-foreground"><span>━ Nota ATS</span><span>┄ Clareza</span><span>┄ Limite 70</span></div>
  </Card>;
}
