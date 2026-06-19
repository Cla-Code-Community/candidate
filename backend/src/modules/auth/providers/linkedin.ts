import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  discovery,
} from "openid-client";
import { ExchangeCodeParams, OAuthProfile } from "../../types/auth.types";

let _config: Awaited<ReturnType<typeof discovery>> | null = null;

async function getConfig() {
  if (_config) return _config;

  _config = await discovery(
    new URL("https://www.linkedin.com/oauth"),
    process.env.LINKEDIN_CLIENT_ID!,
    process.env.LINKEDIN_CLIENT_SECRET!,
  );

  return _config;
}

export async function getLinkedinAuthUrl(state: string): Promise<string> {
  const config = await getConfig();

  const url = buildAuthorizationUrl(config, {
    redirect_uri: `${process.env.APP_URL}/auth/linkedin/callback`,
    scope: "openid profile email",
    state,
  });

  return url.href;
}

export async function exchangeLinkedinCode({
  callbackUrl,
  state,
}: ExchangeCodeParams): Promise<OAuthProfile> {
  const config = await getConfig();

  if (!state) {
    throw new Error("State ausente");
  }

  const tokens = await authorizationCodeGrant(config, new URL(callbackUrl), {
    expectedState: state,
  });

  const claims = tokens.claims();

  if (!claims || typeof claims !== "object") {
    throw new Error("Invalid LinkedIn claims");
  }

  const getString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  const getNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;

  return {
    id: getString(claims.sub) ?? "",

    email: getString(claims.email),
    name: getString(claims.name),

    given_name: getString(claims.given_name),
    family_name: getString(claims.family_name),

    picture: getString(claims.picture),

    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,

    expires_at: getNumber(claims.exp),
  };
}
