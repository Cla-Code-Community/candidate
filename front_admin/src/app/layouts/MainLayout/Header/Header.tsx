import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "../../../../components/theme/ThemeToggle";
import { useAuth } from "../../../../modules/auth/hooks/useAuth";
import type { Role } from "../../../../modules/auth/schemas/auth.schema";
import { NotificationButton } from "./components/NotificationButton";
import { SearchBar } from "./components/SearchBar";
import { TimeFilter } from "./components/TimeFilter";
import { UserMenu } from "./components/UserMenu";
// import { CandidateLogo } from "../components/CandidateLogo";

interface HeaderProps {
  title: string;
  subtitle: string;
}

const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  support: "Suporte",
  admin: "Admin",
  super_admin: "Super Admin",
};

function getInitials(name: string): string {
  return name
    .split(/\s|\.|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Header do topo. É compartilhado por todas as páginas (Dashboard, Usuários,
 * Scrapers...), por isso vive no MainLayout — apenas título/subtítulo mudam por página.
 */
export function Header({ title, subtitle }: HeaderProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d">("24h");
  const { isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const userName = isLoggedIn?.name ?? "Usuário";
  const role = isLoggedIn ? ROLE_LABELS[isLoggedIn.role] : "";
  const initials = getInitials(userName) || "U";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="bg-white dark:bg-[#0f131a] border-b border-slate-100 dark:border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-10 theme-transition">
      <div className="flex items-center gap-8 flex-1">
        {/* <div className="hidden shrink-0 items-center border-r border-slate-200 pr-6 dark:border-slate-800 xl:flex">
          <CandidateLogo size="sm" />
        </div> */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
      </div>

      <div className="flex items-center gap-4">
        <TimeFilter value={timeFilter} onChange={setTimeFilter} />
        <ThemeToggle />
        <NotificationButton />
        <UserMenu
          name={userName}
          role={role}
          initials={initials}
          email={isLoggedIn?.email}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}
