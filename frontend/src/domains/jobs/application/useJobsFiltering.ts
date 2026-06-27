import type { Job } from "@/domains/jobs/domain/job.types";
import { dedupeJobs, filterJobs, getAvailableKeywords } from "@/domains/jobs/domain/jobFilters";
import { useMemo, useState } from "react";

export function useJobsFiltering(jobs: Job[]) {
  const [search, setSearch] = useState("");
  const [keywordFilter, setKeywordFilter] = useState<string[]>([]);

  const dedupedJobs = useMemo(() => dedupeJobs(jobs), [jobs]);

  const keywords = useMemo(() => getAvailableKeywords(dedupedJobs), [dedupedJobs]);

  const filteredJobs = useMemo(
    () => filterJobs(dedupedJobs, search, keywordFilter),
    [dedupedJobs, search, keywordFilter],
  );

  return {
    search,
    setSearch,
    keywordFilter,
    setKeywordFilter,
    keywords,
    filteredJobs,
  };
}
