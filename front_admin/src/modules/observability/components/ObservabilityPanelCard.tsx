import { useMemo, useState } from "react";
import type {
  ObservabilityPanel,
  ObservabilityPoint,
  ObservabilitySeries,
} from "../../../lib/api/types";

interface ObservabilityPanelCardProps {
  panel: ObservabilityPanel;
}

type ChartPoint = {
  color: string;
  label: string;
  timestamp: number;
  value: number;
};

type HoverState = {
  x: number;
  timestamp: number;
  points: ChartPoint[];
};

type ChartSeriesEntry = {
  key: string;
  serie: ObservabilitySeries;
  index: number;
};

const PALETTE = [
  "#73bf69",
  "#f2cc0c",
  "#5794f2",
  "#ff9830",
  "#f2495c",
  "#b877d9",
  "#2fd6a3",
  "#ffb6d9",
  "#8ab8ff",
  "#c8f26a",
  "#ff6f48",
  "#e0b3ff",
];

const CHART_WIDTH = 760;
const CHART_HEIGHT = 236;
const PLOT = {
  left: 54,
  right: 14,
  top: 18,
  bottom: 34,
};

const PLOT_WIDTH = CHART_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = CHART_HEIGHT - PLOT.top - PLOT.bottom;

function finiteValues(panel: ObservabilityPanel): number[] {
  return panel.series.flatMap((serie) =>
    serie.points.flatMap((point) =>
      point.value !== null && Number.isFinite(point.value) ? [point.value] : [],
    ),
  );
}

function finiteValuesFromEntries(entries: ChartSeriesEntry[]): number[] {
  return entries.flatMap(({ serie }) =>
    serie.points.flatMap((point) =>
      point.value !== null && Number.isFinite(point.value) ? [point.value] : [],
    ),
  );
}

function finitePoints(
  serie: ObservabilitySeries,
): Array<ObservabilityPoint & { timestampMs: number; value: number }> {
  return serie.points.flatMap((point) => {
    const timestampMs = new Date(point.timestamp).getTime();
    if (
      point.value === null ||
      !Number.isFinite(point.value) ||
      !Number.isFinite(timestampMs)
    ) {
      return [];
    }

    return [{ ...point, timestampMs, value: point.value }];
  });
}

