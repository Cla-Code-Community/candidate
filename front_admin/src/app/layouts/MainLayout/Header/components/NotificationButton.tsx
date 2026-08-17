import { AlertTriangle, Bell, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../../../../components/notifications/useNotifications";
import { dashboardApi } from "../../../../../lib/api/dashboard.api";
import type { DashboardOverview } from "../../../../../lib/api/types";

interface Notification {
  tone: "success" | "warning" | "error";
  title: string;
  description: string;
  timeAgo: string;
}

const NOTIFICATION_STYLES: Record<
  Notification["tone"],
  {
    icon: typeof CheckCircle2;
    dot: string;
    iconBg: string;
    iconColor: string;
    border: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    border: "border-l-emerald-500",
  },
  warning: {
    icon: AlertTriangle,
    dot: "bg-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconColor: "text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
  },
  error: {
    icon: XCircle,
    dot: "bg-rose-500",
    iconBg: "bg-rose-100 dark:bg-rose-500/15",
    iconColor: "text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
  },
};

const SERVICE_LABELS = {
  postgres: "Postgres",
  valkey: "Valkey",
  scraper: "Scraper",
} as const;

function formatSnapshot(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Snapshot recente";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildNotifications(overview: DashboardOverview): Notification[] {
  const notifications: Notification[] = [];
  const timeAgo = `Snapshot ${formatSnapshot(overview.generatedAt)}`;

  for (const [key, service] of Object.entries(overview.services.services)) {
    if (service.status === "ok") continue;

    const label = SERVICE_LABELS[key as keyof typeof SERVICE_LABELS] ?? key;
    notifications.push({
      tone: service.status === "down" ? "error" : "warning",
      title: `${label} ${service.status === "down" ? "indisponível" : "degradado"}`,
      description: service.error
        ? service.error
        : `Latência atual: ${service.latencyMs ?? 0}ms.`,
      timeAgo,
    });
  }

  for (const scraper of overview.scrapers) {
    if (scraper.running) {
      notifications.push({
        tone: "success",
        title: `${scraper.name} em execução`,
        description: "O scraper está rodando neste momento.",
        timeAgo,
      });
    } else if (scraper.status === "down") {
      notifications.push({
        tone: "error",
        title: `${scraper.name} indisponível`,
        description: "O backend não conseguiu consultar o scraper.",
        timeAgo,
      });
    }
  }

  if (notifications.length === 0) {
    notifications.push({
      tone: "success",
      title: "Operação saudável",
      description: `${overview.stats.totalCollectedJobs.toLocaleString("pt-BR")} vagas no índice e serviços online.`,
      timeAgo,
    });
  }

  return notifications.slice(0, 5);
}

export function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { notify } = useNotifications();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    setIsLoading(true);

    dashboardApi
      .getOverview()
      .then((overview) => {
        if (!ignore) {
          setNotifications(buildNotifications(overview));
          setHasUnread(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setNotifications([
            {
              tone: "error",
              title: "Dashboard indisponível",
              description: "Não foi possível carregar notificações reais agora.",
              timeAgo: "Agora",
            },
          ]);
          setHasUnread(false);
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const openNotification = (notification: Notification) => {
    notify({
      tone: notification.tone,
      title: notification.title,
      description: notification.description,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() =>
          setIsOpen((current) => {
            if (!current) setHasUnread(false);
            return !current;
          })
        }
        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg relative transition-all"
        aria-label="Abrir notificações"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-[#0f131a]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0f131a] border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl py-2 z-20 text-xs">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-white flex justify-between items-center">
            <span>Notificações</span>
            <span className="text-[10px] bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 px-1.5 py-0.5 rounded-full">
              {isLoading ? "Carregando" : `${notifications.length} reais`}
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {notifications.map((n, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openNotification(n)}
                className={`flex w-full gap-3 border-b border-l-4 border-b-slate-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-b-slate-800 dark:hover:bg-slate-800 ${NOTIFICATION_STYLES[n.tone].border}`}
              >
                {(() => {
                  const style = NOTIFICATION_STYLES[n.tone];
                  const Icon = style.icon;

                  return (
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.iconBg} ${style.iconColor}`}
                    >
                      <Icon size={16} />
                    </span>
                  );
                })()}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${NOTIFICATION_STYLES[n.tone].dot}`}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {n.title}
                    </span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {n.description}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                    {n.timeAgo}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
