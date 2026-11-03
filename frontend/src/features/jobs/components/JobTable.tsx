import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Job, JobStatus, MatchSort } from "../domain/job";
import { JobRow } from "./JobRow";

type SortColumn = "source" | "level" | "posted" | "match";
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
  if (column === "match") {
    const score = (job: Job) =>
      typeof job.matchScore === "number" && Number.isFinite(job.matchScore)
        ? job.matchScore
        : 0;
    return direction === "desc"
      ? score(second) - score(first)
      : score(first) - score(second);
  }

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
  matchSort?: MatchSort;
  onMatchSortChange?: (value: MatchSort) => void;
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
  matchSort = "default",
  onMatchSortChange,
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
  const activeSort = useMemo(
    () =>
      sort ??
      (matchSort !== "default"
        ? { column: "match" as const, direction: matchSort }
        : null),
    [sort, matchSort],
  );

  const sortedJobs = useMemo(() => {
    // Com paginação remota, Match é ordenado pela API sobre todos os resultados.
    if (
      !activeSort ||
      (activeSort.column === "match" && (onMatchSortChange || pagination))
    )
      return jobs;

    return jobs
      .map((job, index) => ({ job, index }))
      .sort(
        (first, second) =>
          compareJobs(
            first.job,
            second.job,
            activeSort.column,
            activeSort.direction,
          ) || first.index - second.index,
      )
      .map(({ job }) => job);
  }, [jobs, activeSort, onMatchSortChange, pagination]);

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
    if (column === "match" && onMatchSortChange) {
      setSort(null);
      setRequestedPage(1);
      onMatchSortChange(
        activeSort?.column === "match" && activeSort.direction === "desc"
          ? "asc"
          : "desc",
      );
      return;
    }
    setSort((current) => {
      if (current?.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        column,
        direction: column === "posted" || column === "match" ? "desc" : "asc",
      };
    });
    if (column === "match") setRequestedPage(1);
  };

  const sortIcon = (column: SortColumn) => {
    if (activeSort?.column !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />;
    }

    return activeSort.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
    );
  };

  const ariaSort = (column: SortColumn) => {
    if (activeSort?.column !== column) return "none";
    return activeSort.direction === "asc" ? "ascending" : "descending";
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table
          role="table"
          aria-label="Vagas recomendadas"
          className="block w-full border-collapse text-left lg:table lg:min-w-[1080px] lg:table-fixed"
        >
          <thead
            role="rowgroup"
            className="block border-b border-border bg-background/60 text-[10px] uppercase tracking-wide text-muted-foreground lg:table-header-group"
          >
            <tr
              role="row"
              className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 lg:table-row lg:p-0"
            >
              <th
                role="columnheader"
                scope="col"
                className="sr-only font-semibold lg:not-sr-only lg:table-cell lg:w-[34%] lg:px-5 lg:py-3"
              >
                Cargo / empresa / área
              </th>
              <th
                role="columnheader"
                scope="col"
                className="sr-only font-semibold lg:not-sr-only lg:table-cell lg:w-[18%] lg:px-3 lg:py-3"
              >
                Localização regional
              </th>
              <th
                role="columnheader"
                scope="col"
                className="font-semibold lg:w-[7%] lg:px-3 lg:py-3"
                aria-sort={ariaSort("source")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("source")}
                  className={`inline-flex items-center gap-1.5 ${activeSort?.column === "source" ? "text-primary hover:text-primary" : "hover:text-foreground"}`}
                  aria-label="Ordenar por fonte"
                >
                  Fonte
                  {sortIcon("source")}
                </button>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="sr-only font-semibold lg:not-sr-only lg:table-cell lg:w-[7%] lg:px-3 lg:py-3"
              >
                Modelo
              </th>
              <th
                role="columnheader"
                scope="col"
                className="font-semibold lg:w-[6%] lg:px-3 lg:py-3"
                aria-sort={ariaSort("level")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("level")}
                  className={`inline-flex items-center gap-1.5 ${activeSort?.column === "level" ? "text-primary hover:text-primary" : "hover:text-foreground"}`}
                  aria-label="Ordenar por nível"
                >
                  Nível
                  {sortIcon("level")}
                </button>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="font-semibold lg:w-[9%] lg:px-3 lg:py-3"
                aria-sort={ariaSort("posted")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("posted")}
                  className={`inline-flex items-center gap-1.5 ${activeSort?.column === "posted" ? "text-primary hover:text-primary" : "hover:text-foreground"}`}
                  aria-label="Ordenar por data de publicação"
                >
                  Publicada em
                  {sortIcon("posted")}
                </button>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="font-semibold lg:w-[6%] lg:px-3 lg:py-3"
                aria-sort={ariaSort("match")}
              >
                <button
                  type="button"
                  onClick={() => toggleSort("match")}
                  disabled={Boolean(pagination && !onMatchSortChange)}
                  className={`inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${activeSort?.column === "match" ? "text-primary hover:text-primary" : "hover:text-foreground"}`}
                  aria-label="Ordenar por match"
                >
                  Match
                  {sortIcon("match")}
                </button>
              </th>
              <th
                role="columnheader"
                scope="col"
                className="sr-only text-right font-semibold lg:not-sr-only lg:table-cell lg:w-[13%] lg:px-3 lg:py-3"
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="block lg:table-row-group">
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

      <div className="flex min-h-14 flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
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
