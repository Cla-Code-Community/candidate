import type { Request, Response } from "express";
import { z } from "zod";
import type { AuditService } from "../audit/audit.service";
import type { Role } from "../permissions/roles";
import type { AdminUsersService } from "./adminUsers.service";

// req.params pode ser string | string[] — garante string simples
function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}

const ListUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["user", "support", "admin", "super_admin"]).optional(),
  isBlocked: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ChangeRoleBodySchema = z.object({
  role: z.enum(["user", "support", "admin", "super_admin"]),
});

const ResetPasswordBodySchema = z.object({
  newPassword: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

export class AdminUsersController {
  constructor(
    private readonly service: AdminUsersService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(req: Request, res: Response) {
    try {
      const query = ListUsersQuerySchema.parse(req.query);
      const result = await this.service.listUsers(query);

      this.auditService.fromRequest(req, "users.read");

      return res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      return res.status(500).json({ error: "Erro interno" });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const user = await this.service.getUserById(id);

      this.auditService.fromRequest(req, "users.read", { type: "users", id });

      return res.json({ user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message === "Usuário não encontrado" ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async blockUser(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const user = await this.service.blockUser(id);

      this.auditService.fromRequest(req, "users.block", { type: "users", id });

      return res.json({ user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      const status =
        message === "Usuário não encontrado"
          ? 404
          : message === "Usuário já está bloqueado"
            ? 409
            : 500;
      return res.status(status).json({ error: message });
    }
  }

  async unblockUser(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const user = await this.service.unblockUser(id);

      this.auditService.fromRequest(req, "users.unblock", {
        type: "users",
        id,
      });

      return res.json({ user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      const status =
        message === "Usuário não encontrado"
          ? 404
          : message === "Usuário não está bloqueado"
            ? 409
            : 500;
      return res.status(status).json({ error: message });
    }
  }

  async changeRole(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const { role } = ChangeRoleBodySchema.parse(req.body);
      const previousUser = await this.service.getUserById(id);
      const user = await this.service.changeRole({
        userId: id,
        newRole: role as Role,
      });

      this.auditService.fromRequest(
        req,
        "users.change_role",
        { type: "users", id },
        {
          previousRole: previousUser.role,
          newRole: role,
        },
      );

      return res.json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      const message = error instanceof Error ? error.message : "Erro interno";
      const status =
        message === "Usuário não encontrado"
          ? 404
          : message === "Usuário já possui esta role"
            ? 409
            : 500;
      return res.status(status).json({ error: message });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const { newPassword } = ResetPasswordBodySchema.parse(req.body);

      await this.service.resetPassword({ userId: id, newPassword });

      this.auditService.fromRequest(req, "users.reset_password", {
        type: "users",
        id,
      });

      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.format() });
      }
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message === "Usuário não encontrado" ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = param(req, "id");
      const deleted = await this.service.deleteUser(id);

      this.auditService.fromRequest(
        req,
        "users.delete",
        { type: "users", id },
        {
          deletedUser: {
            email: deleted.email,
            username: deleted.username,
            role: deleted.role,
          },
        },
      );

      return res.json({ ok: true, user: deleted });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      const status = message === "Usuário não encontrado" ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  }
}
