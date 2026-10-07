import { SavedJob } from "../../../db/schema";
import type { PublicUser } from "../../users/users.mapper";

export type TechnologyExperience = {
  name: string;
  years: number;
};

export type MatchableJob = {
  id?: string | null;
  title?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  location?: string | null;
  modality?: string | null;
  type?: string | null;
  level?: string | null;
  keyword?: string | null;
  keywords?: string[] | null;
  description?: string | null;
  url?: string | null;
  [key: string]: unknown;
};

export type MatchedJob = MatchableJob & {
  matchScore?: number;
  matchSource?: "backend_profile";
  matchedTechnologies?: string[];
  matchReasons?: string[];
};

function normalizeMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAliases(technology: string) {
  const normalized = normalizeMatchText(technology);
  const aliases = new Set([normalized]);

  if (normalized.endsWith(" js")) {
    aliases.add(normalized.replace(/\s+js$/, "js"));
  }
  if (normalized.endsWith("js") && normalized.length > 2) {
    aliases.add(normalized.replace(/js$/, " js"));
  }

  return [...aliases].filter(Boolean);
}

function textMatchesAlias(text: string, alias: string) {
  if (!alias) return false;
  if (alias.includes(" ")) return text.includes(alias);
  return ` ${text} `.includes(` ${alias} `);
}

function jobMatchText(job: MatchableJob) {
  const rawValues = Object.values(job).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );

  return normalizeMatchText(
    rawValues
      .map((value) => (typeof value === "string" ? value : ""))
      .join(" "),
  );
}

function parseTechnologiesFromUser(user: PublicUser): TechnologyExperience[] {
  const experiences = user.technologyExperiences;

  if (Array.isArray(experiences)) {
    return experiences
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const data = item as Record<string, unknown>;
        const name = typeof data.name === "string" ? data.name.trim() : "";
        const years = typeof data.years === "number" ? data.years : 1;
        return name ? { name, years: Math.max(0, years) } : null;
      })
      .filter((item): item is TechnologyExperience => Boolean(item));
  }

  return (user.technologies ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, years: 1 }));
}

export function getUserMatchTechnologies(user: PublicUser | undefined | null) {
  if (!user) return [];
  return parseTechnologiesFromUser(user);
}

export function scoreJobWithTechnologies(
  job: MatchableJob,
  technologies: TechnologyExperience[],
): MatchedJob {
  const normalizedTechnologies = [
    ...new Map(
      technologies
        .filter((technology) => technology.name.trim())
        .map((technology) => [
          normalizeMatchText(technology.name),
          {
            name: technology.name.trim(),
            years: Math.max(0, technology.years),
          },
        ]),
    ).values(),
  ];

  if (normalizedTechnologies.length === 0) return job;

  const text = jobMatchText(job);
  const matchedTechnologies = normalizedTechnologies.filter((technology) =>
    matchAliases(technology.name).some((alias) =>
      textMatchesAlias(text, alias),
    ),
  );

  const totalWeight = normalizedTechnologies.reduce(
    (total, technology) => total + Math.max(1, technology.years),
    0,
  );
  const matchedWeight = matchedTechnologies.reduce(
    (total, technology) => total + Math.max(1, technology.years),
    0,
  );
  const coverage = matchedWeight / totalWeight;
  const score =
    matchedTechnologies.length === 0
      ? 45
      : Math.min(
          99,
          55 +
            Math.round(coverage * 35) +
            Math.min(matchedTechnologies.length * 4, 9),
        );

  return {
    ...job,
    matchScore: score,
    matchSource: "backend_profile",
    matchedTechnologies: matchedTechnologies.map((item) => item.name),
  };
}

export function jobNotificationIdentity(job: MatchableJob | SavedJob) {
  const url =
    "url" in job && typeof job.url === "string"
      ? job.url
      : "jobLink" in job && typeof job.jobLink === "string"
        ? job.jobLink
        : "";
  return url.trim() || String(job.id ?? "");
}

export type MatchPreferences = {
  family?: string;
  seniority?: string;
  modality?: string;
  modalities?: string[];
  location?: string;
  contract?: string;
  skills?: TechnologyExperience[];
};

