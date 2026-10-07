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

type LocationRule = {
  country: string;
  continent: string;
  aliases: string[];
};


const LOCATION_RULES: LocationRule[] = [
  { country: "brasil", continent: "america do sul", aliases: ["brasil", "brazil", "br"] },
  {
    country: "estados unidos",
    continent: "america do norte",
    aliases: ["estados unidos", "united states", "usa", "us", "eua"],
  },
  { country: "canada", continent: "america do norte", aliases: ["canada"] },
  { country: "mexico", continent: "america do norte", aliases: ["mexico"] },
  { country: "argentina", continent: "america do sul", aliases: ["argentina"] },
  { country: "chile", continent: "america do sul", aliases: ["chile"] },
  { country: "colombia", continent: "america do sul", aliases: ["colombia"] },
  { country: "portugal", continent: "europa", aliases: ["portugal"] },
  { country: "espanha", continent: "europa", aliases: ["spain", "espanha", "espana"] },
  {
    country: "reino unido",
    continent: "europa",
    aliases: ["reino unido", "united kingdom", "uk", "england", "london"],
  },
  { country: "franca", continent: "europa", aliases: ["france", "franca"] },
  { country: "alemanha", continent: "europa", aliases: ["germany", "alemanha", "deutschland"] },
  {
    country: "paises baixos",
    continent: "europa",
    aliases: ["netherlands", "paises baixos", "holanda"],
  },
  { country: "india", continent: "asia", aliases: ["india"] },
  { country: "singapura", continent: "asia", aliases: ["singapore", "singapura"] },
  { country: "australia", continent: "oceania", aliases: ["australia"] },
  {
    country: "nova zelandia",
    continent: "oceania",
    aliases: ["new zealand", "nova zelandia"],
  },
  {
    country: "africa do sul",
    continent: "africa",
    aliases: ["south africa", "africa do sul"],
  },
];

const BRAZILIAN_STATES: Record<string, string[]> = {
  sp: ["sp", "sao paulo"],
  rj: ["rj", "rio de janeiro"],
  mg: ["mg", "minas gerais", "belo horizonte"],
  pr: ["pr", "parana", "curitiba"],
  sc: ["sc", "santa catarina", "florianopolis"],
  rs: ["rs", "rio grande do sul", "porto alegre"],
  ba: ["ba", "bahia", "salvador"],
  pe: ["pe", "pernambuco", "recife"],
  ce: ["ce", "ceara", "fortaleza"],
  df: ["df", "distrito federal", "brasilia"],
};

const KNOWN_CITIES = [
  "sao paulo",
  "rio de janeiro",
  "belo horizonte",
  "curitiba",
  "joinville",
  "florianopolis",
  "porto alegre",
  "salvador",
  "recife",
  "fortaleza",
  "brasilia",
  "lisboa",
  "porto",
  "madrid",
  "barcelona",
  "london",
  "paris",
  "berlin",
  "amsterdam",
  "toronto",
  "vancouver",
  "new york",
  "san francisco",
  "singapore",
  "sydney",
];

export type JobLocationParts = {
  country: string;
  continent: string;
  location: string;
  state: string;
  city: string;
};

export function inferJobLocationParts(location: string): JobLocationParts {
  const text = normalizeComparable(location);
  const parts: JobLocationParts = {
    country: "",
    continent: "",
    location: "",
    state: "",
    city: "",
  };

  if (!text) return parts;

  for (const rule of LOCATION_RULES) {
    if (containsAny(text, rule.aliases)) {
      parts.country = rule.country;
      parts.location = rule.country;
      parts.continent = rule.continent;
      break;
    }
  }

  if (!parts.continent && containsAny(text, ["remote", "remoto", "global", "worldwide"])) {
    parts.continent = "global remoto";
    parts.location = "global remoto";
  }

  for (const [state, aliases] of Object.entries(BRAZILIAN_STATES)) {
    if (containsAny(text, aliases)) {
      parts.state = state;
      if (!parts.country) {
        parts.country = "brasil";
        parts.location = "brasil";
        parts.continent = "america do sul";
      }
      break;
    }
  }

  const city = KNOWN_CITIES.find((candidate) => containsAny(text, [candidate]));
  if (city) parts.city = city;

  return parts;
}

