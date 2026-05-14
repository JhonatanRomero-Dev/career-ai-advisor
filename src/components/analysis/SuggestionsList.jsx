import React from "react";
import { Lightbulb } from "lucide-react";

export default function SuggestionsList({ suggestions = [] }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-yellow-500" />
        <h3 className="text-sm font-semibold text-foreground">Sugestoes de melhoria</h3>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
