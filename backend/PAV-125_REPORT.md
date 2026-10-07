# PAV-125 — relatório de implementação

Data: 2026-10-07. Implementação sobre a branch derivada da PAV-124, sem troca de branch, merge, rebase, commit, push ou PR.

## Resultado e auditoria da base

O catálogo processado passa a ter PostgreSQL como fonte de verdade. O Processor classifica, faz upsert em lote e somente depois do commit publica documentos e índices no Valkey. A busca pública continua usando Valkey, com união de famílias, filtros antes da paginação, total consistente, cache determinístico e score específico para Produto/Design.

A busca conclusiva examinou schemas, migrations Drizzle, repositories/adapters, scripts, backend, scraper-go e referências Git locais disponíveis (59 referências). Não foi encontrado catálogo PostgreSQL compatível. `saved_jobs` representa vagas salvas por usuários; não é catálogo de ingestão e não foi convertido nem alterado. O seed existente produzia documentos no Valkey. Foram reutilizados o mecanismo Drizzle, o modelo `domain.Job`, o algoritmo `StableID`, o merge de duplicados, os índices de keywords e a taxonomia da PAV-123.

Foram considerados o agente `.codex_local/agents/agent-dev-jobs-processor.md`, Engineering Spec e Engineering Workflow. `.codex_local/agent.base.md` não estava disponível; nenhuma regra foi inventada para substituí-lo.

## Ownership e arquitetura

| Componente | Responsabilidade |
| --- | --- |
| Backend/Node | HTTP, parser e validação da PAV-124, composição da consulta, paginação/total, cache de busca, perfil e match, autenticação/autorização/rate limit |
| Jobs Processor/Go | Ingestão/classificação, persistência transacional do catálogo, publicação após commit, reclassificação, ciclo ativo, backfill, rebuild e reconciliação |
| PostgreSQL | Estado durável, identidade, payload confirmado, ciclo temporal e revisões |
| Valkey | Projeção de documentos, SETs de IDs, registro inverso, expiração da projeção, namespaces e cache |

O port durável é consumido por `jobstore`; o adapter SQL é composto no servidor. Produção exige `DATABASE_URL` e a migration aplicada. A implementação legada de `jobstore.New` permanece para compatibilidade dos testes e da transição; o servidor injeta exclusivamente `NewDurable` nas coletas manual e agendada.

## Schema, identidade e ciclo

Migration aditiva: `backend/drizzle/0015_job_catalog.sql`, com journal e snapshot Drizzle correspondentes. Cria apenas `job_catalog`, a sequência de revisões e índices SQL. Não modifica usuários ou saved jobs.

| Campo | Finalidade |
| --- | --- |
| `id` text PK | ID estável já produzido pelo Processor |
| `payload` jsonb | Representação atual de Job: origem, conteúdo, filtros, classificação e insumos de match; sem uma segunda representação paralela |
| `first_seen_at` | Primeira persistência observada |
| `last_seen_at` | Última coleta persistida |
| `updated_at` | Última atualização persistida, inclusive reclassificação |
| `expires_at` | Participação no catálogo ativo |
| `revision` | Revisão monotônica da persistência, usada para impedir indexação antiga |
| `indexed_revision` | Checkpoint da publicação confirmada no Valkey |

Há constraints para payload objeto, identidade do payload e ciclo temporal. A PK atende o cursor por ID; o índice `(expires_at, id)` atende atividade; o índice parcial de revisões pendentes permite observar trabalho ainda não publicado. Não foram criados índices SQL especulativos para cada filtro HTTP.

Uma vaga está ativa se `expires_at > now`. `SCRAPER_CATALOG_LIFETIME` é uma duração configurável, padrão `216h` (9 dias). Recoleta faz upsert da mesma identidade, preserva primeira observação e renova última observação/expiração. Reclassificação não renova esse ciclo. Expiração e desativação explícita conservam a linha histórica; não há deleção física nem política nova de retenção histórica.

