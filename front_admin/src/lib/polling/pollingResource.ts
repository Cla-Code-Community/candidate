import { ApiError } from "../api/client";

export type PollingState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  forbidden: boolean;
  error: string | null;
  updatedAt: string | null;
};

type Options<T> = {
  load: (signal: AbortSignal) => Promise<T>;
  intervalMs: number;
  errorMessage: string;
  unavailableMessage?: string;
  accept?: (data: T) => boolean;
  timestamp?: (data: T) => string;
};

// One request and timer per resource, regardless of the number of consumers.
export function createPollingResource<T>(options: Options<T>) {
  let state: PollingState<T> = {
    data: null, loading: true, refreshing: false, stale: false,
    forbidden: false, error: null, updatedAt: null,
  };
  const listeners = new Map<() => void, number>();
  let timer: number | undefined;
  let controller: AbortController | null = null;
  let pending: Promise<void> | null = null;
  let generation = 0;

  const publish = (patch: Partial<PollingState<T>>) => {
    state = { ...state, ...patch };
    listeners.forEach((_, listener) => listener());
  };

  const refresh = (): Promise<void> => {
    if (!listeners.size || state.forbidden || document.hidden) return Promise.resolve();
    if (pending) return pending;
    const requestGeneration = generation;
    const requestController = new AbortController();
    controller = requestController;
    publish({ refreshing: true });
    let timeout: number;
    const deadline = new Promise<never>((_, reject) => {
      requestController.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      timeout = window.setTimeout(() => {
        requestController.abort();
        reject(new Error("Polling deadline exceeded"));
      }, 8_000);
    });
    const request = Promise.race([options.load(requestController.signal), deadline])
      .then((data) => {
        if (requestGeneration !== generation || !listeners.size) return;
        if (options.accept && !options.accept(data)) {
          publish({ stale: true, loading: false, error: options.unavailableMessage ?? options.errorMessage });
          return;
        }
        publish({ data, loading: false, stale: false, error: null,
          updatedAt: options.timestamp?.(data) ?? new Date().toISOString() });
      })
      .catch((error: unknown) => {
        if (requestGeneration !== generation || !listeners.size) return;
        const forbidden = error instanceof ApiError && [401, 403].includes(error.status);
        publish({ loading: false, stale: true, forbidden,
          ...(forbidden ? { data: null, updatedAt: null } : {}),
          error: forbidden ? "Sem autorização para consultar este recurso." : options.errorMessage });
        if (forbidden) window.clearInterval(timer);
      })
      .finally(() => {
        window.clearTimeout(timeout!);
        if (pending !== request) return;
        pending = null;
        controller = null;
        if (requestGeneration === generation && listeners.size) publish({ refreshing: false });
      });
    pending = request;
    return request;
  };

  const onVisible = () => { if (!document.hidden) void refresh(); };
  const schedule = () => {
    window.clearInterval(timer);
    if (!state.forbidden) {
      const interval = Math.min(...listeners.values());
      if (interval > 0) timer = window.setInterval(() => void refresh(), interval);
    }
  };

  return {
    getSnapshot: () => state,
    refresh,
    subscribe(listener: () => void, intervalMs = options.intervalMs) {
      const first = listeners.size === 0;
      listeners.set(listener, intervalMs);
      schedule();
      if (first) {
        document.addEventListener("visibilitychange", onVisible);
        queueMicrotask(() => { if (listeners.size) void refresh(); });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) { schedule(); return; }
        generation++;
        controller?.abort();
        controller = null;
        pending = null;
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        // No subscriptions remain. Cached readings are stale until revalidated.
        state = { ...state, refreshing: false, stale: state.data !== null || state.stale };
      };
    },
  };
}

export type PollingResource<T> = ReturnType<typeof createPollingResource<T>>;
