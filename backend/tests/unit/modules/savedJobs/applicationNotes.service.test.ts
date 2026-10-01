import { beforeEach, describe, expect, it, vi } from "vitest";

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: drizzleMocks.and,
    asc: drizzleMocks.asc,
    eq: drizzleMocks.eq,
  };
});

import { ApplicationNotesService } from "../../../../src/modules/savedJobs/applicationNotes.service";

function makeMockTx() {
  return {
    query: {
      applicationNotes: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function allowJobOwner(tx: ReturnType<typeof makeMockTx>) {
  const limit = vi.fn().mockResolvedValue([{ id: "job-1" }]);
  const where = vi.fn().mockReturnValue({ limit });
  tx.select.mockReturnValue({
    from: vi.fn().mockReturnValue({ where }),
  });
  return { where, limit };
}

describe("ApplicationNotesService", () => {
  let tx: ReturnType<typeof makeMockTx>;
  let service: ApplicationNotesService;

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeMockTx();
    service = new ApplicationNotesService(tx as never);
    drizzleMocks.and.mockImplementation((...conditions) => conditions);
    drizzleMocks.asc.mockImplementation((column) => ({ direction: "asc", column }));
    drizzleMocks.eq.mockImplementation((column, value) => ({ column, value }));
  });

  it("lista notas somente após confirmar que a vaga pertence ao usuário", async () => {
    const note = { id: "note-1", savedJobId: "job-1", userId: "user-1", content: "Entrevista" };
    const ownerQuery = allowJobOwner(tx);
    tx.query.applicationNotes.findMany.mockResolvedValue([note]);

    const result = await service.list("user-1", "job-1");

    expect(result).toEqual([note]);
    expect(ownerQuery.where).toHaveBeenCalledOnce();
    expect(tx.query.applicationNotes.findMany).toHaveBeenCalledOnce();
    const query = tx.query.applicationNotes.findMany.mock.calls[0][0];
    expect(query.where({ userId: "notes.userId", savedJobId: "notes.savedJobId" }, drizzleMocks)).toEqual([
      { column: "notes.userId", value: "user-1" },
      { column: "notes.savedJobId", value: "job-1" },
    ]);
  });

  it("retorna NOT_FOUND e não lista nota quando a vaga não pertence ao usuário", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    tx.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit }),
      }),
    });

    await expect(service.list("other-user", "job-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Vaga não encontrada",
    });
    expect(tx.query.applicationNotes.findMany).not.toHaveBeenCalled();
  });

  it("cria nota com usuário, vaga e conteúdo validados", async () => {
    const note = { id: "note-1", savedJobId: "job-1", userId: "user-1", content: "Entrevista" };
    allowJobOwner(tx);
    const returning = vi.fn().mockResolvedValue([note]);
    const values = vi.fn().mockReturnValue({ returning });
    tx.insert.mockReturnValue({ values });

    await expect(service.create("user-1", "job-1", "Entrevista")).resolves.toEqual(note);

    expect(values).toHaveBeenCalledWith({
      userId: "user-1",
      savedJobId: "job-1",
      content: "Entrevista",
    });
  });

  it("atualiza uma nota somente pelo ID, vaga e usuário", async () => {
    const note = { id: "note-1", savedJobId: "job-1", userId: "user-1", content: "Atualizada" };
    const returning = vi.fn().mockResolvedValue([note]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    tx.update.mockReturnValue({ set });

    await expect(service.update("user-1", "job-1", "note-1", "Atualizada")).resolves.toEqual(note);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ content: "Atualizada" }));
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "note-1");
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "job-1");
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("retorna NOT_FOUND ao atualizar nota fora do escopo do usuário", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    tx.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where }) });

    await expect(service.update("other-user", "job-1", "note-1", "Texto")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Nota não encontrada",
    });
  });

  it("remove nota no escopo correto e sinaliza nota inexistente", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "note-1" }]);
    const where = vi.fn().mockReturnValue({ returning });
    tx.delete.mockReturnValue({ where });

    await expect(service.delete("user-1", "job-1", "note-1")).resolves.toBeUndefined();
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "note-1");
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "job-1");
    expect(drizzleMocks.eq).toHaveBeenCalledWith(expect.anything(), "user-1");

    returning.mockResolvedValueOnce([]);
    await expect(service.delete("other-user", "job-1", "note-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Nota não encontrada",
    });
  });
});
