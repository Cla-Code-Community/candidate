# PAV-178 — Jobs Processor Performance & Staging Implementation Plan

## 1. Objetivo

Evoluir o Jobs Processor para reduzir de forma significativa o tempo total de processamento, indexação e disponibilização de vagas, preservando os contratos atuais de consistência, revisão, lifecycle, retry, recovery e projeção.

A implementação será feita por fases pequenas e verificáveis. Cada fase deve:

1. preservar os contratos existentes;
2. possuir testes próprios;
3. ser validada com benchmark antes/depois;
4. gerar um commit isolado;
5. somente liberar a próxima fase após validação.

O Greenhouse será utilizado como provider principal de benchmark por ser atualmente o maior cenário conhecido, com aproximadamente 3.339 adapters/fontes.

## 2. Diagnóstico confirmado

A investigação técnica da PAV-178 confirmou os seguintes pontos.

### 2.1 Indexação síncrona gera backpressure

O fluxo atual bloqueia o consumidor principal durante a indexação:

```text
enqueuePersisted
  -> flushIndexBuffer
  -> indexPersistedChunk
  -> espera concluir
  -> continua processamento
```

Enquanto a indexação ocorre, o pipeline deixa de consumir novos jobs, classificação e persistência seguintes aguardam, `incoming` cresce, `results` pode encher, workers de coleta ficam bloqueados e a coleta perde vazão.

### 2.2 `IndexKeys` é caro

Medições locais com as funções reais mostraram que, para 250 vagas, 445 keywords e descrição sintética de 16 KiB:

- preparação total: ~5,2 s;
- quase todo o custo está em `IndexKeys`;
- Build/metadata + serialização: ~42 ms;
- alocação cumulativa: ~9,5 GiB.

O custo está fortemente associado a repetição de normalização, buscas textuais repetidas, concatenação/cópia de strings e execução de matching para muitas keywords/subtermos.

### 2.3 Lua/Valkey não explica sozinho os 14–24 s observados

O Lua durável isolado em Redis descartável apresentou ordens de grandeza menores que a latência total observada no pipeline. Portanto, não se deve assumir que o Valkey sozinho é o gargalo.

### 2.4 Revision churn causa reprojeção desnecessária

Hoje um `ON CONFLICT` no catálogo gera nova revisão mesmo quando o conteúdo não mudou semanticamente.

```text
vaga reencontrada
  -> merge
  -> ON CONFLICT
  -> nova revision
  -> job_updated
  -> IndexKeys
  -> full apply no índice
```

Isso significa que vagas idênticas podem pagar novamente cálculo completo de chaves, serialização, remoção/reinserção de memberships, atualização de documentos, metadata e invalidação de geração.

### 2.5 `commands=0` não representa ausência de trabalho

No caminho durável, a variável `commands` não representa corretamente o trabalho executado pelo `jobindex.Apply`. Os logs atuais precisam ser corrigidos antes de serem usados como base de decisão.

### 2.6 Timeout global

O scheduler possui timeout global de 40 minutos. O timeout deve ser mantido inicialmente como proteção. Aumentá-lo antes das otimizações apenas esconderia capacidade insuficiente.

## 3. Princípios da nova arquitetura

### 3.1 PostgreSQL continua sendo Source of Truth

Valkey nunca deve ser tratado como a fonte durável definitiva das vagas. Uma vaga somente é considerada persistida após commit confirmado no PostgreSQL.

### 3.2 Valkey poderá exercer dois papéis distintos

#### Valkey Staging

Responsável por absorver bursts, deduplicar por `StableID`, consolidar múltiplas ocorrências, manter o estado mais recente durante uma janela e reduzir trabalho redundante antes das etapas caras.

#### Valkey Projection

Responsável por índices de busca, documentos de consulta, memberships, TTLs e projeção derivada do catálogo durável.

Os dois papéis devem permanecer conceitualmente separados, mesmo se inicialmente utilizarem a mesma infraestrutura.

