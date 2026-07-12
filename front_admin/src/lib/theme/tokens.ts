/**
 * Tokens brutos do design system.
 * Aqui não existe lógica de tema — apenas valores.
 * light.ts / dark.ts (ou colors.ts) decidem quem usa o quê.
 */

export const tokens = {
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  },
  brand: {
    purple: "#6366f1",
    purpleLight: "#818cf8",
    yellow: "#f59e0b",
  },
  state: {
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
} as const;

export type Tokens = typeof tokens;
