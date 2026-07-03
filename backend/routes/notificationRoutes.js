import express from "express";

import {
  getUnreadNotificationCount,
  listNotifications,
  readAllNotifications,
  readNotification
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, listNotifications);
router.get("/unread-count", requireAuth, getUnreadNotificationCount);
router.patch("/read-all", requireAuth, readAllNotifications);
router.patch("/:id/read", requireAuth, readNotification);

export default router;
