import { db } from "../../../db/client";
import { DB } from "../../../db/types/types";

export const SUPPORTED_PROVIDERS = ["google", "linkedin", "github"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export type ConnectionStatus = {
  provider: SupportedProvider;
  connected: boolean;
  connectedAt: Date | null;
};

export type UserConnections = {
  hasPassword: boolean;
  connections: ConnectionStatus[];
};

export async function listUserConnections(
  userId: string,
  tx: DB = db,
): Promise<UserConnections> {
  const userAccounts = await tx.query.accounts.findMany({
    where: (acc, { eq }) => eq(acc.userId, userId),
  });

  const hasPassword = Boolean(
    await tx.query.credentials.findFirst({
      where: (c, { eq }) => eq(c.userId, userId),
    }),
  );

  const connections: ConnectionStatus[] = SUPPORTED_PROVIDERS.map((provider) => {
    const account = userAccounts.find((a) => a.provider === provider);
    return {
      provider,
      connected: Boolean(account),
      connectedAt: account?.createdAt ?? null,
    };
  });

  return { hasPassword, connections };
}
