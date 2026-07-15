import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { users } from "../../db/schema/users";
import type { DB } from "../../db/types/types";
import { normalizeEmail } from "../../lib/security/normalization";
import { generateSearchableHash } from "../../lib/security/searchableHash";
import type { CreateUserParams } from "./functions/createUser";
import type { UpdateProfileData } from "../types/user.types";
import {
  toPublicUser,
  toUserCreateValues,
  toUserUpdateValues,
} from "./users.mapper";

export class UsersRepository {
  constructor(private readonly tx: DB = db) {}

  async create(profile: CreateUserParams, username: string) {
    const [created] = await this.tx
      .insert(users)
      .values({
        ...toUserCreateValues(profile),
        username,
      })
      .returning();

    return created ? toPublicUser(created) : created;
  }

  async findById(id: string) {
    const user = await this.tx.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, id),
    });

    return user ? toPublicUser(user) : undefined;
  }

  async findByEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const emailHash = generateSearchableHash(normalizedEmail);

    const user = await this.tx.query.users.findFirst({
      where: eq(users.emailHash, emailHash),
    });

    return user ? toPublicUser(user) : undefined;
  }

  async updateProfile(userId: string, data: UpdateProfileData) {
    const [updated] = await this.tx
      .update(users)
      .set({ ...toUserUpdateValues(data), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return updated ? toPublicUser(updated) : null;
  }
}
