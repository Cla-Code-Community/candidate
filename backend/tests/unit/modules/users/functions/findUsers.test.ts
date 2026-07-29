import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Spies reutilizaveis para o db padrao ─────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findFirstAccounts: vi.fn(),
  findFirstUsers: vi.fn(),
}));

vi.mock("../../../../../src/db/client", () => ({
  db: {
    query: {
      accounts: { findFirst: mocks.findFirstAccounts },
      users: { findFirst: mocks.findFirstUsers },
    },
  },
}));

import {
  findUserByEmail,
  findUserByProvider,
} from "../../../../../src/modules/users/functions/findUsers";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAccount = {
  id: "acc-1",
  userId: "user-1",
  provider: "github",
  providerAccountId: "gh-abc",
};

const mockUser = {
  id: "user-1",
  email: "user@example.com",
  username: "usertest",
};

// ─── Helper: tx inline com findFirst retornando undefined (comportamento Drizzle) ──

function makeTx(
  accountResult: object | undefined,
  userResult: object | undefined,
) {
  return {
    query: {
      accounts: { findFirst: vi.fn().mockResolvedValue(accountResult) },
      users: { findFirst: vi.fn().mockResolvedValue(userResult) },
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// findUserByProvider
// ═════════════════════════════════════════════════════════════════════════════

describe("findUserByProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o usuario quando provider e account existem", async () => {
    const tx = makeTx(mockAccount, mockUser);
    const result = await findUserByProvider(
      { provider: "github", providerAccountId: "gh-abc" },
      tx as any,
    );
    expect(result).toMatchObject(mockUser);
  });

  it("retorna null quando account nao existe", async () => {
    const tx = makeTx(undefined, mockUser);
    const result = await findUserByProvider(
      { provider: "github", providerAccountId: "gh-xyz" },
      tx as any,
    );
    expect(result).toBeNull();
    expect(tx.query.users.findFirst).not.toHaveBeenCalled();
  });

  it("retorna undefined quando account existe mas user nao existe", async () => {
    const tx = makeTx(mockAccount, undefined);
    const result = await findUserByProvider(
      { provider: "github", providerAccountId: "gh-abc" },
      tx as any,
    );
    expect(result).toBeUndefined();
  });

  it("passa os parametros corretos para a query de accounts", async () => {
    const tx = makeTx(undefined, undefined);
    await findUserByProvider(
      { provider: "google", providerAccountId: "g-123" },
      tx as any,
    );
    expect(tx.query.accounts.findFirst).toHaveBeenCalledOnce();
  });

  it("usa o db padrao quando tx nao e fornecido", async () => {
    mocks.findFirstAccounts.mockResolvedValue(undefined);

    const result = await findUserByProvider({
      provider: "github",
      providerAccountId: "gh-abc",
    });

    expect(result).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// findUserByEmail
// ═════════════════════════════════════════════════════════════════════════════

describe("findUserByEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o usuario quando email existe", async () => {
    const tx = makeTx(undefined, mockUser);
    const result = await findUserByEmail("user@example.com", tx as any);
    expect(result).toMatchObject(mockUser);
    expect(result).toHaveProperty("technologyExperiences");
  });

  it("retorna undefined quando email nao existe", async () => {
    const tx = makeTx(undefined, undefined);
    const result = await findUserByEmail("notfound@example.com", tx as any);
    expect(result).toBeUndefined();
  });

  it("passa o email para a query corretamente", async () => {
    const tx = makeTx(undefined, mockUser);
    await findUserByEmail("test@test.com", tx as any);
    expect(tx.query.users.findFirst).toHaveBeenCalledOnce();
  });

  it("usa o db padrao quando tx nao e fornecido", async () => {
    mocks.findFirstUsers.mockResolvedValue(mockUser);

    const result = await findUserByEmail("user@example.com");

    expect(result).toMatchObject(mockUser);
    expect(result).toHaveProperty("technologyExperiences");
  });
});
