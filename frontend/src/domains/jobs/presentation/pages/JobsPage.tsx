import { JobsFiltersCard } from "@/domains/jobs/presentation/components/JobsFiltersCard";
import { JobsTableCard } from "@/domains/jobs/presentation/components/JobsTableCard";
import { Button } from "@/shared/ui/button";
import { useJobsData } from "@/domains/jobs/application/useJobsData";
import { useJobsFiltering } from "@/domains/jobs/application/useJobsFiltering";
import { useJobsPagination } from "@/domains/jobs/application/useJobsPagination";
import type { JobsMeta } from "@/domains/jobs/domain/job.types";
import { useCallback, type SetStateAction } from "react";
import { FiRefreshCw } from "react-icons/fi";

function formatDate(timestamp: JobsMeta["modifiedAt"]): string {
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleString("pt-BR");
}

function JobsPage() {
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
  } = useJobsData();

  const {
    search,
    setSearch,
    keywordFilter,
    setKeywordFilter,
    keywords,
    filteredJobs,
  } = useJobsFiltering(jobs);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    resetPagination,
    totalPages,
    paginatedJobs,
  } = useJobsPagination({
    filteredJobs,
  });

  const handleSearchChange = useCallback(
    (value: SetStateAction<string>) => {
      setSearch((previous) =>
        typeof value === "function" ? value(previous) : value,
      );
      resetPagination();
    },
    [setSearch, resetPagination],
  );

  const handleKeywordFilterChange = useCallback(
    (value: SetStateAction<string[]>) => {
      setKeywordFilter((previous) =>
        typeof value === "function" ? value(previous) : value,
      );
      resetPagination();
    },
    [setKeywordFilter, resetPagination],
  );

  const handleSelectedFileChange = useCallback(
    (value: SetStateAction<string>) => {
      setSelectedFile((previous) =>
        typeof value === "function" ? value(previous) : value,
      );
      resetPagination();
    },
    [setSelectedFile, resetPagination],
  );

  const handlePageSizeChange = useCallback(
    (value: number) => {
      setPageSize(value);
      resetPagination();
    },
    [setPageSize, resetPagination],
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
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </section>
  );
}

export default JobsPage;
