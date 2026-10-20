export const editableProfileFields = [
  "photo", "name", "phone", "location", "headline", "targetRole", "experienceLevel",
  "linkedin", "portfolio", "summary", "github", "skills", "experiences", "projects",
  "certificates", "achievements", "publicEnabled",
];

export function editableProfile(profile) {
  return Object.fromEntries(editableProfileFields.map((key) => [key, profile[key]]));
}

export function profilesDiffer(first, second) {
  return JSON.stringify(editableProfile(first)) !== JSON.stringify(editableProfile(second));
}

// Restore only fields edited in the draft, preserving newer saved account data.
export function mergeProfileEdits(baseline, draft, saved) {
  const next = { ...saved };
  for (const key of editableProfileFields) {
    if (Object.hasOwn(draft, key) && JSON.stringify(baseline[key]) !== JSON.stringify(draft[key])) {
      next[key] = draft[key];
    }
  }
  return next;
}

export function readProfileDraft(storage, key) {
  const draft = JSON.parse(storage.getItem(key) || "null");
  if (!draft || draft.version !== 1 || !draft.profile || !draft.baseline) return null;
  for (const value of [draft.profile, draft.baseline]) {
    for (const field of editableProfileFields) {
      if (["skills", "experiences", "projects", "certificates", "achievements"].includes(field)) {
        if (!Array.isArray(value[field])) return null;
        if (field === "skills" && !value[field].every((item) => typeof item === "string")) return null;
        if (field !== "skills" && !value[field].every((item) => item && typeof item.id === "string" && typeof item.title === "string")) return null;
      } else if (typeof value[field] !== (field === "publicEnabled" ? "boolean" : "string")) return null;
    }
  }
  return draft;
}
