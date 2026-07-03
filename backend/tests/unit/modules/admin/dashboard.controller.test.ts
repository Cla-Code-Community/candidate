import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardController } from "../../../../src/modules/admin/dashboard/dashboard.controller";

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
  session: { userId: "support-1", role: "support" },
  headers: {},
  socket: { remoteAddress: "127.0.0.1" },
} as unknown as Request;

describe("DashboardController", () => {
  const service = { getOverview: vi.fn() };
  const auditService = { fromRequest: vi.fn() };
  const controller = new DashboardController(service as any, auditService as any);

  beforeEach(() => {
    vi.clearAllMocks();
    service.getOverview.mockResolvedValue({
      stats: {
        totalUsers: 1,
        activeUsers: 1,
        totalCollectedJobs: 10,
        jobsCollectedToday: 2,
      },
      scrapers: [],
      services: { status: "ok" },
      generatedAt: "2026-07-02T10:00:00.000Z",
    });
  });

  it("returns dashboard overview and audits read", async () => {
    const res = response();

    await controller.getOverview(req, res);

    expect(service.getOverview).toHaveBeenCalled();
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "dashboard.read");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({ totalUsers: 1 }),
      }),
    );
  });

  it("returns 500 when service fails", async () => {
    service.getOverview.mockRejectedValueOnce(new Error("down"));
    const res = response();

    await controller.getOverview(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
