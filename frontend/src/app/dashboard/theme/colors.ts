export interface Colors {
  background: string;
  surface: string;
  surfaceHover: string;
  input: string;
  inputBorder: string;
  primary: string;
  primaryHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderFocus: string;
}

export const lightColors: Colors = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceHover: "#f1f5f9",
  input: "#f1f5f9",
  inputBorder: "#cbd5e1",
  primary: "#15803d",
  primaryHover: "#166534",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderFocus: "#15803d",
};

export const darkColors: Colors = {
  background: "#0b0f19",
  surface: "#131b2e",
  surfaceHover: "#1e293b",
  input: "#070a12",
  inputBorder: "#26354a",
  primary: "#16a34a",
  primaryHover: "#22c55e",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  textMuted: "#94a3b8",
  border: "#1e293b",
  borderFocus: "#22c55e",
};
