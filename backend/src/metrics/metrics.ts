import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const activeSessions = new client.Gauge({
  name: "active_sessions",
  help: "Sessões ativas (aproximação por requisições autenticadas recentes)",
  registers: [register],
});

export const jobSearchesTotal = new client.Counter({
  name: "job_searches_total",
  help: "Total de buscas de vagas realizadas",
  labelNames: ["has_keywords"],
  registers: [register],
});

export const cacheOperationsTotal = new client.Counter({
  name: "cache_operations_total",
  help: "Operações de cache no Valkey",
  labelNames: ["operation", "result"],
  registers: [register],
});
