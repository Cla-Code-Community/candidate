import { getIronSession } from "iron-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/lib/errors";
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
    it("lança UNAUTHORIZED quando não autenticado", async () => {
      (getIronSession as any).mockResolvedValue({});
      await expect(
        controller.getAll({} as any, createMockResponse()),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
    });

    it("retorna vagas", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.getAll.mockResolvedValue([{ id: "1" }]);
      const res = createMockResponse();

      await controller.getAll({} as any, res);

      expect(mockService.getAll).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith([{ id: "1" }]);
    });

    it("propaga erro inesperado", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.getAll.mockRejectedValue(new Error("database error"));

      await expect(
        controller.getAll({} as any, createMockResponse()),
      ).rejects.toThrow("database error");
    });
  });

  describe("getById", () => {
    it("lança UNAUTHORIZED", async () => {
      (getIronSession as any).mockResolvedValue({});
      await expect(
        controller.getById(
          { params: { id: "1" } } as any,
          createMockResponse(),
        ),
      ).rejects.toBeInstanceOf(AppError);
    });

    it("lança NOT_FOUND", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.getById.mockResolvedValue(null);

      await expect(
        controller.getById(
          { params: { id: "1" } } as any,
          createMockResponse(),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    });

    it("retorna vaga", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.getById.mockResolvedValue({ id: "1" });
      const res = createMockResponse();

      await controller.getById({ params: { id: "1" } } as any, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("lança UNAUTHORIZED", async () => {
      (getIronSession as any).mockResolvedValue({});
      await expect(
        controller.create({ body: {} } as any, createMockResponse()),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("cria vaga", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.create.mockResolvedValue({ id: "1" });
      const res = createMockResponse();

      await controller.create(
        { body: { jobLink: "https://google.com" } } as any,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("lança CONFLICT quando vaga já existe", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.create.mockRejectedValue(AppError.conflict("Vaga já salva."));

      await expect(
        controller.create(
          { body: { jobLink: "https://google.com" } } as any,
          createMockResponse(),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    });
  });

  describe("update", () => {
    it("lança UNAUTHORIZED", async () => {
      (getIronSession as any).mockResolvedValue({});
      await expect(
        controller.update(
          { params: { id: "1" }, body: {} } as any,
          createMockResponse(),
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("atualiza vaga", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.update.mockResolvedValue({ id: "1" });
      const res = createMockResponse();

      await controller.update(
        { params: { id: "1" }, body: { notes: "teste" } } as any,
        res,
      );

      expect(res.json).toHaveBeenCalled();
    });

    it("lança NOT_FOUND quando service não encontra", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.update.mockRejectedValue(
        AppError.notFound("Vaga não encontrada"),
      );

      await expect(
        controller.update(
          { params: { id: "1" }, body: { notes: "x" } } as any,
          createMockResponse(),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    });
  });

  describe("delete", () => {
    it("lança UNAUTHORIZED", async () => {
      (getIronSession as any).mockResolvedValue({});
      await expect(
        controller.delete(
          { params: { id: "1" } } as any,
          createMockResponse(),
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("remove vaga", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.delete.mockResolvedValue(undefined);
      const res = createMockResponse();

      await controller.delete({ params: { id: "1" } } as any, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("propaga erro desconhecido", async () => {
      (getIronSession as any).mockResolvedValue({ userId: "user-1" });
      mockService.delete.mockRejectedValue("erro");

      await expect(
        controller.delete(
          { params: { id: "1" } } as any,
          createMockResponse(),
        ),
      ).rejects.toBe("erro");
    });
  });
});
