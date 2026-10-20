import express from "express";

import {
  confirmPasswordReset,
  confirmVerificationCode,
  exchangeOAuthSessionCode,
  finishOAuthLogin,
  getCsrfToken,
  getCurrentUser,
  getProfile,
  getOAuthProviders,
  loginWithPassword,
  logout,
  registerUser,
  requestPasswordReset,
  requestEmailLoginCode,
  requestVerificationCode,
  startOAuthLogin,
  updateProfile
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginWithPassword);
router.post("/request-code", requestVerificationCode);
router.post("/request-email-login-code", requestEmailLoginCode);
router.post("/verify-code", confirmVerificationCode);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", confirmPasswordReset);
router.post("/oauth/exchange", exchangeOAuthSessionCode);
router.get("/csrf", getCsrfToken);
router.get("/oauth/providers", getOAuthProviders);
router.get("/me", getCurrentUser);
router.get("/profile", requireAuth, getProfile);
router.patch("/profile", requireAuth, updateProfile);
router.post("/logout", logout);
router.get("/oauth/:provider/start", startOAuthLogin);
router.get("/oauth/:provider/callback", finishOAuthLogin);

export default router;
