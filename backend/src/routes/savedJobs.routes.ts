import { Router } from "express";
import { validate } from "../middleware/validate";
import { SavedJobsController } from "../modules/savedJobs/savedJobs.controller";
import { SavedJobsService } from "../modules/savedJobs/savedJobs.service";
import {
  createSavedJobSchema,
  savedJobParamsSchema,
  updateSavedJobSchema,
} from "../modules/savedJobs/schemas/savedJobs.schemas";

const router = Router();
const service = new SavedJobsService();
const controller = new SavedJobsController(service);

router.get("/", (req, res, next) => {
  controller.getAll(req, res).catch(next);
});
router.get(
  "/:id",
  validate({ params: savedJobParamsSchema }),
  (req, res, next) => {
    controller.getById(req, res).catch(next);
  },
);
router.post("/", validate({ body: createSavedJobSchema }), (req, res, next) => {
  controller.create(req, res).catch(next);
});
router.patch(
  "/:id",
  validate({ params: savedJobParamsSchema, body: updateSavedJobSchema }),
  (req, res, next) => {
    controller.update(req, res).catch(next);
  },
);
router.delete(
  "/:id",
  validate({ params: savedJobParamsSchema }),
  (req, res, next) => {
    controller.delete(req, res).catch(next);
  },
);

export { router as savedJobsRoutes };
