import { UserListItem } from "./UserListItem";
import type { AdminUser } from "../types/user.types";

interface UserListProps {
  users: AdminUser[];
  onEditUser: (user: AdminUser) => void;
}

export function UserList({ users, onEditUser }: UserListProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Nenhum usuário encontrado
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Ajuste a busca ou os filtros para visualizar outras contas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {users.map((user) => (
        <UserListItem key={user.id} user={user} onEdit={onEditUser} />
      ))}
    </div>
  );
}
