import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findUserByProvider: vi.fn(),
  findUserByEmail: vi.fn(),
  generateUsername: vi.fn(),
  dbTransaction: vi.fn(),
  // Mocks isolados que usaremos de forma cirúrgica para o findOrCreateUser
  createUserMock: vi.fn(),
  createAccountMock: vi.fn(),
}));

// ─── Mock: db client ──────────────────────────────────────────────────────────

vi.mock("../../../../../src/db/client", () => ({
  db: {
    transaction: mocks.dbTransaction,
    insert: vi.fn(),
  },
}));

// ─── Mock: Funções utilitárias internas ────────────────────────────────────────

vi.mock("../../../../../src/utils/generateUsername", () => ({
  generateUsername: mocks.generateUsername,
}));

vi.mock("../../../../../src/modules/users/functions/findUsers", () => ({
  findUserByProvider: mocks.findUserByProvider,
  findUserByEmail: mocks.findUserByEmail,
}));

// ─── Mock Parcial Dinâmico com a Sua Lógica de Roteamento Estrita ─────────────

vi.mock(
  "../../../../../src/modules/users/functions/createUser",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../../../src/modules/users/functions/createUser")
      >();
    return {
      ...actual,
      createUser: vi.fn((params, tx, options) => {
        const impl = mocks.createUserMock.getMockImplementation();
        if (impl) return mocks.createUserMock(params, tx, options);
        return actual.createUser(params, tx, options);
      }),
    };
  },
);

vi.mock(
  "../../../../../src/modules/users/functions/createAccount",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../../../src/modules/users/functions/createAccount")
      >();
    return {
      ...actual,
      createAccount: vi.fn((params, tx) => {
        const impl = mocks.createAccountMock.getMockImplementation();
        if (impl) return mocks.createAccountMock(params, tx);
        return actual.createAccount(params, tx);
      }),
    };
  },
);

// ─── Imports Reais ────────────────────────────────────────────────────────────

import { createAccount } from "../../../../../src/modules/users/functions/createAccount";
import { createUser } from "../../../../../src/modules/users/functions/createUser";
import { findOrCreateUser } from "../../../../../src/modules/users/functions/findOrCreateUser";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  email: "user@example.com",
  username: "usertest",
};

const oauthProfile = {
  id: "github-abc",
  email: "user@example.com",
  name: "User Test",
  username: "usertest",
};

// ─── Helpers de Conexão Mockada ───────────────────────────────────────────────

function makeTx() {
  const chain = {
    values: vi.fn().mockImplementation(() => chain),
    returning: vi.fn().mockResolvedValue([mockUser]),
  };

  return {
    insert: vi.fn(() => chain),
    query: {
      users: { findFirst: vi.fn() },
      accounts: { findFirst: vi.fn() },
    },
  };
}

function setupTransaction(
  txOverrides: Partial<ReturnType<typeof makeTx>> = {},
) {
  const tx = { ...makeTx(), ...txOverrides };
  mocks.dbTransaction.mockImplementation(
    async (cb: (transaction: ReturnType<typeof makeTx>) => unknown) => cb(tx),
  );
  return tx;
}

// ═════════════════════════════════════════════════════════════════════════════
// findOrCreateUser
// ═════════════════════════════════════════════════════════════════════════════

