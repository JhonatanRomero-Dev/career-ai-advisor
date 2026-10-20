import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const configuredDbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(dataDir, "career-ai.sqlite");

fs.mkdirSync(path.dirname(configuredDbPath), { recursive: true });

const db = new DatabaseSync(configuredDbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS resume_versions (
    id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, account_email TEXT NOT NULL,
    name TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_resume_versions_account ON resume_versions(account_email, analysis_id);
  CREATE TABLE IF NOT EXISTS professional_profiles (
    user_id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, filters TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
  CREATE TABLE IF NOT EXISTS search_history (
    user_id TEXT NOT NULL, term TEXT NOT NULL, searched_at TEXT NOT NULL, PRIMARY KEY(user_id, term)
  );
  CREATE TABLE IF NOT EXISTS product_feedback (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_product_feedback_user ON product_feedback(user_id);
  CREATE TABLE IF NOT EXISTS support_interactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fallback INTEGER NOT NULL, duration_ms INTEGER NOT NULL,
    helpful INTEGER, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_support_interactions_user ON support_interactions(user_id);
`);

export function getProfessionalProfile(userId) {
  const row = db.prepare("SELECT * FROM professional_profiles WHERE user_id = ?").get(userId);
  return row ? { ...JSON.parse(row.data), publicId: row.public_id } : {};
}

export function saveProfessionalProfile(userId, data) {
  db.prepare(`INSERT INTO professional_profiles (user_id, public_id, data) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`).run(userId, crypto.randomUUID(), JSON.stringify(data));
}

export function getPublicProfile(publicId) {
  const row = db.prepare("SELECT * FROM professional_profiles WHERE public_id = ?").get(publicId);
  if (!row || JSON.parse(row.data).publicEnabled !== true) return null;
  const user = getUserById(row.user_id);
  if (!user) return null;
  const profile = getUserProfile(row.user_id, user);
  // Explicit allowlist: contact and account data never reach the public endpoint.
  return Object.fromEntries(["name", "photo", "headline", "location", "summary", "linkedin", "portfolio", "github", "skills", "experiences", "projects", "certificates", "achievements"].map((key) => [key, profile[key]]));
}

export function listSavedSearches(userId) {
  return db.prepare("SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId)
    .map(({ user_id: _userId, filters, ...row }) => ({ ...row, filters: JSON.parse(filters) }));
}

export function saveSearch(userId, { name, filters }) {
  if (listSavedSearches(userId).length >= 30) return null;
  const row = { id: crypto.randomUUID(), name, filters, created_at: new Date().toISOString() };
  db.prepare("INSERT INTO saved_searches VALUES (?, ?, ?, ?, ?)").run(row.id, userId, name, JSON.stringify(filters), row.created_at);
  return row;
}

export function removeSearch(userId, id) {
  return Number(db.prepare("DELETE FROM saved_searches WHERE user_id = ? AND id = ?").run(userId, id).changes);
}

export function listSearchHistory(userId) {
  return db.prepare("SELECT term, searched_at FROM search_history WHERE user_id = ? ORDER BY searched_at DESC, term LIMIT 10").all(userId);
}

export function rememberSearch(userId, term) {
  db.prepare(`INSERT INTO search_history VALUES (?, ?, ?) ON CONFLICT(user_id, term)
    DO UPDATE SET searched_at = excluded.searched_at`).run(userId, term, new Date().toISOString());
  db.prepare(`DELETE FROM search_history WHERE user_id = ? AND term NOT IN
    (SELECT term FROM search_history WHERE user_id = ? ORDER BY searched_at DESC, term LIMIT 10)`).run(userId, userId);
  return listSearchHistory(userId);
}

export function clearSearchHistory(userId) {
  db.prepare("DELETE FROM search_history WHERE user_id = ?").run(userId);
}

export function createFeedback(userId, data) {
  const row = { id: crypto.randomUUID(), ...data, status: "new", created_at: new Date().toISOString() };
  db.prepare("INSERT INTO product_feedback VALUES (?, ?, ?, ?, ?)").run(row.id, userId, JSON.stringify(data), row.status, row.created_at);
  return row;
}

export function listFeedback(userId) {
  const rows = userId
    ? db.prepare("SELECT * FROM product_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").all(userId)
    : db.prepare("SELECT * FROM product_feedback ORDER BY created_at DESC LIMIT 200").all();
  return rows.map(({ data, ...row }) => ({ ...row, ...JSON.parse(data) }));
}

export function updateFeedbackStatus(id, status) {
  return Number(db.prepare("UPDATE product_feedback SET status = ? WHERE id = ?").run(status, id).changes);
}

export function recordSupportInteraction(userId, fallback, durationMs) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO support_interactions (id, user_id, fallback, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, fallback ? 1 : 0, durationMs, new Date().toISOString());
  return id;
}

export function rateSupportInteraction(userId, id, helpful) {
  return Number(db.prepare("UPDATE support_interactions SET helpful = ? WHERE id = ? AND user_id = ?").run(helpful ? 1 : 0, id, userId).changes);
}

export function supportMetrics() {
  return db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(fallback), 0) AS fallbacks,
    COALESCE(ROUND(AVG(duration_ms)), 0) AS average_ms, COUNT(helpful) AS rated,
    COALESCE(SUM(helpful), 0) AS helpful FROM support_interactions`).get();
}

export function closeDatabase() {
  db.close();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS resume_analyses (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT,
    resume_text TEXT,
    account_email TEXT,
    email TEXT,
    phone TEXT,
    area TEXT,
    target_job_title TEXT,
    target_job_description TEXT,
    job_match_score INTEGER NOT NULL DEFAULT 0,
    matched_keywords TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    main_area TEXT,
    seniority TEXT,
    english_level TEXT,
    ats_score INTEGER NOT NULL DEFAULT 0,
    clarity_score INTEGER NOT NULL DEFAULT 0,
    market_compatibility INTEGER NOT NULL DEFAULT 0,
    detected_skills TEXT NOT NULL DEFAULT '[]',
    missing_keywords TEXT NOT NULL DEFAULT '[]',
    weak_words TEXT NOT NULL DEFAULT '[]',
    strengths TEXT NOT NULL DEFAULT '[]',
    suggestions TEXT NOT NULL DEFAULT '[]',
    recommended_jobs TEXT NOT NULL DEFAULT '[]',
    job_search_status TEXT NOT NULL DEFAULT 'pending',
    job_search_checked_at TEXT,
    job_search_provider TEXT,
    job_search_error TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analysis_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_mimetype TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    request_body TEXT NOT NULL DEFAULT '{}',
    analysis_id TEXT,
    notification_id TEXT,
    analysis_result TEXT,
    notification_result TEXT,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    failed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_analysis_jobs_account_email
    ON analysis_jobs(account_email);

  CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_updated_at
    ON analysis_jobs(status, updated_at);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    email_verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    phone TEXT,
    location TEXT,
    headline TEXT,
    target_role TEXT,
    experience_level TEXT,
    linkedin TEXT,
    portfolio TEXT,
    summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'Gratis',
    status TEXT NOT NULL DEFAULT 'active',
    source TEXT NOT NULL DEFAULT 'demo',
    current_period_start_at TEXT,
    current_period_end_at TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    canceled_at TEXT,
    provider_subscription_id TEXT,
    next_payment_at TEXT,
    last_payment_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscription_checkouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_checkout_id TEXT,
    provider_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    checkout_url TEXT,
    raw_response TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_user_id
    ON subscription_checkouts(user_id);

  CREATE INDEX IF NOT EXISTS idx_subscription_checkouts_provider_payment_id
    ON subscription_checkouts(provider_payment_id);

  CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_event_id TEXT,
    event_type TEXT,
    action TEXT,
    resource_type TEXT,
    resource_id TEXT,
    request_id TEXT,
    checkout_id TEXT,
    provider_payment_id TEXT,
    payment_status TEXT,
    processing_status TEXT NOT NULL DEFAULT 'received',
    raw_payload TEXT NOT NULL DEFAULT '{}',
    error_message TEXT,
    received_at TEXT NOT NULL,
    processed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_event
    ON payment_webhook_events(provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_resource
    ON payment_webhook_events(provider, resource_id);

  CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_checkout_id
    ON payment_webhook_events(checkout_id);

  CREATE TABLE IF NOT EXISTS ai_events (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    status TEXT NOT NULL,
    account_email TEXT,
    message TEXT,
    context TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ai_events_status_created_at
    ON ai_events(status, created_at);

  CREATE INDEX IF NOT EXISTS idx_ai_events_account_email
    ON ai_events(account_email);

  CREATE TABLE IF NOT EXISTS product_events (
    id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL,
    user_hash TEXT,
    event_name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_product_events_name_occurred_at
    ON product_events(event_name, occurred_at);

  CREATE INDEX IF NOT EXISTS idx_product_events_user_hash
    ON product_events(user_hash);

  CREATE TABLE IF NOT EXISTS email_verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_exchange_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analysis_tasks (
    analysis_id TEXT PRIMARY KEY,
    account_email TEXT NOT NULL,
    checked TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS job_notifications (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    account_email TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    job_count INTEGER NOT NULL DEFAULT 0,
    top_match INTEGER NOT NULL DEFAULT 0,
    jobs TEXT NOT NULL DEFAULT '[]',
    read_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tracked_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_email TEXT NOT NULL,
    analysis_id TEXT,
    external_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved',
    job_snapshot TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    applied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, external_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tracked_jobs_user_id_updated_at
    ON tracked_jobs(user_id, updated_at DESC);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasPasswordHashColumn = userColumns.some((column) => column.name === "password_hash");

if (!hasPasswordHashColumn) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
}

const analysisColumns = db.prepare("PRAGMA table_info(resume_analyses)").all();
if (!db.prepare("PRAGMA table_info(analysis_jobs)").all().some((column) => column.name === "stage")) {
  db.exec("ALTER TABLE analysis_jobs ADD COLUMN stage TEXT NOT NULL DEFAULT 'queued'");
}
const hasAccountEmailColumn = analysisColumns.some((column) => column.name === "account_email");

if (!hasAccountEmailColumn) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN account_email TEXT");
}

const analysisColumnNames = new Set(analysisColumns.map((column) => column.name));
if (!analysisColumnNames.has("analysis_method")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN analysis_method TEXT NOT NULL DEFAULT 'unknown'");
}
const trackedColumns = new Set(db.prepare("PRAGMA table_info(tracked_jobs)").all().map((column) => column.name));
for (const [name, type] of Object.entries({ resume_version_id: "TEXT", submitted_resume_version_id: "TEXT", interview_at: "TEXT", reminder_at: "TEXT", next_action: "TEXT NOT NULL DEFAULT ''" })) {
  if (!trackedColumns.has(name)) db.exec(`ALTER TABLE tracked_jobs ADD COLUMN ${name} ${type}`);
}

if (!analysisColumnNames.has("target_job_title")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN target_job_title TEXT");
}

if (!analysisColumnNames.has("resume_text")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN resume_text TEXT");
}

if (!analysisColumnNames.has("target_job_description")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN target_job_description TEXT");
}

if (!analysisColumnNames.has("job_match_score")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN job_match_score INTEGER NOT NULL DEFAULT 0");
}

if (!analysisColumnNames.has("matched_keywords")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN matched_keywords TEXT NOT NULL DEFAULT '[]'");
}

if (!analysisColumnNames.has("job_search_status")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN job_search_status TEXT NOT NULL DEFAULT 'pending'");
}
if (!analysisColumnNames.has("job_search_checked_at")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN job_search_checked_at TEXT");
}
if (!analysisColumnNames.has("job_search_provider")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN job_search_provider TEXT");
}
if (!analysisColumnNames.has("job_search_error")) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN job_search_error TEXT");
}

const notificationColumns = db.prepare("PRAGMA table_info(job_notifications)").all();
const hasNotificationAccountEmailColumn = notificationColumns.some((column) => column.name === "account_email");

if (!hasNotificationAccountEmailColumn) {
  db.exec("ALTER TABLE job_notifications ADD COLUMN account_email TEXT");
}

const subscriptionColumns = db.prepare("PRAGMA table_info(user_subscriptions)").all();
const subscriptionColumnNames = new Set(subscriptionColumns.map((column) => column.name));

if (!subscriptionColumnNames.has("current_period_start_at")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN current_period_start_at TEXT");
}

if (!subscriptionColumnNames.has("current_period_end_at")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN current_period_end_at TEXT");
}

if (!subscriptionColumnNames.has("cancel_at_period_end")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0");
}

if (!subscriptionColumnNames.has("canceled_at")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN canceled_at TEXT");
}

if (!subscriptionColumnNames.has("provider_subscription_id")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN provider_subscription_id TEXT");
}

if (!subscriptionColumnNames.has("next_payment_at")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN next_payment_at TEXT");
}

if (!subscriptionColumnNames.has("last_payment_at")) {
  db.exec("ALTER TABLE user_subscriptions ADD COLUMN last_payment_at TEXT");
}

db.exec(`
  UPDATE job_notifications
  SET account_email = (
    SELECT resume_analyses.account_email
    FROM resume_analyses
    WHERE resume_analyses.id = job_notifications.analysis_id
  )
  WHERE account_email IS NULL
`);

db.exec(`
  DELETE FROM user_subscriptions
  WHERE user_id NOT IN (
    SELECT id FROM users
  )
`);

db.exec(`
  UPDATE resume_analyses
  SET file_path = NULL
  WHERE file_path IS NOT NULL
`);

const createId = () =>
  `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createEntityId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const stringify = (value) => JSON.stringify(value || []);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FREE_MONTHLY_ANALYSIS_LIMIT = 3;
const JOB_NOTIFICATION_LIMIT = 8;
const OAUTH_EXCHANGE_CODE_TTL_MS = 2 * 60 * 1000;
const RESUME_TEXT_ENCRYPTED_PREFIX = "enc:v1:";
const RESUME_TEXT_STORAGE_MODES = new Set(["off", "plain", "encrypted"]);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPasswordHash(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const comparisonHash = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");

  return storedBuffer.length === comparisonHash.length &&
    crypto.timingSafeEqual(storedBuffer, comparisonHash);
}

function getCodeSecret() {
  const secret = process.env.AUTH_CODE_SECRET || process.env.SMTP_PASS;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure AUTH_CODE_SECRET em produção.");
  }

  return "career-ai-local-code-secret";
}

function hashOneTimeCode(email, code) {
  return crypto
    .createHmac("sha256", getCodeSecret())
    .update(`${email}:${String(code).trim()}`)
    .digest("hex");
}

function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function hashOAuthExchangeCode(code) {
  return crypto
    .createHash("sha256")
    .update(String(code || ""))
    .digest("hex");
}

function normalizeResumeTextStorageMode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();

  if (["", "auto"].includes(normalized)) {
    return "";
  }

  if (["none", "false", "disabled"].includes(normalized)) {
    return "off";
  }

  return RESUME_TEXT_STORAGE_MODES.has(normalized) ? normalized : "";
}

function getResumeTextSecret() {
  return String(
    process.env.RESUME_TEXT_ENCRYPTION_KEY ||
      process.env.AUTH_CODE_SECRET ||
      ""
  );
}

function getResumeTextStorageMode() {
  const configuredMode = normalizeResumeTextStorageMode(process.env.RESUME_TEXT_STORAGE);

  if (configuredMode) {
    return configuredMode;
  }

  if (getResumeTextSecret()) {
    return "encrypted";
  }

  return process.env.NODE_ENV === "production" ? "off" : "plain";
}

function getResumeTextEncryptionKey() {
  const secret = getResumeTextSecret();

  if (!secret) {
    throw new Error("Configure RESUME_TEXT_ENCRYPTION_KEY para armazenar texto de curriculo criptografado.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptResumeText(value = "") {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getResumeTextEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${RESUME_TEXT_ENCRYPTED_PREFIX}${[
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".")}`;
}

function decryptResumeText(value = "") {
  const payload = String(value || "").slice(RESUME_TEXT_ENCRYPTED_PREFIX.length);
  const [ivValue, authTagValue, encryptedValue] = payload.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    return "";
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getResumeTextEncryptionKey(),
      Buffer.from(ivValue, "base64url")
    );

    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    console.warn("Nao foi possivel descriptografar o texto do curriculo:", error.message);
    return "";
  }
}

function prepareResumeTextForStorage(value = "") {
  const text = String(value || "");

  if (!text) {
    return null;
  }

  const storageMode = getResumeTextStorageMode();

  if (storageMode === "off") {
    return null;
  }

  if (storageMode === "encrypted") {
    return encryptResumeText(text);
  }

  return text;
}

function readStoredResumeText(value = "") {
  const text = String(value || "");

  if (!text) {
    return "";
  }

  if (text.startsWith(RESUME_TEXT_ENCRYPTED_PREFIX)) {
    return decryptResumeText(text);
  }

  return text;
}

function getResumeTextRetentionDays() {
  const value = String(process.env.RESUME_TEXT_RETENTION_DAYS || "").trim();

  if (!value) {
    return null;
  }

  const days = Number.parseInt(value, 10);

  return Number.isFinite(days) && days >= 0 ? days : null;
}

export function getResumeTextStoragePolicy() {
  const mode = getResumeTextStorageMode();

  return {
    mode,
    encrypted: mode === "encrypted",
    retention_days: getResumeTextRetentionDays()
  };
}

export function purgeExpiredResumeTexts(referenceDate = new Date()) {
  const retentionDays = getResumeTextRetentionDays();

  if (retentionDays === null) {
    return 0;
  }

  const nowDate = new Date(referenceDate);
  const now = nowDate.toISOString();
  const cutoff = new Date(
    nowDate.getTime() - retentionDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const result = db.prepare(`
    UPDATE resume_analyses
    SET resume_text = NULL,
        updated_at = ?
    WHERE resume_text IS NOT NULL
      AND created_at < ?
  `).run(now, cutoff);

  return Number(result?.changes || 0);
}

purgeExpiredResumeTexts();

const parseJson = (value, fallback = []) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const parseJsonObject = (value) => {
  const parsed = parseJson(value, {});

  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const normalizeJobMatch = (job) => {
  const rawMatch = job?.match_percentage ?? job?.match ?? job?.compatibility ?? 0;
  const match = Number.parseFloat(String(rawMatch).replace("%", ""));

  return Number.isFinite(match) ? Math.round(match) : 0;
};

const toApiNotification = (row) => ({
  id: row.id,
  analysis_id: row.analysis_id,
  title: row.title,
  message: row.message,
  job_count: row.job_count,
  top_match: row.top_match,
  jobs: parseJson(row.jobs),
  read_at: row.read_at,
  created_date: row.created_at,
  updated_date: row.updated_at
});

const toApiTrackedJob = (row) => ({
  id: row.id,
  analysis_id: row.analysis_id || null,
  external_id: row.external_id,
  status: row.status,
  job: parseJsonObject(row.job_snapshot),
  notes: row.notes || "",
  resume_version: row.resume_version_id ? db.prepare("SELECT id, name, analysis_id FROM resume_versions WHERE id = ? AND account_email = ?").get(row.resume_version_id, row.account_email) || null : null,
  submitted_resume_version: row.submitted_resume_version_id ? db.prepare("SELECT id, name, analysis_id FROM resume_versions WHERE id = ? AND account_email = ?").get(row.submitted_resume_version_id, row.account_email) || null : null,
  interview_at: row.interview_at || null,
  reminder_at: row.reminder_at || null,
  next_action: row.next_action || "",
  applied_at: row.applied_at || null,
  created_date: row.created_at,
  updated_date: row.updated_at
});

export function listTrackedJobsForUser(userId) {
  if (!userId) return [];
  return db.prepare(`
    SELECT * FROM tracked_jobs
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId).map(toApiTrackedJob);
}

export function upsertTrackedJobForUser(userId, accountEmail, input = {}) {
  const externalId = String(input.external_id || input.job?.external_id || input.job?.id || input.job?.url || "").trim();
  if (!userId || !externalId) return null;
  const now = new Date().toISOString();
  const current = db.prepare("SELECT * FROM tracked_jobs WHERE user_id = ? AND external_id = ?").get(userId, externalId);
  if (!current && (!input.job || typeof input.job !== "object")) return null;
  const status = String(input.status || current?.status || "saved");
  const snapshot = input.job && typeof input.job === "object" ? input.job : parseJsonObject(current?.job_snapshot);
  const notes = input.notes === undefined ? String(current?.notes || "") : String(input.notes || "").slice(0, 2000);
  const appliedAt = input.applied_at !== undefined ? input.applied_at : status === "applied" && !current?.applied_at ? now : current?.applied_at || null;
  let versionId = input.resume_version_id === undefined ? current?.resume_version_id || null : input.resume_version_id;
  const version = versionId ? db.prepare("SELECT analysis_id FROM resume_versions WHERE id = ? AND account_email = ?").get(versionId, accountEmail) : null;
  if (input.resume_version_id && !version) throw Object.assign(new Error("Versão indisponível para esta conta."), { statusCode: 422 });
  if (!version) versionId = null;
  let analysisId = version?.analysis_id || input.analysis_id || current?.analysis_id || null;
  if (analysisId && !db.prepare("SELECT id FROM resume_analyses WHERE id = ? AND account_email = ?").get(analysisId, accountEmail)) {
    if (input.analysis_id) throw Object.assign(new Error("Currículo indisponível para esta conta."), { statusCode: 422 });
    analysisId = null;
  }

  if (current) {
    db.prepare(`
      UPDATE tracked_jobs
      SET analysis_id = ?, status = ?, job_snapshot = ?, notes = ?, applied_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(analysisId, status, JSON.stringify(snapshot), notes, appliedAt, now, current.id, userId);
  } else {
    db.prepare(`
      INSERT INTO tracked_jobs (
        id, user_id, account_email, analysis_id, external_id, status,
        job_snapshot, notes, applied_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(createEntityId("tracked_job"), userId, String(accountEmail || "").toLowerCase(), analysisId,
      externalId, status, JSON.stringify(snapshot), notes, appliedAt, now, now);
  }

  db.prepare("UPDATE tracked_jobs SET resume_version_id = ?, interview_at = ?, reminder_at = ?, next_action = ? WHERE user_id = ? AND external_id = ?")
    .run(versionId, input.interview_at === undefined ? current?.interview_at || null : input.interview_at,
      input.reminder_at === undefined ? current?.reminder_at || null : input.reminder_at,
      input.next_action === undefined ? current?.next_action || "" : input.next_action, userId, externalId);
  if (status === "applied" && (current?.status !== "applied" || (input.resume_version_id !== undefined && input.resume_version_id !== current?.resume_version_id))) {
    db.prepare("UPDATE tracked_jobs SET submitted_resume_version_id = ? WHERE user_id = ? AND external_id = ?").run(versionId, userId, externalId);
  }

  return toApiTrackedJob(db.prepare("SELECT * FROM tracked_jobs WHERE user_id = ? AND external_id = ?").get(userId, externalId));
}

export function deleteTrackedJobForUser(externalId, userId) {
  if (!externalId || !userId) return false;
  return Number(db.prepare("DELETE FROM tracked_jobs WHERE external_id = ? AND user_id = ?").run(externalId, userId)?.changes || 0) > 0;
}

const toApiAnalysis = (row) => ({
  id: row.id,
  file_name: row.file_name,
  file_url: row.file_url,
  account_email: row.account_email,
  created_date: row.created_at,
  updated_date: row.updated_at,
  status: row.status,
  parsed_data: {
    email: row.email,
    phone: row.phone,
    area: row.area
  },
  analysis_method: row.analysis_method || "unknown",
  target_job_title: row.target_job_title,
  target_job_description: row.target_job_description,
  job_match_score: row.job_match_score,
  matched_keywords: parseJson(row.matched_keywords),
  summary: row.summary,
  main_area: row.main_area,
  seniority: row.seniority,
  english_level: row.english_level,
  ats_score: row.ats_score,
  clarity_score: row.clarity_score,
  market_compatibility: row.market_compatibility,
  detected_skills: parseJson(row.detected_skills),
  missing_keywords: parseJson(row.missing_keywords),
  weak_words: parseJson(row.weak_words),
  strengths: parseJson(row.strengths),
  suggestions: parseJson(row.suggestions),
  recommended_jobs: parseJson(row.recommended_jobs).filter((job) => {
    const verifiedAt = Date.parse(job?.verified_at || "");
    const fresh = Number.isFinite(verifiedAt) && Date.now() - verifiedAt <= 24 * 60 * 60 * 1000;
    return (job?.is_real === true || job?.is_search_link === true) && /^https:\/\//i.test(String(job?.url || "")) && fresh;
  }),
  job_search_status: row.job_search_status || "pending",
  job_search_checked_at: row.job_search_checked_at || null,
  job_search_provider: row.job_search_provider || "",
  job_search_error: row.job_search_error || ""
});

export function updateRecommendedJobsForAccount(id, accountEmail, searchResult = {}) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  if (!id || !normalizedEmail) return null;
  const existing = db.prepare("SELECT id FROM resume_analyses WHERE id = ? AND account_email = ?").get(id, normalizedEmail);
  if (!existing) return null;

  db.prepare(`
    UPDATE resume_analyses
    SET recommended_jobs = ?,
        job_search_status = ?,
        job_search_checked_at = ?,
        job_search_provider = ?,
        job_search_error = ?,
        updated_at = ?
    WHERE id = ? AND account_email = ?
  `).run(
    stringify(searchResult.jobs || []),
    String(searchResult.status || "no_results"),
    searchResult.checked_at || new Date().toISOString(),
    String(searchResult.provider || ""),
    String(searchResult.error || "").slice(0, 1000),
    new Date().toISOString(),
    id,
    normalizedEmail
  );

  return getResumeAnalysisById(id);
}

export function createResumeAnalysis(analysis) {
  const now = new Date().toISOString();
  const id = createId();

  db.prepare(`
    INSERT INTO resume_analyses (
      id,
      file_name,
      file_path,
      file_url,
      resume_text,
      account_email,
      email,
      phone,
      area,
      target_job_title,
      target_job_description,
      job_match_score,
      matched_keywords,
      summary,
      main_area,
      seniority,
      english_level,
      ats_score,
      clarity_score,
      market_compatibility,
      detected_skills,
      missing_keywords,
      weak_words,
      strengths,
      suggestions,
      recommended_jobs,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    analysis.fileName,
    analysis.filePath || null,
    analysis.fileUrl || null,
    prepareResumeTextForStorage(analysis.resumeText),
    analysis.accountEmail || null,
    analysis.email || null,
    analysis.phone || null,
    analysis.area || null,
    analysis.targetJobTitle || null,
    analysis.targetJobDescription || null,
    Number(analysis.jobMatchScore || 0),
    stringify(analysis.matchedKeywords),
    analysis.summary || "",
    analysis.mainArea || "",
    analysis.seniority || "",
    analysis.englishLevel || "",
    Number(analysis.atsScore || 0),
    Number(analysis.clarityScore || 0),
    Number(analysis.marketCompatibility || 0),
    stringify(analysis.detectedSkills),
    stringify(analysis.missingKeywords),
    stringify(analysis.weakWords),
    stringify(analysis.strengths),
    stringify(analysis.suggestions),
    stringify(analysis.recommendedJobs),
    analysis.status || "completed",
    now,
    now
  );

  db.prepare("UPDATE resume_analyses SET analysis_method = ? WHERE id = ?").run(analysis.analysisMethod || "unknown", id);
  return getResumeAnalysisById(id);
}

export function getResumeAnalysisSourceForAccount(id, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!id || !normalizedEmail) {
    return null;
  }

  const row = db
    .prepare("SELECT * FROM resume_analyses WHERE id = ?")
    .get(id);

  if (!row) {
    return null;
  }

  if (row.account_email !== normalizedEmail) {
    return false;
  }

  return {
    analysis: toApiAnalysis(row),
    resume_text: readStoredResumeText(row.resume_text)
  };
}

function getMonthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

export function getMonthlyAnalysisUsage(accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      used: 0,
      limit: FREE_MONTHLY_ANALYSIS_LIMIT,
      remaining: FREE_MONTHLY_ANALYSIS_LIMIT,
      month_start: getMonthStartIso()
    };
  }

  const monthStart = getMonthStartIso();
  const row = db.prepare(`
    SELECT COUNT(*) AS total
    FROM resume_analyses
    WHERE account_email = ?
      AND created_at >= ?
  `).get(normalizedEmail, monthStart);

  const used = Number(row?.total || 0);

  return {
    used,
    limit: FREE_MONTHLY_ANALYSIS_LIMIT,
    remaining: Math.max(FREE_MONTHLY_ANALYSIS_LIMIT - used, 0),
    month_start: monthStart
  };
}

export function listResumeAnalyses(limit = 50) {
  const rows = db
    .prepare("SELECT * FROM resume_analyses ORDER BY created_at DESC LIMIT ?")
    .all(limit);

  return rows.map(toApiAnalysis);
}

export function listResumeAnalysesByAccountEmail(accountEmail, limit = 50) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return [];
  }

  const rows = db
    .prepare(`
      SELECT *
      FROM resume_analyses
      WHERE account_email = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(normalizedEmail, limit);

  return rows.map(toApiAnalysis);
}

export function getResumeAnalysisById(id) {
  const row = db
    .prepare("SELECT * FROM resume_analyses WHERE id = ?")
    .get(id);

  return row ? toApiAnalysis(row) : null;
}

function toApiAnalysisJob(row) {
  const analysisResult = parseJsonObject(row.analysis_result);
  const notificationResult = parseJsonObject(row.notification_result);

  return {
    id: row.id,
    status: row.status,
    file_name: row.file_name,
    stage: row.status === "completed" || row.status === "failed" ? row.status : row.stage || row.status,
    account_email: row.account_email,
    analysis: Object.keys(analysisResult).length ? analysisResult : null,
    notification: Object.keys(notificationResult).length ? notificationResult : null,
    error: row.error_message || "",
    attempts: Number(row.attempts || 0),
    started_at: row.started_at,
    completed_at: row.completed_at,
    failed_at: row.failed_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function toAnalysisJobWorkerPayload(row) {
  const apiJob = toApiAnalysisJob(row);

  return {
    ...apiJob,
    user: {
      id: row.user_id,
      email: row.account_email
    },
    body: parseJsonObject(row.request_body),
    file: {
      fieldname: "resume",
      originalname: row.file_name,
      encoding: "7bit",
      mimetype: row.file_mimetype || "",
      destination: path.dirname(row.file_path),
      filename: path.basename(row.file_path),
      path: row.file_path,
      size: Number(row.file_size || 0)
    },
    analysis_id: row.analysis_id,
    notification_id: row.notification_id
  };
}

export function createAnalysisJobRecord({ file, body = {}, user = {} }) {
  const now = new Date().toISOString();
  const id = createEntityId("analysis_job");
  const accountEmail = String(user.email || "").trim().toLowerCase();

  db.prepare(`
    INSERT INTO analysis_jobs (
      id,
      user_id,
      account_email,
      file_name,
      file_path,
      file_mimetype,
      file_size,
      request_body,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    user.id,
    accountEmail,
    file.originalname || path.basename(file.path || "") || "Curriculo enviado",
    file.path,
    file.mimetype || "",
    Number(file.size || 0),
    JSON.stringify(body || {}),
    now,
    now
  );

  return getAnalysisJobById(id);
}

export function getAnalysisJobById(id) {
  const row = db
    .prepare("SELECT * FROM analysis_jobs WHERE id = ?")
    .get(id);

  return row ? toApiAnalysisJob(row) : null;
}

export function getAnalysisJobForAccount(id, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  const row = db
    .prepare("SELECT * FROM analysis_jobs WHERE id = ?")
    .get(id);

  if (!row) {
    return null;
  }

  if (row.account_email !== normalizedEmail) {
    return false;
  }

  return toApiAnalysisJob(row);
}

export function claimNextAnalysisJob({ staleAfterMs = 15 * 60 * 1000 } = {}) {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const staleBefore = new Date(nowDate.getTime() - staleAfterMs).toISOString();
  const row = db.prepare(`
    SELECT *
    FROM analysis_jobs
    WHERE status = 'queued'
       OR (status = 'processing' AND updated_at < ?)
    ORDER BY created_at ASC
    LIMIT 1
  `).get(staleBefore);

  if (!row) {
    return null;
  }

  const result = db.prepare(`
    UPDATE analysis_jobs
    SET status = 'processing', stage = 'extract',
        attempts = attempts + 1,
        started_at = COALESCE(started_at, ?),
        error_message = NULL,
        updated_at = ?
    WHERE id = ?
      AND (status = 'queued' OR (status = 'processing' AND updated_at < ?))
  `).run(now, now, row.id, staleBefore);

  if (!result.changes) {
    return null;
  }

  const claimed = db
    .prepare("SELECT * FROM analysis_jobs WHERE id = ?")
    .get(row.id);

  return claimed ? toAnalysisJobWorkerPayload(claimed) : null;
}

export function requeueInterruptedAnalysisJobs() {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE analysis_jobs
    SET status = 'queued', stage = 'queued',
        updated_at = ?
    WHERE status = 'processing'
  `).run(now);

  return Number(result?.changes || 0);
}

export function completeAnalysisJob(id, { analysis = null, notification = null } = {}) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'completed',
        analysis_id = ?,
        notification_id = ?,
        analysis_result = ?,
        notification_result = ?,
        error_message = NULL,
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    analysis?.id || null,
    notification?.id || null,
    analysis ? JSON.stringify(analysis) : null,
    notification ? JSON.stringify(notification) : null,
    now,
    now,
    id
  );

  return getAnalysisJobById(id);
}

export function failAnalysisJob(id, errorMessage = "") {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'failed',
        error_message = ?,
        failed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    String(errorMessage || "Erro ao analisar curriculo"),
    now,
    now,
    id
  );

  return getAnalysisJobById(id);
}

export function requeueFailedAnalysisJob(id) {
  const row = db
    .prepare("SELECT * FROM analysis_jobs WHERE id = ?")
    .get(id);

  if (!row) {
    return null;
  }

  if (row.status !== "failed") {
    return false;
  }

  if (!row.file_path || !fs.existsSync(row.file_path)) {
    return {
      unretryable: true,
      reason: "Arquivo original do job não está mais disponível."
    };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE analysis_jobs
    SET status = 'queued',
        error_message = NULL,
        failed_at = NULL,
        updated_at = ?
    WHERE id = ? AND status = 'failed'
  `).run(now, id);

  return getAnalysisJobById(id);
}

export function deleteResumeAnalysisForAccount(id, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!id || !normalizedEmail) {
    return null;
  }

  const row = db
    .prepare("SELECT * FROM resume_analyses WHERE id = ?")
    .get(id);

  if (!row) {
    return null;
  }

  if (row.account_email !== normalizedEmail) {
    return false;
  }

  db.prepare("DELETE FROM job_notifications WHERE analysis_id = ?").run(id);
  db.prepare("DELETE FROM analysis_tasks WHERE analysis_id = ?").run(id);
  db.prepare("DELETE FROM resume_versions WHERE analysis_id = ?").run(id);
  db.prepare("DELETE FROM resume_analyses WHERE id = ? AND account_email = ?").run(id, normalizedEmail);

  return {
    analysis: toApiAnalysis(row),
    filePath: row.file_path || null
  };
}

export function createJobNotificationForAnalysis(analysis) {
  const previousRows = db.prepare(`
    SELECT jobs FROM job_notifications
    WHERE account_email = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(String(analysis.account_email || "").toLowerCase());
  const previouslyNotified = new Set(previousRows.flatMap((row) => parseJson(row.jobs)).map((job) =>
    String(job?.external_id || job?.url || "")
  ).filter(Boolean));
  const compatibleJobs = (analysis.recommended_jobs || [])
    .filter((job) => normalizeJobMatch(job) >= 70)
    .filter((job) => !previouslyNotified.has(String(job?.external_id || job?.url || "")))
    .sort((a, b) => normalizeJobMatch(b) - normalizeJobMatch(a));

  if (compatibleJobs.length === 0) {
    return null;
  }

  const now = new Date().toISOString();
  const topMatch = normalizeJobMatch(compatibleJobs[0]);
  const topJobTitle = compatibleJobs[0]?.title || compatibleJobs[0]?.titulo || "vaga recomendada";
  const title = compatibleJobs.length > 1
    ? `${compatibleJobs.length} novas vagas compatíveis`
    : "1 nova vaga compatível";
  const message = `Encontramos ${compatibleJobs.length} oportunidade${compatibleJobs.length > 1 ? "s" : ""} com até ${topMatch}% de match. Destaque: ${topJobTitle}.`;

  db.prepare(`
    INSERT INTO job_notifications (
      id,
      analysis_id,
      account_email,
      title,
      message,
      job_count,
      top_match,
      jobs,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createEntityId("notification"),
    analysis.id,
    analysis.account_email || null,
    title,
    message,
    compatibleJobs.length,
    topMatch,
    stringify(compatibleJobs.slice(0, JOB_NOTIFICATION_LIMIT)),
    now,
    now
  );

  const row = db
    .prepare("SELECT * FROM job_notifications WHERE analysis_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(analysis.id);

  return row ? toApiNotification(row) : null;
}

export function listJobNotifications(accountEmail, limit = 20) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return [];
  }

  const rows = db
    .prepare(`
      SELECT *
      FROM job_notifications
      WHERE account_email = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(normalizedEmail, limit);

  return rows.map(toApiNotification);
}

export function countUnreadJobNotifications(accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return 0;
  }

  const row = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM job_notifications
      WHERE account_email = ?
        AND read_at IS NULL
    `)
    .get(normalizedEmail);

  return Number(row?.total || 0);
}

export function markJobNotificationAsRead(id, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE job_notifications
    SET read_at = COALESCE(read_at, ?),
        updated_at = ?
    WHERE id = ?
      AND account_email = ?
  `).run(now, now, id, normalizedEmail);

  const row = db
    .prepare("SELECT * FROM job_notifications WHERE id = ? AND account_email = ?")
    .get(id, normalizedEmail);

  return row ? toApiNotification(row) : null;
}

export function markAllJobNotificationsAsRead(accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return 0;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE job_notifications
    SET read_at = COALESCE(read_at, ?),
        updated_at = ?
    WHERE account_email = ?
      AND read_at IS NULL
  `).run(now, now, normalizedEmail);

  return countUnreadJobNotifications(normalizedEmail);
}

