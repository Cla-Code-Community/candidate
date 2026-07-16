import type { ReactNode } from "react";
import { JobsProvider } from "./context/JobsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";

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
