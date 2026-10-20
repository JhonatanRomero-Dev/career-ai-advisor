import React, { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareProfilePhoto, PROFILE_PHOTO_TYPES } from "@/lib/profilePhoto";

export default function ProfilePhotoPicker({ photo, onChange, onProcessingChange, disabled = false }) {
  const input = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setProcessing(true);
    onProcessingChange(true);
    try { onChange(await prepareProfilePhoto(file)); }
    catch (photoError) { setError(photoError.message); }
    finally { setProcessing(false); onProcessingChange(false); }
  }

  return <div className="mb-6 space-y-2">
    <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label="Selecionar foto de perfil"
      accept={PROFILE_PHOTO_TYPES.join(",")} disabled={disabled || processing} onChange={selectPhoto} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled || processing} onClick={() => input.current?.click()}>
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {processing ? "Preparando foto…" : photo ? "Trocar foto" : "Adicionar foto"}
      </Button>
      {photo && <Button type="button" size="sm" variant="ghost" disabled={disabled || processing} onClick={() => { onChange(""); setError(""); }}>
        <Trash2 className="h-4 w-4" />Remover foto
      </Button>}
    </div>
    <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB. A foto é recortada ao centro. Clique em Salvar perfil para confirmar.</p>
    {processing && <p role="status" className="text-xs text-muted-foreground">Preparando a prévia da sua foto…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
