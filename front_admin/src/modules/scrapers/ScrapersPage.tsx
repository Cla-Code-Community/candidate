import {
  Activity,
  Briefcase,
  Database,
  Globe2,
  KeyRound,
  Link2,
  RefreshCw,
  ServerCog,
  Trash2,
} from "lucide-react";
import { formatNumber } from "../../utils/formatNumber";
import { useAuth } from "../auth/hooks/useAuth";
import { EventConsole } from "./components/EventConsole/EventConsole";
import { ScraperGrid } from "./components/ScraperGrid/ScraperGrid";
import { useScrapers } from "./hooks/useScrapers";
import type {
  ScraperAdapter,
  ScraperJobPreview,
  ScraperOverview,
} from "./schemas/scraper.schema";

function formatTimestamp(value: string | null): string {
  if (!value) return "Sem atualização";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function OverviewCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Briefcase;
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

function OverviewCards({ overview }: { overview: ScraperOverview }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <OverviewCard
        label="Vagas no índice"
        value={formatNumber(overview.indexedJobs)}
        helper="SCARD scraper:jobs:index"
        icon={Database}
      />
      <OverviewCard
        label="Vagas carregadas"
        value={formatNumber(overview.loadedJobs)}
        helper="Amostra retornada por /admin/jobs"
        icon={Briefcase}
      />
      <OverviewCard
        label="Adapters detectados"
        value={overview.adaptersCount}
        helper="Agrupamentos exibidos abaixo"
        icon={Globe2}
      />
      <OverviewCard
        label="Fontes configuradas"
        value={overview.configuredSourcesCount}
        helper={`${overview.sourcesCount} observadas no índice`}
        icon={Link2}
      />
      <OverviewCard
        label="Keywords vistas"
        value={overview.keywordsCount}
        helper="Derivado do payload das vagas"
        icon={KeyRound}
      />
      <OverviewCard
        label="Execução"
        value={`${overview.runningCount}/${overview.totalScrapers}`}
        helper="Scrapers ativos agora"
        icon={Activity}
      />
    </div>
  );
}

function AdapterPanel({
  adapters,
  sourcesCount,
}: {
  adapters: ScraperAdapter[];
  sourcesCount: number;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Adapters Funcionais
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Fontes encontradas no índice atual de vagas.
          </p>
        </div>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {adapters.length} adapters • {sourcesCount} fontes observadas
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {adapters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400 md:col-span-2 xl:col-span-4">
            Nenhum adapter encontrado no payload de vagas.
          </div>
        ) : (
          adapters.map((adapter) => (
            <div
              key={adapter.name}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {adapter.name}
                </p>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(adapter.jobs)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                {adapter.sources}/{adapter.configuredSources} fontes •{" "}
                {adapter.keywords} keywords
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-400 dark:text-slate-500">
                {adapter.sampleTitle ?? "sem amostra"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function JobsPanel({ jobs }: { jobs: ScraperJobPreview[] }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Vagas Buscadas
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Últimas vagas carregadas do endpoint administrativo do scraper.
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Nenhuma vaga carregada do backend ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="pb-3 font-semibold">Vaga</th>
                <th className="pb-3 font-semibold">Empresa</th>
                <th className="pb-3 font-semibold">Fonte</th>
                <th className="pb-3 font-semibold">Keyword</th>
                <th className="pb-3 font-semibold">Local</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900"
                >
                  <td className="max-w-xs py-3 pr-4">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-bold text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300"
                    >
                      {job.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4 font-semibold text-slate-500 dark:text-slate-400">
                    {job.company}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {job.source}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                    {job.keyword}
                  </td>
                  <td className="py-3 text-slate-500 dark:text-slate-400">
                    {job.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ScrapersPage() {
  const { isLoggedIn } = useAuth();
  const {
    scrapers,
    adapterStats,
    jobPreviews,
    overview,
    logs,
    isLoading,
    isRefreshing,
    isStarting,
    isClearingJobsCache,
    error,
    refresh,
    toggleScraper,
    startAll,
    pauseAll,
    clearJobsCache,
    clearLogs,
    refreshIntervalMs,
  } = useScrapers();
  const canClearJobsCache = isLoggedIn?.role === "super_admin";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ServerCog size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Operação dos scrapers
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atualiza status/contagem a cada {Math.round(refreshIntervalMs / 1000)}s
                {" • "}
                último snapshot {formatTimestamp(overview.lastUpdatedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (canClearJobsCache) void clearJobsCache();
              }}
              disabled={!canClearJobsCache || isClearingJobsCache}
              title={
                canClearJobsCache
                  ? "Remove vagas e índices do Valkey"
                  : "Disponível apenas para super admin"
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:border-rose-500/60 dark:hover:bg-rose-500/10"
            >
              <Trash2
                size={14}
                className={isClearingJobsCache ? "animate-pulse" : undefined}
              />
              {isClearingJobsCache
                ? "Limpando cache..."
                : "Limpar cache de vagas"}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
            >
              <RefreshCw
                size={14}
                className={isRefreshing ? "animate-spin" : undefined}
              />
              Recarregar dados
            </button>
          </div>
        </div>
      </section>

      {isLoading && (
        <div className="rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0f131a] dark:text-slate-400">
          Carregando scrapers...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <OverviewCards overview={overview} />

      <ScraperGrid
        scrapers={scrapers}
        isStarting={isStarting}
        onToggle={toggleScraper}
        onStartAll={startAll}
        onPauseAll={pauseAll}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <AdapterPanel
          adapters={adapterStats}
          sourcesCount={overview.sourcesCount}
        />
        <JobsPanel jobs={jobPreviews} />
      </div>

      <EventConsole logs={logs} onClear={clearLogs} />
    </div>
  );
}
