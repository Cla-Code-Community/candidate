import { Lock, Save, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import type { AdminUser, BackendUserRole } from "../types/user.types";

interface UserEditModalProps {
  user: AdminUser | null;
  isSaving: boolean;
  onClose: () => void;
  onDelete: (user: AdminUser) => void;
  onSave: (input: { role: BackendUserRole; isBlocked: boolean }) => void;
}

const ROLE_OPTIONS: Array<{
  value: BackendUserRole;
  label: string;
  description: string;
}> = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Acesso completo a usuários, auditoria, scrapers e métricas.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Pode operar scrapers, observabilidade e ações administrativas.",
  },
  {
    value: "support",
    label: "Suporte",
    description: "Acesso operacional de suporte para leitura e acompanhamento.",
  },
  {
    value: "user",
    label: "Usuários",
    description: "Conta comum do produto.",
  },
];

export function UserEditModal({
  user,
  isSaving,
  onClose,
  onDelete,
  onSave,
}: UserEditModalProps) {
  if (!user) return null;

  return (
    <UserEditModalContent
      key={user.id}
      user={user}
      isSaving={isSaving}
      onClose={onClose}
      onDelete={onDelete}
      onSave={onSave}
    />
  );
}

type UserEditModalContentProps = Omit<UserEditModalProps, "user"> & {
  user: AdminUser;
};

function UserEditModalContent({
  user,
  isSaving,
  onClose,
  onDelete,
  onSave,
}: UserEditModalContentProps) {
  const [role, setRole] = useState<BackendUserRole>(user.rawRole);
  const [isBlocked, setIsBlocked] = useState(user.isBlocked);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <button
        aria-label="Fechar modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              Editar usuário
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
              {user.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <UserRound className="mb-3 text-slate-400" size={18} />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Identificador
              </p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {user.username ?? user.id}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <ShieldCheck className="mb-3 text-slate-400" size={18} />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Role atual
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {user.role}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <Lock className="mb-3 text-slate-400" size={18} />
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Status
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {user.isBlocked ? "Bloqueado" : "Ativo"}
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Perfil de acesso
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as BackendUserRole)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-slate-100 dark:border-slate-800">
            {ROLE_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={`border-b border-slate-100 p-3 last:border-b-0 dark:border-slate-800 ${
                  role === option.value
                    ? "bg-blue-50/70 dark:bg-blue-500/10"
                    : "bg-white dark:bg-transparent"
                }`}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {option.label}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {option.description}
                </p>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <input
              checked={isBlocked}
              onChange={(event) => setIsBlocked(event.target.checked)}
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Bloquear acesso
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Usuários bloqueados permanecem registrados, mas não devem operar o
                painel administrativo.
              </span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
          <button
            onClick={() =>
              isConfirmingDelete
                ? onDelete(user)
                : setIsConfirmingDelete(true)
            }
            className="mr-auto inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            disabled={isSaving}
            type="button"
          >
            <Trash2 size={16} />
            {isConfirmingDelete ? "Confirmar exclusão" : "Excluir usuário"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={isSaving}
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ role, isBlocked })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e4620] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#245628] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSaving}
            type="button"
          >
            <Save size={16} />
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </section>
    </div>
  );
}