export function getUserSubscription(userId) {
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM user_subscriptions WHERE user_id = ?")
    .get(userId);

  if (existing) {
    return normalizeSubscriptionRow(existing);
  }

  db.prepare(`
    INSERT INTO user_subscriptions (
      user_id,
      plan,
      status,
      source,
      current_period_start_at,
      current_period_end_at,
      cancel_at_period_end,
      canceled_at,
      provider_subscription_id,
      next_payment_at,
      last_payment_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, "Gratis", "active", "system", null, null, 0, null, null, null, null, now, now);

  return {
    plan: "Gratis",
    status: "active",
    source: "system",
    current_period_start_at: null,
    current_period_end_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    provider_subscription_id: null,
    next_payment_at: null,
    last_payment_at: null,
    updated_date: now
  };
}

function getPlanPeriod({ plan, periodEnd = null, periodDays = 30 } = {}) {
  const safePlan = String(plan || "Gratis").trim();

  if (safePlan.toLowerCase() === "gratis") {
    return {
      start: null,
      end: null
    };
  }

  const now = new Date();
  const parsedPeriodEnd = periodEnd ? new Date(periodEnd) : null;

  return {
    start: now.toISOString(),
    end: parsedPeriodEnd && Number.isFinite(parsedPeriodEnd.getTime())
      ? parsedPeriodEnd.toISOString()
      : new Date(now.getTime() + Number(periodDays || 30) * 24 * 60 * 60 * 1000).toISOString()
  };
}

function normalizeSubscriptionRow(row) {
  const now = new Date();
  const periodEnd = row.current_period_end_at ? new Date(row.current_period_end_at) : null;
  const isExpired = row.plan !== "Gratis" &&
    periodEnd &&
    Number.isFinite(periodEnd.getTime()) &&
    periodEnd <= now;

  if (isExpired) {
    const updatedAt = now.toISOString();

    db.prepare(`
      UPDATE user_subscriptions
      SET plan = ?,
          status = ?,
          cancel_at_period_end = 0,
          updated_at = ?
      WHERE user_id = ?
    `).run("Gratis", "expired", updatedAt, row.user_id);

    return {
      plan: "Gratis",
      status: "expired",
      source: row.source,
      current_period_start_at: row.current_period_start_at,
      current_period_end_at: row.current_period_end_at,
      cancel_at_period_end: false,
      canceled_at: row.canceled_at,
      provider_subscription_id: row.provider_subscription_id,
      next_payment_at: row.next_payment_at,
      last_payment_at: row.last_payment_at,
      updated_date: updatedAt
    };
  }

  return {
    plan: row.plan,
    status: row.status,
    source: row.source,
    current_period_start_at: row.current_period_start_at,
    current_period_end_at: row.current_period_end_at,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    canceled_at: row.canceled_at,
    provider_subscription_id: row.provider_subscription_id,
    next_payment_at: row.next_payment_at,
    last_payment_at: row.last_payment_at,
    updated_date: row.updated_at
  };
}

export function updateUserSubscription(userId, plan, source = "demo", options = {}) {
  const safePlan = String(plan || "Gratis").trim();
  const now = new Date().toISOString();
  const period = getPlanPeriod({
    plan: safePlan,
    periodEnd: options.periodEnd,
    periodDays: options.periodDays
  });
  const status = options.status || "active";

  db.prepare(`
    INSERT INTO user_subscriptions (
      user_id,
      plan,
      status,
      source,
      current_period_start_at,
      current_period_end_at,
      cancel_at_period_end,
      canceled_at,
      provider_subscription_id,
      next_payment_at,
      last_payment_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      source = excluded.source,
      current_period_start_at = excluded.current_period_start_at,
      current_period_end_at = excluded.current_period_end_at,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      provider_subscription_id = COALESCE(excluded.provider_subscription_id, user_subscriptions.provider_subscription_id),
      next_payment_at = excluded.next_payment_at,
      last_payment_at = COALESCE(excluded.last_payment_at, user_subscriptions.last_payment_at),
      updated_at = excluded.updated_at
  `).run(
    userId,
    safePlan,
    status,
    source,
    period.start,
    period.end,
    0,
    null,
    options.providerSubscriptionId || null,
    options.nextPaymentAt || period.end,
    options.lastPaymentAt || null,
    now,
    now
  );

  return getUserSubscription(userId);
}

export function getSubscriptionCheckoutByProviderId(providerCheckoutId) {
  const row = db
    .prepare("SELECT * FROM subscription_checkouts WHERE provider_checkout_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(String(providerCheckoutId || ""));

  return row ? toApiSubscriptionCheckout(row) : null;
}

export function cancelUserSubscription(userId) {
  const current = db
    .prepare("SELECT * FROM user_subscriptions WHERE user_id = ?")
    .get(userId);

  if (!current || current.plan === "Gratis") {
    return getUserSubscription(userId);
  }

  const now = new Date().toISOString();
  const hasFuturePeriod = current.current_period_end_at &&
    new Date(current.current_period_end_at) > new Date();

  if (!hasFuturePeriod) {
    return updateUserSubscription(userId, "Gratis", current.source, {
      status: "canceled"
    });
  }

  db.prepare(`
    UPDATE user_subscriptions
    SET status = ?,
        cancel_at_period_end = 1,
        canceled_at = ?,
        updated_at = ?
    WHERE user_id = ?
  `).run("canceling", now, now, userId);

  return getUserSubscription(userId);
}

function toApiSubscriptionCheckout(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    plan: row.plan,
    provider: row.provider,
    provider_checkout_id: row.provider_checkout_id,
    provider_payment_id: row.provider_payment_id,
    status: row.status,
    amount_cents: row.amount_cents,
    currency: row.currency,
    checkout_url: row.checkout_url,
    raw_response: parseJsonObject(row.raw_response),
    created_date: row.created_at,
    updated_date: row.updated_at
  };
}

export function createSubscriptionCheckout({
  userId,
  plan,
  provider,
  amountCents,
  currency = "BRL"
}) {
  const now = new Date().toISOString();
  const id = createEntityId("checkout");

  db.prepare(`
    INSERT INTO subscription_checkouts (
      id,
      user_id,
      plan,
      provider,
      amount_cents,
      currency,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    plan,
    provider,
    Number(amountCents || 0),
    currency,
    now,
    now
  );

  return getSubscriptionCheckoutById(id);
}

export function getSubscriptionCheckoutById(id) {
  const row = db
    .prepare("SELECT * FROM subscription_checkouts WHERE id = ?")
    .get(id);

  return row ? toApiSubscriptionCheckout(row) : null;
}

export function updateSubscriptionCheckoutProviderData(
  id,
  { providerCheckoutId = null, checkoutUrl = null, rawResponse = {} } = {}
) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE subscription_checkouts
    SET provider_checkout_id = ?,
        checkout_url = ?,
        raw_response = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    providerCheckoutId,
    checkoutUrl,
    JSON.stringify(rawResponse || {}),
    now,
    id
  );

  return getSubscriptionCheckoutById(id);
}

