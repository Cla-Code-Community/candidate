import { expect, it } from "vitest";
import type { GoScraperMocks, SearchJobs } from "./goScraper.TC.types";

interface TC04Deps {
  searchJobs: SearchJobs;
  mocks: GoScraperMocks;
}

export function TC04({ searchJobs, mocks }: TC04Deps) {
  it("deve falhar com parâmetros inválidos sem chamar o serviço externo", async () => {
    await expect(searchJobs({ keywords: [] })).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
}
