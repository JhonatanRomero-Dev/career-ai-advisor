import React from "react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, subtitle, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    purple: "bg-violet-500/10 text-violet-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-5 hover:shadow-md transition-shadow duration-300 border-border/50">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}