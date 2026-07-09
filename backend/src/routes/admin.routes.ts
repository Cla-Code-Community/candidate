import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  requirePermission,
  requireRole,
} from "../modules/admin/permissions/requireRole";
import {
  auditCtrl,
  observabilityCtrl,
  permissionsCtrl,
  scrapersCtrl,
  usersCtrl,
} from "./admin.context";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get(
  "/users",
  requirePermission("users", "read"),
  usersCtrl.listUsers.bind(usersCtrl),
);
router.get(
  "/users/:id",
  requirePermission("users", "read"),
  usersCtrl.getUserById.bind(usersCtrl),
);
router.patch(
  "/users/:id/block",
  requirePermission("users", "block"),
  usersCtrl.blockUser.bind(usersCtrl),
);
router.patch(
  "/users/:id/unblock",
  requirePermission("users", "unblock"),
  usersCtrl.unblockUser.bind(usersCtrl),
);
router.post(
  "/users/:id/reset",
  requirePermission("users", "reset_password"),
  usersCtrl.resetPassword.bind(usersCtrl),
);

router.post(
  "/scrapers/run",
  requirePermission("scrapers", "trigger"),
  scrapersCtrl.trigger.bind(scrapersCtrl),
);

router.get(
  "/observability/metrics",
  requirePermission("observability", "metrics"),
  observabilityCtrl.getMetrics.bind(observabilityCtrl),
);
router.get(
  "/observability/dashboards",
  requirePermission("observability", "metrics"),
  observabilityCtrl.getDashboards.bind(observabilityCtrl),
);

router.get(
  "/audit",
  requirePermission("audit", "read"),
  auditCtrl.getLogs.bind(auditCtrl),
);

router.get(
  "/permissions/rules",
  requirePermission("permissions", "read"),
  permissionsCtrl.listRules.bind(permissionsCtrl),
);

export default router;
