import { db } from "../../../db/client";
import { DB } from "../../../db/types/types";
import { AppError } from "../../../lib/errors";
import { OAuthProfile } from "../../types/auth.types";
import { createAccount } from "./createAccount";

type LinkProviderParams = {
  userId: string;
  provider: string;
  profile: OAuthProfile;
};

export async function linkProviderToUser(
  { userId, provider, profile }: LinkProviderParams,
  tx: DB = db,
): Promise<void> {
  const existingAccount = await tx.query.accounts.findFirst({
    where: (acc, { eq, and }) =>
      and(eq(acc.provider, provider), eq(acc.providerAccountId, profile.id)),
  });

  if (existingAccount) {
    if (existingAccount.userId === userId) return;
    throw AppError.conflict("Essa conta já está vinculada a outro usuário.");
  }

  await createAccount({ userId, provider, profile }, tx);
}
