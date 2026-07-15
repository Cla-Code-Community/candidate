export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function normalizeSearchableText(value: string): string {
  return value.trim().toLowerCase();
}
