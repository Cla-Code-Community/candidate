import type { Request } from "express";
import type { TechnologyExperience } from "../services/jobMatch.service";

export type SearchJob = {
  id?: string;
  title?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  modality?: string | null;
  description?: string | null;
  matchScore?: number | null;
  classification?: {
    primaryFamily?: string | null;
    relatedFamilies?: string[] | null;
    technologies?: string[] | null;
    seniority?: string | null;
  } | null;
};

export type MatchTechnology = TechnologyExperience;

export type MatchSort = "asc" | "desc" | null;

export type ParsedJobSearchQuery = {
  keywords: string[];
  family: string[];
  technology: string[];
  type: string[];
  level: string;
  seniority: string;
  location: string;
  continent: string;
  country: string;
  state: string;
  city: string;
  contract: string;
  matchSort: MatchSort;
};

export type SearchJobsInput = {
  query: Request["query"];
  userId?: string;
};

export type SearchJobsResult = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  jobs: unknown[];
  source: string;
};
