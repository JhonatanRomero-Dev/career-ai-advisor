import React from "react";
import { Check, Copy, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuggestionsList({ suggestions = [], copiedIndex = -1, onCopy, onApply, checked = {}, onToggle, disabled }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="rounded-lg border border-border/60 bg-background p-3 text-sm text-muted-foreground">
            <label className="flex cursor-pointer items-start gap-2.5 py-1">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" checked={checked[i] === true} disabled={disabled} onChange={() => onToggle?.(i)} />
              <span className={`min-w-0 flex-1 leading-relaxed ${checked[i] ? "line-through" : ""}`}>{s}</span>
            </label>
            {(onCopy || onApply) && <div className="mt-3 flex flex-wrap gap-2 pl-7">
              {onCopy && <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onCopy(s, i)}>
                {copiedIndex === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedIndex === i ? "Copiado" : "Copiar"}
              </Button>}
              {onApply && <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onApply(s)}>
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar no rascunho
              </Button>}
            </div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
