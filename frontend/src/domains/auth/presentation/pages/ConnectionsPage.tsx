// frontend/src/domains/auth/presentation/pages/ConnectionsPage.tsx
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

export default function ConnectionsPage() {
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
    try {
      await connectProvider(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1>Gerenciar conexões</h1>
      <p>Conecte ou desconecte suas contas de login social.</p>

      {feedback && <p role="status">{feedback}</p>}
      {error && <p role="alert">{error}</p>}

      {!data && <p>Carregando…</p>}

      {data && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.connections.map((c) => {
            const isLastMethod = c.connected && totalMethods <= 1;
            return (
              <li
                key={c.provider}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>
                  <strong>{PROVIDER_LABELS[c.provider]}</strong>{" "}
                  {c.connected ? "· Conectado" : "· Não conectado"}
                </span>
                {c.connected ? (
                  <button
                    onClick={() => handleDisconnect(c.provider)}
                    disabled={busy === c.provider || isLastMethod}
                    title={
                      isLastMethod
                        ? "Você precisa manter ao menos um método de login."
                        : undefined
                    }
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(c.provider)}
                    disabled={busy === c.provider}
                  >
                    Conectar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