export function updateSubscriptionCheckoutStatus(
  id,
  {
    status,
    providerPaymentId = null,
    rawResponse = {}
  } = {}
) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE subscription_checkouts
    SET status = ?,
        provider_payment_id = COALESCE(?, provider_payment_id),
        raw_response = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    String(status || "pending"),
    providerPaymentId,
    JSON.stringify(rawResponse || {}),
    now,
    id
  );

  return getSubscriptionCheckoutById(id);
}

function toApiPaymentWebhookEvent(row) {
  return {
    id: row.id,
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    event_type: row.event_type,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    request_id: row.request_id,
    checkout_id: row.checkout_id,
    provider_payment_id: row.provider_payment_id,
    payment_status: row.payment_status,
    processing_status: row.processing_status,
    raw_payload: parseJsonObject(row.raw_payload),
    error_message: row.error_message,
    received_at: row.received_at,
    processed_at: row.processed_at,
    created_date: row.created_at,
    updated_date: row.updated_at
  };
}

export function recordPaymentWebhookEvent({
  provider,
  providerEventId = null,
  eventType = "",
  action = "",
  resourceType = "",
  resourceId = "",
  requestId = "",
  rawPayload = {}
}) {
  const safeProvider = String(provider || "").trim().toLowerCase();
  const safeProviderEventId = String(providerEventId || "").trim() || null;
  const now = new Date().toISOString();

  if (!safeProvider) {
    throw new Error("Provider de webhook de pagamento invalido.");
  }

  if (safeProviderEventId) {
    const existing = db
      .prepare("SELECT * FROM payment_webhook_events WHERE provider = ? AND provider_event_id = ?")
      .get(safeProvider, safeProviderEventId);

    if (existing) {
      return {
        event: toApiPaymentWebhookEvent(existing),
        duplicate: true
      };
    }
  }

  const id = createEntityId("payment_event");

  try {
    db.prepare(`
      INSERT INTO payment_webhook_events (
        id,
        provider,
        provider_event_id,
        event_type,
        action,
        resource_type,
        resource_id,
        request_id,
        raw_payload,
        received_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      safeProvider,
      safeProviderEventId,
      String(eventType || ""),
      String(action || ""),
      String(resourceType || ""),
      String(resourceId || ""),
      String(requestId || ""),
      JSON.stringify(rawPayload || {}),
      now,
      now,
      now
    );
  } catch (error) {
    if (safeProviderEventId) {
      const existing = db
        .prepare("SELECT * FROM payment_webhook_events WHERE provider = ? AND provider_event_id = ?")
        .get(safeProvider, safeProviderEventId);

      if (existing) {
        return {
          event: toApiPaymentWebhookEvent(existing),
          duplicate: true
        };
      }
    }

    throw error;
  }

  return {
    event: getPaymentWebhookEventById(id),
    duplicate: false
  };
}

export function getPaymentWebhookEventById(id) {
  const row = db
    .prepare("SELECT * FROM payment_webhook_events WHERE id = ?")
    .get(id);

  return row ? toApiPaymentWebhookEvent(row) : null;
}

export function markPaymentWebhookEventProcessed(
  id,
  {
    processingStatus = "processed",
    checkoutId = null,
    providerPaymentId = null,
    paymentStatus = "",
    errorMessage = ""
  } = {}
) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE payment_webhook_events
    SET processing_status = ?,
        checkout_id = COALESCE(?, checkout_id),
        provider_payment_id = COALESCE(?, provider_payment_id),
        payment_status = COALESCE(?, payment_status),
        error_message = ?,
        processed_at = COALESCE(processed_at, ?),
        updated_at = ?
    WHERE id = ?
  `).run(
    String(processingStatus || "processed"),
    checkoutId,
    providerPaymentId,
    paymentStatus || null,
    errorMessage || null,
    now,
    now,
    id
  );

  return getPaymentWebhookEventById(id);
}

export function markPaymentWebhookEventFailed(id, errorMessage = "") {
  return markPaymentWebhookEventProcessed(id, {
    processingStatus: "failed",
    errorMessage: String(errorMessage || "Erro ao processar webhook de pagamento.")
  });
}

function clampListLimit(limit, fallback = 20, max = 100) {
  const parsed = Number.parseInt(limit || "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function toApiAIEvent(row) {
  return {
    id: row.id,
    task: row.task,
    provider: row.provider,
    model: row.model,
    status: row.status,
    account_email: row.account_email,
    message: row.message,
    context: parseJsonObject(row.context),
    created_date: row.created_at
  };
}

export function recordAIEvent({
  task = "ai",
  provider = "",
  model = "",
  status = "failed",
  accountEmail = "",
  message = "",
  context = {}
} = {}) {
  const now = new Date().toISOString();
  const id = createEntityId("ai_event");

  db.prepare(`
    INSERT INTO ai_events (
      id,
      task,
      provider,
      model,
      status,
      account_email,
      message,
      context,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(task || "ai"),
    provider || null,
    model || null,
    String(status || "failed"),
    String(accountEmail || "").trim().toLowerCase() || null,
    String(message || "").slice(0, 1000),
    JSON.stringify(context || {}),
    now
  );

  return getAIEventById(id);
}

export function getAIEventById(id) {
  const row = db
    .prepare("SELECT * FROM ai_events WHERE id = ?")
    .get(id);

  return row ? toApiAIEvent(row) : null;
}

export function recordProductEvent({
  anonymousId,
  userHash = "",
  eventName,
  properties = {},
  occurredAt = new Date().toISOString()
}) {
  const id = createEntityId("event");
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO product_events (
      id, anonymous_id, user_hash, event_name, properties, occurred_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(anonymousId || "anonymous").slice(0, 128),
    String(userHash || "").slice(0, 128) || null,
    String(eventName || "").slice(0, 80),
    JSON.stringify(properties || {}),
    occurredAt,
    now
  );

  return { id, event_name: eventName, occurred_at: occurredAt };
}

export function getProductAnalyticsSummary({ days = 30 } = {}) {
  const safeDays = Math.min(365, Math.max(1, Number(days) || 30));
  const since = new Date(Date.now() - safeDays * 86400000).toISOString();
  const events = db.prepare(`
    SELECT event_name, COUNT(*) AS total, COUNT(DISTINCT COALESCE(user_hash, anonymous_id)) AS users
    FROM product_events
    WHERE occurred_at >= ?
    GROUP BY event_name
    ORDER BY total DESC
  `).all(since);

  const activity = db.prepare("SELECT COALESCE(user_hash, anonymous_id) AS actor, event_name, properties, occurred_at FROM product_events WHERE occurred_at >= ? ORDER BY occurred_at, rowid").all(since);
  const stages = ["resume_upload_completed", "resume_version_saved", "resume_exported", "application_sent"];
  const progress = new Map();
  for (const event of activity) {
    const stage = event.event_name === "job_status_changed" && parseJsonObject(event.properties).status === "applied" ? "application_sent" : event.event_name;
    const index = progress.get(event.actor) || 0;
    if (stage === stages[index]) progress.set(event.actor, index + 1);
  }
  const cohorts = db.prepare(`
    WITH first_visits AS (
      SELECT COALESCE(user_hash, anonymous_id) AS actor, MIN(occurred_at) AS first_at
      FROM product_events WHERE event_name = 'app_opened' GROUP BY actor
    )
    SELECT COUNT(*) AS eligible, COALESCE(SUM(EXISTS(
      SELECT 1 FROM product_events e WHERE COALESCE(e.user_hash, e.anonymous_id) = f.actor
        AND e.event_name = 'app_opened'
        AND julianday(e.occurred_at) >= julianday(f.first_at) + 1
        AND julianday(e.occurred_at) <= julianday(f.first_at) + 7
    )), 0) AS returned FROM first_visits f
    WHERE first_at >= ? AND first_at <= ?
  `).get(since, new Date(Date.now() - 7 * 86400000).toISOString());
  return {
    days: safeDays,
    since,
    funnel: stages.map((stage, index) => ({ stage, users: [...progress.values()].filter((value) => value > index).length })),
    retention: { eligible: Number(cohorts.eligible), returned: Number(cohorts.returned) },
    events: events.map((row) => ({
      event_name: row.event_name,
      total: Number(row.total || 0),
      users: Number(row.users || 0)
    }))
  };
}

export function listAdminAIEvents(limit = 20) {
  return db.prepare(`
    SELECT *
    FROM ai_events
    ORDER BY created_at DESC
    LIMIT ?
  `).all(clampListLimit(limit)).map(toApiAIEvent);
}

export function getAdminDashboardData({ limit = 20 } = {}) {
  const safeLimit = clampListLimit(limit);
  const scalar = (sql, params = []) => Number(db.prepare(sql).get(...params)?.total || 0);
  const users = db.prepare(`
    SELECT
      users.id,
      users.name,
      users.email,
      users.email_verified_at,
      users.created_at,
      users.updated_at,
      user_profiles.target_role,
      user_profiles.experience_level,
      user_subscriptions.plan AS subscription_plan,
      user_subscriptions.status AS subscription_status,
      (
        SELECT COUNT(*)
        FROM resume_analyses
        WHERE resume_analyses.account_email = users.email
      ) AS analysis_count,
      (
        SELECT MAX(created_at)
        FROM resume_analyses
        WHERE resume_analyses.account_email = users.email
      ) AS last_analysis_at,
      (
        SELECT COUNT(*)
        FROM auth_sessions
        WHERE auth_sessions.user_id = users.id
          AND auth_sessions.revoked_at IS NULL
          AND auth_sessions.expires_at > ?
      ) AS active_session_count
    FROM users
    LEFT JOIN user_profiles ON user_profiles.user_id = users.id
    LEFT JOIN user_subscriptions ON user_subscriptions.user_id = users.id
    ORDER BY users.created_at DESC
    LIMIT ?
  `).all(new Date().toISOString(), safeLimit).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    email_verified_at: row.email_verified_at,
    target_role: row.target_role,
    experience_level: row.experience_level,
    subscription_plan: row.subscription_plan || "Gratis",
    subscription_status: row.subscription_status || "active",
    analysis_count: Number(row.analysis_count || 0),
    last_analysis_at: row.last_analysis_at,
    active_session_count: Number(row.active_session_count || 0),
    created_date: row.created_at,
    updated_date: row.updated_at
  }));
  const jobs = db.prepare(`
    SELECT id, user_id, account_email, status, file_name, attempts, error_message,
      started_at, completed_at, failed_at, created_at, updated_at
    FROM analysis_jobs
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(safeLimit).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    account_email: row.account_email,
    status: row.status,
    file_name: row.file_name,
    attempts: Number(row.attempts || 0),
    error: row.error_message || "",
    started_at: row.started_at,
    completed_at: row.completed_at,
    failed_at: row.failed_at,
    created_date: row.created_at,
    updated_date: row.updated_at
  }));
  const checkouts = db.prepare(`
    SELECT id, user_id, plan, provider, provider_checkout_id, provider_payment_id,
      status, amount_cents, currency, created_at, updated_at
    FROM subscription_checkouts
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(safeLimit).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    plan: row.plan,
    provider: row.provider,
    provider_checkout_id: row.provider_checkout_id,
    provider_payment_id: row.provider_payment_id,
    status: row.status,
    amount_cents: row.amount_cents,
    currency: row.currency,
    created_date: row.created_at,
    updated_date: row.updated_at
  }));
  const webhookEvents = db.prepare(`
    SELECT *
    FROM payment_webhook_events
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(safeLimit).map(toApiPaymentWebhookEvent);
  const aiEvents = listAdminAIEvents(safeLimit);

  return {
    summary: {
      users: scalar("SELECT COUNT(*) AS total FROM users"),
      analyses: scalar("SELECT COUNT(*) AS total FROM resume_analyses"),
      analysis_jobs_queued: scalar("SELECT COUNT(*) AS total FROM analysis_jobs WHERE status = 'queued'"),
      analysis_jobs_processing: scalar("SELECT COUNT(*) AS total FROM analysis_jobs WHERE status = 'processing'"),
      analysis_jobs_failed: scalar("SELECT COUNT(*) AS total FROM analysis_jobs WHERE status = 'failed'"),
      job_searches_success: scalar("SELECT COUNT(*) AS total FROM resume_analyses WHERE job_search_status = 'success'"),
      job_searches_no_results: scalar("SELECT COUNT(*) AS total FROM resume_analyses WHERE job_search_status = 'no_results'"),
      job_searches_failed: scalar("SELECT COUNT(*) AS total FROM resume_analyses WHERE job_search_status = 'provider_error'"),
      job_searches_blocked: scalar("SELECT COUNT(*) AS total FROM resume_analyses WHERE job_search_status IN ('blocked', 'invalid_profile')"),
      paid_subscriptions: scalar("SELECT COUNT(*) AS total FROM user_subscriptions WHERE plan <> 'Gratis'"),
      payment_checkouts_failed: scalar("SELECT COUNT(*) AS total FROM subscription_checkouts WHERE status IN ('failed', 'rejected', 'cancelled', 'refunded', 'charged_back', 'review_required')"),
      payment_webhooks_failed: scalar("SELECT COUNT(*) AS total FROM payment_webhook_events WHERE processing_status IN ('failed', 'review_required')"),
      ai_events: scalar("SELECT COUNT(*) AS total FROM ai_events")
    },
    users,
    jobs,
    checkouts,
    webhook_events: webhookEvents,
    ai_events: aiEvents
  };
}

export function saveEmailVerificationCode(email, code, expiresAt) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashOneTimeCode(normalizedEmail, code);

  db.prepare(`
    UPDATE email_verification_codes
    SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, normalizedEmail);

  db.prepare(`
    INSERT INTO email_verification_codes (
      id,
      email,
      code,
      expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    createEntityId("code"),
    normalizedEmail,
    codeHash,
    expiresAt,
    now
  );
}

export function preparePasswordLogin(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);

  if (!user) {
    return {
      allowed: false,
      reason: "not_found"
    };
  }

  if (user.password_hash) {
    const passwordMatches = verifyPasswordHash(password, user.password_hash);

    return {
      allowed: passwordMatches,
      reason: passwordMatches ? "ok" : "invalid_password"
    };
  }

  if (String(password || "").length < 8) {
    return {
      allowed: false,
      reason: "password_setup_too_short"
    };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET password_hash = ?,
        updated_at = ?
    WHERE email = ?
  `).run(hashPassword(password), now, normalizedEmail);

  return {
    allowed: true,
    reason: "password_created"
  };
}

export function createPasswordUser({ email, name, password }) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const safeName = String(name || "").trim() || normalizedEmail.split("@")[0] || "Usuário";
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);

  if (existingUser?.password_hash && existingUser.email_verified_at) {
    return {
      user: toApiUser(existingUser),
      alreadyExists: true
    };
  }

  if (existingUser) {
    db.prepare(`
      UPDATE users
      SET name = ?,
          password_hash = ?,
          updated_at = ?
      WHERE id = ?
    `).run(safeName, hashPassword(password), now, existingUser.id);

    return {
      user: getUserByEmail(normalizedEmail),
      alreadyExists: false
    };
  }

  db.prepare(`
    INSERT INTO users (
      id,
      email,
      name,
      password_hash,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    createEntityId("user"),
    normalizedEmail,
    safeName,
    hashPassword(password),
    now,
    now
  );

  return {
    user: getUserByEmail(normalizedEmail),
    alreadyExists: false
  };
}

export function invalidateEmailVerificationCodes(email) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  db.prepare(`
    UPDATE email_verification_codes
    SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, normalizedEmail);
}

export function savePasswordResetCode(email, code, expiresAt) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashOneTimeCode(normalizedEmail, code);

  db.prepare(`
    UPDATE password_reset_codes
    SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, normalizedEmail);

  db.prepare(`
    INSERT INTO password_reset_codes (
      id,
      email,
      code,
      expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    createEntityId("reset"),
    normalizedEmail,
    codeHash,
    expiresAt,
    now
  );
}

export function invalidatePasswordResetCodes(email) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  db.prepare(`
    UPDATE password_reset_codes
    SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, normalizedEmail);
}

