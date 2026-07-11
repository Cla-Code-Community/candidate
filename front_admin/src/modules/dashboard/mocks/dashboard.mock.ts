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
  scraper: 99,
  postgres: 100,
  valkey: 100,
};

export const MOCK_SERVICES: ServiceHealth[] = [
  {
    name: "Backend API",
    status: "Operacional",
    sla: "99.9%",
    health: 100,
    tone: "success",
  },
  {
    name: "PostgreSQL",
    status: "Operacional",
    sla: "100%",
    health: 100,
    tone: "success",
  },
  {
    name: "Valkey (Redis)",
    status: "Operacional",
    sla: "100%",
    health: 100,
    tone: "success",
  },
  {
    name: "Go Scraper",
    status: "Operacional",
    sla: "98.7%",
    health: 99,
    tone: "success",
  },
  {
    name: "Prometheus",
    status: "Operacional",
    sla: "100%",
    health: 100,
    tone: "success",
  },
  {
    name: "Loki",
    status: "Operacional",
    sla: "100%",
    health: 100,
    tone: "success",
  },
];

export const MOCK_SCRAPERS: ScraperSummary[] = [
  {
    id: "linkedin",
    name: "LinkedIn Scraper",
    status: "Executando",
    lastRun: "2 min atrás",
    collected24h: 2543,
    active: true,
  },
  {
    id: "infojobs",
    name: "InfoJobs Scraper",
    status: "Executando",
    lastRun: "1 min atrás",
    collected24h: 1872,
    active: true,
  },
  {
    id: "glassdoor",
    name: "Glassdoor Scraper",
    status: "Executando",
    lastRun: "3 min atrás",
    collected24h: 1456,
    active: true,
  },
  {
    id: "indeed",
    name: "Indeed Scraper",
    status: "Executando",
    lastRun: "1 min atrás",
    collected24h: 2850,
    active: true,
  },
];
