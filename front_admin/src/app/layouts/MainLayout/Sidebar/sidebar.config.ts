import {
  Activity,
  Cpu,
  Key,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "../../../routes/routes";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: ROUTES.dashboard },
  { id: "usuarios", label: "Usuários", icon: Users, path: ROUTES.users },
  { id: "scrapers", label: "Scrapers", icon: Cpu, path: ROUTES.scrapers },
  { id: "observabilidade", label: "Observabilidade", icon: Activity, path: ROUTES.observability },
  { id: "auditoria", label: "Auditoria", icon: ShieldCheck, path: ROUTES.audit },
  { id: "permissoes", label: "Permissões", icon: Key, path: ROUTES.permissions },
  { id: "configuracoes", label: "Configurações", icon: Settings, path: ROUTES.settings },
];
