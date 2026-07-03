import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  requirePermission,
  requireRole,
} from "../modules/admin/permissions/requireRole";
import { usersCtrl } from "./admin.context";

const router = Router();

router.use(requireAuth, requireRole("super_admin"));

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
  "/users/:id/role",
  requirePermission("users", "change_role"),
  usersCtrl.changeRole.bind(usersCtrl),
);

export default router;
