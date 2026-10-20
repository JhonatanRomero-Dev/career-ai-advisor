import express from "express";
import { ingestProductEvent } from "../controllers/analyticsController.js";

const router = express.Router();
router.post("/events", ingestProductEvent);

export default router;
