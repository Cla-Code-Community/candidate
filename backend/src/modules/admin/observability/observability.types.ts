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

export const ObservabilityPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number().nullable(),
});
export type ObservabilityPoint = z.infer<typeof ObservabilityPointSchema>;

export const ObservabilitySeriesSchema = z.object({
  label: z.string(),
  points: z.array(ObservabilityPointSchema),
});
export type ObservabilitySeries = z.infer<typeof ObservabilitySeriesSchema>;

export const ObservabilityPanelSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  unit: z.enum(["none", "percent", "ms", "bytes", "seconds", "count"]),
  visualization: z.enum(["stat", "line"]),
  series: z.array(ObservabilitySeriesSchema),
});
export type ObservabilityPanel = z.infer<typeof ObservabilityPanelSchema>;

export const ObservabilityDashboardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  panels: z.array(ObservabilityPanelSchema),
});
export type ObservabilityDashboard = z.infer<
  typeof ObservabilityDashboardSchema
>;

export const ObservabilityDashboardsSchema = z.object({
  range: z.string(),
  step: z.string(),
  generatedAt: z.string().datetime(),
  dashboards: z.array(ObservabilityDashboardSchema),
});
export type ObservabilityDashboards = z.infer<
  typeof ObservabilityDashboardsSchema
>;

// --- ObservabilityOverview ---
export const ObservabilityOverviewSchema = z.object({
  health: HealthcheckResultSchema,
  metrics: MetricSnapshotSchema,
});
export type ObservabilityOverview = z.infer<typeof ObservabilityOverviewSchema>;
