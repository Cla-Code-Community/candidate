import { getIronSession } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    it("retorna 401 sem autenticação", async () => {
      mockSession({});

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna 404 quando usuário não existe", async () => {
      mockSession({ userId: "1" });

      vi.mocked(usersService.getUserById!).mockResolvedValue(null);

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retorna usuário", async () => {
      const user = { id: "1", username: "bene" };

      mockSession({ userId: "1" });

      vi.mocked(usersService.getUserById!).mockResolvedValue(user);

      await controller.getProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(user);
    });

    it("retorna erro 500", async () => {
      mockSession({ userId: "1" });

      vi.mocked(usersService.getUserById!).mockRejectedValue(
        new Error("db error"),
      );

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retorna erro desconhecido", async () => {
      mockSession({ userId: "1" });

      vi.mocked(usersService.getUserById!).mockRejectedValue("erro");

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Erro desconhecido",
      });
    });
  });

  describe("updateProfile", () => {
    it("retorna 400 para username inválido", async () => {
      mockSession({ userId: "1" });

      req.body = {
        username: "@@@",
      };

      await controller.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("atualiza perfil", async () => {
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

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        "1",
        req.body,
      );

      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it("retorna erro do service", async () => {
      mockSession({ userId: "1" });

      req.body = {
        username: "bene_dev",
      };

      vi.mocked(usersService.updateProfile!).mockRejectedValue(
        new Error("update failed"),
      );

      await controller.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getPreferences", () => {
    it("retorna 404 quando preferências não existem", async () => {
      mockSession({ userId: "1" });

      vi.mocked(usersService.getPreferences!).mockResolvedValue(null);

      await controller.getPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retorna preferências", async () => {
      const prefs = {
        keywords: ["java"],
      };

      mockSession({ userId: "1" });

      vi.mocked(usersService.getPreferences!).mockResolvedValue(prefs);

      await controller.getPreferences(req, res);

      expect(res.json).toHaveBeenCalledWith(prefs);
    });
  });

  describe("createPreferences", () => {
    it("retorna 401 sem sessão", async () => {
      mockSession({});

      await controller.createPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna 400 para payload inválido", async () => {
      mockSession({ userId: "1" });

      req.body = {
        searchLanguage: "pt-br",
      };

      await controller.createPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
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
    it("retorna 400 para payload inválido", async () => {
      mockSession({ userId: "1" });

      req.body = {
        keywords: Array(30).fill("java"),
      };

      await controller.updatePreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

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

      expect(usersService.updatePreferences).toHaveBeenCalledWith(
        "1",
        req.body,
      );

      expect(res.json).toHaveBeenCalledWith(req.body);
    });

    it("retorna erro do service", async () => {
      mockSession({ userId: "1" });

      req.body = {
        keywords: ["java"],
      };

      vi.mocked(usersService.updatePreferences!).mockRejectedValue(
        new Error("update failed"),
      );

      await controller.updatePreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});