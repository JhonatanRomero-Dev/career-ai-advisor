import express from "express";

import {
  activateDemoSubscription,
  cancelSubscription,
  createCheckout,
  getCheckoutStatus,
  handleMercadoPagoWebhook,
  getSubscription
} from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getSubscription);
router.post("/checkout", requireAuth, createCheckout);
router.get("/checkout/:checkoutId", requireAuth, getCheckoutStatus);
router.post("/demo-checkout", requireAuth, activateDemoSubscription);
router.delete("/", requireAuth, cancelSubscription);
router.post("/webhook/mercadopago", handleMercadoPagoWebhook);

export default router;
