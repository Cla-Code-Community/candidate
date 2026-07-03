import { count, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { users } from "../../../db/schema/users";

export class DashboardRepository {
  async countUsers(): Promise<number> {
    const [{ value }] = await db.select({ value: count() }).from(users);
    return value;
  }

  async countActiveUsers(): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.isBlocked, false));

    return value;
  }
}