export function resetPasswordWithCode(email, code, password) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashOneTimeCode(normalizedEmail, code);

  const row = db.prepare(`
    SELECT *
    FROM password_reset_codes
    WHERE email = ?
      AND code = ?
      AND used_at IS NULL
      AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(normalizedEmail, codeHash, now);

  if (!row) {
    return null;
  }

  db.prepare(`
    UPDATE password_reset_codes
    SET used_at = ?
    WHERE id = ?
  `).run(now, row.id);

  const user = upsertVerifiedUser(normalizedEmail);

  db.prepare(`
    UPDATE users
    SET password_hash = ?,
        updated_at = ?
    WHERE email = ?
  `).run(hashPassword(password), now, normalizedEmail);

  const updatedUser = getUserByEmail(user.email);
  revokeAuthSessionsForUser(updatedUser?.id);

  return updatedUser;
}

export function verifyEmailCode(email, code) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const codeHash = hashOneTimeCode(normalizedEmail, code);

  const row = db.prepare(`
    SELECT *
    FROM email_verification_codes
    WHERE email = ?
      AND code = ?
      AND used_at IS NULL
      AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(normalizedEmail, codeHash, now);

  if (!row) {
    return null;
  }

  db.prepare(`
    UPDATE email_verification_codes
    SET used_at = ?
    WHERE id = ?
  `).run(now, row.id);

  return upsertVerifiedUser(normalizedEmail);
}

