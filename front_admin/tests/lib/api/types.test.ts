import { describe, expect, it } from "vitest";
import {
  AdminUserSchema,
  HealthcheckResponseSchema,
  MetricSnapshotSchema,
  ObservabilityDashboardsSchema,
  ScraperJobSchema,
  ScrapersListResponseSchema,
} from "../../../src/lib/api/types";

describe("api type schemas", () => {
  it("validates healthcheck and metric snapshots", () => {
    expect(
      HealthcheckResponseSchema.parse({
        status: "degraded",
        timestamp: "2026-01-01T00:00:00.000Z",
        services: {
          postgres: { status: "ok", latencyMs: 10 },
          valkey: { status: "degraded", error: "slow" },
          scraper: { status: "down" },
        },
      }).services.postgres.latencyMs,
    ).toBe(10);

    expect(
      MetricSnapshotSchema.parse({
        requestRatePerMinute: 12.4,
        errorRatePct: null,
        p95LatencyMs: 80,
        cacheHitRatePct: 95,
        activeSessionsCount: 4,
      }).cacheHitRatePct,
    ).toBe(95);
  });

  it("validates scraper and user payloads", () => {
    expect(
      ScrapersListResponseSchema.parse({
        scrapers: [
          {
            name: "Adzuna",
            status: "idle",
            running: false,
            lastRunAt: null,
            jobsCollected: null,
          },
        ],
      }).scrapers[0].name,
    ).toBe("Adzuna");

    expect(
      ScraperJobSchema.parse({
        id: "job1",
        title: "Dev",
        company: "Cand",
        location: "BR",
        url: "https://example.com",
        source: "Lever",
        sources: ["Lever"],
        keyword: "react",
        keywords: ["react"],
      }).source,
    ).toBe("Lever");

    expect(
      AdminUserSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        firstName: null,
        lastName: null,
        displayName: "Admin",
        username: "admin",
        email: "admin@example.com",
        avatarUrl: null,
        role: "super_admin",
        isBlocked: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastLoginAt: null,
      }).role,
    ).toBe("super_admin");
  });

  it("validates observability dashboard payloads", () => {
    expect(
      ObservabilityDashboardsSchema.parse({
        range: "1h",
        step: "1m",
        generatedAt: "2026-01-01T00:00:00.000Z",
        dashboards: [
          {
            id: "http",
            title: "HTTP",
            description: "Requests",
            panels: [
              {
                id: "rate",
                title: "Rate",
                unit: "count",
                visualization: "line",
                series: [
                  {
                    label: "GET",
                    points: [{ timestamp: "2026-01-01", value: 1 }],
                  },
                ],
              },
            ],
          },
        ],
      }).dashboards[0].panels[0].series[0].points[0].value,
    ).toBe(1);
  });
});
