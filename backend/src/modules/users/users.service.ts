import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { User, UserPreferences, userPreferences, users } from "../../db/schema";
import { DB } from "../../db/types/types";
import { AppError } from "../../lib/errors";
import { UpdateProfileData } from "../types/user.types";
import { UpdatePreferencesData } from "./schemas/user.schemas";
import { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(private readonly tx: DB = db) {}

  async getUserById(id: string): Promise<User | undefined> {
    return (await new UsersRepository(this.tx).findById(id)) ?? undefined;
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    const updated = await new UsersRepository(this.tx).updateProfile(
      userId,
      data,
    );

    if (!updated) {
      throw AppError.notFound("Usuário não encontrado");
    }

    // await this.valkey.del(`user:${userId}`); ← invalidação de cache futura
    return updated;
  }

  async getPreferences(userId: string): Promise<UserPreferences | undefined> {
    return this.tx.query.userPreferences.findFirst({
      where: (p, { eq }) => eq(p.userId, userId),
    });
  }

  async createPreferences(
    userId: string,
    data: Partial<UpdatePreferencesData> = {},
  ): Promise<UserPreferences> {
    const result = await this.tx
      .insert(userPreferences)
      .values({ userId, ...data })
      .returning();
    return result[0];
  }

  async updatePreferences(
    userId: string,
    data: UpdatePreferencesData,
  ): Promise<UserPreferences> {
    const result = await this.tx
      .update(userPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (!result[0]) {
      throw AppError.notFound("Preferências não encontradas");
    }

    return result[0];
  }
}
