import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Search, SlidersHorizontal, Trash2, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { DEFAULT_FILTERS, jobMetadata, matchesJob, searchSuggestions, trendingTitles } from "@/lib/jobSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import LocationFilter from "./LocationFilter";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const fields = [["area", "Área"], ["level", "Nível"], ["company", "Empresa"], ["contract", "Contrato"], ["source", "Fonte"]];

export default function JobFilters({ jobs, filters, onChange, onSearch, searchOnline = false }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const query = useQuery({ queryKey: ["saved-searches"], queryFn: () => base44.product.request("/searches") });
  const mutation = useMutation({
    mutationFn: ({ path, method, body }) => base44.product.request(path, method, body),
    onSuccess: (_, variables) => {
      client.invalidateQueries({ queryKey: ["saved-searches"] });
      if (variables.path === "/searches" && variables.method === "POST") { setName(""); toast.success("Pesquisa salva"); }
    },
    onError: (error) => toast.error(error.message),
  });
  const set = (field, value) => onChange({ ...filters, [field]: value });
  const suggestions = useMemo(() => searchSuggestions(jobs, filters.search), [jobs, filters.search]);
  const trends = useMemo(() => trendingTitles(jobs), [jobs]);
  const options = useMemo(() => Object.fromEntries(fields.map(([field]) => {
    const candidates = [...new Set(jobs.map((job) => field === "company" || field === "source" ? job[field] : jobMetadata(job)[field]).filter(Boolean))].sort();
    if (filters[field] !== "all" && !candidates.includes(filters[field])) candidates.push(filters[field]);
    return [field, candidates.map((value) => ({ value, count: jobs.filter((job) => matchesJob(job, { ...filters, [field]: value })).length }))];
  })), [jobs, filters]);
  const remember = (term) => {
    if (term.trim().length >= 2) mutation.mutate({ path: "/search-history", method: "POST", body: { term: term.trim() } });
  };
  const choose = (term) => { set("search", term); onSearch?.(term); remember(term); setFocused(false); setActive(-1); };
  const chips = Object.entries(filters).filter(([key, value]) => key !== "sortBy" && value !== DEFAULT_FILTERS[key] && value !== "");
  const labels = { search: "Busca", location: "Localização", mode: "Modalidade", age: "Dias", match: "Match", salaryMin: "Salário mínimo", salaryMax: "Salário máximo", ...Object.fromEntries(fields) };

  return <Card className="space-y-5 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" />Encontre sua próxima oportunidade</h2><Button size="sm" variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTERS })}>Limpar filtros</Button></div>
    <form onSubmit={(event) => { event.preventDefault(); choose(active >= 0 ? suggestions[active]?.term || filters.search : filters.search); }} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="job-search">Palavra-chave ou cargo</Label><div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input id="job-search" className="pl-9 pr-20" placeholder="Ex.: React, vendas ou assistente de TI" value={filters.search} maxLength={200} aria-describedby="job-search-help"
          role="combobox" aria-expanded={focused && suggestions.length > 0} aria-controls="job-suggestions" aria-autocomplete="list"
          aria-activedescendant={focused && active >= 0 ? `job-suggestion-${active}` : undefined} autoComplete="off"
          onChange={(event) => { set("search", event.target.value); setFocused(true); setActive(-1); }} onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)} onKeyDown={(event) => {
            if (event.key === "Escape") { setFocused(false); setActive(-1); }
            if (["ArrowDown", "ArrowUp"].includes(event.key) && suggestions.length) { event.preventDefault(); setFocused(true); setActive((value) => (value + (event.key === "ArrowDown" ? 1 : suggestions.length - 1) + suggestions.length) % suggestions.length); }
          }} />
        <Button type="submit" size="sm" className="absolute right-1 top-1 h-8">Buscar</Button>
        {focused && suggestions.length > 0 && <div id="job-suggestions" role="listbox" aria-label="Sugestões de busca" className="absolute inset-x-0 top-11 z-30 rounded-md border bg-popover p-1 shadow-lg">
          {suggestions.map(({ term, distance }, index) => <button key={term} id={`job-suggestion-${index}`} role="option" aria-selected={index === active} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(term)} className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent ${index === active ? "bg-accent" : ""}`}>
            {distance > 0 && <span className="text-muted-foreground">Você quis dizer: </span>}{term}</button>)}
        </div>}
      </div><p id="job-search-help" className="text-xs text-muted-foreground">{searchOnline ? "A partir de 2 caracteres, buscamos vagas automaticamente enquanto você digita." : "Busque entre as vagas salvas na sua jornada."}</p></div>
      <div className="space-y-2"><Label htmlFor="job-location">Localização</Label><LocationFilter id="job-location" value={filters.location} onChange={(value) => set("location", value)} jobs={jobs} /></div>
    </form>
    {!!query.data?.history?.length && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Buscas recentes</span>{query.data.history.map(({ term }) => <button key={term} onClick={() => choose(term)} className="rounded-full bg-muted px-3 py-1.5 hover:bg-accent">{term}</button>)}<button className="text-primary underline" onClick={() => mutation.mutate({ path: "/search-history", method: "DELETE" })}>Limpar histórico</button></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([field, label]) => <div key={field} className="space-y-1.5"><Label htmlFor={`filter-${field}`}>{label}</Label><select id={`filter-${field}`} className={selectClass} value={filters[field]} onChange={(event) => set(field, event.target.value)}><option value="all">Todas as opções</option>{options[field].map(({ value, count }) => <option key={value} value={value}>{value} ({count})</option>)}</select></div>)}
      <div className="space-y-1.5"><Label htmlFor="filter-mode">Modalidade</Label><select id="filter-mode" className={selectClass} value={filters.mode} onChange={(event) => set("mode", event.target.value)}><option value="all">Todas as modalidades</option><option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="onsite">Presencial</option></select></div>
      <div className="space-y-1.5"><Label htmlFor="salary-min">Salário mensal mínimo (R$)</Label><Input id="salary-min" type="number" min="0" max="1000000" step="100" value={filters.salaryMin || ""} onChange={(event) => set("salaryMin", Math.max(0, Number(event.target.value)))} placeholder="Sem mínimo" /></div>
      <div className="space-y-1.5"><Label htmlFor="salary-max">Salário mensal máximo (R$)</Label><Input id="salary-max" type="number" min="0" max="1000000" step="100" value={filters.salaryMax || ""} onChange={(event) => set("salaryMax", Math.max(0, Number(event.target.value)))} placeholder="Sem máximo" /></div>
      <div className="space-y-1.5"><Label htmlFor="filter-age">Publicação</Label><select id="filter-age" className={selectClass} value={filters.age} onChange={(event) => set("age", event.target.value)}><option value="all">Qualquer data</option>{[1, 7, 30, 60].map((days) => <option key={days} value={days}>Últimos {days} dia(s)</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="filter-match">Compatibilidade</Label><select id="filter-match" className={selectClass} value={filters.match} onChange={(event) => set("match", event.target.value)}><option value="all">Todos os níveis</option><option value="high">Match alto (85%+)</option><option value="good">Bom match (70–84%)</option><option value="improve">Pode melhorar (&lt;70%)</option></select></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="filter-sort">Ordenar por</Label><select id="filter-sort" className={selectClass} value={filters.sortBy} onChange={(event) => set("sortBy", event.target.value)}>{[["match-desc", "Maior compatibilidade"], ["match-asc", "Menor compatibilidade"], ["recent", "Mais recentes"], ["salary-desc", "Maior salário informado"], ["title", "Cargo (A–Z)"], ["company", "Empresa (A–Z)"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    <p className="text-xs text-muted-foreground">Filtros atualizados enquanto você digita. Buscas por cargo consideram o título do anúncio. A faixa salarial considera valores em reais com período informado; salários anuais são divididos por 12. Área e nível podem ser identificados pelo anúncio.</p>
    {filters.salaryMax > 0 && filters.salaryMax < filters.salaryMin && <p role="alert" className="text-sm text-destructive">O salário máximo deve ser maior ou igual ao mínimo.</p>}
    {!!chips.length && <div className="flex flex-wrap gap-2">{chips.map(([field, value]) => <button key={field} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary" onClick={() => set(field, DEFAULT_FILTERS[field])} aria-label={`Remover filtro ${labels[field]}`}>{labels[field]}: {value}<X className="h-3 w-3" /></button>)}</div>}
    <div className="space-y-3 border-t pt-4"><form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ path: "/searches", method: "POST", body: { name: name.trim() || filters.search.trim() || "Minha pesquisa", filters } }); }}>
      <Input className="w-full sm:w-64" aria-label="Nome da pesquisa" placeholder="Nome para esta pesquisa" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      <Button type="submit" variant="outline" disabled={mutation.isPending}><BookmarkPlus className="h-4 w-4" />Salvar pesquisa</Button>
    </form>
      {query.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar suas pesquisas. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p>}
      <div className="flex flex-wrap gap-2">{query.data?.searches?.map((saved) => <div key={saved.id} className="flex rounded-md border"><button className="px-3 py-2 text-sm hover:bg-muted" onClick={() => onChange({ ...DEFAULT_FILTERS, ...saved.filters })}>{saved.name}</button><button className="border-l px-2 hover:bg-muted" aria-label={`Excluir pesquisa ${saved.name}`} disabled={mutation.isPending} onClick={() => mutation.mutate({ path: `/searches/${saved.id}`, method: "DELETE" })}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
    </div>
    {!!trends.length && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Em destaque nas suas vagas</span>{trends.map(([title, count]) => <button key={title} className="rounded-full border px-3 py-1.5 hover:bg-muted" onClick={() => choose(title)}>{title} · {count}</button>)}</div>}
  </Card>;
}
