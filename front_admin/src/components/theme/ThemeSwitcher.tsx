import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import type { Theme } from "../../lib/theme/theme";

const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Claro", icon: <Sun className="w-4 h-4" /> },
  { value: "dark", label: "Escuro", icon: <Moon className="w-4 h-4" /> },
];

/**
 * Diferente do ThemeToggle (botão único), esse é um seletor explícito.
 * Útil em telas de configurações/perfil, onde o usuário escolhe
 * o tema de forma deliberada em vez de só "trocar".
 */
export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
            ${
              theme === option.value
                ? "bg-indigo-500 text-white"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }
          `}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
};
