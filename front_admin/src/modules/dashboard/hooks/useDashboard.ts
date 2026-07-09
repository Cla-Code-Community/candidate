import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DashboardChartPoint,
  DashboardStats,
  ResourceUsage,
  ScraperSummary,
  ServiceHealth,
} from "../schemas";
import { dashboardService } from "../services/dashboard.service";

const REFRESH_INTERVAL_MS = 10_000;
const MAX_CHART_POINTS = 24;

type DashboardState = {
  stats: DashboardStats | null;
  resources: ResourceUsage | null;
  services: ServiceHealth[];
  scrapers: ScraperSummary[];
  chartPoints: DashboardChartPoint[];
  lastUpdatedAt: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

const INITIAL_STATE: DashboardState = {
  stats: null,
  resources: null,
  services: [],
  scrapers: [],
  chartPoints: [],
  lastUpdatedAt: null,
  isLoading: true,
  isRefreshing: false,
  error: null,
};

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

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;

    setState((current) => ({
      ...current,
      isRefreshing: silent ? current.isRefreshing : true,
    }));

    try {
      const overview = await dashboardService.getOverview();
      const nextPoint = chartPointFrom(overview.stats, overview.generatedAt);

      if (!mountedRef.current) return;

      setState((current) => ({
        stats: overview.stats,
        resources: overview.resources,
        services: overview.services,
        scrapers: overview.scrapers,
        chartPoints: appendChartPoint(current.chartPoints, nextPoint),
        lastUpdatedAt: overview.generatedAt,
        isLoading: false,
        isRefreshing: false,
        error: null,
      }));
    } catch {
      if (!mountedRef.current) return;

      setState((current) => ({
        ...current,
        isLoading: false,
        isRefreshing: false,
        error: "Nao foi possivel atualizar as metricas do dashboard.",
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const load = (silent = false) => {
      if (!mountedRef.current) return;
      void refresh(silent);
    };

    load();
    const interval = window.setInterval(() => load(true), REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  const toggleScraper = (id: string) => {
    const scraper = state.scrapers.find((item) => item.id === id);
    if (!scraper) return;

    void dashboardService.toggleScraper(id, !scraper.active);
  };

  return {
    ...state,
    refresh: () => refresh(false),
    toggleScraper,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
}
