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
import type { CatalogProvider } from "./services/catalogInventory";
import type { ProcessorSnapshot } from "../observability/schemas/operationalSnapshot.schema";
import type { OperationalReading } from "../observability/services/operationalPresentation";
import { EXECUTION_LABELS, STAGE_LABELS } from "../observability/services/operationalPresentation";
import { formatNumber } from "../../utils/formatNumber";
import { useAuth } from "../auth/hooks/useAuth";
import { EventConsole } from "./components/EventConsole/EventConsole";
import { ScraperGrid } from "./components/ScraperGrid/ScraperGrid";
import { useScrapers } from "./hooks/useScrapers";
import type {
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

function OverviewCards({ overview, operational, canReadOperational, catalogMessage, catalogInventory = [], inventoryAvailable }: {
  overview: ScraperOverview;
  operational?: OperationalReading;
  canReadOperational?: boolean;
  catalogMessage?: string;
  catalogInventory?: CatalogProvider[];
  inventoryAvailable?: boolean;
}) {
  const p = operational?.snapshot?.processor;
  const useSnapshot = canReadOperational === true;
  const ratio = (completed?: number, total?: number) => completed === undefined || total === undefined ? "N/D" : `${completed}/${total}`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <OverviewCard
        label="Vagas no catálogo"
        value={overview.catalogJobs === null ? "N/D" : formatNumber(overview.catalogJobs)}
        helper={catalogMessage ?? "Catálogo ativo PostgreSQL"}
        icon={Database}
      />
      <OverviewCard
        label="Vagas carregadas"
        value={overview.loadedJobs === null ? "N/D" : formatNumber(overview.loadedJobs)}
        helper="Amostra do catálogo (limite de 200)"
        icon={Briefcase}
      />
      <OverviewCard
        label="Providers/fontes no catálogo"
        value={inventoryAvailable ? catalogInventory.filter((row) => row.observed).length : "N/D"}
        helper="Grupos globais por fonte principal; inclui sem fonte"
        icon={Globe2}
      />
      <OverviewCard
        label="Providers configurados"
        value={overview.configuredSourcesCount ?? "N/D"}
        helper="Inventário construído no startup do Processor"
        icon={Link2}
      />
      <OverviewCard
        label={useSnapshot ? "Entradas de keywords" : "Keywords na amostra"}
        value={useSnapshot ? ratio(p?.progress.keywordsProcessed, p?.progress.keywordsTotal) : overview.keywordsCount ?? "N/D"}
        helper={useSnapshot ? "Entradas processadas na execução" : "Distintas na amostra do catálogo"}
        icon={KeyRound}
      />
      <OverviewCard
        label="Execução"
        value={useSnapshot ? (p ? EXECUTION_LABELS[p.execution.status] : "N/D") : ratio(overview.runningCount ?? undefined, overview.totalScrapers ?? undefined)}
        helper={useSnapshot ? (p ? `${p.execution.stage ? STAGE_LABELS[p.execution.stage] : "Etapa N/D"} • ${ratio(p.progress.tasksCompleted, p.progress.tasksTotal)} tarefas encerradas` : "Estado operacional indisponível") : "Scheduler: processamentos ativos agora"}
        icon={Activity}
      />
    </div>
  );
}

