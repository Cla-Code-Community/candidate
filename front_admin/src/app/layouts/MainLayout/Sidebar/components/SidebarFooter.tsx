import { LogOut } from "lucide-react";
import { useState } from "react";

interface SidebarFooterProps {
  onLogout: () => Promise<void> | void;
}

export function SidebarFooter({ onLogout }: SidebarFooterProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-800">
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut size={20} className="text-slate-400" />
        <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
      </button>
    </div>
  );
}
