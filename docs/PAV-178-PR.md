# Conteúdo sugerido para o PR

## Linear

Issue: PAV-178
Destino: `develop`. Não foi aberto PR nem realizada operação remota.

## Objetivo

Evitar perda de resultados válidos no encerramento da coleta e preparar a publicação controlada do Processor em DEV, com execuções por provedor sem sobreposição e sem introduzir vagas fictícias.

## Resumo das alterações

- Preserva o hotfix de resultados parciais, a seleção por ProviderID e o desligamento do scheduler.
- Centraliza `SCRAPER_SCRAPE_TIMEOUT` com padrão de 50 minutos e validação de override.
- Atualiza o resumo e a observabilidade quando há vagas persistidas após timeout/falha parcial.
- Remove o seed demonstrativo do fluxo de migrations e bloqueia fixtures fora de opt-in local explícito.
- Encaminha seleção administrativa Node → Go, com validação e propagação dos erros 400/409/429/503.
- Adiciona janelas diárias UTC configuráveis, reserva por janela e reutilização do lock global.
- Limita o despacho individual de Greenhouse a até 1.000 adapters e grava checkpoint de lote somente após conclusão confirmada, com proteção de propriedade do lock.
- Respeita Retry-After do Greenhouse entre execuções e após reinício; renova os caches de Greenhouse/Lever por execução.
- Mantém o registry completo e a busca nos documentos versionados do Valkey.
- Ajusta o teste de configuração ao Compose modular e o typecheck à versão 5.9 do TypeScript utilizada pelo backend.

## Validação realizada

- Suíte Go: 310 testes principais aprovados e 14 testes de integração pulados sem configuração externa; regressão adicional do registry completo aprovada.
- Integrações Go: 14 testes aprovados em PostgreSQL/Redis descartáveis, incluindo commit, falha de commit e recuperação de indexação.
- Regressões Node.js: 395 testes aprovados em 32 arquivos, incluindo rotas, RBAC, busca, contratos e bloqueio de seeds.
- Busca versionada: 18 testes aprovados com Redis descartável.
- Detector de corridas de dados: aprovado em scheduler e pipeline.
- Typecheck do backend, build Go e validação estática do Compose: aprovados.

As instâncias descartáveis foram encerradas. Nenhum scrape real, seed real, deploy ou alteração de produção foi executado nesta rodada. O teste real de 300 segundos informado no contexto permanece como evidência anterior, não foi repetido.

## Banco, contratos e configuração

Nenhuma migration nova. O catálogo PostgreSQL, IDs estáveis, transações e revisões de indexação existentes foram mantidos. A mudança no Compose remove somente a chamada ao seed demonstrativo; migrations e backfill legítimo continuam.

O status administrativo ganha `lastRun` e `providerWindows`; o snapshot operacional ganha o indicador `partial`. O endpoint administrativo aceita `sources`, preservando o disparo sem seleção. Headers Retry-After e conflitos são propagados ao cliente.

Novas configurações: `SCRAPER_SCRAPE_TIMEOUT`, `SCRAPER_PROVIDER_WINDOWS` e `SCRAPER_GREENHOUSE_BATCH_SIZE`. Começar DEV com o scheduler desabilitado, validar um provider e medir duração/recursos antes de habilitar janelas definitivas.

## Pendências e riscos

- **Bloqueador condicional:** destino com índice legado não vazio e sem versão ativa exige plano explícito de migração/reconstrução antes da publicação. O código não apaga nem reconstrói índices automaticamente.
- **Bloqueador de ativação automática do Greenhouse:** validar a saúde das empresas e dimensionar o lote. Falhas permanentes ou um lote que nunca conclui impedem avançar seu checkpoint.
- **Não bloqueador do deploy inicial com scheduler desligado:** não há checkpoint por empresa/página dentro de lote parcial, nem histórico SQL de execuções. A repetição é idempotente, mas pode refazer trabalho.
- **Não bloqueador:** os demais providers mantêm suas políticas próprias de retry; o novo tratamento de Retry-After é específico do Greenhouse.
- A retenção de claims/checkpoints depende da persistência do Valkey. O prazo adicional de processamento é limitado a 30 segundos e não garante drenar qualquer volume.
- Fixtures já existentes não foram removidas. O bloqueio impede novas execuções automáticas do seed.

Consultar [o roteiro de publicação e validação](PAV-178-dev.md) para configuração, comandos e checklist. Nenhuma configuração temporária, `.env`, binário ou `cspell.json` faz parte desta entrega. Nenhum arquivo do frontend/PAV-181 foi alterado.

## Arquivos alterados nesta finalização

- `backend/src/modules/admin/observability/observability.types.ts`
- `backend/src/modules/admin/scrapers/scraperClient.ts`
- `backend/src/modules/admin/scrapers/scrapers.controller.ts`
- `backend/src/modules/admin/scrapers/scrapers.service.ts`
- `backend/src/modules/admin/scrapers/scrapers.types.ts`
- `backend/src/scripts/seed.ts`
- `backend/src/scripts/seedCatalogJobs.ts`
- `backend/src/scripts/seedPolicy.ts`
- `backend/tests/unit/modules/admin/providerDispatch.test.ts`
- `backend/tests/unit/modules/admin/scraperResult.test.ts`
- `backend/tests/unit/modules/admin/scrapers.test.ts`
- `backend/tests/unit/scripts/seed.test.ts`
- `backend/tests/unit/scripts/seedPolicy.test.ts`
- `backend/tsconfig.json`
- `docker/docker-compose.app.yml`
- `docker/docker-compose.migrate.yml`
- `docs/PAV-178-PR.md`
- `docs/PAV-178-dev.md`
- `scraper-go/cmd/server/admin_handlers.go`
- `scraper-go/cmd/server/main.go`
- `scraper-go/cmd/server/provider_manual_test.go`
- `scraper-go/cmd/server/server.go`
- `scraper-go/internal/adapters/adapterutil/retry_after.go`
- `scraper-go/internal/adapters/adapterutil/retry_after_test.go`
- `scraper-go/internal/adapters/greenhouse/adapter.go`
- `scraper-go/internal/adapters/greenhouse/retry_after_test.go`
- `scraper-go/internal/adapters/lever/adapter.go`
- `scraper-go/internal/adapters/lever/run_cache_test.go`
- `scraper-go/internal/adapters/registry_test.go`
- `scraper-go/internal/config/config.go`
- `scraper-go/internal/config/config_test.go`
- `scraper-go/internal/config/provider_schedule.go`
- `scraper-go/internal/config/provider_schedule_test.go`
- `scraper-go/internal/config/scrape_timeout_test.go`
- `scraper-go/internal/cronjob/collection_timeout_test.go`
- `scraper-go/internal/cronjob/cronjob.go`
- `scraper-go/internal/cronjob/provider_batch.go`
- `scraper-go/internal/cronjob/provider_dispatch_test.go`
- `scraper-go/internal/cronjob/provider_retry.go`
- `scraper-go/internal/cronjob/provider_retry_test.go`
- `scraper-go/internal/cronjob/provider_schedule.go`
- `scraper-go/internal/domain/job.go`
- `scraper-go/internal/metrics/operational.go`
- `scraper-go/internal/metrics/partial_run_test.go`
- `scraper-go/internal/metrics/state.go`
- `scraper-go/internal/pipeline/pipeline.go`
- `scraper-go/internal/pipeline/process.go`
- `scraper-go/internal/pipeline/provider_selection.go`
- `scraper-go/internal/pipeline/scrape.go`
- `scraper-go/internal/ports/rate_limit.go`
- `scraper-go/internal/ports/rate_limit_test.go`
