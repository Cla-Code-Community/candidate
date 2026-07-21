import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { logger } from "../logger";

export const TTL = {
  PROFILE: 60 * 60, // 1 hora
  PREFERENCES: 60 * 60 * 24, // 24 horas
} as const;

const NS = "user:";

let _client: RedisClientType | null = null;

export async function getCache(): Promise<RedisClientType> {
  if (_client) return _client;

  const url = process.env.VALKEY_URL;
  if (!url) {
    throw new Error("VALKEY_URL environment variable is not set");
  }

  _client = createClient({ url }) as RedisClientType;

  _client.on("error", (err) => {
    logger.error({ err }, "Valkey client error");
  });

  _client.on("reconnecting", () => {
    logger.warn("Valkey reconnecting...");
  });

  await _client.connect();
  logger.info("Valkey connected (namespace: user:)");

  return _client;
}

export async function closeCache(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

function key(suffix: string): string {
  return `${NS}${suffix}`;
}

export async function cacheGet<T>(suffix: string): Promise<T | null> {
  const client = await getCache();
  const raw = await client.get(key(suffix));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function cacheSet(
  suffix: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const client = await getCache();
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  if (ttlSeconds > 0) {
    await client.set(key(suffix), serialized, { EX: ttlSeconds });
  } else {
    await client.set(key(suffix), serialized);
  }
}

export async function cacheDel(suffix: string): Promise<void> {
  const client = await getCache();
  await client.del(key(suffix));
}

export async function invalidateUser(userId: string): Promise<void> {
  await Promise.all([
    cacheDel(`profile:${userId}`),
    cacheDel(`preferences:${userId}`),
  ]);
}

/**
 * Busca todos os membros de um Set usando uma chave absoluta (sem o prefixo user:)
 */
export async function cacheAbsoluteSMembers(
  absoluteKey: string,
): Promise<string[]> {
  const client = await getCache();
  return await client.sMembers(absoluteKey);
}

export async function cacheAbsoluteSCard(absoluteKey: string): Promise<number> {
  const client = await getCache();
  return await client.sCard(absoluteKey);
}

/**
 * Realiza uma busca cruzada (Interseção) entre múltiplos índices de palavras-chave no Valkey.
 * Se apenas uma palavra-chave for enviada, retorna os membros dela diretamente.
 *
 * Normalização espelha o Go:
 *   "UX/UI Designer" → "ux ui designer" → chave: scraper:jobs:keyword:ux ui designer
 *   "UI"             → "ui"             → chave: scraper:jobs:keyword:ui
 */
export async function cacheSearchKeywords(
  keywords: string[],
): Promise<string[]> {
  const client = await getCache();

  const keys = keywordSearchKeys(keywords);

  if (keys.length === 0) return [];
  if (keys.length === 1) return await client.sMembers(keys[0]);

  // SUNION → vagas que têm QUALQUER uma das keywords (OU)
  return await client.sUnion(keys);
}

function normalizeIndexValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLevelIndexValue(value: string): string {
  const normalized = normalizeIndexValue(value);
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

function compactJsAlias(value: string): string {
  const match = value.match(/^([a-z0-9]+)\s+js(?:\s|$)/);
  return match ? `${match[1]}js` : "";
}

function splitJsAlias(value: string): string {
  const match = value.match(/^([a-z0-9]+)js$/);
  return match ? `${match[1]} js` : "";
}

function keywordIndexKeyVariants(keyword: string): string[] {
  const legacy = keyword
    .trim()
    .toLowerCase()
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = normalizeIndexValue(keyword);
  const variants = new Set<string>();

  for (const value of [
    legacy,
    normalized,
    compactJsAlias(normalized),
    splitJsAlias(normalized),
  ]) {
    if (value) variants.add(value);
  }

  for (const term of normalized.split(" ")) {
    if (term) variants.add(term);
  }

  return [...variants].map((value) => `scraper:jobs:keyword:${value}`);
}

function keywordSearchKeys(keywords: string[]): string[] {
  return [
    ...new Set(keywords.flatMap((keyword) => keywordIndexKeyVariants(keyword))),
  ].filter((key) => key !== "scraper:jobs:keyword:");
}

export type CacheJobIndexFilters = {
  keywords?: string[];
  level?: string;
  location?: string;
  continent?: string;
  country?: string;
  state?: string;
  city?: string;
  type?: string;
  model?: string;
  contract?: string;
};

export function cacheJobIndexKeys(filters: CacheJobIndexFilters): string[] {
  const entries: Array<[string, string | undefined]> = [
    ["level", filters.level],
    ["location", filters.location],
    ["continent", filters.continent],
    ["country", filters.country],
    ["state", filters.state],
    ["city", filters.city],
    ["model", filters.model ?? filters.type],
    ["contract", filters.contract],
  ];

  return entries
    .map(([kind, value]) => {
      const normalized =
        kind === "level"
          ? normalizeLevelIndexValue(value ?? "")
          : normalizeIndexValue(value ?? "");
      if (!normalized || normalized === "todos" || normalized === "all") {
        return "";
      }
      return `scraper:jobs:${kind}:${normalized}`;
    })
    .filter(Boolean);
}

export async function cacheSearchJobIds(
  filters: CacheJobIndexFilters,
): Promise<string[]> {
  const client = await getCache();
  const keywordKeys = keywordSearchKeys(filters.keywords ?? []);
  const filterKeys = cacheJobIndexKeys(filters);

  if (keywordKeys.length === 0 && filterKeys.length === 0) {
    return await client.sMembers("scraper:jobs:index");
  }

  if (keywordKeys.length === 0) {
    if (filterKeys.length === 1) return await client.sMembers(filterKeys[0]);
    return (await client.sendCommand(["SINTER", ...filterKeys])) as string[];
  }

  if (keywordKeys.length === 1) {
    const keys = [keywordKeys[0], ...filterKeys];
    if (keys.length === 1) return await client.sMembers(keys[0]);
    return (await client.sendCommand(["SINTER", ...keys])) as string[];
  }

  const tempKey = `scraper:jobs:search:${randomUUID()}`;

  try {
    await client.sendCommand(["SUNIONSTORE", tempKey, ...keywordKeys]);
    await client.expire(tempKey, 30);

    const keys = [tempKey, ...filterKeys];
    if (keys.length === 1) return await client.sMembers(keys[0]);
    return (await client.sendCommand(["SINTER", ...keys])) as string[];
  } finally {
    await client.del(tempKey);
  }
}

export async function cacheGetJobsByIds(ids: string[]): Promise<unknown[]> {
  const client = await getCache();

  if (ids.length === 0) return [];

  const keys = ids.map((id) => `scraper:job:${id}`);
  const results = await client.mGet(keys);

  return results
    .filter((raw): raw is string => raw !== null)
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function cacheDeleteByPattern(pattern: string): Promise<number> {
  const client = await getCache();
  let cursor = "0";
  let deleted = 0;

  do {
    const result = (await client.sendCommand([
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "500",
    ])) as [string, string[]];

    cursor = result[0];
    const keys = result[1] ?? [];
    if (keys.length > 0) {
      deleted += await client.del(keys);
    }
  } while (cursor !== "0");

  return deleted;
}

export async function cacheClearJobs(): Promise<{
  deleted: number;
  patterns: string[];
}> {
  const patterns = ["scraper:job:*", "scraper:jobs:*"];
  let deleted = 0;

  for (const pattern of patterns) {
    deleted += await cacheDeleteByPattern(pattern);
  }

  return { deleted, patterns };
}

export async function cachePing(): Promise<string> {
  const client = await getCache();
  return await client.ping();
}
