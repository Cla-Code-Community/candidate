import { z } from "zod";

export const RoleSchema = z.enum(["user", "support", "admin", "super_admin"]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * User
 */
export const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  username: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  role: RoleSchema,
  avatar: z.string(),
  permissions: z.record(z.string(), z.array(z.string())),
});

export type User = z.infer<typeof UserSchema>;

/**
 * MetricData
 */
export const MetricDataSchema = z.object({
  title: z.string(),
  value: z.union([z.string(), z.number()]),
  change: z.string().optional(),
  icon: z.custom<React.ComponentType<{ className?: string }>>(),
  changeType: z.enum(["up", "down", "neutral"]).optional(),
});

export type MetricData = z.infer<typeof MetricDataSchema>;

/**
 * ProcessData
 */
export const ProcessDataSchema = z.object({
  id: z.string(),
  position: z.string(),
  company: z.string(),
  applicants: z.number(),
  slaStatus: z.enum(["normal", "warning", "critical"]),
  slaDays: z.number(),
});

export type ProcessData = z.infer<typeof ProcessDataSchema>;

/**
 * LoginCredentials
 */
export const LoginCredentialsSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve possuir pelo menos 8 caracteres"),
  rememberMe: z.boolean().default(false),
});

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

/**
 * AuthState
 */
export const AuthStateSchema = z.object({
  isLoggedIn: z.boolean(),
  isLoading: z.boolean(),
  errorMessage: z.string(),
  user: UserSchema.nullable(),
});

export type AuthState = z.infer<typeof AuthStateSchema>;