function upsertVerifiedUser(email) {
  const now = new Date().toISOString();
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (existingUser) {
    db.prepare(`
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, ?),
          updated_at = ?
      WHERE id = ?
    `).run(now, now, existingUser.id);

    return getUserByEmail(email);
  }

  const name = email.split("@")[0] || "Usuário";

  db.prepare(`
    INSERT INTO users (
      id,
      email,
      name,
      email_verified_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    createEntityId("user"),
    email,
    name,
    now,
    now,
    now
  );

  return getUserByEmail(email);
}

export function upsertOAuthUser(email, name = "") {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();
  const safeName = String(name || "").trim() || normalizedEmail.split("@")[0] || "Usuário";
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);

  if (existingUser) {
    db.prepare(`
      UPDATE users
      SET name = CASE
            WHEN name IS NULL OR name = '' OR name = email THEN ?
            ELSE name
          END,
          email_verified_at = COALESCE(email_verified_at, ?),
          updated_at = ?
      WHERE id = ?
    `).run(safeName, now, now, existingUser.id);

    return getUserByEmail(normalizedEmail);
  }

  db.prepare(`
    INSERT INTO users (
      id,
      email,
      name,
      email_verified_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    createEntityId("user"),
    normalizedEmail,
    safeName,
    now,
    now,
    now
  );

  return getUserByEmail(normalizedEmail);
}

export function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO auth_sessions (
      id,
      user_id,
      token_hash,
      expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    createEntityId("session"),
    userId,
    hashSessionToken(token),
    expiresAt,
    now
  );

  return {
    token,
    expires_at: expiresAt
  };
}

