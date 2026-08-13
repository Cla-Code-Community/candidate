import type {
  ParsedJobSearchQuery,
  SearchJob,
} from "../types/jobSearch.types";

export function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLevelFilter(value: string): string {
  const normalized = normalizeComparable(value);
  if (
    normalized === "estagio trainee" ||
    normalized === "estagio" ||
    normalized === "trainee" ||
    normalized === "intern" ||
    normalized === "internship"
  ) {
    return "estagio";
  }
  return normalized;
}

function containsTokenOrPhrase(text: string, needle: string): boolean {
  if (needle.includes(" ")) return text.includes(needle);
  return ` ${text} `.includes(` ${needle} `);
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => containsTokenOrPhrase(text, needle));
}

function inferJobLevel(title: string): string {
  const normalized = normalizeComparable(title);
  if (
    containsAny(normalized, [
      "estagio",
      "estagiario",
      "intern",
      "internship",
      "trainee",
      "aprendiz",
    ])
  ) {
    return "estagio";
  }
  if (
    containsAny(normalized, [
      "senior",
      "sr",
      "especialista",
      "lead",
      "principal",
      "staff",
    ])
  ) {
    return "senior";
  }
  if (containsAny(normalized, ["junior", "jr", "entry level", "assistente"])) {
    return "junior";
  }
  return "pleno";
}

function inferJobType(job: SearchJob): string {
  const normalized = normalizeComparable(
    [job.title, job.location, job.modality, job.description]
      .filter(Boolean)
      .join(" "),
  );

  if (normalized.includes("hibrid") || normalized.includes("hybrid")) {
    return "hibrido";
  }
  if (
    normalized.includes("remot") ||
    normalized.includes("home office") ||
    normalized.includes("teletrabalho") ||
    normalized.includes("anywhere") ||
    normalized.includes("worldwide")
  ) {
    return "remoto";
  }
  if (
    normalized.includes("presencial") ||
    normalized.includes("onsite") ||
    normalized.includes("on site") ||
    normalized.includes("on-site") ||
    normalized.includes("in office") ||
    normalized.includes("escritorio")
  ) {
    return "presencial";
  }

  return "presencial";
}

function inferLocationCountry(location: string): string {
  const normalized = normalizeComparable(location);
  if (!normalized) return "";

  if (
    containsAny(normalized, [
      "estados unidos",
      "united states",
      "usa",
      "eua",
      "florida",
      "miami",
      "new york",
      "california",
      "texas",
      "boston",
      "seattle",
      "chicago",
      "atlanta",
      "denver",
    ])
  ) {
    return "estados unidos";
  }

  if (
    containsAny(normalized, [
      "brasil",
      "brazil",
      "sao paulo",
      "rio de janeiro",
      "minas gerais",
      "belo horizonte",
      "parana",
      "curitiba",
      "santa catarina",
      "joinville",
      "rio grande do sul",
      "porto alegre",
      "pernambuco",
      "recife",
      "bahia",
      "salvador",
      "ceara",
      "fortaleza",
      "piaui",
      "teresina",
    ])
  ) {
    return "brasil";
  }

  if (containsAny(normalized, ["portugal", "lisboa", "porto"])) {
    return "portugal";
  }

  return "";
}

function matchesLocationFilter(jobLocation: string, location: string): boolean {
  if (!location) return true;

  const normalizedLocation = normalizeComparable(jobLocation);
  const inferredCountry = inferLocationCountry(jobLocation);
  if (inferredCountry) return inferredCountry === location;

  return normalizedLocation.includes(location);
}

export function filterJobs(
  jobs: unknown[],
  filters: ParsedJobSearchQuery,
): unknown[] {
  const level = normalizeLevelFilter(filters.level);
  const seniority = normalizeLevelFilter(filters.seniority);
  const location = normalizeComparable(filters.country || filters.location);
  const types = filters.type.map(normalizeComparable);
  const families = filters.family.map(normalizeComparable);
  const technologies = filters.technology.map(normalizeComparable);

  if (
    !level &&
    !seniority &&
    !location &&
    types.length === 0 &&
    families.length === 0 &&
    technologies.length === 0
  ) {
    return jobs;
  }

  return jobs.filter((job) => {
    const candidate = job as SearchJob;
    const title = candidate.title ?? "";
    const jobLocation = candidate.location ?? "";
    const classification = candidate.classification;
    const classifiedFamilies = [
      classification?.primaryFamily,
      ...(classification?.relatedFamilies ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalizeComparable(String(value)));
    const classifiedTechnologies = (classification?.technologies ?? [])
      .filter(Boolean)
      .map((value) => normalizeComparable(String(value)));
    const classifiedSeniority = normalizeLevelFilter(
      classification?.seniority ?? "",
    );

    const matchesLevel = !level || inferJobLevel(title) === level;
    const matchesSeniority =
      !seniority ||
      classifiedSeniority === seniority ||
      inferJobLevel(title) === seniority;
    const matchesLocation = matchesLocationFilter(jobLocation, location);
    const matchesType =
      types.length === 0 || types.includes(inferJobType(candidate));
    const matchesFamily =
      families.length === 0 ||
      families.some((family) => classifiedFamilies.includes(family));
    const matchesTechnology =
      technologies.length === 0 ||
      technologies.some((technology) =>
        classifiedTechnologies.includes(technology),
      );

    return (
      matchesLevel &&
      matchesSeniority &&
      matchesLocation &&
      matchesType &&
      matchesFamily &&
      matchesTechnology
    );
  });
}

export function sortJobsByMatch<T>(
  jobs: T[],
  direction: "asc" | "desc",
): T[] {
  return [...jobs].sort((first, second) => {
    const firstJob = first as { matchScore?: number | null };
    const secondJob = second as { matchScore?: number | null };
    const firstScore =
      typeof firstJob.matchScore === "number" ? firstJob.matchScore : 0;
    const secondScore =
      typeof secondJob.matchScore === "number" ? secondJob.matchScore : 0;

    return direction === "desc"
      ? secondScore - firstScore
      : firstScore - secondScore;
  });
}
