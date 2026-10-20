import assert from "node:assert/strict";
import test from "node:test";

import { canReuseJobSearch, clearRealJobsCache, isJobSearchContextAllowed, rankRealJob, searchRealJobs } from "../src/realJobs.js";

const realListing = {
  id: 987,
  url: "https://remotive.com/remote-jobs/software-dev/frontend-engineer-987",
  title: "Frontend Engineer",
  company_name: "Example Corp",
  candidate_required_location: "Latin America",
  publication_date: new Date().toISOString(),
  job_type: "full_time",
  description: "<p>Build products with React, TypeScript, HTML, CSS and Playwright.</p>"
};

test("ranks a verifiable listing using its real requirements", () => {
  const job = rankRealJob(realListing, {
    area: "frontend",
    targetTitle: "Frontend Engineer",
    seniority: "Pleno",
    skills: ["react", "typescript", "playwright"]
  });

  assert.equal(job.is_real, true);
  assert.equal(job.company, "Example Corp");
  assert.equal(job.source, "Remotive");
  assert.equal(job.url, realListing.url);
  assert.ok(job.match >= 70);
  assert.ok(job.required_skills.includes("react"));
  assert.ok(job.match_reasons.includes("react"));
  assert.ok(!job.description.includes("<p>"));
});

test("rejects listings that do not prove identity, destination or Brazil eligibility", () => {
  assert.equal(rankRealJob({ ...realListing, url: "" }, { area: "frontend" }), null);
  assert.equal(rankRealJob({ ...realListing, company_name: "" }, { area: "frontend" }), null);
  assert.equal(rankRealJob({ ...realListing, candidate_required_location: "USA only" }, { area: "frontend" }), null);
});

test("understands common resume aliases when matching advertised technologies", () => {
  const job = rankRealJob({
    ...realListing,
    title: "Backend Node.js Developer",
    description: "Work with Node.js, PostgreSQL and Docker."
  }, {
    area: "backend",
    skills: ["node", "postgres", "docker"]
  });

  assert.ok(job.match_reasons.includes("node"));
  assert.ok(!job.improvement_tips.some((tip) => tip.includes("node.js")));
});

test("blocks adult-service euphemisms instead of interpreting them as technology careers", () => {
  const unsafeContext = {
    area: "frontend",
    targetTitle: "Garota de programa",
    skills: ["javascript"]
  };

  assert.equal(isJobSearchContextAllowed(unsafeContext), false);
  assert.equal(rankRealJob(realListing, unsafeContext), null);
});

test("requires a recognized technology area and concrete career evidence", () => {
  assert.equal(isJobSearchContextAllowed({ area: null, targetTitle: "qualquer coisa" }), false);
  assert.equal(isJobSearchContextAllowed({ area: "frontend", targetTitle: "Frontend Developer" }), true);
  assert.equal(isJobSearchContextAllowed({ area: "backend", skills: ["node"] }), true);
});

test("does not approve a title-only match without a proven requirement", () => {
  const job = rankRealJob(realListing, {
    area: "frontend",
    targetTitle: "Frontend Developer",
    skills: ["python"]
  });

  assert.equal(job, null);
});

test("rejects stale ads and exposes an explainable score", () => {
  assert.equal(rankRealJob({
    ...realListing,
    publication_date: "2020-01-01T00:00:00.000Z"
  }, { area: "frontend", skills: ["react"] }), null);

  const job = rankRealJob(realListing, { area: "frontend", skills: ["react", "typescript"] });
  assert.equal(typeof job.match_breakdown.required_skills, "number");
  assert.ok(["alta", "média", "baixa"].includes(job.match_confidence));
});

test("returns structured search states before contacting a provider", async () => {
  const blocked = await searchRealJobs({ area: "frontend", targetTitle: "Garota de programa", skills: ["react"] });
  const invalid = await searchRealJobs({ area: null, targetTitle: "Cargo desconhecido" });

  assert.equal(blocked.status, "blocked");
  assert.equal(invalid.status, "invalid_profile");
  assert.deepEqual(blocked.jobs, []);
});