SaveBatch deduplica e ordena IDs, bloqueia identidades em lote, lê registros anteriores em lote e executa um upsert transacional do lote. Contexto e rollback são preservados. `Persisted` contém somente linhas confirmadas pelo commit. Falha de commit não produz índice. O ID original e as regras atuais de merge foram preservados; a mudança de título/empresa/localização continua sujeita ao algoritmo de identidade existente.

## Índices, registro inverso e atomicidade

São SETs de IDs estáveis, sem repetição do objeto completo:

- `scraper:jobs:family:<id>`: associação principal OU relacionada;
- `scraper:jobs:family:primary:<id>`: exclusivamente principal;
- `scraper:jobs:family:related:<id>`: exclusivamente relacionada, excluindo a principal.

As consultas usam equivalentes dentro do namespace ativo `scraper:jobs:ns:<version>:`. As 39 chaves de famílias de compatibilidade são mantidas na publicação. `fullstack`, `devops` e `platform` permanecem independentes. As 13 famílias vêm da taxonomia canônica; não foi criada lista manual adicional. `other` pode permanecer no diagnóstico persistido, mas não possui índice público. Família desconhecida provoca erro controlado, sem criação de chave arbitrária de família.

O registro `index-membership:<jobId>` contém revisão, versão da taxonomia, primary/related, expiração e associações anteriores. A atualização remove somente o ID da própria vaga nos índices anteriores e adiciona suas associações novas, sem varrer todas as famílias.

Foi escolhido Lua em lotes limitados: o projeto já usa Valkey independente e a operação precisa publicar documentos, membership, conjuntos e geração juntos. O script faz preflight de tipos, metadados e geração antes de escrever, pois erro de execução Lua não reverte comandos anteriores. Revisões impedem atualização atrasada; repetir a mesma revisão não altera a geração. Testes exercitam erro estrutural em um lote sem mutação parcial. Não foi introduzida infraestrutura de transações distribuídas.

PostgreSQL e Valkey não têm atomicidade conjunta: há uma janela entre commit e publicação. Falha nessa janela é retornada, conserva o dado durável e o checkpoint pendente, permite retry limitado e reparo explícito. A operação não declara sucesso após falha de indexação. A geração de busca é atualizada no mesmo script que conclui a publicação dos índices, nunca antes do commit. Erro posterior no checkpoint SQL também é retornado; os índices podem já estar publicados e o retry é seguro.

## Rebuild, backfill e reconciliação

O comando `/catalog` foi incluído na imagem Go. Também pode ser executado com `go run ./cmd/catalog` no módulo. Exemplos completos de configuração e execução estão em [SCRAPER.md](../SCRAPER.md).

| Operação | Comportamento |
| --- | --- |
| `rebuild` | Lê apenas vagas SQL ativas, por cursor em batches; cria namespace novo; valida PostgreSQL × Valkey; publica ponteiro/compatibilidade/geração atomicamente; registra checkpoints após publicação |
| `reconcile` | Padrão read-only; relatório de ausência, sobras, membership, primary, related, any, documentos, valores inválidos e contagens |
| `reconcile --fix` | Correção explicitamente solicitada, por rebuild validado |
| `backfill` | SCAN dos documentos legados, leitura/PTTL em batches, validação, import SQL após commit e rebuild do SQL |
| `reclassify` | Reclassifica documentos persistidos, commits em lote, remove associações antigas e publica novas; repetição repara publicação pendente sem renovar expiração |
| `expire` | Remove da projeção ativa vagas SQL expiradas; é idempotente e também roda antes da coleta agendada |
| `deactivate --ids ...` | Desativação SQL explícita seguida de publicação após commit, conservando histórico |
| `rollback` | Só publica namespace anterior se ele ainda corresponde ao estado SQL atual |
| `cleanup --version ...` | Remove somente um namespace inativo, usando seu manifesto e batches; recusa o ativo |

O fencing PostgreSQL usa lease compartilhado para processamento/expiração e exclusivo para manutenção. Assim, um rebuild não perde commits publicados durante sua construção. Cancelamento libera conexões/locks; não reutiliza o lock de execução do scraper para cache de busca. Relatórios contam ocorrências de divergência; vários problemas podem pertencer ao mesmo ID.

