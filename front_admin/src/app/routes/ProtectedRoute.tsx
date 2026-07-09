import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "../../components/common/Loader";
import { useAuth } from "../../modules/auth/hooks/useAuth";
import type { Role } from "../../modules/auth/schemas/auth.schema";

const ROLE_HIERARCHY: Record<Role, number> = {
  user: -1,
  support: 0,
  admin: 1,
  super_admin: 2,
};

export function ProtectedRoute({ minRole }: { minRole: Role }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <Loader />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  if (ROLE_HIERARCHY[isLoggedIn.role] < ROLE_HIERARCHY[minRole]) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