/** Only Product/Design use this additive evidence model. Missing development
 * languages never enter its denominator. Other families retain the old formula.
 * The current user model supplies level and named experiences; optional future
 * preferences are evaluated only when actually supplied by the backend.
 */
export function scoreProfessionalJob(
  job: MatchableJob,
  technologies: TechnologyExperience[],
  preferences: MatchPreferences = {},
): MatchedJob {
  const classification = job.classification as
    | { primaryFamily?: string; relatedFamilies?: string[]; seniority?: string }
    | undefined;
  const family = classification?.primaryFamily;
  if (family !== "product" && family !== "product_design")
    return scoreJobWithTechnologies(job, technologies);
  const text = jobMatchText(job);
  const vocabulary =
    family === "product"
      ? /\b(product|produto|discovery|roadmap|backlog|priorizacao|analytics|amplitude|mixpanel|jira|sql|agile|scrum|kanban|stakeholder|experimentos|estrategia)\b/
      : /\b(ux|ui|design|figma|sketch|adobe|pesquisa|research|prototipacao|prototype|acessibilidade|accessibility|wireframe|usabilidade|html|css)\b/;
  const relevant = [...technologies, ...(preferences.skills ?? [])].filter(
    (t) => vocabulary.test(normalizeMatchText(t.name)),
  );
  const normalizedSkills = new Map<string, TechnologyExperience>();
  for (const skill of relevant) {
    const key = normalizeMatchText(skill.name);
    const old = normalizedSkills.get(key);
    normalizedSkills.set(key, {
      name:
        old && old.name.localeCompare(skill.name.trim()) <= 0
          ? old.name
          : skill.name.trim(),
      years: Math.max(old?.years ?? 0, skill.years),
    });
  }
  const matched = [...normalizedSkills.values()]
    .filter((skill) =>
      matchAliases(skill.name).some((alias) => textMatchesAlias(text, alias)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const reasons: string[] = [];
  let evidence = 0;
  if (
    preferences.family &&
    (preferences.family === family ||
      classification?.relatedFamilies?.includes(preferences.family))
  ) {
    evidence += 15;
    reasons.push("família profissional compatível");
  }
  const predicates: [string | undefined, string | undefined | null, string][] =
    [
      [
        preferences.seniority,
        classification?.seniority ?? job.level,
        "senioridade compatível",
      ],
      [preferences.modality, job.modality ?? job.type, "modalidade compatível"],
      [preferences.location, job.location, "localização compatível"],
      [preferences.contract, text, "contrato compatível"],
    ];
  for (const [wanted, actual, reason] of predicates)
    if (
      wanted &&
      actual &&
      textMatchesAlias(normalizeMatchText(actual), normalizeMatchText(wanted))
    ) {
      evidence += 7;
      reasons.push(reason);
    }
  if (
    !preferences.modality &&
    preferences.modalities?.some((mode) =>
      textMatchesAlias(
        normalizeMatchText(job.modality ?? job.type ?? text)
          .replace(/\bremote\b/g, "remoto")
          .replace(/\bhybrid\b/g, "hibrido"),
        normalizeMatchText(mode),
      ),
    )
  ) {
    evidence += 7;
    reasons.push("modalidade compatível");
  }
  if (matched.length) {
    evidence += Math.min(
      30,
      matched.reduce(
        (sum, t) =>
          sum +
          (family === "product_design" &&
          /^(html|css)$/.test(normalizeMatchText(t.name))
            ? 2
            : 8 + Math.min(5, Math.max(0, t.years))),
        0,
      ),
    );
    reasons.push(
      family === "product"
        ? "competências e ferramentas de Produto relacionadas"
        : "competências e ferramentas de Design relacionadas",
    );
  }
  // Without profile evidence, do not invent a compatibility estimate.
  if (!evidence) return job;
  return {
    ...job,
    matchScore: Math.min(99, Math.round(55 + evidence)),
    matchSource: "backend_profile",
    matchedTechnologies: matched.map((t) => t.name),
    matchReasons: reasons,
  };
}
