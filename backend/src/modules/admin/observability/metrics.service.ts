import { config } from "../../../config";
import type {
  MetricSnapshot,
  ObservabilityDashboard,
  ObservabilityDashboards,
  ObservabilityPanel,
  ObservabilitySeries,
} from "./observability.types";

type PrometheusResult = {
  status: string;
  data: {
    result: Array<{ value: [number, string] }>;
  };
};

type PrometheusRangeResult = {
  status: string;
  data: {
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
};

type DashboardPanelDefinition = Omit<ObservabilityPanel, "series"> & {
  expr: string;
  legend?: (metric: Record<string, string>) => string;
};

const RANGE_SECONDS: Record<string, number> = {
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "24h": 24 * 60 * 60,
};

const STEP_SECONDS: Record<string, number> = {
  "5m": 10,
  "15m": 15,
  "1h": 30,
  "6h": 120,
  "24h": 600,
};

async function queryPrometheus(expr: string): Promise<number | null> {
  try {
    const url = new URL("/api/v1/query", config.prometheusUrl);
    url.searchParams.set("query", expr);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as PrometheusResult;

    if (body.status !== "success") return null;

    const value = body.data.result[0]?.value[1];
    return value !== undefined ? parseFloat(value) : null;
  } catch {
    return null;
  }
}

function normalizeRange(range: string | undefined): keyof typeof RANGE_SECONDS {
  return range && range in RANGE_SECONDS ? range : "1h";
}

function labelFromMetric(metric: Record<string, string>): string {
  return (
    metric.adapter ??
    metric.route ??
    metric.path ??
    metric.handler ??
    metric.container_label_com_docker_compose_service ??
    metric.container ??
    metric.name ??
    metric.job ??
    "serie"
  );
}

function valueFromPrometheus(raw: string): number | null {
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

async function queryPrometheusRange({
  expr,
  range,
  step,
}: {
  expr: string;
  range: keyof typeof RANGE_SECONDS;
  step: number;
}): Promise<PrometheusRangeResult["data"]["result"]> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - RANGE_SECONDS[range];
    const url = new URL("/api/v1/query_range", config.prometheusUrl);

    url.searchParams.set("query", expr);
    url.searchParams.set("start", String(start));
    url.searchParams.set("end", String(end));
    url.searchParams.set("step", String(step));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const body = (await response.json()) as PrometheusRangeResult;

    if (body.status !== "success") return [];

    return body.data.result;
  } catch {
    return [];
  }
}

function toSeries(
  result: PrometheusRangeResult["data"]["result"],
  legend?: DashboardPanelDefinition["legend"],
): ObservabilitySeries[] {
  return result.map((serie) => ({
    label: legend?.(serie.metric) ?? labelFromMetric(serie.metric),
    points: serie.values.map(([timestamp, value]) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: valueFromPrometheus(value),
    })),
  }));
}

const DASHBOARDS: Array<
  Omit<ObservabilityDashboard, "panels"> & {
    panels: DashboardPanelDefinition[];
  }
