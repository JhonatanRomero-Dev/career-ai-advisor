import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";
import { savedSearchSchema, feedbackSchema } from "../src/productSchemas.js";
import { listSavedSearches, saveSearch, removeSearch, listSearchHistory, rememberSearch, clearSearchHistory,
  createFeedback, listFeedback, updateFeedbackStatus, getPublicProfile, supportMetrics, rateSupportInteraction } from "../src/db.js";

const router = express.Router();
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(422).json({ success: false, error: result.error.issues[0].message });
  req.validated = result.data;
  next();
};
router.get("/profiles/:publicId", (req, res) => {
  const profile = getPublicProfile(req.params.publicId);
  if (!profile) return res.status(404).json({ success: false, error: "Perfil indisponível ou privado." });
  res.json({ success: true, profile });
});
router.use(requireAuth);
router.get("/searches", (req, res) => res.json({ success: true, searches: listSavedSearches(req.user.id), history: listSearchHistory(req.user.id) }));
router.post("/searches", validate(savedSearchSchema), (req, res) => {
  const search = saveSearch(req.user.id, req.validated);
  if (!search) return res.status(422).json({ success: false, error: "Você pode salvar até 30 pesquisas. Remova uma para continuar." });
  res.status(201).json({ success: true, search });
});
router.delete("/searches/:id", (req, res) => {
  if (!removeSearch(req.user.id, req.params.id)) return res.status(404).json({ success: false, error: "Pesquisa não encontrada." });
  res.json({ success: true });
});
router.post("/search-history", validate(z.object({ term: z.string().trim().min(2).max(200) })), (req, res) => res.json({ success: true, history: rememberSearch(req.user.id, req.validated.term) }));
router.delete("/search-history", (req, res) => { clearSearchHistory(req.user.id); res.json({ success: true }); });
router.post("/feedback", validate(feedbackSchema), (req, res) => res.status(201).json({ success: true, feedback: createFeedback(req.user.id, req.validated) }));
router.get("/feedback", (req, res) => res.json({ success: true, feedback: listFeedback(req.user.id) }));
router.post("/support/:id/rating", validate(z.object({ helpful: z.boolean() })), (req, res) => {
  if (!rateSupportInteraction(req.user.id, req.params.id, req.validated.helpful)) return res.status(404).json({ success: false, error: "Resposta não encontrada." });
  res.json({ success: true });
});
router.get("/admin/feedback", requireAdmin, (_req, res) => res.json({ success: true, feedback: listFeedback(), support: supportMetrics() }));
router.patch("/admin/feedback/:id", requireAdmin, validate(z.object({ status: z.enum(["new", "reviewing", "planned", "resolved"]) })), (req, res) => {
  if (!updateFeedbackStatus(req.params.id, req.validated.status)) return res.status(404).json({ success: false, error: "Feedback não encontrado." });
  res.json({ success: true });
});
export default router;
