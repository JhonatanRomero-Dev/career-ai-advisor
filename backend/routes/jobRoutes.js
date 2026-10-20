import express from "express";
import { listTrackedJobs, removeTrackedJob, saveTrackedJob, searchJobs, updateTrackedJob } from "../controllers/jobController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/search", requireAuth, searchJobs);
router.get("/tracked", requireAuth, listTrackedJobs);
router.post("/tracked", requireAuth, saveTrackedJob);
router.patch("/tracked/:externalId", requireAuth, updateTrackedJob);
router.delete("/tracked/:externalId", requireAuth, removeTrackedJob);

export default router;