export function createOAuthExchangeCode(userId) {
  const code = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OAUTH_EXCHANGE_CODE_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO oauth_exchange_codes (
      id,
      user_id,
      code_hash,
      expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    createEntityId("oauth"),
    userId,
    hashOAuthExchangeCode(code),
    expiresAt,
    now
  );

  return {
    code,
    expires_at: expiresAt
  };
}

export function consumeOAuthExchangeCode(code) {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT users.*, oauth_exchange_codes.id AS exchange_id
    FROM oauth_exchange_codes
    INNER JOIN users ON users.id = oauth_exchange_codes.user_id
    WHERE oauth_exchange_codes.code_hash = ?
      AND oauth_exchange_codes.used_at IS NULL
      AND oauth_exchange_codes.expires_at > ?
    LIMIT 1
  `).get(hashOAuthExchangeCode(code), now);

  if (!row) {
    return null;
  }

  db.prepare(`
    UPDATE oauth_exchange_codes
    SET used_at = ?
    WHERE id = ?
  `).run(now, row.exchange_id);

  return toApiUser(row);
}

export function getUserBySessionToken(token) {
  const tokenHash = hashSessionToken(token);
  const now = new Date().toISOString();
  const user = db.prepare(`
    SELECT users.*
    FROM auth_sessions
    INNER JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ?
      AND auth_sessions.revoked_at IS NULL
      AND auth_sessions.expires_at > ?
    LIMIT 1
  `).get(tokenHash, now);

  return user ? toApiUser(user) : null;
}

export function revokeAuthSession(token) {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?
    WHERE token_hash = ? AND revoked_at IS NULL
  `).run(now, hashSessionToken(token));
}

