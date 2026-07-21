import { Router } from "express";
import { validate } from "../middleware/validate";
import { NotificationsController } from "../modules/notifications/notifications.controller";
import { NotificationsService } from "../modules/notifications/notifications.service";
import {
  listNotificationsQuerySchema,
  markAllNotificationsReadQuerySchema,
} from "../modules/notifications/schemas/notifications.schemas";

const router = Router();
const service = new NotificationsService();
const controller = new NotificationsController(service);

router.get(
  "/",
  validate({ query: listNotificationsQuerySchema }),
  (req, res, next) => {
    controller.list(req, res).catch(next);
  },
);

router.patch(
  "/read-all",
  validate({ query: markAllNotificationsReadQuerySchema }),
  (req, res, next) => {
    controller.markAllRead(req, res).catch(next);
  },
);

router.patch("/:id/read", (req, res, next) => {
  controller.markRead(req, res).catch(next);
});

export { router as notificationsRoutes };
