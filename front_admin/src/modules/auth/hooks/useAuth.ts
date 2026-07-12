// import { useEffect, useState } from "react";
// import { authApi } from "../lib/api/auth.api";
// import type { MeResponse } from "../lib/api/types";

// type Session = MeResponse["user"];

// export function useAuth() {
//   const [session, setSession] = useState<Session | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     authApi
//       .me()
//       .then((res) => setSession(res.user))
//       .catch(() => setSession(null))
//       .finally(() => setLoading(false));
//   }, []);

//   const login = async (email: string, password: string) => {
//     await authApi.login({ email, password });
//     const res = await authApi.me();
//     setSession(res.user);
//   };

//   const logout = async () => {
//     await authApi.logout();
//     setSession(null);
//   };

//   const hasPermission = (resource: string, action: string) =>
//     session?.permissions[resource]?.includes(action) ?? false;

//   return { session, loading, login, logout, hasPermission };
// }

import { useEffect, useState } from "react";
import { authApi } from "../../../lib/api/auth.api";
import { ApiError } from "../../../lib/api/client";
import type { MeResponse } from "../../../lib/api/types";
import { useNotifications } from "../../../components/notifications/useNotifications";
import type { LoginCredentials } from "../schemas/auth.schema";

type Session = MeResponse["user"];
type AuthListener = (session: Session | null) => void;

let sharedSession: Session | null = null;
let sharedSessionLoaded = false;
let sharedSessionPromise: Promise<Session | null> | null = null;
const listeners = new Set<AuthListener>();

function emitSession(session: Session | null) {
  sharedSession = session;
  listeners.forEach((listener) => listener(session));
}

function subscribe(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function loadSession(): Promise<Session | null> {
  if (sharedSessionLoaded) return sharedSession;

  sharedSessionPromise ??= authApi
    .me()
    .then((res) => {
      sharedSessionLoaded = true;
      emitSession(res.user);
      return res.user;
    })
    .catch(() => {
      sharedSessionLoaded = true;
      emitSession(null);
      return null;
    })
    .finally(() => {
      sharedSessionPromise = null;
    });

  return sharedSessionPromise;
}

export function useAuth() {
  const { notify } = useNotifications();
  const [isLoggedIn, setSession] = useState<Session | null>(sharedSession);
  const [loading, setLoading] = useState(!sharedSessionLoaded);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = subscribe(setSession);

    loadSession().finally(() => setLoading(false));

    return unsubscribe;
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      await authApi.login(credentials);
      const res = await authApi.me();
      sharedSessionLoaded = true;
      emitSession(res.user);
      notify({
        tone: "success",
        title: "Login realizado",
        description: `Bem-vindo, ${res.user.name}.`,
      });
      return true;
    } catch (error) {
      const isServerError = error instanceof ApiError && error.status >= 500;
      const message = isServerError
        ? "Servidor indisponível. Tente novamente em alguns instantes."
        : "E-mail ou senha inválidos";

      setErrorMessage(message);
      notify({
        tone: isServerError ? "error" : "warning",
        title: isServerError ? "Erro no servidor" : "Falha no login",
        description: message,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authApi.logout();
    sharedSessionLoaded = true;
    emitSession(null);
    notify({
      tone: "success",
      title: "Sessão encerrada",
      description: "Você saiu do painel administrativo.",
    });
  };

  const hasPermission = (resource: string, action: string) =>
    isLoggedIn?.permissions[resource]?.includes(action) ?? false;

  return {
    isLoggedIn,
    loading,
    isLoading,
    errorMessage,
    login,
    logout,
    hasPermission,
  };
}
