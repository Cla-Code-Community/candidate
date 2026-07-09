import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  requirePermission,
  requireRole,
} from "../modules/admin/permissions/requireRole";
import { permissionsCtrl, usersCtrl } from "./admin.context";

const router = Router();

router.use(requireAuth, requireRole("super_admin"));

router.patch(
  "/users/:id/role",
  requirePermission("users", "change_role"),
  usersCtrl.changeRole.bind(usersCtrl),
);
router.delete(
  "/users/:id",
  requirePermission("users", "delete"),
  usersCtrl.deleteUser.bind(usersCtrl),
);

router.patch(
  "/permissions/rules",
  requirePermission("permissions", "manage"),
  permissionsCtrl.updateRules.bind(permissionsCtrl),
);

export default router;