test("handles Jobicy HTML responses as provider errors", async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = process.env.JOBS_PROVIDER;
  const originalNodeEnv = process.env.NODE_ENV;

  clearRealJobsCache();
  process.env.JOBS_PROVIDER = "jobicy";
  process.env.NODE_ENV = "development";
  globalThis.fetch = async () => new Response("<!DOCTYPE html><html></html>", {
    status: 200,
    headers: { "content-type": "text/html" }
  });

  try {
    const result = await searchRealJobs({
      area: "frontend",
      targetTitle: "Frontend Developer",
      skills: ["react"]
    });

    assert.equal(result.status, "provider_error");
    assert.match(result.error, /Jobicy respondeu HTML em vez de JSON/);
    assert.doesNotMatch(result.error, /Unexpected token/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.JOBS_PROVIDER = originalProvider;
    process.env.NODE_ENV = originalNodeEnv;
    clearRealJobsCache();
  }
});

test("keeps a real entry-level opportunity when at least one required skill is proven", () => {
  const job = rankRealJob(realListing, {
    area: "frontend",
    skills: ["css"],
    seniority: "Não identificada"
  });

  assert.ok(job);
  assert.ok(job.match >= 35);
  assert.ok(job.match < 70);
});

test("supports corporate career areas beyond technology", () => {
  const marketingListing = {
    ...realListing,
    id: 991,
    title: "Growth Marketing Analyst",
    description: "Own growth marketing campaigns, SEO, CRM and Google Analytics."
  };
  const job = rankRealJob(marketingListing, {
    area: "marketing",
    targetTitle: "Growth Marketing Analyst",
    skills: ["marketing", "seo", "crm", "google analytics"]
  });

  assert.ok(job);
  assert.ok(job.match >= 70);
});

test("accepts compound skills detected in an administrative customer profile", () => {
  const context = {
    area: "customer_success",
    skills: ["atendimento ao cliente", "suporte", "controle de documentos"],
    seniority: "Júnior"
  };

  assert.equal(isJobSearchContextAllowed(context), true);

  const job = rankRealJob({
    ...realListing,
    id: 992,
    title: "Customer Support Assistant",
    description: "Provide atendimento ao cliente, customer support and CRM documentation."
  }, context);

  assert.ok(job);
  assert.ok(job.required_skills.includes("atendimento"));
});

test("matches a Portuguese administrative CV to an English office assistant listing", () => {
  const context = {
    area: "administrative",
    skills: ["auxiliar administrativo", "atendimento ao cliente", "suporte", "controle de documentos"],
    seniority: "Júnior"
  };
  const job = rankRealJob({
    ...realListing,
    id: 993,
    title: "Remote Office Assistant",
    description: "Support administrative operations, organize client documents, maintain company records and perform data entry."
  }, context);

  assert.ok(job);
  assert.ok(job.match >= 35);
  assert.ok(job.match_reasons.includes("controle de documentos"));
});

test("prioritizes city, metro, state and mobility instead of filtering hard by city", () => {
  const context = {
    area: "frontend",
    targetTitle: "Frontend Engineer",
    skills: ["react", "typescript", "playwright"],
    seniority: "Pleno",
    location: "Sao Paulo, SP",
    profileText: "Disponivel para trabalho remoto e para mudanca quando fizer sentido"
  };

  const sameCity = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Sao Paulo, SP"
  }, context);
  const metroArea = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Campinas, SP"
  }, context);
  const sameState = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Bauru, SP"
  }, context);
  const otherState = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Curitiba, PR"
  }, context);

  assert.ok(sameCity);
  assert.ok(metroArea);
  assert.ok(sameState);
  assert.ok(otherState);
  assert.ok(sameCity.match >= metroArea.match);
  assert.ok(metroArea.match >= sameState.match);
  assert.ok(sameState.match >= otherState.match);
  assert.ok(sameCity.match_reasons.includes("Mesma cidade"));
});

test("gives a clear boost to remote work when the profile accepts mobility", () => {
  const context = {
    area: "frontend",
    targetTitle: "Frontend Engineer",
    skills: ["react", "typescript", "playwright"],
    seniority: "Pleno",
    location: "Sao Paulo, SP",
    profileText: "Disponivel para trabalho remoto, viagem e mudanca"
  };

  const remoteRole = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Latin America",
    remote: true
  }, context);
  const onsiteRole = rankRealJob({
    ...realListing,
    is_brazil_listing: true,
    candidate_required_location: "Curitiba, PR",
    remote: false
  }, context);

  assert.ok(remoteRole);
  assert.ok(onsiteRole);
  assert.ok(remoteRole.match > onsiteRole.match);
  assert.ok(remoteRole.match_reasons.includes("Vaga remota"));
});

