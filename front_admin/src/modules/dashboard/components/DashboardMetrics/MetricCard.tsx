import { Activity, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { formatNumber } from "../../../../utils/formatNumber";
import type { MetricValue } from "../../schemas/metrics.schemas";

interface MetricCardProps {
  label: string;
  metric: MetricValue;
  icon: LucideIcon;
}

export function MetricCard({ label, metric, icon: Icon }: MetricCardProps) {
  const TrendIcon = metric.positive ? TrendingUp : TrendingDown;
  const trendColor = metric.positive
    ? "text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10"
    : "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10";

  return (
    <div className="bg-white dark:bg-[#0f131a] p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-start transition-all hover:border-blue-200 hover:shadow-md dark:hover:border-blue-500/30 theme-transition">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <Activity size={12} className="text-emerald-500" />
        </div>
        <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {formatNumber(metric.value)}
        </p>
        <div
          className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full w-max ${trendColor}`}
        >
          <TrendIcon size={12} />
          <span>{metric.trend}</span>
        </div>
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl">
        <Icon size={22} className="stroke-[1.5]" />
      </div>
    </div>
  );
}
