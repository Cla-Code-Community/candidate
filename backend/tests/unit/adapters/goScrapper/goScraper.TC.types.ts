export interface GoScraperJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
}

export interface GoScraperValidParams {
  keywords: string[];
  location: string;
}

export interface GoScraperValidResponse {
  jobs: GoScraperJob[];
  total: number;
  cachedAt: string;
  fromCache: boolean;
}

export type SearchJobs = (params: {
  keywords: string[];
  location?: string;
}) => Promise<GoScraperValidResponse>;

export interface GoScraperMocks {
  logWarn: {
    mockClear: () => void;
  };
  fetch: {
    mockResolvedValueOnce: (value: unknown) => void;
    mockClear: () => void;
    mock: {
      calls: unknown[][];
    };
  };
}
