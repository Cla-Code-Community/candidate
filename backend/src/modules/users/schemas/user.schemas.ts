import { z } from "zod";

// ── Profile ───────────────────────────────────────────────────────────────────

export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(100).nullable(),
    firstName: z.string().min(1).max(50).nullable(),
    lastName: z.string().min(1).max(50).nullable(),
    avatarUrl: z.string().url().nullable(),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/),
    phone: z
      .string()
      .max(20)
      .regex(/^\+?[0-9() -]+$/, "Telefone inválido")
      .nullable(),
    cpf: z
      .string()
      .max(14)
      .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "CPF inválido")
      .nullable(),
    technologies: z.array(z.string().min(1)).max(30),
    level: z.string().max(50).nullable(),
  })
  .partial();

// ── Preferences ───────────────────────────────────────────────────────────────

export const updatePreferencesSchema = z
  .object({
    keywords: z.array(z.string().min(1)).max(20),
    searchLocation: z.string().min(1).max(100).nullable(),
    searchLanguage: z.string().length(2).nullable(),
    remoteOnly: z.boolean(),
    jobTypes: z.array(z.string().min(1)).max(10),
    emailNotifications: z.boolean(),
  })
  .partial();

export const createPreferencesSchema = updatePreferencesSchema;

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesData = z.infer<typeof updatePreferencesSchema>;
export type CreatePreferencesData = z.infer<typeof createPreferencesSchema>;
