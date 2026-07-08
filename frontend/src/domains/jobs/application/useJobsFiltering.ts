import type { Job } from "@/domains/jobs/domain/job.types";
import {
  dedupeJobs,
  filterJobs,
  getAvailableKeywords,
} from "@/domains/jobs/domain/jobFilters";
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
