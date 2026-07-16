import { ClipboardList } from "lucide-react";
import { jobStatuses } from "../../constants";
import type { Job, UserProfile } from "../../types";
import { CareerChecklist } from "./CareerChecklist";
import { StatusCounters } from "./StatusCounters";
import { WelcomeBanner } from "./WelcomeBanner";

interface HomeTabProps {
  userProfile: UserProfile;
  jobs: Job[];
  onExploreJobs: () => void;
}

export function HomeTab({ userProfile, jobs, onExploreJobs }: HomeTabProps) {
  const recentJobs = jobs.slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 p-6 lg:p-8">
      <WelcomeBanner
        userProfile={userProfile}
        jobsCount={jobs.length}
        onExploreJobs={onExploreJobs}
      />
      <StatusCounters jobs={jobs} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CareerChecklist />
        <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-bold text-foreground">
                Candidaturas recentes
              </h3>

              {recentJobs.length > 0 ? (
                <ul className="mt-4 divide-y divide-border">
                  {recentJobs.map((job) => (
                    <li
                      key={job.id}
                      className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">
                          {job.jobTitle}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.company} · {job.location}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-primary">
                        {jobStatuses[job.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Nenhuma vaga salva ainda. Busque oportunidades e salve as
                    candidaturas que quiser acompanhar aqui.
                  </p>
                  <button
                    type="button"
                    onClick={onExploreJobs}
                    className="mt-3 text-sm font-bold text-primary hover:underline"
                  >
                    Buscar vagas
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
