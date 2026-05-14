import {
  getUserByEmail,
  saveEmailVerificationCode,
  verifyEmailCode
} from "../src/db.js";
import { sendVerificationCode } from "../src/email.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function requestVerificationCode(req, res) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail valido"
      });
    }

    const code = createCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    saveEmailVerificationCode(email, code, expiresAt);

    const emailResult = await sendVerificationCode(email, code);

    return res.json({
      success: true,
      message: emailResult.sent
        ? "Codigo enviado para o e-mail informado"
        : "Codigo gerado em modo desenvolvimento",
      dev_code: emailResult.devCode
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function confirmVerificationCode(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();

    if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: "E-mail ou codigo invalido"
      });
    }

    const user = verifyEmailCode(email, code);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Codigo invalido ou expirado"
      });
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const email = normalizeEmail(req.query.email);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Informe um e-mail valido"
      });
    }

    const user = getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Usuario nao encontrado"
      });
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