function AdapterPanel({ inventory = [], available = false, configurationAvailable = false, message, processor, showProviders = false }: {
  inventory?: CatalogProvider[];
  available?: boolean;
  configurationAvailable?: boolean;
  message?: string;
  processor?: ProcessorSnapshot | null;
  showProviders?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      {showProviders && (
        <div className="mb-4 space-y-2 border-b border-slate-100 pb-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Providers desta execução</h3>
          <p className="wrap-anywhere">Run ID: {processor?.execution.runId ?? "N/D"} • Plano selecionado desta execução; não inventário global.</p>
          {processor?.providers == null ? <p>Providers da execução: N/D.</p> : processor.providers.length === 0 ? <p>Plano conhecido sem providers.</p> : (
            <table aria-label="Providers desta execução" className="block w-full text-left text-xs md:table">
              <thead className="sr-only md:not-sr-only md:table-header-group">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {["Provider", "Tarefas", "Coletadas", "Falhas", "Ativas / espera", "Último resultado"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {processor.providers.map((provider) => (
                  <tr key={provider.id} className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-200 py-3 last:border-0 md:table-row md:py-0 dark:border-slate-800">
                    <th scope="row" className="col-span-2 px-2 text-sm font-semibold text-slate-900 md:py-3 md:text-xs dark:text-slate-100">{provider.id}</th>
                    <td className="px-2 align-top tabular-nums md:py-3"><span className="mb-1 block text-[10px] md:hidden">Tarefas</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatNumber(provider.tasksCompleted)} / {formatNumber(provider.tasksTotal)}</span><span className="block text-[10px]">Encerradas / total</span></td>
                    <td className="px-2 align-top tabular-nums md:py-3"><span className="mb-1 block text-[10px] md:hidden">Coletadas</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatNumber(provider.jobsCollected)}</span></td>
                    <td className="px-2 align-top tabular-nums md:py-3"><span className="mb-1 block text-[10px] md:hidden">Falhas</span><span className={provider.tasksFailed > 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-slate-800 dark:text-slate-200"}>{formatNumber(provider.tasksFailed)}</span></td>
                    <td className="px-2 align-top tabular-nums md:py-3"><span className="mb-1 block text-[10px] md:hidden">Ativas / espera</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatNumber(provider.active)} / {formatNumber(provider.waiting)}</span></td>
                    <td className="col-span-2 px-2 align-top md:py-3">
                      <span className="mb-1 block text-[10px] md:hidden">Último resultado</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{provider.lastTaskStatus ?? "N/D"}</span>
                      <details className="mt-1">
                        <summary className="cursor-pointer rounded text-[11px] text-slate-500 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400">Detalhes<span className="sr-only"> de {provider.id}</span></summary>
                        <dl className="mt-2 space-y-2 wrap-anywhere text-[11px]">
                          <div><dt>Concorrência configurada</dt><dd className="text-slate-800 dark:text-slate-200">{formatNumber(provider.configuredConcurrency)}</dd></div>
                          <div><dt>Canceladas / timeouts</dt><dd className="text-slate-800 dark:text-slate-200">{formatNumber(provider.tasksCanceled)}</dd></div>
                          <div><dt>Duração da última tarefa</dt><dd className="text-slate-800 dark:text-slate-200">{provider.lastTaskDurationSeconds === null ? "N/D" : `${provider.lastTaskDurationSeconds}s`}</dd></div>
                          <div><dt>Fim da última tarefa</dt><dd className="text-slate-800 dark:text-slate-200">{provider.lastTaskFinishedAt ? new Date(provider.lastTaskFinishedAt).toLocaleString("pt-BR") : "N/D"}</dd></div>
                          <div><dt>Erro da tarefa</dt><dd className={provider.lastErrorType ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200"}>{provider.lastErrorType ?? "N/D"}</dd></div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p>Coleta conta resultados das tarefas, sem deduplicação. Tarefas encerradas incluem falhas; canceladas/timeouts contam tarefas iniciadas.</p>
        </div>
      )}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Fontes e providers do catálogo
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Catálogo completo por fonte principal; inventário configurado e execução são informações distintas.
          </p>
          {message && <p className="text-xs text-slate-400 dark:text-slate-500">{message}</p>}
        </div>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {available ? inventory.filter((row) => row.observed).length : "N/D"} observados • {configurationAvailable ? inventory.filter((row) => row.configured).length : "N/D"} configurados
        </span>
      </div>

      {!available && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Distribuição global N/D; não inferida da prévia.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {inventory.length === 0 ? <p className="col-span-full text-sm text-slate-500 dark:text-slate-400">{available ? configurationAvailable ? "Nenhuma fonte configurada ou observada no catálogo." : "Catálogo conhecido sem fontes; inventário configurado N/D." : "Inventário global N/D."}</p> : inventory.map((row) => {
          const run = showProviders && row.provider !== "unknown" ? processor?.providers?.find((provider) => provider.id === row.provider) : undefined;
          const operation = !showProviders ? "Execução: sem permissão" : run ? run.active > 0 ? "Coletando" : run.waiting > 0 ? "Aguardando permissão" : run.lastTaskStatus ? `Última tarefa: ${run.lastTaskStatus}` : "Participa do plano; sem tarefa encerrada" : processor?.providers && row.provider !== "unknown" ? "Fora do plano desta execução" : "Execução: N/D";
          return <article key={row.id} aria-label={`Fonte: ${row.name}`} className="flex h-full min-w-0 flex-col rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <p title={row.name} className="line-clamp-2 min-h-10 wrap-anywhere text-sm font-bold leading-5 text-slate-800 dark:text-slate-100">{row.name}</p>
            <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">{row.catalogJobs === null ? "N/D" : formatNumber(row.catalogJobs)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Vagas no catálogo</p>
            <details className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
              <summary aria-label={`Detalhes de ${row.name}`} className="cursor-pointer rounded text-xs font-semibold text-slate-500 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-400">Detalhes</summary>
              <div className="mt-3 space-y-1 wrap-anywhere text-[11px] text-slate-500 dark:text-slate-400">
                <p>Configurado: {row.configured === null ? "N/D" : row.configured ? "Sim" : "Não"}</p>
                <p>Observado no catálogo: {row.observed === null ? "N/D" : row.observed ? "Sim" : "Não"}</p>
                <p>{operation}</p>
                {run && <p>Run: {run.tasksCompleted}/{run.tasksTotal} tarefas encerradas • {run.jobsCollected} vagas coletadas</p>}
              </div>
            </details>
          </article>;
        })}
      </div>
    </section>
  );
}

function JobsPanel({ jobs, unavailable, message }: { jobs: ScraperJobPreview[]; unavailable?: boolean; message?: string }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Vagas Buscadas
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Prévia de até 8 vagas da amostra limitada a 200; o limite não interfere nas contagens globais do catálogo.
          </p>
          {message && <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {unavailable ? "Amostra indisponível; quantidade de vagas N/D." : "Nenhuma vaga carregada do backend ainda."}
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
    catalogInventory, inventoryAvailable, configurationAvailable, inventoryMessage,
    jobPreviews,
    overview,
    logs,
    isLoading,
    isRefreshing,
    startingScraperId,
    isClearingJobsCache,
    error,
    refresh,
    toggleScraper,
    clearJobsCache,
    clearLogs,
    refreshIntervalMs,
    operational, canReadOperational, operationalMessage, catalogMessage, sampleMessage, sampleUnavailable, listUnavailable,
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
                Operação do processamento de vagas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atualiza status/contagem a cada {Math.round(refreshIntervalMs / 1000)}s
                {" • "}
                última leitura do scheduler {formatTimestamp(overview.lastUpdatedAt)}
              </p>
              {operationalMessage && <p className="text-xs text-slate-500 dark:text-slate-400">{operationalMessage}</p>}
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
                  ? "Invalida o cache de buscas; sem índice versionado, limpa chaves legadas do Valkey"
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
                : "Limpar cache de buscas"}
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
          Carregando processamento de vagas...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <OverviewCards overview={overview} operational={operational} canReadOperational={canReadOperational} catalogMessage={catalogMessage} catalogInventory={catalogInventory} inventoryAvailable={inventoryAvailable} />

      <ScraperGrid
        scrapers={scrapers}
        unavailable={listUnavailable}
        startingScraperId={startingScraperId}
        onToggle={toggleScraper}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <AdapterPanel
          processor={operational?.snapshot?.processor}
          showProviders={canReadOperational}
          inventory={catalogInventory}
          available={inventoryAvailable}
          configurationAvailable={configurationAvailable}
          message={inventoryMessage}
        />
        <JobsPanel jobs={jobPreviews} unavailable={sampleUnavailable} message={sampleMessage} />
      </div>

      <EventConsole logs={logs} onClear={clearLogs} />
    </div>
  );
}
