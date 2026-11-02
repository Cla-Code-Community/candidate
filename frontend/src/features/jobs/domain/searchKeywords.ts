export function parseSearchKeywords(value: string) {
  return [...new Set(
    value
      .split(/[,\n;]+|\s{2,}/g)
      .flatMap((part) => part.trim().split(/\s+/g))
      .map((part) => part.trim())
      .filter(Boolean),
  )];
}
