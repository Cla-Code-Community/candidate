import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "../../../components/theme/ThemeToggle";

interface LoginHeaderProps {
  onBackClick?: () => void;
}

export const LoginHeader: React.FC<LoginHeaderProps> = ({ onBackClick }) => {
  return (
    <div className="relative z-10 flex justify-between items-center mb-12">
      {/* <button
        onClick={onBackClick}
        className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors group cursor-pointer"
      >

        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span>Voltar para a página principal</span>
      </button> */}

      <a
        href="https://candidate.app.br"
        onClick={onBackClick}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span>Voltar para a página principal</span>
      </a>

      <div className="flex items-center gap-3">
        <span
          className="
            text-[10px] uppercase font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5
            text-slate-500 border border-slate-200 bg-slate-100/60
            dark:text-gray-500 dark:border-gray-800 dark:bg-gray-900/40
          "
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Servidor Conectado
        </span>

        <ThemeToggle />
      </div>
    </div>
  );
};
