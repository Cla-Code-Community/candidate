import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestsTotal } from "../metrics/metrics";

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    // route já resolvido pelo Express (com :params), com fallback pro path cru
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path;

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    end(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
}
