import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectForUpdate: vi.fn(),
  credentialsFindFirst: vi.fn(),
  deleteWhere: vi.fn(),
}));

// mockTx mirrors what runDisconnect uses inside the transaction:
// tx.select().from().where().for("update")  → resolves to accounts array
// tx.query.credentials.findFirst            → resolves to credential or undefined
// tx.delete().where()                       → called to delete the account row
const mockTx = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: mocks.selectForUpdate,
      })),
    })),
  })),
  query: {
    credentials: { findFirst: mocks.credentialsFindFirst },
  },
  delete: vi.fn(() => ({ where: mocks.deleteWhere })),
};

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    transaction: (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx),
  },
}));

vi.mock("../../../../src/db/schema/index.js", () => ({ accounts: {} }));

import { disconnectProvider } from "../../../../src/modules/users/functions/disconnectProvider";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-wire the chainable select mock after clearAllMocks resets call counts
  // (the implementations are already defined above — just restore them)
  mockTx.select.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: mocks.selectForUpdate,
      })),
    })),
  });
  mockTx.delete.mockReturnValue({ where: mocks.deleteWhere });
});

describe("disconnectProvider", () => {
  it("desconecta quando há outro método (outro provider)", async () => {
    mocks.selectForUpdate.mockResolvedValue([
      { provider: "google" },
      { provider: "github" },
    ]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("desconecta quando há senha como fallback", async () => {
    mocks.selectForUpdate.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-A" });
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("bloqueia quando é o último método", async () => {
    mocks.selectForUpdate.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await expect(
      disconnectProvider({ userId: "user-A", provider: "google" }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });
});
