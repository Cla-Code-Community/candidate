import { getIronSession } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/lib/errors";
import { UsersController } from "../../../../src/modules/users/users.controller";
import { UsersService } from "../../../../src/modules/users/users.service";

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: Partial<UsersService>;
  let req: any;
  let res: any;

  beforeEach(() => {
    usersService = {
      getUserById: vi.fn(),
      updateProfile: vi.fn(),
      getPreferences: vi.fn(),
      createPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    };

    controller = new UsersController(usersService as UsersService);

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    req = {
      body: {},
    };

    vi.clearAllMocks();
  });

  const mockSession = (session: any) => {
    vi.mocked(getIronSession).mockResolvedValue(session);
  };

  describe("getProfile", () => {
    it("lança UNAUTHORIZED sem autenticação", async () => {
      mockSession({});

      await expect(controller.getProfile(req, res)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        statusCode: 401,
      });
    });

    it("lança NOT_FOUND quando usuário não existe", async () => {
      mockSession({ userId: "1" });
      vi.mocked(usersService.getUserById!).mockResolvedValue(null);

      await expect(controller.getProfile(req, res)).rejects.toMatchObject({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "Usuário não encontrado",
      });
    });

    it("retorna usuário", async () => {
      const user = { id: "1", username: "bene" };
      mockSession({ userId: "1" });
      vi.mocked(usersService.getUserById!).mockResolvedValue(user);

      await controller.getProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(user);
    });

    it("propaga erro do service", async () => {
      mockSession({ userId: "1" });
      vi.mocked(usersService.getUserById!).mockRejectedValue(
        new Error("db error"),
      );

      await expect(controller.getProfile(req, res)).rejects.toThrow("db error");
    });
  });

  describe("updateProfile", () => {
    it("atualiza perfil com body já validado", async () => {
      mockSession({ userId: "1" });

      req.body = {
        username: "bene_dev",
        displayName: "Bene",
        avatarUrl: "https://site.com/avatar.png",
      };

      const updated = {
        id: "1",
        ...req.body,
      };

      vi.mocked(usersService.updateProfile!).mockResolvedValue(updated);

      await controller.updateProfile(req, res);

      expect(usersService.updateProfile).toHaveBeenCalledWith("1", req.body);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it("propaga erro do service", async () => {
      mockSession({ userId: "1" });
      req.body = { username: "bene_dev" };
      vi.mocked(usersService.updateProfile!).mockRejectedValue(
        new Error("update failed"),
      );

      await expect(controller.updateProfile(req, res)).rejects.toThrow(
        "update failed",
      );
    });

    it("lança UNAUTHORIZED sem sessão", async () => {
      mockSession({});
      await expect(controller.updateProfile(req, res)).rejects.toBeInstanceOf(
        AppError,
      );
    });
  });

  describe("getPreferences", () => {
    it("lança NOT_FOUND quando preferências não existem", async () => {
      mockSession({ userId: "1" });
      vi.mocked(usersService.getPreferences!).mockResolvedValue(null);

      await expect(controller.getPreferences(req, res)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Preferências não encontradas",
      });
    });

    it("retorna preferências", async () => {
      const prefs = { keywords: ["java"] };
      mockSession({ userId: "1" });
      vi.mocked(usersService.getPreferences!).mockResolvedValue(prefs);

      await controller.getPreferences(req, res);

      expect(res.json).toHaveBeenCalledWith(prefs);
    });
  });

  describe("createPreferences", () => {
    it("lança UNAUTHORIZED sem sessão", async () => {
      mockSession({});

      await expect(
        controller.createPreferences(req, res),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
    });

    it("cria preferências", async () => {
      mockSession({ userId: "1" });
      req.body = {
        keywords: ["java", "spring"],
        searchLanguage: "pt",
        remoteOnly: true,
      };
      vi.mocked(usersService.createPreferences!).mockResolvedValue(req.body);

      await controller.createPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updatePreferences", () => {
    it("atualiza preferências", async () => {
      mockSession({ userId: "1" });
      req.body = {
        keywords: ["java"],
        searchLanguage: "pt",
        remoteOnly: true,
        emailNotifications: true,
      };
      vi.mocked(usersService.updatePreferences!).mockResolvedValue(req.body);

      await controller.updatePreferences(req, res);

      expect(usersService.updatePreferences).toHaveBeenCalledWith("1", req.body);
      expect(res.json).toHaveBeenCalledWith(req.body);
    });

    it("propaga erro do service", async () => {
      mockSession({ userId: "1" });
      req.body = { keywords: ["java"] };
      vi.mocked(usersService.updatePreferences!).mockRejectedValue(
        new Error("update failed"),
      );

      await expect(controller.updatePreferences(req, res)).rejects.toThrow(
        "update failed",
      );
    });
  });
});
