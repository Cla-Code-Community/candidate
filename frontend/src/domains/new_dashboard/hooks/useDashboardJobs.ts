import { useCallback, useEffect, useState } from "react";
import type { User } from "@/domains/auth/domain/auth.types";
import { isApiError } from "@/shared/lib/apiError";
import type { Job, JobStatus, NewJob } from "../types";
import {
  createDashboardSavedJob,
  getDashboardSavedJobs,
  searchDashboardJobs,
  type SearchJobFilters,
  type SearchJobsResult,
  updateDashboardSavedJob,
} from "../infrastructure/dashboardJobsApi";

interface UseDashboardJobsOptions {
  onError?: (message: string) => void;
}

const TRACKED_JOBS_CACHE_PREFIX = "new-dashboard-tracked-jobs";
const DEFAULT_RECOMMENDED_PAGINATION: SearchJobsResult["pagination"] = {
  total: 0,
  page: 1,
  limit: 50,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function trackedJobsCacheKey(userId: string) {
  return `${TRACKED_JOBS_CACHE_PREFIX}:${userId}`;
}

function readCachedTrackedJobs(userId: string): Job[] {
  try {
    const raw = window.localStorage.getItem(trackedJobsCacheKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedTrackedJobs(userId: string, jobs: Job[]) {
  window.localStorage.setItem(trackedJobsCacheKey(userId), JSON.stringify(jobs));
}

export function useDashboardJobs(
  user: User | null,
  { onError }: UseDashboardJobsOptions = {},
) {
  const [trackedJobs, setTrackedJobs] = useState<Job[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [recommendedPagination, setRecommendedPagination] = useState(
    DEFAULT_RECOMMENDED_PAGINATION,
  );
  const [lastRecommendationSearch, setLastRecommendationSearch] = useState<{
    keywords: string[];
    filters: SearchJobFilters;
  }>({ keywords: [], filters: {} });
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isRefreshingJobs, setIsRefreshingJobs] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!user) {
      setTrackedJobs([]);
      setRecommendedJobs([]);
      setRecommendedPagination(DEFAULT_RECOMMENDED_PAGINATION);
      setIsLoadingJobs(false);
      return;
    }

    setIsLoadingJobs(true);
    const cachedTrackedJobs = readCachedTrackedJobs(user.id);
    if (cachedTrackedJobs.length > 0) {
      setTrackedJobs(cachedTrackedJobs);
    }

    const [savedResult, recommendedResult] = await Promise.allSettled([
      getDashboardSavedJobs(),
      searchDashboardJobs([], {}, 1, DEFAULT_RECOMMENDED_PAGINATION.limit),
    ]);

    const loadedTrackedJobs =
      savedResult.status === "fulfilled" ? savedResult.value : null;
    const effectiveTrackedJobs =
      loadedTrackedJobs && loadedTrackedJobs.length > 0
        ? loadedTrackedJobs
        : cachedTrackedJobs;

    if (savedResult.status === "fulfilled") {
      setTrackedJobs(effectiveTrackedJobs);
      if (loadedTrackedJobs && loadedTrackedJobs.length > 0) {
        writeCachedTrackedJobs(user.id, loadedTrackedJobs);
      }
    }

    if (recommendedResult.status === "fulfilled") {
      const savedLinks = new Set(
        effectiveTrackedJobs.map((job) => job.jobLink),
      );
      setRecommendedJobs(
        recommendedResult.value.jobs.filter((job) => !savedLinks.has(job.jobLink)),
      );
      setRecommendedPagination(recommendedResult.value.pagination);
    }

    const errors: string[] = [];
    if (savedResult.status === "rejected") {
      errors.push("Não foi possível carregar suas candidaturas salvas.");
    }
    if (recommendedResult.status === "rejected") {
      errors.push("Não foi possível atualizar as vagas recomendadas.");
    }
    if (errors.length > 0) onError?.(errors.join(" "));

    setIsLoadingJobs(false);
  }, [onError, user]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!isMounted) return;
      await loadJobs();
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [loadJobs]);

  const refreshRecommendations = useCallback(
    async (
      keywords: string[],
      filters: SearchJobFilters = {},
      page = 1,
      limit = recommendedPagination.limit,
    ) => {
      setIsRefreshingJobs(true);
      try {
        setLastRecommendationSearch({ keywords, filters });
        const result = await searchDashboardJobs(keywords, filters, page, limit);
        const savedLinks = new Set(trackedJobs.map((job) => job.jobLink));
        setRecommendedJobs(
          result.jobs.filter((job) => !savedLinks.has(job.jobLink)),
        );
        setRecommendedPagination(result.pagination);
      } catch (error) {
        onError?.(
          errorMessage(error, "Não foi possível procurar novas vagas."),
        );
        throw error;
      } finally {
        setIsRefreshingJobs(false);
      }
    },
    [onError, recommendedPagination.limit, trackedJobs],
  );

  const changeRecommendationsPage = useCallback(
    async (page: number, limit = recommendedPagination.limit) => {
      await refreshRecommendations(
        lastRecommendationSearch.keywords,
        lastRecommendationSearch.filters,
        page,
        limit,
      );
    },
    [
      lastRecommendationSearch.filters,
      lastRecommendationSearch.keywords,
      recommendedPagination.limit,
      refreshRecommendations,
    ],
  );

  const addTrackedJob = useCallback(
    async (job: NewJob) => {
      if (!user) return null;

      try {
        const savedJob = await createDashboardSavedJob(job);
        setTrackedJobs((current) => {
          const next = [savedJob, ...current];
          writeCachedTrackedJobs(user.id, next);
          return next;
        });
        return savedJob;
      } catch (error) {
        if (isApiError(error) && error.status === 409) {
          const jobs = await getDashboardSavedJobs();
          setTrackedJobs(jobs);
          writeCachedTrackedJobs(user.id, jobs);
          return jobs.find((item) => item.jobLink === job.jobLink) ?? null;
        }

        onError?.(errorMessage(error, "Não foi possível salvar a vaga."));
        throw error;
      }
    },
    [onError, user],
  );

  const changeJobStatus = useCallback(
    async (jobId: string, status: JobStatus) => {
      if (!user) return null;

      const trackedJob = trackedJobs.find((job) => job.id === jobId);

      try {
        if (trackedJob) {
          const updated = await updateDashboardSavedJob(jobId, { status });
          setTrackedJobs((current) => {
            const next = current.map((job) =>
              job.id === jobId ? { ...job, ...updated } : job,
            );
            writeCachedTrackedJobs(user.id, next);
            return next;
          });
          return updated;
        }

        const recommendedJob = recommendedJobs.find((job) => job.id === jobId);
        if (!recommendedJob) return null;

        let savedJob: Job | null = null;
        try {
          savedJob = await createDashboardSavedJob(recommendedJob, status);
        } catch (error) {
          if (!(isApiError(error) && error.status === 409)) {
            throw error;
          }

          const jobs = await getDashboardSavedJobs();
          const existingJob = jobs.find(
            (job) => job.jobLink === recommendedJob.jobLink,
          );

          savedJob =
            existingJob && existingJob.status !== status
              ? await updateDashboardSavedJob(existingJob.id, { status })
              : existingJob ?? null;
        }

        if (!savedJob) return null;

        setRecommendedJobs((current) =>
          current.filter((job) => job.id !== jobId),
        );
        setTrackedJobs((current) => {
          const withoutDuplicate = current.filter(
            (job) => job.id !== savedJob.id && job.jobLink !== savedJob.jobLink,
          );
          const next = [savedJob, ...withoutDuplicate];
          writeCachedTrackedJobs(user.id, next);
          return next;
        });
        return savedJob;
      } catch (error) {
        onError?.(
          errorMessage(error, "Não foi possível atualizar a candidatura."),
        );
        throw error;
      }
    },
    [onError, recommendedJobs, trackedJobs, user],
  );

  const changeJobNotesLocally = useCallback(
    (jobId: string, notes: string) => {
      setTrackedJobs((current) => {
        const next = current.map((job) =>
          job.id === jobId ? { ...job, notes } : job,
        );
        if (user) writeCachedTrackedJobs(user.id, next);
        return next;
      });
      setRecommendedJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, notes } : job)),
      );
    },
    [user],
  );

  const saveJobNotes = useCallback(
    async (job: Job) => {
      const isTracked = trackedJobs.some((item) => item.id === job.id);
      if (!isTracked) return;

      try {
        await updateDashboardSavedJob(job.id, { notes: job.notes });
      } catch (error) {
        onError?.(errorMessage(error, "Não foi possível salvar as notas."));
        throw error;
      }
    },
    [onError, trackedJobs],
  );

  return {
    trackedJobs,
    recommendedJobs,
    recommendedPagination,
    isLoadingJobs,
    isRefreshingJobs,
    refreshRecommendations,
    changeRecommendationsPage,
    addTrackedJob,
    changeJobStatus,
    changeJobNotesLocally,
    saveJobNotes,
  };
}
