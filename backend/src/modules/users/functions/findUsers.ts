import { db } from "../../../db/client";
import { DB } from "../../../db/types/types";
import { UsersRepository } from "../users.repository";

export async function findUserByProvider(
  {
    provider,
    providerAccountId,
  }: { provider: string; providerAccountId: string },
  tx: DB = db,
) {
  const existingAccount = await tx.query.accounts.findFirst({
    where: (acc, { eq, and }) =>
      and(
        eq(acc.provider, provider),
        eq(acc.providerAccountId, providerAccountId),
      ),
  });

  if (!existingAccount) return null;

  return tx.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, existingAccount.userId),
  });
}

export async function findUserByEmail(email: string, tx: DB = db) {
  return new UsersRepository(tx).findByEmail(email);
}
