import type { ReactNode } from "react";
import { JobsProvider } from "@/features/jobs/legacy/application/JobsContext";
import { ThemeProvider } from "@/app/dashboard/theme/ThemeContext";
import { ToastProvider } from "@/shared/feedback/ToastContext";

export function NewDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <JobsProvider>{children}</JobsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default NewDashboardLayout;
