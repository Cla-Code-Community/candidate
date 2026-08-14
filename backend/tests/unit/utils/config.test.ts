import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../../../src/config.js";

const CONFIG_ENV_KEYS = [
  "HEADLESS",
  "WAIT_BETWEEN_SEARCHES_MS",
  "PAGE_TIMEOUT_MS",
  "MAX_PAGES_PER_KEYWORD",
  "VIEWPORT_WIDTH",
  "VIEWPORT_HEIGHT",
  "SEARCH_LOCATION",
  "SEARCH_GEO_ID",
  "SEARCH_LANGUAGE",
  "REMOTE_ONLY",
  "JOB_TYPES",
  "TIME_FILTER",
  "DATABASE_URL",
  "VALKEY_URL",
];

describe("getConfig", () => {
  beforeEach(() => {
    for (const key of CONFIG_ENV_KEYS) {
      vi.stubEnv(key, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna searchLocation padrão quando env não definido", () => {
    const config = getConfig();
    expect(config.searchLocation).toBe("Brasil");
  });

  it("permite sobrescrever searchLocation via env", () => {
    vi.stubEnv("SEARCH_LOCATION", "Portugal");
    const config = getConfig();
    expect(config.searchLocation).toBe("Portugal");
  });

  it("rejeita TIME_FILTER invalido e usa fallback", () => {
    vi.stubEnv("TIME_FILTER", "invalid");
    const config = getConfig();
    expect(config.timeFilter).toBe("r604800");
  });

  it("aceita TIME_FILTER no formato r + digitos", () => {
    vi.stubEnv("TIME_FILTER", "r86400");
    const config = getConfig();
    expect(config.timeFilter).toBe("r86400");
  });

  it("parseia booleans validos e numericos positivos", () => {
    vi.stubEnv("HEADLESS", "true");
    vi.stubEnv("REMOTE_ONLY", "off");
    vi.stubEnv("WAIT_BETWEEN_SEARCHES_MS", "250");
    vi.stubEnv("PAGE_TIMEOUT_MS", "500");
    vi.stubEnv("MAX_PAGES_PER_KEYWORD", "3");
    vi.stubEnv("VIEWPORT_WIDTH", "1440");
    vi.stubEnv("VIEWPORT_HEIGHT", "900");

    const config = getConfig();

    expect(config.headless).toBe(true);
    expect(config.remoteOnly).toBe(false);
    expect(config.waitBetweenSearchesMs).toBe(250);
    expect(config.pageTimeoutMs).toBe(500);
    expect(config.maxPagesPerKeyword).toBe(3);
    expect(config.viewport).toEqual({ width: 1440, height: 900 });
  });

  it("faz fallback quando boolean e numero sao invalidos", () => {
    vi.stubEnv("HEADLESS", "talvez");
    vi.stubEnv("REMOTE_ONLY", "desconhecido");
    vi.stubEnv("WAIT_BETWEEN_SEARCHES_MS", "0");
    vi.stubEnv("PAGE_TIMEOUT_MS", "abc");
    vi.stubEnv("MAX_PAGES_PER_KEYWORD", "-1");

    const config = getConfig();

    expect(config.headless).toBe(false);
    expect(config.remoteOnly).toBe(false);
    expect(config.waitBetweenSearchesMs).toBe(5000);
    expect(config.pageTimeoutMs).toBe(10000);
    expect(config.maxPagesPerKeyword).toBe(5);
  });

  it("retorna viewport padrão quando env não definido", () => {
    const config = getConfig();
    expect(config.viewport).toEqual({ width: 1280, height: 800 });
  });

  it("retorna searchGeoId e searchLanguage padrão", () => {
    const config = getConfig();
    expect(config.searchGeoId).toBe("106057199");
    expect(config.searchLanguage).toBe("pt");
  });

  it("retorna remoteOnly false e jobTypes padrão", () => {
    const config = getConfig();
    expect(config.remoteOnly).toBe(false);
    expect(config.jobTypes).toBe("C,F");
  });

  it("retorna databaseUrl e valkeyUrl vazios quando env não definido", () => {
    const config = getConfig();
    expect(config.databaseUrl).toBe("");
    expect(config.valkeyUrl).toBe("");
  });
});
