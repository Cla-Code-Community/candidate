import { JobsFiltersCard } from "@/domains/jobs/presentation/components/JobsFiltersCard";
import { JobsTableCard } from "@/domains/jobs/presentation/components/JobsTableCard";
import { Button } from "@/shared/ui/button";
import { useJobsData } from "@/domains/jobs/application/useJobsData";
import { useJobsFiltering } from "@/domains/jobs/application/useJobsFiltering";
import type { JobsMeta } from "@/domains/jobs/domain/job.types";
import {
  clampPageSize,
  getCurrentPage,
  getTotalPages,
  paginateItems,
} from "@/domains/jobs/domain/jobPagination";
import { useCallback, useEffect, useMemo, type SetStateAction } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

function formatDate(timestamp: JobsMeta["modifiedAt"]): string {
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleString("pt-BR");
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
  const selectedFileParam = searchParams.get("file") ?? "";
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const pageSize = clampPageSize(
    parsePositiveInteger(searchParams.get("pageSize"), 5),
  );

  const {
    files,
    selectedFile,
    setSelectedFile,
    jobs,
    meta,
    loading,
    scraping,
    error,
    triggerScraper,
  } = useJobsData(selectedFileParam);

  const { keywords, filteredJobs } = useJobsFiltering(
    jobs,
    search,
    keywordFilter,
  );

  const totalPages = useMemo(
    () => getTotalPages(filteredJobs.length, pageSize),
    [filteredJobs.length, pageSize],
  );
  const currentPage = getCurrentPage(page, totalPages);
  const paginatedJobs = useMemo(
    () => paginateItems(filteredJobs, currentPage, pageSize),
    [filteredJobs, currentPage, pageSize],
  );

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
    if (selectedFileParam && selectedFileParam !== selectedFile) {
      setSelectedFile(selectedFileParam);
    }
  }, [selectedFileParam, selectedFile, setSelectedFile]);

  useEffect(() => {
    if (selectedFile && selectedFile !== selectedFileParam) {
      updateSearchParams({ file: selectedFile }, { replace: true });
    }
  }, [selectedFile, selectedFileParam, updateSearchParams]);

  useEffect(() => {
    if (page !== currentPage) {
      updateSearchParams(
        { page: currentPage === 1 ? null : String(currentPage) },
        { replace: true },
      );
    }
  }, [currentPage, page, updateSearchParams]);

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

  const handleSelectedFileChange = useCallback(
    (value: SetStateAction<string>) => {
      const nextFile =
        typeof value === "function" ? value(selectedFile) : value;
      setSelectedFile(nextFile);
      updateSearchParams({ file: nextFile || null }, { resetPage: true });
    },
    [selectedFile, setSelectedFile, updateSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      updateSearchParams({ page: nextPage === 1 ? null : String(nextPage) });
    },
    [updateSearchParams],
  );

  const handlePageSizeChange = useCallback(
    (value: number) => {
      const nextPageSize = clampPageSize(value);
      updateSearchParams(
        { pageSize: nextPageSize === 5 ? null : String(nextPageSize) },
        { resetPage: true },
      );
    },
    [updateSearchParams],
  );

  const handleScraper = useCallback(() => {
    void triggerScraper();
  }, [triggerScraper]);

  return (
    <section className="mx-auto flex min-h-full w-full flex-col gap-6 px-4 py-6 transition-colors duration-300 md:px-8">
      <JobsFiltersCard
        search={search}
        setSearch={handleSearchChange}
        keywordFilter={keywordFilter}
        setKeywordFilter={handleKeywordFilterChange}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        keywords={keywords}
        selectedFile={selectedFile}
        setSelectedFile={handleSelectedFileChange}
        files={files}
        meta={meta}
        actions={
          <>
            <Button
              onClick={handleScraper}
              disabled={scraping}
              className="h-12 md:h-14 w-full sm:w-auto rounded-xl md:rounded-2xl bg-[#0c6b35] px-6 text-base text-white shadow-sm hover:bg-[#0a5b2d] whitespace-nowrap flex items-center gap-2"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`}
              />
              {scraping ? "Buscando vagas..." : "Buscar vagas"}
            </Button>
          </>
        }
      />

      <JobsTableCard
        meta={meta}
        filteredJobs={filteredJobs}
        paginatedJobs={paginatedJobs}
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
