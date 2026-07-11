import { formatNumber } from "../../../../utils/formatNumber";
import type { DashboardChartPoint } from "../../schemas";

interface PlatformChartProps {
  points: DashboardChartPoint[];
}

type SeriesKey = "totalJobs" | "activeUsers";

const SERIES: Array<{
  key: SeriesKey;
  color: string;
  gradientId: string;
}> = [
  { key: "totalJobs", color: "#10b981", gradientId: "jobsGradient" },
  { key: "activeUsers", color: "#3b82f6", gradientId: "usersGradient" },
];

function roundAxisValue(value: number): number {
  if (value <= 10) return 10;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function xFor(index: number, count: number): number {
  if (count <= 1) return 50;
  return (index / (count - 1)) * 100;
}

function yFor(value: number, maxValue: number): number {
  return 92 - (value / maxValue) * 76;
}

function linePath(
  points: DashboardChartPoint[],
  key: SeriesKey,
  maxValue: number,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xFor(index, points.length)} ${yFor(point[key], maxValue)}`;
    })
    .join(" ");
}

function areaPath(
  points: DashboardChartPoint[],
  key: SeriesKey,
  maxValue: number,
): string {
  if (points.length === 0) return "";

  const line = linePath(points, key, maxValue);
  const lastX = xFor(points.length - 1, points.length);
  const firstX = xFor(0, points.length);

  return `${line} L ${lastX} 96 L ${firstX} 96 Z`;
}

export function PlatformChart({ points }: PlatformChartProps) {
  const maxMetric = Math.max(
    1,
    ...points.flatMap((point) => [point.totalJobs, point.activeUsers]),
  );
  const maxValue = roundAxisValue(maxMetric);
  const axisLabels = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];
  const visibleLabels = points.filter((_, index) => {
    if (points.length <= 6) return true;
    return index === 0 || index === points.length - 1 || index % 4 === 0;
  });

  return (
    <>
      <div className="relative mt-5 h-60 w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="absolute inset-y-4 left-0 right-0 flex flex-col justify-between px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {axisLabels.map((label) => (
            <div
              key={label}
              className="flex items-center gap-2 border-b border-slate-200/70 pb-1 last:border-b-0 dark:border-slate-800"
            >
              <span className="w-12">{formatNumber(Math.round(label))}</span>
              <span className="h-px flex-1" />
            </div>
          ))}
        </div>

        <svg
          className="absolute inset-0 h-full w-full overflow-visible px-14 py-4"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-label="Histórico de vagas coletadas e usuários ativos"
          role="img"
        >
          <defs>
            <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {SERIES.map((series) => (
            <g key={series.key}>
              {points.length > 1 && (
                <path
                  d={areaPath(points, series.key, maxValue)}
                  fill={`url(#${series.gradientId})`}
                />
              )}
              <path
                d={linePath(points, series.key, maxValue)}
                fill="none"
                stroke={series.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((point, index) => (
                <circle
                  key={`${series.key}-${point.timestamp}`}
                  cx={xFor(index, points.length)}
                  cy={yFor(point[series.key], maxValue)}
                  r="2.2"
                  fill={series.color}
                  stroke="#fff"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ))}
        </svg>

        {points.length <= 1 && (
          <div className="absolute bottom-3 right-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
            Aguardando novos snapshots para formar a tendência
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between px-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {visibleLabels.map((point) => (
          <span key={point.timestamp}>{point.label}</span>
        ))}
      </div>
    </>
  );
}
