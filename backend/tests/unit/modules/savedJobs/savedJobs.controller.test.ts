
import { getIronSession } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SavedJobsController } from "../../../../src/modules/savedJobs/savedJobs.controller";

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

const mockService = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

function createMockResponse() {
  const res = {} as any;

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
}

describe("SavedJobsController", () => {
  let controller: SavedJobsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SavedJobsController(mockService as any);
  });

  describe("getAll", () => {
    it("retorna 401 quando não autenticado", async () => {
      (getIronSession as any).mockResolvedValue({});

      const req = {} as any;
      const res = createMockResponse();

      await controller.getAll(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna vagas", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.getAll.mockResolvedValue([{ id: "1" }]);

      const req = {} as any;
      const res = createMockResponse();

      await controller.getAll(req, res);

      expect(mockService.getAll).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith([{ id: "1" }]);
    });

    it("retorna erro 500", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.getAll.mockRejectedValue(
        new Error("database error"),
      );

      const req = {} as any;
      const res = createMockResponse();

      await controller.getAll(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getById", () => {
    it("retorna 401", async () => {
      (getIronSession as any).mockResolvedValue({});

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna 404", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.getById.mockResolvedValue(null);

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retorna vaga", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.getById.mockResolvedValue({
        id: "1",
      });

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.getById(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("retorna 401", async () => {
      (getIronSession as any).mockResolvedValue({});

      const req = {
        body: {},
      } as any;

      const res = createMockResponse();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna 400 quando body inválido", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      const req = {
        body: {
          jobLink: "link-invalido",
        },
      } as any;

      const res = createMockResponse();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("cria vaga", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.create.mockResolvedValue({
        id: "1",
      });

      const req = {
        body: {
          jobLink: "https://google.com",
        },
      } as any;

      const res = createMockResponse();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("retorna 409 quando vaga já existe", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.create.mockRejectedValue(
        new Error("Vaga já salva."),
      );

      const req = {
        body: {
          jobLink: "https://google.com",
        },
      } as any;

      const res = createMockResponse();

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe("update", () => {
    it("retorna 401", async () => {
      (getIronSession as any).mockResolvedValue({});

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("retorna 400 para payload inválido", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      const req = {
        params: { id: "1" },
        body: {
          jobLink: "url inválida",
        },
      } as any;

      const res = createMockResponse();

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("atualiza vaga", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.update.mockResolvedValue({
        id: "1",
      });

      const req = {
        params: { id: "1" },
        body: {
          notes: "teste",
        },
      } as any;

      const res = createMockResponse();

      await controller.update(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("retorna 401", async () => {
      (getIronSession as any).mockResolvedValue({});

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("remove vaga", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.delete.mockResolvedValue(undefined);

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("retorna erro desconhecido", async () => {
      (getIronSession as any).mockResolvedValue({
        userId: "user-1",
      });

      mockService.delete.mockRejectedValue("erro");

      const req = {
        params: { id: "1" },
      } as any;

      const res = createMockResponse();

      await controller.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Erro desconhecido",
      });
    });
  });
});