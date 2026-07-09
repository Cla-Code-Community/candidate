import { Folder, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNotifications } from "../../components/notifications/useNotifications";
import {
  observabilityApi,
  type ObservabilityRange,
} from "../../lib/api/observability.api";
import type {
  HealthcheckResponse,
  MetricSnapshot,
  ObservabilityDashboard,
} from "../../lib/api/types";
import { InfrastructureUsage } from "./components/InfrastructureUsage";
import { MetricSummaryCard } from "./components/MetricSummaryCard";
import { ObservabilityPanelCard } from "./components/ObservabilityPanelCard";
import type {
  InfraUsage,
  ObservabilityMetric,
} from "./schemas/observability.schemas";

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
    title: "Scraper Health",
    description: "Execucoes, erros, duracao e volume por adapter.",
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

function formatMetric(value: number | null, suffix = ""): string {
  return value === null ? "N/D" : `${value}${suffix}`;
}

function metricTone(
  value: number | null,
  limit: number,
): ObservabilityMetric["tone"] {
  if (value === null) return "warning";
  return value <= limit ? "success" : "danger";
}

function healthPercentage(status: HealthcheckResponse["status"]): number {
  if (status === "ok") return 100;
  if (status === "degraded") return 65;
  return 0;
}

function buildMetrics(metrics: MetricSnapshot): ObservabilityMetric[] {
  return [
    {
      label: "Requisicoes por minuto",
      value: formatMetric(metrics.requestRatePerMinute),
      note: "Prometheus - ultimos 5 minutos",
      tone: "success",
    },
    {
      label: "Latencia p95",
      value: formatMetric(metrics.p95LatencyMs, "ms"),
      note: "Limite de atencao: 150ms",
      tone: metricTone(metrics.p95LatencyMs, 150),
    },
    {
      label: "Taxa de erro",
      value: formatMetric(metrics.errorRatePct, "%"),
      note: "Respostas 5xx no periodo",
      tone: metricTone(metrics.errorRatePct, 1),
    },
  ];
}

function buildInfra(health: HealthcheckResponse): InfraUsage[] {
  return Object.entries(health.services).map(([name, service]) => ({
    label: name,
    valueLabel:
      service.latencyMs !== undefined
        ? `${service.status} - ${service.latencyMs}ms`
        : (service.error ?? service.status),
    percentage: healthPercentage(service.status),
    color:
      service.status === "ok"
        ? "bg-emerald-500"
        : service.status === "degraded"
          ? "bg-amber-500"
          : "bg-rose-500",
  }));
}

export function ObservabilityPage() {
  const { notify } = useNotifications();
  const [metrics, setMetrics] = useState<ObservabilityMetric[]>([]);
  const [infraUsage, setInfraUsage] = useState<InfraUsage[]>([]);
  const [dashboards, setDashboards] =
    useState<ObservabilityDashboard[]>(DASHBOARD_SHELLS);
  const [activeDashboardId, setActiveDashboardId] = useState<string>("api");
  const [range, setRange] = useState<ObservabilityRange>("15m");
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardsLoading, setIsDashboardsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardsError, setDashboardsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([observabilityApi.health(), observabilityApi.metrics()])
      .then(([health, snapshot]) => {
        if (!active) return;
        setMetrics(buildMetrics(snapshot));
        setInfraUsage(buildInfra(health));
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Nao foi possivel carregar a observabilidade.");
        notify({
          tone: "error",
          title: "Erro de observabilidade",
          description:
            "Não foi possível carregar saúde e métricas agregadas do backend.",
        });
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [summaryRefreshKey, notify]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSummaryRefreshKey((current) => current + 1);
      setRefreshKey((current) => current + 1);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;

    observabilityApi
      .dashboards(range)
      .then((result) => {
        if (!active) return;
        setDashboards(result.dashboards);
        setActiveDashboardId((current) =>
          result.dashboards.some((dashboard) => dashboard.id === current)
            ? current
            : (result.dashboards[0]?.id ?? "api"),
        );
        setDashboardsError(null);
      })
      .catch(() => {
        if (active) {
          setDashboards(DASHBOARD_SHELLS);
          setDashboardsError(
            "Sem resposta das series detalhadas. Exibindo a estrutura dos dashboards.",
          );
          notify({
            tone: "warning",
            title: "Séries detalhadas indisponíveis",
            description:
              "A estrutura dos dashboards será exibida, mas as séries do Prometheus não foram carregadas.",
          });
        }
      })
      .finally(() => {
        if (active) setIsDashboardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [range, refreshKey, notify]);

  const activeDashboard =
    dashboards.find((dashboard) => dashboard.id === activeDashboardId) ??
    dashboards[0];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Painel de Observabilidade
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Mapeamento em tempo real do tráfego, latência dos microsserviços e
              consumo geral de hardware
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setIsDashboardsLoading(true);
                  setRange(item.value);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  range === item.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                setIsDashboardsLoading(true);
                setSummaryRefreshKey((current) => current + 1);
                setRefreshKey((current) => current + 1);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-slate-300 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>
        </div>
        {isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Carregando metricas...
          </p>
        )}
        {error && (
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric) => (
            <MetricSummaryCard key={metric.label} metric={metric} />
          ))}
        </div>
      </div>

      <InfrastructureUsage usage={infraUsage} />

      <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f131a]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Dashboards
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Pastas operacionais com as mesmas leituras do Prometheus usadas no
              Grafana.
            </p>
          </div>
          {isDashboardsLoading && (
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Carregando paineis...
            </span>
          )}
        </div>

        {dashboardsError && (
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            {dashboardsError}
          </p>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {dashboards.map((dashboard) => (
            <button
              key={dashboard.id}
              onClick={() => setActiveDashboardId(dashboard.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold transition-colors ${
                activeDashboard?.id === dashboard.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700"
              }`}
            >
              <Folder size={15} />
              {dashboard.title}
            </button>
          ))}
        </div>

        {activeDashboard && (
          <>
            <div className="mb-5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeDashboard.title}
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {activeDashboard.description}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {activeDashboard.panels.map((panel) => (
                <ObservabilityPanelCard key={panel.id} panel={panel} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
