import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { getEmailConfigSummary, sendVerificationCode } = await import("../src/email.js");

const to = process.argv[2] || process.env.SMTP_TEST_TO || process.env.SMTP_USER;
const summary = getEmailConfigSummary();

console.log("SMTP config:", JSON.stringify(summary, null, 2));

if (!to) {
  console.error("Informe um e-mail de destino: npm run test:email -- seu-email@exemplo.com");
  process.exit(1);
}

try {
  await sendVerificationCode(to, "123456");
  console.log(`Email de teste enviado para ${to}.`);
} catch (error) {
  console.error("Falha ao enviar email de teste.");

  if (error.reason === "SMTP_CONFIG_MISSING") {
    console.error(`Variaveis faltando: ${(error.missing || []).join(", ")}`);
  } else if (error.reason === "SMTP_SEND_FAILED") {
    console.error(error.smtpMessage || error.message);
  } else {
    console.error(error.message);
  }

  process.exit(1);
}
