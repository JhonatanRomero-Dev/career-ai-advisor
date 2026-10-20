import { logger } from "../src/logger.js";
import { requestAnalysisJobProcessing } from "./analysisController.js";
import { checkDatabaseHealth } from "../src/databaseProvider.js";
import {
  getProductAnalyticsSummary,
  getAdminDashboardData,
  requeueFailedAnalysisJob
} from "../src/db.js";

export async function getAdminDashboard(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);

    return res.json({
      success: true,
      admin: {
        user: req.user,
        database: await checkDatabaseHealth({
          deep: req.query.deep === "1"
        }),
        analytics: getProductAnalyticsSummary({ days: req.query.days || 30 }),
        ...getAdminDashboardData({ limit })
      }
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "adminController", action: "getAdminDashboard" });

    return res.status(500).json({
      success: false,
      error: "Nao foi possivel carregar o painel administrativo."
    });
  }
}

export function retryAnalysisJob(req, res) {
  try {
    const job = requeueFailedAnalysisJob(req.params.jobId);

    if (job === null) {
      return res.status(404).json({
        success: false,
        error: "Job de análise não encontrado."
      });
    }

    if (job === false) {
      return res.status(409).json({
        success: false,
        error: "Apenas jobs com falha podem ser reenfileirados."
      });
    }

    if (job?.unretryable) {
      return res.status(409).json({
        success: false,
        error: job.reason
      });
    }

    requestAnalysisJobProcessing();

    return res.json({
      success: true,
      job
    });
  } catch (error) {
    logger.controllerError("Controller action failed", { error, controller: "adminController", action: "retryAnalysisJob" });

    return res.status(500).json({
      success: false,
      error: "Não foi possível reenfileirar o job."
    });
  }
}
