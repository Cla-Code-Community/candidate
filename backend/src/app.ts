import cors from "cors";
import express from "express";
import { register } from "./metrics/metrics";
import { corsOptions } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { metricsMiddleware } from "./middleware/metrics";
import { requestIdMiddleware } from "./middleware/requestId";
import { requireAuth } from "./middleware/requireAuth";
import { securityHeaders } from "./middleware/securityHeaders";
import { withSession } from "./middleware/withSession";
import { authRoutes } from "./routes/auth.routes";
import { jobsRoutes } from "./routes/jobs.routes";
import { keywordsRoutes } from "./routes/keywords.routes";
import { savedJobsRoutes } from "./routes/savedJobs.routes";
import { userRoutes } from "./routes/users.routes";

export function createJobsApiApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(securityHeaders);
  app.use(cors(corsOptions));
  app.use(requestIdMiddleware);
  app.use(metricsMiddleware);

  //Confia no proxy reverso (nginx) para lidar com HTTPS e IPs reais dos clientes
  app.set("trust proxy", 1);

  app.use("/api/auth", withSession, authRoutes);
  app.use("/api/users", withSession, requireAuth, userRoutes);
  app.use("/api/jobs", withSession, requireAuth, jobsRoutes);
  app.use("/api/keywords", withSession, requireAuth, keywordsRoutes);
  app.use("/api/saved-jobs", withSession, requireAuth, savedJobsRoutes);

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Verifica se a API está online
   *     tags: [System]
   *     responses:
   *       200:
   *         description: API funcionando
   */
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  app.use(errorHandler);

  return app;
}
