export interface Viewport {
  width: number;
  height: number;
}

export interface AppConfig {
  headless: boolean;
  waitBetweenSearchesMs: number;
  pageTimeoutMs: number;
  maxPagesPerKeyword: number;
  viewport: Viewport;
  searchLocation: string;
  searchGeoId: string;
  searchLanguage: string;
  remoteOnly: boolean;
  jobTypes: string;
  timeFilter: string;
  databaseUrl: string;
  valkeyUrl: string;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

export const config = {
  scraperUrl: process.env.SCRAPER_URL ?? "http://scraper-go:8081",
  prometheusUrl: process.env.PROMETHEUS_URL ?? "http://prometheus:9090",
};

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimeFilter(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = value.trim();
  return /^r\d+$/.test(normalized) ? normalized : fallback;
}

export function getConfig(): AppConfig {
  return {
    headless: parseBoolean(process.env.HEADLESS, false),
    waitBetweenSearchesMs: parseNumber(
      process.env.WAIT_BETWEEN_SEARCHES_MS,
      5000,
    ),
    pageTimeoutMs: parseNumber(process.env.PAGE_TIMEOUT_MS, 10000),
    maxPagesPerKeyword: parseNumber(process.env.MAX_PAGES_PER_KEYWORD, 5),
    viewport: {
      width: parseNumber(process.env.VIEWPORT_WIDTH, 1280),
      height: parseNumber(process.env.VIEWPORT_HEIGHT, 800),
    },
    searchLocation: process.env.SEARCH_LOCATION ?? "Brasil",
    searchGeoId: process.env.SEARCH_GEO_ID ?? "106057199",
    searchLanguage: process.env.SEARCH_LANGUAGE ?? "pt",
    remoteOnly: parseBoolean(process.env.REMOTE_ONLY, true),
    jobTypes: process.env.JOB_TYPES ?? "C,F",
    timeFilter: parseTimeFilter(process.env.TIME_FILTER, "r604800"),
    databaseUrl: process.env.DATABASE_URL?.trim() ?? "",
    valkeyUrl: process.env.VALKEY_URL?.trim() ?? "",
  };
}
