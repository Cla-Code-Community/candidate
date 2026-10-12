import { useMemo } from "react";
import { createPollingResource, type PollingResource } from "../../../lib/polling/pollingResource";
import { usePollingResource } from "../../../lib/polling/usePollingResource";
import type { OperationalSnapshot } from "../schemas/operationalSnapshot.schema";
import { operationalSnapshotService } from "../services/operationalSnapshot.service";

const resources = new Map<string, PollingResource<OperationalSnapshot>>();

export function useOperationalSnapshot(enabled: boolean, intervalMs = 10_000, sessionKey = "default") {
  const resource = useMemo(() => {
    let shared = resources.get(sessionKey);
    if (!shared) {
      shared = createPollingResource({
        load: (signal) => operationalSnapshotService.getSnapshot(signal),
        intervalMs: 10_000,
        accept: (snapshot) => snapshot.processor !== null,
        timestamp: (snapshot) => snapshot.timestamp,
        unavailableMessage: "Processor indisponível. Última leitura desatualizada, quando disponível.",
        errorMessage: "Snapshot operacional indisponível. Última leitura desatualizada, quando disponível.",
      });
      resources.set(sessionKey, shared);
    }
    return shared;
  }, [sessionKey]);
  const state = usePollingResource(resource, enabled, intervalMs);
  return {
    snapshot: enabled ? state.data : null,
    stale: enabled && state.stale,
    loading: enabled && state.loading,
    forbidden: enabled && state.forbidden,
    error: enabled ? state.error : "Snapshot operacional disponível apenas para admin e super admin.",
    refresh: enabled ? state.refresh : async () => {},
  };
}
