import type { ReactNode } from "react";
import type { useOperationalSnapshot } from "../hooks/useOperationalSnapshot";
import { EXECUTION_LABELS, STAGE_LABELS } from "../services/operationalPresentation";

const number = (value: number | null | undefined) => value == null ? "N/D" : value.toLocaleString("pt-BR");
const date = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "N/D";
const bytes = (value?: number | null) => value == null ? "N/D" : `${(value / 1024 / 1024).toFixed(1)} MiB`;
const duration = (value?: number) => value == null ? "N/D" : value >= 60 ? `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s` : `${Math.floor(value)}s`;
const lockTTL = (value: number) => {
  const days = Math.floor(value / 86400);
  const hours = Math.floor(value % 86400 / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const human = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : minutes > 0 ? `${minutes}m ${Math.floor(value % 60)}s` : `${number(value)}s`;
  return <span title={`${value} segundos`}>{human}</span>;
};
const shell = "rounded-xl border border-slate-100 bg-white p-5 dark:border-slate-800 dark:bg-[#0f131a]";

function Values({ items }: { items: [string, ReactNode][] }) {
  return <dl className="space-y-2">{items.map(([label, value]) => <div key={label} className="flex min-w-0 items-baseline justify-between gap-4 text-xs"><dt className="text-slate-500 dark:text-slate-400">{label}</dt><dd className="min-w-0 wrap-anywhere text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{value}</dd></div>)}</dl>;
}
function Detail({ children, title = "Detalhes" }: { children: ReactNode; title?: string }) {
  return <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</summary><div className="mt-3">{children}</div></details>;
}

export function OperationalSnapshotPanels({ operational }: { operational: ReturnType<typeof useOperationalSnapshot> }) {
  const p = operational.snapshot?.processor;
  const c = p?.classification;
  const s = p?.persistence;
  const progress = p?.progress;
  const percentage = progress && progress.tasksTotal > 0 ? progress.tasksCompleted / progress.tasksTotal * 100 : null;
  const maintenance = p?.index.maintenance;
  const unavailable = !p || operational.stale || operational.snapshot?.status === "partial";
  return <div className="space-y-6">
    <section aria-labelledby="processor-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="processor-heading" className="scroll-mt-28 text-base font-bold text-slate-900 dark:text-white">Execução atual do Processor</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Snapshot a cada 10s</span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400" role="status">
        {operational.loading ? "Carregando snapshot operacional..." : operational.forbidden ? "Snapshot sem permissão." : operational.error ?? (operational.snapshot?.status === "partial" ? "Snapshot parcial: dados operacionais disponíveis." : "Snapshot operacional do Processor")}
        {operational.stale && " • Leitura desatualizada"}
        {p && ` • Processor: ${date(p.timestamp)}`}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <article className={`${shell} lg:col-span-2`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-2xl font-bold ${unavailable ? "text-amber-600 dark:text-amber-300" : p?.execution.status === "failed" ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{p ? EXECUTION_LABELS[p.execution.status] : "N/D"}</p>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800 dark:text-slate-200">Etapa: {p?.execution.stage ? STAGE_LABELS[p.execution.stage] : "N/D"}</span>
          </div>
          <p className="mb-4 wrap-anywhere font-mono text-xs text-slate-500 dark:text-slate-400">Run ID: {p?.execution.runId ?? "N/D"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Values items={[["Duração", duration(p?.execution.durationSeconds)], ["Origem", p?.execution.source ?? "N/D"], ["Lock", p ? p.lock.held ? "Mantido" : "Sem lock local" : "N/D"]]} />
            <Values items={[["Concorrência ativa / efetiva", p ? `${number(p.concurrency.active)} / ${number(p.concurrency.effective)}` : "N/D"], ["Em espera", number(p?.concurrency.waiting)], ["TTL do lock", p ? lockTTL(p.lock.ttlSeconds) : "N/D"]]} />
          </div>
          <Detail title="Horários e configuração"><Values items={[["Início", date(p?.execution.startedAt)], ["Fim", date(p?.execution.finishedAt)], ["Próxima execução", date(p?.execution.nextRunAt)], ["Último resultado", p?.execution.lastStatus ?? "N/D"], ["Duração anterior", duration(p?.execution.lastDurationSeconds)], ["Concorrência configurada", number(p?.concurrency.configured)], ["Consulta backend", date(operational.snapshot?.timestamp)]]} /></Detail>
        </article>
        <article className={shell} aria-label="Progresso da execução">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tarefas encerradas</h3>
          <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">{progress ? number(progress.tasksCompleted) : "N/D"}<span className="text-lg font-medium text-slate-400">{progress ? ` / ${number(progress.tasksTotal)}` : ""}</span></p>
          <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-300">{percentage == null ? "Percentual N/D" : `${percentage.toFixed(1)}%`}</p>
          <div className="my-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, percentage ?? 0)}%` }} /></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inclui falhas e cancelamentos. Não mede a conclusão do pipeline.</p>
          <div className="mt-4"><Values items={[["Providers encerrados", progress ? `${number(progress.providersCompleted)} / ${number(progress.providersTotal)}` : "N/D"], ["Canceladas", number(progress?.tasksCanceled)]]} /></div>
        </article>
      </div>
    </section>
    <section aria-labelledby="pipeline-heading">
      <h2 id="pipeline-heading" className="scroll-mt-28 mb-3 text-base font-bold text-slate-900 dark:text-white">Pipeline</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={shell} aria-label="Coleta"><h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Coleta</h3><Values items={[["Tarefas encerradas", progress ? `${number(progress.tasksCompleted)} / ${number(progress.tasksTotal)}` : "N/D"], ["Adapters processados", progress ? `${number(progress.adaptersProcessed)} / ${number(progress.adaptersTotal)}` : "N/D"], ["Entradas de keywords", progress ? `${number(progress.keywordsProcessed)} / ${number(progress.keywordsTotal)}` : "N/D"]]} /><Detail><Values items={[["Batches encerrados", number(progress?.batchesCompleted)], ["Fila / capacidade", p ? `${number(p.queues.collection.depth)} / ${number(p.queues.collection.capacity)}` : "N/D"]]} /></Detail></article>
        <article className={shell} aria-label="Classificação"><h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Classificação</h3><Values items={[["Recebidas", number(c?.received)], ["Aprovadas", number(c?.approved)], ["Rejeitadas", number(c?.rejected)]]} /><Detail><Values items={[["Classificadas", number(c?.classified)], ["Inválidas", number(c?.invalid)], ["Fila / capacidade", p ? `${number(p.queues.classification.depth)} / ${number(p.queues.classification.capacity)}` : "N/D"]]} /><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Recebidas incluem inválidas antes do classifier. Durante o processamento, os totais podem não fechar ainda. Após dedup por janela; reclassificações podem repetir uma vaga.</p></Detail></article>
        <article className={shell} aria-label="Persistência"><h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Persistência</h3><Values items={[["Recebidas", number(s?.received)], ["Inseridas", number(s?.inserted)], ["Atualizadas", number(s?.updated)]]} /><Detail><Values items={[["Ignoradas", number(s?.skipped)], ["Entradas em falha", number(s?.failed)], ["Batches em falha", number(s?.failedBatches)], ["Fila / capacidade", p ? `${number(p.queues.persistence.depth)} / ${number(p.queues.persistence.capacity)}` : "N/D"]]} /><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Resultados finais da execução, sem repetir retries.</p></Detail></article>
        <article className={shell} aria-label="Indexação"><h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Indexação</h3><Values items={[["Rebuild processadas", number(p?.index.rebuildProgress)], ["Buffer ocupado / capacidade", p ? `${number(p.queues.indexing.depth)} / ${number(p.queues.indexing.capacity)}` : "N/D"]]} /><Detail title="Versão e dependências"><Values items={[["Versão publicada", p?.index.activeVersion || "N/D"], ["Postgres", p?.dependencies.postgres.status ?? "N/D"], ["Valkey", p?.dependencies.valkey.status ?? "N/D"]]} /><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Buffer: vagas aguardando indexação / capacidade alocada; não é processadas / total. Rebuild não possui total conhecido; não representa percentual.</p></Detail></article>
      </div>
      <details className={`${shell} mt-4`}><summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">Último resumo de manutenção</summary><div className="mt-3">{maintenance ? <Values items={[["Operação / resultado", `${maintenance.operation} / ${maintenance.status}`], ["Processadas", number(maintenance.processed)], ["Divergências", number(maintenance.divergences)], ["Duração", duration(maintenance.durationSeconds)], ["Fim", date(maintenance.finishedAt)]]} /> : <p className="text-xs text-slate-500">N/D — retenção de até 24 horas; não indica ausência de manutenção anterior.</p>}</div></details>
    </section>
  </div>;
}

export function ProcessorResources({ operational }: { operational: ReturnType<typeof useOperationalSnapshot> }) {
  const p = operational.snapshot?.processor;
  return <div className={`${shell} mb-4`}>
    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Recursos atuais do Processor</h3>
    <div className="grid gap-4 sm:grid-cols-3"><Values items={[["CPU do processo", p?.resources.cpuPercent == null ? "N/D" : `${p.resources.cpuPercent.toFixed(1)}%`]]} /><Values items={[["Memória RSS", bytes(p?.resources.memoryBytes)]]} /><Values items={[["Heap Go alocado", bytes(p?.resources.heapBytes)]]} /></div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">RSS: memória residente do processo; Heap Go: HeapAlloc, objetos alocados ainda não liberados. CPU de processo/container pode superar 100% em ambientes multicore; 100% equivale a um núcleo.</p>
    {operational.stale && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">Recursos: leitura desatualizada.</p>}
    <Detail title="Runtime e erros instrumentados"><Values items={[["CPU acumulada", p ? `${number(p.resources.cpuSeconds)}s` : "N/D"], ["Goroutines", number(p?.resources.goroutines)], ["GOMAXPROCS", number(p?.resources.gomaxprocs)], ["GOMEMLIMIT", bytes(p?.resources.gomemlimitBytes)], ["Erros instrumentados", number(p?.errors.total)], ["Timeouts", number(p?.errors.timeouts)]]} /></Detail>
  </div>;
}
