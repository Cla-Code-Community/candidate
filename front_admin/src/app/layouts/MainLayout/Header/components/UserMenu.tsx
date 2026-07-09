import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface UserMenuProps {
  name: string;
  role: string;
  initials: string;
  email?: string | null;
  onLogout: () => Promise<void> | void;
}

export function UserMenu({
  name,
  role,
  initials,
  email,
  onLogout,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
      setIsOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
      >
        <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold rounded-full flex items-center justify-center text-sm">
          {initials}
        </div>
        <div className="text-left hidden lg:block">
          <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
            {name}
          </span>
          <span className="block text-[10px] text-slate-400 dark:text-slate-500">
            {role}
          </span>
        </div>
        <ChevronDown size={14} className="text-slate-400 hidden lg:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#0f131a] border border-slate-100 dark:border-slate-800 rounded-lg shadow-xl py-1 z-20 text-xs">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 lg:hidden">
            <p className="font-bold text-slate-800 dark:text-slate-100">
              {name}
            </p>
            <p className="text-slate-400 dark:text-slate-500">{role}</p>
          </div>
          {email && (
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
              <p className="truncate text-slate-400 dark:text-slate-500">
                {email}
              </p>
            </div>
          )}
          <a
            href="#perfil"
            className="block px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Meu Perfil
          </a>
          <a
            href="#seguranca"
            className="block px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Segurança
          </a>
          <hr className="border-slate-100 dark:border-slate-800" />
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full text-left block px-4 py-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer disabled:cursor-wait disabled:opacity-60"
          >
            {isLoggingOut ? "Saindo..." : "Sair da Conta"}
          </button>
        </div>
      )}
    </div>
  );
}
