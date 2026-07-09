import { z } from "zod";
import { RoleSchema, UserSchema } from "../../modules/auth/schemas/auth.schema";

export const BackendUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  role: RoleSchema,
});

export type BackendUser = z.infer<typeof BackendUserSchema>;

export const MeResponseSchema = z.object({
  user: UserSchema,
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);

export const ServiceHealthResponseSchema = z.object({
  status: HealthStatusSchema,
  latencyMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const HealthcheckResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string(),
  services: z.object({
    postgres: ServiceHealthResponseSchema,
    valkey: ServiceHealthResponseSchema,
    scraper: ServiceHealthResponseSchema,
  }),
});

export type HealthcheckResponse = z.infer<typeof HealthcheckResponseSchema>;

export const DashboardOverviewSchema = z.object({
  stats: z.object({
    totalUsers: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
    totalCollectedJobs: z.number().int().nonnegative(),
    jobsCollectedToday: z.number().int().nonnegative(),
  }),
  scrapers: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["running", "idle", "down", "unknown"]),
      running: z.boolean(),
      lastRunAt: z.string().nullable(),
      jobsCollected: z.number().int().nonnegative().nullable(),
    }),
  ),
  services: HealthcheckResponseSchema,
  generatedAt: z.string(),
});

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

export const ScraperSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["running", "idle", "down"]),
  running: z.boolean(),
  lastRunAt: z.string().nullable(),
  jobsCollected: z.number().int().nonnegative().nullable(),
});

export type Scraper = z.infer<typeof ScraperSchema>;

export const ScrapersListResponseSchema = z.object({
  scrapers: z.array(ScraperSchema),
});

export type ScrapersListResponse = z.infer<typeof ScrapersListResponseSchema>;

export const ScraperStatusSchema = z.object({
  name: z.string().optional(),
  running: z.boolean(),
  lastRunAt: z.string().optional(),
  jobsCollected: z.number().int().nonnegative().optional(),
});

export type ScraperStatus = z.infer<typeof ScraperStatusSchema>;

export const ScraperJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  url: z.string(),
  salary: z.string().optional(),
  modality: z.string().optional(),
  description: z.string().optional(),
  postedAt: z.string().optional(),
  source: z.string(),
  sources: z.array(z.string()),
  keyword: z.string(),
  keywords: z.array(z.string()),
});

export type ScraperJob = z.infer<typeof ScraperJobSchema>;

export const ScraperJobsResponseSchema = z.object({
  jobs: z.array(ScraperJobSchema),
  total: z.number().int().nonnegative(),
});

export type ScraperJobsResponse = z.infer<typeof ScraperJobsResponseSchema>;

export const ScraperJobsCountResponseSchema = z.object({
  total: z.number().int().nonnegative(),
});

export type ScraperJobsCountResponse = z.infer<
  typeof ScraperJobsCountResponseSchema
>;

export const AdminUserSchema = z.object({
  id: z.uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(["user", "support", "admin", "super_admin"]),
  isBlocked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().nullable(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUsersListResponseSchema = z.object({
  data: z.array(AdminUserSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type AdminUsersListResponse = z.infer<
  typeof AdminUsersListResponseSchema
>;

export const MetricSnapshotSchema = z.object({
  requestRatePerMinute: z.number().nonnegative().nullable(),
  errorRatePct: z.number().min(0).max(100).nullable(),
  p95LatencyMs: z.number().nonnegative().nullable(),
  cacheHitRatePct: z.number().min(0).max(100).nullable(),
  activeSessionsCount: z.number().int().nonnegative().nullable(),
});

export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

export const ObservabilityPointSchema = z.object({
  timestamp: z.string(),
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
  generatedAt: z.string(),
  dashboards: z.array(ObservabilityDashboardSchema),
});

export type ObservabilityDashboards = z.infer<
  typeof ObservabilityDashboardsSchema
>;
