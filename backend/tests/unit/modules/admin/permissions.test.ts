import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { can } from "../../../../src/modules/admin/permissions/rbac";
import {
  requirePermission,
  requireRole,
} from "../../../../src/modules/admin/permissions/requireRole";
import { hasMinRole } from "../../../../src/modules/admin/permissions/roles";

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("admin RBAC", () => {
  it("permite somente super_admin ler usuários", () => {
    expect(can("user", "users", "read")).toBe(false);
    expect(can("support", "users", "read")).toBe(false);
    expect(can("admin", "users", "read")).toBe(false);
    expect(can("super_admin", "users", "read")).toBe(true);
  });

  it("checks minimum role hierarchy", () => {
    expect(hasMinRole("admin", "support")).toBe(true);
    expect(hasMinRole("support", "admin")).toBe(false);
    expect(hasMinRole("super_admin", "admin")).toBe(true);
  });

  it("aplica a matriz de permissões por resource/action", () => {
    expect(can("support", "dashboard", "read")).toBe(true);
    expect(can("support", "scrapers", "read")).toBe(true);
    expect(can("support", "scrapers", "trigger")).toBe(false);
    expect(can("admin", "scrapers", "trigger")).toBe(true);
    expect(can("admin", "observability", "metrics")).toBe(true);
    expect(can("support", "audit", "read")).toBe(false);
    expect(can("admin", "audit", "read")).toBe(true);
    expect(can("admin", "users", "change_role")).toBe(false);
    expect(can("super_admin", "users", "change_role")).toBe(true);
    expect(can("support", "users", "delete" as any)).toBe(false);
  });

  it("requireRole retorna 401 quando não há sessão autenticada", () => {
    const req = { session: {} } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireRole("support")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("requirePermission retorna 403 quando a role não possui permissão", () => {
    const req = {
      session: { userId: "user-1", role: "admin" },
    } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requirePermission("users", "change_role")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("requirePermission retorna 401 quando a sessão não tem usuário ou role", () => {
    const res = mockResponse();
    const next = vi.fn();

    requirePermission("dashboard", "read")(
      { session: { userId: "user-1" } } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("requirePermission chama next quando a role possui permissão", () => {
    const req = {
      session: { userId: "user-1", role: "super_admin" },
    } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requirePermission("users", "read")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
