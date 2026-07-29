import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dataWhere: vi.fn(),
  totalWhere: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  returning: vi.fn(),
  deleteWhere: vi.fn(),
  usersFindFirst: vi.fn(),
  credentialsFindFirst: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("argon2", () => ({
  argon2id: 2,
  hash: mocks.hash,
}));

vi.mock("../../../../src/db/client", () => ({
  db: {
    query: {
      users: { findFirst: mocks.usersFindFirst },
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
    select: vi.fn(() => ({ from: vi.fn() })),
    update: vi.fn(() => ({ set: mocks.updateSet })),
    delete: vi.fn(() => ({ where: mocks.deleteWhere })),
  },
}));

vi.mock("../../../../src/db/schema/users", () => ({
  users: {
    id: "users.id",
    role: "users.role",
    isBlocked: "users.isBlocked",
    email: "users.email",
    username: "users.username",
    displayName: "users.displayName",
  },
}));

vi.mock("../../../../src/db/schema/credentials", () => ({
  credentials: {
    userId: "credentials.userId",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...conditions) => conditions.join(" AND ")),
    count: vi.fn(() => "count"),
    eq: vi.fn((column, value) => `${column}=${value}`),
    ilike: vi.fn((column, value) => `${column} ILIKE ${value}`),
    or: vi.fn((...conditions) => conditions.join(" OR ")),
  };
});

import { db } from "../../../../src/db/client";
import { AdminUsersRepository } from "../../../../src/modules/admin/users/adminUsers.repository";

describe("AdminUsersRepository", () => {
  const user = {
    id: "user-1",
    email: "user@example.com",
    username: "user",
    role: "user",
    isBlocked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.offset.mockResolvedValue([user]);
    mocks.limit.mockReturnValue({ offset: mocks.offset });
    mocks.dataWhere.mockReturnValue({ limit: mocks.limit });
    mocks.totalWhere.mockResolvedValue([{ value: 1 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: mocks.dataWhere })) } as any)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: mocks.totalWhere })) } as any);

    mocks.usersFindFirst.mockResolvedValue(user);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-1" });
    mocks.hash.mockResolvedValue("hashed-password");
    mocks.returning.mockResolvedValue([user]);
    mocks.updateWhere.mockReturnValue({ returning: mocks.returning });
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.deleteWhere.mockReturnValue({ returning: mocks.returning });
  });

  it("finds many users with filters and pagination", async () => {
    const result = await new AdminUsersRepository().findMany({
      search: "hudson",
      role: "admin",
      isBlocked: false,
      limit: 10,
      offset: 5,
    });

    expect(mocks.limit).toHaveBeenCalledWith(10);
    expect(mocks.offset).toHaveBeenCalledWith(5);
    expect(result).toMatchObject({
      data: [expect.objectContaining(user)],
      total: 1,
      limit: 10,
      offset: 5,
    });
    expect(result.data[0]).toHaveProperty("technologyExperiences");
  });

  it("finds many users with default filters", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: mocks.dataWhere })) } as any)
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: mocks.totalWhere })) } as any);

    const result = await new AdminUsersRepository().findMany({});

    expect(mocks.limit).toHaveBeenCalledWith(50);
    expect(mocks.offset).toHaveBeenCalledWith(0);
    expect(result).toMatchObject({
      data: [expect.objectContaining(user)],
      total: 1,
      limit: 50,
      offset: 0,
    });
    expect(result.data[0]).toHaveProperty("technologyExperiences");
  });

  it("finds user by id", async () => {
    const result = await new AdminUsersRepository().findById("user-1");

    expect(result).toMatchObject(user);
    expect(result).toHaveProperty("technologyExperiences");
  });

  it("updates blocked state and role", async () => {
    const repository = new AdminUsersRepository();

    await repository.setBlocked("user-1", true);
    await repository.changeRole({ userId: "user-1", newRole: "admin" });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ isBlocked: true }),
    );
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin" }),
    );
  });

  it("returns null when update operations affect no rows", async () => {
    const repository = new AdminUsersRepository();

    mocks.returning.mockResolvedValueOnce([]);
    await expect(repository.setBlocked("missing", true)).resolves.toBeNull();

    mocks.returning.mockResolvedValueOnce([]);
    await expect(
      repository.changeRole({ userId: "missing", newRole: "admin" }),
    ).resolves.toBeNull();
  });

  it("resets password when credential exists", async () => {
    await new AdminUsersRepository().resetPassword({
      userId: "user-1",
      newPassword: "Senha@123",
    });

    expect(mocks.hash).toHaveBeenCalledWith("Senha@123", expect.any(Object));
    expect(mocks.updateSet).toHaveBeenCalledWith({ passwordHash: "hashed-password" });
  });

  it("throws when credential is missing", async () => {
    mocks.credentialsFindFirst.mockResolvedValueOnce(null);

    await expect(
      new AdminUsersRepository().resetPassword({
        userId: "user-1",
        newPassword: "Senha@123",
      }),
    ).rejects.toThrow("Credencial não encontrada");
  });

  it("deletes user", async () => {
    const result = await new AdminUsersRepository().delete("user-1");

    expect(result).toMatchObject(user);
    expect(result).toHaveProperty("technologyExperiences");
  });

  it("returns null when deleting affects no rows", async () => {
    mocks.returning.mockResolvedValueOnce([]);

    await expect(new AdminUsersRepository().delete("missing")).resolves.toBeNull();
  });
});
