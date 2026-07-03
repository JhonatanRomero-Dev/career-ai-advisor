import express from "express";

import {
  activateDemoSubscription,
  createCheckout,
  handleMercadoPagoWebhook,
  getSubscription
} from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getSubscription);
router.post("/checkout", requireAuth, createCheckout);
router.post("/demo-checkout", requireAuth, activateDemoSubscription);
router.post("/webhook/mercadopago", handleMercadoPagoWebhook);

export default router;
