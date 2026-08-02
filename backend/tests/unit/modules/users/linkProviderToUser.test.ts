import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindFirst: vi.fn(),
  createAccount: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: { query: { accounts: { findFirst: mocks.accountsFindFirst } } },
}));

vi.mock("../../../../src/modules/users/functions/createAccount.js", () => ({
  createAccount: mocks.createAccount,
}));

import { linkProviderToUser } from "../../../../src/modules/users/functions/linkProviderToUser";

const profile = { id: "prov-123", email: "a@a.com" } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("linkProviderToUser", () => {
  it("cria account quando provider não está vinculado", async () => {
    mocks.accountsFindFirst.mockResolvedValue(undefined);
    await linkProviderToUser({ userId: "user-A", provider: "google", profile });
    expect(mocks.createAccount).toHaveBeenCalledWith(
      { userId: "user-A", provider: "google", profile },
      expect.anything(),
    );
  });

  it("é idempotente quando já vinculado ao mesmo usuário", async () => {
    mocks.accountsFindFirst.mockResolvedValue({ userId: "user-A" });
    await linkProviderToUser({ userId: "user-A", provider: "google", profile });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("lança conflito quando vinculado a outro usuário", async () => {
    mocks.accountsFindFirst.mockResolvedValue({ userId: "user-B" });
    await expect(
      linkProviderToUser({ userId: "user-A", provider: "google", profile }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });
});
