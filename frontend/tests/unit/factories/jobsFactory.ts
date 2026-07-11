import type { Job, JobsMeta } from "@/domains/jobs/domain/job.types";

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    title: "Frontend Developer",
    company: "ACME",
    location: "Remoto",
    keyword: "React",
    url: "https://example.com/job/1",
    source: "LinkedIn",
    ...overrides,
  };
}

export function makeJobsMeta(overrides: Partial<JobsMeta> = {}): JobsMeta {
  return {
    hasNext: false,
    hasPrev: false,
    limit: 5,
    page: 1,
    total: 1,
    totalPages: 1,
    ...overrides,
  };
}
