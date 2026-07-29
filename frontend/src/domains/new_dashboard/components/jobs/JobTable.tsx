import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Job, JobStatus } from "../../types";
import { JobRow } from "./JobRow";

type SortColumn = "source" | "level" | "posted";
type SortDirection = "asc" | "desc";

const levelOrder: Record<Job["level"], number> = {
  "Estágio/Trainee": 0,
  Júnior: 1,
  Pleno: 2,
  Sênior: 3,
};

function publicationTimestamp(job: Job) {
  const rawPostedAt = job.rawPayload?.postedAt;
  if (typeof rawPostedAt === "string" && rawPostedAt.trim()) {
    const timestamp = new Date(rawPostedAt).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const formattedDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(job.posted);
  if (!formattedDate) return null;

  const [, day, month, year] = formattedDate;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function compareNullableValues<T>(
  first: T | null,
  second: T | null,
  direction: SortDirection,
  compare: (left: T, right: T) => number,
) {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;

  const result = compare(first, second);
  return direction === "asc" ? result : -result;
}

function compareJobs(
  first: Job,
  second: Job,
  column: SortColumn,
  direction: SortDirection,
) {
  if (column === "source") {
    return compareNullableValues(
      first.source.trim() || null,
      second.source.trim() || null,
      direction,
      (left, right) =>
        left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
    );
  }

  if (column === "level") {
    return compareNullableValues(
      levelOrder[first.level],
      levelOrder[second.level],
      direction,
      (left, right) => left - right,
    );
  }

  return compareNullableValues(
    publicationTimestamp(first),
    publicationTimestamp(second),
    direction,
    (left, right) => left - right,
  );
}

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
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  } | null>(null);

  const sortedJobs = useMemo(() => {
    if (!sort) return jobs;

    return jobs
      .map((job, index) => ({ job, index }))
      .sort(
        (first, second) =>
          compareJobs(
            first.job,
            second.job,
            sort.column,
            sort.direction,
          ) || first.index - second.index,
      )
      .map(({ job }) => job);
  }, [jobs, sort]);

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
    ? sortedJobs
    : sortedJobs.slice(firstItemIndex, firstItemIndex + pageSize);
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

  const toggleSort = (column: SortColumn) => {
    setSort((current) => {
      if (current?.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        column,
        direction: column === "posted" ? "desc" : "asc",
      };
    });
  };

  const sortIcon = (column: SortColumn) => {
    if (sort?.column !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />;
    }

    return sort.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
    );
  };

  const ariaSort = (column: SortColumn) => {
    if (sort?.column !== column) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-border bg-muted/45 text-xs text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-bold">Cargo / empresa</th>
              <th
                className="px-4 py-4 font-bold"
                aria-sort={ariaSort("source")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("source")}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                  aria-label="Ordenar por fonte"
                >
                  Fonte
                  {sortIcon("source")}
                </button>
              </th>
              <th className="px-4 py-4 font-bold">Modelo</th>
              <th
                className="px-4 py-4 font-bold"
                aria-sort={ariaSort("level")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("level")}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                  aria-label="Ordenar por nível"
                >
                  Nível
                  {sortIcon("level")}
                </button>
              </th>
              <th
                className="px-4 py-4 font-bold"
                aria-sort={ariaSort("posted")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("posted")}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                  aria-label="Ordenar por data de publicação"
                >
                  Publicada em
                  {sortIcon("posted")}
                </button>
              </th>
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
