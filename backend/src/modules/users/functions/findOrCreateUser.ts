import { db } from "../../../db/client";
import { OAuthProfile } from "../../types/auth.types";
import { createAccount } from "./createAccount";
import { createUser, type CreateUserParams } from "./createUser";
import { findUserByEmail, findUserByProvider } from "./findUsers";

type FindOrCreateUserParams = {
  provider: string;
  profile: OAuthProfile;
};

/**
 * Resultado do `findOrCreateUser`. `isNewUser` distingue o primeiro login
 * social (conta recém-criada) de um relogin ou da vinculação de um provider
 * a um usuário que já existia — usado para disparar boas-vindas só uma vez.
 */
export type FindOrCreateUserResult = {
  user: Awaited<ReturnType<typeof createUser>>;
  isNewUser: boolean;
};

function mapOAuthProfileToCreateUserParams(
  profile: OAuthProfile,
): CreateUserParams {
  return {
    email: profile.email ?? null,
    displayName: profile.name ?? null,
    firstName: profile.given_name ?? null,
    lastName: profile.family_name ?? null,
    avatarUrl: profile.picture ?? null,
    username: profile.username ?? null,
  };
}

export async function findOrCreateUser({
  provider,
  profile,
}: FindOrCreateUserParams): Promise<FindOrCreateUserResult> {
  return db.transaction(async (tx) => {
    const existingByProvider = await findUserByProvider(
      { provider, providerAccountId: profile.id },
      tx,
    );

    // Relogin social: conta já existia para este provider.
    if (existingByProvider)
      return { user: existingByProvider, isNewUser: false };

    if (profile.email) {
      const existingByEmail = await findUserByEmail(profile.email, tx);

      if (existingByEmail) {
        await createAccount(
          {
            userId: existingByEmail.id,
            provider,
            profile,
          },
          tx,
        );

        // Usuário já existia (ex.: cadastro por e-mail/senha) — só vincula o
        // provider, sem reenviar boas-vindas.
        return { user: existingByEmail, isNewUser: false };
      }
    }

    const newUser = await createUser(
      mapOAuthProfileToCreateUserParams(profile),
      tx,
      { onEmailConflict: "returnExisting" },
    );

    await createAccount(
      {
        userId: newUser.id,
        provider,
        profile,
      },
      tx,
    );

    // Primeiro login social: usuário recém-criado.
    return { user: newUser, isNewUser: true };
  });
}
