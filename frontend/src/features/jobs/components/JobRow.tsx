import { jobStatuses } from "../constants";
import type { Job, JobStatus } from "../domain/job";
import { getFamilyLabel } from "@/features/jobs/api/dashboardJobsApi";
import { JobLocation } from "./JobLocation";
import { TechnologyTags } from "./TechnologyTags";

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

function primaryFamily(job: Job) {
  const classification = job.rawPayload?.classification as
    { primaryFamily?: string } | undefined;
  if (!classification?.primaryFamily) return null;
  return getFamilyLabel(classification.primaryFamily);
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

function jobTechnologies(job: Job) {
  const classification = job.rawPayload?.classification as
    { technologies?: unknown } | undefined;
  const classified = stringValues(classification?.technologies);
  if (classified.length > 0) return classified;
  const matched = stringValues(job.rawPayload?.matchedTechnologies);
  return matched.length > 0
    ? matched
    : stringValues(job.tags).filter((tag) => tag !== "Geral");
}

export function JobRow({ job, onOpen, onStatusChange }: JobRowProps) {
  const matched = matchedTechnologies(job);
  const fam = primaryFamily(job);
  const technologies = jobTechnologies(job);

  return (
    <tr
      role="row"
      className="grid grid-cols-2 border-b border-border transition-colors last:border-0 hover:bg-muted/30 lg:table-row"
    >
      <td
        role="cell"
        className="col-span-2 min-w-0 px-4 pb-3 pt-4 align-middle lg:w-[34%] lg:px-5 lg:py-4"
      >
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpen(job)}
              className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block break-words text-[13px] font-bold leading-5 text-foreground">
                {job.jobTitle}
              </span>
              <span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground">
                {job.company}
              </span>
            </button>
            {technologies.length > 0 && (
              <TechnologyTags technologies={technologies} />
            )}
          </div>
          {fam ? (
            <span className="max-w-36 shrink-0 self-center break-words rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold leading-4 text-accent">
              {fam}
            </span>
          ) : null}
        </div>
      </td>
      <td
        role="cell"
        className="col-span-2 min-w-0 px-4 pb-3 align-middle lg:w-[18%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Localização regional
        </span>
        <JobLocation location={job.location} structured={job.rawPayload} />
      </td>
      <td
        role="cell"
        className="min-w-0 px-4 pb-3 align-middle lg:w-[7%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Fonte
        </span>
        <span
          className="inline-block max-w-full truncate text-[10px] font-medium text-muted-foreground"
          title={job.source || "Fonte não informada"}
        >
          {normalizeSource(job.source)}
        </span>
      </td>
      <td
        role="cell"
        className="min-w-0 break-words px-4 pb-3 align-middle text-[11px] text-foreground lg:w-[7%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Modelo
        </span>
        {job.type}
      </td>
      <td
        role="cell"
        className="min-w-0 break-words px-4 pb-3 align-middle text-[11px] text-foreground lg:w-[6%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Nível
        </span>
        {job.level}
      </td>
      <td
        role="cell"
        className="min-w-0 px-4 pb-3 align-middle text-[10px] text-muted-foreground lg:w-[9%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Publicada em
        </span>
        {job.posted}
      </td>
      <td
        role="cell"
        className="min-w-0 px-4 pb-3 align-middle lg:w-[6%] lg:px-3 lg:py-4"
      >
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Match
        </span>
        <span
          className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold leading-4 text-accent"
          title={
            matched.length > 0
              ? `Tecnologias em comum: ${matched.join(", ")}`
              : "Sem tecnologias do perfil identificadas no texto da vaga"
          }
        >
          {job.matchScore}%
        </span>
      </td>
      <td
        role="cell"
        className="col-span-2 min-w-0 px-4 pb-4 text-right align-middle lg:w-[13%] lg:px-3 lg:py-4"
      >
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(job)}
            className="inline-flex h-8 items-center justify-center rounded border border-input bg-background px-2.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(job.id, "saved")}
            className="inline-flex h-8 items-center justify-center rounded border border-primary/25 bg-primary/10 px-2.5 text-[10px] font-semibold text-accent transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            title={`Salvar vaga. Status atual: ${jobStatuses[job.status]}`}
          >
            Salvar
          </button>
        </div>
      </td>
    </tr>
  );
}
