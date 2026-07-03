import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  requirePermission,
  requireRole,
} from "../modules/admin/permissions/requireRole";
import {
  dashboardCtrl,
  observabilityCtrl,
  scrapersCtrl,
} from "./admin.context";

const router = Router();

router.use(requireAuth, requireRole("support"));

router.get(
  "/dashboard",
  requirePermission("dashboard", "read"),
  dashboardCtrl.getOverview.bind(dashboardCtrl),
);

router.get(
  "/scrapers",
  requirePermission("scrapers", "read"),
  scrapersCtrl.list.bind(scrapersCtrl),
);
router.get(
  "/scrapers/status",
  requirePermission("scrapers", "read"),
  scrapersCtrl.status.bind(scrapersCtrl),
);
router.get(
  "/scrapers/jobs",
  requirePermission("scrapers", "read"),
  scrapersCtrl.listJobs.bind(scrapersCtrl),
);
router.get(
  "/scrapers/jobs/count",
  requirePermission("scrapers", "read"),
  scrapersCtrl.jobsCount.bind(scrapersCtrl),
);

router.get(
  "/observability/health",
  requirePermission("observability", "health"),
  observabilityCtrl.getHealth.bind(observabilityCtrl),
);

export default router;
