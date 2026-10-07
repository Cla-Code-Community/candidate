import { randomUUID } from "node:crypto";
import { getCache, keywordSearchKeys } from "../../../lib/cache";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";
import { normalizeJobTaxonomy } from "../types/professionalTaxonomy";

export const activeIndexKey = "scraper:jobs:index-version";
export const searchGenerationKey = "jobs:search:generation";

// Snapshot only candidate IDs on the server, use lexical ZSET pagination and
// stream batches. All residual predicates run before final pagination/count.
// Expiration is checked with the catalog projection's expiresAt, not key TTL.
const candidatesScript = `
local prefix,groups,target,now=ARGV[1],cjson.decode(ARGV[2]),KEYS[2],tonumber(ARGV[3])
if redis.call('GET',KEYS[1])~=ARGV[4] then return redis.error_reply('index version changed') end
local temp={};local inputs={}
local priority=cjson.decode(ARGV[5]);local preferred=target..':preferred'
if #priority>0 then redis.call('SUNIONSTORE',preferred,unpack(priority));redis.call('EXPIRE',preferred,120) end
for i,group in ipairs(groups) do
 local key=target..':g'..i
 redis.call('SUNIONSTORE',key,unpack(group));redis.call('EXPIRE',key,120)
 table.insert(temp,key);table.insert(inputs,key)
end
local combined=target..':set'
if #inputs==0 then redis.call('SUNIONSTORE',combined,prefix..'index')
else redis.call('SINTERSTORE',combined,unpack(inputs)) end
redis.call('EXPIRE',combined,120)
local live=target..':live'
redis.call('ZRANGESTORE',live,prefix..'expires','('..now,'+inf','BYSCORE');redis.call('EXPIRE',live,120)
redis.call('ZINTERSTORE',target,2,combined,live,'WEIGHTS',0,0);redis.call('EXPIRE',target,120)
if #priority>0 then
 local overlap=target..':overlap'
 redis.call('ZINTERSTORE',overlap,2,target,preferred,'WEIGHTS',0,-1);redis.call('EXPIRE',overlap,120)
 redis.call('ZUNIONSTORE',target,2,target,overlap,'AGGREGATE','MIN');redis.call('EXPIRE',target,120)
 redis.call('DEL',overlap)
end
redis.call('DEL',combined,preferred,live)
for _,key in ipairs(temp) do redis.call('DEL',key) end
return redis.call('ZCARD',target)
`;

function keywordKeys(prefix: string, keywords: string[]): string[] {
  return keywordSearchKeys(keywords).map(
    (key) => prefix + key.slice("scraper:jobs:".length),
  );
}

export type IndexedSearch = {
  batches(): AsyncGenerator<unknown[]>;
  hydrate(ids: string[]): Promise<unknown[]>;
  rank(
    scores: { id: string; score: number }[],
    direction: "asc" | "desc",
  ): Promise<void>;
  rankedIds(offset: number, limit: number, total: number): Promise<string[]>;
  close(): Promise<void>;
};

export async function openIndexedSearch(
  filters: ParsedJobSearchQuery,
  priorityKeywords: string[] = [],
): Promise<IndexedSearch | null> {
  const client = await getCache();
  const version = await client.get(activeIndexKey);
  // Before the first validated rebuild, preserve PAV-124's exact fallback.
  if (!version) return null;
  const prefix = `scraper:jobs:ns:${version}:`;
  const key = `jobs:search:candidates:${randomUUID()}`;
  const groups: string[][] = [];
  if (filters.families.length)
    groups.push(
      filters.families.map(
        (family) =>
          `${prefix}family:${filters.familyMode === "primary" ? "primary:" : ""}${family}`,
      ),
    );
  if (filters.keywords.length)
    groups.push(keywordKeys(prefix, filters.keywords));
  // Existing non-family index inference differs from the HTTP predicate in
  // some aliases/locations. Verify these filters in bounded hydrated batches
  // instead of dropping valid jobs with an unsafe index intersection.
  let count: number;
  try {
    count = Number(
      await client.eval(candidatesScript, {
        keys: [activeIndexKey, key],
        arguments: [
          prefix,
          JSON.stringify(groups),
          String(Math.floor(Date.now() / 1000)),
          version,
          JSON.stringify(keywordKeys(prefix, priorityKeywords)),
        ],
      }),
    );
  } catch (error) {
    await client.del(key).catch(() => {});
    throw error;
  }
  return {
    async *batches() {
      for (let offset = 0; ; offset += 200) {
        const ids = await client.zRange(key, offset, offset + 199);
        if (!ids.length) {
          if (offset < count)
            throw new Error("Search candidate snapshot expired");
          return;
        }
        await client.expire(key, 120);
        const raws = await client.mGet(ids.map((id) => `${prefix}job:${id}`));
        const jobs: unknown[] = [];
        for (const raw of raws)
          if (raw) {
            try {
              jobs.push(normalizeJobTaxonomy(JSON.parse(raw)));
            } catch {
              /* invalid projection is reconciled by the Processor */
            }
          }
        yield jobs;
      }
    },
    async rank(scores, direction) {
      if (!scores.length) return;
      await client.zAdd(
        `${key}:rank`,
        scores.map((item) => ({
          value: item.id,
          score: direction === "desc" ? -item.score : item.score,
        })),
      );
      await client.expire(`${key}:rank`, 120);
    },
    async rankedIds(offset, limit, total) {
      if (total && (await client.zCard(`${key}:rank`)) !== total)
        throw new Error("Search ranking snapshot expired");
      return client.zRange(`${key}:rank`, offset, offset + limit - 1);
    },
    async hydrate(ids) {
      if (!ids.length) return [];
      const raws = await client.mGet(ids.map((id) => `${prefix}job:${id}`));
      return raws.map((raw) => {
        if (!raw)
          throw new Error("Search projection changed during ranking hydration");
        return normalizeJobTaxonomy(JSON.parse(raw));
      });
    },
    async close() {
      await client.del([key, `${key}:rank`]);
    },
  };
}

export async function hasActiveJobIndex(): Promise<boolean> {
  return Boolean(await (await getCache()).get(activeIndexKey));
}