function formatValue(
  value: number | null,
  unit: ObservabilityPanel["unit"],
): string {
  if (value === null || !Number.isFinite(value)) return "No data";

  if (unit === "percent") return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
  if (unit === "ms") return `${Math.round(value)} ms`;
  if (unit === "seconds") {
    if (value >= 60) return `${(value / 60).toFixed(value >= 600 ? 1 : 2)} min`;
    return `${value.toFixed(value >= 10 ? 1 : 2)} s`;
  }
  if (unit === "bytes") {
    const units = ["B", "KiB", "MiB", "GiB"];
    let nextValue = value;
    let index = 0;

    while (nextValue >= 1024 && index < units.length - 1) {
      nextValue /= 1024;
      index += 1;
    }

    return `${nextValue.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  return value >= 1000
    ? Math.round(value).toLocaleString("pt-BR")
    : value
        .toFixed(value % 1 === 0 ? 0 : 3)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatTooltipTime(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function latestValue(panel: ObservabilityPanel): number | null {
  const values = finiteValues(panel);
  return values.at(-1) ?? null;
}

function latestValueFromEntries(entries: ChartSeriesEntry[]): number | null {
  const values = finiteValuesFromEntries(entries);
  return values.at(-1) ?? null;
}

function seriesKey(serie: ObservabilitySeries, index: number): string {
  return `${serie.label}-${index}`;
}

function buildTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / Math.max(1, count - 1);
    return min + (max - min) * ratio;
  });
}

function buildPath(
  points: ReturnType<typeof finitePoints>,
  minTime: number,
  timeSpan: number,
  minValue: number,
  valueSpan: number,
): string {
  return points
    .map((point, index) => {
      const x =
        PLOT.left + ((point.timestampMs - minTime) / timeSpan) * PLOT_WIDTH;
      const y =
        PLOT.top + (1 - (point.value - minValue) / valueSpan) * PLOT_HEIGHT;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function nearestPoints(
  timestamp: number,
  seriesEntries: ChartSeriesEntry[],
): ChartPoint[] {
  return seriesEntries
    .map(({ serie, index }) => {
      const points = finitePoints(serie);
      if (points.length === 0) return null;

      const nearest = points.reduce((best, point) =>
        Math.abs(point.timestampMs - timestamp) <
        Math.abs(best.timestampMs - timestamp)
          ? point
          : best,
      );

      return {
        color: PALETTE[index % PALETTE.length],
        label: serie.label,
        timestamp: nearest.timestampMs,
        value: nearest.value,
      };
    })
    .filter((point): point is ChartPoint => point !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function LineChart({
  panel,
  seriesEntries,
}: ObservabilityPanelCardProps & { seriesEntries: ChartSeriesEntry[] }) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const chart = useMemo(() => {
    const values = finiteValuesFromEntries(seriesEntries);
    const times = seriesEntries.flatMap(({ serie }) =>
      finitePoints(serie).map((point) => point.timestampMs),
    );
    const hasData = values.length > 0 && times.length > 0;
    const rawMinValue = hasData ? Math.min(...values, 0) : 0;
    const rawMaxValue = hasData ? Math.max(...values) : 1;
    const padding =
      rawMaxValue === rawMinValue ? 1 : (rawMaxValue - rawMinValue) * 0.08;
    const minValue = Math.min(0, rawMinValue);
    const maxValue = rawMaxValue + padding;
    const minTime = hasData ? Math.min(...times) : 0;
    const maxTime = hasData ? Math.max(...times) : 60_000;

    return {
      hasData,
      maxTime,
      maxValue,
      minTime,
      minValue,
      timeSpan: Math.max(1, maxTime - minTime),
      valueSpan: Math.max(1, maxValue - minValue),
      xTicks: buildTicks(minTime, maxTime, 4),
      yTicks: buildTicks(minValue, maxValue, 5),
    };
  }, [seriesEntries]);

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!chart.hasData) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (event.clientX - rect.left - PLOT.left * (rect.width / CHART_WIDTH)) /
          (PLOT_WIDTH * (rect.width / CHART_WIDTH)),
      ),
    );
    const timestamp = chart.minTime + ratio * chart.timeSpan;
    setHover({
      x: PLOT.left + ratio * PLOT_WIDTH,
      timestamp,
      points: nearestPoints(timestamp, seriesEntries),
    });
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-md bg-slate-50 dark:bg-slate-950/40">
      <svg
        className="h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={handleMouseMove}
      >
        <rect
          x={PLOT.left}
          y={PLOT.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
        />

        {chart.yTicks.map((tick) => {
          const y =
            PLOT.top +
            (1 - (tick - chart.minValue) / chart.valueSpan) * PLOT_HEIGHT;
          return (
            <g key={`y-${tick}`}>
              <line
                x1={PLOT.left}
                x2={PLOT.left + PLOT_WIDTH}
                y1={y}
                y2={y}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={PLOT.left - 9}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-semibold dark:fill-slate-500"
              >
                {formatValue(tick, panel.unit)}
              </text>
            </g>
          );
        })}

        {chart.xTicks.map((tick) => {
          const x =
            PLOT.left + ((tick - chart.minTime) / chart.timeSpan) * PLOT_WIDTH;
          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                x2={x}
                y1={PLOT.top}
                y2={PLOT.top + PLOT_HEIGHT}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={x}
                y={CHART_HEIGHT - 9}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-semibold dark:fill-slate-500"
              >
                {formatTime(tick)}
              </text>
            </g>
          );
        })}

        {chart.hasData &&
          seriesEntries.map(({ key, serie, index }) => {
            const points = finitePoints(serie);
            const path = buildPath(
              points,
              chart.minTime,
              chart.timeSpan,
              chart.minValue,
              chart.valueSpan,
            );
            if (!path) return null;

            return (
              <g key={key}>
                <path
                  d={path}
                  fill="none"
                  stroke={PALETTE[index % PALETTE.length]}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {points.map((point) => {
                  const x =
                    PLOT.left +
                    ((point.timestampMs - chart.minTime) / chart.timeSpan) *
                      PLOT_WIDTH;
                  const y =
                    PLOT.top +
                    (1 - (point.value - chart.minValue) / chart.valueSpan) *
                      PLOT_HEIGHT;

                  return (
                    <circle
                      key={`${serie.label}-${point.timestamp}`}
                      cx={x}
                      cy={y}
                      r="2.2"
                      fill={PALETTE[index % PALETTE.length]}
                      className="stroke-slate-950/70"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            );
          })}

        {hover && chart.hasData && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PLOT.top}
            y2={PLOT.top + PLOT_HEIGHT}
            className="stroke-slate-400 dark:stroke-slate-500"
            strokeDasharray="4 4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {!chart.hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-400 dark:text-slate-500">
          No data
        </div>
      )}

      {hover && hover.points.length > 0 && (
        <div
          className="pointer-events-none absolute top-4 z-10 max-h-56 w-72 overflow-hidden rounded-md border border-slate-200 bg-white/95 p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-950/95"
          style={{
            left:
              hover.x > CHART_WIDTH * 0.62
                ? "auto"
                : `calc(${(hover.x / CHART_WIDTH) * 100}% + 8px)`,
            right: hover.x > CHART_WIDTH * 0.62 ? "12px" : "auto",
          }}
        >
          <div className="mb-2 font-bold text-slate-700 dark:text-slate-200">
            {formatTooltipTime(hover.timestamp)}
          </div>
          <div className="space-y-1.5">
            {hover.points.map((point) => (
              <div
                key={`${point.label}-${point.timestamp}`}
                className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-slate-600 dark:text-slate-300"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: point.color }}
                />
                <span className="truncate font-semibold">{point.label}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {formatValue(point.value, panel.unit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ObservabilityPanelCard({ panel }: ObservabilityPanelCardProps) {
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(
    null,
  );
  const visibleSeries = panel.series
    .map((serie, index) => ({
      key: seriesKey(serie, index),
      serie,
      index,
    }))
    .filter(({ serie }) => finitePoints(serie).length > 0);
  const selectedEntries = selectedSeriesKey
    ? visibleSeries.filter((entry) => entry.key === selectedSeriesKey)
    : visibleSeries;
  const activeSeries = selectedEntries.length > 0 ? selectedEntries : visibleSeries;
  const latest = activeSeries.length > 0 ? latestValueFromEntries(activeSeries) : latestValue(panel);

  function toggleSeries(key: string) {
    setSelectedSeriesKey((current) => (current === key ? null : key));
  }

  return (
    <article className="flex min-h-88 flex-col justify-between rounded-lg border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f131a]">
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {panel.title}
            </h4>
            {panel.description && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {panel.description}
              </p>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            {panel.visualization === "stat"
              ? "atual"
              : formatValue(latest, panel.unit)}
          </span>
        </div>

        {panel.visualization === "stat" ? (
          <div className="flex h-64 items-center justify-center rounded-md bg-slate-50 text-6xl font-extrabold text-emerald-600 dark:bg-slate-950/40 dark:text-emerald-400">
            {formatValue(latest, panel.unit)}
          </div>
        ) : (
          <LineChart panel={panel} seriesEntries={activeSeries} />
        )}
      </div>

      <div className="mt-4 max-h-20 overflow-y-auto border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-x-4 gap-y-2 pr-2">
          {visibleSeries.map(({ key, serie, index }) => {
            const selected = selectedSeriesKey === key;
            const dimmed = selectedSeriesKey !== null && !selected;

            return (
            <button
              key={`${panel.id}-${key}`}
              type="button"
              onClick={() => toggleSeries(key)}
              className={`inline-flex max-w-52 items-center gap-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition ${
                selected
                  ? "bg-slate-100 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-white dark:ring-slate-600"
                  : dimmed
                    ? "text-slate-400 opacity-45 hover:opacity-80 dark:text-slate-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              }`}
              title={serie.label}
            >
              <span
                className="h-1.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
              />
              <span className="truncate">{serie.label}</span>
            </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
