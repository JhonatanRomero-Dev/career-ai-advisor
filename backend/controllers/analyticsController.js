import crypto from "crypto";

import { getUserBySessionToken, recordProductEvent } from "../src/db.js";
import { getSessionToken } from "../middleware/authMiddleware.js";

const ALLOWED_EVENTS = new Set([
  "app_opened", "signup_started", "signup_completed", "login_completed",
  "resume_upload_started", "resume_upload_completed", "resume_upload_failed",
  "analysis_viewed", "job_list_viewed", "job_saved", "job_opened",
  "job_status_changed", "checkout_started", "checkout_redirected",
  "subscription_activated", "subscription_canceled", "filter_applied",
  "resume_editor_opened", "resume_revision_applied", "resume_version_saved", "resume_exported",
  "job_adaptation_started", "application_updated"
]);

const ALLOWED_PROPERTIES = new Set([
  "route", "plan", "source", "status", "device_class", "job_source",
  "match_band", "error_code", "has_target_job", "result_count", "format"
]);

function sanitizeProperties(input = {}) {
  const output = {};

  for (const [key, value] of Object.entries(input || {})) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    output[key] = typeof value === "string" ? value.slice(0, 80) : value;
  }

  return output;
}

function hashUserId(userId) {
  if (!userId) return "";
  const secret = process.env.ANALYTICS_HASH_SECRET || process.env.AUTH_CODE_SECRET;
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(String(userId)).digest("hex");
}

export function ingestProductEvent(req, res) {
  const eventName = String(req.body?.event_name || "").trim();

  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ success: false, error: "Evento de analytics invalido." });
  }

  const anonymousId = String(req.body?.anonymous_id || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(anonymousId)) {
    return res.status(400).json({ success: false, error: "Identificador anonimo invalido." });
  }

  const token = getSessionToken(req);
  const user = token ? getUserBySessionToken(token) : null;
  const occurredAt = new Date(req.body?.occurred_at || Date.now());
  const safeOccurredAt = Number.isFinite(occurredAt.getTime()) &&
    Math.abs(Date.now() - occurredAt.getTime()) <= 86400000
    ? occurredAt.toISOString()
    : new Date().toISOString();

  const event = recordProductEvent({
    anonymousId,
    userHash: hashUserId(user?.id),
    eventName,
    properties: sanitizeProperties(req.body?.properties),
    occurredAt: safeOccurredAt
  });

  return res.status(202).json({ success: true, event_id: event.id });
}
