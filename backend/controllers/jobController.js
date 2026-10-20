import {
  deleteTrackedJobForUser,
  listTrackedJobsForUser,
  upsertTrackedJobForUser
} from "../src/db.js";
import { searchJobsByKeyword } from "../src/realJobs.js";
import { z } from "zod";

const TRACKING_STATUSES = new Set(["saved", "applied", "interview", "offer", "rejected", "archived"]);
const trackingSchema = z.object({
  status: z.enum([...TRACKING_STATUSES]).optional(),
  analysis_id: z.string().max(200).optional(),
  resume_version_id: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).optional(),
  next_action: z.string().trim().max(200).optional(),
  applied_at: z.string().datetime({ offset: true }).nullable().optional(),
  interview_at: z.string().datetime({ offset: true }).nullable().optional(),
  reminder_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function searchJobs(req, res, next) {
  const { q, location = "" } = req.query;
  if (typeof q !== "string" || q.trim().length < 2 || q.length > 200 || typeof location !== "string" || location.length > 200) {
    return res.status(422).json({ success: false, error: "Digite uma palavra-chave entre 2 e 200 caracteres e uma localização válida." });
  }
  try {
    const result = await searchJobsByKeyword({ keyword: q, location });
    if (["invalid_query", "blocked"].includes(result.status)) return res.status(422).json({ success: false, error: result.error });
    return res.json({ success: true, ...result });
  } catch (error) { return next(error); }
}

export function listTrackedJobs(req, res) {
  return res.json({ success: true, tracked_jobs: listTrackedJobsForUser(req.user?.id) });
}

export function saveTrackedJob(req, res) {
  const parsed = trackingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ success: false, error: "Confira as datas, a etapa e o tamanho das anotações." });
  const job = req.body?.job;
  const status = String(req.body?.status || "saved");
  const externalId = String(req.body?.external_id || job?.external_id || job?.id || job?.url || "").trim();

  if (!externalId || !job || typeof job !== "object" || !/^https:\/\//i.test(String(job.url || ""))) {
    return res.status(422).json({ success: false, error: "Informe uma vaga válida para salvar." });
  }
  if (!TRACKING_STATUSES.has(status)) {
    return res.status(422).json({ success: false, error: "Etapa da candidatura inválida." });
  }

  const trackedJob = upsertTrackedJobForUser(req.user.id, req.user.email, {
    ...parsed.data,
    external_id: externalId,
    analysis_id: req.body?.analysis_id,
    status,
    notes: req.body?.notes,
    job
  });
  return res.status(201).json({ success: true, tracked_job: trackedJob });
}

export function updateTrackedJob(req, res) {
  const parsed = trackingSchema.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(422).json({ success: false, error: "Confira as datas, a etapa e o tamanho das anotações." });
  const trackedJob = upsertTrackedJobForUser(req.user.id, req.user.email, {
    ...parsed.data,
    external_id: req.params.externalId,
  });
  if (!trackedJob) return res.status(404).json({ success: false, error: "Vaga salva não encontrada." });
  return res.json({ success: true, tracked_job: trackedJob });
}

export function removeTrackedJob(req, res) {
  const removed = deleteTrackedJobForUser(req.params.externalId, req.user?.id);
  if (!removed) return res.status(404).json({ success: false, error: "Vaga salva não encontrada." });
  return res.json({ success: true });
}
