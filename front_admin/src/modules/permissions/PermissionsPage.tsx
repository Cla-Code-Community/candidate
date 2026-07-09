import {
  CheckCircle2,
  KeyRound,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "../../components/notifications/useNotifications";
import {
  permissionsApi,
  type PermissionRule,
  type Role,
} from "../../lib/api/permissions.api";
import { useAuth } from "../auth/hooks/useAuth";

type Resource =
  | "dashboard"
  | "scrapers"
  | "observability"
  | "audit"
  | "users"
  | "permissions";
type Action =
  | "read"
  | "trigger"
  | "health"
  | "metrics"
  | "block"
  | "unblock"
  | "reset_password"
  | "change_role"
  | "delete"
  | "manage";

type RuleView = PermissionRule & {
  resource: Resource;
  action: Action;
};

const ROLE_ORDER: Role[] = ["support", "admin", "super_admin"];
const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  support: "Suporte",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_DESCRIPTIONS: Record<"support" | "admin" | "super_admin", string> = {
  support: "Opera dashboard, scrapers e healthcheck sem ações sensíveis.",
  admin:
    "Executa scrapers, métricas, auditoria e ações administrativas comuns.",
  super_admin: "Acesso completo, incluindo usuários e mudanças de role.",
};

const ACTION_LABELS: Record<Action, string> = {
  read: "Visualizar",
  trigger: "Iniciar execução",
  health: "Healthcheck",
  metrics: "Métricas detalhadas",
  block: "Bloquear",
  unblock: "Desbloquear",
  reset_password: "Resetar senha",
  change_role: "Alterar role",
  delete: "Excluir",
  manage: "Gerenciar regras",
};

const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: "Dashboard",
  scrapers: "Scrapers",
  observability: "Observabilidade",
  audit: "Auditoria",
  users: "Usuários",
  permissions: "Permissões",
};

const IMMUTABLE_RULES = new Set([
  "permissions.manage",
  "users.change_role",
  "users.delete",
]);

const DEFAULT_RULES: RuleView[] = [
  {
    resource: "dashboard",
    action: "read",
    defaultMinRole: "support",
    minRole: "support",
    customized: false,
  },
  {
    resource: "scrapers",
    action: "read",
    defaultMinRole: "support",
    minRole: "support",
    customized: false,
  },
  {
    resource: "scrapers",
    action: "trigger",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "observability",
    action: "health",
    defaultMinRole: "support",
    minRole: "support",
    customized: false,
  },
  {
    resource: "observability",
    action: "metrics",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "audit",
    action: "read",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "users",
    action: "read",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "users",
    action: "block",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "users",
    action: "unblock",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "users",
    action: "reset_password",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "users",
    action: "change_role",
    defaultMinRole: "super_admin",
    minRole: "super_admin",
    customized: false,
  },
  {
    resource: "users",
    action: "delete",
    defaultMinRole: "super_admin",
    minRole: "super_admin",
    customized: false,
  },
  {
    resource: "permissions",
    action: "read",
    defaultMinRole: "admin",
    minRole: "admin",
    customized: false,
  },
  {
    resource: "permissions",
    action: "manage",
    defaultMinRole: "super_admin",
    minRole: "super_admin",
    customized: false,
  },
];

function ruleKey(rule: Pick<RuleView, "resource" | "action">): string {
  return `${rule.resource}.${rule.action}`;
}

function can(role: Role, minRole: Role): boolean {
  if (role === "user") return minRole === "user";
  if (minRole === "user") return true;
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minRole);
}

function RoleCard({
  role,
  rules,
}: {
  role: "support" | "admin" | "super_admin";
  rules: RuleView[];
}) {
  const allowedActions = rules.filter((rule) => can(role, rule.minRole)).length;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {ROLE_LABELS[role]}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {ROLE_DESCRIPTIONS[role]}
          </p>
          <p className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            {allowedActions} ações permitidas
          </p>
        </div>
        <span className="rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          {role === "super_admin" ? (
            <ShieldCheck size={22} />
          ) : role === "admin" ? (
            <UserCog size={22} />
          ) : (
            <Shield size={22} />
          )}
        </span>
      </div>
    </div>
  );
}

