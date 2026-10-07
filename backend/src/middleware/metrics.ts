import type { NextFunction, Request, Response } from "express";
import { httpRequestDuration, httpRequestsTotal } from "../metrics/metrics";

const priorityRoutes = new Set(
  [
    "/jobs/search",
    "/health",
    "/auth/login",
    "/admin/scrapers",
    "/admin/observability",
    "/metrics",
  ].flatMap((route) => [route, `/api/v1${route}`]),
);

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    // Express templates only. Unmatched/auth-short-circuited requests must not
    // expose arbitrary paths, query strings or dynamic IDs.
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : priorityRoutes.has(req.path)
        ? req.path
        : "__unmatched__";

    const labels = {
      method: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
      ].includes(req.method)
        ? req.method
        : "OTHER",
      route,
      status_code: String(res.statusCode),
    };

    end(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
}
