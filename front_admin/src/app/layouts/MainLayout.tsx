import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../routes/routes";
import { Header } from "./MainLayout/Header/Header";
import { Sidebar } from "./MainLayout/Sidebar/Sidebar";

const PAGE_META: Record<string, { activeTab: string; title: string; subtitle: string }> = {
  [ROUTES.dashboard]: {
    activeTab: "dashboard",
    title: "Dashboard",
    subtitle: "Visão geral da plataforma e operação dos scrapers",
  },
  [ROUTES.users]: {
    activeTab: "usuarios",
    title: "Usuários",
    subtitle: "Gestão de acessos e contas administrativas",
  },
  [ROUTES.scrapers]: {
    activeTab: "scrapers",
    title: "Scrapers",
    subtitle: "Controle dos coletores e execuções automatizadas",
  },
  [ROUTES.observability]: {
    activeTab: "observabilidade",
    title: "Observabilidade",
    subtitle: "Métricas, logs e saúde da infraestrutura",
  },
  [ROUTES.audit]: {
    activeTab: "auditoria",
    title: "Auditoria",
    subtitle: "Eventos administrativos e trilhas de segurança",
  },
  [ROUTES.permissions]: {
    activeTab: "permissoes",
    title: "Permissões",
    subtitle: "Perfis, papéis e políticas de acesso",
  },
  [ROUTES.settings]: {
    activeTab: "configuracoes",
    title: "Configurações",
    subtitle: "Preferências e parâmetros do painel",
  },
};

/**
 * Layout raiz do admin. Qualquer página (Dashboard, Usuários, Scrapers...)
 * é renderizada dentro dele e reaproveita automaticamente Sidebar + Header.
 */
export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageMeta = PAGE_META[location.pathname] ?? PAGE_META[ROUTES.dashboard];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#090b0f] font-sans text-slate-800 dark:text-slate-100 overflow-hidden theme-transition">
      <Sidebar
        activeTab={pageMeta.activeTab}
        onTabChange={(path) => navigate(path)}
      />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Header title={pageMeta.title} subtitle={pageMeta.subtitle} />
        <div className="p-8 space-y-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
