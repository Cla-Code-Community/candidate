import z from "zod";

export const RegisterSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .max(254, "Email deve ter no máximo 254 caracteres"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128, "Senha deve ter no máximo 128 caracteres"),
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  phone: z
    .string()
    .max(16, "Telefone deve ter no máximo 15 dígitos")
    .refine(
      (value) => value.replace(/\D/g, "").length <= 15,
      "Telefone deve ter no máximo 15 dígitos",
    )
    .optional(),
  cpf: z
    .string()
    .max(14, "CPF deve ter no máximo 11 dígitos")
    .refine(
      (value) => value.replace(/\D/g, "").length <= 11,
      "CPF deve ter no máximo 11 dígitos",
    )
    .optional(),
  technologies: z.array(z.string()).optional(),
  level: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
