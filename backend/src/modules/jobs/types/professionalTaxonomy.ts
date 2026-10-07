// Mirrors internal/taxonomy/families.json; synchronization is checked in Go and backend tests.
export const taxonomyVersion = "v1";
export const professionalFamilies = [
  {
    "id": "backend",
    "label": "Backend"
  },
  {
    "id": "frontend",
    "label": "Frontend"
  },
  {
    "id": "fullstack",
    "label": "Full Stack"
  },
  {
    "id": "mobile",
    "label": "Mobile"
  },
  {
    "id": "data",
    "label": "Dados e IA"
  },
  {
    "id": "devops",
    "label": "DevOps"
  },
  {
    "id": "platform",
    "label": "Plataforma e Cloud"
  },
  {
    "id": "qa",
    "label": "QA e Testes"
  },
  {
    "id": "security",
    "label": "Segurança"
  },
  {
    "id": "product",
    "label": "Produto"
  },
  {
    "id": "product_design",
    "label": "Design de Produto"
  },
  {
    "id": "software",
    "label": "Engenharia de Software"
  },
  {
    "id": "leadership",
    "label": "Liderança Técnica"
  }
] as const;
export type ProfessionalFamily = (typeof professionalFamilies)[number]["id"];
export type DiagnosticFamily = ProfessionalFamily | "other";
export const historicalAliases: Readonly<Record<string, ProfessionalFamily>> = {
  dados: "data",
  infraestrutura: "devops",
};

export function isPublicFamily(value: unknown): value is ProfessionalFamily {
  return typeof value === "string" && professionalFamilies.some(f => f.id === value);
}

export function normalizeFamily(value: unknown): DiagnosticFamily | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().toLowerCase();
  const id = Object.prototype.hasOwnProperty.call(historicalAliases, raw)
    ? historicalAliases[raw]
    : raw;
  return isPublicFamily(id) || id === "other" ? id : undefined;
}

export function familyLabel(id: unknown): string | undefined {
  return professionalFamilies.find(f => f.id === id)?.label;
}

export function relatedFamilies(primary: unknown, values: unknown): ProfessionalFamily[] {
  const ids = new Set(Array.isArray(values) ? values.map(normalizeFamily) : []);
  return professionalFamilies
    .filter(f => ids.has(f.id) && f.id !== normalizeFamily(primary))
    .map(f => f.id);
}

// Normalize only classification metadata; preserve unrelated job fields and diagnostics.
export function normalizeJobTaxonomy(job: unknown): unknown {
  if (!job || typeof job !== "object" || !("classification" in job)) return job;
  const classification = job.classification;
  if (!classification || typeof classification !== "object" || Array.isArray(classification)) {
    return job;
  }
  const c = classification as Record<string, unknown>;
  const primaryFamily = normalizeFamily(c.primaryFamily) ?? "other";
  return {
    ...job,
    classification: {
      ...c,
      primaryFamily,
      relatedFamilies: relatedFamilies(primaryFamily, c.relatedFamilies),
      ...(primaryFamily === "other" ? { inScope: false } : {}),
    },
  };
}
