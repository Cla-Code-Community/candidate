import { useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const THEME_STORAGE_KEY = "jobs-theme-preference";
const DARK_CLASS = "dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(themePreference: ThemePreference): Theme {
  return themePreference === "system" ? getSystemTheme() : themePreference;
}

function applyThemeToRoot(theme: Theme): void {
  const root = document.documentElement;

  root.classList.toggle(DARK_CLASS, theme === "dark");
  root.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const storedPreference = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  });

  const resolvedTheme = useMemo(() => resolveTheme(themePreference), [themePreference]);

  useEffect(() => {
    applyThemeToRoot(resolvedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (themePreference === "system") {
        applyThemeToRoot(getSystemTheme());
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themePreference]);

  const toggleTheme = () => {
    setThemePreference((currentTheme) => {
      const currentResolved = currentTheme === "system" ? getSystemTheme() : currentTheme;
      return currentResolved === "dark" ? "light" : "dark";
    });
  };

  return {
    themePreference,
    resolvedTheme,
    setThemePreference,
    toggleTheme,
  };
}
