import type { Job } from "@/domains/jobs/domain/job.types";

export function normalizeComparableText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeComparableLink(value?: string | null) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawValue);
    parsedUrl.search = "";
    parsedUrl.hash = "";
    return `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/+$/, "");
  } catch {
    return rawValue.split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

export function splitJobKeywords(job: Job) {
  return [
    ...new Set(
      [
        ...(Array.isArray(job.keywords) ? job.keywords : []),
        ...String(job.palavra || "")
          .split(/[,;|]+/)
          .map((keyword) => keyword.trim()),
      ].filter(Boolean),
    ),
  ];
}

function pickPreferredValue(...values: Array<string | null | undefined>) {
  return (
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .sort((left, right) => right.length - left.length)[0] || ""
  );
}

export function buildDedupKey(job: Job) {
  const title = normalizeComparableText(job.titulo);
  const company = normalizeComparableText(job.empresa);
  const location = normalizeComparableText(job.local);

  if (title && company && location) {
    return `identity:${title}|${company}|${location}`;
  }

  if (title && company) {
    return `identity:${title}|${company}|${location || "sem-local"}`;
  }

  const link = normalizeComparableLink(job.link);

  if (link) {
    return `url:${link}`;
  }

  return `fallback:${title}|${company}|${location}|${normalizeComparableText(job.source)}`;
}

export function dedupeJobs(jobs: Job[]) {
  const unique = new Map<string, Job>();

  for (const job of jobs) {
    const key = buildDedupKey(job);
    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, {
        ...job,
        palavra: splitJobKeywords(job).join(", "),
      });
      continue;
    }

    const mergedKeywords = [
      ...new Set([...splitJobKeywords(existing), ...splitJobKeywords(job)]),
    ];
    const mergedSources = [
      ...new Set(
        [
          ...(existing.sources ?? []),
          ...(job.sources ?? []),
          existing.source,
          job.source,
        ]
          .map((source) => String(source || "").trim())
          .filter(Boolean),
      ),
    ];

    unique.set(key, {
      ...existing,
      ...job,
      titulo: pickPreferredValue(existing.titulo, job.titulo),
      empresa: pickPreferredValue(existing.empresa, job.empresa),
      local: pickPreferredValue(existing.local, job.local),
      link: pickPreferredValue(existing.link, job.link),
      source: mergedSources.join(", ") || existing.source || job.source || "",
      palavra: mergedKeywords.join(", "),
      keywords: mergedKeywords,
      sources: mergedSources.length > 0 ? mergedSources : undefined,
    });
  }

  return [...unique.values()];
}

export function getAvailableKeywords(jobs: Job[]) {
  const values = Array.from(
    new Set(jobs.flatMap((job) => splitJobKeywords(job))),
  );
  return values.sort((a, b) => a.localeCompare(b));
}

function getSearchTerms(search: string) {
  return search
    .split(/[,;/]+/)
    .map((term) => normalizeComparableText(term))
    .filter(Boolean);
}

export function filterJobs(
  jobs: Job[],
  search: string,
  keywordFilter: string[],
) {
  const terms = getSearchTerms(search);

  return jobs.filter((job) => {
    const currentKeywords = splitJobKeywords(job);
    const byKeyword =
      keywordFilter.length === 0 ||
      keywordFilter.some((keyword) => currentKeywords.includes(keyword));

    if (!byKeyword) {
      return false;
    }

    if (terms.length === 0) {
      return true;
    }

    const text = normalizeComparableText(
      [
        job.titulo,
        job.empresa,
        job.local,
        job.link,
        job.palavra,
        ...(job.keywords || []),
      ].join(" "),
    );

    return terms.every((term) => text.includes(term));
  });
}
