import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "../../../components/notifications/useNotifications";
import { scrapersApi } from "../../../lib/api/scrapers.api";
import type {
  Scraper as BackendScraper,
  ScraperJob,
} from "../../../lib/api/types";
import type {
  LogEntry,
  Scraper,
  ScraperAdapter,
  ScraperJobPreview,
  ScraperOverview,
} from "../schemas/scraper.schema";

const REFRESH_INTERVAL_MS = 15_000;
const JOBS_PREVIEW_LIMIT = 8;
const CONFIGURED_SOURCE_COUNTS: Record<string, number> = {
  "Adzuna": 1,
  "Green House": 32,
  "Jooble": 1,
  "Lever": 34,
  "The Muse": 1,
  "linkedin": 1,
};
const CONFIGURED_SOURCES_TOTAL = Object.values(CONFIGURED_SOURCE_COUNTS).reduce(
  (total, count) => total + count,
  0,
);

function nowTime(): string {
  return new Date().toTimeString().split(" ")[0];
}

function formatLastRun(value: string | null | undefined): string {
  if (!value) return "Sem execucao";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(scraper: BackendScraper): string {
  if (scraper.status === "down") return "Indisponivel";
  return scraper.running ? "Executando" : "Ocioso";
}

function mapScraper(scraper: BackendScraper, fallbackTotal: number): Scraper {
  return {
    id: scraper.name,
    name: scraper.name,
    status: statusLabel(scraper),
    lastRun: formatLastRun(scraper.lastRunAt),
    indexedJobs: scraper.jobsCollected ?? fallbackTotal,
    active: scraper.running,
    sla: scraper.status === "down" ? "Indisponivel" : "Operacional",
  };
}

function splitSource(value: string): string[] {
  return value
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean);
}

function sourceEntriesFrom(job: ScraperJob): string[] {
  const rawSources = job.sources.length > 0 ? job.sources : [job.source];
  const sources = rawSources.flatMap(splitSource);

  return sources.length > 0 ? [...new Set(sources)] : ["desconhecido"];
}

function sourceFrom(job: ScraperJob): string {
  return sourceEntriesFrom(job).join(", ");
}

function keywordFrom(job: ScraperJob): string {
  return job.keyword || job.keywords[0] || "sem keyword";
}

function adapterFamilyFrom(source: string): string {
  if (source.startsWith("Adzuna")) return "Adzuna";
  if (source.startsWith("Green House")) return "Green House";
  if (source.startsWith("Lever")) return "Lever";
  if (source.startsWith("The Muse")) return "The Muse";
  if (source.toLowerCase().startsWith("linkedin")) return "linkedin";
  if (source.startsWith("Jooble")) return "Jooble";
  return source;
}

function configuredSourcesFor(adapterName: string): number {
  const families = new Set(sourceEntriesFromName(adapterName).map(adapterFamilyFrom));
  let total = 0;

  for (const family of families) {
    total += CONFIGURED_SOURCE_COUNTS[family] ?? 1;
  }

  return total;
}

function sourceEntriesFromName(value: string): string[] {
  const sources = splitSource(value);
  return sources.length > 0 ? sources : [value];
}

function buildAdapters(jobs: ScraperJob[]): ScraperAdapter[] {
  const adapters = new Map<
    string,
    {
      jobs: number;
      keywords: Set<string>;
      sources: Set<string>;
      sampleTitle?: string;
    }
  >();

  for (const job of jobs) {
    const source = sourceFrom(job);
    const current =
      adapters.get(source) ?? {
        jobs: 0,
        keywords: new Set<string>(),
        sources: new Set<string>(),
      };

    current.jobs += 1;
    current.keywords.add(keywordFrom(job));
    sourceEntriesFrom(job).forEach((entry) => current.sources.add(entry));
    current.sampleTitle ??= job.title;
    adapters.set(source, current);
  }

  return [...adapters.entries()]
    .map(([name, adapter]) => ({
      name,
      jobs: adapter.jobs,
      sources: adapter.sources.size,
      configuredSources: configuredSourcesFor(name),
      keywords: adapter.keywords.size,
      sampleTitle: adapter.sampleTitle,
    }))
    .sort((a, b) => b.jobs - a.jobs);
}

function buildJobPreviews(jobs: ScraperJob[]): ScraperJobPreview[] {
  return jobs
    .slice()
    .sort((a, b) => {
      const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, JOBS_PREVIEW_LIMIT)
    .map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source: sourceFrom(job),
      keyword: keywordFrom(job),
      postedAt: job.postedAt,
      url: job.url,
    }));
}

