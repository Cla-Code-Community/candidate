import { Activity, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/routes/routes";
import { DashboardMetrics } from "./components/DashboardMetrics/DashboardMetrics";
import { PlatformOverview } from "./components/PlatformOverview/PlatformOverview";
import { ResourceUsage } from "./components/ResourceUsage/ResourceUsage";
import { RunningScrapers } from "./components/RunningScrapers/RunningScrapers";
import { ServiceStatus } from "./components/ServiceStatus/ServiceStatus";
import { useDashboard } from "./hooks/useDashboard";

/**
 * Página do dashboard. Não conhece API nem fetch — apenas consome useDashboard()
 * e distribui os dados para os componentes visuais.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const {
    stats,
    resources,
    services,
    scrapers,
    chartPoints,
    lastUpdatedAt,
    isLoading,
    isRefreshing,
    error,
    refresh,
    refreshIntervalMs,
    toggleScraper,
  } = useDashboard();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-[#0f131a] dark:text-slate-400">
        Carregando dashboard...
      </div>
    );
  }

  if (!stats || !resources) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-bold">Nao foi possivel carregar o dashboard.</p>
        <p className="mt-1">
          {error ?? "Verifique se o backend esta respondendo e tente novamente."}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-amber-300 px-3 text-xs font-bold transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/10"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-40" />
            <Activity size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Monitoramento em tempo real
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atualiza a cada {Math.round(refreshIntervalMs / 1000)}s
              {lastUpdatedAt
                ? ` • ultimo snapshot ${new Intl.DateTimeFormat("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(new Date(lastUpdatedAt))}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? "animate-spin" : undefined}
            />
            Atualizar
          </button>
        </div>
      </div>

      <DashboardMetrics stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PlatformOverview points={chartPoints} lastUpdatedAt={lastUpdatedAt} />
        <ServiceStatus services={services} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RunningScrapers
          scrapers={scrapers}
          onToggle={toggleScraper}
          onViewAll={() => navigate(ROUTES.scrapers)}
        />
        <ResourceUsage
          resources={resources}
          onViewMore={() => navigate(ROUTES.observability)}
        />
      </div>
    </>
  );
}