O rebuild nunca apaga o conjunto ativo antes da validação. Namespace anterior permanece para rollback controlado; drafts possuem TTL. A limpeza é explícita e limitada ao namespace pertencente ao catálogo. Não foram introduzidos FLUSHALL, FLUSHDB ou o comando KEYS para limpeza. Sessões, filas, locks e estruturas alheias não são removidos.

O backfill usa somente dados confiáveis: documento existente, ID da chave e TTL restante. Não inventa data histórica de coleta: os timestamps SQL de observação representam a importação; a expiração conserva a vida restante observada. Documento inválido, identidade divergente, taxonomia desconhecida, TTL ausente ou já expirado é contabilizado e ignorado. `ON CONFLICT DO NOTHING` evita duplicação, renovação artificial ou sobrescrita de dados de coletas novas. Próximas coletas completam/renovam os registros pelo fluxo normal. Backfill não roda no startup.

## Busca, paginação e compatibilidade da PAV-124

O adapter faz SUNION entre famílias e SINTER com o grupo de keywords quando presente. O conjunto ativo é intersectado com o ZSET de expiração. IDs candidatos e ranking permanecem em estruturas temporárias no Valkey, com TTL e remoção ao terminar. Hidratação usa batches de até 200 documentos, sem query SQL por vaga.

Os demais filtros continuam passando pelos predicados da PAV-124 antes de total/paginação. Os índices históricos desses filtros usam inferências/aliases diferentes e não foram usados para uma interseção que descartaria resultados válidos. Não há pós-filtro restrito à página. Total conta exatamente os matches dos mesmos predicados que selecionam a página. Ranking global guarda IDs/scores no Valkey e hidrata somente a página final; desempate usa ID determinístico. A ordenação padrão conserva a prioridade por keywords do perfil e a ordenação de match da página prevista no fluxo antigo.

CSV, repetição de `family`, combinação dos formatos, normalização, limites, erros estáveis e `familyMode=any` padrão permanecem na PAV-124. `primary` usa exclusivamente o índice principal; `any` inclui relacionadas. Envelope HTTP, paginação, auth, rate limit, opções de filtros, IDs e saved jobs permanecem. O diagnóstico `source` pode indicar a estratégia de batches verificados.

Não foram inventados novos query params para provider/text/modality: o fingerprint cobre todos os filtros que o contrato atual realmente interpreta, incluindo keywords, technology, company, type/model, level/seniority, localização/continente/país/estado/cidade, contrato, matchSort e paginação. Evoluir esse contrato exige evolução correspondente do fingerprint.

A listagem administrativa Go conserva a opção de retornar todo o catálogo, com streaming de um snapshot SQL read-only e count no mesmo snapshot; não há um limite silencioso de mil registros nem carregamento de todo o catálogo em memória. Falha após iniciar essa resposta aborta o stream em vez de devolver JSON incompleto como sucesso.

## Cache e invalidação

Chaves `jobs:search:v2:<sha256>` usam os filtros tipados normalizados, famílias deduplicadas/ordenadas, modo padrão, paginação, ordenação, versão do contrato, versão/hash da taxonomia, namespace/geração e contexto normalizado de ranking do perfil. CSV/repetição/ordem de famílias/default any são equivalentes; primary e any são distintos. Texto, localização privada e contexto de perfil entram apenas no hash, sem PII/token/e-mail ou texto completo nas chaves.

`JOB_SEARCH_CACHE_TTL_SECONDS` é configurável, padrão 120 segundos; o TTL real é limitado pela próxima expiração ativa. O cache valida geração na leitura e faz compare-and-set Lua na escrita. Criação, atualização, reclassificação, desativação, expiração e rebuild mudam a geração depois da publicação. Mudanças de taxonomia/contrato alteram o fingerprint. Resultados antigos expiram sem busca global de chaves. Há single-flight local para solicitações simultâneas equivalentes; não foi criado lock distribuído de stampede. Falha exclusiva de cache não oculta o resultado válido da consulta.

