import assert from "node:assert/strict";
import test from "node:test";
import { matchesJob, searchSuggestions, uniqueJobs } from "../../src/lib/jobSearch.js";

const assistant = { title: "Assistente de TI", company: "Acme", location: "Curitiba, PR", is_real: true, required_skills: ["Windows", "Redes"] };

test("role searches match the advertised title, not an unrelated description", () => {
  assert.equal(matchesJob(assistant, { search: "Assistente de TI" }), true);
  assert.equal(matchesJob({ ...assistant, title: "Assistente TI Júnior" }, { search: "assistente de ti" }), true);
  assert.equal(matchesJob({ ...assistant, title: "Desenvolvedor Frontend", description: "Trabalhe com nosso assistente de TI." }, { search: "Assistente de TI" }), false);
  assert.equal(matchesJob({ ...assistant, title: "Assistente Administrativo", description: "Rotinas de atividades administrativas." }, { search: "Assistente de TI" }), false);
  assert.equal(matchesJob({ ...assistant, title: "Assistente Administrativo", required_skills: ["TI"] }, { search: "Assistente de TI" }), false);
});

test("keyword searches respect word boundaries and keep technical skills searchable", () => {
  assert.equal(matchesJob(assistant, { search: "TI" }), true);
  assert.equal(matchesJob({ ...assistant, title: "Analista Administrativo", required_skills: [] }, { search: "TI" }), false);
  assert.equal(matchesJob(assistant, { search: "windows" }), true);
  assert.equal(matchesJob({ ...assistant, required_skills: ["C++", "C#", "Node.js"] }, { search: "C++" }), true);
  assert.equal(matchesJob({ ...assistant, required_skills: ["JavaScript"] }, { search: "Java" }), false);
  assert.equal(matchesJob({ ...assistant, title: "Desenvolvedor React Sênior" }, { search: "senior react" }), true);
});

test("external searches cannot match skills copied from the resume or unknown vacancy attributes", () => {
  const search = { title: "Buscar Desenvolvedor Frontend", is_search_link: true, is_real: false, required_skills: ["Assistente de TI", "Redes"], description: "Assistente de TI", remote: false, match_percentage: 0 };
  assert.equal(matchesJob(search, { search: "Assistente de TI" }), false);
  assert.equal(matchesJob(search, { search: "Redes" }), false);
  assert.equal(matchesJob(search, { mode: "onsite" }), false);
  assert.equal(matchesJob(search, { match: "improve" }), false);
  assert.equal(matchesJob(search, { search: "Frontend" }), true);
  assert.deepEqual(searchSuggestions([search], "Redes"), []);
});

test("old duplicated results retain the original title and destination as one record", () => {
  const job = { ...assistant, id: "it-1", url: "https://example.com/jobs/it-1" };
  const other = { ...assistant, id: "it-2", url: "https://example.com/jobs/it-2" };
  assert.deepEqual(uniqueJobs([job, { ...job }, other, { ...job, id: "old-id" }]), [job, other]);
});
