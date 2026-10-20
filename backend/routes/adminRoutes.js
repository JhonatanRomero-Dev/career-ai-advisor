import express from "express";

import {
  getAdminDashboard,
  retryAnalysisJob
} from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/dashboard", requireAdmin, getAdminDashboard);
router.post("/analysis-jobs/:jobId/retry", requireAdmin, retryAnalysisJob);

export default router;
