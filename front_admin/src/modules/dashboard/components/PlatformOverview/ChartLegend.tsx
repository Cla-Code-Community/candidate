interface LegendItem {
  color: string;
  label: string;
}

const ITEMS: LegendItem[] = [
  { color: "bg-emerald-500", label: "Vagas no índice" },
  { color: "bg-blue-500", label: "Usuários ativos" },
];

export function ChartLegend() {
  return (
    <div className="flex gap-4 items-center mt-3 text-xs">
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-3 h-0.5 block ${item.color}`} />
          <span className="text-slate-500 dark:text-slate-400 font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
