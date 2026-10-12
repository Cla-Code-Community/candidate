import "./observability.css";
import { ApiError } from "../../lib/api/client";
import { useAuth } from "../auth/hooks/useAuth";
import { useOperationalSnapshot } from "./hooks/useOperationalSnapshot";
import { OperationalSnapshotPanels, ProcessorResources } from "./components/OperationalSnapshotPanels";
import { HealthOverview } from "./components/HealthOverview";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { createPollingResource } from "../../lib/polling/pollingResource";
import { usePollingResource } from "../../lib/polling/usePollingResource";
import {
  observabilityApi,
  type ObservabilityRange,
} from "../../lib/api/observability.api";
import type {
  ObservabilityDashboard,
} from "../../lib/api/types";
import { ObservabilityPanelCard } from "./components/ObservabilityPanelCard";
const RANGES: Array<{ label: string; value: ObservabilityRange }> = [
  { label: "5 min", value: "5m" },
  { label: "15 min", value: "15m" },
  { label: "1 h", value: "1h" },
  { label: "6 h", value: "6h" },
  { label: "24 h", value: "24h" },
];

const DASHBOARD_SHELLS: ObservabilityDashboard[] = [
  {
    id: "api",
    title: "API Overview",
    description: "Tráfego, latencia, erros e cache da API Node.",
    panels: [
      {
        id: "requests-sec",
        title: "Requests/sec",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "latency-p95",
        title: "Latencia p95",
        unit: "ms",
        visualization: "line",
        series: [],
      },
      {
        id: "error-rate",
        title: "Taxa de erro (4xx/5xx)",
        unit: "percent",
        visualization: "line",
        series: [],
      },
      {
        id: "jobs-searches",
        title: "Buscas de vagas",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "cache-hit-rate",
        title: "Cache hit rate",
        unit: "percent",
        visualization: "line",
        series: [],
      },
    ],
  },
  {
    id: "infra",
    title: "Infraestrutura",
    description: "Containers, host, Postgres e Valkey.",
    panels: [
      {
        id: "container-cpu",
        title: "CPU por container",
        unit: "percent",
        visualization: "line",
        series: [],
      },
      {
        id: "container-memory",
        title: "Memoria por container",
        unit: "bytes",
        visualization: "line",
        series: [],
      },
      {
        id: "postgres-connections",
        title: "Postgres - conexoes ativas",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "valkey-memory",
        title: "Valkey - memoria usada",
        unit: "bytes",
        visualization: "line",
        series: [],
      },
      {
        id: "host-cpu",
        title: "CPU do host",
        unit: "percent",
        visualization: "line",
        series: [],
      },
      {
        id: "host-memory",
        title: "Memoria do host",
        unit: "bytes",
        visualization: "line",
        series: [],
      },
    ],
  },
  {
    id: "business",
    title: "Business",
    description: "Volume de buscas, vagas, cache e usuarios.",
    panels: [
      {
        id: "searches-24h",
        title: "Buscas realizadas",
        unit: "count",
        visualization: "stat",
        series: [],
      },
      {
        id: "jobs-collected",
        title: "Vagas coletadas",
        unit: "count",
        visualization: "stat",
        series: [],
      },
      {
        id: "business-cache-hit",
        title: "Cache hit rate",
        unit: "percent",
        visualization: "stat",
        series: [],
      },
      {
        id: "users-total",
        title: "Usuarios cadastrados",
        unit: "count",
        visualization: "stat",
        series: [],
      },
      {
        id: "jobs-by-day-adapter",
        title: "Vagas coletadas por dia, por adapter",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "saved-jobs",
        title: "Vagas salvas",
        unit: "count",
        visualization: "stat",
        series: [],
      },
    ],
  },
  {
    id: "scraper-health",
    title: "Saúde do processamento",
    description: "Estado e progresso agregado do Processor; leitura operacional independente do Prometheus.",
    panels: [
      {
        id: "adapter-runs",
        title: "Execucoes por adapter",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "adapter-duration",
        title: "Duracao media por adapter",
        unit: "seconds",
        visualization: "line",
        series: [],
      },
      {
        id: "jobs-total",
        title: "Vagas encontradas (total acumulado)",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "adapter-errors",
        title: "Erros por adapter",
        unit: "count",
        visualization: "line",
        series: [],
      },
      {
        id: "pipeline-duration",
        title: "Duracao do pipeline completo",
        unit: "seconds",
        visualization: "line",
        series: [],
      },
      {
        id: "jobs-per-run",
        title: "Vagas por rodada (apos dedup)",
        unit: "count",
        visualization: "line",
        series: [],
      },
    ],
  },
];

function createObservabilityResources(sessionKey: string) {
  void sessionKey;
  let seriesForbidden = false;
  return {
    healthResource: createPollingResource({
      load: (signal) => observabilityApi.health(signal), intervalMs: 10_000,
      errorMessage: "Saúde dos serviços indisponível.",
    }),
    metricsResource: createPollingResource({
      load: (signal) => observabilityApi.metrics(signal), intervalMs: 10_000,
      errorMessage: "Métricas da API indisponíveis.",
    }),
    dashboards: (range: ObservabilityRange) => createPollingResource({
      load: async (signal) => {
        if (seriesForbidden) throw new ApiError(403, "Sem autorização");
        try { return await observabilityApi.dashboards(range, signal); }
        catch (error) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) seriesForbidden = true;
          throw error;
        }
      }, intervalMs: 10_000,
      errorMessage: "Sem resposta das series detalhadas. Exibindo a estrutura dos dashboards.",
    }),
  };
}

