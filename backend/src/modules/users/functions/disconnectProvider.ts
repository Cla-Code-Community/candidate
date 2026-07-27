import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { accounts } from "../../../db/schema";
import { DB } from "../../../db/types/types";
import { AppError } from "../../../lib/errors";

type DisconnectParams = { userId: string; provider: string };

export async function disconnectProvider(
  { userId, provider }: DisconnectParams,
  tx: DB = db,
): Promise<void> {
  const userAccounts = await tx.query.accounts.findMany({
    where: (acc, { eq }) => eq(acc.userId, userId),
  });

  const hasPassword = Boolean(
    await tx.query.credentials.findFirst({
      where: (c, { eq }) => eq(c.userId, userId),
    }),
  );

  const remainingProviders = new Set(
    userAccounts.map((a) => a.provider).filter((p) => p !== provider),
  );

  const methodsAfter = remainingProviders.size + (hasPassword ? 1 : 0);

  if (methodsAfter === 0) {
    throw AppError.conflict(
      "Não é possível desconectar seu último método de login.",
    );
  }

  await tx
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}
