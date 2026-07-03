import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthService } from "../../../../src/modules/admin/observability/health.service";
import { MetricsService } from "../../../../src/modules/admin/observability/metrics.service";
import { ObservabilityController } from "../../../../src/modules/admin/observability/observability.controller";
import { ObservabilityService } from "../../../../src/modules/admin/observability/observability.service";

const mocks = vi.hoisted(() => ({
  dbLimit: vi.fn(),
  cachePing: vi.fn(),
}));

vi.mock("../../../../src/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        limit: mocks.dbLimit,
      })),
    })),
  },
}));

vi.mock("../../../../src/db/schema/users", () => ({
  users: {},
}));

vi.mock("../../../../src/lib/cache", () => ({
  cachePing: mocks.cachePing,
}));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const req = {
  session: { userId: "admin-1", role: "admin" },
  headers: {},
  socket: { remoteAddress: "127.0.0.1" },
} as unknown as Request;

describe("ObservabilityService", () => {
  it("delegates health, metrics and overview", async () => {
    const health = { status: "ok", services: {}, timestamp: "now" };
    const metrics = { requestRatePerMinute: 10 };
    const healthService = { getHealthcheck: vi.fn().mockResolvedValue(health) };
    const metricsService = { getSnapshot: vi.fn().mockResolvedValue(metrics) };
    const service = new ObservabilityService(healthService as any, metricsService as any);

    await expect(service.getHealth()).resolves.toBe(health);
    await expect(service.getMetrics()).resolves.toBe(metrics);
    await expect(service.getOverview()).resolves.toEqual({ health, metrics });
  });
});

describe("ObservabilityController", () => {
  const service = {
    getHealth: vi.fn(),
    getMetrics: vi.fn(),
    getOverview: vi.fn(),
  };
  const auditService = { fromRequest: vi.fn() };
  const controller = new ObservabilityController(service as any, auditService as any);

  beforeEach(() => {
    vi.clearAllMocks();
    service.getHealth.mockResolvedValue({ status: "ok" });
    service.getMetrics.mockResolvedValue({ requestRatePerMinute: 1 });
    service.getOverview.mockResolvedValue({ health: { status: "ok" }, metrics: {} });
  });

  it("returns health with aggregate http status", async () => {
    const res = response();
    await controller.getHealth(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    service.getHealth.mockResolvedValueOnce({ status: "degraded" });
    const degradedRes = response();
    await controller.getHealth(req, degradedRes);
    expect(degradedRes.status).toHaveBeenCalledWith(207);

    service.getHealth.mockResolvedValueOnce({ status: "down" });
    const downRes = response();
    await controller.getHealth(req, downRes);
    expect(downRes.status).toHaveBeenCalledWith(503);
  });

  it("returns metrics and overview, auditing each action", async () => {
    await controller.getMetrics(req, response());
    await controller.getOverview(req, response());

    expect(auditService.fromRequest).toHaveBeenCalledWith(
      req,
      "observability.metrics",
    );
    expect(auditService.fromRequest).toHaveBeenCalledWith(
      req,
      "observability.overview",
    );
  });

  it("returns 500 when service throws", async () => {
    service.getMetrics.mockRejectedValueOnce(new Error("boom"));
    const res = response();

    await controller.getMetrics(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 when health or overview throw", async () => {
    service.getHealth.mockRejectedValueOnce(new Error("boom"));
    const healthRes = response();
    await controller.getHealth(req, healthRes);
    expect(healthRes.status).toHaveBeenCalledWith(500);

    service.getOverview.mockRejectedValueOnce(new Error("boom"));
    const overviewRes = response();
    await controller.getOverview(req, overviewRes);
    expect(overviewRes.status).toHaveBeenCalledWith(500);
  });
});

describe("HealthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbLimit.mockResolvedValue([{ id: "user-1" }]);
    mocks.cachePing.mockResolvedValue("PONG");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
  });

  it("returns ok when all critical services are healthy", async () => {
    const result = await new HealthService().getHealthcheck();

    expect(result.status).toBe("ok");
    expect(result.services.postgres.status).toBe("ok");
    expect(result.services.valkey.status).toBe("ok");
    expect(result.services.scraper.status).toBe("ok");
  });

  it("returns degraded for non-ok scraper response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    const result = await new HealthService().getHealthcheck();

    expect(result.status).toBe("degraded");
    expect(result.services.scraper.error).toBe("HTTP 503");
  });

  it("returns down when postgres, valkey or scraper throws", async () => {
    mocks.dbLimit.mockRejectedValueOnce(new Error("pg down"));
    mocks.cachePing.mockRejectedValueOnce(new Error("cache down"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("scraper down")));

    const result = await new HealthService().getHealthcheck();

    expect(result.status).toBe("down");
    expect(result.services.postgres.status).toBe("down");
    expect(result.services.valkey.status).toBe("down");
    expect(result.services.scraper.status).toBe("down");
  });

  it("uses fallback error messages for non-Error health failures", async () => {
    mocks.dbLimit.mockRejectedValueOnce("pg down");
    mocks.cachePing.mockRejectedValueOnce("cache down");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("scraper down"));

    const result = await new HealthService().getHealthcheck();

    expect(result.services.postgres.error).toBe("Unknown error");
    expect(result.services.valkey.error).toBe("Unknown error");
    expect(result.services.scraper.error).toBe("Unknown error");
  });
});

describe("MetricsService", () => {
  it("returns rounded prometheus metrics", async () => {
    const values = ["12.4", "3.456", "99.9", "80.123", "7.8"];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "success",
              data: { result: [{ value: [0, values.shift()] }] },
            }),
        }),
      ),
    );

    const result = await new MetricsService().getSnapshot();

    expect(result).toEqual({
      requestRatePerMinute: 12,
      errorRatePct: 3.46,
      p95LatencyMs: 100,
      cacheHitRatePct: 80.12,
      activeSessionsCount: 8,
    });
  });

  it("returns null metrics when prometheus queries fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await new MetricsService().getSnapshot();

    expect(result).toEqual({
      requestRatePerMinute: null,
      errorRatePct: null,
      p95LatencyMs: null,
      cacheHitRatePct: null,
      activeSessionsCount: null,
    });
  });

  it("returns null metrics when prometheus json parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("invalid json")),
      }),
    );

    const result = await new MetricsService().getSnapshot();

    expect(result.requestRatePerMinute).toBeNull();
    expect(result.errorRatePct).toBeNull();
    expect(result.p95LatencyMs).toBeNull();
    expect(result.cacheHitRatePct).toBeNull();
    expect(result.activeSessionsCount).toBeNull();
  });
});
