import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";

import analysisRoutes from "./routes/analysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";

const app = express();
const allowedOrigins = String(
  process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origem não permitida pelo CORS."));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok"
  });
});

app.use("/api/analysis", analysisRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/subscription", subscriptionRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada"
  });
});

app.use((error, _req, res, _next) => {
  console.log(error);

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Erro interno do servidor"
  });
});

const PORT = process.env.PORT || 3000;
const isDirectRun = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
