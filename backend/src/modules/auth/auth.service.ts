import { User } from "../../db/schema/users";
import type {
  AuthCallbackParams,
  OAuthProfile,
  OAuthProvider,
  Session,
} from "../types/auth.types";
import { findOrCreateUser } from "../users/functions/findOrCreateUser";
import { providers } from "./providers/auth.provider";

export class AuthService {
  async getAuthUrl(provider: OAuthProvider, state: string): Promise<string> {
    const providerImpl = providers[provider];

    if (!providerImpl) {
      throw new Error("Provider inválido");
    }

    return providerImpl.getAuthUrl(state);
  }

  async handleCallback({
    provider,
    code,
    state,
    callbackUrl,
  }: AuthCallbackParams): Promise<{
    user: User;
    session: Session;
  }> {
    const profile = await this.getProfileFromProvider({
      provider,
      code,
      state,
      callbackUrl,
    });

    if (!profile.email) {
      throw new Error("oauth_email_required");
    }

    const user = await findOrCreateUser({
      provider,
      profile,
    });

    const session = await this.createSession(user);

    return {
      user,
      session,
    };
  }

  async getProfileFromProvider({
    provider,
    code,
    state,
    callbackUrl,
  }: AuthCallbackParams): Promise<OAuthProfile> {
    const providerImpl = providers[provider];

    if (!providerImpl) {
      throw new Error("Provider inválido");
    }

    return providerImpl.exchangeCode({
      code,
      state,
      callbackUrl,
    });
  }

  async createSession(user: { id: string }): Promise<Session> {
    return {
      userId: user.id,
    };
  }
}
