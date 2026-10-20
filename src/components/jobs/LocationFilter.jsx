import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fallbackLocationOptions, fetchBrazilianCityOptions, jobLocationSuggestions, normalizeLocationSearch } from "@/lib/locationSuggestions";

export default function LocationFilter({ id, value, onChange, jobs = [] }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const { data: cities, isFetching } = useQuery({
    queryKey: ["brazilian-city-options"], queryFn: fetchBrazilianCityOptions,
    staleTime: 86400000, gcTime: 86400000, retry: 1,
  });
  const suggestions = useMemo(() => jobLocationSuggestions(
    cities?.length ? cities : fallbackLocationOptions, value, jobs.map((job) => job.location),
  ), [cities, value, jobs]);
  const showSuggestions = open && normalizeLocationSearch(value).length >= 2;
  const selectedIndex = Math.min(activeIndex, suggestions.length - 1);
  const listId = `${id}-suggestions`;

  useEffect(() => {
    if (showSuggestions && selectedIndex >= 0) {
      document.getElementById(`${listId}-${selectedIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [listId, selectedIndex, showSuggestions]);

  const select = (option) => {
    onChange(option.value);
    setOpen(false);
    setActiveIndex(-1);
  };
  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActiveIndex(-1); }
    if (event.key === "Enter") {
      event.preventDefault();
      if (showSuggestions && selectedIndex >= 0) select(suggestions[selectedIndex]);
      else setOpen(false);
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => event.key === "ArrowDown" ? (index + 1) % suggestions.length
        : index <= 0 ? suggestions.length - 1 : index - 1);
    }
  };

  return <div className="relative">
    <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    <Input ref={inputRef} id={id} value={value} placeholder="Buscar localização" maxLength={200} className="pl-9 pr-10"
      role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={showSuggestions && suggestions.length > 0}
      aria-controls={showSuggestions && suggestions.length ? listId : undefined}
      aria-activedescendant={showSuggestions && selectedIndex >= 0 ? `${listId}-${selectedIndex}` : undefined}
      onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActiveIndex(-1); }} onKeyDown={handleKeyDown} />
    {value && <button type="button" aria-label="Limpar localização" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => { onChange(""); setOpen(false); setActiveIndex(-1); inputRef.current?.focus(); }}><X aria-hidden="true" className="h-4 w-4" /></button>}
    {showSuggestions && <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
      {suggestions.length ? <ul id={listId} role="listbox" aria-label="Sugestões de localização" className="max-h-64 overflow-y-auto">
        {suggestions.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={index === selectedIndex}
          onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(option)}
          className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent ${index === selectedIndex ? "bg-accent" : ""}`}>
          <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />{option.label}
        </li>)}
      </ul> : <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{isFetching ? "Buscando cidades..." : "Nenhuma localização encontrada."}</p>}
    </div>}
  </div>;
}
