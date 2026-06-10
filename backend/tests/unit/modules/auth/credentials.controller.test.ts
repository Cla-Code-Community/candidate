import { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CredentialsController } from "../../../../src/modules/auth/credentials.controller";

// Mock do módulo de tipos usando o mesmo padrão de caminho do import do seu controller
vi.mock("../../../../src/modules/types/credentials.types", () => ({
  RegisterSchema: {
    parse: vi.fn((val) => {
      // Se o teste enviou o email marcado para falhar no Zod, estoure o erro simulado
      if (val && val.email === "invalido@teste.com") {
        throw new z.ZodError([
          { path: ["email"], message: "Email inválido", code: "custom" },
        ]);
      }
      return val;
    }),
  },
  LoginSchema: {
    parse: vi.fn((val) => {
      if (val && val.email === "invalido@teste.com") {
        throw new z.ZodError([
          { path: ["email"], message: "Email inválido", code: "custom" },
        ]);
      }
      return val;
    }),
  },
}));

describe("CredentialsController", () => {
  let serviceMock: any;
  let controller: CredentialsController;
  let reqMock: any;
  let resMock: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    serviceMock = {
      register: vi.fn().mockResolvedValue({
        user: { id: "user_123", email: "dev@teste.com" },
        session: { id: "sess_abc" },
      }),
      login: vi.fn().mockResolvedValue({
        user: { id: "user_123", email: "dev@teste.com" },
        session: { id: "sess_abc" },
      }),
      // ← fix: findById agora existe no mock
      findById: vi.fn().mockResolvedValue({
        id: "user_789",
        email: "auth@teste.com",
        displayName: "Teste",
      }),
    };

    controller = new CredentialsController(serviceMock);

    reqMock = {
      body: {},
      session: {
        userId: undefined,
        save: vi.fn((cb) => {
          if (cb) cb(null);
          return Promise.resolve();
        }),
        destroy: vi.fn((cb) => {
          if (cb) cb(null);
          return Promise.resolve();
        }),
      },
    };

    resMock = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("register", () => {
    it("deve registrar um usuário com sucesso, salvar a sessão e retornar 201", async () => {
      reqMock.body = { email: "novo@teste.com", password: "password123" };

      await controller.register(
        reqMock as unknown as Request,
        resMock as Response,
      );

      expect(serviceMock.register).toHaveBeenCalledWith(reqMock.body);
      expect(reqMock.session.userId).toBe("user_123");
      expect(reqMock.session.save).toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(201);
    });

    it("deve retornar 400 se a validação do Zod falhar", async () => {
      reqMock.body = { email: "invalido@teste.com", password: "password123" };

      await controller.register(
        reqMock as unknown as Request,
        resMock as Response,
      );

      expect(resMock.status).toHaveBeenCalledWith(400);
    });

    it("deve retornar 409 se o email já estiver cadastrado", async () => {
      // FIX: Payload com formato válido para passar pelo Zod sem estourar Required
      reqMock.body = { email: "existente@teste.com", password: "password123" };
      serviceMock.register.mockRejectedValue(new Error("Email já cadastrado"));

      await controller.register(
        reqMock as unknown as Request,
        resMock as Response,
      );

      expect(resMock.status).toHaveBeenCalledWith(409);
      expect(resMock.json).toHaveBeenCalledWith({ error: "Email já cadastrado" });
    });
  });

  describe("login", () => {
    it("deve logar com sucesso, atualizar o userId na sessão e retornar dados do usuário", async () => {
      reqMock.body = { email: "dev@teste.com", password: "password123" };

      await controller.login(
        reqMock as unknown as Request,
        resMock as Response,
      );

      expect(resMock.json).toHaveBeenCalledWith({
        user: { id: "user_123", email: "dev@teste.com" },
        session: { id: "sess_abc" },
      });
    });

    it("deve retornar 401 se as credenciais forem inválidas", async () => {
      // FIX: Payload completo para o fluxo chegar intacto até o service
      reqMock.body = { email: "errado@teste.com", password: "password123" };
      serviceMock.login.mockRejectedValue(new Error("Credenciais inválidas"));

      await controller.login(
        reqMock as unknown as Request,
        resMock as Response,
      );

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(resMock.json).toHaveBeenCalledWith({ error: "Credenciais inválidas" });
    });
  });

  describe("logout", () => {
    it("deve destruir a sessão corrente e retornar ok", async () => {
      await controller.logout(
        reqMock as unknown as Request,
        resMock as Response,
      );
      expect(reqMock.session.destroy).toHaveBeenCalled();
      expect(resMock.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe("me", () => {
    it("deve retornar o user completo se o usuário estiver autenticado na sessão", async () => {
      reqMock.session.userId = "user_789";

      await controller.me(reqMock as unknown as Request, resMock as Response);

      expect(serviceMock.findById).toHaveBeenCalledWith("user_789");
      expect(resMock.json).toHaveBeenCalledWith({
        user: { id: "user_789", email: "auth@teste.com", displayName: "Teste" },
      });
    });

    it("deve retornar 401 se findById não encontrar o usuário", async () => {
      reqMock.session.userId = "user_inexistente";
      serviceMock.findById.mockResolvedValue(null);

      await controller.me(reqMock as unknown as Request, resMock as Response);

      expect(resMock.status).toHaveBeenCalledWith(401);
      expect(reqMock.session.destroy).toHaveBeenCalled();
    });

    it("deve retornar 401 se não houver userId armazenado na sessão", async () => {
      reqMock.session.userId = undefined;

      await controller.me(reqMock as unknown as Request, resMock as Response);

      expect(resMock.status).toHaveBeenCalledWith(401);
    });
  });
});
