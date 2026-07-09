interface UsageBarProps {
  label: string;
  valueLabel: string;
  percentage: number;
  color: string;
}

/**
 * Barra de uso horizontal (ex: conexões do Postgres, cache do Valkey).
 */
export function UsageBar({
  label,
  valueLabel,
  percentage,
  color,
}: UsageBarProps) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span>{valueLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`${color} h-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
