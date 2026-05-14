import nodemailer from "nodemailer";

const hasSmtpConfig =
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

export async function sendVerificationCode(email, code) {
  if (!hasSmtpConfig) {
    console.log(`Codigo de verificacao para ${email}: ${code}`);
    return {
      sent: false,
      devCode: code
    };
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

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Seu codigo de verificacao - Career AI",
    text: `Seu codigo de verificacao e: ${code}. Ele expira em 10 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Codigo de verificacao</h2>
        <p>Use o codigo abaixo para acessar o Career AI:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>Ele expira em 10 minutos.</p>
      </div>
    `
  });

  return {
    sent: true,
    devCode: null
  };
}
