import { and, between, count, desc, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { auditLogs } from "../../../db/schema/auditLogs";
import type {
  AuditFilters,
  PaginatedAuditLogs,
  WriteAuditLogInput,
} from "./audit.types";

export class AuditRepository {
  async write(input: WriteAuditLogInput): Promise<void> {
    await db.insert(auditLogs).values({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ip: input.ip,
    });
  }

  async findMany(filters: AuditFilters): Promise<PaginatedAuditLogs> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const conditions = [
      filters.actorId ? eq(auditLogs.actorId, filters.actorId) : undefined,
      filters.action ? eq(auditLogs.action, filters.action) : undefined,
      filters.targetType
        ? eq(auditLogs.targetType, filters.targetType)
        : undefined,
      filters.targetId ? eq(auditLogs.targetId, filters.targetId) : undefined,
      filters.from && filters.to
        ? between(auditLogs.createdAt, filters.from, filters.to)
        : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(auditLogs).where(where),
    ]);

    return { data, total, limit, offset };
  }
}
