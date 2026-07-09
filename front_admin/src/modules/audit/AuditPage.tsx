import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  ListFilter,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auditApi, type AuditLog } from "../../lib/api/audit.api";

const ACTIONS = [
  "all",
  "users.read",
  "users.block",
  "users.unblock",
  "users.delete",
  "users.reset_password",
  "users.change_role",
  "dashboard.read",
  "scrapers.read",
  "scrapers.trigger",
  "scrapers.reprocess",
  "observability.health",
  "observability.metrics",
  "audit.read",
  "auth.login",
  "auth.logout",
];

const TARGETS = ["all", "users", "scrapers", "dashboard", "observability", "audit"];
const LIMIT = 20;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function roleLabel(role: AuditLog["actorRole"]): string {
  return {
    user: "Usuário",
    support: "Suporte",
    admin: "Admin",
    super_admin: "Super Admin",
  }[role];
}

function isCritical(action: string): boolean {
  return (
    action.includes("delete") ||
    action.includes("block") ||
    action.includes("reset") ||
    action.includes("change_role") ||
    action.includes("trigger") ||
    action.includes("reprocess")
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {helper}
          </p>
        </div>
        <span className="rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <Icon size={21} />
        </span>
      </div>
    </div>
  );
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [actorId, setActorId] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    auditApi
      .list({
        action: action === "all" ? undefined : action,
        targetType: targetType === "all" ? undefined : targetType,
        actorId: actorId.trim() || undefined,
        limit: LIMIT,
        offset,
      })
      .then((result) => {
        if (!active) return;
        setLogs(result.data);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError(
          "Nao foi possivel carregar auditoria. Verifique permissao admin e a tabela audit_logs.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [action, actorId, offset, targetType]);

  const criticalCount = useMemo(
    () => logs.filter((log) => isCritical(log.action)).length,
    [logs],
  );
  const actorCount = useMemo(
    () => new Set(logs.map((log) => log.actorId).filter(Boolean)).size,
    [logs],
  );
  const currentPage = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function resetFilters() {
    setAction("all");
    setTargetType("all");
    setActorId("");
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Eventos registrados"
          value={total}
          helper="Total com filtros atuais"
          icon={ShieldCheck}
        />
        <StatCard
          label="Eventos críticos"
          value={criticalCount}
          helper="Nesta página"
          icon={AlertTriangle}
        />
        <StatCard
          label="Atores únicos"
          value={actorCount}
          helper="Nesta página"
          icon={UserRound}
        />
        <StatCard
          label="Página atual"
          value={`${currentPage}/${totalPages}`}
          helper="20 eventos por página"
          icon={CalendarClock}
        />
      </div>

      <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Trilhas de Auditoria
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Eventos administrativos gravados pelo backend.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
          >
            <ListFilter size={14} />
            Limpar filtros
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_2fr]">
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "Todas as ações" : item}
              </option>
            ))}
          </select>
          <select
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {TARGETS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "Todos os recursos" : item}
              </option>
            ))}
          </select>
          <input
            value={actorId}
            onChange={(event) => {
              setActorId(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Filtrar por actorId UUID"
          />
        </div>

        {isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Carregando eventos...
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {error}
          </p>
        )}

        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="pb-3 font-semibold">Data</th>
                    <th className="pb-3 font-semibold">Ação</th>
                    <th className="pb-3 font-semibold">Ator</th>
                    <th className="pb-3 font-semibold">Alvo</th>
                    <th className="pb-3 font-semibold">IP</th>
                    <th className="pb-3 text-right font-semibold">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900"
                    >
                      <td className="py-3 pr-4 font-semibold text-slate-500 dark:text-slate-400">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            isCritical(log.action)
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {roleLabel(log.actorRole)}
                        </span>
                        <br />
                        <span className="font-mono text-[10px]">
                          {log.actorId ?? "sem ator"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                        {log.targetType ?? "-"}
                        {log.targetId ? ` / ${log.targetId}` : ""}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {log.ip ?? "-"}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10"
                        >
                          <Fingerprint size={13} />
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                Exibindo {logs.length} de {total} eventos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((value) => Math.max(0, value - LIMIT))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setOffset((value) => value + LIMIT)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-[#0f131a]">
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Evento #{selectedLog.id}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedLog.action} • {formatDate(selectedLog.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
