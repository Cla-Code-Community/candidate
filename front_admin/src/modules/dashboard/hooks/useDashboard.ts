import { useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "../../../components/notifications/useNotifications";
import { ApiError } from "../../../lib/api/client";
import type {
  DashboardChartPoint,
  DashboardStats,
} from "../schemas";
import { useAuth } from "../../auth/hooks/useAuth";
import { useOperationalSnapshot } from "../../observability/hooks/useOperationalSnapshot";
import { operationalNotice, withOperationalExecution } from "../../observability/services/operationalPresentation";
import { createPollingResource } from "../../../lib/polling/pollingResource";
import { usePollingResource } from "../../../lib/polling/usePollingResource";
import { dashboardService } from "../services/dashboard.service";

const REFRESH_INTERVAL_MS = 10_000;
const MAX_CHART_POINTS = 24;

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function chartPointFrom(
  stats: DashboardStats,
  generatedAt: string,
): DashboardChartPoint {
  return {
    timestamp: generatedAt,
    label: timeLabel(generatedAt),
    totalJobs: stats.totalJobs.value,
    activeUsers: stats.activeUsers.value,
  };
}

function appendChartPoint(
  points: DashboardChartPoint[],
  nextPoint: DashboardChartPoint,
): DashboardChartPoint[] {
  const lastPoint = points.at(-1);
  const nextPoints =
    lastPoint?.timestamp === nextPoint.timestamp
      ? [...points.slice(0, -1), nextPoint]
      : [...points, nextPoint];

  return nextPoints.slice(-MAX_CHART_POINTS);
}

function createDashboardResource(sessionKey: string) {
    void sessionKey; // A new resource isolates each authenticated session.
    let chartPoints: DashboardChartPoint[] = [];
    return createPollingResource<Awaited<ReturnType<typeof dashboardService.getOverview>> & { chartPoints: DashboardChartPoint[] }>({
      intervalMs: REFRESH_INTERVAL_MS,
      errorMessage: "Nao foi possivel atualizar as metricas do dashboard.",
      timestamp: (data) => data.generatedAt,
      load: async (signal) => {
        const overview = await dashboardService.getOverview(signal);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        chartPoints = appendChartPoint(chartPoints, chartPointFrom(overview.stats, overview.generatedAt));
        return { ...overview, chartPoints };
      },
    });
}

export function useDashboard() {
  const { notify } = useNotifications();
  const { isLoggedIn } = useAuth();
  const canReadOperational = isLoggedIn?.role === "admin" || isLoggedIn?.role === "super_admin";
  const sessionKey = `${isLoggedIn?.id ?? "anonymous"}:${isLoggedIn?.role ?? "none"}`;
  const operational = useOperationalSnapshot(canReadOperational, REFRESH_INTERVAL_MS, sessionKey);
  const resource = useMemo(() => createDashboardResource(sessionKey), [sessionKey]);
  const query = usePollingResource(resource);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);
  const [startingScraperId, setStartingScraperId] = useState<string | null>(null);
  const [triggerForbidden, setTriggerForbidden] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const scrapers = (query.data?.scrapers ?? []).map((scraper) => {
    const merged = withOperationalExecution(scraper, operational, canReadOperational);
    return {
    ...merged,
    runDisabled: !canReadOperational || triggerForbidden || query.stale || merged.active ||
      merged.runDisabled || startingScraperId !== null,
    };
  });
  const refresh = async () => { await Promise.all([query.refresh(), operational.refresh()]); };

  const toggleScraper = async (id: string) => {
    const scraper = scrapers.find((item) => item.id === id);
    if (!scraper || scraper.runDisabled || pendingRef.current) return;
    pendingRef.current = true;
    setStartingScraperId(id);
    try {
      await dashboardService.toggleScraper(id, true);
      if (!mountedRef.current) return;
      notify({ tone: "success", title: "Execução solicitada", description: `Solicitação aceita para ${scraper.name}.` });
      await refresh();
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && error.status === 409) {
        notify({ tone: "warning", title: "Processamento já em execução", description: "A execução atual ainda não terminou." });
        await refresh();
      } else {
        if (error instanceof ApiError && [401, 403].includes(error.status)) setTriggerForbidden(true);
        notify({ tone: "error", title: "Erro ao iniciar processamento", description: `Não foi possível iniciar ${scraper.name}.` });
      }
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setStartingScraperId(null);
    }
  };

  return {
    stats: query.data?.stats ?? null,
    resources: query.data?.resources ?? null,
    services: query.data?.services ?? [],
    scrapers,
    chartPoints: query.data?.chartPoints ?? [],
    lastUpdatedAt: query.updatedAt,
    isLoading: query.loading,
    isRefreshing: query.refreshing,
    stale: query.stale,
    error: query.error,
    operationalMessage: operationalNotice(operational, canReadOperational),
    operational,
    refresh,
    toggleScraper,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
}
