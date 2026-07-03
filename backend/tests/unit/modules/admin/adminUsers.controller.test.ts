import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUsersController } from "../../../../src/modules/admin/users/adminUsers.controller";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function request(input: Partial<Request> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    session: { userId: "admin-1", role: "super_admin" },
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...input,
  } as unknown as Request;
}

describe("AdminUsersController", () => {
  const user = {
    id: "user-1",
    email: "user@example.com",
    username: "user",
    role: "user",
    isBlocked: false,
  };
  const service = {
    listUsers: vi.fn(),
    getUserById: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    changeRole: vi.fn(),
    resetPassword: vi.fn(),
    deleteUser: vi.fn(),
  };
  const auditService = {
    fromRequest: vi.fn(),
  };
  const controller = new AdminUsersController(service as any, auditService as any);

  beforeEach(() => {
    vi.clearAllMocks();
    service.listUsers.mockResolvedValue({ data: [user], total: 1, limit: 50, offset: 0 });
    service.getUserById.mockResolvedValue(user);
    service.blockUser.mockResolvedValue({ ...user, isBlocked: true });
    service.unblockUser.mockResolvedValue(user);
    service.changeRole.mockResolvedValue({ ...user, role: "admin" });
    service.resetPassword.mockResolvedValue(undefined);
    service.deleteUser.mockResolvedValue(user);
  });

  it("lists users with parsed query and audits the read", async () => {
    const req = request({ query: { search: "hudson", limit: "10", offset: "2" } });
    const res = response();

    await controller.listUsers(req, res);

    expect(service.listUsers).toHaveBeenCalledWith({
      search: "hudson",
      limit: 10,
      offset: 2,
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "users.read");
    expect(res.json).toHaveBeenCalledWith({ data: [user], total: 1, limit: 50, offset: 0 });
  });

  it("returns 400 for invalid list query", async () => {
    const res = response();

    await controller.listUsers(request({ query: { limit: "999" } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 when listing users fails", async () => {
    service.listUsers.mockRejectedValueOnce(new Error("db down"));
    const res = response();

    await controller.listUsers(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("gets a user by id and maps not found to 404", async () => {
    const res = response();
    await controller.getUserById(request({ params: { id: "user-1" } }), res);

    expect(res.json).toHaveBeenCalledWith({ user });

    service.getUserById.mockRejectedValueOnce(new Error("Usuário não encontrado"));
    const notFoundRes = response();
    await controller.getUserById(request({ params: { id: "missing" } }), notFoundRes);

    expect(notFoundRes.status).toHaveBeenCalledWith(404);
  });

  it("blocks and unblocks users with audit target", async () => {
    const req = request({ params: { id: "user-1" } });

    await controller.blockUser(req, response());
    await controller.unblockUser(req, response());

    expect(service.blockUser).toHaveBeenCalledWith("user-1");
    expect(service.unblockUser).toHaveBeenCalledWith("user-1");
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "users.block", {
      type: "users",
      id: "user-1",
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "users.unblock", {
      type: "users",
      id: "user-1",
    });
  });

  it("maps duplicated block operations to 409", async () => {
    service.blockUser.mockRejectedValueOnce(new Error("Usuário já está bloqueado"));
    const res = response();

    await controller.blockUser(request({ params: { id: "user-1" } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("maps unblock conflicts and failures to proper statuses", async () => {
    service.unblockUser.mockRejectedValueOnce(
      new Error("Usuário não está bloqueado"),
    );
    const conflictRes = response();
    await controller.unblockUser(request({ params: { id: "user-1" } }), conflictRes);
    expect(conflictRes.status).toHaveBeenCalledWith(409);

    service.unblockUser.mockRejectedValueOnce(new Error("db down"));
    const errorRes = response();
    await controller.unblockUser(request({ params: { id: "user-1" } }), errorRes);
    expect(errorRes.status).toHaveBeenCalledWith(500);
  });

  it("changes role with previous/new role metadata", async () => {
    const req = request({ params: { id: "user-1" }, body: { role: "admin" } });
    const res = response();

    await controller.changeRole(req, res);

    expect(service.changeRole).toHaveBeenCalledWith({
      userId: "user-1",
      newRole: "admin",
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(
      req,
      "users.change_role",
      { type: "users", id: "user-1" },
      { previousRole: "user", newRole: "admin" },
    );
  });

  it("maps change role not found, same role and generic failures", async () => {
    service.getUserById.mockRejectedValueOnce(new Error("Usuário não encontrado"));
    const notFoundRes = response();
    await controller.changeRole(
      request({ params: { id: "missing" }, body: { role: "admin" } }),
      notFoundRes,
    );
    expect(notFoundRes.status).toHaveBeenCalledWith(404);

    service.changeRole.mockRejectedValueOnce(
      new Error("Usuário já possui esta role"),
    );
    const conflictRes = response();
    await controller.changeRole(
      request({ params: { id: "user-1" }, body: { role: "admin" } }),
      conflictRes,
    );
    expect(conflictRes.status).toHaveBeenCalledWith(409);

    service.changeRole.mockRejectedValueOnce(new Error("db down"));
    const errorRes = response();
    await controller.changeRole(
      request({ params: { id: "user-1" }, body: { role: "admin" } }),
      errorRes,
    );
    expect(errorRes.status).toHaveBeenCalledWith(500);
  });

  it("validates change role and reset password bodies", async () => {
    const roleRes = response();
    await controller.changeRole(request({ params: { id: "user-1" }, body: { role: "owner" } }), roleRes);
    expect(roleRes.status).toHaveBeenCalledWith(400);

    const resetRes = response();
    await controller.resetPassword(
      request({ params: { id: "user-1" }, body: { newPassword: "short" } }),
      resetRes,
    );
    expect(resetRes.status).toHaveBeenCalledWith(400);
  });

  it("resets password and deletes user", async () => {
    const req = request({
      params: { id: "user-1" },
      body: { newPassword: "Senha@123" },
    });

    await controller.resetPassword(req, response());
    await controller.deleteUser(request({ params: { id: "user-1" } }), response());

    expect(service.resetPassword).toHaveBeenCalledWith({
      userId: "user-1",
      newPassword: "Senha@123",
    });
    expect(service.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("maps reset password not found and generic failures", async () => {
    service.resetPassword.mockRejectedValueOnce(
      new Error("Usuário não encontrado"),
    );
    const notFoundRes = response();
    await controller.resetPassword(
      request({ params: { id: "missing" }, body: { newPassword: "Senha@123" } }),
      notFoundRes,
    );
    expect(notFoundRes.status).toHaveBeenCalledWith(404);

    service.resetPassword.mockRejectedValueOnce(new Error("db down"));
    const errorRes = response();
    await controller.resetPassword(
      request({ params: { id: "user-1" }, body: { newPassword: "Senha@123" } }),
      errorRes,
    );
    expect(errorRes.status).toHaveBeenCalledWith(500);
  });

  it("maps delete user not found and generic failures", async () => {
    service.deleteUser.mockRejectedValueOnce(new Error("Usuário não encontrado"));
    const notFoundRes = response();
    await controller.deleteUser(request({ params: { id: "missing" } }), notFoundRes);
    expect(notFoundRes.status).toHaveBeenCalledWith(404);

    service.deleteUser.mockRejectedValueOnce(new Error("db down"));
    const errorRes = response();
    await controller.deleteUser(request({ params: { id: "user-1" } }), errorRes);
    expect(errorRes.status).toHaveBeenCalledWith(500);
  });
});
