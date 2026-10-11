import { beforeEach, describe, expect, it, vi } from "vitest";

const seedMocks = vi.hoisted(() => ({
  applicationEventsFindFirst: vi.fn(),
  credentialsFindFirst: vi.fn(),
  poolEnd: vi.fn(),
  savedJobsFindFirst: vi.fn(),
  seedCatalogJobs: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../../src/db/client", () => ({
  db: {
    query: {
      applicationEvents: { findFirst: seedMocks.applicationEventsFindFirst },
      credentials: { findFirst: seedMocks.credentialsFindFirst },
      savedJobs: { findFirst: seedMocks.savedJobsFindFirst },
    },
    update: seedMocks.update,
    insert: seedMocks.insert,
    transaction: seedMocks.transaction,
  },
  pool: { end: seedMocks.poolEnd },
}));

vi.mock("../../../src/scripts/seedCatalogJobs", () => ({
  SEED_DEV_TECHNOLOGIES: [{ name: "Go", years: 3 }],
  seedCatalogJobs: seedMocks.seedCatalogJobs,
}));

const originalArgv = [...process.argv];

describe("seed script", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = [...originalArgv];
    seedMocks.credentialsFindFirst.mockResolvedValue({ userId: "dev-user" });
    seedMocks.savedJobsFindFirst
      .mockResolvedValueOnce({ id: "job-1" })
      .mockResolvedValueOnce({ id: "job-2" })
      .mockResolvedValueOnce({ id: "job-3" });
    seedMocks.applicationEventsFindFirst
      .mockResolvedValueOnce({ id: "event-1" })
      .mockResolvedValueOnce({ id: "event-2" });
    seedMocks.poolEnd.mockResolvedValue(undefined);
    seedMocks.seedCatalogJobs.mockResolvedValue(undefined);
    seedMocks.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  // timeout ampliado: o import dinâmico do script pode levar vários segundos
  // sob a carga da suíte completa (pre-push), estourando o padrão de 5s do vitest.
  it("preserves existing records while refreshing profile and catalog data", async () => {
    const { completion } = await import("../../../src/scripts/seed");
    await completion;

    expect(seedMocks.poolEnd).toHaveBeenCalledOnce();

    expect(seedMocks.credentialsFindFirst).toHaveBeenCalledTimes(2);
    expect(seedMocks.update).toHaveBeenCalledOnce();
    expect(seedMocks.savedJobsFindFirst).toHaveBeenCalledTimes(3);
    expect(seedMocks.applicationEventsFindFirst).toHaveBeenCalledTimes(2);
    expect(seedMocks.insert).not.toHaveBeenCalled();
    expect(seedMocks.transaction).not.toHaveBeenCalled();
    expect(seedMocks.seedCatalogJobs).toHaveBeenCalledOnce();
  }, 30000);
});