export function revokeAuthSessionsForUser(userId) {
  if (!userId) {
    return;
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?
    WHERE user_id = ? AND revoked_at IS NULL
  `).run(now, userId);
}

export function getAnalysisTasksForAccount(analysisId, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!analysisId || !normalizedEmail) {
    return null;
  }

  const analysis = db
    .prepare("SELECT id, account_email FROM resume_analyses WHERE id = ?")
    .get(analysisId);

  if (!analysis) {
    return null;
  }

  if (analysis.account_email !== normalizedEmail) {
    return false;
  }

  const row = db
    .prepare("SELECT * FROM analysis_tasks WHERE analysis_id = ? AND account_email = ?")
    .get(analysisId, normalizedEmail);

  return {
    analysis_id: analysisId,
    checked: row ? parseJsonObject(row.checked) : {},
    updated_date: row?.updated_at || null
  };
}

export function upsertAnalysisTasksForAccount(analysisId, accountEmail, checked = {}) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  const existing = getAnalysisTasksForAccount(analysisId, normalizedEmail);

  if (existing === null || existing === false) {
    return existing;
  }

  const safeChecked = Object.fromEntries(
    Object.entries(checked || {})
      .filter(([key]) => /^\d+$/.test(String(key)))
      .map(([key, value]) => [String(key), Boolean(value)])
  );
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO analysis_tasks (
      analysis_id,
      account_email,
      checked,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(analysis_id) DO UPDATE SET
      checked = excluded.checked,
      updated_at = excluded.updated_at
  `).run(
    analysisId,
    normalizedEmail,
    JSON.stringify(safeChecked),
    now,
    now
  );

  return getAnalysisTasksForAccount(analysisId, normalizedEmail);
}

function cleanProfileText(value) {
  return String(value ?? "").trim();
}

function toApiProfile(row, user = {}) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: row?.phone || "",
    location: row?.location || "",
    headline: row?.headline || "",
    targetRole: row?.target_role || "",
    experienceLevel: row?.experience_level || "",
    linkedin: row?.linkedin || "",
    portfolio: row?.portfolio || "",
    summary: row?.summary || "",
    updated_date: row?.updated_at || null
  };
}

export function getUserById(userId) {
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId);

  return user ? toApiUser(user) : null;
}

export function getUserProfile(userId, user = {}) {
  const row = db
    .prepare("SELECT * FROM user_profiles WHERE user_id = ?")
    .get(userId);

  return { ...toApiProfile(row, user), ...getProfessionalProfile(userId) };
}

