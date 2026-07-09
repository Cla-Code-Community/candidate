import z from "zod";
import {
  DashboardChartPointSchema,
  DashboardStatsSchema,
  ResourceUsageSchema,
} from "./metrics.schemas";
import { ScraperSummarySchema } from "./scraper.schemas";
import { ServiceHealthSchema } from "./service.schemas";

export const DashboardOverviewSchema = z.object({
  stats: DashboardStatsSchema,
  resources: ResourceUsageSchema,
  scrapers: z.array(ScraperSummarySchema),
  services: z.array(ServiceHealthSchema),
  chartPoints: z.array(DashboardChartPointSchema).default([]),
  generatedAt: z.string().optional(),
});

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;
