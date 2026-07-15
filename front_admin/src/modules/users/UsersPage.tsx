import {
  ChevronLeft,
  ChevronRight,
  Crown,
  Headset,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "../../components/notifications/useNotifications";
import type { AdminUser as BackendAdminUser } from "../../lib/api/types";
import { adminUsersApi } from "../../lib/api/users.api";
import { UserEditModal } from "./components/UserEditModal";
import { UserList } from "./components/UserList";
import type { AdminUser, BackendUserRole } from "./types/user.types";

type RoleFilter = "all" | BackendUserRole;
type StatusFilter = "all" | "active" | "blocked";

const USERS_PER_PAGE = 10;
const USERS_FETCH_LIMIT = 100;
const ROLE_VALUES: BackendUserRole[] = ["super_admin", "admin", "support", "user"];

const ROLE_SUMMARY: Record<
  BackendUserRole,
  { label: AdminUser["role"]; icon: LucideIcon }
> = {
  super_admin: { label: "Super Admin", icon: Crown },
  admin: { label: "Admin", icon: ShieldCheck },
  support: { label: "Suporte", icon: Headset },
  user: { label: "Usuários", icon: UserRound },
};

function roleLabel(role: BackendAdminUser["role"]): AdminUser["role"] {
  return ROLE_SUMMARY[role].label;
}

function initialsFrom(user: BackendAdminUser): string {
  const source =
    user.displayName ?? user.username ?? user.email ?? user.id.slice(0, 2);

  return source
    .split(/\s|\.|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function mapUser(user: BackendAdminUser): AdminUser {
  return {
    id: user.id,
    name: user.displayName ?? user.username ?? user.email ?? "Usuario sem nome",
    email: user.email ?? "sem email",
    initials: initialsFrom(user),
    avatarUrl: user.avatarUrl,
    role: roleLabel(user.role),
    rawRole: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    username: user.username,
  };
}

async function fetchAllUsers() {
  const firstPage = await adminUsersApi.list({
    limit: USERS_FETCH_LIMIT,
    offset: 0,
  });
  const allUsers = [...firstPage.data];

  for (
    let offset = firstPage.offset + firstPage.limit;
    offset < firstPage.total;
    offset += firstPage.limit
  ) {
    const page = await adminUsersApi.list({
      limit: USERS_FETCH_LIMIT,
      offset,
    });
    allUsers.push(...page.data);
  }

  return allUsers;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Icon className="text-slate-400 dark:text-slate-500" size={16} />
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function RoleStatCard({ role, value }: { role: BackendUserRole; value: number }) {
  const { icon: Icon, label } = ROLE_SUMMARY[role];

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Icon className="text-slate-400 dark:text-slate-500" size={16} />
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export function UsersPage() {
  const { notify } = useNotifications();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchAllUsers()
      .then((result) => {
        if (!active) return;
        setUsers(result.map(mapUser));
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Nao foi possivel carregar os usuarios.");
        notify({
          tone: "error",
          title: "Erro ao carregar usuários",
          description:
            "Não foi possível buscar os usuários administrativos no backend.",
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [notify]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.username?.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || user.rawRole === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "blocked" ? user.isBlocked : !user.isBlocked);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * USERS_PER_PAGE;

    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);
  const firstVisibleUser =
    filteredUsers.length === 0
      ? 0
      : (safeCurrentPage - 1) * USERS_PER_PAGE + 1;
  const lastVisibleUser = Math.min(
    filteredUsers.length,
    safeCurrentPage * USERS_PER_PAGE,
  );

  const activeUsers = users.filter((user) => !user.isBlocked).length;
  const roleCounts = ROLE_VALUES.reduce(
    (acc, role) => ({
      ...acc,
      [role]: users.filter((user) => user.rawRole === role).length,
    }),
    {} as Record<BackendUserRole, number>,
  );

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  function handleRoleFilterChange(value: RoleFilter) {
    setRoleFilter(value);
    setCurrentPage(1);
  }

  function handleStatusFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  async function handleSaveUser(input: {
    role: BackendUserRole;
    isBlocked: boolean;
  }) {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      let updatedUser: BackendAdminUser | null = null;

      if (input.role !== selectedUser.rawRole) {
        const result = await adminUsersApi.changeRole(
          selectedUser.id,
          input.role,
        );
        updatedUser = result.user;
      }

      if (input.isBlocked !== selectedUser.isBlocked) {
        const result = input.isBlocked
          ? await adminUsersApi.block(selectedUser.id)
          : await adminUsersApi.unblock(selectedUser.id);
        updatedUser = result.user;
      }

      if (updatedUser) {
        const mappedUser = mapUser(updatedUser);
        setUsers((current) =>
          current.map((user) =>
            user.id === mappedUser.id ? mappedUser : user,
          ),
        );
      }

      setSelectedUser(null);
      notify({
        tone: "success",
        title: "Usuário atualizado",
        description: "As permissões da conta foram salvas com sucesso.",
      });
    } catch {
      notify({
        tone: "error",
        title: "Erro ao salvar usuário",
        description:
          "Não foi possível atualizar a role ou o status dessa conta.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    setIsSaving(true);
    try {
      await adminUsersApi.delete(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelectedUser(null);
      notify({
        tone: "success",
        title: "Usuário excluído",
        description: "A conta foi removida do painel administrativo.",
      });
    } catch {
      notify({
        tone: "error",
        title: "Erro ao excluir usuário",
        description: "Não foi possível remover essa conta.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Acessos administrativos
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                Gerenciamento de Usuários
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Visualize, filtre e ajuste permissões de acesso ao Cand!Date!.
              </p>
            </div>
            <button
              onClick={() =>
                notify({
                  tone: "warning",
                  title: "Criação de usuário ainda não disponível",
                  description:
                    "O backend administrativo lista e gerencia usuários reais, mas a criação ainda não possui endpoint conectado.",
                })
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e4620] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#245628]"
            >
              <UserPlus size={15} />
              Novo Usuário
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <StatCard
              icon={Users}
              label="Total de contas"
              value={users.length}
            />
            <StatCard
              icon={UserCheck}
              label="Contas ativas"
              value={activeUsers}
            />
            {ROLE_VALUES.map((role) => (
              <RoleStatCard key={role} role={role} value={roleCounts[role]} />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
          <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Buscar por nome, email ou username"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={roleFilter}
                onChange={(event) =>
                  handleRoleFilterChange(event.target.value as RoleFilter)
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">Todas as roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="support">Suporte</option>
                <option value="user">Usuários</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusFilterChange(event.target.value as StatusFilter)
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Carregando usuários...
            </p>
          )}
          {error && (
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
          {!isLoading && !error && (
            <>
              <UserList users={visibleUsers} onEditUser={setSelectedUser} />

              {filteredUsers.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Exibindo {firstVisibleUser}-{lastVisibleUser} de{" "}
                    {filteredUsers.length} usuários
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage(Math.max(1, safeCurrentPage - 1))
                      }
                      disabled={safeCurrentPage === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="min-w-20 text-center font-bold text-slate-700 dark:text-slate-200">
                      {safeCurrentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage(
                          Math.min(totalPages, safeCurrentPage + 1),
                        )
                      }
                      disabled={safeCurrentPage === totalPages}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
                      aria-label="Próxima página"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <UserEditModal
        user={selectedUser}
        isSaving={isSaving}
        onClose={() => setSelectedUser(null)}
        onDelete={handleDeleteUser}
        onSave={handleSaveUser}
      />
    </>
  );
}
