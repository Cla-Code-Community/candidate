import type { Job, JobsMeta } from "@/domains/jobs/domain/job.types";

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    titulo: "Frontend Developer",
    empresa: "ACME",
    local: "Remoto",
    palavra: "React",
    link: "https://example.com/job/1",
    source: "LinkedIn",
    ...overrides,
  };
}

export function makeJobsMeta(overrides: Partial<JobsMeta> = {}): JobsMeta {
  return {
    file: "vagas.xlsx",
    modifiedAt: 1710000000000,
    total: 1,
    ...overrides,
  };
}
