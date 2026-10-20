import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

function normalizeProvider(value = "") {
  const normalized = String(value || "").trim().toLowerCase();

  if (["postgres", "postgresql", "pg"].includes(normalized)) {
    return "postgres";
  }

  if (["sqlite", "sqlite3"].includes(normalized)) {
    return "sqlite";
  }

  return "";
}

export function getConfiguredDatabaseProvider() {
  const explicit = normalizeProvider(process.env.DATABASE_PROVIDER || process.env.DB_PROVIDER);

  if (explicit) {
    return explicit;
  }

  if (String(process.env.DATABASE_URL || "").startsWith("postgres")) {
    return "postgres";
  }

  return "sqlite";
}

export function getRuntimeDatabaseProvider() {
  return "sqlite";
}

export function getSqliteDatabasePath() {
  return process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.join(backendRoot, "data", "career-ai.sqlite");
}

export function getDatabaseRuntimeInfo() {
  const configured = getConfiguredDatabaseProvider();
  const runtime = getRuntimeDatabaseProvider();

  return {
    configured,
    runtime,
    using_configured_provider: configured === runtime,
    postgres_configured: configured === "postgres",
    sqlite_path: runtime === "sqlite" ? getSqliteDatabasePath() : null
  };
}

async function checkPostgresHealth({ includeMigrations = false } = {}) {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      error: "DATABASE_URL não configurado."
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  try {
    const ping = await client.query("SELECT NOW() AS now");
    const result = {
      ok: true,
      server_time: ping.rows[0]?.now || null
    };

    if (includeMigrations) {
      const migrations = await client.query(`
        SELECT id, applied_at
        FROM schema_migrations
        ORDER BY applied_at DESC, id DESC
      `).catch((error) => ({
        rows: [],
        migration_error: error.message
      }));

      result.migrations = migrations.rows || [];
      result.migration_error = migrations.migration_error || "";
    }

    return result;
  } finally {
    await client.end();
  }
}

function checkSqliteHealth() {
  const sqlitePath = getSqliteDatabasePath();

  return {
    ok: fs.existsSync(sqlitePath),
    path: sqlitePath
  };
}

export async function checkDatabaseHealth({ deep = false } = {}) {
  const info = getDatabaseRuntimeInfo();
  const health = {
    ...info,
    ok: true,
    warning: ""
  };

  if (info.configured !== info.runtime) {
    health.warning = "DATABASE_URL aponta para Postgres, mas o runtime atual ainda usa SQLite.";
  }

  if (!deep) {
    return health;
  }

  if (info.configured === "postgres") {
    try {
      health.postgres = await checkPostgresHealth({ includeMigrations: true });
    } catch (error) {
      health.postgres = {
        ok: false,
        error: error.message
      };
      health.ok = false;
    }
  }

  health.sqlite = checkSqliteHealth();

  if (info.runtime === "sqlite" && !health.sqlite.ok) {
    health.ok = false;
  }

  return health;
}
