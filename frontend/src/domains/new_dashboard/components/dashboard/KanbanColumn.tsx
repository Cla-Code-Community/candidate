import type { Job, JobStatus } from "../../types";

interface KanbanColumnProps {
  status: JobStatus;
  jobs: Job[];
  onOpenJob: (job: Job) => void;
  draggedJobId: string | null;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  onDropJob: (status: JobStatus) => void;
}

export function KanbanColumn({
  status,
  jobs,
  onOpenJob,
  draggedJobId,
  onDragStart,
  onDragEnd,
  onDropJob,
}: KanbanColumnProps) {
  const config = {
    saved: {
      title: "SALVAS",
      tint: "bg-slate-50 dark:bg-slate-900/30",
      empty: "Nenhuma vaga aqui",
      scrollColor: "#64748b",
    },
    applied: {
      title: "CANDIDATADAS",
      tint: "bg-slate-50 dark:bg-slate-900/30",
      empty: "Nenhuma vaga aqui",
      scrollColor: "#0ea5e9",
    },
    interviewing: {
      title: "ENTREVISTANDO",
      tint: "bg-amber-50/40 dark:bg-amber-950/10",
      empty: "Nenhuma vaga aqui",
      scrollColor: "#f59e0b",
    },
    rejected: {
      title: "NÃO SELECIONADA",
      tint: "bg-rose-50/35 dark:bg-rose-950/10",
      empty: "Nenhuma vaga aqui",
      scrollColor: "#f43f5e",
    },
    accepted: {
      title: "APROVADA!",
      tint: "bg-emerald-50/40 dark:bg-emerald-950/10",
      empty: "Nenhuma vaga aqui",
      scrollColor: "#10b981",
    },
  } satisfies Record<
    JobStatus,
    { title: string; tint: string; empty: string; scrollColor: string }
  >;

  return (
    <section
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropJob(status);
      }}
      className={`flex h-[468px] min-w-[138px] flex-col rounded-2xl border border-border px-4 py-4 transition-colors ${config[status].tint} ${
        draggedJobId ? "ring-1 ring-primary/20" : ""
      }`}
    >
      <header className="mb-4 flex items-start justify-between gap-2">
        <span className="text-sm font-bold leading-4 text-foreground">{config[status].title}</span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-bold text-slate-600">
          {jobs.length}
        </span>
      </header>
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]"
        style={{ scrollbarColor: `${config[status].scrollColor} transparent` }}
      >
        {jobs.length > 0 ? (
          jobs.map((job) => (
            <article
              key={job.id}
              draggable
              role="button"
              tabIndex={0}
              onClick={() => onOpenJob(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenJob(job);
                }
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", job.id);
                onDragStart(job.id);
              }}
              onDragEnd={onDragEnd}
              className={`flex h-[116px] w-full cursor-grab flex-col rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted active:cursor-grabbing ${
                draggedJobId === job.id ? "opacity-50 ring-2 ring-primary/40" : ""
              }`}
            >
              <span className="block h-5 truncate text-sm font-bold leading-5">
                {job.jobTitle}
              </span>
              <span className="mt-1.5 block h-4 truncate text-xs leading-4 text-muted-foreground">
                {job.company}
              </span>
              <div className="mt-auto flex h-8 items-center justify-between gap-2 border-t border-border pt-2">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {job.posted}
                </span>
                <span className="shrink-0 rounded bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">
                  {job.matchScore}% Match
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-4 text-center text-xs text-muted-foreground">
            {config[status].empty}
          </div>
        )}
      </div>
    </section>
  );
}
