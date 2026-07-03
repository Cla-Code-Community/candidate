import { z } from "zod";

// --- HealthStatus ---
export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// --- ServiceHealth ---
export const ServiceHealthSchema = z.object({
  status: HealthStatusSchema,
  latencyMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

// --- HealthcheckResult ---
export const HealthcheckResultSchema = z.object({
  status: HealthStatusSchema, // status agregado — pior entre todos os serviços
  timestamp: z
    .string()
    .datetime({ message: "Timestamp inválido no formato ISO 8601" }),
  services: z.object({
    postgres: ServiceHealthSchema,
    valkey: ServiceHealthSchema,
    scraper: ServiceHealthSchema,
  }),
});
export type HealthcheckResult = z.infer<typeof HealthcheckResultSchema>;

// --- MetricSnapshot ---
export const MetricSnapshotSchema = z.object({
  requestRatePerMinute: z.number().nonnegative().nullable(),
  errorRatePct: z.number().min(0).max(100).nullable(),
  p95LatencyMs: z.number().nonnegative().nullable(),
  cacheHitRatePct: z.number().min(0).max(100).nullable(),
  activeSessionsCount: z.number().int().nonnegative().nullable(),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

// --- ObservabilityOverview ---
export const ObservabilityOverviewSchema = z.object({
  health: HealthcheckResultSchema,
  metrics: MetricSnapshotSchema,
});
export type ObservabilityOverview = z.infer<typeof ObservabilityOverviewSchema>;
