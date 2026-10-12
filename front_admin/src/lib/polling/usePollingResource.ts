import { useCallback, useSyncExternalStore } from "react";
import type { PollingResource } from "./pollingResource";

export function usePollingResource<T>(resource: PollingResource<T>, enabled = true, intervalMs?: number) {
  const subscribe = useCallback((listener: () => void) => enabled
    ? resource.subscribe(listener, intervalMs)
    : () => {}, [resource, enabled, intervalMs]);
  const state = useSyncExternalStore(subscribe, resource.getSnapshot);
  return { ...state, refresh: resource.refresh };
}
