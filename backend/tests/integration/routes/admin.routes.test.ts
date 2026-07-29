import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROLE_LEVEL = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
} as const;

const PERMISSION_MIN_ROLE = {
  "dashboard.read": "support",
  "scrapers.read": "support",
  "observability.health": "support",
  "users.read": "admin",
  "users.block": "admin",
  "users.reset_password": "admin",
  "scrapers.trigger": "admin",
  "observability.metrics": "admin",
  "audit.read": "admin",
  "users.change_role": "super_admin",
  "users.delete": "super_admin",
} as const;

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn((_req, res) => res.json({ ok: true, scope: "dashboard" })),
  usersList: vi.fn((_req, res) => res.json({ data: [], total: 0 })),
  userById: vi.fn((req, res) => res.json({ id: req.params.id })),
  blockUser: vi.fn((_req, res) => res.json({ ok: true, action: "block" })),
  unblockUser: vi.fn((_req, res) =>
    res.json({ ok: true, action: "unblock" }),
  ),
  resetPassword: vi.fn((_req, res) =>
    res.json({ ok: true, action: "reset_password" }),
  ),
  changeRole: vi.fn((_req, res) =>
    res.json({ ok: true, action: "change_role" }),
  ),
  deleteUser: vi.fn((_req, res) => res.json({ ok: true, action: "delete" })),
  scrapersList: vi.fn((_req, res) => res.json({ scrapers: [] })),
  scrapersStatus: vi.fn((_req, res) => res.json({ running: false })),
  scrapersJobs: vi.fn((_req, res) => res.json({ jobs: [], total: 0 })),
  scrapersJobsCount: vi.fn((_req, res) => res.json({ total: 0 })),
  scrapersTrigger: vi.fn((_req, res) => res.status(202).json({ ok: true })),
  health: vi.fn((_req, res) => res.json({ status: "ok" })),
  metrics: vi.fn((_req, res) => res.json({ requestRatePerMinute: 1 })),
  dashboards: vi.fn((_req, res) => res.json({ dashboards: [] })),
  audit: vi.fn((_req, res) => res.json({ data: [], total: 0 })),
  permissionsRules: vi.fn((_req, res) => res.json({ rules: [] })),
  permissionsUpdateRules: vi.fn((_req, res) => res.json({ ok: true })),
  cacheClearJobs: vi.fn(),
}));

vi.mock("../../../src/routes/admin.context", () => ({
  dashboardCtrl: { getOverview: mocks.dashboard },
  usersCtrl: {
    listUsers: mocks.usersList,
    getUserById: mocks.userById,
    blockUser: mocks.blockUser,
    unblockUser: mocks.unblockUser,
    resetPassword: mocks.resetPassword,
    changeRole: mocks.changeRole,
    deleteUser: mocks.deleteUser,
  },
  scrapersCtrl: {
    list: mocks.scrapersList,
    status: mocks.scrapersStatus,
    listJobs: mocks.scrapersJobs,
    jobsCount: mocks.scrapersJobsCount,
    trigger: mocks.scrapersTrigger,
  },
  observabilityCtrl: {
    getHealth: mocks.health,
    getMetrics: mocks.metrics,
    getDashboards: mocks.dashboards,
  },
  auditCtrl: { getLogs: mocks.audit },
  permissionsCtrl: {
    listRules: mocks.permissionsRules,
    updateRules: mocks.permissionsUpdateRules,
  },
}));

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

vi.mock("../../../src/modules/admin/permissions/permissions.service", () => ({
  permissionsService: {
    can: vi.fn(async (role: keyof typeof ROLE_LEVEL, resource: string, action: string) => {
      const key = `${resource}.${action}` as keyof typeof PERMISSION_MIN_ROLE;
      const minRole = PERMISSION_MIN_ROLE[key];
      if (!minRole) return false;
      return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
    }),
  },
}));

vi.mock("../../../src/lib/cache", () => ({
  cacheAbsoluteSMembers: vi.fn(),
  cacheClearJobs: mocks.cacheClearJobs,
  cacheGetJobsByIds: vi.fn(),
  cacheSearchJobIds: vi.fn(),
  cacheSearchKeywords: vi.fn(),
  getCache: vi.fn(),
}));

