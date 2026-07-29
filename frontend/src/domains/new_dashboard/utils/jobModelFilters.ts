import type { Job, JobModelFilter, JobType } from "../types";

export const jobModelFilterOptions: Array<{
  value: JobModelFilter;
  label: string;
  types: JobType[];
}> = [
  { value: "Todos", label: "Todas as vagas", types: [] },
  { value: "Remoto", label: "Somente remotas", types: ["Remoto"] },
  { value: "Híbrido", label: "Somente híbridas", types: ["Híbrido"] },
  { value: "Presencial", label: "Somente presenciais", types: ["Presencial"] },
  {
    value: "RemotoHibrido",
    label: "Remotas e híbridas",
    types: ["Remoto", "Híbrido"],
  },
  {
    value: "RemotoPresencial",
    label: "Remotas e presenciais",
    types: ["Remoto", "Presencial"],
  },
  {
    value: "HibridoPresencial",
    label: "Híbridas e presenciais",
    types: ["Híbrido", "Presencial"],
  },
];

export function getJobTypesFromModelFilter(filterType: JobModelFilter) {
  return (
    jobModelFilterOptions.find((option) => option.value === filterType)
      ?.types ?? []
  );
}

export function getModelFilterFromJobTypes(jobTypes: JobType[]) {
  const normalized = [...new Set(jobTypes)].sort().join("|");

  return (
    jobModelFilterOptions.find(
      (option) => [...option.types].sort().join("|") === normalized,
    )?.value ?? "Todos"
  );
}

export function modelFilterMatchesJob(job: Job, filterType: JobModelFilter) {
  const jobTypes = getJobTypesFromModelFilter(filterType);
  return jobTypes.length === 0 || jobTypes.includes(job.type);
}

export function modelFilterToApiFilter(filterType: JobModelFilter) {
  const jobTypes = getJobTypesFromModelFilter(filterType);
  if (jobTypes.length === 0) return {};

  const type = jobTypes.join(",");
  return {
    type,
    model: type,
  };
}
