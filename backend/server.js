import "./src/loadEnv.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import express from "express";
import cors from "cors";

import adminRoutes from "./routes/adminRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import privacyRoutes from "./routes/privacyRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import { requireCsrfProtection } from "./middleware/csrfMiddleware.js";
import { validateRuntimeConfig } from "./src/config.js";
import { checkDatabaseHealth } from "./src/databaseProvider.js";
import { closeDatabase } from "./src/db.js";
import { logger } from "./src/logger.js";

validateRuntimeConfig({ logger });

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = String(
  process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const frontendDistPath = process.env.FRONTEND_DIST_PATH
  ? path.resolve(process.env.FRONTEND_DIST_PATH)
  : path.resolve(__dirname, "..", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const apiRateLimitBuckets = new Map();
const API_RATE_LIMIT_WINDOW_MS = readPositiveInteger(
  process.env.API_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const API_RATE_LIMIT_MAX = readPositiveInteger(
  process.env.API_RATE_LIMIT_MAX,
  300
);
const SHUTDOWN_TIMEOUT_MS = readPositiveInteger(
  process.env.SHUTDOWN_TIMEOUT_MS,
  10 * 1000
);

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getOriginHostname(origin = "") {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getRequestHost(req) {
  return String(req.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function getRequestHostname(req) {
  return getRequestHost(req).split(":")[0];
}

function isLoopbackHostname(hostname = "") {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(hostname || "").toLowerCase());
}

function isAllowedLoopbackDevOrigin(origin, req) {
  return process.env.NODE_ENV !== "production" &&
    isLoopbackHostname(getOriginHostname(origin)) &&
    isLoopbackHostname(getRequestHostname(req));
}

function isSameOrigin(origin, req) {
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.origin === `${req.protocol}://${getRequestHost(req)}`;
  } catch {
    return false;
  }
}

function isAllowedTryCloudflareDevOrigin(origin) {
  const originHostname = getOriginHostname(origin);

  return process.env.NODE_ENV !== "production" &&
    originHostname.endsWith(".trycloudflare.com");
}

function isAllowedOrigin(origin, req) {
  if (!origin || allowedOrigins.includes(origin) || isSameOrigin(origin, req) || isAllowedLoopbackDevOrigin(origin, req) || isAllowedTryCloudflareDevOrigin(origin)) {
    return true;
  }

  return false;
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  return String(ip || req.ip || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function assignRequestId(req, res, next) {
  const incomingRequestId = String(req.get("x-request-id") || "").trim();
  const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

function logRequest(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    if (req.path === "/api/health") {
      return;
    }

    logger.info("http_request", {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      ip: getClientIp(req)
    });
  });

  next();
}

function setSecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  );

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

function apiRateLimit(req, res, next) {
  const now = Date.now();
  const key = getClientIp(req);
  const current = apiRateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    apiRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + API_RATE_LIMIT_WINDOW_MS
    });
    next();
    return;
  }

  current.count += 1;

  if (apiRateLimitBuckets.size > 10000) {
    for (const [bucketKey, bucket] of apiRateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) {
        apiRateLimitBuckets.delete(bucketKey);
      }
    }
  }

  if (current.count > API_RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      error: "Muitas requisicoes. Aguarde alguns minutos antes de tentar novamente.",
      retry_after_seconds: retryAfterSeconds
    });
    return;
  }

  next();
}

app.disable("x-powered-by");
app.use(assignRequestId);
app.use(logRequest);
app.use(setSecurityHeaders);
app.use((req, res, next) => {
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, req)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true
  })(req, res, next);
});
app.use("/api", apiRateLimit);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use("/api", requireCsrfProtection);

app.get(["/api/health", "/api/health/live"], async (req, res, next) => {
  try {
    const database = await checkDatabaseHealth({
      deep: req.query.deep === "1"
    });

    res.json({
      success: true,
      status: "ok",
      database
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health/ready", async (_req, res, next) => {
  try {
    const database = await checkDatabaseHealth({ deep: true });
    const ready = database.ok && database.using_configured_provider;

    res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? "ready" : "not_ready",
      database
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/product", productRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/subscription", subscriptionRoutes);

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(frontendIndexPath);
  });
}

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada"
  });
});

app.use((error, req, res, _next) => {
  logger.error("unhandled_request_error", {
    request_id: req.requestId || "no-request-id",
    method: req.method,
    path: req.originalUrl,
    error
  });

  const requestedStatus = Number(error.statusCode || error.status || 500);
  const status = requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus
    : 500;
  const exposeMessage = status < 500 || process.env.NODE_ENV !== "production";

  res.status(status).json({
    success: false,
    error: exposeMessage
      ? error.message || "Erro interno do servidor"
      : "Erro interno do servidor",
    request_id: req.requestId
  });
});

const PORT = process.env.PORT || 3000;
const isDirectRun = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);

export function startServer(port = PORT) {
  return app.listen(port, () => {
    logger.info("server_started", {
      url: `http://localhost:${port}`
    });
  });
}

export function stopServer(server) {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
    server.closeIdleConnections?.();
  });
}

if (isDirectRun) {
  const server = startServer();
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("server_shutdown_started", { signal });

    const forceExit = setTimeout(() => {
      logger.error("server_shutdown_timeout", { signal });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await stopServer(server);
      closeDatabase();
      clearTimeout(forceExit);
      logger.info("server_shutdown_completed", { signal });
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExit);
      logger.error("server_shutdown_failed", { signal, error });
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export default app;
