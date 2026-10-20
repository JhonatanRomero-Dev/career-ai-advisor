import express from "express";

import {
  clearMyResumeTexts,
  deleteMyAccount,
  deleteMyAnalyses,
  exportMyData
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/export", requireAuth, exportMyData);
router.delete("/resume-texts", requireAuth, clearMyResumeTexts);
router.delete("/analyses", requireAuth, deleteMyAnalyses);
router.delete("/account", requireAuth, deleteMyAccount);

export default router;
