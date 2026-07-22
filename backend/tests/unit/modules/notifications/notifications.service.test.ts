import { beforeEach, describe, expect, it, vi } from "vitest";

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: drizzleMocks.and,
    eq: drizzleMocks.eq,
  };
});

import type {
  NewUserNotification,
  SavedJob,
  UserNotification,
} from "../../../../src/db/schema";
import { NotificationsService } from "../../../../src/modules/notifications/notifications.service";

const baseDate = new Date("2026-07-21T10:00:00.000Z");

const savedJob: SavedJob = {
  id: "job-1",
  userId: "user-1",
  jobLink: "https://jobs.test/1",
  jobTitle: "Backend Developer",
  company: "Candidate",
  location: "Brasil",
  source: "LinkedIn",
  keyword: "Node.js Developer",
  status: "saved",
  appliedAt: null,
  notes: null,
  createdAt: baseDate,
  updatedAt: baseDate,
};

const notification: UserNotification = {
  id: "notification-1",
  userId: "user-1",
  channel: "notification",
  type: "job_saved",
  title: "Vaga salva",
  message: "Backend Developer na Candidate foi adicionada.",
  entityType: "job",
  entityId: "job-1",
  metadata: {},
  readAt: null,
  createdAt: baseDate,
};

function makeListBuilder(items: UserNotification[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(items),
  };
}

function makeCountBuilder(value: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ value }]),
  };
}

function makeInsertBuilder(result: UserNotification = notification) {
  const returning = vi.fn().mockResolvedValue([result]);
  const values = vi.fn().mockReturnValue({ returning });
  return { builder: { values }, values, returning };
}

function makeUpdateBuilder(result: Partial<UserNotification>[] = [notification]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { builder: { set }, set, where, returning };
}

function makeDeleteBuilder(result: Partial<UserNotification>[] = [notification]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  return { builder: { where }, where, returning };
}

