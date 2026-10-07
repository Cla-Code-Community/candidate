import { jobFilterOptionsController } from "../modules/jobs/controllers/jobFilterOptions.controller";
import { Router } from "express";
import { searchJobsController } from "../modules/jobs/controllers/searchJobs.controller";

export const jobsRoutes = Router();

jobsRoutes.get("/search", searchJobsController);

jobsRoutes.get("/filters/options", jobFilterOptionsController);
