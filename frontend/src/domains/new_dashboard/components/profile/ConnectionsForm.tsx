import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  connectProvider,
  disconnectProvider,
  getConnections,
  type SupportedProvider,
  type UserConnections,
} from "@/domains/auth/infrastructure/connectionsApi";

const PROVIDER_LABELS: Record<SupportedProvider, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
};

const ERROR_MESSAGES: Record<string, string> = {
  provider_already_linked: "Essa conta já está vinculada a outro usuário.",
  link_failed: "Não foi possível conectar. Tente novamente.",
};

export function ConnectionsForm() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read ?linked= / ?error= once at mount; derive initial state synchronously.
  const initialLinked = searchParams.get("linked");
  const initialErrCode = searchParams.get("error");

  const [data, setData] = useState<UserConnections | null>(null);
  const [feedback, setFeedback] = useState<string>(
    initialLinked ? `Conta ${initialLinked} conectada com sucesso.` : "",
  );
  const [error, setError] = useState<string>(
    initialErrCode
      ? (ERROR_MESSAGES[initialErrCode] ?? "Erro ao conectar.")
      : "",
  );
  const [busy, setBusy] = useState<SupportedProvider | null>(null);

  // Clean up URL params after reading them (no setState in effect body).
  useEffect(() => {
    if (initialLinked || initialErrCode) {
      const next = new URLSearchParams(searchParams);
      next.delete("linked");
      next.delete("error");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load connections list on mount.
  useEffect(() => {
    getConnections()
      .then((result) => setData(result))
      .catch(() => setError("Falha ao carregar conexões."));
  }, []);

  const totalMethods = useMemo(() => {
    if (!data) return 0;
    const connected = data.connections.filter((c) => c.connected).length;
    return connected + (data.hasPassword ? 1 : 0);
  }, [data]);

  function refresh() {
    getConnections()
      .then((result) => setData(result))
      .catch(() => setError("Falha ao carregar conexões."));
  }

  async function handleDisconnect(provider: SupportedProvider) {
    setBusy(provider);
    setError("");
    setFeedback("");
    try {
      await disconnectProvider(provider);
      setFeedback(`Conta ${PROVIDER_LABELS[provider]} desconectada.`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect(provider: SupportedProvider) {
    setBusy(provider);
    setError("");
    setFeedback("");
    try {
      await connectProvider(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-[18px] font-bold">Conexões</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Conecte ou desconecte suas contas de login social.
      </p>

      {feedback ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl border border-border bg-muted/35 p-2">
        {!data ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="flex flex-col">
            {data.connections.map((c) => {
              const isLastMethod = c.connected && totalMethods <= 1;
              const isBusy = busy === c.provider;

              return (
                <li
                  key={c.provider}
                  className="flex items-center justify-between gap-4 border-b border-border px-3 py-4 last:border-b-0"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      {PROVIDER_LABELS[c.provider]}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        c.connected
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {c.connected ? "Conectado" : "Não conectado"}
                    </span>
                  </span>

                  {c.connected ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(c.provider)}
                      disabled={isBusy || isLastMethod}
                      title={
                        isLastMethod
                          ? "Você precisa manter ao menos um método de login."
                          : undefined
                      }
                      className="h-9 shrink-0 rounded-md border border-border px-4 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400"
                    >
                      {isBusy ? "Desconectando..." : "Desconectar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnect(c.provider)}
                      disabled={isBusy}
                      className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Conectando..." : "Conectar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
