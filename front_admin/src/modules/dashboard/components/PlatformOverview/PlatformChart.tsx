import { Activity, Database, TrendingDown, TrendingUp } from "lucide-react";
import { formatNumber } from "../../../../utils/formatNumber";
import type { DashboardChartPoint } from "../../schemas";

interface PlatformChartProps {
  points: DashboardChartPoint[];
}

type DeltaTone = "positive" | "negative" | "neutral";

function deltaTone(value: number): DeltaTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function formatDelta(value: number): string {
  if (value === 0) return "0";
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatNumber(Math.abs(value))}`;
}

function toneClass(tone: DeltaTone): string {
  if (tone === "positive") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }

  if (tone === "negative") {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-300";
  }

  return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300";
}

function xFor(index: number, count: number): number {
  if (count <= 1) return 50;
  return 4 + (index / (count - 1)) * 92;
}

function yFor(value: number, minValue: number, span: number): number {
  if (span <= 0) return 50;
  return 88 - ((value - minValue) / span) * 72;
}

function linePath(points: DashboardChartPoint[]): string {
  const values = points.map((point) => point.totalJobs);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, Math.round((max - min) * 0.12));
  const minValue = Math.max(0, min - padding);
  const span = Math.max(1, max + padding - minValue);

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xFor(index, points.length)} ${yFor(
        point.totalJobs,
        minValue,
        span,
      )}`;
    })
    .join(" ");
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: DeltaTone;
}) {
  const Icon = tone === "negative" ? TrendingDown : TrendingUp;

  return (
    <div className="min-w-0 border-l border-slate-200 py-1 pl-3 dark:border-slate-800">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${toneClass(
            tone,
          )}`}
        >
          <Icon size={12} />
        </span>
        <strong className="text-sm font-extrabold text-slate-900 dark:text-white">
          {value}
        </strong>
      </div>
    </div>
  );
}

export function PlatformChart({ points }: PlatformChartProps) {
  const latest = points.at(-1);
  const previous = points.at(-2);
  const first = points[0];

  if (!latest) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
        Aguardando o primeiro snapshot do dashboard
      </div>
    );
  }

  const lastDelta = latest.totalJobs - (previous?.totalJobs ?? latest.totalJobs);
  const windowDelta = latest.totalJobs - (first?.totalJobs ?? latest.totalJobs);
  const values = points.map((point) => point.totalJobs);
  const minJobs = Math.min(...values);
  const maxJobs = Math.max(...values);
  const deltas = points.slice(1).map((point, index) => ({
    timestamp: point.timestamp,
    label: point.label,
    value: point.totalJobs - points[index].totalJobs,
  }));
  const hasIndexVariation = minJobs !== maxJobs;
  const hasIntervalVariation = deltas.some((delta) => delta.value !== 0);
  const maxAbsDelta = Math.max(1, ...deltas.map((item) => Math.abs(item.value)));

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 border-y border-slate-200 py-4 dark:border-slate-800 md:grid-cols-3">
        <div className="min-w-0 py-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <Database size={13} />
            <span>Total indexado</span>
          </div>
          <strong className="mt-1 block text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatNumber(latest.totalJobs)}
          </strong>
        </div>
        <StatPill
          label="Desde a última leitura"
          value={formatDelta(lastDelta)}
          tone={deltaTone(lastDelta)}
        />
        <StatPill
          label="Na janela visível"
          value={formatDelta(windowDelta)}
          tone={deltaTone(windowDelta)}
        />
      </div>

      <div className="pt-1">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Estado do índice
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {hasIndexVariation
                ? `${formatNumber(minJobs)} mín. · ${formatNumber(
                    maxJobs,
                  )} máx. · ${latest.label} última leitura`
                : `Sem variação nas últimas ${points.length} leituras`}
            </p>
          </div>
          <div className="inline-flex w-max items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <Activity size={12} />
            {points.length} snapshots
          </div>
        </div>

        {hasIndexVariation ? (
          <div className="relative h-24">
            <svg
              className="h-full w-full"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
              aria-label="Evolução do total de vagas no índice"
              role="img"
            >
              <path
                d="M 4 88 H 96 M 4 52 H 96 M 4 16 H 96"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={linePath(points)}
                fill="none"
                stroke="#10b981"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-between gap-4 border-y border-slate-200 py-5 dark:border-slate-800">
            <div>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                Índice estável
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nenhuma vaga nova ou removida foi detectada nesta janela.
              </p>
            </div>
            <strong className="text-3xl font-extrabold text-emerald-500">
              {formatNumber(latest.totalJobs)}
            </strong>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            Variação entre snapshots
          </p>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {deltas.length || 0} intervalos
          </span>
        </div>

        {deltas.length > 0 && hasIntervalVariation ? (
          <div className="flex h-14 items-end gap-1">
            {deltas.map((delta) => {
              const height = 12 + (Math.abs(delta.value) / maxAbsDelta) * 40;
              const tone = deltaTone(delta.value);

              return (
                <div
                  key={delta.timestamp}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-1"
                  title={`${delta.label}: ${formatDelta(delta.value)} vagas`}
                >
                  <span
                    className={`w-full rounded-sm ${
                      tone === "positive"
                        ? "bg-emerald-500"
                        : tone === "negative"
                          ? "bg-rose-500"
                          : "bg-slate-500"
                    }`}
                    style={{ height }}
                  />
                </div>
              );
            })}
          </div>
        ) : deltas.length > 0 ? (
          <div className="flex min-h-14 items-center justify-between gap-4 rounded-md bg-slate-900/40 px-3 py-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Todos os intervalos ficaram em 0. O scraper não alterou o total
              indexado durante esta janela.
            </span>
            <span className="text-sm font-extrabold text-slate-300">0</span>
          </div>
        ) : (
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Mais um snapshot é necessário para calcular variação.
          </p>
        )}
      </div>
    </div>
  );
}