export function PermissionsPage() {
  const { isLoggedIn } = useAuth();
  const { notify } = useNotifications();
  const [rules, setRules] = useState<RuleView[]>(DEFAULT_RULES);
  const [initialRules, setInitialRules] = useState<RuleView[]>(DEFAULT_RULES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = isLoggedIn?.role === "super_admin";
  const hasDynamicRules = !error;

  useEffect(() => {
    let active = true;

    permissionsApi
      .list()
      .then((result) => {
        if (!active) return;
        const nextRules = result.rules as RuleView[];
        setRules(nextRules);
        setInitialRules(nextRules);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError(
          "Não foi possível carregar regras dinâmicas. Exibindo a matriz padrão em modo leitura até o backend responder.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const changedRules = useMemo(() => {
    const initialByKey = new Map(
      initialRules.map((rule) => [ruleKey(rule), rule]),
    );
    return rules.filter(
      (rule) => initialByKey.get(ruleKey(rule))?.minRole !== rule.minRole,
    );
  }, [initialRules, rules]);

  function updateRule(rule: RuleView, minRole: Role) {
    if (IMMUTABLE_RULES.has(ruleKey(rule))) return;

    setRules((current) =>
      current.map((item) =>
        ruleKey(item) === ruleKey(rule)
          ? { ...item, minRole, customized: minRole !== item.defaultMinRole }
          : item,
      ),
    );
  }

  async function saveRules() {
    if (!canManage || !hasDynamicRules || changedRules.length === 0) return;

    setIsSaving(true);
    try {
      const result = await permissionsApi.update(
        changedRules.map((rule) => ({
          resource: rule.resource,
          action: rule.action,
          minRole: rule.minRole,
        })),
      );
      const nextRules = result.rules as RuleView[];
      setRules(nextRules);
      setInitialRules(nextRules);
      notify({
        tone: "success",
        title: "Permissões atualizadas",
        description: "A matriz foi salva e será aplicada pelo backend.",
      });
    } catch {
      notify({
        tone: "error",
        title: "Erro ao salvar permissões",
        description:
          "O backend recusou a alteração. Verifique se as migrations foram aplicadas e se a API foi reiniciada.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(["support", "admin", "super_admin"] as const).map((role) => (
          <RoleCard key={role} role={role} rules={rules} />
        ))}
      </div>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Matriz de Permissões
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {canManage
                ? "Super admins podem alterar roles mínimas com aplicação no backend."
                : "Modo leitura. Apenas super admins podem alterar regras."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveRules()}
            disabled={
              !canManage ||
              !hasDynamicRules ||
              changedRules.length === 0 ||
              isSaving
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={14} />
            {!hasDynamicRules
              ? "API indisponível"
              : isSaving
                ? "Salvando..."
                : `Salvar ${changedRules.length || ""}`}
          </button>
        </div>

        {isLoading && (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Carregando regras...
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-215 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="pb-3 font-semibold">Recurso</th>
                <th className="pb-3 font-semibold">Ação</th>
                <th className="pb-3 font-semibold">Role mínima</th>
                {ROLE_ORDER.map((role) => (
                  <th key={role} className="pb-3 text-center font-semibold">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {rules.map((rule) => {
                const immutable = IMMUTABLE_RULES.has(ruleKey(rule));
                return (
                  <tr
                    key={ruleKey(rule)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-900"
                  >
                    <td className="py-3 pr-4 font-bold text-slate-800 dark:text-slate-100">
                      {RESOURCE_LABELS[rule.resource]}
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      {ACTION_LABELS[rule.action]}
                      {immutable && (
                        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                          imutável
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {canManage && hasDynamicRules && !immutable ? (
                        <select
                          value={rule.minRole}
                          onChange={(event) =>
                            updateRule(rule, event.target.value as Role)
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {ROLE_ORDER.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {ROLE_LABELS[rule.minRole]}
                        </span>
                      )}
                    </td>
                    {ROLE_ORDER.map((role) => {
                      const allowed = can(role, rule.minRole);
                      return (
                        <td key={role} className="py-3 text-center">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                              allowed
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                            }`}
                          >
                            {allowed ? (
                              <CheckCircle2 size={15} />
                            ) : (
                              <Lock size={14} />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            <KeyRound size={20} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Segurança das alterações
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Alterações são salvas no backend e usadas pelo middleware de
              autorização. Regras críticas de gestão de permissões, alteração de
              role e exclusão de usuários permanecem imutáveis para evitar
              escalada acidental ou lockout administrativo.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
