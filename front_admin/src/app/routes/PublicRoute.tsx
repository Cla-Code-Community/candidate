import { Navigate, Outlet } from "react-router-dom";
import { Loader } from "../../components/common/Loader";
import { useAuth } from "../../modules/auth/hooks/useAuth";

export function PublicRoute() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <Loader />;
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
