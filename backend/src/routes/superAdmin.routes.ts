import { Router } from "express";
import { cacheClearJobs } from "../lib/cache";
import { requireAuth } from "../middleware/requireAuth";
import {
  requirePermission,
  requireRole,
} from "../modules/admin/permissions/requireRole";
import { logWarn } from "../logger";
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

router.delete("/jobs/cache", async (_req, res) => {
  try {
    const result = await cacheClearJobs();

    return res.json({
      ok: true,
      deleted: result.deleted,
      patterns: result.patterns,
    });
  } catch (error) {
    logWarn("Erro ao limpar cache de vagas no Valkey", {
      error: (error as Error).message,
    });

    return res.status(500).json({
      ok: false,
      message: "Erro ao limpar cache de vagas.",
      error: (error as Error).message,
    });
  }
});

export default router;
