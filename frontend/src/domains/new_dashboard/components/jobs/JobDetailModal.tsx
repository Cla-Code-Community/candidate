import { ExternalLink } from "lucide-react";
import { jobStatusClasses, jobStatuses } from "../../constants";
import type { Job, JobStatus } from "../../types";
import { Modal } from "../shared/Modal";

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onNotesChange: (jobId: string, notes: string) => void;
}

const payloadLabels: Record<string, string> = {
  id: "ID",
  title: "Título",
  company: "Empresa",
  location: "Local",
  url: "URL",
  salary: "Salário",
  modality: "Modalidade",
  description: "Descrição",
  postedAt: "Publicado em",
  source: "Fonte",
  sources: "Fontes",
  keyword: "Keyword",
  keywords: "Keywords",
};

function payloadValueToText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(payloadValueToText).join(", ") : "[]";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function JobDetailModal({
  job,
  onClose,
  onStatusChange,
  onNotesChange,
}: JobDetailModalProps) {
  const payloadEntries = Object.entries(job.rawPayload ?? {});
  const description = payloadValueToText(job.rawPayload?.description);
  const hasDescription = description !== "Não informado";

  return (
    <Modal
      title={job.jobTitle}
      subtitle={job.company}
      onClose={onClose}
      footer={
        <>
          <a
            href={job.jobLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir vaga
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Concluir
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-3">
            <span className="text-xs font-bold uppercase text-muted-foreground">Local</span>
            <p className="mt-1 text-sm font-semibold">{job.location}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <span className="text-xs font-bold uppercase text-muted-foreground">Salário</span>
            <p className="mt-1 text-sm font-semibold">{job.salary}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <span className="text-xs font-bold uppercase text-muted-foreground">Match</span>
            <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {job.matchScore}%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${jobStatusClasses[job.status]}`}>
            {jobStatuses[job.status]}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
            {job.type}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
            {job.level}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
            {job.source}
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase text-muted-foreground">Tecnologias</span>
          <div className="flex flex-wrap gap-2">
            {job.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-border bg-background px-2 py-1 text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {hasDescription ? (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              Descrição
            </span>
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        ) : null}

        {payloadEntries.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">
              Payload da vaga
            </span>
            <div className="grid gap-2">
              {payloadEntries.map(([key, value]) => {
                const text = payloadValueToText(value);

                return (
                  <div
                    key={key}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <span className="block text-xs font-bold uppercase text-muted-foreground">
                      {payloadLabels[key] ?? key}
                    </span>
                    {isExternalUrl(text) ? (
                      <a
                        href={text}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-sm font-semibold text-primary hover:underline"
                      >
                        {text}
                      </a>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold">
                        {text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="space-y-2 block">
          <span className="text-xs font-bold uppercase text-muted-foreground">Status</span>
          <select
            value={job.status}
            onChange={(event) => onStatusChange(job.id, event.target.value as JobStatus)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          >
            {Object.entries(jobStatuses).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 block">
          <span className="text-xs font-bold uppercase text-muted-foreground">Notas</span>
          <textarea
            value={job.notes}
            onChange={(event) => onNotesChange(job.id, event.target.value)}
            className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>
      </div>
    </Modal>
  );
}