function makeTx() {
  return {
    query: {
      userNotifications: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("NotificationsService", () => {
  let tx: ReturnType<typeof makeTx>;
  let service: NotificationsService;

  beforeEach(() => {
    tx = makeTx();
    service = new NotificationsService(tx as any);
    drizzleMocks.and.mockImplementation((...conditions) => conditions);
    drizzleMocks.eq.mockImplementation((column, value) => ({
      column,
      value,
    }));
  });

  it("lista notificações com filtros de canal e não lidas", async () => {
    const listBuilder = makeListBuilder([notification]);
    const countBuilder = makeCountBuilder(3);
    tx.select.mockReturnValueOnce(listBuilder).mockReturnValueOnce(countBuilder);

    const result = await service.list("user-1", {
      channel: "notification",
      unreadOnly: true,
      limit: 10,
    });

    expect(result).toEqual({
      notifications: [notification],
      unreadCount: 3,
    });
    expect(listBuilder.limit).toHaveBeenCalledWith(10);
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(listBuilder.where).toHaveBeenCalledWith(
      expect.arrayContaining([
        { column: expect.anything(), value: "user-1" },
      ]),
    );
  });

  it("usa unreadCount zero quando a consulta agregada não retorna linhas", async () => {
    tx.select
      .mockReturnValueOnce(makeListBuilder([]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

    await expect(
      service.list("user-1", { limit: 5 }),
    ).resolves.toMatchObject({
      notifications: [],
      unreadCount: 0,
    });
  });

  it("cria uma notificação arbitrária", async () => {
    const insert = makeInsertBuilder(notification);
    tx.insert.mockReturnValue(insert.builder);

    const data: NewUserNotification = {
      userId: "user-1",
      channel: "message",
      type: "system",
      title: "Mensagem",
      message: "Olá",
    };

    await expect(service.create(data)).resolves.toBe(notification);
    expect(insert.values).toHaveBeenCalledWith(data);
  });

  it("marca uma notificação como lida", async () => {
    const update = makeUpdateBuilder([notification]);
    tx.update.mockReturnValue(update.builder);

    await expect(
      service.markRead("user-1", "notification-1"),
    ).resolves.toBe(notification);
    expect(update.set).toHaveBeenCalledWith({ readAt: expect.any(Date) });
    expect(update.where).toHaveBeenCalledWith([
      { column: expect.anything(), value: "notification-1" },
      { column: expect.anything(), value: "user-1" },
    ]);
  });

  it("lança not found ao marcar como lida quando não encontra a notificação", async () => {
    const update = makeUpdateBuilder([]);
    tx.update.mockReturnValue(update.builder);

    await expect(
      service.markRead("user-1", "missing"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Notificação não encontrada",
    });
  });

  it("marca todas as notificações não lidas como lidas", async () => {
    const update = makeUpdateBuilder([{ id: "n1" }, { id: "n2" }]);
    tx.update.mockReturnValue(update.builder);

    await expect(service.markAllRead("user-1", "message")).resolves.toEqual({
      updated: 2,
    });
    expect(update.where).toHaveBeenCalledWith(
      expect.arrayContaining([
        { column: expect.anything(), value: "user-1" },
        { column: expect.anything(), value: "message" },
      ]),
    );
  });

  it("limpa notificações de um canal", async () => {
    const deleteQuery = makeDeleteBuilder([{ id: "n1" }, { id: "n2" }]);
    tx.delete.mockReturnValue(deleteQuery.builder);

    await expect(service.clear("user-1", "notification")).resolves.toEqual({
      deleted: 2,
    });

    expect(tx.delete).toHaveBeenCalled();
    expect(deleteQuery.where).toHaveBeenCalledWith(
      expect.arrayContaining([
        { column: expect.anything(), value: "user-1" },
        { column: expect.anything(), value: "notification" },
      ]),
    );
    expect(deleteQuery.returning).toHaveBeenCalledWith({
      id: expect.anything(),
    });
  });

  it("cria notificação para vaga salva", async () => {
    const insert = makeInsertBuilder(notification);
    tx.insert.mockReturnValue(insert.builder);

    await service.createForSavedJob("user-1", savedJob);

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        channel: "notification",
        type: "job_saved",
        title: "Vaga salva",
        message: "Backend Developer na Candidate foi adicionada às suas vagas salvas.",
        entityType: "job",
        entityId: "job-1",
        metadata: expect.objectContaining({
          jobLink: "https://jobs.test/1",
          status: "saved",
        }),
      }),
    );
  });

  it("cria notificação para candidatura enviada com fallback de nome da vaga", async () => {
    const insert = makeInsertBuilder(notification);
    tx.insert.mockReturnValue(insert.builder);

    await service.createForSavedJob("user-1", {
      ...savedJob,
      jobTitle: " ",
      company: null,
      status: "applied",
    });

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job_applied",
        title: "Candidatura enviada",
        message: "Sua candidatura para vaga foi registrada.",
      }),
    );
  });

  it("não cria notificação quando o status não mudou", async () => {
    await expect(
      service.createForJobStatusChange("user-1", savedJob, savedJob),
    ).resolves.toBeNull();

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("cria notificação para mudança de status", async () => {
    const insert = makeInsertBuilder(notification);
    tx.insert.mockReturnValue(insert.builder);

    await service.createForJobStatusChange("user-1", savedJob, {
      ...savedJob,
      status: "interviewing",
    });

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "job_status_changed",
        title: "Status de candidatura atualizado",
        message: 'Backend Developer na Candidate agora está em "Em entrevista".',
        metadata: expect.objectContaining({
          previousStatus: "saved",
          status: "interviewing",
        }),
      }),
    );
  });

  it("não cria high match abaixo do limite ou sem identidade", async () => {
    await expect(
      service.createHighMatchIfMissing("user-1", {
        id: "job-low",
        title: "React Developer",
        matchScore: 84,
      }),
    ).resolves.toBeNull();
    await expect(
      service.createHighMatchIfMissing("user-1", {
        id: null,
        url: " ",
        title: "React Developer",
        matchScore: 90,
      }),
    ).resolves.toBeNull();

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("reaproveita high match existente", async () => {
    tx.query.userNotifications.findFirst.mockResolvedValue(notification);

    await expect(
      service.createHighMatchIfMissing("user-1", {
        url: "https://jobs.test/react",
        title: "React Developer",
        matchScore: 90,
      }),
    ).resolves.toBe(notification);

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("cria high match novo com tecnologias encontradas", async () => {
    const insert = makeInsertBuilder(notification);
    tx.query.userNotifications.findFirst.mockResolvedValue(undefined);
    tx.insert.mockReturnValue(insert.builder);

    await service.createHighMatchIfMissing("user-1", {
      url: "https://jobs.test/react",
      title: "React Developer",
      company: "Candidate",
      matchScore: 92,
      matchedTechnologies: ["React", "TypeScript"],
    });

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "high_match",
        title: "Vaga com alto match encontrada",
        message:
          "React Developer na Candidate tem 92% de compatibilidade com o seu perfil.",
        entityId: "https://jobs.test/react",
        metadata: expect.objectContaining({
          matchedTechnologies: ["React", "TypeScript"],
          matchScore: 92,
        }),
      }),
    );
  });

  it("deduplica alto match usando userId para impedir colisão cross-user", async () => {
    tx.query.userNotifications.findFirst.mockResolvedValue(notification);

    const result = await service.createHighMatchIfMissing("user-1", {
      id: "job-1",
      title: "Backend Developer",
      company: "Candidate",
      link: "https://jobs.test/1",
      matchScore: 95,
    });

    expect(result).toBe(notification);

    const where = tx.query.userNotifications.findFirst.mock.calls[0][0].where;
    const table = {
      userId: "userNotifications.userId",
      type: "userNotifications.type",
      entityType: "userNotifications.entityType",
      entityId: "userNotifications.entityId",
    };
    expect(where(table, drizzleMocks)).toEqual([
      { column: "userNotifications.userId", value: "user-1" },
      { column: "userNotifications.type", value: "high_match" },
      { column: "userNotifications.entityType", value: "job" },
      { column: "userNotifications.entityId", value: "job-1" },
    ]);
  });
});
