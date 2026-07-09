import {
  fetchJobsByAPI,
  runScraperRequest,
} from "@/domains/jobs/infrastructure/jobsApi";
import type { Job, JobsResponse } from "@/domains/jobs/domain/job.types";
import { useCallback, useEffect, useState } from "react";

export type JobsPaginationMeta = Omit<JobsResponse, "jobs">;

const EMPTY_META: JobsPaginationMeta = {
  total: 0,
  hasNext: false,
  hasPrev: false,
  page: 0,
  limit: 0,
  totalPages: 0,
};

export function useJobsData(page: number = 1, limit: number = 5) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<JobsPaginationMeta>(EMPTY_META);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJobsByAPI(page, limit);
      setJobs(data.jobs ?? []);
      
      setMeta({
        total: data.total ?? 0,
        hasNext: data.hasNext ?? false,
        hasPrev: data.hasPrev ?? false,
        page: data.page ?? page,
        limit: data.limit ?? limit,
        totalPages: data.totalPages ?? 0,
      });
    } catch (err: unknown) {
      setJobs([]);
      setMeta(EMPTY_META);
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao carregar vagas.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!isMounted) return;
      await loadJobs();
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [loadJobs]);

  const triggerScraper = useCallback(async () => {
    setScraping(true);
    setError("");

    try {
      await runScraperRequest();
      await loadJobs();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao executar o scraper.",
      );
    } finally {
      setScraping(false);
    }
  }, [loadJobs]);

  return {
    jobs,
    meta,
    loading,
    scraping,
    error,
    loadJobs,
    triggerScraper,
  };
}
