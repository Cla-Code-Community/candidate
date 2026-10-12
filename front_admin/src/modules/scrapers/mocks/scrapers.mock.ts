import type { Scraper } from "../schemas/scraper.schema";

export const MOCK_SCRAPERS: Scraper[] = [
  { id: "linkedin", name: "LinkedIn Scraper", status: "Executando", lastRun: "2 min atrás", catalogJobs: 2543, active: true, availability: "99.9%" },
  { id: "infojobs", name: "InfoJobs Scraper", status: "Executando", lastRun: "1 min atrás", catalogJobs: 1872, active: true, availability: "100%" },
  { id: "glassdoor", name: "Glassdoor Scraper", status: "Executando", lastRun: "3 min atrás", catalogJobs: 1456, active: true, availability: "100%" },
  { id: "indeed", name: "Indeed Scraper", status: "Executando", lastRun: "1 min atrás", catalogJobs: 2850, active: true, availability: "100%" },
];
