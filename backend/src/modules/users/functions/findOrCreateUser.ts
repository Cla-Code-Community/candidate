import { db } from "../../../db/client";
import { OAuthProfile } from "../../types/auth.types";
import { createAccount } from "./createAccount";
import { createUser, type CreateUserParams } from "./createUser";
import { findUserByEmail, findUserByProvider } from "./findUsers";

type FindOrCreateUserParams = {
  provider: string;
  profile: OAuthProfile;
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
}: FindOrCreateUserParams) {
  return db.transaction(async (tx) => {
    const existingByProvider = await findUserByProvider(
      { provider, providerAccountId: profile.id },
      tx,
    );

    if (existingByProvider) return existingByProvider;

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

        return existingByEmail;
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

    return newUser;
  });
}
