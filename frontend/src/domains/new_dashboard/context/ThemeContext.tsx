import { createContext, useContext, type ReactNode } from "react";
import { useTheme as useSharedTheme } from "@/shared/hooks/useTheme";
import { darkColors, lightColors } from "../constants";

type ThemeContextValue = ReturnType<typeof useSharedTheme> & {
  colors: typeof lightColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSharedTheme();
  const colors = theme.resolvedTheme === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ ...theme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useDashboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useDashboardTheme must be used within ThemeProvider");
  }
  return context;
}

