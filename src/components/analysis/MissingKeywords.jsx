import React from "react";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export default function MissingKeywords({ keywords = [] }) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Termos não encontrados no currículo</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        O termo pode vir da área ou da vaga analisada. Inclua-o apenas se corresponder à sua experiência real.
      </p>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, i) => (
          <Badge key={i} variant="outline" className="border-primary/30 text-primary bg-primary/5">
            + {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}
