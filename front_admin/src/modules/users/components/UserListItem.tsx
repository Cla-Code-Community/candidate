import { CalendarDays, Edit3, Mail, ShieldCheck } from "lucide-react";
import type { AdminUser } from "../types/user.types";

interface UserListItemProps {
  user: AdminUser;
  onEdit: (user: AdminUser) => void;
}

const ROLE_STYLES: Record<AdminUser["role"], string> = {
  "Super Admin":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
  Admin:
    "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300",
  Suporte:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Usuários:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-400",
};

const AVATAR_STYLES: Record<AdminUser["role"], string> = {
  "Super Admin": "bg-[#1e4620] text-white",
  Admin:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Suporte:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Usuários:
    "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-400",
};

function formatDate(value: string | null): string {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function UserListItem({ user, onEdit }: UserListItemProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 transition-colors hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${AVATAR_STYLES[user.role]}`}
        >
          {user.initials}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              {user.name}
            </p>
            {user.isBlocked && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                Bloqueado
              </span>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Mail size={12} />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={13} />
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLES[user.role]}`}
          >
            {user.role}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={13} />
          {formatDate(user.lastLoginAt)}
        </span>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={() => onEdit(user)}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10"
        >
          <Edit3 size={13} />
          Editar
        </button>
      </div>
    </div>
  );
}
