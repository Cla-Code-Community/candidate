import { Database, MonitorCog, RefreshCw, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "../../components/theme/ThemeSwitcher";
import { useAuth } from "../auth/hooks/useAuth";

const SETTINGS_KEY = "candidate_admin_settings";

type PanelSettings = {
  density: "comfortable" | "compact";
  refreshSeconds: number;
  defaultRange: "5m" | "15m" | "1h" | "6h" | "24h";
};

const DEFAULT_SETTINGS: PanelSettings = {
  density: "comfortable",
  refreshSeconds: 15,
  defaultRange: "24h",
};

function loadSettings(): PanelSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function SettingCard({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  icon: typeof Settings2;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm theme-transition dark:border-slate-800 dark:bg-[#0f131a]">
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <span className="rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <Icon size={20} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { isLoggedIn } = useAuth();
  const [settings, setSettings] = useState<PanelSettings>(loadSettings);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  function clearPanelStorage() {
    window.localStorage.removeItem(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SettingCard
          title="Aparência"
          description="Preferências visuais salvas neste navegador."
          icon={MonitorCog}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                Tema
              </p>
              <ThemeSwitcher />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                Densidade
              </p>
              <div className="inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
                {(["comfortable", "compact"] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, density }))}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                      settings.density === density
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {density === "comfortable" ? "Confortável" : "Compacta"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingCard>

        <SettingCard
          title="Atualização"
          description="Padrões usados por telas operacionais."
          icon={RefreshCw}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Auto-refresh: {settings.refreshSeconds}s
              </span>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={settings.refreshSeconds}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    refreshSeconds: Number(event.target.value),
                  }))
                }
                className="mt-3 w-full"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Janela padrão
              </span>
              <select
                value={settings.defaultRange}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    defaultRange: event.target.value as PanelSettings["defaultRange"],
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="5m">5 minutos</option>
                <option value="15m">15 minutos</option>
                <option value="1h">1 hora</option>
                <option value="6h">6 horas</option>
                <option value="24h">24 horas</option>
              </select>
            </label>
          </div>
        </SettingCard>

        <SettingCard
          title="Sessão"
          description="Contexto do usuário autenticado."
          icon={UserRound}
        >
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Nome</dt>
              <dd className="mt-1 text-slate-800 dark:text-slate-100">
                {isLoggedIn?.name ?? "Sessão não carregada"}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="mt-1">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {isLoggedIn?.role ?? "-"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="mt-1 text-slate-800 dark:text-slate-100">
                {isLoggedIn?.email ?? "-"}
              </dd>
            </div>
          </dl>
        </SettingCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingCard
          title="Ambiente"
          description="Valores usados pelo frontend para falar com o backend."
          icon={Database}
        >
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">API URL</dt>
              <dd className="mt-1 font-mono text-slate-800 dark:text-slate-100">
                {apiUrl}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500 dark:text-slate-400">Storage</dt>
              <dd className="mt-1 text-slate-800 dark:text-slate-100">
                Preferências locais em <span className="font-mono">{SETTINGS_KEY}</span>
              </dd>
            </div>
          </dl>
        </SettingCard>

        <SettingCard
          title="Manutenção Local"
          description="Ações seguras que afetam apenas este navegador."
          icon={ShieldCheck}
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearPanelStorage}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
            >
              Restaurar preferências
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Recarregar painel
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Configurações persistentes de backend ainda não possuem endpoint
            dedicado. Esta tela prepara a experiência local do painel.
          </p>
        </SettingCard>
      </div>
    </div>
  );
}
