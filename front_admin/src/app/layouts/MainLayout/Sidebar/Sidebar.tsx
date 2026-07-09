import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../modules/auth/hooks/useAuth";
import { CandidateLogo } from "../components/CandidateLogo";
import { SidebarFooter } from "./components/SidebarFooter";
import { SidebarItem } from "./components/SidebarItem";
import { NAV_ITEMS } from "./sidebar.config";

interface SidebarProps {
  activeTab: string;
  onTabChange: (path: string) => void;
}

/**
 * Sidebar de navegação. Não pertence a nenhuma página específica —
 * vive no MainLayout e é compartilhada por Dashboard, Usuários, Scrapers etc.
 */
export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="w-64 bg-white dark:bg-[#0f131a] border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between shrink-0 theme-transition">
      <div>
        <div className="p-6 flex items-center gap-2">
          <CandidateLogo />
        </div>

        <nav className="px-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => onTabChange(item.path)}
            />
          ))}
        </nav>
      </div>

      <SidebarFooter onLogout={handleLogout} />
    </aside>
  );
}
