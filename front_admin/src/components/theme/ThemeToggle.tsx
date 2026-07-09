import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        p-2 rounded-md transition-colors
        text-slate-600 hover:bg-slate-100
        dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer
      "
      aria-label="Alternar tema"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};
