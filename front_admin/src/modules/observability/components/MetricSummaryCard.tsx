import type { ObservabilityMetric } from "../schemas/observability.schemas";

interface MetricSummaryCardProps {
  metric: ObservabilityMetric;
}

const TONE_TEXT: Record<ObservabilityMetric["tone"], string> = {
  success: "text-emerald-600",
  warning: "text-rose-500",
  danger: "text-rose-600",
};

export function MetricSummaryCard({ metric }: MetricSummaryCardProps) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
      <span className="text-xs text-slate-400 dark:text-slate-500">
        {metric.label}
      </span>
      <p className="mt-1 text-3xl font-extrabold text-[#1e4620] dark:text-emerald-300">
        {metric.value}
      </p>
      <span className={`text-[10px] font-semibold ${TONE_TEXT[metric.tone]}`}>
        {metric.note}
      </span>
    </div>
  );
}
