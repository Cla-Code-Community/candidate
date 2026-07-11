import { JobsFiltersCard } from "@/domains/jobs/presentation/components/JobsFiltersCard";
import { JobsTableCard } from "@/domains/jobs/presentation/components/JobsTableCard";
import { useJobsData } from "@/domains/jobs/application/useJobsData";
import { useCallback, useEffect, useMemo, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";

function formatDate(): string {
  return new Date().toLocaleString("pt-BR");
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(parsed));
}

function getKeywordFilter(searchParams: URLSearchParams) {
  return searchParams
    .getAll("keyword")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSearchTerms(search: string) {
  return search
    .split(/[,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const keywordFilter = useMemo(
    () => getKeywordFilter(searchParams),
    [searchParams],
  );

  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), 5);

  const {
    jobs,
    meta,
    loading,
    scraping,
    error,
  } = useJobsData(page, pageSize);

  const totalPages = meta.totalPages;
  const currentPage = meta.page || page;

  const updateSearchParams = useCallback(
    (
      updates: Record<string, string | string[] | null>,
      options: { resetPage?: boolean; replace?: boolean } = {},
    ) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          Object.entries(updates).forEach(([key, value]) => {
            next.delete(key);

            if (Array.isArray(value)) {
              value.filter(Boolean).forEach((item) => next.append(key, item));
              return;
            }

            if (value) {
              next.set(key, value);
            }
          });

          if (options.resetPage) {
            next.delete("page");
          }

          return next;
        },
        { replace: options.replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      updateSearchParams({ page: String(totalPages) }, { replace: true });
    }
  }, [currentPage, page, totalPages, updateSearchParams]);

  const handleSearchChange = useCallback(
    (value: SetStateAction<string>) => {
      const nextSearch = typeof value === "function" ? value(search) : value;
      updateSearchParams(
        { q: nextSearch.trim() ? nextSearch : null },
        { resetPage: true },
      );
    },
    [search, updateSearchParams],
  );

  const handleKeywordFilterChange = useCallback(
    (value: SetStateAction<string[]>) => {
      const nextKeywordFilter =
        typeof value === "function" ? value(keywordFilter) : value;
      updateSearchParams({ keyword: nextKeywordFilter }, { resetPage: true });
    },
    [keywordFilter, updateSearchParams],
  );

  const handleRemoveFilter = useCallback(
    (filterToRemove: string) => {
      const nextKeywordFilter = keywordFilter.filter(
        (item) => item !== filterToRemove,
      );
      const nextSearch = getSearchTerms(search)
        .filter((item) => item !== filterToRemove)
        .join(", ");

      updateSearchParams(
        {
          keyword: nextKeywordFilter,
          q: nextSearch || null,
        },
        { resetPage: true },
      );
    },
    [keywordFilter, search, updateSearchParams],
  );

  const handleClearFilters = useCallback(() => {
    updateSearchParams(
      {
        keyword: [],
        q: null,
      },
      { resetPage: true },
    );
  }, [updateSearchParams]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      updateSearchParams({ page: nextPage === 1 ? null : String(nextPage) });
    },
    [updateSearchParams],
  );

  const handlePageSizeChange = useCallback(
    (value: number) => {
      updateSearchParams(
        { pageSize: String(value) },
        { resetPage: true },
      );
    },
    [updateSearchParams],
  );

  const mockKeywords: string[] = useMemo(() => {
    return Array.from(new Set(jobs.map(j => j.keyword).filter(Boolean))) as string[];
  }, [jobs]);

  return (
    <section className="mx-auto flex min-h-full w-full flex-col gap-6 px-4 py-6 transition-colors duration-300 md:px-8">
      <JobsFiltersCard
        search={search}
        setSearch={handleSearchChange}
        keywordFilter={keywordFilter}
        setKeywordFilter={handleKeywordFilterChange}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        keywords={mockKeywords}
        meta={meta}
      />

      <JobsTableCard
        meta={meta}
        filteredJobs={jobs}
        paginatedJobs={jobs}
        loading={loading || scraping}
        error={error}
        formatDate={formatDate}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </section>
  );
}

export default JobsPage;
