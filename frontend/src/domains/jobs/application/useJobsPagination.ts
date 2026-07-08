import type { Job } from "@/domains/jobs/domain/job.types";
import {
  clampPageSize,
  getCurrentPage,
  getTotalPages,
  paginateItems,
} from "@/domains/jobs/domain/jobPagination";
import { useMemo, useState } from "react";

interface UseJobsPaginationParams {
  filteredJobs: Job[];
  initialPageSize?: number;
}

export function useJobsPagination({
  filteredJobs,
  initialPageSize = 5,
}: UseJobsPaginationParams) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(clampPageSize(initialPageSize));

  const totalPages = useMemo(() => {
    return getTotalPages(filteredJobs.length, pageSize);
  }, [filteredJobs.length, pageSize]);

  const currentPage = getCurrentPage(page, totalPages);

  const paginatedJobs = useMemo(() => {
    return paginateItems(filteredJobs, currentPage, pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  function setCurrentPage(value: number | ((previous: number) => number)) {
    setPage((previous) => {
      const next = typeof value === "function" ? value(previous) : value;
      return Math.max(1, next);
    });
  }

  function setPageSize(value: number | ((previous: number) => number)) {
    setPageSizeState((previous) => {
      const next = typeof value === "function" ? value(previous) : value;
      return clampPageSize(next);
    });
  }

  function resetPagination() {
    setPage(1);
  }

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    resetPagination,
    totalPages,
    paginatedJobs,
  };
}
