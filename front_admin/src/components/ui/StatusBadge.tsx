export type StatusTone = "success" | "warning" | "danger" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  withDot?: boolean;
}

const toneClasses: Record<StatusTone, { badge: string; dot: string }> = {
  success: {
    badge: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  warning: {
    badge: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  danger: {
    badge: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  neutral: {
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

/**
 * Selo de status reutilizável (usado em serviços, scrapers e tabelas de saúde do sistema).
 */
export function StatusBadge({
  label,
  tone = "neutral",
  withDot = true,
}: StatusBadgeProps) {
  const classes = toneClasses[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${classes.badge}`}
    >
      {withDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${classes.dot}`} />
      )}
      {label}
    </span>
  );
}