export function ObservabilityPage() {
  const { isLoggedIn } = useAuth();
  const canReadMetrics = isLoggedIn?.role === "admin" || isLoggedIn?.role === "super_admin";
  const sessionKey = `${isLoggedIn?.id ?? "anonymous"}:${isLoggedIn?.role ?? "none"}`;
  const operational = useOperationalSnapshot(canReadMetrics, 10_000, sessionKey);
  const [range, setRange] = useState<ObservabilityRange>("15m");
  const resources = useMemo(() => createObservabilityResources(sessionKey), [sessionKey]);
  const { healthResource, metricsResource } = resources;
  const dashboardsResource = useMemo(() => resources.dashboards(range), [range, resources]);
  const health = usePollingResource(healthResource);
  const metricQuery = usePollingResource(metricsResource, canReadMetrics);
  const series = usePollingResource(dashboardsResource, canReadMetrics);
  const dashboards = series.data
    ? [...series.data.dashboards.filter((item) => item.id !== "scraper-health"), DASHBOARD_SHELLS.find((item) => item.id === "scraper-health")!]
    : DASHBOARD_SHELLS;
  const isLoading = health.loading || (canReadMetrics && metricQuery.loading);
  const isDashboardsLoading = canReadMetrics && series.loading;
  const error = health.error || (canReadMetrics && metricQuery.error)
    ? "Nao foi possivel carregar a observabilidade." : null;
  const dashboardsError = canReadMetrics ? series.error : "Sem permissão para métricas e séries detalhadas.";
  const infra = dashboards.find((item) => item.id === "infra");
  const business = dashboards.find((item) => item.id === "business");
  const history = dashboards.filter((item) => !["infra", "business", "scraper-health"].includes(item.id)).flatMap((item) => item.panels);
  const refresh = () => Promise.all([health.refresh(), ...(canReadMetrics ? [metricQuery.refresh(), series.refresh(), operational.refresh()] : [])]);

  return (
    <div data-observability-page className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">Leitura operacional e histórico • atualização a cada 10s</p>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400"><RefreshCw size={14} />Atualizar</button>
      </div>
      <nav aria-label="Seções da observabilidade" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{[["health", "Saúde geral"], ["processor", "Execução atual"], ["pipeline", "Pipeline"], ["infra", "Infraestrutura"], ["business", "Business"], ["history", "Histórico"]].map(([id, label]) => <a key={id} href={`#${id}-heading`} className="hover:text-emerald-600 dark:hover:text-emerald-300">{label}</a>)}</nav>
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando metricas...</p>}
      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">Nao foi possivel carregar a observabilidade.{(health.stale || metricQuery.stale) && " Última leitura desatualizada, quando disponível."}</p>}
      <HealthOverview health={health.data} metrics={metricQuery.data} healthStale={health.stale} metricsStale={metricQuery.stale} canReadMetrics={canReadMetrics} metricsError={metricQuery.error} />
      <OperationalSnapshotPanels operational={operational} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">Janela dos gráficos • não altera o contexto das métricas de 5 min e 24h</p>
        <div className="flex flex-wrap gap-2">{RANGES.map(item => <button key={item.value} onClick={() => setRange(item.value)} aria-pressed={range === item.value} className={`rounded-lg border px-3 py-2 text-xs font-bold ${range === item.value ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}>{item.label}</button>)}</div>
      </div>
      {isDashboardsLoading && <p className="text-xs text-slate-500">Carregando paineis...</p>}
      {dashboardsError && <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">{dashboardsError}{series.stale && series.data && " Última leitura desatualizada."}</p>}
      <section aria-labelledby="infra-heading">
        <h2 id="infra-heading" className="scroll-mt-28 mb-1 text-base font-bold text-slate-900 dark:text-white">Infraestrutura</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{infra?.description ?? "Containers, host, Postgres e Valkey."}{series.stale && " • Histórico desatualizado"}</p>
        <ProcessorResources operational={operational} />
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">{infra?.panels.map(panel => <ObservabilityPanelCard key={panel.id} panel={panel} />)}</div>
      </section>
      <section aria-labelledby="business-heading">
        <h2 id="business-heading" className="scroll-mt-28 mb-1 text-base font-bold text-slate-900 dark:text-white">Business</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Indicadores de negócio; contexto próprio de cada métrica.{series.stale && " • Leitura desatualizada"}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{business?.panels.filter(panel => panel.visualization === "stat").map(panel => <ObservabilityPanelCard key={panel.id} panel={panel} />)}</div>
      </section>
      <section aria-labelledby="history-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="history-heading" className="scroll-mt-28 text-base font-bold text-slate-900 dark:text-white">Histórico</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tráfego, latência, erros e cache • janela {RANGES.find(item => item.value === range)?.label}{series.stale && " • Leitura desatualizada"}</p></div><span className="text-xs text-slate-500 dark:text-slate-400">Requisições por minuto: {metricQuery.data?.requestRatePerMinute ?? "N/D"} • últimos 5 min</span></div>
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">{[...history, ...(business?.panels.filter(panel => panel.visualization !== "stat") ?? [])].map(panel => <ObservabilityPanelCard key={panel.id} panel={panel} />)}</div>
      </section>
    </div>
  );
}
