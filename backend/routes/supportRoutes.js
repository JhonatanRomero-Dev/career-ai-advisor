import express from "express";

import { chatWithSupport } from "../controllers/supportController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/chat", requireAuth, chatWithSupport);

export default router;
