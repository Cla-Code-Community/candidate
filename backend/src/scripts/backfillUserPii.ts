import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { credentials } from "../db/schema/credentials";
import { users } from "../db/schema/users";
import {
  decryptText,
  encryptText,
  isEncryptedPayload,
} from "../lib/security/encryption";
import { normalizeEmail } from "../lib/security/normalization";
import {
  protectCpf,
  protectEmail,
  protectNullableText,
} from "../lib/security/piiPayload";
import { generateSearchableHash } from "../lib/security/searchableHash";

const shouldWrite = process.argv.includes("--write");

async function backfillUsers() {
  const rows = await db.select().from(users);
  let pending = 0;

  for (const user of rows) {
    const nextValues: Partial<typeof users.$inferInsert> = {};

    if (user.email) {
      if (!user.emailEncrypted || !user.emailHash) {
        Object.assign(nextValues, protectEmail(user.email));
      }
      nextValues.email = null;
    }

    if (user.firstName) {
      if (!user.firstNameEncrypted) {
        nextValues.firstNameEncrypted = protectNullableText(user.firstName);
      }
      nextValues.firstName = null;
    }

    if (user.lastName) {
      if (!user.lastNameEncrypted) {
        nextValues.lastNameEncrypted = protectNullableText(user.lastName);
      }
      nextValues.lastName = null;
    }

    if (user.displayName) {
      if (!user.displayNameEncrypted) {
        nextValues.displayNameEncrypted = protectNullableText(user.displayName);
      }
      nextValues.displayName = null;
    }

    if (user.avatarUrl) {
      if (!user.avatarUrlEncrypted) {
        nextValues.avatarUrlEncrypted = protectNullableText(user.avatarUrl);
      }
      nextValues.avatarUrl = null;
    }

    if (user.phone) {
      if (!user.phoneEncrypted) {
        nextValues.phoneEncrypted = protectNullableText(user.phone);
      }
      nextValues.phone = null;
    }

    if (user.cpf) {
      if (!user.cpfEncrypted || !user.cpfHash) {
        Object.assign(nextValues, protectCpf(user.cpf));
      }
      nextValues.cpf = null;
    }

    if (user.technologies) {
      if (!user.technologiesEncrypted) {
        nextValues.technologiesEncrypted = protectNullableText(
          JSON.stringify(user.technologies),
        );
      }
      nextValues.technologies = null;
    }

    if (user.level) {
      if (!user.levelEncrypted) {
        nextValues.levelEncrypted = protectNullableText(user.level);
      }
      nextValues.level = null;
    }

    if (Object.keys(nextValues).length === 0) continue;

    pending += 1;

    if (shouldWrite) {
      await db.update(users).set(nextValues).where(eq(users.id, user.id));
    }
  }

  return { scanned: rows.length, pending };
}

async function backfillCredentials() {
  const rows = await db.select().from(credentials);
  let pending = 0;

  for (const credential of rows) {
    const email = isEncryptedPayload(credential.email)
      ? decryptText(credential.email)
      : credential.email;
    const normalizedEmail = normalizeEmail(email);
    const nextValues: Partial<typeof credentials.$inferInsert> = {};

    if (!credential.emailHash) {
      nextValues.emailHash = generateSearchableHash(normalizedEmail);
    }

    if (!isEncryptedPayload(credential.email)) {
      nextValues.email = encryptText(normalizedEmail);
    }

    if (Object.keys(nextValues).length === 0) continue;

    if (shouldWrite) {
      await db
        .update(credentials)
        .set(nextValues)
        .where(eq(credentials.id, credential.id));
    }

    pending += 1;
  }

  return { scanned: rows.length, pending };
}

async function main() {
  const [userResult, credentialResult] = await Promise.all([
    backfillUsers(),
    backfillCredentials(),
  ]);

  console.log(
    JSON.stringify(
      {
        mode: shouldWrite ? "write" : "dry-run",
        users: userResult,
        credentials: credentialResult,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
