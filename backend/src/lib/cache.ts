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

  const keys = keywords
    .map((kw) => {
      const normalized = kw
        .trim()
        .toLowerCase()
        .replace(/\//g, " ") // troca "/" por espaço, igual ao Go
        .replace(/\s+/g, " ") // colapsa múltiplos espaços em um
        .trim();

      return `scraper:jobs:keyword:${normalized}`;
    })
    .filter((key) => key !== "scraper:jobs:keyword:"); // descarta keywords vazias

  if (keys.length === 0) return [];
  if (keys.length === 1) return await client.sMembers(keys[0]);

  // SUNION → vagas que têm QUALQUER uma das keywords (OU)
  return await client.sUnion(keys);
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

export async function cachePing(): Promise<string> {
  const client = await getCache();
  return await client.ping();
}
