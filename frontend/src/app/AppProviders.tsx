import { AuthProvider } from "@/domains/auth/application/AuthContext";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}
