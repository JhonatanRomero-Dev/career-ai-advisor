import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, TrendingUp, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function JobCard({ job, index = 0 }) {
  const getMatchColor = (pct) => {
    if (pct >= 85) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (pct >= 70) return "bg-primary/10 text-primary border-primary/20";
    return "bg-orange-500/10 text-orange-700 border-orange-500/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="p-5 hover:shadow-lg transition-all duration-300 border-border/50 group cursor-pointer hover:border-primary/30">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {job.location}
              </span>
            </div>
          </div>
          <Badge className={`${getMatchColor(job.match_percentage)} border font-bold text-sm px-3`}>
            {job.match_percentage}%
          </Badge>
        </div>

        {job.match_reasons && job.match_reasons.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Por que combina</p>
            <div className="flex flex-wrap gap-1.5">
              {job.match_reasons.slice(0, 3).map((reason, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-normal">{reason}</Badge>
              ))}
            </div>
          </div>
        )}

        {job.improvement_tips && job.improvement_tips.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Aumente sua nota</span>
            </div>
            <p className="text-xs text-muted-foreground">{job.improvement_tips[0]}</p>
          </div>
        )}

        <div className="flex justify-end mt-3">
          <span className="text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Card>
    </motion.div>
  );
}
