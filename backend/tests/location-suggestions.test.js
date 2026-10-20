import assert from "node:assert/strict";
import test from "node:test";
import { cityOptionsFromResponse, createLocationOption, fallbackLocationOptions, getLocationSuggestions, jobLocationSuggestions, matchesLocationQuery } from "../../src/lib/locationSuggestions.js";
import { matchesJob } from "../../src/lib/jobSearch.js";

test("city suggestions accept prefixes, accents and city/state combinations", () => {
  assert.deepEqual(getLocationSuggestions(fallbackLocationOptions, "c"), []);
  assert.equal(getLocationSuggestions(fallbackLocationOptions, "CUR")[0].label, "Curitiba, PR");
  assert.ok(getLocationSuggestions(fallbackLocationOptions, "sao").some(({ label }) => label === "São Paulo, SP"));
  assert.equal(getLocationSuggestions(fallbackLocationOptions, "curitiba/pr")[0].label, "Curitiba, PR");
  assert.ok(getLocationSuggestions(fallbackLocationOptions, "pira").some(({ label }) => label === "Piraquara, PR"));
  assert.deepEqual(getLocationSuggestions(fallbackLocationOptions, "zzzzzz"), []);
});

test("state suggestions accept both abbreviations and full names", () => {
  assert.deepEqual(jobLocationSuggestions(fallbackLocationOptions, "pr")[0], { label: "Paraná (PR)", value: "PR" });
  assert.equal(jobLocationSuggestions(fallbackLocationOptions, "parana")[0].value, "PR");
  assert.equal(jobLocationSuggestions(fallbackLocationOptions, "sp")[0].value, "SP");
  assert.ok(jobLocationSuggestions(fallbackLocationOptions, "sao").length <= 8);
});

test("job locations supplement the city catalogue without repeating the same option", () => {
  const jobLocations = ["Inverness, Scotland", "São Paulo, SP", "sao paulo, sp", "", null];
  assert.deepEqual(jobLocationSuggestions(fallbackLocationOptions, "inver", jobLocations), [
    { label: "Inverness, Scotland", value: "Inverness, Scotland" },
  ]);
  assert.equal(jobLocationSuggestions(fallbackLocationOptions, "sao paulo", jobLocations)
    .filter(({ value }) => value === "São Paulo, SP").length, 1);
});

test("municipality data supports both state formats and keeps homonymous cities distinct", () => {
  const cities = cityOptionsFromResponse([
    { nome: "Bom Jesus", microrregiao: { mesorregiao: { UF: { sigla: "RS" } } } },
    { nome: "Bom Jesus", "regiao-imediata": { "regiao-intermediaria": { UF: { sigla: "PI" } } } },
    { nome: "Bom Jesus", microrregiao: { mesorregiao: { UF: { sigla: "RS" } } } },
    null, { nome: "" },
  ]);
  assert.deepEqual(cities.map(({ label }) => label), ["Bom Jesus, RS", "Bom Jesus, PI"]);
  assert.equal(getLocationSuggestions(cities, "bom jesus pi")[0].state, "PI");
  assert.equal(createLocationOption(null), null);
  assert.throws(() => cityOptionsFromResponse({ error: "unavailable" }), /carregar as cidades/);
});

test("selected cities match state abbreviations or full names without widening to other cities", () => {
  for (const location of ["Curitiba, PR", "Curitiba - Paraná, Brasil", "Curitiba/PR", "Curitiba (PR)"]) {
    assert.equal(matchesLocationQuery(location, "Curitiba, PR"), true, location);
  }
  assert.equal(matchesLocationQuery("Londrina, PR", "Curitiba, PR"), false);
  assert.equal(matchesLocationQuery("Curitiba, SC", "Curitiba, PR"), false);
  assert.equal(matchesLocationQuery("São Paulo, MG", "São Paulo, SP"), false);
  assert.equal(matchesLocationQuery("São Paulo, Paraná, Brasil", "São Paulo, SP"), false);
  assert.equal(matchesLocationQuery("Campinas, SP", "São Paulo"), false);
});

test("state filters use complete abbreviations and continue to accept free text", () => {
  assert.equal(matchesLocationQuery("Curitiba, Paraná, Brasil", "PR"), true);
  assert.equal(matchesLocationQuery("Campinas, SP", "SP"), true);
  assert.equal(matchesLocationQuery("Hospital, Brasil", "SP"), false);
  assert.equal(matchesLocationQuery("Campinas, SP", "camp"), true);
  assert.equal(matchesLocationQuery("Inverness, Scotland", "Inverness, Scotland"), true);
  assert.equal(matchesLocationQuery("Remoto", ""), true);
  assert.equal(matchesLocationQuery(null, "SP"), false);
});

test("selected location combines with existing job filters", () => {
  const job = { title: "Desenvolvedor Python", location: "Curitiba, Paraná, Brasil", remote: true, salary_min: 6000, salary_currency: "BRL", salary_period: "month" };
  const filters = { search: "Python", location: "Curitiba, PR", mode: "remote", salaryMin: 5000 };
  assert.equal(matchesJob(job, filters), true);
  assert.equal(matchesJob({ ...job, location: "Londrina, PR" }, filters), false);
  assert.equal(matchesJob({ ...job, remote: false }, filters), false);
  assert.equal(matchesJob({ ...job, salary_min: 4000 }, filters), false);
});
