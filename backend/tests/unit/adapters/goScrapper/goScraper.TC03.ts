import { expect, it } from "vitest";
import type {
    GoScraperMocks,
    GoScraperValidParams,
    SearchJobs,
} from "./goScraper.TC.types";

interface TC03Deps {
  searchJobs: SearchJobs;
  validParams: GoScraperValidParams;
  mocks: GoScraperMocks;
}

export function TC03({ searchJobs, validParams, mocks }: TC03Deps) {
  it("deve rejeitar resposta inválida e registrar aviso de contrato", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: "data" }),
    });

    await expect(searchJobs(validParams)).rejects.toThrow(
      "Go scraper: resposta invalida",
    );
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "Go scraper: resposta fora do contrato",
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
}
