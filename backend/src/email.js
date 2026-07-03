import nodemailer from "nodemailer";

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function createEmailUnavailableError() {
  const error = new Error("Serviço de e-mail indisponível");
  error.statusCode = 503;
  return error;
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

    throw createEmailUnavailableError();
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
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

    error.statusCode = 503;
    throw error;
  }

  return {
    sent: true
  };
}
