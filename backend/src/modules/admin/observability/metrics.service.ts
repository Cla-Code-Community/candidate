import { config } from "../../../config";
import type { MetricSnapshot } from "./observability.types";

type PrometheusResult = {
  status: string;
  data: {
    result: Array<{ value: [number, string] }>;
  };
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
}
