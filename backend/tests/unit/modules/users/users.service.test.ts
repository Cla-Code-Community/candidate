import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  email: "user@example.com",
  username: "usertest",
  displayName: "User Test",
  updatedAt: new Date("2024-01-01"),
};

const mockPreferences = {
  id: "pref-1",
  userId: "user-1",
  updatedAt: new Date("2024-01-01"),
};

// ─── Mock TX factory ──────────────────────────────────────────────────────────

function makeMockTx() {
  return {
    query: {
      users: { findFirst: vi.fn() },
      userPreferences: { findFirst: vi.fn() },
    },
    update: vi.fn(),
    insert: vi.fn(),
  };
}

// ─── Import after setup ───────────────────────────────────────────────────────

import { UsersService } from "../../../../src/modules/users/users.service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UsersService", () => {
  let tx: ReturnType<typeof makeMockTx>;
  let service: UsersService;

  beforeEach(() => {
    tx = makeMockTx();
    service = new UsersService(tx as any);
  });

  // ── getUserById ────────────────────────────────────────────────────────────

  describe("getUserById", () => {
    it("retorna o usuário quando encontrado", async () => {
      tx.query.users.findFirst.mockResolvedValue(mockUser);

      const result = await service.getUserById("user-1");

      expect(result).toEqual(mockUser);
      expect(tx.query.users.findFirst).toHaveBeenCalledOnce();
    });

    it("retorna undefined quando usuário não existe", async () => {
      tx.query.users.findFirst.mockResolvedValue(undefined);

      const result = await service.getUserById("inexistente");

      expect(result).toBeUndefined();
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("atualiza e retorna o perfil", async () => {
      const updated = { ...mockUser, displayName: "Novo Nome" };
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await service.updateProfile("user-1", {
        displayName: "Novo Nome",
      });

      expect(result.displayName).toBe("Novo Nome");
    });

    it("lança NOT_FOUND quando usuário não é encontrado no update", async () => {
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.updateProfile("inexistente", { displayName: "X" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Usuário não encontrado",
      });
    });

    it("inclui updatedAt no payload do set", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      });
      tx.update.mockReturnValue({ set: setMock });

      await service.updateProfile("user-1", { displayName: "X" });

      expect(setMock.mock.calls[0][0]).toHaveProperty("updatedAt");
    });
  });

  // ── getPreferences ─────────────────────────────────────────────────────────

  describe("getPreferences", () => {
    it("retorna as preferências do usuário", async () => {
      tx.query.userPreferences.findFirst.mockResolvedValue(mockPreferences);

      const result = await service.getPreferences("user-1");

      expect(result).toEqual(mockPreferences);
    });

    it("retorna undefined quando não existem preferências", async () => {
      tx.query.userPreferences.findFirst.mockResolvedValue(undefined);

      const result = await service.getPreferences("user-1");

      expect(result).toBeUndefined();
    });
  });

  // ── createPreferences ──────────────────────────────────────────────────────

  describe("createPreferences", () => {
    it("cria preferências com dados padrão quando nenhum dado é passado", async () => {
      tx.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPreferences]),
        }),
      });

      const result = await service.createPreferences("user-1");

      expect(result).toEqual(mockPreferences);
      expect(tx.insert).toHaveBeenCalledOnce();
    });

    it("inclui os dados extras fornecidos", async () => {
      const valuesMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockPreferences]),
      });
      tx.insert.mockReturnValue({ values: valuesMock });

      await service.createPreferences("user-1", { theme: "dark" } as any);

      expect(valuesMock.mock.calls[0][0]).toMatchObject({
        userId: "user-1",
        theme: "dark",
      });
    });
  });

  // ── updatePreferences ──────────────────────────────────────────────────────

  describe("updatePreferences", () => {
    it("atualiza e retorna as preferências", async () => {
      const updated = { ...mockPreferences, theme: "dark" };
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const result = await service.updatePreferences("user-1", {
        theme: "dark",
      } as any);

      expect(result).toMatchObject({ theme: "dark" });
    });

    it("lança NOT_FOUND quando preferências não existem", async () => {
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.updatePreferences("user-sem-pref", {} as any),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Preferências não encontradas",
      });
    });

    it("inclui updatedAt no set", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPreferences]),
        }),
      });
      tx.update.mockReturnValue({ set: setMock });

      await service.updatePreferences("user-1", {} as any);

      expect(setMock.mock.calls[0][0]).toHaveProperty("updatedAt");
    });
  });
});
