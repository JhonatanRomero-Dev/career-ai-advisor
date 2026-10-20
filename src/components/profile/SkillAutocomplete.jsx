import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appendSkill, canonicalSkill, normalizeSkill, skillSuggestions } from "@/lib/skillSuggestions";

export default function SkillAutocomplete({ value = [], onChange }) {
  const id = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const suggestions = useMemo(() => skillSuggestions(query, value), [query, value]);
  const atLimit = value.length >= 50;
  const showList = focused && normalizeSkill(query).length >= 3 && !atLimit;
  const selectedIndex = Math.min(activeIndex, suggestions.length - 1);
  const duplicate = value.some((skill) => normalizeSkill(canonicalSkill(skill)) === normalizeSkill(canonicalSkill(query)));

  useEffect(() => {
    if (showList && selectedIndex >= 0) document.getElementById(`${id}-option-${selectedIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [id, selectedIndex, showList]);

  function add(skill) {
    const next = appendSkill(value, skill);
    if (next === value) return;
    onChange(next);
    setQuery("");
    setActiveIndex(0);
    setAnnouncement(`${canonicalSkill(skill)} adicionada.`);
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setFocused(false);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key) && suggestions.length) {
      event.preventDefault();
      setFocused(true);
      setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      add(showList && suggestions[selectedIndex] ? suggestions[selectedIndex].label : query);
    }
  }

  return <div className="min-w-0 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={`${id}-input`}>Habilidades</Label>
      <span className="text-xs text-muted-foreground">{value.length}/50</span>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground md:top-2.5" />
        <Input ref={inputRef} id={`${id}-input`} value={query} maxLength={60}
          className="min-w-0 pl-9" placeholder="Buscar habilidade"
          role="combobox" aria-autocomplete="list" aria-expanded={showList && suggestions.length > 0}
          aria-controls={showList && suggestions.length ? `${id}-list` : undefined}
          aria-activedescendant={showList && selectedIndex >= 0 ? `${id}-option-${selectedIndex}` : undefined}
          aria-describedby={atLimit ? `${id}-help` : undefined} autoComplete="off" disabled={atLimit}
          onChange={(event) => { setQuery(event.target.value); setFocused(true); setActiveIndex(0); setAnnouncement(""); }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={handleKeyDown} />
        {showList && <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-40 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          {suggestions.length ? <ul id={`${id}-list`} role="listbox" aria-label="Sugestões de habilidades" className="max-h-64 overflow-y-auto p-1">
            {suggestions.map((skill, index) => <li id={`${id}-option-${index}`} key={skill.label} role="option" aria-selected={selectedIndex === index}
              onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => add(skill.label)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-3 text-sm ${selectedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}>
              <span className="min-w-0"><span className="block font-medium">{skill.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{skill.category}</span></span><Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            </li>)}
          </ul> : <p className="px-4 py-3 text-sm text-muted-foreground">{duplicate ? "Esta habilidade já foi adicionada." : "Nenhuma sugestão. Use Adicionar para incluir sua habilidade."}</p>}
        </div>}
      </div>
      <Button type="button" variant="outline" disabled={!query.trim() || duplicate || atLimit}
        onClick={() => add(suggestions[selectedIndex]?.label || query)}>Adicionar</Button>
    </div>
    {atLimit && <p id={`${id}-help`} className="text-xs text-muted-foreground">
      Limite de 50 habilidades. Remova uma para adicionar outra.
    </p>}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    <div className="flex flex-wrap gap-2">{value.map((skill) => <span key={skill} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pl-3 pr-1 text-sm text-primary">
      <span className="break-words">{skill}</span><button type="button" aria-label={`Remover habilidade ${skill}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => { onChange(value.filter((item) => item !== skill)); setAnnouncement(`${skill} removida.`); }}><X className="h-3.5 w-3.5" /></button>
    </span>)}</div>
  </div>;
}
