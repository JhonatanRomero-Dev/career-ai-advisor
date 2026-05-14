import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function WeakWordsList({ words = [] }) {
  if (!words || words.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-foreground">Palavras fracas encontradas</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {words.map((word, i) => (
          <Badge key={i} variant="outline" className="border-orange-500/30 text-orange-600 bg-orange-500/5">
            {word}
          </Badge>
        ))}
      </div>
    </div>
  );
}
