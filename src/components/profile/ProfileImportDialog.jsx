import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { profileImportCandidates } from "@/lib/profileImport";

const displayValue = (value) => Array.isArray(value) ? value.join(", ") : value || "Não preenchido";

export default function ProfileImportDialog({ profile, accountKey, onApply, disabled }) {
  const [open, setOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const [selected, setSelected] = useState({});
  const { data: analyses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["profile-import-analyses", accountKey],
    queryFn: () => base44.entities.ResumeAnalysis.list("-created_date", 50),
    enabled: open && Boolean(accountKey),
  });
  const available = analyses.filter((analysis) => analysis.status === "completed");
  const analysis = available.find((item) => item.id === analysisId) || available[0];
  const candidates = profileImportCandidates(analysis, profile);
  const changes = candidates.filter(({ field }) => selected[field]);

  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); setSelected({}); setAnalysisId(""); }}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled}><FileDown className="h-4 w-4" />Preencher com currículo</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Revisar dados do currículo</DialogTitle>
        <DialogDescription>Escolha os dados que deseja aproveitar de um currículo já analisado. Depois de aplicar, revise o perfil e salve quando estiver pronto.</DialogDescription>
      </DialogHeader>
      {isLoading ? <p role="status">Carregando currículos...</p> : isError ? <div role="alert" className="space-y-3"><p>Não foi possível carregar seus currículos.</p><Button type="button" variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div>
        : !available.length ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Envie um currículo para analisar e aproveitar os dados identificados.</p><Button asChild><Link to="/upload">Analisar currículo</Link></Button></div>
          : <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="profile-import-source">Currículo analisado</Label>
              <select id="profile-import-source" className="h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={analysis?.id || ""} onChange={(event) => { setAnalysisId(event.target.value); setSelected({}); }}>
                {available.map((item) => <option key={item.id} value={item.id}>{item.file_name || "Currículo"} · {new Date(item.created_date).toLocaleDateString("pt-BR")}</option>)}
              </select></div>
            <p className="text-xs text-muted-foreground">Dados disponíveis: telefone, nível de experiência e habilidades. As habilidades selecionadas serão adicionadas às atuais.</p>
            {candidates.length ? candidates.map(({ field, label, value, additive }) => <label key={field} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={Boolean(selected[field])} onChange={(event) => setSelected((current) => ({ ...current, [field]: event.target.checked }))} aria-label={`Importar ${label.toLowerCase()}`} />
              <span className="min-w-0 space-y-1 text-sm"><span className="block font-medium">{label}</span><span className="block break-words text-muted-foreground">Atual: {displayValue(profile[field])}</span><span className="block break-words">Após aplicar: {displayValue(value)}</span>{!additive && profile[field] && <span className="block text-xs text-muted-foreground">Substitui o valor atual se selecionado.</span>}</span>
            </label>) : <p role="status" className="text-sm text-muted-foreground">Este currículo não contém dados novos disponíveis para importar.</p>}
          </div>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button type="button" disabled={!changes.length || isLoading || isError} onClick={() => { onApply(Object.fromEntries(changes.map(({ field, value }) => [field, value]))); setOpen(false); }}>Aplicar selecionados</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
