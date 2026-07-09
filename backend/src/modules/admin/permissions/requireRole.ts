import type { NextFunction, Request, Response } from "express";
import type { Action, Resource } from "./permissionMatrix";
import { permissionsService } from "./permissions.service";
import { ROLE_LEVEL, type Role } from "./roles";

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { userId, role } = req.session;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function requirePermission(resource: Resource, action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId, role } = req.session;

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    if (!(await permissionsService.can(role as Role, resource, action))) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
