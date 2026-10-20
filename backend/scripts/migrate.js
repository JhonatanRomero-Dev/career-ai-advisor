import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const backendRoot = path.resolve(__dirname, "..");
const migrationsRoot = path.join(backendRoot, "migrations");

function getProvider() {
  if (process.env.DATABASE_URL?.startsWith("postgres")) {
    return "postgres";
  }

  return "sqlite";
}

function listMigrationFiles(provider) {
  const migrationDir = path.join(migrationsRoot, provider);

  if (!fs.existsSync(migrationDir)) {
    return [];
  }

  return fs.readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(migrationDir, file));
}

async function migrateSqlite(files) {
  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.join(backendRoot, "data", "career-ai.sqlite");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    for (const file of files) {
      const id = path.basename(file);
      const existing = db.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(id);

      if (existing) {
        console.log(`skip ${id}`);
        continue;
      }

      db.exec(fs.readFileSync(file, "utf8"));
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run(id, new Date().toISOString());
      console.log(`applied ${id}`);
    }
  } finally {
    db.close();
  }
}

async function migratePostgres(files) {
  const { Client } = await import("pg");

  if (!process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL para rodar migrations Postgres.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const id = path.basename(file);
      const existing = await client.query("SELECT id FROM schema_migrations WHERE id = $1", [id]);

      if (existing.rowCount) {
        console.log(`skip ${id}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(fs.readFileSync(file, "utf8"));
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
        await client.query("COMMIT");
        console.log(`applied ${id}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

const provider = getProvider();
const files = listMigrationFiles(provider);

if (files.length === 0) {
  console.log(`no ${provider} migrations found`);
} else if (provider === "postgres") {
  await migratePostgres(files);
} else {
  await migrateSqlite(files);
}
