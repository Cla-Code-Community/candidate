import type { DashboardChartPoint } from "../../schemas";
import { ChartLegend } from "./ChartLegend";
import { PlatformChart } from "./PlatformChart";

interface PlatformOverviewProps {
  points: DashboardChartPoint[];
  lastUpdatedAt: string | null;
}

export function PlatformOverview({ points, lastUpdatedAt }: PlatformOverviewProps) {
  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between theme-transition">
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Visão Geral da Plataforma
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Série gerada pelos snapshots reais do dashboard
            </p>
          </div>
          {lastUpdatedAt && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              {points.length} snapshots
            </span>
          )}
        </div>
        <ChartLegend />
      </div>
      <PlatformChart points={points} />
    </div>
  );
}
