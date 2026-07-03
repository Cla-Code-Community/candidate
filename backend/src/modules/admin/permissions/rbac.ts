import {
  permissionMatrix,
  type Action,
  type Resource,
} from "./permissionMatrix";
import { ROLE_LEVEL, type Role } from "./roles";

export function can(role: Role, resource: Resource, action: Action): boolean {
  const minRole = permissionMatrix[resource]?.[action];

  // ação não definida na matriz = ninguém pode
  if (!minRole) return false;

  return ROLE_LEVEL[role] >= ROLE_LEVEL[minRole];
}
