import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { accounts } from "../../../db/schema";
import { DB } from "../../../db/types/types";
import { AppError } from "../../../lib/errors";

type DisconnectParams = { userId: string; provider: string };

async function runDisconnect(
  { userId, provider }: DisconnectParams,
  tx: DB,
): Promise<void> {
  const userAccounts = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .for("update");

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

export async function disconnectProvider(
  params: DisconnectParams,
  tx?: DB,
): Promise<void> {
  if (tx) return runDisconnect(params, tx);
  return db.transaction((t) => runDisconnect(params, t as unknown as DB));
}
