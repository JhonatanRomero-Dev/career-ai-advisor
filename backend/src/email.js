import nodemailer from "nodemailer";

const REQUIRED_SMTP_CONFIG = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS"
];

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const rawPass = String(process.env.SMTP_PASS || "");
  const pass = host.includes("gmail.com") ? rawPass.replace(/\s+/g, "") : rawPass;
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from: process.env.SMTP_FROM || user
  };
}

function getMissingSmtpConfig() {
  return REQUIRED_SMTP_CONFIG.filter((key) => !String(process.env[key] || "").trim());
}

function hasSmtpConfig() {
  const config = getSmtpConfig();

  return getMissingSmtpConfig().length === 0 && Number.isFinite(config.port) && config.port > 0;
}

function createEmailUnavailableError(reason = "SMTP_UNAVAILABLE", details = {}) {
  const error = new Error("Serviço de e-mail indisponível");
  error.statusCode = 503;
  error.reason = reason;
  Object.assign(error, details);
  return error;
}

export function getEmailConfigSummary() {
  const config = getSmtpConfig();

  return {
    configured: hasSmtpConfig(),
    missing: getMissingSmtpConfig(),
    host: config.host || null,
    port: config.port || null,
    secure: config.secure,
    user: config.user ? config.user.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null,
    from: config.from || null
  };
}

function canUseDevEmailFallback() {
  return process.env.NODE_ENV === "test" ||
    (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEV_EMAIL_FALLBACK === "true"
    );
}

function createDevEmailDelivery({ email, code, subject }) {
  console.warn(`[DEV EMAIL] ${subject} para ${email}: ${code}`);

  return {
    sent: false,
    delivery: "development",
    devCode: code
  };
}

export async function sendVerificationCode(email, code) {
  return sendCodeEmail({
    email,
    code,
    subject: "Seu código de verificação - Career AI",
    heading: "Código de verificação",
    intro: "Use o código abaixo para acessar o Career AI:"
  });
}

export async function sendPasswordResetCode(email, code) {
  return sendCodeEmail({
    email,
    code,
    subject: "Recuperação de senha - Career AI",
    heading: "Recuperação de senha",
    intro: "Use o código abaixo para redefinir sua senha:"
  });
}

async function sendCodeEmail({ email, code, subject, heading, intro }) {
  if (!hasSmtpConfig()) {
    if (canUseDevEmailFallback()) {
      console.warn("SMTP não configurado. Usando código local de desenvolvimento.");
      return createDevEmailDelivery({ email, code, subject });
    }

    throw createEmailUnavailableError("SMTP_CONFIG_MISSING", {
      missing: getMissingSmtpConfig()
    });
  }

  const config = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject,
      text: `Seu código de verificação é: ${code}. Ele expira em 10 minutos.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>${heading}</h2>
          <p>${intro}</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
          <p>Ele expira em 10 minutos.</p>
        </div>
      `
    });
  } catch (error) {
    if (canUseDevEmailFallback()) {
      console.warn("Falha no SMTP. Usando código local de desenvolvimento.", error.message);
      return createDevEmailDelivery({ email, code, subject });
    }

    throw createEmailUnavailableError("SMTP_SEND_FAILED", {
      cause: error,
      smtpMessage: error.message
    });
  }

  return {
    sent: true
  };
}