export function useScrapers() {
  const { notify } = useNotifications();
  const previousRunningRef = useRef<boolean | null>(null);
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [indexedJobs, setIndexedJobs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLog = useCallback((text: string) => {
    setLogs((prev) => [{ time: nowTime(), text }, ...prev].slice(0, 80));
  }, []);

  const refresh = useCallback(
    async ({ silent = false, includeJobs = false } = {}) => {
      if (!silent) setIsRefreshing(true);

      try {
        const [listResult, countResult] = await Promise.all([
          scrapersApi.list(),
          scrapersApi.jobsCount(),
        ]);
        const nextTotal = countResult.total;
        const nextScrapers = listResult.scrapers.map((scraper) =>
          mapScraper(scraper, nextTotal),
        );
        const running = nextScrapers.some((scraper) => scraper.active);

        if (
          previousRunningRef.current !== null &&
          previousRunningRef.current !== running
        ) {
          addLog(
            running
              ? "Scheduler reportou execução em andamento."
              : "Scheduler reportou scraper ocioso.",
          );
        }

        previousRunningRef.current = running;
        setScrapers(nextScrapers);
        setIndexedJobs(nextTotal);
        setLastUpdatedAt(new Date().toISOString());
        setError(null);

        if (includeJobs) {
          scrapersApi
            .jobs()
            .then((jobsResult) => {
              setJobs(jobsResult.jobs);
              setLastUpdatedAt(new Date().toISOString());
            })
            .catch(() => {
              addLog("Nao foi possivel carregar a lista detalhada de vagas.");
            });
        }
      } catch {
        setError("Nao foi possivel carregar os dados dos scrapers.");
        notify({
          tone: "error",
          title: "Erro ao carregar scrapers",
          description:
            "Não foi possível consultar status, contagem ou vagas do scraper.",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [addLog, notify],
  );

  useEffect(() => {
    void refresh({ includeJobs: true });
    const interval = window.setInterval(
      () => void refresh({ silent: true }),
      REFRESH_INTERVAL_MS,
    );

    return () => window.clearInterval(interval);
  }, [refresh]);

  const adapterStats = useMemo(() => buildAdapters(jobs), [jobs]);
  const jobPreviews = useMemo(() => buildJobPreviews(jobs), [jobs]);
  const keywordsCount = useMemo(() => {
    const keywords = new Set<string>();
    for (const job of jobs) keywords.add(keywordFrom(job));
    return keywords.size;
  }, [jobs]);
  const sourcesCount = useMemo(() => {
    const sources = new Set<string>();
    for (const job of jobs) {
      sourceEntriesFrom(job).forEach((source) => sources.add(source));
    }
    return sources.size;
  }, [jobs]);

  const overview: ScraperOverview = {
    indexedJobs,
    loadedJobs: jobs.length,
    adaptersCount: adapterStats.length,
    sourcesCount,
    configuredSourcesCount: CONFIGURED_SOURCES_TOTAL,
    keywordsCount,
    runningCount: scrapers.filter((scraper) => scraper.active).length,
    totalScrapers: scrapers.length,
    lastUpdatedAt,
  };

  const toggleScraper = (id: string) => {
    const scraper = scrapers.find((item) => item.id === id);
    if (!scraper) return;

    addLog(
      `Acao individual para ${scraper.name} ainda nao esta disponivel no backend.`,
    );
    notify({
      tone: "warning",
      title: "Ação indisponível",
      description:
        "O backend ainda não possui endpoint para pausar ou ativar um scraper individual.",
    });
  };

  const startAll = async () => {
    setIsStarting(true);
    try {
      const result = await scrapersApi.trigger();
      addLog(result.message || "Execucao dos scrapers iniciada.");
      notify({
        tone: "success",
        title: "Scrapers iniciados",
        description: result.message || "A execução dos scrapers foi solicitada.",
      });
      await refresh({ includeJobs: true });
    } catch {
      setError("Nao foi possivel iniciar os scrapers.");
      addLog("Falha ao solicitar execucao dos scrapers.");
      notify({
        tone: "error",
        title: "Erro ao iniciar scrapers",
        description:
          "O backend não conseguiu disparar a execução dos scrapers.",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const pauseAll = () => {
    addLog("Pausar scrapers ainda nao esta disponivel no backend.");
    notify({
      tone: "warning",
      title: "Pausa indisponível",
      description: "Ainda não existe endpoint para pausar todos os scrapers.",
    });
  };

  const reloadJobs = async () => {
    await refresh({ includeJobs: true });
    addLog("Lista de vagas e adapters recarregada a partir do backend.");
  };

  const clearLogs = () => setLogs([]);

  return {
    scrapers,
    adapterStats,
    jobPreviews,
    overview,
    logs,
    isLoading,
    isRefreshing,
    isStarting,
    error,
    refresh: reloadJobs,
    toggleScraper,
    startAll,
    pauseAll,
    clearLogs,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
}
