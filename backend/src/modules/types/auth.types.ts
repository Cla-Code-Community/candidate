import { z } from "zod";

// --- Providers ---
export const OAuthProviderSchema = z.enum(["github", "google", "linkedin"]);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

// --- Profile ---
export const OAuthProfileSchema = z.object({
  id: z.string().min(1, "ID do provedor é obrigatório"),
  email: z.string().email().nullish(),
  name: z.string().optional(),
  username: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().url().optional().or(z.string().length(0)),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_at: z.number().optional(),
});
export type OAuthProfile = z.infer<typeof OAuthProfileSchema>;

// --- Callback Params ---
export const AuthCallbackParamsSchema = z.object({
  provider: OAuthProviderSchema,
  code: z.string().min(1, "Code é obrigatório"),
  state: z.string().optional(),
  callbackUrl: z.string().url(),
});
export type AuthCallbackParams = z.infer<typeof AuthCallbackParamsSchema>;

// --- Exchange Code Params ---
export const ExchangeCodeParamsSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  callbackUrl: z.string().url(),
});

export type ExchangeCodeParams = z.infer<typeof ExchangeCodeParamsSchema>;

// --- Session ---
export const SessionSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido"),
  role: z.enum(["user", "support", "admin", "super_admin"] as const),
});

export type Session = z.infer<typeof SessionSchema>;

export interface OAuthProviderImplementation {
  getAuthUrl(state: string): Promise<string>;

  exchangeCode(params: ExchangeCodeParams): Promise<OAuthProfile>;
}
