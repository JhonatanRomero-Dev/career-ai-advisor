import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  analyzeResume,
  deleteAnalysis,
  generateImprovedResume,
  getAnalysisTasks,
  getAnalysisUsage,
  getAnalysis,
  listAnalyses,
  updateAnalysisTasks
} from "../controllers/analysisController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "..", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set([".pdf", ".docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeExtension = allowedExtensions.has(extension) ? extension : "";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExtension}`;

      callback(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const mimeType = String(file.mimetype || "").toLowerCase();

    if (allowedExtensions.has(extension) || allowedMimeTypes.has(mimeType)) {
      callback(null, true);
      return;
    }

    callback(Object.assign(new Error("Envie um arquivo PDF ou DOCX."), { statusCode: 415 }));
  }
});

function uploadResume(req, res, next) {
  upload.single("resume")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "O arquivo deve ter no máximo 10MB."
      : error.message || "Erro ao receber arquivo.";

    res.status(error.statusCode || 400).json({
      success: false,
      error: message
    });
  });
}

router.post("/", requireAuth, uploadResume, analyzeResume);
router.get("/", requireAuth, listAnalyses);
router.get("/usage", requireAuth, getAnalysisUsage);
router.get("/:id/tasks", requireAuth, getAnalysisTasks);
router.patch("/:id/tasks", requireAuth, updateAnalysisTasks);
router.post("/:id/improved-resume", requireAuth, generateImprovedResume);
router.get("/:id", requireAuth, getAnalysis);
router.delete("/:id", requireAuth, deleteAnalysis);

export default router;
