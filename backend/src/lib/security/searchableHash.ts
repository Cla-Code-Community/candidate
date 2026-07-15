import { createHmac, timingSafeEqual } from "node:crypto";

const SEARCH_HASH_ALGORITHM = "sha256";

function getSearchKey(): string {
  const key = process.env.SEARCH_KEY?.trim();

  if (!key) {
    throw new Error("SEARCH_KEY is required for searchable hashes");
  }

  return key;
}

export function generateSearchableHash(value: string): string {
  return createHmac(SEARCH_HASH_ALGORITHM, getSearchKey())
    .update(value)
    .digest("hex");
}

export function compareSearchableHash(value: string, hash: string): boolean {
  const candidate = Buffer.from(generateSearchableHash(value), "hex");
  const expected = Buffer.from(hash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
