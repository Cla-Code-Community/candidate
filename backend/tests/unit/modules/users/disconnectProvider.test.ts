import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindMany: vi.fn(),
  credentialsFindFirst: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    query: {
      accounts: { findMany: mocks.accountsFindMany },
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
    delete: vi.fn(() => ({ where: mocks.deleteWhere })),
  },
}));

vi.mock("../../../../src/db/schema/index.js", () => ({ accounts: {} }));

import { disconnectProvider } from "../../../../src/modules/users/functions/disconnectProvider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("disconnectProvider", () => {
  it("desconecta quando há outro método (outro provider)", async () => {
    mocks.accountsFindMany.mockResolvedValue([
      { provider: "google" },
      { provider: "github" },
    ]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("desconecta quando há senha como fallback", async () => {
    mocks.accountsFindMany.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-A" });
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("bloqueia quando é o último método", async () => {
    mocks.accountsFindMany.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await expect(
      disconnectProvider({ userId: "user-A", provider: "google" }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });
});
