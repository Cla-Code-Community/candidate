import * as argon2 from "argon2";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { db } from "../../../db/client";
import { credentials } from "../../../db/schema/credentials";
import { users } from "../../../db/schema/users";
import type {
  AdminUserFilters,
  ChangeRoleInput,
  PaginatedUsers,
  ResetPasswordInput,
} from "./adminUsers.types";

const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export class AdminUsersRepository {
  async findMany(filters: AdminUserFilters): Promise<PaginatedUsers> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const conditions = [
      filters.role ? eq(users.role, filters.role) : undefined,
      filters.isBlocked !== undefined
        ? eq(users.isBlocked, filters.isBlocked)
        : undefined,
      filters.search
        ? or(
            ilike(users.email, `%${filters.search}%`),
            ilike(users.username, `%${filters.search}%`),
            ilike(users.displayName, `%${filters.search}%`),
          )
        : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(users).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(users).where(where),
    ]);

    return { data, total, limit, offset };
  }

  async findById(id: string) {
    return db.query.users.findFirst({ where: eq(users.id, id) }) ?? null;
  }

  async setBlocked(id: string, isBlocked: boolean) {
    const [updated] = await db
      .update(users)
      .set({ isBlocked, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated ?? null;
  }

  async changeRole({ userId, newRole }: ChangeRoleInput) {
    const [updated] = await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated ?? null;
  }

  async resetPassword({ userId, newPassword }: ResetPasswordInput) {
    const passwordHash = await argon2.hash(newPassword, argonOptions);

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.userId, userId),
    });

    if (!credential) throw new Error("Credencial não encontrada");

    await db
      .update(credentials)
      .set({ passwordHash })
      .where(eq(credentials.userId, userId));
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return deleted ?? null;
  }
}
