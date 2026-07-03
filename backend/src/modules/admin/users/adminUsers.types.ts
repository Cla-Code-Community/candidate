import { z } from "zod";
import type { User } from "../../../db/schema/users";
import type { Role } from "../permissions/roles";

// Re-exportando o tipo original do banco, caso outros arquivos precisem
export type { User };

// --- AdminUserFilters ---
export const AdminUserFiltersSchema = z.object({
  search: z.string().optional(), // busca por nome, username ou email
  role: z.custom<Role>().optional(),
  isBlocked: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

export type AdminUserFilters = z.infer<typeof AdminUserFiltersSchema>;

// --- PaginatedUsers ---
export const PaginatedUsersSchema = z.object({
  data: z.array(z.custom<User>()),
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
});

export type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>;

// --- ChangeRoleInput ---
export const ChangeRoleInputSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido"),
  newRole: z.custom<Role>(),
});

export type ChangeRoleInput = z.infer<typeof ChangeRoleInputSchema>;

// --- ResetPasswordInput ---
export const ResetPasswordInputSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido"),
  newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