Mudança operacional registrada: depois da ativação do catálogo, `DELETE /admin/jobs/cache` invalida a geração e preserva a projeção; mantém o envelope com `deleted: 0`. Não pode mais apagar o catálogo durável por limpeza de cache. O caminho legado ainda existe antes da ativação, com guarda atômica contra uma ativação concorrente. O seed Node também deixa de escrever dados de demonstração no catálogo já ativo.

## Match score

Somente primary `product` e `product_design` usam o novo modelo de evidência positiva. Consideram família, senioridade, modalidade, localização, contrato e experiências/competências/ferramentas realmente disponíveis no perfil. Produto considera, por exemplo, discovery/roadmap/backlog/analytics; Design considera UX/UI, pesquisa, prototipação, acessibilidade e Figma. A ausência de linguagem/framework não entra no denominador nem provoca penalidade. HTML/CSS em Design têm contribuição auxiliar limitada.

Sem evidência de perfil não se inventa um score. Scores são inteiros, determinísticos; competências são normalizadas/deduplicadas. `matchReasons` é opcional, com razões públicas sem pesos, descrição completa ou dados privados. As outras 11 famílias continuam delegando à fórmula anterior, testada sem alteração. Preferências são carregadas uma vez por busca, sem N+1 por vaga; auth e regras de usuário permanecem no Node.

Revisão de semântica das preferências: o schema HTTP e o frontend definem `jobTypes` como `Remoto`, `Híbrido`, `Presencial`, portanto o mapeamento para `modalities` é correto. A leitura de valores persistidos também valida esse enum e ignora listas legadas incompatíveis; não converte CLT/PJ/full-time/part-time/contract. `remoteOnly` continua separado de contrato, e `searchLocation` representa localização de busca. Foi removida a inferência de família por `keywords`: são strings livres, sem garantia de IDs canônicos. Não existe campo contratual de preferência de contratação ou família no modelo atual, portanto `contract` e `family` não são derivados dele. Schemas HTTP, persistência de preferências e frontend não foram alterados. Sete casos adicionais cobrem os dois scores, modalidade versus contrato, dados legados e keywords sem autoridade de família. Após esta revisão, os 123 testes selecionados de perfil/match/busca/fingerprint/contrato HTTP passaram (5 arquivos); typecheck e `git diff --check` também passaram. A execução HTTP foi repetida fora do sandbox porque ele bloqueava portas locais com EPERM.

## Validação executada

Serviços descartáveis locais: PostgreSQL 16 em porta 55432 e Redis 7.0.15 em porta 56379. A migration foi aplicada somente a schemas isolados de teste. Nenhuma migration/backfill/operação destrutiva foi executada na aplicação real. Redis exercita os comandos compatíveis utilizados; uma validação com Valkey 8 de produção continua recomendada na implantação.

| Check | Resultado |
| --- | --- |
| Backend `npm test -- --run`, com `PAV125_TEST_VALKEY_URL` | **76 arquivos, 826 testes aprovados**, incluindo unitários, contratos HTTP, integração Redis e compatibilidade da PAV-124 |
| Go `go test ./...`, com `PAV125_TEST_DATABASE_URL` e `PAV125_TEST_VALKEY_URL` | **Aprovado**, incluindo insert/upsert/ciclo, rollback/falha no commit sem indexação, batches, backfill, rebuild, reconciliação, reclassificação e streaming |
| Go `go test -race ./...`, mesmas dependências isoladas | **Aprovado**, sem races detectadas |
| Go `go vet ./...` | **Aprovado** |
| Backend `backend/node_modules/.bin/tsc --noEmit -p backend/tsconfig.json` | **Aprovado**, compilador do próprio módulo |
| Swagger/OpenAPI com `SwaggerParser.validate` | **Aprovado**, incluído na suíte backend |
| Compose com arquivos base/infra/migrate e `.env.example`, `config --quiet` | **Aprovado** |
| Build CLI Go com `CGO_ENABLED=0` | **Aprovado** |
| `git diff --check` | **Aprovado** |
| Lint | Backend não tem script/configuração de lint aplicável; ESLint da raiz ignora backend. Não há target/configuração adicional de lint Go definida; vet foi executado |

