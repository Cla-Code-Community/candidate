# Resultado operacional da coleta

`collection: N task(s) failed` era produzido em `pipeline.ScrapeAllSources`, depois de drenar os jobs, e propagado pelo cronjob como falha terminal. A política agora retorna `partial_success` sem erro terminal quando pelo menos `SCRAPER_MIN_SUCCESS_PERCENT` (padrão 50, intervalo 1–100) dos adapters selecionados concluíram todas as suas tarefas sem erro. O denominador inclui os não despachados. Tarefa com jobs e erro continua falhando, mas seus jobs são processados.

Erros de processamento, cancelamento, lock e deadline do ciclo continuam fatais. Timeout local do adapter é falha individual; não implica deadline do ciclo. O relatório final contém resultado técnico da coleta e resultado operacional, e é emitido depois da tentativa de liberar o lock, inclusive em falhas anteriores à coleta. `LastRun.Status` usa success/partial_success/failed; o motivo original permanece no relatório. As métricas legadas mantêm seu contrato técnico.

Contadores têm unidades distintas:

- Adapters: sucesso exige conclusão de todas as tarefas, sem qualquer erro. Falhas, timeouts e cancelamentos são categorias exclusivas, nessa prioridade: cancelamento, timeout, outros erros. Uma falha pode gerar vários diagnósticos por tarefa.
- `tasksCanceled` legado inclui tarefas com timeout. Por isso 2 timeouts podem produzir tasksCanceled=2 e cancelled=0 no resumo do provider. O relatório separa TaskTimeouts e TaskCancellations.
- `Saved()`/PersistedOperations = Inserted + Updated: operações de upsert, inclusive merges tardios de duplicatas já gravadas. PersistedDocuments conta os documentos aprovados distintos retornados pelo processamento.
- Indexed conta entradas concluídas, inclusive skips idempotentes. O buffer pode consolidar várias gravações do mesmo documento. Portanto saved=5720 e indexed=5719 não demonstram perda de índice por si só. Sem o log original não se atribui uma causa específica ao benchmark.
- IndexPending conta o buffer ainda aguardando indexação; IndexUnconfirmedInputs conta entradas de chamadas que falharam, descontando reconciliações confirmadas. Não se calcula pendência por saved-indexed. PersistencePending conta itens ainda no buffer de classificação/persistência; falhas de batches são informadas separadamente. Esses buffers não representam uma auditoria do backlog durável global.
- Received mede entradas consumidas pelo processamento antes de falha terminal; Collected mede jobs entregues pelos adapters ao coordenador, inclusive depois de uma falha de processamento.

Diagnóstico preserva o texto original, board estável, timeout, DNS e conexão tipados; códigos HTTP só são classificados com evidência explícita. Unknown continua unknown.

Validação rápida: fixtures determinísticas em pipeline e cronjob, sem chamadas à API; os testes existentes de recuperação cobrem falhas de persistência/indexação, deadline e drain.
