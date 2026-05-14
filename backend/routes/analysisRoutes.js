import express from "express";
import multer from "multer";

import {
  analyzeResume,
  getAnalysis,
  listAnalyses
} from "../controllers/analysisController.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});

router.post("/", upload.single("resume"), analyzeResume);
router.get("/", listAnalyses);
router.get("/:id", getAnalysis);

export default router;
