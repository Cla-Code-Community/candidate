import { ChevronDown } from "lucide-react";

interface TimeFilterProps {
  value: "24h" | "7d";
  onChange: (value: "24h" | "7d") => void;
}

export function TimeFilter({ value, onChange }: TimeFilterProps) {
  return (
    <button
      onClick={() => onChange(value === "24h" ? "7d" : "24h")}
      className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
    >
      <span>{value === "24h" ? "Últimas 24 horas" : "Últimos 7 dias"}</span>
      <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
    </button>
  );
}
