import { useAuth } from "@/domains/auth/application/AuthContext";
import { Bell, ChevronDown, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initialMessages, initialNotifications } from "../../constants";
import type { Message, UserProfile } from "../../types";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  title?: string;
  userProfile?: UserProfile;
  userInitials?: string;
  unreadNotifications?: number;
  messages?: Message[];
}

export function Header({
  title,
  userProfile,
  userInitials,
  unreadNotifications = 1,
  messages = initialMessages,
}: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showMessagesMenu, setShowMessagesMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(messages.length);
  const [unreadCount, setUnreadCount] = useState(unreadNotifications);
  const actionsRef = useRef<HTMLDivElement>(null);

  const routeTitles: Array<{ path: string; title: string }> = [
    { path: "/home", title: "Início" },
    { path: "/dashboard", title: "Métricas & Candidaturas" },
    { path: "/vagas", title: "Vagas" },
    { path: "/mentoria", title: "Mentoria" },
    { path: "/perfil", title: "Meu Perfil Profissional" },
    { path: "/ajuda", title: "Ajuda & Suporte" },
  ];

  const activeTitle =
    title ??
    routeTitles.find((route) => location.pathname === route.path)?.title ??
    "Início";

  const displayName =
    userProfile?.displayName ?? user?.displayName ?? user?.name ?? user?.email ?? "Usuário";
  const accountLabel =
    userProfile?.email ??
    (userProfile?.username ? `@${userProfile.username}` : undefined) ??
    user?.email ??
    displayName
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();
  const avatarUrl = userProfile?.avatarUrl || user?.avatarUrl || "";
  const initials =
    userInitials ??
    displayName
      .trim()
      .split(/\s|[._-]/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setShowMessagesMenu(false);
        setShowNotificationsMenu(false);
        setShowUserMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <header className="relative z-20 flex h-[58px] shrink-0 items-center justify-between border-b border-border bg-card px-6 md:px-8">
      <h1 className="text-[20px] font-bold leading-none text-foreground">
        {activeTitle}
      </h1>
      <div ref={actionsRef} className="relative flex items-center gap-3">
        <ThemeToggle />

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowMessagesMenu((current) => !current);
              setShowNotificationsMenu(false);
              setShowUserMenu(false);
              setUnreadMessagesCount(0);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            aria-label="Mensagens"
            title="Mensagens"
          >
            <Mail className="h-5 w-5" />
            {unreadMessagesCount > 0 ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            ) : null}
          </button>

          {showMessagesMenu ? (
            <div className="absolute right-0 mt-3 w-[286px] rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-bold">Caixa de Mensagens</span>
                <span className="text-xs font-bold text-primary">
                  {unreadMessagesCount > 0 ? `${unreadMessagesCount} novas` : "Lidas"}
                </span>
              </div>
              <div className="space-y-4 pt-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <span className="font-bold">{message.sender}</span>
                      <span className="shrink-0 text-muted-foreground">{message.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {message.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotificationsMenu((current) => !current);
              setShowMessagesMenu(false);
              setShowUserMenu(false);
              setUnreadCount(0);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            ) : null}
          </button>

          {showNotificationsMenu ? (
            <div className="absolute right-0 mt-3 w-[286px] rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-bold">Notificações Recentes</span>
                <button
                  type="button"
                  onClick={() => setUnreadCount(0)}
                  className="text-xs text-slate-400 hover:text-foreground"
                >
                  Limpar
                </button>
              </div>
              <div className="space-y-5 pt-4">
                {initialNotifications.map((notification) => (
                  <div key={notification.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {notification.text}
                      </p>
                      <span className="text-[11px] text-slate-400">{notification.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((current) => !current);
              setShowMessagesMenu(false);
              setShowNotificationsMenu(false);
            }}
            className="flex h-12 items-center gap-3 rounded-xl border border-border bg-muted/45 px-3 pr-2 text-left transition-colors hover:bg-muted"
            aria-label="Menu do usuário"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Avatar de ${displayName}`}
                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </span>
            )}
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-36 truncate text-sm font-bold leading-4">
                {displayName}
              </span>
              <span className="block max-w-36 truncate text-xs text-muted-foreground">
                {accountLabel}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-xl border border-border bg-card text-sm text-foreground shadow-xl">
              <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
                {accountLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/perfil");
                }}
                className="block w-full px-4 py-3 text-left hover:bg-muted"
              >
                Meu Perfil
              </button>
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className="block w-full px-4 py-3 text-left hover:bg-muted"
              >
                Segurança
              </button>
              <button
                type="button"
                onClick={logout}
                className="block w-full border-t border-border px-4 py-3 text-left text-rose-500 hover:bg-rose-500/10"
              >
                Sair da Conta
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
