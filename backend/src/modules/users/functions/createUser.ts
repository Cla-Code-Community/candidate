import { db } from "../../../db/client";
import { users } from "../../../db/schema/users";
import { DB } from "../../../db/types/types";
import { generateUsername } from "../../../utils/generateUsername";
import { findUserByEmail } from "./findUsers";

export type CreateUserParams = {
  email: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  username?: string | null;
  phone?: string | null;
  cpf?: string | null;
  technologies?: string[] | null;
  level?: string | null;
};

type CreateUserOptions = {
  onEmailConflict?: "throw" | "returnExisting";
};

export async function createUser(
  profile: CreateUserParams,
  tx: DB = db,
  options: CreateUserOptions = {},
) {
  const baseName =
    profile.username ||
    profile.displayName ||
    profile.email?.split("@")[0] ||
    "user";

  const username = profile.username ?? (await generateUsername(baseName, tx));

  try {
    const result = await tx
      .insert(users)
      .values({
        email: profile.email,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        displayName: profile.displayName ?? null,
        username,
        avatarUrl: profile.avatarUrl ?? null,
        phone: profile.phone ?? null,
        cpf: profile.cpf ?? null,
        technologies: profile.technologies ?? undefined,
        level: profile.level ?? null,
      })
      .returning();

    return result[0];
  } catch (err: any) {
    if (err.code === "23505" && options.onEmailConflict === "returnExisting") {
      if (!profile.email) throw err;

      const existingUser = await findUserByEmail(profile.email, tx);
      if (!existingUser) throw err;

      return existingUser;
    }

    throw err;
  }
}
