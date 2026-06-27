import { useAuth } from "@/domains/auth/application/AuthContext";
import { useTheme } from "@/shared/hooks/useTheme";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { Bell, Mail } from "lucide-react";
import { useLocation } from "react-router-dom";

const routeTitles: Array<{ path: string; title: string; exact?: boolean }> = [
  { path: "/home", title: "Início", exact: true },
  { path: "/vagas", title: "Vagas" },
  { path: "/mentoria", title: "Mentoria" },
];

function getHeaderTitle(pathname: string) {
  const matchedRoute = routeTitles.find((route) => {
    if (pathname === route.path) return true;
    if (route.exact) return false;
    return pathname.startsWith(`${route.path}/`);
  });

  return matchedRoute?.title ?? "Início";
}

function getInitials(value: string) {
  const normalized = value.trim();
  if (!normalized) return "U";

  const [first = "", second = ""] = normalized
    .replace(/@.*/, "")
    .split(/\s|[._-]/)
    .filter(Boolean);

  return `${first[0] ?? ""}${second[0] ?? first[1] ?? ""}`.toUpperCase();
}

export function AuthenticatedHeader() {
  const { user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const location = useLocation();

  const displayName =
    user?.name || user?.displayName || user?.email || "Usuário";
  const title = getHeaderTitle(location.pathname);
  const initials = getInitials(displayName);

  return (
    <header className="flex h-[103px] shrink-0 items-center justify-between border-b border-border bg-card px-6 text-card-foreground shadow-[0_8px_18px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)] md:px-[43px]">
      <h1 className="truncate text-[32px] font-bold leading-[1.5] text-foreground">
        {title}
      </h1>

      <div className="flex shrink-0 items-center gap-[17px]">
        <ThemeToggle theme={resolvedTheme} onToggle={toggleTheme} />
        <button
          type="button"
          className="flex size-6 items-center justify-center text-foreground transition-colors hover:text-primary"
          aria-label="Mensagens"
        >
          <Mail className="size-4" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          className="flex size-6 items-center justify-center text-foreground transition-colors hover:text-primary"
          aria-label="Notificações"
        >
          <Bell className="size-4" strokeWidth={2.4} />
        </button>
        <div
          className="flex size-8 items-center justify-center rounded-full bg-[#8fb3a0] text-base font-semibold leading-6 text-primary dark:bg-primary/30 dark:text-primary-foreground"
          aria-label={displayName}
          title={displayName}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
