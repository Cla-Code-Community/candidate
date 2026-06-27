import { useAuth } from "@/domains/auth/application/AuthContext";
import { AuthenticatedLayout } from "@/app/AuthenticatedLayout";
import AuthCallbackPage from "@/domains/auth/presentation/pages/AuthCallbackPage";
import LoginPage from "@/domains/auth/presentation/pages/LoginPage";
import RegisterPage from "@/domains/auth/presentation/pages/RegisterPage";
import JobsPage from "@/domains/jobs/presentation/pages/JobsPage";
import LandingPage from "@/domains/marketing/presentation/pages/LandingPage";
import NotFound from "@/app/NotFound";
import Loading from "@/shared/ui/Loading";
import { Navigate, Route, Routes } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<JobsPage />} />
        <Route path="/dashboard" element={<NotFound />} />
        <Route path="/vagas" element={<JobsPage />} />
        <Route path="/mentoria" element={<NotFound />} />
      </Route>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
