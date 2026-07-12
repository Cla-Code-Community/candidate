import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  type AppNotification,
  NotificationContext,
  type NotificationTone,
  type NotifyInput,
} from "./notificationContext";

const TONE_STYLES: Record<
  NotificationTone,
  {
    icon: typeof CheckCircle2;
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    title: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-200 dark:border-emerald-500/30",
    bg: "bg-emerald-50/95 dark:bg-emerald-950/95",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    title: "text-emerald-950 dark:text-emerald-100",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200 dark:border-amber-500/30",
    bg: "bg-amber-50/95 dark:bg-amber-950/95",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconColor: "text-amber-700 dark:text-amber-300",
    title: "text-amber-950 dark:text-amber-100",
  },
  error: {
    icon: XCircle,
    border: "border-rose-200 dark:border-rose-500/30",
    bg: "bg-rose-50/95 dark:bg-rose-950/95",
    iconBg: "bg-rose-100 dark:bg-rose-500/15",
    iconColor: "text-rose-700 dark:text-rose-300",
    title: "text-rose-950 dark:text-rose-100",
  },
  info: {
    icon: Info,
    border: "border-sky-200 dark:border-sky-500/30",
    bg: "bg-sky-50/95 dark:bg-sky-950/95",
    iconBg: "bg-sky-100 dark:bg-sky-500/15",
    iconColor: "text-sky-700 dark:text-sky-300",
    title: "text-sky-950 dark:text-sky-100",
  },
};

function createNotificationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }, []);

  const notify = useCallback(
    (notification: NotifyInput) => {
      const id = createNotificationId();
      setNotifications((current) =>
        [{ id, ...notification }, ...current].slice(0, 4),
      );

      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-3 px-4">
        {notifications.map((notification) => {
          const tone = TONE_STYLES[notification.tone];
          const Icon = tone.icon;

          return (
            <section
              key={notification.id}
              className={`pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border ${tone.border} ${tone.bg} p-4 shadow-2xl shadow-slate-950/15 backdrop-blur`}
              role="status"
              aria-live="polite"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.iconBg} ${tone.iconColor}`}
              >
                <Icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${tone.title}`}>
                  {notification.title}
                </p>
                {notification.description && (
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {notification.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(notification.id)}
                className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Fechar notificação"
              >
                <X size={16} />
              </button>
            </section>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}