test("the explicit IT support role takes precedence over an inferred frontend area", () => {
  const context = { area: "frontend", targetRole: "Assistente de TI", skills: ["html", "css"] };
  assert.equal(isJobSearchContextAllowed({ area: "frontend", targetRole: "Assistente de TI" }), true);
  assert.equal(rankRealJob(realListing, context), null);
  assert.equal(rankRealJob({ ...realListing, title: "Assistente Administrativo", description: "Atividades com HTML e CSS na equipe de TI." }, context), null);
  const job = rankRealJob({ ...realListing, title: "Assistente de TI", description: "Suporte aos usuários, manutenção de computadores e atualizações em HTML e CSS." }, context);
  assert.ok(job);
  assert.equal(job.title, "Assistente de TI");
  assert.equal(job.url, realListing.url);
  assert.equal(rankRealJob(realListing, { ...context, targetTitle: "Frontend Engineer" })?.title, "Frontend Engineer");
});

test("external searches preserve the chosen role on every platform without duplicates", async (t) => {
  const originalProvider = process.env.JOBS_PROVIDER;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.JOBS_PROVIDER = "remotive";
  process.env.NODE_ENV = "development";
  clearRealJobsCache();
  t.after(() => {
    if (originalProvider === undefined) delete process.env.JOBS_PROVIDER;
    else process.env.JOBS_PROVIDER = originalProvider;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    clearRealJobsCache();
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ jobs: [] }));

  const result = await searchRealJobs({ area: "frontend", targetRole: "Assistente de TI", skills: ["html", "css"], location: "Curitiba, PR" });
  assert.equal(result.status, "success");
  assert.equal(result.jobs.length, 4);
  assert.equal(new Set(result.jobs.map((job) => job.id)).size, result.jobs.length);
  assert.equal(new Set(result.jobs.map((job) => job.url)).size, result.jobs.length);
  for (const job of result.jobs) {
    assert.equal(job.title, "Buscar Assistente de TI");
    assert.equal(job.is_real, false);
    assert.equal(job.is_search_link, true);
    assert.deepEqual(job.required_skills, []);
    const url = new URL(job.url);
    if (job.source === "Vagas.com") assert.equal(url.pathname, "/vagas-de-assistente-de-ti");
    else assert.equal(url.searchParams.get("keywords") || url.searchParams.get("q") || url.searchParams.get("Palabra"), "Assistente de TI");
  }

  const inferred = await searchRealJobs({ area: "frontend", skills: ["html", "css"] });
  assert.equal(inferred.jobs.length, 8);
  assert.equal(new Set(inferred.jobs.map((job) => job.id)).size, inferred.jobs.length);
});

test("cached recommendations are refreshed after the target changes or when legacy links are present", () => {
  const context = { targetRole: "Assistente de TI" };
  const search = { id: "search-ti", title: "Buscar Assistente de TI", search_query: "Assistente de TI", is_search_link: true, url: "https://example.com/search?q=assistente" };
  assert.equal(canReuseJobSearch([search], context), true);
  assert.equal(canReuseJobSearch([{ ...search, search_query: undefined }], context), false);
  assert.equal(canReuseJobSearch([search, search], context), false);
  assert.equal(canReuseJobSearch([search], { targetRole: "Desenvolvedor Frontend" }), false);
  assert.equal(canReuseJobSearch([realListing], context), false);
});

test("generic occupation titles still return listings with that advertised occupation", () => {
  const context = { area: "frontend", targetTitle: "Desenvolvedor", skills: ["html", "css"] };
  const listing = { ...realListing, title: "Desenvolvedor Frontend" };
  assert.ok(rankRealJob(listing, context));
  assert.equal(canReuseJobSearch([listing], context), true);
  assert.equal(rankRealJob({ ...listing, title: "Assistente de TI" }, context), null);
});
