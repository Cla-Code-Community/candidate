import { afterEach, beforeEach, describe, vi } from "vitest";
import { TC01 } from "./goScrapper/goScraper.TC01.ts";
import { TC02 } from "./goScrapper/goScraper.TC02.ts";
import { TC03 } from "./goScrapper/goScraper.TC03.ts";
import { TC04 } from "./goScrapper/goScraper.TC04.ts";
import { TC05 } from "./goScrapper/goScraper.TC05.ts";
import { TC06 } from "./goScrapper/goScraper.TC06.ts";

const mocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../../../src/logger.ts", () => ({
  logWarn: mocks.logWarn,
}));

import { searchJobs } from "../../../src/adapters/goScraper.ts";

const validParams = {
  keywords: ["Java", "Node.js"],
  location: "Brasil",
};

const validResponse = {
  jobs: [
    {
      id: "1",
      title: "Dev",
      company: "ACME",
      location: "Brasil",
      url: "https://example.com/job/1",
      source: "LinkedIn",
    },
  ],
  total: 1,
  cachedAt: "2026-01-01T00:00:00Z",
  fromCache: false,
};

describe("goScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  TC01({ searchJobs, validParams, validResponse, mocks });
  TC02({ searchJobs, validParams, mocks });
  TC03({ searchJobs, validParams, mocks });
  TC04({ searchJobs, mocks });
  TC05({ searchJobs, validResponse, mocks });
  TC06({ validParams, validResponse, mocks });
});
