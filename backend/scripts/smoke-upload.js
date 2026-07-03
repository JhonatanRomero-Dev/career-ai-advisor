process.env.AI_PROVIDER = "local";
process.env.OPENAI_API_KEY = "";
process.env.GROQ_API_KEY = "";

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { DatabaseSync } = await import("node:sqlite");
const {
  createAuthSession,
  createPasswordUser
} = await import("../src/db.js");
const { default: app } = await import("../server.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/career-ai.sqlite");
const liveUploadUrl = process.env.SMOKE_UPLOAD_URL || "";

function createDocxBuffer(text) {
  const safeText = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${safeText}</w:t></w:r></w:p></w:body></w:document>`;
  const name = Buffer.from("word/document.xml");
  const data = Buffer.from(xml);
  const local = Buffer.alloc(30 + name.length);

  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  const centralOffset = local.length + data.length;
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, data, central, eocd]);
}

function listen(appToListen) {
  const server = appToListen.listen(0, "127.0.0.1");

  return new Promise((resolve) => {
    server.once("listening", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function cleanupAnalysis(analysis) {
  if (!analysis?.id) {
    return;
  }

  const db = new DatabaseSync(dbPath);
  const row = db.prepare("SELECT file_path FROM resume_analyses WHERE id = ?").get(analysis.id);
  db.prepare("DELETE FROM job_notifications WHERE analysis_id = ?").run(analysis.id);
  db.prepare("DELETE FROM resume_analyses WHERE id = ?").run(analysis.id);
  db.close();

  const uploadedFilePath = analysis.file_path || row?.file_path;

  if (uploadedFilePath) {
    await fs.rm(uploadedFilePath, { force: true });
  }
}

function cleanupSmokeUser(email) {
  if (!email) {
    return;
  }

  const db = new DatabaseSync(dbPath);
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

  if (user?.id) {
    db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }

  db.close();
}

const server = liveUploadUrl ? null : await listen(app);
const smokeEmail = `smoke-upload-${Date.now()}@example.com`;
const { user } = createPasswordUser({
  email: smokeEmail,
  name: "Smoke Upload",
  password: "smoke-password-123"
});
const session = createAuthSession(user.id);
let responseData = null;

try {
  const uploadUrl = liveUploadUrl || `http://127.0.0.1:${server.address().port}/api/analysis`;
  const docx = createDocxBuffer(
    "João Silva desenvolvedor backend com Node Express SQL MongoDB API Docker AWS inglês intermediário telefone 11999990000 email joao.teste@example.com projetos com métricas e resultados."
  );
  const form = new FormData();

  form.append(
    "resume",
    new Blob([docx], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }),
    "teste-upload.docx"
  );
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.token}`
    },
    body: form
  });
  const data = await response.json();
  responseData = data;

  console.log(JSON.stringify({
    status: response.status,
    success: data.success,
    id: data.analysis?.id || null,
    ats: data.analysis?.ats_score || null,
    area: data.analysis?.main_area || null,
    error: data.error || null
  }));

  if (!response.ok || !data.success) {
    process.exitCode = 1;
  }
} finally {
  await cleanupAnalysis(responseData?.analysis);
  cleanupSmokeUser(smokeEmail);

  if (server) {
    await close(server);
  }
}
