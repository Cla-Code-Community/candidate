import { type LucideIcon, Settings } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

/**
 * Estado vazio reutilizável para áreas ainda não conectadas a uma API real
 * (ex: Auditoria, Permissões, Configurações).
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Settings,
}: EmptyStateProps) {
  return (
    <div className="bg-white dark:bg-[#0f131a] p-8 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center py-16 space-y-4 theme-transition">
      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-full flex items-center justify-center mx-auto">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{title}</h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-[#1e4620] text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:bg-opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
