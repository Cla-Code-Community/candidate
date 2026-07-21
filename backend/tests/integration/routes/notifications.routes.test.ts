import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/lib/errors";

const mockNotificationsService = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock("../../../src/modules/notifications/notifications.service", () => ({
  NotificationsService: class {
    constructor() {
      return mockNotificationsService;
    }
  },
}));

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

import { getIronSession } from "iron-session";
import { createJobsApiApp } from "../../../src/app";

const fixtureSession = {
  userId: "user_abc",
  save: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fixtureNotification = {
  id: "notification-1",
  userId: "user_abc",
  channel: "notification",
  type: "job_saved",
  title: "Vaga salva",
  message: "Frontend Developer foi adicionada às suas vagas salvas.",
  entityType: "job",
  entityId: "job-1",
  metadata: { company: "Empresa X" },
  readAt: null,
  createdAt: new Date("2026-07-18T10:00:00.000Z").toISOString(),
};

describe("Integration - Notifications Routes", () => {
  let app: ReturnType<typeof createJobsApiApp>;
  const BASE = "/notifications";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getIronSession).mockResolvedValue(fixtureSession as any);
    mockNotificationsService.list.mockResolvedValue({
      notifications: [fixtureNotification],
      unreadCount: 1,
    });
    mockNotificationsService.markRead.mockResolvedValue({
      ...fixtureNotification,
      readAt: new Date("2026-07-18T10:05:00.000Z").toISOString(),
    });
    mockNotificationsService.markAllRead.mockResolvedValue({ updated: 3 });

    app = createJobsApiApp();
  });

  it("lista notificações do usuário autenticado", async () => {
    const res = await request(app)
      .get(`${BASE}?channel=notification&limit=10`)
      .expect(200);

    expect(res.body).toHaveProperty("unreadCount", 1);
    expect(res.body.notifications).toHaveLength(1);
    expect(mockNotificationsService.list).toHaveBeenCalledWith(
      "user_abc",
      expect.objectContaining({
        channel: "notification",
        limit: 10,
      }),
    );
  });

  it("valida canal inválido na listagem", async () => {
    await request(app).get(`${BASE}?channel=email`).expect(400);
  });

  it("marca uma notificação como lida", async () => {
    const res = await request(app)
      .patch(`${BASE}/notification-1/read`)
      .expect(200);

    expect(res.body).toHaveProperty("readAt");
    expect(mockNotificationsService.markRead).toHaveBeenCalledWith(
      "user_abc",
      "notification-1",
    );
  });

  it("marca todas as notificações de um canal como lidas", async () => {
    const res = await request(app)
      .patch(`${BASE}/read-all?channel=message`)
      .expect(200);

    expect(res.body).toEqual({ updated: 3 });
    expect(mockNotificationsService.markAllRead).toHaveBeenCalledWith(
      "user_abc",
      "message",
    );
  });

  it("retorna 404 quando a notificação não existe", async () => {
    mockNotificationsService.markRead.mockRejectedValueOnce(
      AppError.notFound("Notificação não encontrada"),
    );

    await request(app).patch(`${BASE}/missing/read`).expect(404);
  });

  it("retorna 401 quando sessão não tem userId", async () => {
    vi.mocked(getIronSession).mockResolvedValueOnce({
      userId: undefined,
    } as any);

    await request(app).get(BASE).expect(401);
  });
});
