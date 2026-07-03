import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { userPreferences } from "../../db/schema";
import { credentials } from "../../db/schema/credentials";
import type { User } from "../../db/schema/users";
import { users } from "../../db/schema/users";
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
    const { email, password, name, phone, cpf, technologies, level, role } = RegisterSchema.parse(input);

    const existingCredential = await db.query.credentials.findFirst({
      where: eq(credentials.email, email),
    });
    if (existingCredential) throw new Error("Email já cadastrado");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingUser) throw new Error("Email já cadastrado");

    const passwordHash = await argon2.hash(password, argonOptions);
    const username = await generateUsername(name ?? email.split("@")[0], db);

    const [user] = await db
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
        role
      })
      .returning();

    await db.insert(credentials).values({ userId: user.id, email, passwordHash });
    await db.insert(userPreferences).values({ userId: user.id });

    return { user, session: { userId: user.id, role: user.role } };
  }

  async login(input: LoginInput): Promise<{ user: User; session: Session }> {
    const { email, password } = LoginSchema.parse(input);

    const credential = await db.query.credentials.findFirst({
      where: eq(credentials.email, email),
    });
    if (!credential) throw new Error("Credenciais inválidas");

    const valid = await argon2.verify(credential.passwordHash, password);
    if (!valid) throw new Error("Credenciais inválidas");

    const user = await db.query.users.findFirst({
      where: eq(users.id, credential.userId),
    });
    if (!user) throw new Error("Usuário não encontrado");

    return { user, session: { userId: user.id, role: user.role } };
  }
}
