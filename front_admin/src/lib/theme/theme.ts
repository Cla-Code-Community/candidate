import { darkColors, lightColors, type ColorKey } from "./colors";
import { tokens } from "./tokens";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const palettes: Record<Theme, Record<ColorKey, string>> = {
  light: lightColors,
  dark: darkColors,
};

/**
 * Aplica o tema no <html>, sem apagar outras classes existentes.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);

  const palette = palettes[theme];
  for (const key in palette) {
    root.style.setProperty(
      `--color-${kebabCase(key)}`,
      palette[key as ColorKey],
    );
  }
}

/**
 * Lê o tema salvo, com fallback seguro para SSR/Electron.
 */
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function kebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export { tokens };
