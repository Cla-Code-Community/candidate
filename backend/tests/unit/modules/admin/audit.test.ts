import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditController } from "../../../../src/modules/admin/audit/audit.controller";
import { AuditService } from "../../../../src/modules/admin/audit/audit.service";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function request(input: Partial<Request> = {}) {
  return {
    query: {},
    session: { userId: "admin-1", role: "admin" },
    headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    socket: { remoteAddress: "127.0.0.1" },
    ...input,
  } as unknown as Request;
}

describe("AuditService", () => {
  const repository = {
    write: vi.fn(),
    findMany: vi.fn(),
  };
  const service = new AuditService(repository as any);

  beforeEach(() => {
    vi.clearAllMocks();
    repository.write.mockResolvedValue(undefined);
    repository.findMany.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it("writes audit logs without awaiting repository failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    repository.write.mockRejectedValueOnce(new Error("db down"));

    await service.log({
      actorId: "admin-1",
      actorRole: "admin",
      action: "audit.read",
    });
    await Promise.resolve();

    expect(repository.write).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("builds audit input from request", () => {
    service.fromRequest(
      request(),
      "users.change_role",
      { type: "users", id: "user-1" },
      { newRole: "admin" },
    );

    expect(repository.write).toHaveBeenCalledWith({
      actorId: "admin-1",
      actorRole: "admin",
      action: "users.change_role",
      targetType: "users",
      targetId: "user-1",
      metadata: { newRole: "admin" },
      ip: "10.0.0.1",
    });
  });

  it("uses socket address when forwarded header is absent", () => {
    service.fromRequest(
      request({ headers: {}, socket: { remoteAddress: "127.0.0.2" } as any }),
      "dashboard.read",
    );

    expect(repository.write).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "127.0.0.2" }),
    );
  });

  it("does not log when actor is missing", () => {
    service.fromRequest(request({ session: {} as any }), "audit.read");

    expect(repository.write).not.toHaveBeenCalled();
  });

  it("delegates getLogs to repository", async () => {
    await service.getLogs({ actorId: "admin-1" });

    expect(repository.findMany).toHaveBeenCalledWith({ actorId: "admin-1" });
  });
});

describe("AuditController", () => {
  const service = {
    getLogs: vi.fn(),
    fromRequest: vi.fn(),
  };
  const controller = new AuditController(service as any);

  beforeEach(() => {
    vi.clearAllMocks();
    service.getLogs.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it("returns logs with parsed filters and audits the read", async () => {
    const req = request({
      query: {
        actorId: "00000000-0000-4000-8000-000000000001",
        action: "users.block",
        targetType: "users",
        targetId: "user-1",
        from: "2026-07-01",
        to: "2026-07-02",
        limit: "20",
      },
    });
    const res = response();

    await controller.getLogs(req, res);

    expect(service.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "00000000-0000-4000-8000-000000000001",
        action: "users.block",
        targetType: "users",
        targetId: "user-1",
        limit: 20,
        offset: 0,
      }),
    );
    expect(service.fromRequest).toHaveBeenCalledWith(req, "audit.read");
    expect(res.json).toHaveBeenCalledWith({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it("returns 400 for invalid query and 500 for service failures", async () => {
    const invalidRes = response();
    await controller.getLogs(request({ query: { actorId: "invalid" } }), invalidRes);
    expect(invalidRes.status).toHaveBeenCalledWith(400);

    service.getLogs.mockRejectedValueOnce(new Error("db down"));
    const errorRes = response();
    await controller.getLogs(request(), errorRes);
    expect(errorRes.status).toHaveBeenCalledWith(500);
  });
});
