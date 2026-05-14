import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "career-ai.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS resume_analyses (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_url TEXT,
    email TEXT,
    phone TEXT,
    area TEXT,
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
    email_verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );
`);

const createId = () =>
  `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const createEntityId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const stringify = (value) => JSON.stringify(value || []);

const parseJson = (value, fallback = []) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const toApiAnalysis = (row) => ({
  id: row.id,
  file_name: row.file_name,
  file_url: row.file_url,
  created_date: row.created_at,
  updated_date: row.updated_at,
  status: row.status,
  parsed_data: {
    email: row.email,
    phone: row.phone,
    area: row.area
  },
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
      email,
      phone,
      area,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    analysis.fileName,
    analysis.filePath || null,
    analysis.fileUrl || null,
    analysis.email || null,
    analysis.phone || null,
    analysis.area || null,
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

export function listResumeAnalyses(limit = 50) {
  const rows = db
    .prepare("SELECT * FROM resume_analyses ORDER BY created_at DESC LIMIT ?")
    .all(limit);

  return rows.map(toApiAnalysis);
}

export function getResumeAnalysisById(id) {
  const row = db
    .prepare("SELECT * FROM resume_analyses WHERE id = ?")
    .get(id);

  return row ? toApiAnalysis(row) : null;
}

export function saveEmailVerificationCode(email, code, expiresAt) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

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
    code,
    expiresAt,
    now
  );
}

export function verifyEmailCode(email, code) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  const row = db.prepare(`
    SELECT *
    FROM email_verification_codes
    WHERE email = ?
      AND code = ?
      AND used_at IS NULL
      AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(normalizedEmail, code, now);

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

  const name = email.split("@")[0] || "Usuario";

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

export function getUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified_at: user.email_verified_at,
    created_date: user.created_at
  };
}
