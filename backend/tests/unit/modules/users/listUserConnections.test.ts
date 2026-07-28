import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindMany: vi.fn(),
  credentialsFindFirst: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    query: {
      accounts: { findMany: mocks.accountsFindMany },
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
  },
}));

import { listUserConnections } from "../../../../src/modules/users/functions/listUserConnections";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listUserConnections", () => {
  it("marca conectados e retorna hasPassword", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    mocks.accountsFindMany.mockResolvedValue([
      { provider: "google", createdAt },
    ]);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-A" });

    const result = await listUserConnections("user-A");

    expect(result.hasPassword).toBe(true);
    expect(result.connections).toEqual([
      { provider: "google", connected: true, connectedAt: createdAt },
      { provider: "linkedin", connected: false, connectedAt: null },
      { provider: "github", connected: false, connectedAt: null },
    ]);
  });
});