export function updateUserName(userId, name) {
  const safeName = cleanProfileText(name);

  if (!safeName) {
    return getUserById(userId);
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET name = ?,
        updated_at = ?
    WHERE id = ?
  `).run(safeName, now, userId);

  return getUserById(userId);
}

export function upsertUserProfile(userId, profile = {}, user = {}) {
  const now = new Date().toISOString();
  const safeProfile = {
    phone: cleanProfileText(profile.phone),
    location: cleanProfileText(profile.location),
    headline: cleanProfileText(profile.headline),
    targetRole: cleanProfileText(profile.targetRole ?? profile.target_role),
    experienceLevel: cleanProfileText(profile.experienceLevel ?? profile.experience_level),
    linkedin: cleanProfileText(profile.linkedin),
    portfolio: cleanProfileText(profile.portfolio),
    summary: cleanProfileText(profile.summary)
  };

  db.prepare(`
    INSERT INTO user_profiles (
      user_id,
      phone,
      location,
      headline,
      target_role,
      experience_level,
      linkedin,
      portfolio,
      summary,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      phone = excluded.phone,
      location = excluded.location,
      headline = excluded.headline,
      target_role = excluded.target_role,
      experience_level = excluded.experience_level,
      linkedin = excluded.linkedin,
      portfolio = excluded.portfolio,
      summary = excluded.summary,
      updated_at = excluded.updated_at
  `).run(
    userId,
    safeProfile.phone,
    safeProfile.location,
    safeProfile.headline,
    safeProfile.targetRole,
    safeProfile.experienceLevel,
    safeProfile.linkedin,
    safeProfile.portfolio,
    safeProfile.summary,
    now,
    now
  );

  return getUserProfile(userId, user);
}

function uniqueFilePaths(rows = []) {
  return Array.from(new Set(
    rows
      .map((row) => row.file_path)
      .filter(Boolean)
  ));
}

function analyticsUserHash(userId) {
  const secret = process.env.ANALYTICS_HASH_SECRET || process.env.AUTH_CODE_SECRET;
  return userId && secret
    ? crypto.createHmac("sha256", secret).update(String(userId)).digest("hex")
    : "";
}

export function exportAccountData(userId, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  const user = getUserById(userId);

  if (!user || user.email !== normalizedEmail) {
    return null;
  }

  const analysisRows = db.prepare(`
    SELECT *
    FROM resume_analyses
    WHERE account_email = ?
    ORDER BY created_at DESC
  `).all(normalizedEmail);
  const analyses = analysisRows.map((row) => ({
    ...toApiAnalysis(row),
    resume_text: readStoredResumeText(row.resume_text)
  }));
  const jobs = db.prepare(`
    SELECT *
    FROM analysis_jobs
    WHERE account_email = ?
    ORDER BY created_at DESC
  `).all(normalizedEmail).map(toApiAnalysisJob);
  const notifications = db.prepare(`
    SELECT *
    FROM job_notifications
    WHERE account_email = ?
    ORDER BY created_at DESC
  `).all(normalizedEmail).map(toApiNotification);
  const trackedJobs = listTrackedJobsForUser(userId);
  const tasks = db.prepare(`
    SELECT *
    FROM analysis_tasks
    WHERE account_email = ?
    ORDER BY updated_at DESC
  `).all(normalizedEmail).map((row) => ({
    analysis_id: row.analysis_id,
    checked: parseJsonObject(row.checked),
    created_date: row.created_at,
    updated_date: row.updated_at
  }));
  const subscription = getUserSubscription(userId);
  const checkouts = db.prepare(`
    SELECT id, plan, provider, provider_checkout_id, provider_payment_id,
      status, amount_cents, currency, created_at, updated_at
    FROM subscription_checkouts
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId).map((row) => ({
    id: row.id,
    plan: row.plan,
    provider: row.provider,
    provider_checkout_id: row.provider_checkout_id,
    provider_payment_id: row.provider_payment_id,
    status: row.status,
    amount_cents: row.amount_cents,
    currency: row.currency,
    created_date: row.created_at,
    updated_date: row.updated_at
  }));
  const userHash = analyticsUserHash(userId);
  const analyticsEvents = userHash ? db.prepare(`
    SELECT event_name, properties, occurred_at
    FROM product_events
    WHERE user_hash = ?
    ORDER BY occurred_at DESC
  `).all(userHash).map((row) => ({
    event_name: row.event_name,
    properties: parseJsonObject(row.properties),
    occurred_at: row.occurred_at
  })) : [];

  return {
    exported_at: new Date().toISOString(),
    user,
    profile: getUserProfile(userId, user),
    subscription,
    analyses,
    analysis_jobs: jobs,
    notifications,
    tracked_jobs: trackedJobs,
    saved_searches: listSavedSearches(userId),
    search_history: listSearchHistory(userId),
    feedback: listFeedback(userId),
    support_ratings: db.prepare("SELECT id, fallback, duration_ms, helpful, created_at FROM support_interactions WHERE user_id = ?").all(userId),
    analysis_tasks: tasks,
    resume_versions: listSavedResumeVersions(normalizedEmail),
    subscription_checkouts: checkouts,
    analytics_events: analyticsEvents
  };
}

export function clearResumeTextsForAccount(accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  const now = new Date().toISOString();

  if (!normalizedEmail) {
    return 0;
  }

  const result = db.prepare(`
    UPDATE resume_analyses
    SET resume_text = NULL,
        updated_at = ?
    WHERE account_email = ?
      AND resume_text IS NOT NULL
  `).run(now, normalizedEmail);

  return Number(result?.changes || 0);
}

export function deleteResumeAnalysesForAccount(accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      deleted_analyses: 0,
      deleted_jobs: 0,
      file_paths: []
    };
  }

  const analysisRows = db.prepare(`
    SELECT id, file_path
    FROM resume_analyses
    WHERE account_email = ?
  `).all(normalizedEmail);
  const analysisIds = analysisRows.map((row) => row.id);
  const jobRows = db.prepare(`
    SELECT id, file_path
    FROM analysis_jobs
    WHERE account_email = ?
  `).all(normalizedEmail);

  for (const analysisId of analysisIds) {
    db.prepare("DELETE FROM job_notifications WHERE analysis_id = ?").run(analysisId);
    db.prepare("DELETE FROM analysis_tasks WHERE analysis_id = ?").run(analysisId);
    db.prepare("DELETE FROM resume_versions WHERE analysis_id = ?").run(analysisId);
  }

  const deletedAnalyses = db
    .prepare("DELETE FROM resume_analyses WHERE account_email = ?")
    .run(normalizedEmail);
  const deletedJobs = db
    .prepare("DELETE FROM analysis_jobs WHERE account_email = ?")
    .run(normalizedEmail);

  return {
    deleted_analyses: Number(deletedAnalyses?.changes || 0),
    deleted_jobs: Number(deletedJobs?.changes || 0),
    file_paths: uniqueFilePaths([...analysisRows, ...jobRows])
  };
}

export function deleteUserAccountData(userId, accountEmail) {
  const normalizedEmail = String(accountEmail || "").trim().toLowerCase();
  const user = getUserById(userId);

  if (!user || user.email !== normalizedEmail) {
    return null;
  }

  const analysisDeletion = deleteResumeAnalysesForAccount(normalizedEmail);
  const checkoutRows = db.prepare(`
    SELECT id
    FROM subscription_checkouts
    WHERE user_id = ?
  `).all(userId);

  for (const checkout of checkoutRows) {
    db.prepare(`
      UPDATE payment_webhook_events
      SET checkout_id = NULL,
          updated_at = ?
      WHERE checkout_id = ?
    `).run(new Date().toISOString(), checkout.id);
  }

  const counts = {
    ...analysisDeletion,
    deleted_tracked_jobs: Number(db.prepare("DELETE FROM tracked_jobs WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_sessions: Number(db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_professional_profile: Number(db.prepare("DELETE FROM professional_profiles WHERE user_id = ?").run(userId).changes),
    deleted_saved_searches: Number(db.prepare("DELETE FROM saved_searches WHERE user_id = ?").run(userId).changes),
    deleted_search_history: Number(db.prepare("DELETE FROM search_history WHERE user_id = ?").run(userId).changes),
    deleted_feedback: Number(db.prepare("DELETE FROM product_feedback WHERE user_id = ?").run(userId).changes),
    deleted_support_interactions: Number(db.prepare("DELETE FROM support_interactions WHERE user_id = ?").run(userId).changes),
    deleted_profile: Number(db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_subscription: Number(db.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_checkouts: Number(db.prepare("DELETE FROM subscription_checkouts WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_oauth_codes: Number(db.prepare("DELETE FROM oauth_exchange_codes WHERE user_id = ?").run(userId)?.changes || 0),
    deleted_email_codes: Number(db.prepare("DELETE FROM email_verification_codes WHERE email = ?").run(normalizedEmail)?.changes || 0),
    deleted_password_codes: Number(db.prepare("DELETE FROM password_reset_codes WHERE email = ?").run(normalizedEmail)?.changes || 0),
    deleted_ai_events: Number(db.prepare("DELETE FROM ai_events WHERE account_email = ?").run(normalizedEmail)?.changes || 0),
    deleted_analytics_events: Number(db.prepare("DELETE FROM product_events WHERE user_hash = ?").run(analyticsUserHash(userId) || "__none__")?.changes || 0),
    deleted_user: Number(db.prepare("DELETE FROM users WHERE id = ?").run(userId)?.changes || 0)
  };

  return counts;
}

function toApiUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified_at: user.email_verified_at,
    created_date: user.created_at
  };
}

export function listSavedResumeVersions(accountEmail, analysisId) {
  const email = String(accountEmail || "").trim().toLowerCase();
  const rows = analysisId
    ? db.prepare("SELECT * FROM resume_versions WHERE account_email = ? AND analysis_id = ? ORDER BY created_at DESC, rowid DESC").all(email, analysisId)
    : db.prepare("SELECT * FROM resume_versions WHERE account_email = ? ORDER BY created_at DESC, rowid DESC").all(email);
  return rows.map((row) => ({ ...row, content: readStoredResumeText(row.content) }));
}

export function saveResumeVersion(accountEmail, analysisId, { name, content, job_external_id }) {
  const email = String(accountEmail || "").trim().toLowerCase();
  if (!db.prepare("SELECT id FROM resume_analyses WHERE id = ? AND account_email = ?").get(analysisId, email)) return null;
  const count = db.prepare("SELECT COUNT(*) AS total FROM resume_versions WHERE account_email = ? AND analysis_id = ?").get(email, analysisId).total;
  if (count >= 50) throw Object.assign(new Error("Limite de 50 versões atingido. Remova uma versão antiga para salvar outra."), { statusCode: 409 });
  const tracked = job_external_id ? db.prepare("SELECT id FROM tracked_jobs WHERE account_email = ? AND external_id = ?").get(email, job_external_id) : null;
  if (job_external_id && !tracked) throw Object.assign(new Error("Vaga salva não encontrada."), { statusCode: 404 });
  const version = { id: createEntityId("resume_version"), analysis_id: analysisId, account_email: email, name, content, created_at: new Date().toISOString() };
  // Explicitly saved versions are independent of temporary source-text retention.
  const stored = getResumeTextStorageMode() === "encrypted" ? encryptResumeText(content) : content;
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO resume_versions (id, analysis_id, account_email, name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(version.id, analysisId, email, name, stored, version.created_at);
    if (tracked) db.prepare("UPDATE tracked_jobs SET analysis_id = ?, resume_version_id = ?, updated_at = ? WHERE id = ?")
      .run(analysisId, version.id, version.created_at, tracked.id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return version;
}

export function deleteResumeVersion(accountEmail, analysisId, versionId) {
  return db.prepare("DELETE FROM resume_versions WHERE id = ? AND analysis_id = ? AND account_email = ?")
    .run(versionId, analysisId, String(accountEmail || "").trim().toLowerCase()).changes > 0;
}

export function updateAnalysisJobStage(id, stage) {
  if (!["extract", "analyze", "jobs", "report"].includes(stage)) return;
  db.prepare("UPDATE analysis_jobs SET stage = ?, updated_at = ? WHERE id = ? AND status = 'processing'")
    .run(stage, new Date().toISOString(), id);
}

export function listAnalysisJobsForAccount(accountEmail) {
  return db.prepare("SELECT * FROM analysis_jobs WHERE account_email = ? ORDER BY created_at DESC LIMIT 20")
    .all(String(accountEmail || "").trim().toLowerCase()).map(toApiAnalysisJob);
}

export function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);

  if (!user) {
    return null;
  }

  return toApiUser(user);
}
