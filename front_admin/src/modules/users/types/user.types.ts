export type BackendUserRole = "user" | "support" | "admin" | "super_admin";
export type UserRole = "Super Admin" | "Admin" | "Suporte" | "Usuários";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  rawRole: BackendUserRole;
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  username: string | null;
}