describe("findOrCreateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUserMock.mockReset();
    mocks.createAccountMock.mockReset();
  });

  it("retorna usuário existente quando encontrado pelo provider", async () => {
    setupTransaction();
    mocks.findUserByProvider.mockResolvedValue(mockUser);

    const result = await findOrCreateUser({
      provider: "github",
      profile: oauthProfile,
    });

    expect(result).toMatchObject(mockUser);
  });

  it("encontra por email, cria account e retorna usuário existente", async () => {
    setupTransaction();
    mocks.findUserByProvider.mockResolvedValue(null);
    mocks.findUserByEmail.mockResolvedValue(mockUser);
    mocks.createAccountMock.mockResolvedValue(undefined);

    const result = await findOrCreateUser({
      provider: "github",
      profile: oauthProfile,
    });

    expect(result).toMatchObject(mockUser);
    expect(mocks.createAccountMock).toHaveBeenCalledWith(
      { userId: mockUser.id, provider: "github", profile: oauthProfile },
      expect.anything(),
    );
  });

  it("cria novo usuário e account quando não existe nem por provider nem por email", async () => {
    setupTransaction();
    mocks.findUserByProvider.mockResolvedValue(null);
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUserMock.mockResolvedValue(mockUser);
    mocks.createAccountMock.mockResolvedValue(undefined);

    const result = await findOrCreateUser({
      provider: "github",
      profile: oauthProfile,
    });

    expect(mocks.createUserMock).toHaveBeenCalledWith(
      {
        email: oauthProfile.email,
        displayName: oauthProfile.name,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        username: oauthProfile.username,
      },
      expect.anything(),
      { onEmailConflict: "returnExisting" },
    );
    expect(mocks.createAccountMock).toHaveBeenCalledWith(
      { userId: mockUser.id, provider: "github", profile: oauthProfile },
      expect.anything(),
    );
    expect(result).toMatchObject(mockUser);
  });

  it("pula a busca por email quando profile.email é undefined", async () => {
    setupTransaction();
    mocks.findUserByProvider.mockResolvedValue(null);
    mocks.createUserMock.mockResolvedValue({ ...mockUser, email: null });
    mocks.createAccountMock.mockResolvedValue(undefined);

    await findOrCreateUser({
      provider: "github",
      profile: { id: "gh-1", email: undefined },
    });

    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  });

  it("propaga erro quando createUser falha", async () => {
    setupTransaction();
    mocks.findUserByProvider.mockResolvedValue(null);
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createUserMock.mockRejectedValue(new Error("db error"));

    await expect(
      findOrCreateUser({ provider: "github", profile: oauthProfile }),
    ).rejects.toThrow("db error");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createUser (Usa a implementação REAL via mockReset)
// ═════════════════════════════════════════════════════════════════════════════

describe("createUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUserMock.mockReset(); // Sem implementação = cai no fluxo real.
  });

  it("insere usuário e retorna o resultado", async () => {
    const tx = makeTx();

    const result = await createUser(
      {
        email: oauthProfile.email,
        displayName: oauthProfile.name,
        username: oauthProfile.username,
      },
      tx as any,
    );

    expect(result).toMatchObject(mockUser);
    expect(result).toHaveProperty("technologyExperiences");
    expect(mocks.generateUsername).not.toHaveBeenCalled();
  });

  it("usa username do profile diretamente quando disponível", async () => {
    const tx = makeTx();

    await createUser(
      { email: oauthProfile.email, username: "customuser" },
      tx as any,
    );

    expect(mocks.generateUsername).not.toHaveBeenCalled();
  });

  it("usa prefixo do email como fallback quando name e username ausentes", async () => {
    const tx = makeTx();
    mocks.generateUsername.mockResolvedValue("fallback");

    await createUser(
      {
        email: "fallback@test.com",
        username: undefined,
        displayName: undefined,
      },
      tx as any,
    );

    expect(mocks.generateUsername).toHaveBeenCalledWith("fallback", tx);
  });

  it("usa 'user' como fallback final quando nenhum campo está disponível", async () => {
    const tx = makeTx();
    mocks.generateUsername.mockResolvedValue("user");

    await createUser(
      {
        email: null,
        username: undefined,
        displayName: undefined,
      },
      tx as any,
    );

    expect(mocks.generateUsername).toHaveBeenCalledWith("user", tx);
  });

  it("retorna usuário existente em conflito 23505 com email", async () => {
    const tx = makeTx();
    mocks.generateUsername.mockResolvedValue("usertest");

    const conflict = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(conflict),
    };
    tx.insert.mockReturnValue(chain as any);

    mocks.findUserByEmail.mockResolvedValue(mockUser);

    const result = await createUser(
      {
        email: oauthProfile.email,
        displayName: oauthProfile.name,
      },
      tx as any,
      { onEmailConflict: "returnExisting" },
    );
    expect(result).toEqual(mockUser);
  });

  it("relança conflito 23505 quando email é undefined", async () => {
    const tx = makeTx();
    mocks.generateUsername.mockResolvedValue("user");

    const conflict = Object.assign(new Error("unique violation"), {
      code: "23505",
    });
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(conflict),
    };
    tx.insert.mockReturnValue(chain as any);

    await expect(
      createUser({ email: null }, tx as any, {
        onEmailConflict: "returnExisting",
      }),
    ).rejects.toThrow("unique violation");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createAccount (Usa a implementação REAL via mockReset)
// ═════════════════════════════════════════════════════════════════════════════

describe("createAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAccountMock.mockReset(); // Sem implementação = cai no fluxo real.
  });

  it("insere account sem lançar erro", async () => {
    const tx = makeTx();

    await expect(
      createAccount(
        { userId: "user-1", provider: "github", profile: oauthProfile },
        tx as any,
      ),
    ).resolves.toBeUndefined();

    expect(tx.insert).toHaveBeenCalledOnce();
  });

  it("silencia erro de chave duplicada (23505)", async () => {
    const tx = makeTx();
    const duplicate = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });

    const chain = { values: vi.fn().mockRejectedValue(duplicate) };
    tx.insert.mockReturnValue(chain as any);

    await expect(
      createAccount(
        { userId: "user-1", provider: "github", profile: oauthProfile },
        tx as any,
      ),
    ).resolves.toBeUndefined();
  });

  it("propaga outros erros de banco", async () => {
    const tx = makeTx();
    const dbError = Object.assign(new Error("foreign key violation"), {
      code: "23503",
    });

    const chain = { values: vi.fn().mockRejectedValue(dbError) };
    tx.insert.mockReturnValue(chain as any);

    await expect(
      createAccount(
        { userId: "user-1", provider: "github", profile: oauthProfile },
        tx as any,
      ),
    ).rejects.toThrow("foreign key violation");
  });

  it("mapeia campos do profile corretamente para o insert", async () => {
    const tx = makeTx();
    const valuesMock = vi.fn().mockResolvedValue([undefined]);
    tx.insert.mockReturnValue({ values: valuesMock } as any);

    const profile = {
      id: "gh-1",
      email: "a@b.com",
      access_token: "tok",
      refresh_token: "ref",
      expires_at: 1700000000,
    };

    await createAccount(
      { userId: "u1", provider: "github", profile },
      tx as any,
    );

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        provider: "github",
        providerAccountId: "gh-1",
        accessToken: "tok",
        refreshToken: "ref",
      }),
    );
  });

  it("define accessToken e refreshToken como null quando ausentes no profile", async () => {
    const tx = makeTx();
    const valuesMock = vi.fn().mockResolvedValue([undefined]);
    tx.insert.mockReturnValue({ values: valuesMock } as any);

    await createAccount(
      { userId: "u1", provider: "github", profile: { id: "gh-1" } },
      tx as any,
    );

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: null, refreshToken: null }),
    );
  });
});
