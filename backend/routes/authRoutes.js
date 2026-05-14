import express from "express";

import {
  confirmVerificationCode,
  getCurrentUser,
  requestVerificationCode
} from "../controllers/authController.js";

const router = express.Router();

router.post("/request-code", requestVerificationCode);
router.post("/verify-code", confirmVerificationCode);
router.get("/me", getCurrentUser);

export default router;
