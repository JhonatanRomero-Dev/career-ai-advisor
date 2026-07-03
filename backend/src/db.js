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
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

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
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasPasswordHashColumn = userColumns.some((column) => column.name === "password_hash");

if (!hasPasswordHashColumn) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
}

const analysisColumns = db.prepare("PRAGMA table_info(resume_analyses)").all();
const hasAccountEmailColumn = analysisColumns.some((column) => column.name === "account_email");

if (!hasAccountEmailColumn) {
  db.exec("ALTER TABLE resume_analyses ADD COLUMN account_email TEXT");
}

const analysisColumnNames = new Set(analysisColumns.map((column) => column.name));

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

const notificationColumns = db.prepare("PRAGMA table_info(job_notifications)").all();
const hasNotificationAccountEmailColumn = notificationColumns.some((column) => column.name === "account_email");

if (!hasNotificationAccountEmailColumn) {
  db.exec("ALTER TABLE job_notifications ADD COLUMN account_email TEXT");
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
  recommended_jobs: parseJson(row.recommended_jobs)
});

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
    analysis.resumeText || null,
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
    resume_text: row.resume_text || ""
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
  db.prepare("DELETE FROM resume_analyses WHERE id = ? AND account_email = ?").run(id, normalizedEmail);

  return {
    analysis: toApiAnalysis(row),
    filePath: row.file_path || null
  };
}

export function createJobNotificationForAnalysis(analysis) {
  const compatibleJobs = (analysis.recommended_jobs || [])
    .filter((job) => normalizeJobMatch(job) >= 70)
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
    return {
      plan: existing.plan,
      status: existing.status,
      source: existing.source,
      updated_date: existing.updated_at
    };
  }

  db.prepare(`
    INSERT INTO user_subscriptions (
      user_id,
      plan,
      status,
      source,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, "Gratis", "active", "system", now, now);

  return {
    plan: "Gratis",
    status: "active",
    source: "system",
    updated_date: now
  };
}

export function updateUserSubscription(userId, plan, source = "demo") {
  const safePlan = String(plan || "Gratis").trim();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO user_subscriptions (
      user_id,
      plan,
      status,
      source,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(userId, safePlan, "active", source, now, now);

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

  return toApiProfile(row, user);
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

function toApiUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified_at: user.email_verified_at,
    created_date: user.created_at
  };
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
