import { Router } from "express";
import { validate } from "../middleware/validate";
import { ResumeController } from "../modules/resume/resume.controller";
import { ResumeService } from "../modules/resume/resume.service";
import {
  generateResumeSchema,
  renderResumeSchema,
} from "../modules/resume/schemas/resume.schemas";

const router = Router();
const resumeService = new ResumeService();
const resumeController = new ResumeController(resumeService);

router.post(
  "/generate",
  validate({ body: generateResumeSchema }),
  (req, res, next) => {
    resumeController.generate(req, res).catch(next);
  },
);

router.post(
  "/analyze",
  validate({ body: generateResumeSchema }),
  (req, res, next) => {
    resumeController.analyze(req, res).catch(next);
  },
);

router.post(
  "/render",
  validate({ body: renderResumeSchema }),
  (req, res, next) => {
    resumeController.render(req, res).catch(next);
  },
);

export { router as resumeRoutes };