Os testes de integração externos são opt-in por essas variáveis, para não tocar bancos arbitrários; sem elas são ignorados. Nesta validação foram habilitados. Os casos de índice também usam testes locais controlados para preflight, falha parcial, deduplicação, desconhecidos, other, revisão atrasada, idempotência, primary/related/any e cancelamento. O teste de busca com mais de mil candidatos verifica hidratação limitada a 200 e total/página/ranking corretos.

Logs completos da execução local: `/tmp/pav125-backend-all.log`, `/tmp/pav125-go-all.log`, `/tmp/pav125-go-race.log` e `/tmp/pav125-go-vet.log`. Esses arquivos temporários não integram o repositório.

## Desempenho, riscos e limites

- Não foi medido p95 representativo de `/jobs/search`; **a meta de 500 ms não foi comprovada**. O teste de mil candidatos verifica limites funcionais e de hidratação, não representa benchmark de produção.
- Uma busca fria com filtros residuais/ranking ainda percorre candidatos em batches: memória Node limitada, mas custo O(N). O cache e os índices de família reduzem esse trabalho; não há garantia de latência sob grande catálogo.
- A consulta online usa um snapshot de IDs temporário e documentos hidratados em momentos diferentes. Atualizações concorrentes podem afetar uma leitura em andamento; não é snapshot transacional de documentos. CAS impede publicar cache de uma geração antiga; perda da hidratação final de ranking retorna erro em vez de diminuir silenciosamente a página.
- Expiração da projeção usa precisão de segundos. IDs expirados deixam de aparecer na busca imediatamente; limpeza física dos SETs acontece na manutenção antes da coleta agendada ou por `expire` explícito. Cache é evitado enquanto houver membros expirados pendentes.
- Manutenção exclusiva pode aguardar uma coleta em andamento e bloqueia novas publicações durante o rebuild; a API continua lendo o namespace ativo anterior. Histórico SQL e namespaces anteriores exigem políticas operacionais futuras de retenção/cleanup.
- Não há transação distribuída PostgreSQL/Valkey. Pendências são duráveis e reparáveis; correção da reconciliação permanece explícita. Não foi criado worker automático de outbox.
- Scripts multi-chave pressupõem o Valkey independente atual; migração futura para Cluster requer desenho de hash slots.
- O build da imagem Docker e benchmark em ambiente de produção não foram executados. Compose foi validado e o binário estático CLI foi compilado.

## Implantação e rollback

1. Pausar o coletor antigo para a migração inicial.
2. Aplicar a migration pelo mecanismo Drizzle existente e configurar PostgreSQL/Valkey/lifetime/TTL.
3. Executar `backfill` explicitamente se houver documentos legados; se o catálogo SQL já estiver preenchido, executar `rebuild`.
4. Conferir `reconcile` read-only e ativar o novo Processor/backend. O startup recusa catálogo existente sem namespace publicado, evitando bootstrap parcial silencioso.
5. Acompanhar falhas, revisões pendentes e relatório de consistência. Guardar o namespace anterior até a validação operacional; limpar somente por comando explícito.

Rollback de índices usa `rollback` com validação contra o SQL atual; namespace desatualizado é recusado. Se não for compatível, fazer novo rebuild do SQL. Rollback de código não remove tabela/sequence/histórico: o projeto usa migrations forward-only, sem padrão de down migration. Retornar a um Processor antigo exige pausa e plano de compatibilidade dos dados; não se deve permitir novamente que Valkey seja a única fonte durável. Nenhum rollback destrutivo foi executado.

## Escopo revisado e itens fora da task

Diff de código e arquivos novos revisados. Não houve alteração desta implementação em `frontend/**`, `front_admin/**` ou `package-lock.json`. Não houve nova taxonomia divergente, pós-filtro apenas após paginação, índice público other, autenticação movida ao Go ou comando de limpeza proibido.

