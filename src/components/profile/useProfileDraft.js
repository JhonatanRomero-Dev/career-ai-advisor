import { useEffect, useState } from "react";
import { editableProfile, mergeProfileEdits, profilesDiffer, readProfileDraft } from "@/lib/profileDraft";

export default function useProfileDraft({ initialProfile, storageKey, ready }) {
  const [editor, setEditor] = useState(null);
  const [draftError, setDraftError] = useState("");
  const draftKey = `${storageKey}:draft:v1`;
  const isReady = ready && editor?.key === draftKey;
  const profile = isReady ? editor.profile : initialProfile;
  const pendingDraft = isReady ? editor.pendingDraft : null;
  const hasChanges = isReady && profilesDiffer(editor.baseline, profile);

  useEffect(() => {
    if (!ready || editor?.key === draftKey) return;
    let draft = null;
    try {
      draft = readProfileDraft(localStorage, draftKey);
      setDraftError("");
    } catch {
      setDraftError("Não foi possível recuperar o rascunho neste navegador.");
    }
    const restored = draft && mergeProfileEdits(draft.baseline, draft.profile, initialProfile);
    setEditor({ key: draftKey, profile: initialProfile, baseline: initialProfile,
      pendingDraft: restored && profilesDiffer(initialProfile, restored) ? draft : null });
  }, [ready, draftKey, initialProfile, editor?.key]);

  useEffect(() => {
    if (!isReady || pendingDraft) return;
    try {
      if (hasChanges) {
        localStorage.setItem(draftKey, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(),
          baseline: editableProfile(editor.baseline), profile: editableProfile(profile) }));
      } else {
        localStorage.removeItem(draftKey);
      }
      setDraftError("");
    } catch {
      setDraftError("Não foi possível guardar o rascunho neste navegador. Salve o perfil antes de sair.");
    }
  }, [isReady, pendingDraft, hasChanges, draftKey, editor?.baseline, profile]);

  useEffect(() => {
    if (!hasChanges || !draftError) return;
    const warnBeforeLeaving = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasChanges, draftError]);

  const setProfile = (update) => setEditor((current) => {
    if (!current || current.key !== draftKey) return current;
    return { ...current, profile: typeof update === "function" ? update(current.profile) : update };
  });
  const restoreDraft = () => setEditor((current) => ({ ...current,
    profile: mergeProfileEdits(current.pendingDraft.baseline, current.pendingDraft.profile, current.baseline), pendingDraft: null }));
  const discardChanges = () => setEditor((current) => ({ ...current, profile: current.baseline, pendingDraft: null }));
  const markSaved = (saved, submitted) => setEditor((current) => ({ ...current,
    baseline: saved, profile: mergeProfileEdits(submitted, current.profile, saved), pendingDraft: null }));

  return { profile, setProfile, isReady, hasChanges, pendingDraft, restoreDraft, discardChanges, markSaved, draftError };
}