import { getIronSession } from "iron-session";
import { createJobsApiApp } from "../../../src/app";

function session(role: "user" | "support" | "admin" | "super_admin") {
  return {
    userId: "actor-1",
    role,
    save: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Integration - Admin Routes", () => {
  let app: ReturnType<typeof createJobsApiApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheClearJobs.mockResolvedValue({
      deleted: 4,
      patterns: ["scraper:job:*", "scraper:jobs:*"],
    });
    vi.mocked(getIronSession).mockResolvedValue(session("support") as any);
    app = createJobsApiApp();
  });

  it("support acessa dashboard, scrapers e healthcheck", async () => {
    await request(app).get("/admin/dashboard").expect(200);
    await request(app).get("/admin/scrapers").expect(200);
    await request(app).get("/admin/observability/health").expect(200);

    expect(mocks.dashboard).toHaveBeenCalled();
    expect(mocks.scrapersList).toHaveBeenCalled();
    expect(mocks.health).toHaveBeenCalled();
  });

  it("support não lista usuários nem executa ações de admin", async () => {
    await request(app).get("/admin/users").expect(403);
    await request(app).patch("/admin/users/user-2/block").expect(403);
    await request(app).get("/admin/observability/metrics").expect(403);

    expect(mocks.usersList).not.toHaveBeenCalled();
    expect(mocks.blockUser).not.toHaveBeenCalled();
    expect(mocks.metrics).not.toHaveBeenCalled();
  });

  it("admin executa operações administrativas e lista usuários", async () => {
    vi.mocked(getIronSession).mockResolvedValue(session("admin") as any);

    await request(app).patch("/admin/users/user-2/block").expect(200);
    await request(app).post("/admin/users/user-2/reset").expect(200);
    await request(app).post("/admin/scrapers/run").expect(202);
    await request(app).get("/admin/observability/metrics").expect(200);
    await request(app).get("/admin/audit").expect(200);
    await request(app).get("/admin/users").expect(200);

    expect(mocks.blockUser).toHaveBeenCalled();
    expect(mocks.resetPassword).toHaveBeenCalled();
    expect(mocks.scrapersTrigger).toHaveBeenCalled();
    expect(mocks.metrics).toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.usersList).toHaveBeenCalled();
  });

  it("super_admin lista usuários, altera role e exclui usuário", async () => {
    vi.mocked(getIronSession).mockResolvedValue(session("super_admin") as any);

    await request(app).get("/admin/users").expect(200);
    await request(app).get("/admin/users/user-2").expect(200);
    await request(app).patch("/admin/users/user-2/role").send({
      role: "admin",
    }).expect(200);
    await request(app).delete("/admin/users/user-2").expect(200);

    expect(mocks.usersList).toHaveBeenCalled();
    expect(mocks.userById).toHaveBeenCalled();
    expect(mocks.changeRole).toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalled();
  });

  it("super_admin limpa cache de vagas do Valkey", async () => {
    vi.mocked(getIronSession).mockResolvedValue(session("super_admin") as any);

    const res = await request(app).delete("/admin/jobs/cache").expect(200);

    expect(mocks.cacheClearJobs).toHaveBeenCalled();
    expect(res.body).toEqual({
      ok: true,
      deleted: 4,
      patterns: ["scraper:job:*", "scraper:jobs:*"],
    });
  });

  it("admin não limpa cache de vagas do Valkey", async () => {
    vi.mocked(getIronSession).mockResolvedValue(session("admin") as any);

    await request(app).delete("/admin/jobs/cache").expect(403);

    expect(mocks.cacheClearJobs).not.toHaveBeenCalled();
  });

  it("usuário comum não acessa rotas administrativas", async () => {
    vi.mocked(getIronSession).mockResolvedValue(session("user") as any);

    await request(app).get("/admin/dashboard").expect(403);

    expect(mocks.dashboard).not.toHaveBeenCalled();
  });

  it("retorna 401 quando não há sessão autenticada", async () => {
    vi.mocked(getIronSession).mockResolvedValue({
      save: vi.fn(),
      destroy: vi.fn(),
    } as any);

    await request(app).get("/admin/dashboard").expect(401);
  });
});
