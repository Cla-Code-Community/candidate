import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/lib/errors";

// ── SavedJobsService mock ─────────────────────────────────────────────────────

const mockSavedJobsService = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../../src/modules/savedJobs/savedJobs.service", () => ({
  SavedJobsService: class {
    constructor() {
      return mockSavedJobsService;
    }
  },
}));

// ── iron-session ──────────────────────────────────────────────────────────────
// SavedJobsController chama getIronSession diretamente em cada action,
// além do withSession aplicado globalmente no app.ts.

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

import { getIronSession } from "iron-session";
import { createJobsApiApp } from "../../../src/app";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fixtureSession = {
  userId: "user_abc",
  save: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fixtureJob = {
  id: "job-1",
  userId: "user_abc",
  jobLink: "https://example.com/job/1",
  jobTitle: "Engenheiro de Software",
  company: "Empresa X",
  location: "São Paulo",
  source: "linkedin",
  keyword: "typescript",
  status: "saved",
  appliedAt: null,
  notes: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
};

// Payload válido para POST (campos do createJobSchema)
const createPayload = {
  jobLink: "https://example.com/job/1",
  jobTitle: "Engenheiro de Software",
  company: "Empresa X",
  location: "São Paulo",
  source: "linkedin",
  keyword: "typescript",
  status: "saved",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration - SavedJobs Routes", () => {
  let app: ReturnType<typeof createJobsApiApp>;
  const BASE = "/saved-jobs";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getIronSession).mockResolvedValue(fixtureSession as any);

    mockSavedJobsService.getAll.mockResolvedValue([fixtureJob]);
    mockSavedJobsService.getById.mockResolvedValue(fixtureJob);
    mockSavedJobsService.create.mockResolvedValue(fixtureJob);
    mockSavedJobsService.update.mockResolvedValue({
      ...fixtureJob,
      status: "applied",
    });
    mockSavedJobsService.delete.mockResolvedValue(undefined);

    app = createJobsApiApp();
  });

  // ── GET / ─────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("retorna 200 e lista de vagas", async () => {
      const res = await request(app).get(BASE).expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty("jobLink", fixtureJob.jobLink);
    });

    it("chama getAll com o userId da sessão", async () => {
      await request(app).get(BASE);

      expect(mockSavedJobsService.getAll).toHaveBeenCalledWith("user_abc");
    });

    it("retorna lista vazia quando usuário não tem vagas", async () => {
      mockSavedJobsService.getAll.mockResolvedValueOnce([]);

      const res = await request(app).get(BASE).expect(200);

      expect(res.body).toEqual([]);
    });

    it("retorna 401 quando sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      const res = await request(app).get(BASE).expect(401);

      expect(res.body).toEqual({
        code: "UNAUTHORIZED",
        message: "Não autenticado.",
      });
    });

    it("retorna 500 quando getAll lança erro", async () => {
      mockSavedJobsService.getAll.mockRejectedValueOnce(new Error("db error"));

      await request(app).get(BASE).expect(500);
    });
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────

  describe("GET /:id", () => {
    it("retorna 200 e a vaga encontrada", async () => {
      const res = await request(app).get(`${BASE}/job-1`).expect(200);

      expect(res.body).toHaveProperty("id", "job-1");
    });

    it("chama getById com userId e jobId corretos", async () => {
      await request(app).get(`${BASE}/job-1`);

      expect(mockSavedJobsService.getById).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
      );
    });

    it("retorna 404 quando vaga não existe", async () => {
      mockSavedJobsService.getById.mockResolvedValueOnce(undefined);

      await request(app).get(`${BASE}/inexistente`).expect(404);
    });

    it("retorna 404 quando vaga pertence a outro usuário (ownership)", async () => {
      mockSavedJobsService.getById.mockResolvedValueOnce(undefined);

      const res = await request(app).get(`${BASE}/job-outro-user`).expect(404);

      expect(res.body).toEqual({
        code: "NOT_FOUND",
        message: "Vaga não encontrada",
      });
      expect(mockSavedJobsService.getById).toHaveBeenCalledWith(
        "user_abc",
        "job-outro-user",
      );
    });

    it("retorna 401 quando sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      await request(app).get(`${BASE}/job-1`).expect(401);
    });
  });
  describe("POST /", () => {
    it("cria vaga e retorna 201", async () => {
      const res = await request(app).post(BASE).send(createPayload).expect(201);

      expect(res.body).toHaveProperty("id", "job-1");
    });

    it("chama create com userId e body parseado pelo Zod", async () => {
      await request(app).post(BASE).send(createPayload);

      expect(mockSavedJobsService.create).toHaveBeenCalledWith(
        "user_abc",
        expect.objectContaining({
          jobLink: createPayload.jobLink,
          company: createPayload.company,
          status: "saved",
        }),
      );
    });

    it("retorna 400 quando jobLink é inválido (Zod)", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ ...createPayload, jobLink: "nao-e-url" })
        .expect(400);

      expect(res.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
      });
      expect(res.body.details).toHaveProperty("jobLink");
    });

    it("retorna 400 quando status é valor fora do enum", async () => {
      await request(app)
        .post(BASE)
        .send({ ...createPayload, status: "invalido" })
        .expect(400);
    });

    it("retorna 400 quando jobLink está ausente", async () => {
      const { jobLink: _, ...withoutLink } = createPayload;

      await request(app).post(BASE).send(withoutLink).expect(400);
    });

    it("descarta campos desconhecidos (Zod strip)", async () => {
      await request(app)
        .post(BASE)
        .send({ ...createPayload, campoInexistente: "foo" });

      const calledBody = mockSavedJobsService.create.mock.calls[0][1];
      expect(calledBody).not.toHaveProperty("campoInexistente");
    });

    it("retorna 409 quando vaga já foi salva", async () => {
      mockSavedJobsService.create.mockRejectedValueOnce(
        AppError.conflict("Vaga já salva."),
      );

      const res = await request(app)
        .post(BASE)
        .send(createPayload)
        .expect(409);

      expect(res.body).toEqual({
        code: "CONFLICT",
        message: "Vaga já salva.",
      });
    });

    it("retorna 401 quando sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      const res = await request(app)
        .post(BASE)
        .send(createPayload)
        .expect(401);

      expect(res.body).toEqual({
        code: "UNAUTHORIZED",
        message: "Não autenticado.",
      });
    });
  });

  // ── PATCH /:id — transições de status (eventos de candidatura) ─────────────

  describe("PATCH /:id — transições de status", () => {
    it.each([
      "applied",
      "interviewing",
      "rejected",
      "accepted",
    ] as const)("atualiza status para %s", async (status) => {
      mockSavedJobsService.update.mockResolvedValueOnce({
        ...fixtureJob,
        status,
      });

      const res = await request(app)
        .patch(`${BASE}/job-1`)
        .send({ status })
        .expect(200);

      expect(res.body.status).toBe(status);
      expect(mockSavedJobsService.update).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
        expect.objectContaining({ status }),
      );
    });

    it("persiste appliedAt ao registrar candidatura enviada", async () => {
      const appliedAt = "2024-06-15T10:00:00.000Z";
      mockSavedJobsService.update.mockResolvedValueOnce({
        ...fixtureJob,
        status: "applied",
        appliedAt,
      });

      const res = await request(app)
        .patch(`${BASE}/job-1`)
        .send({ status: "applied", appliedAt })
        .expect(200);

      expect(res.body.status).toBe("applied");
      expect(mockSavedJobsService.update).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
        expect.objectContaining({
          status: "applied",
          appliedAt: expect.any(Date),
        }),
      );
    });

    it("simula pipeline completo saved → applied → interviewing → accepted", async () => {
      const pipeline = ["applied", "interviewing", "accepted"] as const;

      for (const status of pipeline) {
        mockSavedJobsService.update.mockResolvedValueOnce({
          ...fixtureJob,
          status,
        });

        const res = await request(app)
          .patch(`${BASE}/job-1`)
          .send({ status })
          .expect(200);

        expect(res.body.status).toBe(status);
      }

      expect(mockSavedJobsService.update).toHaveBeenCalledTimes(pipeline.length);
    });
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────

  describe("PATCH /:id", () => {
    const updatePayload = { status: "applied" };

    it("retorna 200 e a vaga com status atualizado", async () => {
      const res = await request(app)
        .patch(`${BASE}/job-1`)
        .send(updatePayload)
        .expect(200);

      expect(res.body).toHaveProperty("status", "applied");
    });

    it("chama update com userId, jobId e body corretos", async () => {
      await request(app).patch(`${BASE}/job-1`).send(updatePayload);

      expect(mockSavedJobsService.update).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
        expect.objectContaining({ status: "applied" }),
      );
    });

    it("retorna 400 para status fora do enum", async () => {
      await request(app)
        .patch(`${BASE}/job-1`)
        .send({ status: "nao-existe" })
        .expect(400);
    });

    it("retorna 400 para jobLink inválido no update", async () => {
      await request(app)
        .patch(`${BASE}/job-1`)
        .send({ jobLink: "nao-e-url" })
        .expect(400);
    });

    it("aceita body vazio (todos os campos são opcionais no updateJobSchema)", async () => {
      await request(app).patch(`${BASE}/job-1`).send({}).expect(200);

      expect(mockSavedJobsService.update).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
        {},
      );
    });

    it("retorna 404 quando update não encontra a vaga", async () => {
      mockSavedJobsService.update.mockRejectedValueOnce(
        AppError.notFound("Vaga não encontrada"),
      );

      const res = await request(app)
        .patch(`${BASE}/job-1`)
        .send(updatePayload)
        .expect(404);

      expect(res.body).toEqual({
        code: "NOT_FOUND",
        message: "Vaga não encontrada",
      });
    });

    it("retorna 401 quando sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      await request(app).patch(`${BASE}/job-1`).send(updatePayload).expect(401);
    });
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────

  describe("DELETE /:id", () => {
    it("retorna 204 sem body", async () => {
      const res = await request(app).delete(`${BASE}/job-1`).expect(204);

      expect(res.text).toBe("");
    });

    it("chama delete com userId e jobId corretos", async () => {
      await request(app).delete(`${BASE}/job-1`);

      expect(mockSavedJobsService.delete).toHaveBeenCalledWith(
        "user_abc",
        "job-1",
      );
    });

    it("retorna 401 quando sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      await request(app).delete(`${BASE}/job-1`).expect(401);
    });

    it("retorna 500 quando delete lança erro", async () => {
      mockSavedJobsService.delete.mockRejectedValueOnce(new Error("db error"));

      await request(app).delete(`${BASE}/job-1`).expect(500);
    });

    it("retorna 204 mesmo quando vaga não pertence ao usuário (ownership silencioso)", async () => {
      await request(app).delete(`${BASE}/job-outro-user`).expect(204);

      expect(mockSavedJobsService.delete).toHaveBeenCalledWith(
        "user_abc",
        "job-outro-user",
      );
    });
  });
});
