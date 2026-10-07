import { getCache } from "../../../lib/cache";
import { taxonomyVersion } from "../types/professionalTaxonomy";
import {
  JobSearchCache,
  type SearchCacheStore,
  type SearchPage,
} from "./jobSearchCache";

const generationScript = `
local version=redis.call('GET',KEYS[1]);if not version then return false end
local next=redis.call('ZRANGE','scraper:jobs:ns:'..version..':expires',0,0,'WITHSCORES')
local expiry=next[2] or '0'
-- Expired projection members require reconciliation; bypass caching meanwhile.
if tonumber(expiry)>0 and tonumber(expiry)<=tonumber(ARGV[1]) then return false end
return version..':'..(redis.call('GET',KEYS[2]) or '0')..':'..expiry..':'..ARGV[2]
`;
const writeScript = `
local expected,raw,ttl,now,taxonomy=ARGV[1],ARGV[2],tonumber(ARGV[3]),tonumber(ARGV[4]),ARGV[5]
local version=redis.call('GET',KEYS[1]);if not version then return 0 end
local next=redis.call('ZRANGE','scraper:jobs:ns:'..version..':expires',0,0,'WITHSCORES')
local expiry=next[2] or '0'
local actual=version..':'..(redis.call('GET',KEYS[2]) or '0')..':'..expiry..':'..taxonomy
if actual~=expected then return 0 end
if tonumber(expiry)>0 then ttl=math.min(ttl,tonumber(expiry)-now) end
if ttl<1 then return 0 end
redis.call('SET',KEYS[3],raw,'EX',ttl);return 1
`;
const generationKeys = ["scraper:jobs:index-version", "jobs:search:generation"];

export class ValkeySearchCacheStore implements SearchCacheStore {
  async generation(): Promise<string | null> {
    const client = await getCache();
    const result = await client.eval(generationScript, {
      keys: generationKeys,
      arguments: [String(Math.floor(Date.now() / 1000)), taxonomyVersion],
    });
    return typeof result === "string" ? result : null;
  }
  async read(key: string): Promise<SearchPage | null> {
    const raw = await (await getCache()).get(key);
    if (!raw) return null;
    const page = JSON.parse(raw);
    return Array.isArray(page.jobs) && Number.isInteger(page.total)
      ? page
      : null;
  }
  async writeIfGeneration(
    key: string,
    page: SearchPage,
    generation: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return (
      Number(
        await (
          await getCache()
        ).eval(writeScript, {
          keys: [...generationKeys, key],
          arguments: [
            generation,
            JSON.stringify(page),
            String(ttlSeconds),
            String(Math.floor(Date.now() / 1000)),
            taxonomyVersion,
          ],
        }),
      ) === 1
    );
  }
}

export const searchPageCache = new JobSearchCache(
  new ValkeySearchCacheStore(),
  Number(process.env.JOB_SEARCH_CACHE_TTL_SECONDS ?? 120),
);
