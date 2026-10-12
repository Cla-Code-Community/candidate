import type { useOperationalSnapshot } from "../hooks/useOperationalSnapshot";

export type OperationalReading = ReturnType<typeof useOperationalSnapshot>;
export const EXECUTION_LABELS = {
  idle: "Ocioso", running: "Executando", canceling: "Cancelando",
  failed: "Falhou", completed: "Concluído",
};
export const STAGE_LABELS = {
  collection: "Coleta", classification: "Classificação",
  persistence: "Persistência", indexing: "Indexação",
};

export function operationalNotice(reading: OperationalReading, enabled: boolean) {
  if (!enabled) return "Scheduler: leitura limitada; snapshot sem permissão para esta role.";
  if (reading.loading) return "Carregando snapshot operacional...";
  if (reading.forbidden) return "Snapshot sem permissão.";
  if (reading.stale) return reading.snapshot ? "Snapshot desatualizado; última leitura válida." : "Snapshot indisponível.";
  if (reading.snapshot?.status === "partial") return "Snapshot parcial; dados operacionais disponíveis.";
  return "Snapshot operacional do Processor";
}

export function withOperationalExecution<T extends { id: string; status: string; lastRun: string; active: boolean }>(
  scraper: T, reading: OperationalReading, enabled: boolean,
): T & { executionDetail?: string; runDisabled?: boolean } {
  // The snapshot describes the Processor, never a provider inferred from jobs.
  if (!enabled || scraper.id !== "go-scraper") return scraper;
  const p = reading.snapshot?.processor;
  if (!p) return { ...scraper, status: "N/D", lastRun: "N/D", active: false,
    executionDetail: operationalNotice(reading, true), runDisabled: true };
  const e = p.execution;
  const active = e.status === "running" || e.status === "canceling";
  const lastRunAt = e.startedAt ?? e.finishedAt;
  const stage = e.stage ? STAGE_LABELS[e.stage] : "Etapa N/D";
  const duration = active ? e.durationSeconds : e.lastDurationSeconds;
  return {
    ...scraper, status: EXECUTION_LABELS[e.status], active,
    lastRun: lastRunAt ? new Date(lastRunAt).toLocaleString("pt-BR") : "Sem execução",
    runDisabled: active || reading.stale || reading.forbidden,
    executionDetail: `${stage} • ${e.source ?? "Origem N/D"} • ${duration}s • ${p.progress.tasksCompleted}/${p.progress.tasksTotal} tarefas encerradas • Lock local: ${p.lock.held ? "mantido" : "livre"} • Concorrência: ${p.concurrency.active}/${p.concurrency.effective} (${p.concurrency.waiting} em espera)${e.lastStatus ? ` • Último resultado: ${e.lastStatus}` : ""}`,
  };
}
