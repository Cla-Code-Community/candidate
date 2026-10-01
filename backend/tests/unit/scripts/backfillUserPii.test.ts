import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  credentialsRows: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
  usersRows: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
  selectionIndex: 0,
}));

vi.mock("../../../src/db/client", () => ({
  db: {
    select: databaseMocks.select,
    update: databaseMocks.update,
  },
}));

vi.mock("../../../src/lib/security/encryption", () => ({
  decryptText: vi.fn((value: string) => value.replace("encrypted:", "")),
  encryptText: vi.fn((value: string) => `encrypted:${value}`),
  isEncryptedPayload: vi.fn((value: string) => value.startsWith("encrypted:")),
}));

vi.mock("../../../src/lib/security/normalization", () => ({
  normalizeCpf: vi.fn((value: string) => value.replace(/\D/g, "")),
  normalizeEmail: vi.fn((value: string) => value.trim().toLowerCase()),
}));

vi.mock("../../../src/lib/security/piiPayload", () => ({
  protectCpf: vi.fn((value: string) => ({
    cpfEncrypted: `encrypted:${value.replace(/\D/g, "")}`,
    cpfHash: `hash:${value.replace(/\D/g, "")}`,
  })),
  protectEmail: vi.fn((value: string) => ({
    emailEncrypted: `encrypted:${value.trim().toLowerCase()}`,
    emailHash: `hash:${value.trim().toLowerCase()}`,
  })),
  protectNullableText: vi.fn((value: string) => `encrypted:${value.trim()}`),
}));

vi.mock("../../../src/lib/security/searchableHash", () => ({
  generateSearchableHash: vi.fn((value: string) => `hash:${value}`),
}));

const originalArgv = [...process.argv];

function configureDatabase() {
  databaseMocks.selectionIndex = 0;
  databaseMocks.select.mockImplementation(() => ({
    from: vi.fn(() => {
      const rows = databaseMocks.selectionIndex++ === 0
        ? databaseMocks.usersRows
        : databaseMocks.credentialsRows;
      return Promise.resolve(rows);
    }),
  }));
  databaseMocks.update.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }));
}

describe("backfillUserPii script", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = originalArgv.filter((argument) => argument !== "--write");
    databaseMocks.usersRows = [
      {
        id: "user-1",
        email: "Person@Example.com",
        emailEncrypted: null,
        emailHash: null,
        firstName: "Ada",
        firstNameEncrypted: null,
        lastName: null,
        lastNameEncrypted: null,
        displayName: null,
        displayNameEncrypted: null,
        avatarUrl: null,
        avatarUrlEncrypted: null,
        phone: null,
        phoneEncrypted: null,
        cpf: "123.456.789-00",
        cpfEncrypted: null,
        cpfHash: null,
        technologies: ["Go"],
        technologiesEncrypted: null,
        level: "Senior",
        levelEncrypted: null,
      },
    ];
    databaseMocks.credentialsRows = [
      { id: "credential-1", email: " PERSON@EXAMPLE.COM ", emailHash: null },
    ];
    configureDatabase();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.restoreAllMocks();
  });

  it("reports pending records in dry-run without persisting changes", async () => {
    await import("../../../src/scripts/backfillUserPii");

    await vi.waitFor(() => expect(console.log).toHaveBeenCalledOnce());

    const report = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(report).toEqual({
      mode: "dry-run",
      users: { scanned: 1, pending: 1 },
      credentials: { scanned: 1, pending: 1 },
    });
    expect(databaseMocks.update).not.toHaveBeenCalled();
  });

  it("writes encrypted user fields and normalized credential email with --write", async () => {
    process.argv = [...originalArgv, "--write"];

    await import("../../../src/scripts/backfillUserPii");

    await vi.waitFor(() => expect(console.log).toHaveBeenCalledOnce());

    expect(databaseMocks.update).toHaveBeenCalledTimes(2);
    const userValues = databaseMocks.update.mock.results[0].value.set.mock.calls[0][0];
    const credentialValues = databaseMocks.update.mock.results[1].value.set.mock.calls[0][0];
    expect(userValues).toMatchObject({
      email: null,
      emailEncrypted: "encrypted:person@example.com",
      emailHash: "hash:person@example.com",
      firstName: null,
      firstNameEncrypted: "encrypted:Ada",
      cpf: null,
      cpfEncrypted: "encrypted:12345678900",
      cpfHash: "hash:12345678900",
      technologies: null,
      technologiesEncrypted: 'encrypted:["Go"]',
      level: null,
      levelEncrypted: "encrypted:Senior",
    });
    expect(credentialValues).toMatchObject({
      email: "encrypted:person@example.com",
      emailHash: "hash:person@example.com",
    });
  });
});
