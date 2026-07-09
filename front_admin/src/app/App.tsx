import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuditPage } from "../modules/audit/AuditPage";
import { LoginPage } from "../modules/auth/LoginPage";
import { DashboardPage } from "../modules/dashboard/DashboardPage";
import { ObservabilityPage } from "../modules/observability/ObservabilityPage";
import { PermissionsPage } from "../modules/permissions/PermissionsPage";
import { ScrapersPage } from "../modules/scrapers/ScrapersPage";
import { SettingsPage } from "../modules/settings/SettingsPage";
import { UsersPage } from "../modules/users/UsersPage";
import { Forbidden } from "./Forbidden";
import { MainLayout } from "./layouts/MainLayout";
import { NotFound } from "./NotFound";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicRoute } from "./routes/PublicRoute";
import { ROUTES } from "./routes/routes";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute minRole="support" />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route
              path={ROUTES.users}
              element={<UsersPage />}
            />
            <Route
              path={ROUTES.scrapers}
              element={<ScrapersPage />}
            />
            <Route
              path={ROUTES.observability}
              element={<ObservabilityPage />}
            />
            <Route
              path={ROUTES.audit}
              element={<AuditPage />}
            />
            <Route
              path={ROUTES.permissions}
              element={<PermissionsPage />}
            />
            <Route
              path={ROUTES.settings}
              element={<SettingsPage />}
            />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
