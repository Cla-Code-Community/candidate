import { AuthenticatedHeader } from "@/app/layouts/AuthenticatedHeader";
import { AuthenticatedSidebar } from "@/app/layouts/AuthenticatedSidebar";
import { Outlet } from "react-router-dom";

export function AuthenticatedLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AuthenticatedSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AuthenticatedHeader />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