> = [
  {
    id: "api",
    title: "API Overview",
    description: "Trafego, latencia, erros e cache da API Node.",
    panels: [
      {
        id: "requests-sec",
        title: "Requests/sec",
        unit: "count",
        visualization: "line",
        expr: "sum(rate(http_requests_total[5m]))",
        legend: () => "requests/sec",
      },
      {
        id: "latency-p95",
        title: "Latencia p95",
        unit: "ms",
        visualization: "line",
        expr: "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) * 1000",
      },
      {
        id: "error-rate",
        title: "Taxa de erro (4xx/5xx)",
        unit: "percent",
        visualization: "line",
        expr: 'sum(rate(http_requests_total{status_code=~"4..|5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
        legend: () => "error rate",
      },
      {
        id: "jobs-searches",
        title: "Buscas de vagas",
        unit: "count",
        visualization: "line",
        expr: "sum by (has_keywords) (rate(job_searches_total[5m]))",
        legend: (metric) => `keywords=${metric.has_keywords ?? "unknown"}`,
      },
      {
        id: "cache-hit-rate",
        title: "Cache hit rate",
        unit: "percent",
        visualization: "line",
        expr: 'sum(rate(cache_operations_total{result="hit"}[5m])) / sum(rate(cache_operations_total[5m])) * 100',
        legend: () => "hit rate",
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
        expr: 'sum by (container_label_com_docker_compose_service) (rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service!=""}[5m])) * 100',
      },
      {
        id: "container-memory",
        title: "Memoria por container",
        unit: "bytes",
        visualization: "line",
        expr: 'sum by (container_label_com_docker_compose_service) (container_memory_working_set_bytes{container_label_com_docker_compose_service!=""})',
      },
      {
        id: "postgres-connections",
        title: "Postgres - conexoes ativas",
        unit: "count",
        visualization: "line",
        expr: "pg_stat_activity_count",
      },
      {
        id: "valkey-memory",
        title: "Valkey - memoria usada",
        unit: "bytes",
        visualization: "line",
        expr: "redis_memory_used_bytes",
        legend: () => "memory used",
      },
      {
        id: "host-cpu",
        title: "CPU do host",
        unit: "percent",
        visualization: "line",
        expr: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        legend: () => "used",
      },
      {
        id: "host-memory",
        title: "Memoria do host",
        unit: "bytes",
        visualization: "line",
        expr: "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes",
        legend: () => "used",
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
        expr: "sum(increase(job_searches_total[24h]))",
        legend: () => "buscas",
      },
      {
        id: "jobs-collected",
        title: "Vagas coletadas",
        unit: "count",
        visualization: "stat",
        expr: "sum(increase(scraper_jobs_found_total[24h]))",
        legend: () => "vagas",
      },
      {
        id: "business-cache-hit",
        title: "Cache hit rate",
        unit: "percent",
        visualization: "stat",
        expr: 'sum(rate(cache_operations_total{result="hit"}[24h])) / sum(rate(cache_operations_total[24h])) * 100',
        legend: () => "hit rate",
      },
      {
        id: "users-total",
        title: "Usuarios cadastrados",
        unit: "count",
        visualization: "stat",
        expr: 'pg_stat_user_tables_n_live_tup{relname="users"}',
        legend: () => "usuarios",
      },
      {
        id: "jobs-by-day-adapter",
        title: "Vagas coletadas por dia, por adapter",
        unit: "count",
        visualization: "line",
        expr: "sum by (adapter) (increase(scraper_jobs_found_total[1d]))",
      },
      {
        id: "saved-jobs",
        title: "Vagas salvas",
        unit: "count",
        visualization: "stat",
        expr: 'pg_stat_user_tables_n_live_tup{relname="saved_jobs"}',
        legend: () => "savedJobs",
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
        expr: "sum by (adapter) (rate(scraper_runs_total[5m]))",
      },
      {
        id: "adapter-duration",
        title: "Duracao media por adapter",
        unit: "seconds",
        visualization: "line",
        expr: "rate(scraper_duration_seconds_sum[10m]) / rate(scraper_duration_seconds_count[10m])",
      },
      {
        id: "jobs-total",
        title: "Vagas encontradas (total acumulado)",
        unit: "count",
        visualization: "line",
        expr: "scraper_jobs_found_total",
      },
      {
        id: "adapter-errors",
        title: "Erros por adapter",
        unit: "count",
        visualization: "line",
        expr: "increase(scraper_errors_total[5m])",
      },
      {
        id: "pipeline-duration",
        title: "Duracao do pipeline completo",
        unit: "seconds",
        visualization: "line",
        expr: "rate(scraper_pipeline_duration_seconds_sum[15m]) / rate(scraper_pipeline_duration_seconds_count[15m])",
        legend: () => "duracao media",
      },
      {
        id: "jobs-per-run",
        title: "Vagas por rodada (apos dedup)",
        unit: "count",
        visualization: "line",
        expr: "rate(scraper_pipeline_jobs_total_sum[15m]) / rate(scraper_pipeline_jobs_total_count[15m])",
        legend: () => "vagas/rodada",
      },
    ],
  },
];

export class MetricsService {
  async getSnapshot(): Promise<MetricSnapshot> {
    const [
      requestRatePerMinute,
      errorRatePct,
      p95LatencyMs,
      cacheHitRatePct,
      activeSessionsCount,
    ] = await Promise.all([
      // requests por minuto (últimos 5min)
      queryPrometheus("sum(rate(http_requests_total[5m])) * 60"),
      // % de respostas 5xx (últimos 5min)
      queryPrometheus(
        'sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
      ),
      // p95 de latência em ms (últimos 5min)
      queryPrometheus(
        "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000",
      ),
      // cache hit rate % (últimos 5min)
      queryPrometheus(
        'sum(rate(cache_operations_total{result="hit"}[5m])) / sum(rate(cache_operations_total[5m])) * 100',
      ),
      // sessões ativas (gauge instantâneo)
      queryPrometheus("active_sessions"),
    ]);

    return {
      requestRatePerMinute:
        requestRatePerMinute !== null ? Math.round(requestRatePerMinute) : null,
      errorRatePct:
        errorRatePct !== null ? parseFloat(errorRatePct.toFixed(2)) : null,
      p95LatencyMs: p95LatencyMs !== null ? Math.round(p95LatencyMs) : null,
      cacheHitRatePct:
        cacheHitRatePct !== null
          ? parseFloat(cacheHitRatePct.toFixed(2))
          : null,
      activeSessionsCount:
        activeSessionsCount !== null ? Math.round(activeSessionsCount) : null,
    };
  }

  async getDashboards(rangeInput?: string): Promise<ObservabilityDashboards> {
    const range = normalizeRange(rangeInput);
    const step = STEP_SECONDS[range];

    const dashboards = await Promise.all(
      DASHBOARDS.map(async (dashboard) => ({
        ...dashboard,
        panels: await Promise.all(
          dashboard.panels.map(async ({ expr, legend, ...panel }) => ({
            ...panel,
            series: toSeries(
              await queryPrometheusRange({ expr, range, step }),
              legend,
            ),
          })),
        ),
      })),
    );

    return {
      range,
      step: `${step}s`,
      generatedAt: new Date().toISOString(),
      dashboards,
    };
  }
}
