export interface Job {
  keyword?: string | null;
  keywords?: string[] | null;
  title?: string | null;
  company?: string | null;
  source?: string | null;
  sources?: string[] | null;
  location?: string | null;
  url?: string | null;
}

export interface JobsMeta {
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface JobsResponse extends JobsMeta {
  jobs: Job[];
}
