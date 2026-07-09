import { dashboardApi } from "../../../lib/api/dashboard.api";
import type { DashboardOverview as BackendDashboardOverview } from "../../../lib/api/types";
import type {
  DashboardStats,
  ResourceUsage,
  ScraperSummary,
  ServiceHealth,
} from "../schemas";

type DashboardViewModel = {
  stats: DashboardStats;
  resources: ResourceUsage;
  services: ServiceHealth[];
  scrapers: ScraperSummary[];
  generatedAt: string;
};

const SERVICE_LABELS: Record<
  keyof BackendDashboardOverview["services"]["services"],
  string
> = {
  postgres: "Postgres",
  valkey: "Valkey",
  scraper: "Scraper",
};

function statusLabel(status: string): string {
  if (status === "ok") return "Online";
  if (status === "degraded") return "Instavel";
  return "Indisponivel";
}

function statusTone(status: string): ServiceHealth["tone"] {
  if (status === "ok") return "success";
  if (status === "degraded") return "warning";
  return "danger";
}

function healthScore(status: string): number {
  if (status === "ok") return 99;
  if (status === "degraded") return 65;
  return 0;
}

function formatLastRun(value: string | null): string {
  if (!value) return "Sem execucao";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function toViewModel(overview: BackendDashboardOverview): DashboardViewModel {
  const services = Object.entries(overview.services.services).map(
    ([key, service]) => ({
      name:
        SERVICE_LABELS[
          key as keyof BackendDashboardOverview["services"]["services"]
        ],
      status: statusLabel(service.status),
      sla:
        service.latencyMs !== undefined
          ? `${service.latencyMs}ms`
          : service.error ?? "Sem resposta",
      health: healthScore(service.status),
      tone: statusTone(service.status),
    }),
  );

  return {
    stats: {
      totalUsers: {
        value: overview.stats.totalUsers,
        trend: "Postgres",
        positive: true,
      },
      activeUsers: {
        value: overview.stats.activeUsers,
        trend: "contas ativas",
        positive: true,
      },
      totalJobs: {
        value: overview.stats.totalCollectedJobs,
        trend: "índice Valkey",
        positive: true,
      },
      jobsToday: {
        value: overview.stats.jobsCollectedToday,
        trend: "coletadas hoje",
        positive: true,
      },
    },
    resources: {
      scraper: healthScore(overview.services.services.scraper.status),
      postgres: healthScore(overview.services.services.postgres.status),
      valkey: healthScore(overview.services.services.valkey.status),
    },
    services,
    scrapers: overview.scrapers.map((scraper) => ({
      id: scraper.name,
      name: scraper.name,
      status: statusLabel(scraper.status),
      lastRun: formatLastRun(scraper.lastRunAt),
      collected24h: scraper.jobsCollected ?? 0,
      active: scraper.running,
    })),
    generatedAt: overview.generatedAt,
  };
}

async function getOverview(): Promise<DashboardViewModel> {
  return dashboardApi.getOverview().then(toViewModel);
}

export const dashboardService = {
  getOverview,

  async getStats(): Promise<DashboardStats> {
    return (await getOverview()).stats;
  },

  async getResources(): Promise<ResourceUsage> {
    return (await getOverview()).resources;
  },

  async getServices(): Promise<ServiceHealth[]> {
    return (await getOverview()).services;
  },

  async getScrapersSummary(): Promise<ScraperSummary[]> {
    return (await getOverview()).scrapers;
  },

  async toggleScraper(id: string, active: boolean): Promise<void> {
    void id;
    void active;
  },
};
