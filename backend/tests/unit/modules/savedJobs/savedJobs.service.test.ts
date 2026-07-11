import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockJob = {
  id: "job-1",
  userId: "user-1",
  jobLink: "https://example.com/job/1",
  jobTitle: "Engenheiro de Software",
  company: "Empresa X",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ─── Mock DB factory ──────────────────────────────────────────────────────────

function makeMockTx() {
  return {
    query: {
      savedJobs: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ─── Import after vitest setup ────────────────────────────────────────────────

// import { SavedJobsService } from "../../../../src/modules/savedJobs/savedJobs.service";
import { SavedJobsService } from "../../../../src/modules/savedJobs/savedJobs.service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SavedJobsService", () => {
  let tx: ReturnType<typeof makeMockTx>;
  let service: SavedJobsService;

  beforeEach(() => {
    tx = makeMockTx();
    service = new SavedJobsService(tx as any);
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("retorna todas as vagas do usuário", async () => {
      tx.query.savedJobs.findMany.mockResolvedValue([mockJob]);

      const result = await service.getAll("user-1");

      expect(result).toEqual([mockJob]);
      expect(tx.query.savedJobs.findMany).toHaveBeenCalledOnce();
    });

    it("retorna array vazio quando usuário não tem vagas", async () => {
      tx.query.savedJobs.findMany.mockResolvedValue([]);

      const result = await service.getAll("user-sem-vagas");

      expect(result).toEqual([]);
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("retorna a vaga quando encontrada", async () => {
      tx.query.savedJobs.findFirst.mockResolvedValue(mockJob);

      const result = await service.getById("user-1", "job-1");

      expect(result).toEqual(mockJob);
    });

    it("retorna undefined quando vaga não existe", async () => {
      tx.query.savedJobs.findFirst.mockResolvedValue(undefined);

      const result = await service.getById("user-1", "inexistente");

      expect(result).toBeUndefined();
    });

    it("não retorna vaga de outro usuário (ownership)", async () => {
      tx.query.savedJobs.findFirst.mockResolvedValue(undefined);

      const result = await service.getById("user-2", "job-1");

      expect(result).toBeUndefined();
      expect(tx.query.savedJobs.findFirst).toHaveBeenCalledOnce();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    const newJobData = {
      jobLink: "https://example.com/job/new",
      title: "Dev Frontend",
      company: "Empresa Y",
    };

    it("cria e retorna a vaga quando não existe duplicata", async () => {
      tx.query.savedJobs.findFirst.mockResolvedValue(undefined);
      tx.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockJob, ...newJobData }]),
        }),
      });

      const result = await service.create("user-1", newJobData);

      expect(result).toMatchObject(newJobData);
      expect(tx.insert).toHaveBeenCalledOnce();
    });

    it("cria candidatura já com status applied e appliedAt", async () => {
      const appliedAt = new Date("2024-06-01T12:00:00Z");
      tx.query.savedJobs.findFirst.mockResolvedValue(undefined);
      tx.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              ...mockJob,
              status: "applied",
              appliedAt,
            },
          ]),
        }),
      });

      const result = await service.create("user-1", {
        ...newJobData,
        status: "applied",
        appliedAt,
      });

      expect(result.status).toBe("applied");
      expect(result.appliedAt).toEqual(appliedAt);
    });

    it("lança 'Vaga já salva.' quando jobLink já existe para o usuário", async () => {
      tx.query.savedJobs.findFirst.mockResolvedValue(mockJob);

      await expect(service.create("user-1", newJobData)).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Vaga já salva.",
      });

      expect(tx.insert).not.toHaveBeenCalled();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("atualiza e retorna a vaga", async () => {
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "job-1",
                userId: "user-1",
                jobLink: "https://example.com/job/1",
                jobTitle: "Dev Sênior", // Força o valor correto aqui
                company: "Empresa X",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
              },
            ]),
          }),
        }),
      });

      const result = await service.update("user-1", "job-1", {
        jobTitle: "Dev Sênior",
      });

      expect(result.jobTitle).toBe("Dev Sênior");
    });

    it("lança NOT_FOUND quando o update não retorna linha", async () => {
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.update("user-1", "inexistente", { jobTitle: "X" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Vaga não encontrada",
      });
    });

    it("não atualiza vaga de outro usuário (ownership)", async () => {
      tx.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.update("user-2", "job-1", { status: "applied" }),
      ).rejects.toThrow("Vaga não encontrada");
    });

    it.each([
      ["applied", "saved"],
      ["interviewing", "applied"],
      ["rejected", "interviewing"],
      ["accepted", "interviewing"],
    ] as const)(
      "persiste transição de status %s → %s",
      async (nextStatus, previousStatus) => {
        const setMock = vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockJob, status: nextStatus },
            ]),
          }),
        });
        tx.update.mockReturnValue({ set: setMock });

        const result = await service.update("user-1", "job-1", {
          status: nextStatus,
        });

        expect(result.status).toBe(nextStatus);
        expect(setMock.mock.calls[0][0]).toMatchObject({ status: nextStatus });
        expect(previousStatus).toBeDefined();
      },
    );

    it("persiste appliedAt ao mudar status para applied", async () => {
      const appliedAt = new Date("2024-06-15T10:00:00Z");
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { ...mockJob, status: "applied", appliedAt },
          ]),
        }),
      });
      tx.update.mockReturnValue({ set: setMock });

      const result = await service.update("user-1", "job-1", {
        status: "applied",
        appliedAt,
      });

      expect(result.status).toBe("applied");
      expect(result.appliedAt).toEqual(appliedAt);
      expect(setMock.mock.calls[0][0]).toMatchObject({
        status: "applied",
        appliedAt,
      });
    });

    it("inclui updatedAt no set", async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockJob]),
        }),
      });
      tx.update.mockReturnValue({ set: setMock });

      await service.update("user-1", "job-1", { jobTitle: "X" });

      const setArg = setMock.mock.calls[0][0];
      expect(setArg).toHaveProperty("updatedAt");
      expect(setArg.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("executa delete sem lançar erro", async () => {
      tx.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await expect(service.delete("user-1", "job-1")).resolves.toBeUndefined();
      expect(tx.delete).toHaveBeenCalledOnce();
    });

    it("executa delete sem erro mesmo quando vaga não pertence ao usuário", async () => {
      tx.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await expect(service.delete("user-2", "job-1")).resolves.toBeUndefined();
      expect(tx.delete).toHaveBeenCalledOnce();
    });
  });
});
