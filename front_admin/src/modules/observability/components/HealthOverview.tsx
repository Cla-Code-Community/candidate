import type { HealthcheckResponse, MetricSnapshot } from "../../../lib/api/types";

const STATUS: Record<string, string> = { ok: "Disponível", degraded: "Degradado", down: "Indisponível" };
export function HealthOverview({ health, metrics, healthStale, metricsStale, canReadMetrics, metricsError }: {
  health: HealthcheckResponse | null; metrics: MetricSnapshot | null;
  healthStale: boolean; metricsStale: boolean; canReadMetrics: boolean; metricsError?: string | null;
}) {
  const services = [["API", null], ["Postgres", "postgres"], ["Valkey", "valkey"], ["Processor", "scraper"]] as const;
  return <section aria-labelledby="health-heading">
    <h2 id="health-heading" className="scroll-mt-28 mb-3 text-base font-bold text-slate-900 dark:text-white">Saúde geral</h2>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {services.map(([name, key]) => {
        const service = key ? health?.services[key] : null;
        const status = key ? service?.status : health ? "ok" : undefined;
        const color = healthStale || status === "degraded" ? "text-amber-600 dark:text-amber-300" : status === "ok" ? "text-emerald-700 dark:text-emerald-300" : status === "down" ? "text-rose-600 dark:text-rose-300" : "text-slate-500 dark:text-slate-400";
        return <article aria-label={name} key={name} className="min-w-0 rounded-lg border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-[#0f131a]">
          <h3 className="text-xs text-slate-500 dark:text-slate-400">{name}</h3><p className={`mt-2 text-sm font-bold ${color}`}>{status ? key ? STATUS[status] : "Respondendo" : "N/D"}</p>
          <p className="mt-1 wrap-anywhere text-[11px] text-slate-500 dark:text-slate-400">{healthStale ? "Leitura desatualizada" : key ? service?.error ?? (service?.latencyMs == null ? "Probe do backend" : `${service.latencyMs} ms • probe`) : "Resposta do endpoint de saúde"}</p>
        </article>;
      })}
      {([
        ["Taxa de erro", metrics?.errorRatePct, "%", 1, "5xx • últimos 5 min"],
        ["Latência p95", metrics?.p95LatencyMs, " ms", 150, "Últimos 5 min"],
      ] as const).map(([name, value, unit, limit, context]) => <article aria-label={name} key={name} className="rounded-lg border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-[#0f131a]">
        <h3 className="text-xs text-slate-500 dark:text-slate-400">{name}</h3><p className={`mt-2 text-lg font-bold tabular-nums ${metricsStale ? "text-amber-600 dark:text-amber-300" : value != null && value > limit ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`}>{value == null ? "N/D" : `${value}${unit}`}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{!canReadMetrics ? "Sem permissão" : metricsStale ? "Leitura desatualizada" : context}</p>
        {canReadMetrics && value == null && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{metricsError ? "Fonte indisponível" : "Fonte sem valor válido; motivo não informado."}</p>}
        {name === "Latência p95" && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Atenção &gt; 150 ms • critério local</p>}
      </article>)}
    </div>
  </section>;
}
