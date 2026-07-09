import { describe, expect, it } from "vitest";
import {
  DashboardChartPointSchema,
  DashboardOverviewSchema,
  DashboardStatsSchema,
  ResourceUsageSchema,
  ScraperSummarySchema,
  ServiceHealthSchema,
} from "../../../../src/modules/dashboard/schemas";

describe("dashboard schemas", () => {
  it("validates dashboard overview and defaults chart points", () => {
    const stats = DashboardStatsSchema.parse({
      totalUsers: { value: 10, trend: "up", positive: true },
      activeUsers: { value: 8, trend: "stable", positive: true },
      totalJobs: { value: 123, trend: "up", positive: true },
      jobsToday: { value: 7, trend: "today", positive: false },
    });
    const resources = ResourceUsageSchema.parse({
      scraper: 99,
      postgres: 65,
      valkey: 0,
    });

    const parsed = DashboardOverviewSchema.parse({
      stats,
      resources,
      scrapers: [
        ScraperSummarySchema.parse({
          id: "adzuna",
          name: "Adzuna",
          status: "Online",
          lastRun: "Hoje",
          collected24h: 12,
          active: true,
        }),
      ],
      services: [
        ServiceHealthSchema.parse({
          name: "Postgres",
          status: "Online",
          sla: "10ms",
          health: 99,
          tone: "success",
        }),
      ],
    });

    expect(parsed.chartPoints).toEqual([]);
    expect(parsed.resources.postgres).toBe(65);
  });

  it("rejects invalid chart and service values", () => {
    expect(() =>
      DashboardChartPointSchema.parse({
        timestamp: "now",
        label: "agora",
        totalJobs: -1,
        activeUsers: 1,
      }),
    ).toThrow();

    expect(() =>
      ServiceHealthSchema.parse({
        name: "Valkey",
        status: "Online",
        sla: "ok",
        health: 120,
        tone: "success",
      }),
    ).toThrow();
  });
});
