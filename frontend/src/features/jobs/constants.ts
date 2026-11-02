import type { JobLevel, JobStatus, JobType } from "./domain/job";

export const jobStatuses: Record<JobStatus, string> = {
  saved: "Salva",
  applied: "Candidatura enviada",
  interviewing: "Em entrevista",
  rejected: "Arquivada",
  accepted: "Proposta aceita",
};

export const jobStatusClasses: Record<JobStatus, string> = {
  saved: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  applied: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300",
  interviewing: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300",
  rejected: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300",
  accepted: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
};

export const jobTypes: JobType[] = ["Remoto", "Híbrido", "Presencial"];
export const jobLevels: JobLevel[] = [
  "Estágio/Trainee",
  "Júnior",
  "Pleno",
  "Sênior",
];
