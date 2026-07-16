import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Job, JobStatus } from "../../types";
import { JobRow } from "./JobRow";

interface JobTableProps {
  jobs: Job[];
  onOpenJob: (job: Job) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (limit: number) => void;
}

export function JobTable({
  jobs,
  onOpenJob,
  onStatusChange,
  pagination,
  onPageChange,
  onPageSizeChange,
}: JobTableProps) {
  const [requestedPage, setRequestedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <h3 className="text-sm font-bold">Nenhuma vaga encontrada</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Ajuste os filtros ou adicione uma oportunidade manualmente.
        </p>
      </div>
    );
  }

  const isRemotePaginated = Boolean(pagination && onPageChange);
  const effectivePageSize = pagination?.limit ?? pageSize;
  const totalItems = pagination?.total ?? jobs.length;
  const totalPages =
    pagination?.totalPages ?? Math.max(1, Math.ceil(jobs.length / pageSize));
  const currentPage = Math.min(pagination?.page ?? requestedPage, totalPages);
  const firstItemIndex = (currentPage - 1) * effectivePageSize;
  const visibleJobs = isRemotePaginated
    ? jobs
    : jobs.slice(firstItemIndex, firstItemIndex + pageSize);
  const firstVisibleItem = firstItemIndex + 1;
  const lastVisibleItem = Math.min(
    firstItemIndex + visibleJobs.length,
    totalItems,
  );

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => {
      const firstPage = Math.min(
        Math.max(currentPage - 2, 1),
        Math.max(totalPages - 4, 1),
      );
      return firstPage + index;
    },
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-border bg-muted/45 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-bold">Cargo / Empresa</th>
              <th className="px-4 py-4 font-bold">Fonte</th>
              <th className="px-4 py-4 font-bold">Modelo</th>
              <th className="px-4 py-4 font-bold">Nível</th>
              <th className="px-4 py-4 font-bold">Match</th>
              <th className="px-6 py-4 text-right font-bold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onOpen={onOpenJob}
                onStatusChange={onStatusChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-h-16 flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Exibindo {firstVisibleItem}-{lastVisibleItem} de {totalItems} vagas
          </span>
          <label className="flex items-center gap-2">
            <span>Por página</span>
            <select
              value={effectivePageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                setPageSize(nextSize);
                setRequestedPage(1);
                onPageSizeChange?.(nextSize);
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground outline-none focus:border-ring"
              aria-label="Vagas por página"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav
          className="flex items-center gap-1"
          aria-label="Paginação de vagas"
        >
          <button
            type="button"
            onClick={() => {
              const nextPage = Math.max(1, currentPage - 1);
              setRequestedPage(nextPage);
              onPageChange?.(nextPage);
            }}
            disabled={currentPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => {
                setRequestedPage(page);
                onPageChange?.(page);
              }}
              className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors ${
                page === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              const nextPage = Math.min(totalPages, currentPage + 1);
              setRequestedPage(nextPage);
              onPageChange?.(nextPage);
            }}
            disabled={currentPage === totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
