import assert from "node:assert/strict";
import test from "node:test";
import { clearRealJobsCache, searchJobsByKeyword } from "../src/realJobs.js";
import { matchesJob } from "../../src/lib/jobSearch.js";

const listing = {
  id: 100, title: "Desenvolvedor React", company_name: "Acme", candidate_required_location: "Worldwide",
  url: "https://example.com/jobs/100", publication_date: new Date().toISOString(),
  description: "Desenvolva produtos com React e TypeScript.",
};

function setup(t, provider = "remotive") {
  const previous = { JOBS_PROVIDER: process.env.JOBS_PROVIDER, NODE_ENV: process.env.NODE_ENV };
  process.env.JOBS_PROVIDER = provider;
  process.env.NODE_ENV = "development";
  clearRealJobsCache();
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    clearRealJobsCache();
  });
}

test("keyword discovery finds new listings without a resume and sends the query to the provider", async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).searchParams.get("search"), "React");
    return Response.json({ jobs: [listing, { ...listing, id: 101, title: "Assistente Administrativo", description: "Rotinas de escritório." }] });
  });
  const result = await searchJobsByKeyword({ keyword: "  React  " });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(result.status, "success");
  assert.deepEqual(result.jobs.map((job) => job.title), [listing.title]);
  assert.equal(result.jobs[0].url, listing.url);
  assert.equal(result.jobs[0].match_evaluated, false);
  assert.equal(result.jobs[0].match_percentage, null);
  assert.equal(matchesJob(result.jobs[0], { match: "improve" }), false);
  assert.ok(result.external_searches.every((job) => !job.is_real && job.is_search_link));
});

test("keyword searches share in-flight work and cache results separately for each location", async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ jobs: [
      { ...listing, candidate_required_location: "São Paulo, SP", is_brazil_listing: true },
      { ...listing, id: 101, url: "https://example.com/jobs/101", candidate_required_location: "Campinas, SP", is_brazil_listing: true },
    ] });
  });
  const [first, second] = await Promise.all([
    searchJobsByKeyword({ keyword: "React", location: "São Paulo" }),
    searchJobsByKeyword({ keyword: "React", location: "São Paulo" }),
  ]);
  assert.deepEqual(first, second);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(first.jobs.map((job) => job.location), ["São Paulo, SP"]);
  const campinas = await searchJobsByKeyword({ keyword: "React", location: "Campinas" });
  assert.deepEqual(campinas.jobs.map((job) => job.location), ["Campinas, SP"]);
  await searchJobsByKeyword({ keyword: "React", location: "São Paulo" });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("keyword results rank titles first and exclude stale, unrelated and ineligible ads", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ jobs: [
    { ...listing, id: 101, title: "Frontend Engineer" }, listing,
    { ...listing, id: 102, publication_date: "2020-01-01" },
    { ...listing, id: 103, candidate_required_location: "USA only" },
    { ...listing, id: 104, url: "javascript:alert(1)" },
    { ...listing, id: 105, title: "Analista Financeiro", description: "Contabilidade" },
  ] }));
  const result = await searchJobsByKeyword({ keyword: "React" });
  assert.deepEqual(result.jobs.map((job) => job.title), ["Desenvolvedor React", "Frontend Engineer"]);
});

test("InfoJobs uses its keyword search parameter and supports occupations outside resume categories", async (t) => {
  setup(t, "infojobs");
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).pathname, "/vagas-de-emprego.aspx");
    assert.equal(new URL(url).searchParams.get("Palabra"), "Eletricista");
    return new Response(`<div class="js_rowCard" data-id="123" data-href="/vaga-de-eletricista__123.aspx">
      <h2 class="js_vacancyTitle">Eletricista</h2>
      <div class="d-flex align-items-baseline"><a>Empresa Elétrica</a></div>
      <div class="mb-8">Curitiba, PR</div><p>Instalações e manutenção elétrica.</p></div>`,
    { headers: { "content-type": "text/html" } });
  });
  const result = await searchJobsByKeyword({ keyword: "Eletricista" });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].title, "Eletricista");
  assert.equal(result.jobs[0].url, "https://www.infojobs.com.br/vaga-de-eletricista__123.aspx");
});

test("failed providers give retryable errors and external links without inventing ads", async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  const result = await searchJobsByKeyword({ keyword: "React" });
  assert.equal(result.status, "provider_error");
  assert.equal(result.jobs.length, 0);
  assert.equal(result.external_searches.length, 4);
  await searchJobsByKeyword({ keyword: "React" });
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("one unavailable source does not discard results from a healthy provider", async (t) => {
  setup(t, "auto");
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("remotive.com")) return Response.json({ jobs: [listing] });
    throw new Error("offline");
  });
  const result = await searchJobsByKeyword({ keyword: "React" });
  assert.equal(result.status, "success");
  assert.equal(result.jobs.length, 1);
  assert.ok(result.quality.providers_failed >= 3);
  assert.match(result.error, /Algumas fontes/);
});

test("empty and overlong keywords never contact external providers", async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  for (const keyword of ["", " ", "a", "x".repeat(201)]) {
    assert.equal((await searchJobsByKeyword({ keyword })).status, "invalid_query");
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});
