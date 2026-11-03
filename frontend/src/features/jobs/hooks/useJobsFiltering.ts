import type { Job } from "@/features/jobs/types/job.types";
import {
  dedupeJobs,
  filterJobs,
  getAvailableKeywords,
} from "@/features/jobs/domain/jobFilters";
import { useMemo } from "react";

export function useJobsFiltering(
  jobs: Job[],
  search = "",
  keywordFilter: string[] = [],
) {
  const dedupedJobs = useMemo(() => dedupeJobs(jobs), [jobs]);

  const keywords = useMemo(
    () => getAvailableKeywords(dedupedJobs),
    [dedupedJobs],
  );

  const filteredJobs = useMemo(
    () => filterJobs(dedupedJobs, search, keywordFilter),
    [dedupedJobs, search, keywordFilter],
  );

  return {
    search,
    keywordFilter,
    keywords,
    filteredJobs,
  };
}
