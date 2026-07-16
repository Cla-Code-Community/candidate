import type { Job } from "../../types";

interface StatusCountersProps {
  jobs: Job[];
}

export function StatusCounters({ jobs }: StatusCountersProps) {
  const saved = jobs.filter((job) => job.status === "saved").length;
  const active = jobs.filter((job) => ["applied", "interviewing"].includes(job.status)).length;
  const interviews = jobs.filter((job) => job.status === "interviewing").length;
  const accepted = jobs.filter((job) => job.status === "accepted").length;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <CounterCard label="Vagas salvas" value={saved} helper="Salvas para depois" />
      <CounterCard label="Candidaturas ativas" value={active} helper="Envios realizados" />
      <CounterCard label="Entrevistas agendadas" value={interviews} helper="Fases em andamento" />
      <CounterCard label="Vagas concluídas" value={accepted} helper="Histórico geral" />
    </div>
  );
}

function CounterCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">
        {label}
      </span>
      <p className="mt-2 text-[30px] font-bold leading-none text-foreground">{value}</p>
      <p className="mt-3 text-sm text-slate-400 dark:text-slate-400">{helper}</p>
    </div>
  );
}
