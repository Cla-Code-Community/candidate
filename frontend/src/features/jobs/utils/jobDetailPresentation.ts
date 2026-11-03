const labels: Record<string, string> = {
  id: "ID",
  title: "Título",
  company: "Empresa",
  location: "Local",
  url: "URL",
  salary: "Salário",
  modality: "Modalidade",
  description: "Descrição",
  source: "Fonte",
  sources: "Fontes",
  match: "Compatibilidade",
  matchScore: "Índice de compatibilidade",
  matchSource: "Origem da compatibilidade",
  keyword: "Palavra-chave",
  keywords: "Palavras-chave",
  matchedTechnologies: "Tecnologias correspondentes",
  matchReasons: "Justificativas da compatibilidade",
  postedAt: "Publicado em",
  publishedAt: "Publicado em",
  additionalDetails: "Detalhes adicionais",
  technologies: "Tecnologias",
  seniority: "Nível",
  country: "País",
  state: "Estado / Região",
  city: "Cidade",
  continent: "Continente",
};

export const jobDetailLabel = (key: string) => labels[key] ?? key;

/** Mantém o horário e o deslocamento fornecidos pela origem, sem conversão implícita. */
export function formatJobPublicationDate(value: unknown): string {
  if (typeof value !== "string") return "Data não informada";
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      value.trim(),
    );
  if (!match) return "Data não informada";
  const [, year, month, day, hour, minute, second, zone] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  )
    return "Data não informada";
  if (
    hour &&
    (Number(hour) > 23 ||
      Number(minute) > 59 ||
      Number(second || 0) > 59 ||
      (zone && Number.isNaN(Date.parse(value))))
  )
    return "Data não informada";
  return `${day}/${month}/${year}${hour ? ` às ${hour}:${minute}` : ""}`;
}

export function normalizeDescriptionText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function formatCompatibilityReason(value: string) {
  return value
    .replace(/^(?:titulo|título|title)\s*:/i, "Título:")
    .replace(/^technology\s*:/i, "Tecnologia:");
}
