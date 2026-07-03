import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../../../../src/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: mocks.from,
    })),
  },
}));

vi.mock("../../../../src/db/schema/users", () => ({
  users: {
    isBlocked: "isBlocked",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    count: vi.fn(() => "count"),
    eq: vi.fn(() => "isBlocked=false"),
  };
});

import { DashboardRepository } from "../../../../src/modules/admin/dashboard/dashboard.repository";

describe("DashboardRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockResolvedValue([{ value: 12 }]);
    mocks.where.mockResolvedValue([{ value: 8 }]);
  });

  it("counts total users", async () => {
    await expect(new DashboardRepository().countUsers()).resolves.toBe(12);
  });

  it("counts active users as non-blocked users", async () => {
    mocks.from.mockReturnValueOnce({ where: mocks.where });

    await expect(new DashboardRepository().countActiveUsers()).resolves.toBe(8);
    expect(mocks.where).toHaveBeenCalledWith("isBlocked=false");
  });
});