### 3.3 O sistema deve processar mudanças, não ocorrências

O foco do pipeline deve mudar de quantidade de eventos coletados para:

```text
jobs únicos consolidados
  -> create
  -> real update
  -> refresh
```

### 3.4 Backpressure continua obrigatório

Filas, staging e workers devem possuir limites claros de jobs, bytes, tempo, retries e shutdown/drain.

### 3.5 Complexidade somente entra após ganho comprovado

Não implementar múltiplos workers, filas distribuídas ou aumento agressivo de concorrência antes de provar que as fases anteriores não são suficientes.

## 4. Arquitetura-alvo

```text
Providers
   |
   v
+-----------------------------+
| 1. Collection               |
| HTTP / adapters             |
| provider concurrency        |
| normalizacao minima         |
| StableID                    |
+-------------+---------------+
              |
              v
+-----------------------------+
| 2. Valkey Staging           |
| dedup por StableID          |
| coalescing                  |
| latest state                |
| burst absorption            |
| dirty/pending set           |
+-------------+---------------+
              |
              v
+-----------------------------+
| 3. Processing               |
| classification              |
| canonicalization            |
| change detection            |
| CREATE / UPDATE / REFRESH   |
+-------------+---------------+
              |
              v
+-----------------------------+
| 4. PostgreSQL Catalog       |
| SOURCE OF TRUTH             |
| batch persistence           |
| revision / lifecycle        |
| projection pending state    |
+-------------+---------------+
              |
              | COMMIT OK
              v
+-----------------------------+
| 5. Projection               |
| Valkey search/index         |
| full apply                  |
| diff apply                  |
| light refresh               |
+-----------------------------+
```

## 5. Estratégia de implementação por fases

### Fase 0 — Baseline e observabilidade correta

**Objetivo:** criar uma linha de base confiável antes de alterar comportamento.

Implementar métricas/logs separados para collection, classification, persistence, `IndexKeys`, Build/metadata, serialização, Redis/Lua, `MarkIndexed`, retries, backpressure, create, real update, refresh, full apply, refresh apply, skipped, fallback full, batch bytes e keys por job.

Corrigir a semântica de `commands=0`, `indexed=len(jobs)` e profundidade do buffer durante trabalho em andamento.

**Validação:** executar baseline Greenhouse com concorrência 6.

**Commit sugerido:**

```text
feat(PAV-178): adiciona baseline e observabilidade detalhada do pipeline
```

### Fase 1 — Otimização de IndexKeys

**Objetivo:** reduzir CPU, alocações e tempo de preparação sem alterar o resultado do índice.

Direção técnica:

- preprocessar keywords uma única vez por execução;
- normalizar texto uma única vez por job;
- evitar `" "+text+" "` repetido em loops internos;
- reduzir concatenações e cópias;
- reutilizar estruturas imutáveis de matching;
- reduzir normalizações repetidas de aliases/subtermos;
- preservar token boundaries, aliases e regras atuais.

**Meta:** >= 50% de redução no tempo e nas alocações cumulativas da preparação em fixtures representativas.

**Commit sugerido:**

```text
perf(PAV-178): otimiza preparação e geração de chaves de índice
```

### Fase 2 — Create / Real Update / Refresh

**Objetivo:** parar de tratar todo reencontro como alteração real.

Novo modelo:

- CREATE: novo job -> persistência completa -> nova revision -> full projection.
- REAL UPDATE: conteúdo relevante alterado -> nova revision -> full/diff projection.
- REFRESH: conteúdo equivalente -> renovar freshness -> evitar full reprojection.

Não simplesmente manter `revision` igual sem protocolo adicional. O modelo atual usa revision para lifecycle, fencing, retry, crash recovery, ordenação de tombstones e checkpoint de indexação.

Refresh leve deve atualizar ZSETs de expiração, TTL dos documentos, metadata/membership necessários, token de publicação e checkpoint SQL após confirmação. Se a projeção estiver ausente ou incompatível, fazer fallback para full apply.

