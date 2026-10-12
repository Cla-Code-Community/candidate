import { buildCatalogInventory } from "../services/catalogInventory";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "../../../components/notifications/useNotifications";
import { useAuth } from "../../auth/hooks/useAuth";
import { useOperationalSnapshot } from "../../observability/hooks/useOperationalSnapshot";
import { operationalNotice, withOperationalExecution } from "../../observability/services/operationalPresentation";
import { createPollingResource } from "../../../lib/polling/pollingResource";
import { usePollingResource } from "../../../lib/polling/usePollingResource";
import { ApiError } from "../../../lib/api/client";
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

function mapScraper(scraper: BackendScraper, catalogTotal: number | null): Scraper {
  return {
    id: scraper.name,
    name: scraper.name,
    status: statusLabel(scraper),
    lastRun: formatLastRun(scraper.lastRunAt),
    catalogJobs: catalogTotal,
    active: scraper.running,
    availability: scraper.status === "down" ? "Indisponivel" : "Operacional",
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
    for (const keyword of [job.keyword, ...job.keywords]) {
      if (keyword) current.keywords.add(keyword);
    }
    sourceEntriesFrom(job).forEach((entry) => current.sources.add(entry));
    current.sampleTitle ??= job.title;
    adapters.set(source, current);
  }

  return [...adapters.entries()]
    .map(([name, adapter]) => ({
      name,
      jobs: adapter.jobs,
      sources: adapter.sources.size,
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

const EMPTY_JOBS: ScraperJob[] = [];
function createScraperResources(sessionKey: string) {
  void sessionKey; // Resource lifetime follows the authenticated session.
  return {
    listResource: createPollingResource({
      load: (signal) => scrapersApi.list(signal), intervalMs: REFRESH_INTERVAL_MS,
      errorMessage: "Nao foi possivel carregar os dados do processamento.",
    }),
    countResource: createPollingResource({
      load: (signal) => scrapersApi.jobsCount(signal), intervalMs: REFRESH_INTERVAL_MS,
      errorMessage: "Nao foi possivel carregar a contagem do catálogo.",
    }),
    jobsResource: createPollingResource({
      load: (signal) => scrapersApi.jobs(200, signal), intervalMs: 0,
      errorMessage: "Amostra do catálogo indisponível.",
    }),
  };
}

export function useScrapers() {
  const { notify } = useNotifications();
  const { isLoggedIn } = useAuth();
  const canReadOperational = isLoggedIn?.role === "admin" || isLoggedIn?.role === "super_admin";
  const sessionKey = `${isLoggedIn?.id ?? "anonymous"}:${isLoggedIn?.role ?? "none"}`;
  const operational = useOperationalSnapshot(canReadOperational, 10_000, sessionKey);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);
  const clearingRef = useRef(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [startingScraperId, setStartingScraperId] = useState<string | null>(null);
  const [isClearingJobsCache, setIsClearingJobsCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerForbidden, setTriggerForbidden] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const addLog = useCallback((text: string) => {
    if (mountedRef.current) setLogs((prev) => [{ time: nowTime(), text }, ...prev].slice(0, 80));
  }, [setLogs]);
  const resources = useMemo(() => createScraperResources(sessionKey), [sessionKey]);
  const { listResource, countResource, jobsResource } = resources;
  useEffect(() => {
    let previousRunning: boolean | null = null;
    let previousSampleError: string | null = null;
    const unsubscribeList = listResource.subscribe(() => {
      const data = listResource.getSnapshot().data;
      if (!data) return;
      const running = data.scrapers.some((scraper) => scraper.running);
      if (previousRunning !== null && previousRunning !== running) {
        addLog(running ? "Scheduler reportou execução em andamento." : "Scheduler reportou processamento ocioso.");
      }
      previousRunning = running;
    });
    const unsubscribeJobs = jobsResource.subscribe(() => {
      const error = jobsResource.getSnapshot().error;
      if (error && error !== previousSampleError) addLog("Nao foi possivel carregar a lista detalhada de vagas.");
      previousSampleError = error;
    });
    return () => { unsubscribeList(); unsubscribeJobs(); };
  }, [listResource, jobsResource, addLog]);
  const list = usePollingResource(listResource);
  const count = usePollingResource(countResource);
  const sample = usePollingResource(jobsResource);
  const catalogJobs = count.data?.total ?? null;
  const jobs = sample.data?.jobs ?? EMPTY_JOBS;
  const scrapers = (list.data?.scrapers ?? []).map((item) => {
    const mapped = mapScraper(item, catalogJobs);
    const merged = withOperationalExecution(mapped, operational, canReadOperational);
    return { ...merged,
      availability: canReadOperational && item.name === "go-scraper"
        ? operational.snapshot?.processor && !operational.stale ? "Processor acessível" : "N/D"
        : mapped.availability,
      runDisabled: !canReadOperational || triggerForbidden || list.stale || merged.runDisabled || merged.active ,
    };
  });
  const refresh = async ({ includeJobs = false } = {}) => {
    await Promise.all([list.refresh(), count.refresh(), operational.refresh(), ...(includeJobs ? [sample.refresh()] : [])]);
  };
  const catalogInventory = useMemo(() => buildCatalogInventory(count.data), [count.data]);
  const adapterStats = useMemo(() => buildAdapters(jobs), [jobs]);
  const jobPreviews = useMemo(() => buildJobPreviews(jobs), [jobs]);
  const keywords = new Set(jobs.flatMap((job) => [job.keyword, ...job.keywords]).filter(Boolean));
  const sources = new Set(jobs.flatMap(sourceEntriesFrom).filter((source) => source !== "desconhecido"));
  const overview: ScraperOverview = {
    catalogJobs,
    loadedJobs: sample.data ? jobs.length : null,
    adaptersCount: sample.data ? adapterStats.length : null,
    sourcesCount: sample.data ? sources.size : null,
    configuredSourcesCount: count.data?.configuredProviders?.length ?? null,
    keywordsCount: sample.data ? keywords.size : null,
    runningCount: list.data ? scrapers.filter((scraper) => scraper.active).length : null,
    totalScrapers: list.data ? scrapers.length : null,
    lastUpdatedAt: list.updatedAt,
  };
  const runScraper = async (id: string) => {
    const scraper = scrapers.find((item) => item.id === id);
    if (!scraper || pendingRef.current) return;

    if (scraper.active) {
      addLog(`${scraper.name} ja esta em execucao.`);
      notify({
        tone: "warning",
        title: "Processamento já em execução",
        description: `${scraper.name} já está rodando neste momento.`,
      });
      return;
    }

    if (scraper.runDisabled) return;
    pendingRef.current = true;
    setStartingScraperId(id);
    try {
      const result = await scrapersApi.triggerOne(id);
      if (!mountedRef.current) return;
      addLog(result.message || `${scraper.name} iniciado.`);
      notify({
        tone: "success",
        title: "Execução solicitada",
        description: result.message || `Solicitação aceita para ${scraper.name}.`,
      });
      await refresh({ includeJobs: true });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) setTriggerForbidden(true);
      if (error instanceof ApiError && error.status === 409) {
        addLog(`${scraper.name} ja esta em execucao.`);
        notify({
          tone: "warning",
          title: "Processamento já em execução",
          description: "A execução atual ainda não terminou.",
        });
        await refresh({ includeJobs: true });
        return;
      }

      setError(`Nao foi possivel iniciar ${scraper.name}.`);
      addLog(`Falha ao solicitar execucao de ${scraper.name}.`);
      notify({
        tone: "error",
        title: "Erro ao iniciar processamento",
        description: `O backend não conseguiu disparar ${scraper.name}.`,
      });
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setStartingScraperId(null);
    }
  };

  const startAll = async () => {
    if (!canReadOperational || triggerForbidden || pendingRef.current || !operational.snapshot || operational.stale || ["running", "canceling"].includes(operational.snapshot.processor?.execution.status ?? "")) return;
    pendingRef.current = true;
    setStartingScraperId("__all__");
    try {
      const result = await scrapersApi.trigger();
      if (!mountedRef.current) return;
      addLog(result.message || "Execucao do processamento iniciada.");
      notify({
        tone: "success",
        title: "Execução solicitada",
        description: result.message || "A execução do processamento foi solicitada.",
      });
      await refresh({ includeJobs: true });
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) setTriggerForbidden(true);
      if (error instanceof ApiError && error.status === 409) {
        addLog("Processamento ja esta em execucao.");
        notify({
          tone: "warning",
          title: "Processamento já em execução",
          description: "A execução atual ainda não terminou.",
        });
        await refresh({ includeJobs: true });
        return;
      }

      setError("Nao foi possivel iniciar o processamento.");
      addLog("Falha ao solicitar execucao do processamento.");
      notify({
        tone: "error",
        title: "Erro ao iniciar processamento",
        description:
          "O backend não conseguiu disparar a execução do processamento.",
      });
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setStartingScraperId(null);
    }
  };

  const pauseAll = () => {
    addLog("Pausar processamento ainda nao esta disponivel no backend.");
    notify({
      tone: "warning",
      title: "Pausa indisponível",
      description: "Ainda não existe endpoint para pausar o processamento.",
    });
  };

  const clearJobsCache = async () => {
    if (clearingRef.current || isLoggedIn?.role !== "super_admin") return;
    clearingRef.current = true;
    setIsClearingJobsCache(true);
    try {
      const result = await scrapersApi.clearJobsCache();
      if (!mountedRef.current) return;
      const versioned = result.patterns.includes("jobs:search:generation");
      const description = versioned
        ? "Cache de buscas invalidado. Catálogo e índice ativo preservados."
        : `Cache legado: ${result.deleted} chaves removidas do Valkey (${result.patterns.join(", ")}). Catálogo PostgreSQL preservado.`;
      addLog(description);
      notify({
        tone: "success",
        title: "Cache atualizado",
        description,
      });
      await refresh({ includeJobs: true });
    } catch {
      if (!mountedRef.current) return;
      setError("Nao foi possivel limpar o cache de vagas.");
      addLog("Falha ao limpar cache de vagas no Valkey.");
      notify({
        tone: "error",
        title: "Erro ao limpar cache",
        description:
          "A API administrativa não conseguiu atualizar o cache de buscas.",
      });
    } finally {
      clearingRef.current = false;
      if (mountedRef.current) setIsClearingJobsCache(false);
    }
  };

  const reloadJobs = async () => {
    await refresh({ includeJobs: true });
    addLog("Lista de vagas e adapters recarregada a partir do backend.");
  };
  const clearLogs = () => setLogs([]);
  return {
    scrapers, adapterStats, catalogInventory, jobPreviews, overview, logs,
    inventoryMessage: count.stale ? "Inventário/contagens desatualizados; última leitura válida." : count.data?.sources == null ? "Distribuição global N/D; não inferida da prévia." : "Contagens globais do catálogo ativo por fonte principal; cada vaga conta uma vez.",
    inventoryAvailable: count.data?.sources != null,
    configurationAvailable: count.data?.configuredProviders != null,
    isLoading: list.loading || count.loading,
    isRefreshing: list.refreshing || count.refreshing || sample.refreshing,
    isStarting: startingScraperId !== null, startingScraperId, isClearingJobsCache,
    error: error ?? list.error ?? count.error,
    catalogMessage: count.stale ? "Catálogo desatualizado ou indisponível." : count.data ? "Catálogo ativo PostgreSQL" : "Catálogo N/D",
    sampleMessage: sample.error ?? (sample.stale ? "Amostra desatualizada." : sample.updatedAt ? `Amostra consultada em ${new Date(sample.updatedAt).toLocaleTimeString("pt-BR")}` : "Amostra N/D"),
    sampleUnavailable: sample.data === null,
    listUnavailable: list.data === null,
    operational, canReadOperational,
    operationalMessage: operationalNotice(operational, canReadOperational),
    refresh: reloadJobs, toggleScraper: runScraper, startAll, pauseAll,
    clearJobsCache, clearLogs, refreshIntervalMs: REFRESH_INTERVAL_MS,
  };
}
