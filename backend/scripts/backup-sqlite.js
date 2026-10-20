import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(process.env.SQLITE_DB_PATH || path.join(backendRoot, "data", "career-ai.sqlite"));
const destinationRoot = path.resolve(process.env.BACKUP_DIRECTORY || path.join(backendRoot, "backups"));

if (!fs.existsSync(source)) throw new Error(`Banco SQLite nao encontrado: ${source}`);
fs.mkdirSync(destinationRoot, { recursive: true });

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = path.join(destinationRoot, `career-ai-${stamp}.sqlite`);
const sourceDb = new DatabaseSync(source, { readOnly: true });

try {
  const integrity = sourceDb.prepare("PRAGMA integrity_check").all();
  if (integrity.some((row) => row.integrity_check !== "ok")) {
    throw new Error(`Integridade do banco falhou: ${JSON.stringify(integrity)}`);
  }
  sourceDb.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
} finally {
  sourceDb.close();
}

const backupDb = new DatabaseSync(destination, { readOnly: true });
try {
  const result = backupDb.prepare("PRAGMA integrity_check").get();
  if (result?.integrity_check !== "ok") throw new Error("Backup criado, mas falhou na verificacao de integridade.");
} finally {
  backupDb.close();
}

console.log(JSON.stringify({ success: true, source, backup: destination, bytes: fs.statSync(destination).size }, null, 2));
