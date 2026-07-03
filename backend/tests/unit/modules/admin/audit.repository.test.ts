import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: vi.fn(),
  selectFrom: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  eq: vi.fn(),
  between: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../../../../src/db/client", () => ({
  db: {
    insert: vi.fn(() => ({ values: mocks.values })),
    select: vi.fn(() => ({ from: mocks.selectFrom })),
  },
}));

vi.mock("../../../../src/db/schema/auditLogs", () => ({
  auditLogs: {
    actorId: "actorId",
    actorRole: "actorRole",
    action: "action",
    targetType: "targetType",
    targetId: "targetId",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: mocks.eq,
    between: mocks.between,
    and: mocks.and,
    count: vi.fn(() => "count"),
    desc: vi.fn(() => "createdAt desc"),
  };
});

import { AuditRepository } from "../../../../src/modules/admin/audit/audit.repository";

describe("AuditRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values.mockResolvedValue(undefined);
    mocks.eq.mockImplementation((column, value) => `${column}=${value}`);
    mocks.between.mockReturnValue("between-createdAt");
    mocks.and.mockImplementation((...conditions) => conditions.join(" AND "));

    mocks.offset.mockResolvedValue([{ id: 1, action: "audit.read" }]);
    mocks.limit.mockReturnValue({ offset: mocks.offset });
    mocks.orderBy.mockReturnValue({ limit: mocks.limit });
    mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
    mocks.selectFrom
      .mockReturnValueOnce({ where: mocks.where })
      .mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      });
  });

  it("writes audit log values", async () => {
    await new AuditRepository().write({
      actorId: "admin-1",
      actorRole: "admin",
      action: "audit.read",
      targetType: "audit",
      targetId: "log-1",
      metadata: { ok: true },
      ip: "127.0.0.1",
    });

    expect(mocks.values).toHaveBeenCalledWith({
      actorId: "admin-1",
      actorRole: "admin",
      action: "audit.read",
      targetType: "audit",
      targetId: "log-1",
      metadata: { ok: true },
      ip: "127.0.0.1",
    });
  });

  it("finds paginated logs with filters", async () => {
    const result = await new AuditRepository().findMany({
      actorId: "admin-1",
      action: "audit.read",
      targetType: "audit",
      targetId: "log-1",
      from: new Date("2026-07-01"),
      to: new Date("2026-07-02"),
      limit: 10,
      offset: 5,
    });

    expect(mocks.eq).toHaveBeenCalledWith("actorId", "admin-1");
    expect(mocks.between).toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(10);
    expect(mocks.offset).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      data: [{ id: 1, action: "audit.read" }],
      total: 1,
      limit: 10,
      offset: 5,
    });
  });
});
