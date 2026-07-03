import express from "express";

import {
  confirmPasswordReset,
  confirmVerificationCode,
  exchangeOAuthSessionCode,
  finishOAuthLogin,
  getCurrentUser,
  getProfile,
  loginWithPassword,
  logout,
  registerUser,
  requestPasswordReset,
  requestVerificationCode,
  startOAuthLogin,
  updateProfile
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginWithPassword);
router.post("/request-code", requestVerificationCode);
router.post("/verify-code", confirmVerificationCode);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", confirmPasswordReset);
router.post("/oauth/exchange", exchangeOAuthSessionCode);
router.get("/me", getCurrentUser);
router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, updateProfile);
router.post("/logout", logout);
router.get("/oauth/:provider/start", startOAuthLogin);
router.get("/oauth/:provider/callback", finishOAuthLogin);

export default router;
