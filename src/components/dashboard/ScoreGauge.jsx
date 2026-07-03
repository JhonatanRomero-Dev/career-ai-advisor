import React from "react";
import { motion } from "framer-motion";

function getScoreStatus(score) {
  const value = Number(score || 0);

  if (value >= 80) {
    return { label: "Boa base", className: "text-emerald-600" };
  }

  if (value >= 60) {
    return { label: "Há espaço para melhorar", className: "text-primary" };
  }

  return { label: "Prioridade de revisão", className: "text-amber-600" };
}

export default function ScoreGauge({ score, label, description, size = 140 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ((score || 0) / 100) * circumference;
  const strokeWidth = 8;
  const status = getScoreStatus(score);

  const getColor = (s) => {
    if (s >= 80) return "hsl(160, 60%, 45%)";
    if (s >= 60) return "hsl(221, 83%, 53%)";
    if (s >= 40) return "hsl(30, 80%, 55%)";
    return "hsl(0, 84%, 60%)";
  };

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor(score)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score || 0}
          </motion.span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <p className={`text-[11px] font-semibold ${status.className}`}>{status.label}</p>
      {description && <p className="max-w-44 text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}