**Commit sugerido:**

```text
feat(PAV-178): distingue create update e refresh no catálogo e índice
```

### Fase 3 — Coalescing antes do trabalho caro

**Objetivo:** consolidar múltiplas ocorrências do mesmo `StableID`.

Primeiro provar o conceito dentro do Processor antes de introduzir staging distribuído.

Medir eventos coletados, jobs únicos, taxa de redução por coalescing, duplicatas tardias, memória utilizada e latência introduzida.

Preservar merge de Sources, Keywords, latest valid state, lifecycle, cancellation e limites de memória.

**Commit sugerido:**

```text
perf(PAV-178): adiciona coalescing de jobs antes do processamento durável
```

### Fase 4 — Valkey Staging

**Objetivo:** absorver bursts de providers e desacoplar a velocidade da coleta da velocidade de persistência.

Contrato do staging:

```text
"job coletado e aguardando consolidação/persistência"
```

Nunca:

```text
"job já persistido"
```

Responsabilidades: chave lógica por `StableID`, latest state, dirty/pending set, dedup, coalescing, TTL, limite de jobs, limite de bytes, cleanup, retry e recovery definido.

**Commit sugerido:**

```text
feat(PAV-178): adiciona staging de jobs no Valkey
```

### Fase 5 — Persistência consolidada em PostgreSQL

**Objetivo:** entregar ao PostgreSQL somente jobs consolidados e classificados corretamente.

Fluxo esperado:

```text
250 jobs consolidados
  -> N creates
  -> N real updates
  -> N refreshes
```

Usar operações em batch sempre que possível e reduzir revision churn, updates inúteis, round-trips, lock contention e reprojeção posterior.

**Commit sugerido:**

```text
perf(PAV-178): consolida persistência em batch no catálogo durável
```

### Fase 6 — Projection Worker opcional

**Objetivo:** somente se necessário após as fases anteriores, desacoplar persistência e projeção.

Pré-requisito: a pendência deve ser durável. Não usar uma goroutine/fila apenas em memória como mecanismo de garantia.

Usar ou evoluir o conceito `indexed_revision < revision` ou equivalente que também represente corretamente refresh/freshness.

Worker deve possuir bounded queue, retry, recovery, shutdown/drain, lease/ownership, ordenação, stale revision fencing, erro propagável e confirmação de sucesso.

**Commit sugerido:**

```text
feat(PAV-178): adiciona worker durável de projeção
```

### Fase 7 — Lua e batch tuning

**Objetivo:** otimizar o script somente após reduzir o volume desnecessário.

Candidatos:

- aplicar apenas diferenças entre memberships;
- deduplicar validações `TYPE`;
- evitar `PERSIST` redundante;
- reduzir metadata duplicada;
- evitar SREM/SADD de associações inalteradas;
- calibrar batch por benchmark.

Comparar batches 50, 100, 125, 250 e 500. Não assumir que batch maior é melhor.

**Commit sugerido:**

```text
perf(PAV-178): otimiza projeção Valkey e calibra index batches
```

### Fase 8 — Benchmark Greenhouse e concurrency tuning

Ordem: 6 -> 8 -> 10 -> eventualmente 12.

Medir duração total, tasks produced/completed, jobs coletados/únicos, create/update/refresh, stage durations, queue depths, backpressure, CPU, RSS, GC, throttling, Valkey latency, PostgreSQL latency, lock renewal, HTTP errors, 429, timeouts e search latency.

**Critério inicial:** Greenhouse concurrency 6 deve terminar com margem antes dos 40 minutos. Meta inicial desejada: <= 30 minutos em execuções comparáveis.

**Commit sugerido, se houver tuning de configuração:**

```text
perf(PAV-178): calibra concorrência do Greenhouse após otimizações
```

### Fase 9 — Scheduling dos providers

Depois de medir cada provider, classificar como heavy, medium ou light e definir janelas de execução/coexistência conforme duração, volume, CPU, memória, downstream pressure e concorrência ótima.

