import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { credentials } from "../../../db/schema/credentials.js";
import { encryptText } from "../../../lib/security/encryption.js";
import { normalizeEmail } from "../../../lib/security/normalization.js";
import { generateSearchableHash } from "../../../lib/security/searchableHash.js";

export async function registerWithCredentials(
  email: string,
  password: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const emailHash = generateSearchableHash(normalizedEmail);

  const existing = await db.query.credentials.findFirst({
    where: eq(credentials.emailHash, emailHash),
  });

  if (existing) {
    throw new Error("Email já cadastrado");
  }

  const passwordHash = await argon2.hash(password);

  await db.insert(credentials).values({
    email: encryptText(normalizedEmail),
    emailHash,
    passwordHash,
    userId: "",
  });
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ userId: string }> {
  const emailHash = generateSearchableHash(normalizeEmail(email));

  const credential = await db.query.credentials.findFirst({
    where: eq(credentials.emailHash, emailHash),
  });

  if (!credential) {
    throw new Error("Credenciais inválidas");
  }

  const valid = await argon2.verify(credential.passwordHash, password);

  if (!valid) {
    throw new Error("Credenciais inválidas");
  }

  return { userId: credential.userId };
}
