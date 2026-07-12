import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { userPreferences } from "../../db/schema";
import { credentials } from "../../db/schema/credentials";
import type { User } from "../../db/schema/users";
import { users } from "../../db/schema/users";
import { AppError } from "../../lib/errors";
import { generateUsername } from "../../utils/generateUsername";
import type { Session } from "../types/auth.types";
import {
  LoginInput,
  LoginSchema,
  RegisterInput,
  RegisterSchema,
} from "../types/credentials.types";

const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export class CredentialsService {
  async findById(id: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    return user ?? null;
  }

  async register(
    input: RegisterInput,
  ): Promise<{ user: User; session: Session }> {
    const { email, password, name, phone, cpf, technologies, level } =
      RegisterSchema.parse(input);

    const existingCredential = await db.query.credentials.findFirst({
      where: eq(credentials.email, email),
    });
    if (existingCredential) {
      throw AppError.conflict("Email já cadastrado");
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingUser) {
      throw AppError.conflict("Email já cadastrado");
    }

    const passwordHash = await argon2.hash(password, argonOptions);

    const user = await db.transaction(async (tx) => {
      const baseName = name?.trim() || email.split("@")[0];
      const username = await generateUsername(baseName, tx);

      const [createdUser] = await tx
        .insert(users)
        .values({
          email,
          displayName: name,
          username,
          emailVerified: false,
          phone,
          cpf,
          technologies,
          level,
        })
        .returning();

      await tx
        .insert(credentials)
        .values({ userId: createdUser.id, email, passwordHash });
      await tx.insert(userPreferences).values({ userId: createdUser.id });

      return createdUser;
    });

    return { user, session: { userId: user.id, role: user.role } };
  }

  async login(input: LoginInput): Promise<{ user: User; session: Session }> {
    const { email, password } = LoginSchema.parse(input);

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.email, email),
    });
    if (!credential) {
      throw AppError.unauthorized("Credenciais inválidas");
    }

    const valid = await argon2.verify(credential.passwordHash, password);
    if (!valid) {
      throw AppError.unauthorized("Credenciais inválidas");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, credential.userId),
    });
    if (!user) {
      throw AppError.notFound("Usuário não encontrado");
    }

    return { user, session: { userId: user.id, role: user.role } };
  }
}