function inferLocationCountry(location: string): string {
  return inferJobLocationParts(location).country;
}

function matchesLocationFilter(jobLocation: string, location: string): boolean {
  if (!location) return true;

  const normalizedLocation = normalizeComparable(jobLocation);
  const inferredCountry = inferLocationCountry(jobLocation);
  if (inferredCountry) return inferredCountry === location;

  return normalizedLocation.includes(location);
}

function inferJobContract(job: SearchJob): string {
  const text = normalizeComparable(
    [job.title, job.location, job.modality, job.description]
      .filter(Boolean)
      .join(" "),
  );

  if (containsAny(text, ["cooperado", "cooperativa"])) return "cooperado";
  if (
    containsAny(text, [
      "pj",
      "pessoa juridica",
      "contractor",
      "freelance",
      "freela",
    ])
  ) {
    return "pj";
  }
  if (containsAny(text, ["clt", "full time", "efetivo", "permanent"])) {
    return "clt";
  }

  return "";
}

function matchesLocationPart(
  inferred: string,
  jobLocation: string,
  value: string,
): boolean {
  if (!value) return true;
  if (inferred) return inferred === value;
  return normalizeComparable(jobLocation).includes(value);
}

export function filterJobs(
  jobs: unknown[],
  filters: ParsedJobSearchQuery,
): unknown[] {
  const level = normalizeLevelFilter(filters.level);
  const seniority = normalizeLevelFilter(filters.seniority);
  const location = normalizeComparable(filters.country || filters.location);
  const continent = normalizeComparable(filters.continent);
  const state = normalizeComparable(filters.state);
  const city = normalizeComparable(filters.city);
  const contract = normalizeComparable(filters.contract);
  const types = filters.type.map(normalizeComparable);
  const families = filters.families.map(normalizeComparable);
  const technologies = filters.technology.map(normalizeComparable);
  const companies = filters.company.map(normalizeComparable);

  if (
    !level &&
    !seniority &&
    !location &&
    !continent &&
    !state &&
    !city &&
    !contract &&
    types.length === 0 &&
    families.length === 0 &&
    technologies.length === 0 &&
    companies.length === 0
  ) {
    return jobs;
  }

  return jobs.filter((job) => {
    const candidate = job as SearchJob;
    const title = candidate.title ?? "";
    const jobLocation = candidate.location ?? "";
    const jobCompany = normalizeComparable(candidate.company ?? "");
    const classification = candidate.classification;
    const classifiedFamilies = [
      classification?.primaryFamily,
      ...(filters.familyMode === "any" ? classification?.relatedFamilies ?? [] : []),
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
    const locationParts = inferJobLocationParts(jobLocation);
    const matchesLocation = matchesLocationFilter(jobLocation, location);
    const matchesContinent = matchesLocationPart(
      locationParts.continent,
      jobLocation,
      continent,
    );
    const matchesState = matchesLocationPart(
      locationParts.state,
      jobLocation,
      state,
    );
    const matchesCity = matchesLocationPart(
      locationParts.city,
      jobLocation,
      city,
    );
    const matchesContract = !contract || inferJobContract(candidate) === contract;
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
    const matchesCompany =
      companies.length === 0 ||
      companies.some((company) => jobCompany.includes(company));

    return (
      matchesLevel &&
      matchesSeniority &&
      matchesLocation &&
      matchesContinent &&
      matchesState &&
      matchesCity &&
      matchesContract &&
      matchesType &&
      matchesFamily &&
      matchesTechnology &&
      matchesCompany
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