## 6. Greenhouse como cenário de referência

O Greenhouse possui aproximadamente 3.339 adapters/fontes.

Cada adapter é uma tarefa e recebe o conjunto de keywords. Não são 3.339 × keywords tarefas HTTP, mas o processamento local ainda possui custo proporcional a jobs × keywords em partes do matching.

O Greenhouse deve ser tratado como cenário de stress principal da PAV-178.

### Atenção ao cache interno

O adapter mantém estado em memória como `loaded`, `cachedJobs` e `cacheErr`. Benchmarks devem controlar execução fria/quente para não comparar cenários diferentes.

## 7. Critérios de sucesso globais

A implementação só será considerada bem-sucedida se:

- IDs e documentos continuarem corretos;
- memberships continuarem corretos;
- reconciliação não encontrar novas divergências;
- refresh renovar todos os TTLs/expirações;
- revisões antigas não sobrescreverem estado novo;
- crash/retry não perder update nem refresh;
- busca não sofrer regressão relevante;
- distributed lock continuar renovando corretamente;
- IndexKeys reduzir significativamente custo;
- jobs idênticos deixarem de pagar full reprojection;
- p95 de `stage=index` cair;
- tempo de backpressure cair;
- Greenhouse 6 terminar antes de 40 min com margem;
- aumentar concurrency reduzir tempo total, não apenas aumentar bursts.

## 8. Estratégia de commits

Uma fase = um commit.

Antes de cada commit:

```bash
git diff --check
go test ./...
go test -race ./...
go vet ./...
```

Executar também testes/benchmarks específicos da fase.

Se um teste global falhar por dívida preexistente, registrar explicitamente e provar que não foi causado pela fase atual.

## 9. Regra de progressão

Após cada fase:

1. revisar diff;
2. executar testes;
3. executar benchmark específico;
4. comparar baseline;
5. registrar resultado;
6. somente então criar commit;
7. somente então iniciar próxima fase.

Se uma fase não produzir benefício mensurável ou introduzir complexidade desproporcional, parar, revisar arquitetura, simplificar ou reverter.

## 10. Fora de escopo inicial

Não fazer antes de necessidade comprovada:

- aumentar timeout como solução principal;
- múltiplos projection workers;
- batch 500 por padrão;
- remover estruturas de compatibilidade;
- transformar revision em revisão exclusivamente de conteúdo sem mecanismo equivalente de freshness/lifecycle;
- trocar PostgreSQL como source of truth;
- alterações no front_admin;
- alterações no backend Node não necessárias ao Processor.

## 11. Arquivos prováveis

```text
scraper-go/internal/pipeline/index.go
scraper-go/internal/pipeline/pipeline.go
scraper-go/internal/pipeline/process.go
scraper-go/internal/catalog/store.go
scraper-go/internal/jobstore/jobstore.go
scraper-go/internal/jobindex/index.go
scraper-go/internal/domain/job.go
scraper-go/internal/catalogops/maintenance.go
scraper-go/internal/metrics/*
scraper-go/internal/config/config.go
scraper-go/internal/cronjob/cronjob.go
scraper-go/cmd/server/server.go
```

O adapter Greenhouse poderá receber correção separada relacionada ao lifecycle do cache.

## 12. Resultado esperado

A arquitetura deve evoluir de um pipeline no qual a indexação bloqueia o restante do processamento para um sistema em que:

```text
coleta
  -> staging/coalescing
  -> processamento de jobs únicos
  -> PostgreSQL durável
  -> projeção eficiente
```

Cada estágio deverá operar com backpressure controlado, mas sem transformar a latência de indexação em bloqueio desnecessário da coleta.

O objetivo final da PAV-178 não é apenas reduzir o tempo de um cron. É aumentar throughput de vagas, frescor do catálogo, número de providers suportados, previsibilidade operacional e capacidade de escalabilidade do Jobs Processor.
