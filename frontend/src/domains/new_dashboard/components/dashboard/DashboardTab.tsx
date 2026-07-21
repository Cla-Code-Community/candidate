import { BriefcaseBusiness, Plus } from "lucide-react";
import type { Job, JobStatus, TechnologyExperience } from "../../types";
import { KanbanBoard } from "./KanbanBoard";

interface DashboardTabProps {
  jobs: Job[];
  technologies: TechnologyExperience[];
  onOpenJob: (job: Job) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onAddJob?: () => void;
}

export function DashboardTab({
  jobs,
  technologies,
  onOpenJob,
  onStatusChange,
  onAddJob,
}: DashboardTabProps) {
  const totalJobs = Math.max(jobs.length, 1);
  const startedJobs = jobs.filter((job) => job.status !== "saved").length;
  const interviewingJobs = jobs.filter((job) => job.status === "interviewing").length;

  const funnelItems = [
    {
      label: "Vagas Monitoradas",
      count: jobs.length,
      percent: jobs.length > 0 ? 100 : 0,
      color: "bg-primary",
    },
    {
      label: "Processos Iniciados",
      count: startedJobs,
      percent: Math.round((startedJobs / totalJobs) * 100),
      color: "bg-violet-500",
    },
    {
      label: "Etapas de Entrevista",
      count: interviewingJobs,
      percent: Math.round((interviewingJobs / totalJobs) * 100),
      color: "bg-amber-500",
    },
  ];

  function proficiencyPercent(years: number) {
    if (years <= 0) return 15;
    if (years < 1) return 25;
    if (years < 2) return 40;
    if (years < 3) return 55;
    if (years < 5) return 70;
    if (years < 8) return 85;
    return 95;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-8 px-6 py-8 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Gerenciar Vagas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe seu fluxo de contratação arrastando suas oportunidades de forma visual.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddJob}
          className="group inline-flex h-11 shrink-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary px-4 pr-5 text-sm font-bold text-primary-foreground shadow-sm shadow-emerald-950/10 transition-all hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-md hover:shadow-emerald-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 transition-colors group-hover:bg-white/20">
            <Plus className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Adicionar vaga</span>
          <BriefcaseBusiness className="h-4 w-4 opacity-80 sm:hidden" />
        </button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Quadro Kanban de Vagas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhe e movimente o progresso de seus processos seletivos.
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-primary dark:text-emerald-400">
            Sincronizado
          </span>
        </div>
        <KanbanBoard
          jobs={jobs}
          onOpenJob={onOpenJob}
          onStatusChange={onStatusChange}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-bold">Análise de Vagas</h2>
          <div className="mt-5 space-y-4">
            {funnelItems.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex justify-between text-xs font-bold">
                  <span>
                    {item.label} ({item.count})
                  </span>
                  <span>{item.percent}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border border-border bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-bold">Minhas Habilidades Técnicas</h2>
          <div className="mt-5 space-y-4">
            {technologies.map((tech) => {
              const percent = proficiencyPercent(tech.years);

              return (
                <div key={tech.name} className="grid grid-cols-[120px_minmax(0,1fr)_84px] items-center gap-3 text-xs">
                  <span className="truncate font-semibold">{tech.name}</span>
                  <div className="h-3 overflow-hidden rounded-full border border-border bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-right font-bold">
                    {percent}% · {tech.years}a
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