Uma alteração concorrente em `.cspell/custom-dictionary-workspace.txt` apareceu no workspace durante o trabalho. Não foi produzida pela PAV-125 e foi preservada, sem revertê-la ou incluí-la no conjunto abaixo.

Fora do escopo: métricas Prometheus novas completas, match score das outras famílias, alteração do algoritmo de IDs, Redis Cluster, política de deleção histórica, lock distribuído de stampede, worker de outbox, novos filtros públicos, frontend, correções de lockfile e deploy/migration/backfill de produção.

## Arquivos alterados pela implementação

<!-- A lista abaixo inclui arquivos rastreados e novos da task. -->

- `.env.example`
- `BACKEND.md`
- `SCRAPER.md`
- `backend/PAV-125_REPORT.md`
- `backend/drizzle/0015_job_catalog.sql`
- `backend/drizzle/meta/0015_snapshot.json`
- `backend/drizzle/meta/_journal.json`
- `backend/src/db/schema/index.ts`
- `backend/src/db/schema/jobCatalog.ts`
- `backend/src/lib/cache.ts`
- `backend/src/modules/jobs/cache/jobSearchCache.ts`
- `backend/src/modules/jobs/cache/jobSearchFingerprint.ts`
- `backend/src/modules/jobs/cache/valkeySearchCache.adapter.ts`
- `backend/src/modules/jobs/repositories/jobSearch.repository.ts`
- `backend/src/modules/jobs/repositories/valkeyJobSearch.adapter.ts`
- `backend/src/modules/jobs/services/jobMatch.service.ts`
- `backend/src/modules/jobs/services/jobProfileMatch.service.ts`
- `backend/src/modules/jobs/services/searchJobs.service.ts`
- `backend/src/scripts/seedCatalogJobs.ts`
- `backend/src/swagger.ts`
- `backend/tests/integration/jobs.valkey.test.ts`
- `backend/tests/integration/routes/searchJobs.routes.test.ts`
- `backend/tests/unit/app.test.ts`
- `backend/tests/unit/libs/cache.test.ts`
- `backend/tests/unit/modules/jobs/jobMatch.service.test.ts`
- `backend/tests/unit/modules/jobs/jobProfileMatch.service.test.ts`
- `backend/tests/unit/modules/jobs/jobSearch.repository.test.ts`
- `backend/tests/unit/modules/jobs/jobSearchCache.test.ts`
- `backend/tests/unit/modules/jobs/jobSearchFingerprint.test.ts`
- `backend/tests/unit/modules/jobs/searchJobs.service.test.ts`
- `docker-compose.migrate.yml`
- `docker-compose.yml`
- `scraper-go/Dockerfile`
- `scraper-go/cmd/catalog/main.go`
- `scraper-go/cmd/server/admin_handlers.go`
- `scraper-go/cmd/server/catalog_stream_test.go`
- `scraper-go/cmd/server/handlers.go`
- `scraper-go/cmd/server/server.go`
- `scraper-go/go.mod`
- `scraper-go/go.sum`
- `scraper-go/internal/catalog/store.go`
- `scraper-go/internal/catalogops/maintenance.go`
- `scraper-go/internal/catalogops/maintenance_integration_test.go`
- `scraper-go/internal/config/config.go`
- `scraper-go/internal/config/config_test.go`
- `scraper-go/internal/cronjob/cronjob.go`
- `scraper-go/internal/domain/job.go`
- `scraper-go/internal/jobindex/index.go`
- `scraper-go/internal/jobindex/index_test.go`
- `scraper-go/internal/jobstore/jobstore.go`
- `scraper-go/internal/pipeline/catalog_integration_test.go`
- `scraper-go/internal/pipeline/index.go`
- `scraper-go/internal/pipeline/pipeline.go`
- `scraper-go/internal/pipeline/process.go`
- `scraper-go/internal/pipeline/product_test.go`
- `scraper-go/internal/pipeline/scrape.go`
