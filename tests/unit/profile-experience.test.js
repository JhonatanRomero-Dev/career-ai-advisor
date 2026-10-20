import test from "node:test";
import assert from "node:assert/strict";
import { editableProfileFields, mergeProfileEdits, profilesDiffer, readProfileDraft } from "../../src/lib/profileDraft.js";
import { profileImportCandidates } from "../../src/lib/profileImport.js";

const empty = () => Object.fromEntries(editableProfileFields.map((field) => [field,
  ["skills", "experiences", "projects", "certificates", "achievements"].includes(field) ? [] : field === "publicEnabled" ? false : ""]));

test("draft recovery preserves newer saved values and account metadata", () => {
  const baseline = { ...empty(), phone: "111", summary: "Original" };
  const draft = { ...baseline, summary: "Rascunho", publicId: "untrusted", email: "another@example.com" };
  const saved = { ...baseline, phone: "222", publicId: "real", email: "owner@example.com" };
  assert.deepEqual(mergeProfileEdits(baseline, draft, saved), { ...saved, summary: "Rascunho" });
  assert.equal(profilesDiffer(saved, { ...saved, updated_date: "tomorrow" }), false);
});

test("save reconciliation retains edits made during a request, including cleared values", () => {
  const submitted = { ...empty(), name: "Ana", summary: "Original" };
  const editing = { ...submitted, summary: "", skills: ["React"] };
  const saved = { ...submitted, publicId: "server-id" };
  assert.deepEqual(mergeProfileEdits(submitted, editing, saved), { ...editing, publicId: "server-id" });
});

test("invalid drafts are rejected without exposing malformed profile fields", () => {
  const valid = { version: 1, baseline: empty(), profile: empty() };
  const storage = (data) => ({ getItem: () => JSON.stringify(data) });
  assert.deepEqual(readProfileDraft(storage(valid), "owner"), valid);
  assert.equal(readProfileDraft(storage({ ...valid, version: 2 }), "owner"), null);
  assert.equal(readProfileDraft(storage({ ...valid, profile: { ...empty(), skills: [null] } }), "owner"), null);
  assert.equal(readProfileDraft(storage({ ...valid, profile: { ...empty(), experiences: [{}] } }), "owner"), null);
});

test("resume import merges skills without aliases, duplicates or invented profile text", () => {
  const candidates = profileImportCandidates({ seniority: "Sênior", summary: "An evaluation, not a professional bio",
    target_job_title: "Unconfirmed target", detected_skills: ["reactjs", "Python", "", null], parsed_data: { phone: "123" } },
  { skills: ["React"], phone: "321" });
  assert.deepEqual(candidates.map(({ field, value }) => [field, value]), [
    ["phone", "123"], ["experienceLevel", "Senior"], ["skills", ["React", "Python"]],
  ]);
  assert.deepEqual(profileImportCandidates({ seniority: "Não informado" }, { skills: [] }), []);
});

test("import respects the profile skill limit", () => {
  const skills = Array.from({ length: 50 }, (_, index) => `Skill ${index}`);
  assert.deepEqual(profileImportCandidates({ detected_skills: ["Python"] }, { skills }), []);
});
