import type { Request } from "express";
import type { Resource } from "../permissions/permissionMatrix";
import type { Role } from "../permissions/roles";
import { AuditRepository } from "./audit.repository";
import type {
  AuditAction,
  AuditFilters,
  PaginatedAuditLogs,
  WriteAuditLogInput,
} from "./audit.types";

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async log(input: WriteAuditLogInput): Promise<void> {
    // fire-and-forget — falha no audit não pode derrubar a operação principal
    this.repository.write(input).catch((err) => {
      console.error("[audit] failed to write log", { input, err });
    });
  }

  // Helper para usar direto nos controllers — extrai ip e actor da request
  fromRequest(
    req: Request,
    action: AuditAction,
    target?: { type: Resource; id: string },
    metadata?: Record<string, unknown>,
  ): void {
    const { userId, role } = req.session;

    if (!userId || !role) return;

    this.log({
      actorId: userId,
      actorRole: role as Role,
      action,
      targetType: target?.type,
      targetId: target?.id,
      metadata,
      ip:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
        req.socket.remoteAddress,
    });
  }

  async getLogs(filters: AuditFilters): Promise<PaginatedAuditLogs> {
    return this.repository.findMany(filters);
  }
}
