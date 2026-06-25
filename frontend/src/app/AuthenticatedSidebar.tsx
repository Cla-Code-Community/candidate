import { useAuth } from "@/domains/auth/application/AuthContext";
import { cn } from "@/shared/lib/utils";
import {
  BriefcaseBusiness,
  ChartNoAxesColumn,
  Headphones,
  Home,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  activePaths: string[];
  exact?: boolean;
  showChevron?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Início",
    to: "/home",
    icon: Home,
    activePaths: ["/home"],
    exact: true,
  },
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: ChartNoAxesColumn,
    activePaths: ["/dashboard"],
  },
  {
    label: "Vagas",
    to: "/vagas",
    icon: BriefcaseBusiness,
    activePaths: ["/vagas"],
  },
  {
    label: "Mentoria",
    to: "/mentoria",
    icon: UsersRound,
    activePaths: ["/mentoria"],
  },
];

const sidebarItemClasses =
  "flex h-10 items-center gap-3 rounded-[5px] border text-sm tracking-[0.1px] transition-colors";

const inactiveSidebarItemClasses =
  "border-border/70 bg-card text-card-foreground hover:border-primary/35 hover:bg-muted dark:border-border/60 dark:bg-muted/15 dark:hover:bg-muted/35";

const activeSidebarItemClasses =
  "border-primary bg-primary font-bold text-primary-foreground shadow-sm shadow-primary/20";

function isRouteActive(pathname: string, item: NavigationItem) {
  return item.activePaths.some((activePath) => {
    if (pathname === activePath) return true;
    if (item.exact) return false;
    return pathname.startsWith(`${activePath}/`);
  });
}

function BrandLogo() {
  return (
    <p className="select-none whitespace-nowrap text-[32px] font-semibold leading-none text-foreground">
      <span className="text-[#8ecaff]">&lt;</span>
      <span>Cand</span>
      <span className="text-[#fea50b]">!</span>
      <span>Date</span>
      <span className="text-[#955dfc]">!</span>
      <span className="text-[#8ecaff]">&gt;</span>
    </p>
  );
}

export function AuthenticatedSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className="flex h-screen w-[249px] shrink-0 flex-col border-r border-border bg-card text-card-foreground shadow-[0_0_20px_rgba(0,0,0,0.04)] dark:shadow-[0_0_24px_rgba(0,0,0,0.22)]"
      aria-label="Menu lateral"
    >
      <div className="flex h-[103px] shrink-0 items-center px-[10px] pt-1">
        <BrandLogo />
      </div>

      <nav
        className="flex flex-1 flex-col gap-[22px] border-t border-dashed border-border/70 px-[13px] pt-[28px]"
        aria-label="Navegação principal"
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(location.pathname, item);

          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                sidebarItemClasses,
                "px-[13px]",
                isActive
                  ? activeSidebarItemClasses
                  : inactiveSidebarItemClasses,
              )}
            >
              <Icon
                className="h-6 w-6 shrink-0"
                strokeWidth={isActive ? 2.5 : 2.25}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col gap-[22px] border-t border-dashed border-border/70 px-[13px] pb-[29px] pt-[28px]">
        <button
          type="button"
          className={cn(
            sidebarItemClasses,
            inactiveSidebarItemClasses,
            "px-[8px] font-normal",
          )}
        >
          <UserRound className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          <span>Perfil</span>
        </button>
        <button
          type="button"
          className={cn(
            sidebarItemClasses,
            inactiveSidebarItemClasses,
            "px-[8px] font-normal",
          )}
        >
          <Headphones className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          <span>Ajuda</span>
        </button>
        <button
          type="button"
          className={cn(
            sidebarItemClasses,
            inactiveSidebarItemClasses,
            "px-[8px] font-normal",
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
