import { jobStatuses } from "../../constants";
import type { Job, JobStatus } from "../../types";

interface JobRowProps {
  job: Job;
  onOpen: (job: Job) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
}

function normalizeSource(source: string) {
  const normalized = source.trim().toLowerCase();
  const knownSources = [
    ["linkedin", "LinkedIn"],
    ["adzuna", "Adzuna"],
    ["jooble", "Jooble"],
    ["greenhouse", "Greenhouse"],
    ["gupy", "Gupy"],
    ["indeed", "Indeed"],
    ["glassdoor", "Glassdoor"],
  ] as const;

  const match = knownSources.find(([key]) => normalized.includes(key));
  return match?.[1] ?? (source.trim() || "Não informada");
}

function matchedTechnologies(job: Job) {
  const values = job.rawPayload?.matchedTechnologies;
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string")
    : [];
}

export function JobRow({ job, onOpen, onStatusChange }: JobRowProps) {
  const matched = matchedTechnologies(job);

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/45">
      <td className="min-w-[300px] px-6 py-5 align-middle">
        <button
          type="button"
          onClick={() => onOpen(job)}
          className="block text-left"
        >
          <span className="block text-sm font-bold text-foreground">
            {job.jobTitle}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">
            {job.company}
          </span>
        </button>
      </td>
      <td className="px-4 py-5 align-middle">
        <span
          className="inline-flex max-w-32 truncate rounded-md border border-border bg-muted/45 px-2 py-1 text-[11px] font-bold text-muted-foreground"
          title={job.source || "Fonte não informada"}
        >
          {normalizeSource(job.source)}
        </span>
      </td>
      <td className="px-4 py-5 align-middle text-xs font-semibold">
        {job.type}
      </td>
      <td className="px-4 py-5 align-middle text-sm text-muted-foreground">
        {job.level}
      </td>
      <td className="px-4 py-5 align-middle">
        <span
          className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700"
          title={
            matched.length > 0
              ? `Tecnologias em comum: ${matched.join(", ")}`
              : "Sem tecnologias do perfil identificadas no texto da vaga"
          }
        >
          {job.matchScore}%
        </span>
      </td>
      <td className="px-6 py-5 text-right align-middle">
        <button
          type="button"
          onClick={() => onOpen(job)}
          className="mr-3 text-xs font-bold text-slate-600 hover:text-foreground"
        >
          Detalhes
        </button>
        <button
          type="button"
          onClick={() => onStatusChange(job.id, "saved")}
          className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          title={`Salvar vaga. Status atual: ${jobStatuses[job.status]}`}
        >
          Salvar
        </button>
      </td>
    </tr>
  );
}
