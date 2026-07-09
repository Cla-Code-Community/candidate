import { useContext } from "react";
import { ThemeContext } from "../components/context/ThemeContext";

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme deve ser usado dentro de <ThemeProvider>");
  }

  return context;
}
