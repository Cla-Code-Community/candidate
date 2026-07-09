import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoUpdate: vi.fn(),
}));

vi.mock("../../../../src/db/client", () => ({
  db: {
    select: vi.fn(() => ({ from: mocks.selectFrom })),
    insert: vi.fn(() => ({ values: mocks.insertValues })),
  },
}));

vi.mock("../../../../src/db/schema/permissionRules", () => ({
  permissionRules: {
    resource: "resource",
    action: "action",
  },
}));

import { PermissionsController } from "../../../../src/modules/admin/permissions/permissions.controller";
import * as permissionsModule from "../../../../src/modules/admin/permissions/permissions.service";
import { PermissionsService } from "../../../../src/modules/admin/permissions/permissions.service";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const req = {
  body: {},
  session: { userId: "admin-1", role: "super_admin" },
  headers: {},
  socket: { remoteAddress: "127.0.0.1" },
} as unknown as Request;

describe("PermissionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectFrom.mockResolvedValue([]);
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.insertValues.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
    });
  });

  it("combina regras padrão com overrides salvos", async () => {
    mocks.selectFrom.mockResolvedValueOnce([
      {
        resource: "dashboard",
        action: "read",
        minRole: "admin",
        reason: "Restrito temporariamente",
      },
    ]);

    const rules = await new PermissionsService().getRules();
    const dashboardRead = rules.find(
      (rule) => rule.resource === "dashboard" && rule.action === "read",
    );

    expect(dashboardRead).toMatchObject({
      defaultMinRole: "support",
      minRole: "admin",
      customized: true,
      reason: "Restrito temporariamente",
    });
  });

  it("aplica overrides na matriz efetiva e avalia permissões", async () => {
    mocks.selectFrom.mockResolvedValue([
      { resource: "dashboard", action: "read", minRole: "admin" },
      { resource: "unknown", action: "read", minRole: "super_admin" },
    ]);

    const service = new PermissionsService();

    await expect(service.can("support", "dashboard", "read")).resolves.toBe(
      false,
    );
    await expect(service.can("admin", "dashboard", "read")).resolves.toBe(true);
    await expect(service.can("admin", "users", "manage" as any)).resolves.toBe(
      false,
    );
  });

  it("usa matriz padrão quando a leitura dinâmica falha", async () => {
    mocks.selectFrom.mockRejectedValueOnce(new Error("db down"));

    await expect(
      new PermissionsService().can("support", "dashboard", "read"),
    ).resolves.toBe(true);
  });

  it("salva regras editáveis e retorna a lista atualizada", async () => {
    mocks.selectFrom.mockResolvedValueOnce([
      {
        resource: "dashboard",
        action: "read",
        minRole: "admin",
        reason: "review",
      },
    ]);

    const rules = await new PermissionsService().updateRules([
      {
        resource: "dashboard",
        action: "read",
        minRole: "admin",
        reason: "review",
      },
    ]);

    expect(mocks.insertValues).toHaveBeenCalledWith({
      resource: "dashboard",
      action: "read",
      minRole: "admin",
      reason: "review",
    });
    expect(mocks.onConflictDoUpdate).toHaveBeenCalled();
    expect(
      rules.find(
        (rule) => rule.resource === "dashboard" && rule.action === "read",
      ),
    ).toMatchObject({ resource: "dashboard", minRole: "admin" });
  });

  it("rejeita regras desconhecidas e regras imutáveis", async () => {
    const service = new PermissionsService();

    await expect(
      service.updateRules([
        { resource: "users", action: "manage" as any, minRole: "admin" },
      ]),
    ).rejects.toThrow("Regra desconhecida: users.manage");

    await expect(
      service.updateRules([
        { resource: "users", action: "delete", minRole: "admin" },
      ]),
    ).rejects.toThrow("Regra imutavel: users.delete");
  });
});

describe("PermissionsController", () => {
  const auditService = { fromRequest: vi.fn() };
  const controller = new PermissionsController(auditService as any);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("lista regras e registra auditoria", async () => {
    const rules = [{ resource: "dashboard", action: "read" }];
    vi.spyOn(permissionsModule.permissionsService, "getRules").mockResolvedValue(
      rules as any,
    );
    const res = response();

    await controller.listRules(req, res);

    expect(res.json).toHaveBeenCalledWith({ rules });
    expect(auditService.fromRequest).toHaveBeenCalledWith(
      req,
      "permissions.read",
    );
  });

  it("retorna 500 quando listar regras falha", async () => {
    vi.spyOn(permissionsModule.permissionsService, "getRules").mockRejectedValue(
      new Error("db down"),
    );
    const res = response();

    await controller.listRules(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("atualiza regras válidas e registra auditoria com payload", async () => {
    const body = {
      rules: [
        {
          resource: "dashboard",
          action: "read",
          minRole: "admin",
          reason: null,
        },
      ],
    };
    const rules = [{ ...body.rules[0], defaultMinRole: "support" }];
    vi.spyOn(
      permissionsModule.permissionsService,
      "updateRules",
    ).mockResolvedValue(rules as any);
    const res = response();

    await controller.updateRules({ ...req, body } as Request, res);

    expect(permissionsModule.permissionsService.updateRules).toHaveBeenCalledWith(
      body.rules,
    );
    expect(res.json).toHaveBeenCalledWith({ rules });
    expect(auditService.fromRequest).toHaveBeenCalledWith(
      expect.anything(),
      "permissions.update",
      undefined,
      { rules: body.rules },
    );
  });

  it("retorna 400 para payload inválido e erro de serviço", async () => {
    const invalidRes = response();
    await controller.updateRules(
      { ...req, body: { rules: [{ resource: "x" }] } } as Request,
      invalidRes,
    );
    expect(invalidRes.status).toHaveBeenCalledWith(400);

    vi.spyOn(
      permissionsModule.permissionsService,
      "updateRules",
    ).mockRejectedValue(new Error("Regra imutavel: users.delete"));
    const serviceErrorRes = response();
    await controller.updateRules(
      {
        ...req,
        body: {
          rules: [
            { resource: "users", action: "delete", minRole: "admin" },
          ],
        },
      } as Request,
      serviceErrorRes,
    );

    expect(serviceErrorRes.status).toHaveBeenCalledWith(400);
    expect(serviceErrorRes.json).toHaveBeenCalledWith({
      error: "Regra imutavel: users.delete",
    });
  });
});
