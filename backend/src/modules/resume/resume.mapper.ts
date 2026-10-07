import type { PublicUser } from "../users/users.mapper";
import type { NormalizedProfile } from "./resume.types";

type TechExperience = { name: string; years: number };

function isTechExperience(value: unknown): value is TechExperience {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TechExperience).name === "string" &&
    typeof (value as TechExperience).years === "number"
  );
}

function resolveName(user: PublicUser): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  const full = [user.firstName, user.lastName]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .trim();
  if (full) return full;
  if (user.username?.trim()) return user.username.trim();
  return "Candidato";
}

/**
 * Maps the candidate's decrypted profile (the `users` row) into the normalized
 * profile the ats-forge engine consumes. Only data the candidate actually
 * provided is forwarded — every field is tagged `source: "candidate"` and
 * nothing is fabricated (integration spec §7).
 */
export function toNormalizedProfile(user: PublicUser): NormalizedProfile {
  const techExperiences: TechExperience[] = Array.isArray(user.technologyExperiences)
    ? user.technologyExperiences.filter(isTechExperience)
    : [];
  const yearsByTech = new Map(
    techExperiences.map((t) => [t.name.toLowerCase(), t.years]),
  );

  const technologies = Array.isArray(user.technologies) ? user.technologies : [];

  const skills: NormalizedProfile["skills"] = technologies.map((name) => ({
    name,
    years: yearsByTech.get(name.toLowerCase()),
    category: "Competências",
    source: "candidate" as const,
  }));

  // Include tech experiences that are not already covered by `technologies`.
  for (const te of techExperiences) {
    if (!technologies.some((t) => t.toLowerCase() === te.name.toLowerCase())) {
      skills.push({
        name: te.name,
        years: te.years,
        category: "Competências",
        source: "candidate",
      });
    }
  }

  return {
    name: resolveName(user),
    headline: user.level?.trim() || undefined,
    // Summary intentionally omitted: the engine derives an honest summary from
    // the candidate's own evidence instead of inventing one.
    contact: {
      email: user.email?.trim() || undefined,
      phone: user.phone?.trim() || undefined,
    },
    experience: [],
    education: [],
    skills,
    projects: [],
    links: [],
    languages: [],
  };
}
