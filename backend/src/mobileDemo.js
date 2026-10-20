export function isMobileDemoLoginEnabled() {
  const databasePath = String(process.env.SQLITE_DB_PATH || "")
    .replaceAll("\\", "/")
    .toLowerCase();

  return process.env.NODE_ENV === "development" &&
    process.env.DEMO_EMAIL_LOGIN === "true" &&
    !String(process.env.DATABASE_URL || "").trim() &&
    /\/\.codex-logs\/mobile-demo\.sqlite$/.test(databasePath);
}
