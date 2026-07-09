import { useEffect, useState } from "react";
import type { ScraperSummary } from "../schemas/scraper.schemas";
import { dashboardService } from "../services/dashboard.service";

/**
 * Resumo dos scrapers exibido no dashboard. Independente do estado usado
 * em modules/scrapers — cada um consulta o backend pela própria API.
 */
export function useDashboardScrapers() {
  const [scrapers, setScrapers] = useState<ScraperSummary[]>([]);

  useEffect(() => {
    let active = true;

    dashboardService
      .getScrapersSummary()
      .then((nextScrapers) => {
        if (active) setScrapers(nextScrapers);
      })
      .catch(() => {
        if (active) setScrapers([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleScraper = (id: string) => {
    const scraper = scrapers.find((item) => item.id === id);
    if (!scraper) return;

    dashboardService.toggleScraper(id, !scraper.active);
  };

  return { scrapers, toggleScraper };
}
