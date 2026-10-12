import type {
  DashboardStats,
  ResourceUsage,
  ScraperSummary,
  ServiceHealth,
} from "../schemas";

export const MOCK_STATS: DashboardStats = {
  totalUsers: { value: 12458, trend: "+2,4%", positive: true },
  activeUsers: { value: 3092, trend: "+8,1%", positive: true },
  totalJobs: { value: 568342, trend: "+12,7%", positive: true },
  jobsToday: { value: 8721, trend: "+15,3%", positive: true },
};

export const MOCK_RESOURCES: ResourceUsage = {
  scraper: "ok",
  postgres: "ok",
  valkey: "ok",
};

export const MOCK_SERVICES: ServiceHealth[] = [
  {
    name: "Backend API",
    status: "Operacional",
    sla: "99.9%",
    health: "ok",
    tone: "success",
  },
  {
    name: "PostgreSQL",
    status: "Operacional",
    sla: "100%",
    health: "ok",
    tone: "success",
  },
  {
    name: "Valkey (Redis)",
    status: "Operacional",
    sla: "100%",
    health: "ok",
    tone: "success",
  },
  {
    name: "Go Scraper",
    status: "Operacional",
    sla: "98.7%",
    health: "ok",
    tone: "success",
  },
  {
    name: "Prometheus",
    status: "Operacional",
    sla: "100%",
    health: "ok",
    tone: "success",
  },
  {
    name: "Loki",
    status: "Operacional",
    sla: "100%",
    health: "ok",
    tone: "success",
  },
];

export const MOCK_SCRAPERS: ScraperSummary[] = [
  {
    id: "linkedin",
    name: "LinkedIn Scraper",
    status: "Executando",
    lastRun: "2 min atrás",
    catalogJobs: 2543,
    active: true,
  },
  {
    id: "infojobs",
    name: "InfoJobs Scraper",
    status: "Executando",
    lastRun: "1 min atrás",
    catalogJobs: 1872,
    active: true,
  },
  {
    id: "glassdoor",
    name: "Glassdoor Scraper",
    status: "Executando",
    lastRun: "3 min atrás",
    catalogJobs: 1456,
    active: true,
  },
  {
    id: "indeed",
    name: "Indeed Scraper",
    status: "Executando",
    lastRun: "1 min atrás",
    catalogJobs: 2850,
    active: true,
  },
];
