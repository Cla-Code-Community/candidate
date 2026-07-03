import type { UserRole } from "../../../db/schema/users";

export type Role = UserRole;

export const ROLE_LEVEL: Record<Role, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}
