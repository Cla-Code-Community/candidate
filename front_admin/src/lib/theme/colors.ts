/**
 * Paletas por tema.
 * Cada chave aqui vira uma CSS var (--color-x) via theme.ts.
 */

export const lightColors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  input: "#f1f5f9",

  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",

  border: "#e2e8f0",
  borderFocus: "#6366f1",
} as const;

export const darkColors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceHover: "#334155",
  input: "#1e293b",

  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",

  border: "#334155",
  borderFocus: "#818cf8",
} as const;

export type ColorKey = keyof typeof lightColors;
