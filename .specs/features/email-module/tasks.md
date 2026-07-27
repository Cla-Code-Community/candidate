# Email Module — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Política de commit (AGENTS.md sobrepõe o skill):** o repositório proíbe commits automáticos ("NUNCA faça commits automaticamente. Sempre pergunte"). Portanto, os workers **implementam + rodam o gate por task, mas NÃO commitam**. Cada task deixa a mudança pronta e verificada; o orchestrator apresenta os commits atômicos propostos (mensagens em **português**) para o usuário aprovar. Um commit por task continua sendo a unidade — só que aplicado após aprovação.

**If the skill cannot be activated, STOP and tell the user.**

---

**Design**: `.specs/features/email-module/design.md`
**Spec**: `.specs/features/email-module/spec.md`
**Status**: ✅ Done — 11/11 tasks commitadas; Verifier PASS (529 testes, sensor 5/5); ver `validation.md`

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `AGENTS.md` (commits/pt-BR), `backend/vitest.config.js` (threshold 80%, `include: src/**/*.ts`), `TESTING.md` (QA manual, não automatiza), padrão de testes em `backend/tests/unit/modules/*` e `backend/tests/integration/routes/*`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Service (`EmailService`) | unit | Todas as branches; 1:1 com ACs; cada edge case listado | `backend/tests/unit/modules/email/*.test.ts` | `cd backend && npm test` |
| Provider (`Resend`, `Noop`, factory) | unit | Caminho-chave de envio + erro + seleção por env | `backend/tests/unit/modules/email/*.test.ts` | `cd backend && npm test` |
| Queue (`email.queue`) | unit | enqueue com opções de retry; guarda de conexão (mock bullmq/ioredis) | `backend/tests/unit/modules/email/*.test.ts` | `cd backend && npm test` |
| Worker (`email.worker`) | unit | processor renderiza+envia; falha propaga p/ retry; handler `failed` loga | `backend/tests/unit/modules/email/*.test.ts` | `cd backend && npm test` |
| Template Registry (`registry.ts`) | unit | render de `welcome` (nome + CTA + subject); template desconhecido rejeitado | `backend/tests/unit/modules/email/*.test.ts` | `cd backend && npm test` |
| Templates (`*.tsx`) | none | Verificados indiretamente via Registry (coverage exclui `.tsx`) | `backend/src/modules/email/templates/*.tsx` | build gate |
| Auth integration (`AuthService.register`) | unit | boas-vindas enfileirado no sucesso; registro conclui mesmo se envio falhar | `backend/tests/unit/modules/auth/*.test.ts` (ou existente) | `cd backend && npm test` |
| Config (`config.ts`) + `.env.example` | none | Sem teste dedicado no repo (padrão config) — build gate | `backend/src/config.ts` | build gate |
| Boot wiring (`server.ts`) | none | Lifecycle wiring — build gate | `backend/src/server.ts` | build gate |
| Deps / tsconfig | none | Toolchain — build gate | `backend/package.json`, `backend/tsconfig.json` | build gate |
| Docs | none | Documentação — sem teste | `BACKEND.md` / `docs/` | — |

## Gate Check Commands

> Confirmar antes do Execute. Backend não possui script de build/lint/typecheck; `npm test` (vitest run) roda unit + integração no mesmo runner e é o verificador determinístico.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit tests | `cd backend && npm test` |
| Full | Após tasks com integração | `cd backend && npm test` |
| Build | Fim de fase / tasks sem testes (config, deps, wiring, docs) | `cd backend && npm test` |

> Alvo de cobertura: novos arquivos `src/**/*.ts` devem atingir ~80% localmente (threshold do `vitest.config.js`). `npm run test:coverage --workspace=backend` é o comando de conferência de cobertura, usado pelo Verifier — não como gate por-task (evita falha por cobertura global pré-existente).

---

## Execution Plan

Fases ordenadas, executadas em sequência; tasks dentro da fase em ordem.

### Phase 1: Foundation (toolchain + config)

```
T1 → T2
```

### Phase 2: Provider layer

```
T3 → T4
```

### Phase 3: Templates

```
T5
```

### Phase 4: Transport + API interna

```
T6 → T7 → T8
```

### Phase 5: Integração + docs

```
T9 → T10 → T11
```

---

## Task Breakdown

### T1: Instalar dependências e habilitar JSX no backend

**What**: Adicionar `bullmq`, `ioredis`, `resend`, `react@19`, `react-dom@19`, `@types/react@19` (dev), `@react-email/render` ao backend e habilitar `"jsx": "react-jsx"` no tsconfig.
**Where**: `backend/package.json`, `backend/tsconfig.json`
**Depends on**: None
**Reuses**: —
**Requirement**: EMAIL-02, EMAIL-04 (habilitadores)

**Tools**:
- MCP: `context7` (conferir versões/peer deps de `@react-email/render` e `bullmq`)
- Skill: NONE

**Done when**:
- [ ] `react`/`react-dom` em `^19` e `@types/react` em `^19` (casam com frontend; evita bug `@types/react@18`)
- [ ] `bullmq`, `ioredis`, `resend`, `@react-email/render` instalados
- [ ] `tsconfig.json` com `"jsx": "react-jsx"`
- [ ] Gate passa: `cd backend && npm test` (suíte existente continua verde)

**Tests**: none
**Gate**: build

---

### T2: Adicionar configuração de e-mail

**What**: Adicionar campos de e-mail ao `AppConfig`/`getConfig()` e ao `.env.example`: `emailApiKey`, `emailFromAddress`, `emailFromName`, `emailQueueAttempts` (default 3) e reuso de `frontendUrl` (env `FRONTEND_URL` já existente) para o CTA.
**Where**: `backend/src/config.ts`, `.env.example`
**Depends on**: None
**Reuses**: padrão `parseNumber`/`getConfig` em `src/config.ts`; env `FRONTEND_URL`
**Requirement**: EMAIL-04, EMAIL-07, EMAIL-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `getConfig()` retorna os novos campos com defaults seguros (chave vazia ⇒ string vazia)
- [ ] `emailQueueAttempts` parseado como número com default 3
- [ ] `frontendUrl` exposto a partir de `FRONTEND_URL`
- [ ] `.env.example` documenta `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_QUEUE_ATTEMPTS`
- [ ] Gate passa: `cd backend && npm test`

**Tests**: none
**Gate**: build

---

### T3: Interface MailProvider + NoopProvider + factory

**What**: Definir `interface MailProvider { send(msg) }`, implementar `NoopProvider` (loga, não envia, não lança) e `getMailProvider()` que retorna Resend quando `EMAIL_API_KEY` presente, senão Noop.
**Where**: `backend/src/modules/email/providers/mail-provider.ts`, `backend/src/modules/email/providers/noop.provider.ts`
**Depends on**: T2
**Reuses**: `logWarn` (`src/logger.ts`), `getConfig` (`src/config.ts`)
**Requirement**: EMAIL-04, EMAIL-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `getMailProvider()` retorna `NoopProvider` quando `emailApiKey` vazio e `ResendProvider` quando presente
- [ ] `NoopProvider.send` loga aviso e resolve sem lançar
- [ ] Testes unitários cobrem seleção por env + no-op sem throw
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: quick

---

### T4: ResendProvider

**What**: Implementar `ResendProvider.send({to,subject,html,replyTo})` via SDK `resend`, usando `from` = `EMAIL_FROM_NAME <EMAIL_FROM_ADDRESS>`; lançar em falha do SDK (para o BullMQ re-tentar).
**Where**: `backend/src/modules/email/providers/resend.provider.ts`
**Depends on**: T1, T2, T3
**Reuses**: interface de T3, `getConfig`, `logError`
**Requirement**: EMAIL-02, EMAIL-04

**Tools**:
- MCP: `context7` (assinatura de `resend.emails.send`)
- Skill: NONE

**Done when**:
- [ ] `send` chama o SDK com `{ from, to, subject, html, replyTo? }` mapeados corretamente
- [ ] Erro do SDK é propagado (lançado), não engolido
- [ ] Testes unitários mockam `resend` e asseveram payload + propagação de erro
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: quick

---

### T5: Templates react-email + TemplateRegistry

**What**: Criar `BaseLayout.tsx`, `welcome.tsx` (props `{ name, appUrl }`, com botão "Acessar plataforma" → `appUrl`) e `registry.ts` (`TemplateName`, `isTemplate`, `renderTemplate` async via `@react-email/render`, com `subject` por template).
**Where**: `backend/src/modules/email/templates/BaseLayout.tsx`, `welcome.tsx`, `registry.ts`
**Depends on**: T1
**Reuses**: `@react-email/render`
**Requirement**: EMAIL-07, EMAIL-05 (template desconhecido)

**Tools**:
- MCP: `context7` (`render` async do react-email; componentes)
- Skill: NONE

**Done when**:
- [ ] `renderTemplate('welcome', { name, appUrl })` retorna `{ subject, html }` com HTML contendo o `name` e um link/botão com `href` = `appUrl`
- [ ] `isTemplate('desconhecido')` é `false`; `renderTemplate` com nome inválido rejeita/lança
- [ ] Testes unitários no registry cobrem render de welcome (nome + CTA href + subject) e rejeição de template desconhecido
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit (registry) · templates `.tsx` = none (via registry)
**Gate**: quick

---

### T6: EmailQueue (BullMQ sobre Valkey)

**What**: Criar fila `email` com conexão `ioredis` dedicada ao `VALKEY_URL` (`maxRetriesPerRequest: null`), expor `getEmailQueue()`, `enqueueEmail(data)` (com `attempts` = config, `backoff` exponencial) e `closeEmailQueue()`.
**Where**: `backend/src/modules/email/email.queue.ts`
**Depends on**: T1, T2
**Reuses**: padrão singleton de `src/lib/cache.ts`; `VALKEY_URL`; `getConfig`
**Requirement**: EMAIL-01, EMAIL-03

**Tools**:
- MCP: `context7` (`Queue`/opções de `add` do BullMQ)
- Skill: NONE

**Done when**:
- [ ] `enqueueEmail` adiciona job com `attempts` = `emailQueueAttempts` e backoff exponencial
- [ ] Conexão ioredis criada com `maxRetriesPerRequest: null`
- [ ] Testes unitários mockam `bullmq`/`ioredis` e asseveram opções do job
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: quick

---

### T7: EmailWorker

**What**: Criar `startEmailWorker()`/`stopEmailWorker()`: processor que renderiza o template (`renderTemplate`) e despacha via `getMailProvider().send(...)`; `on('failed')` loga erro no fracasso final. Falha do provider propaga (BullMQ re-tenta).
**Where**: `backend/src/modules/email/email.worker.ts`
**Depends on**: T3, T4, T5, T6
**Reuses**: `getMailProvider`, `renderTemplate`, `logInfo/logError`
**Requirement**: EMAIL-02, EMAIL-03

**Tools**:
- MCP: `context7` (`Worker` do BullMQ)
- Skill: NONE

**Done when**:
- [ ] Processor renderiza template e chama `provider.send({ to, subject, html })` com os valores renderizados
- [ ] Erro do provider é propagado pelo processor (permite retry do BullMQ)
- [ ] Handler `failed` registra erro (log) sem lançar
- [ ] Testes unitários mockam registry+provider e asseveram: payload enviado (to/subject/html), propagação de erro, log no failed
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: quick

---

### T8: EmailService (API interna)

**What**: Criar `EmailService` com `send({template,to,data})` — valida formato de `to` e existência de `template` (senão `AppError.validation`), enfileira via `enqueueEmail`; falha de enqueue é logada e **não** propagada. `sendWelcome({email,name})` injeta `appUrl` = `config.frontendUrl` e chama `send`.
**Where**: `backend/src/modules/email/email.service.ts`
**Depends on**: T5, T6
**Reuses**: `enqueueEmail`, `isTemplate`, `AppError`, `logError`, `getConfig`
**Requirement**: EMAIL-01, EMAIL-05, EMAIL-06, EMAIL-07, EMAIL-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `send` válido enfileira job com `{ template, to, data }`
- [ ] `to` inválido OU `template` desconhecido ⇒ `AppError.validation` e **nenhum** enqueue
- [ ] Falha no `enqueueEmail` ⇒ `send` resolve (erro logado, não propagado)
- [ ] `sendWelcome` injeta `appUrl` do `frontendUrl` e usa template `welcome`
- [ ] Testes unitários cobrem: enqueue no caminho feliz, validação (to/template) sem enqueue, enqueue-throw engolido, sendWelcome com appUrl
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: quick

---

### T9: Iniciar/parar worker no boot do servidor

**What**: Chamar `startEmailWorker()` no boot e `stopEmailWorker()` + `closeEmailQueue()` no graceful shutdown do servidor.
**Where**: `backend/src/server.ts`
**Depends on**: T6, T7
**Reuses**: padrão de shutdown existente (`closeCache`)
**Requirement**: EMAIL-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Worker inicia no boot do servidor
- [ ] Shutdown fecha worker e fila junto dos recursos existentes
- [ ] Gate passa: `cd backend && npm test` (suíte não quebra)

**Tests**: none (wiring — build gate)
**Gate**: build

---

### T10: Disparar boas-vindas no registro

**What**: No `AuthService.register`, após o registro concluir com sucesso, chamar `emailService.sendWelcome({ email, name })` dentro de try/catch que apenas loga — nunca propaga.
**Where**: `backend/src/modules/auth/**` (arquivo do `register`) + teste correspondente
**Depends on**: T8
**Reuses**: `EmailService`, `logError`, padrão de teste de auth existente
**Requirement**: EMAIL-06, EMAIL-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Registro bem-sucedido chama `sendWelcome` com email + nome do usuário
- [ ] Exceção em `sendWelcome` NÃO altera o retorno de sucesso do registro
- [ ] Testes unitários: welcome enfileirado no sucesso; registro ainda retorna sucesso quando `sendWelcome` lança
- [ ] Gate passa: `cd backend && npm test`

**Tests**: unit
**Gate**: full

---

### T11: Documentação do módulo de e-mail

**What**: Documentar uso do módulo (API interna `emailService.send/sendWelcome`, envs, como adicionar novo template/provider) no `BACKEND.md` (e/ou `docs/`).
**Where**: `BACKEND.md`
**Depends on**: T8
**Reuses**: estilo do `BACKEND.md`
**Requirement**: EMAIL-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Seção "Módulo de E-mail" com exemplo de uso, envs e passo p/ novo template/provider
- [ ] Gate passa: `cd backend && npm test` (docs não quebram nada)

**Tests**: none (docs)
**Gate**: build

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 ──→ T2
Phase 2:  T3 ──→ T4
Phase 3:  T5
Phase 4:  T6 ──→ T7 ──→ T8
Phase 5:  T9 ──→ T10 ──→ T11
```

Execução estritamente sequencial — sem paralelismo intra-fase.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: deps + jsx | toolchain (2 arquivos coesos) | ✅ Granular |
| T2: config e-mail | 1 concern (config) | ✅ Granular |
| T3: interface + Noop + factory | 1 concern coeso (contrato+fallback) | ✅ Granular |
| T4: ResendProvider | 1 classe | ✅ Granular |
| T5: templates + registry | 1 concern coeso (templates+lookup) | ✅ Granular |
| T6: EmailQueue | 1 módulo (fila) | ✅ Granular |
| T7: EmailWorker | 1 módulo (worker) | ✅ Granular |
| T8: EmailService | 1 classe (API interna) | ✅ Granular |
| T9: boot wiring | 1 arquivo (server.ts) | ✅ Granular |
| T10: integração register | 1 função (register) | ✅ Granular |
| T11: docs | 1 arquivo (docs) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (início) | ✅ Match |
| T2 | None | (início) | ✅ Match |
| T3 | T2 | Phase 2 pós Phase 1 | ✅ Match |
| T4 | T1, T2, T3 | T3 → T4 (+ deps fase 1) | ✅ Match |
| T5 | T1 | Phase 3 pós Phase 1 | ✅ Match |
| T6 | T1, T2 | Phase 4 pós fase 1 | ✅ Match |
| T7 | T3, T4, T5, T6 | T6 → T7 (+ provider/template) | ✅ Match |
| T8 | T5, T6 | T7 → T8 na ordem; deps T5/T6 anteriores | ✅ Match |
| T9 | T6, T7 | Phase 5 pós Phase 4 | ✅ Match |
| T10 | T8 | pós Phase 4 | ✅ Match |
| T11 | T8 | pós Phase 4 | ✅ Match |

> Todas as dependências apontam para trás ou para fase anterior — nenhuma dependência de fase posterior.

---

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | deps/tsconfig | none | none | ✅ OK |
| T2 | config | none | none | ✅ OK |
| T3 | provider/factory | unit | unit | ✅ OK |
| T4 | provider | unit | unit | ✅ OK |
| T5 | registry (+ templates none) | unit | unit | ✅ OK |
| T6 | queue | unit | unit | ✅ OK |
| T7 | worker | unit | unit | ✅ OK |
| T8 | service | unit | unit | ✅ OK |
| T9 | boot wiring | none | none | ✅ OK |
| T10 | auth service (integração) | unit | unit | ✅ OK |
| T11 | docs | none | none | ✅ OK |

> Nenhum `Tests: none` esconde deferral: todos os `none` correspondem a camadas que a matriz marca como `none` (deps, config, wiring, docs, templates `.tsx`).

---

## Sub-Agent Batching (para o Execute)

Total: **11 tasks** em 5 fases `[2,2,1,3,3]`. Empacotando ~7 tasks/worker por fronteira de fase:

- **Batch A — Blocos de construção** (Fases 1–3): T1–T5 (5 tasks) — deps/config, providers, templates. Folhas sem interdependência além das deps.
- **Batch B — Montagem + integração** (Fases 4–5): T6–T11 (6 tasks) — fila, worker, service, boot, registro, docs. Depende integralmente do Batch A.

→ **2 workers**, sequenciais (Batch B só inicia após Batch A reportar tudo completo). Verifier roda automaticamente após T11.

**Commits:** workers NÃO commitam (AGENTS.md). Após cada batch, o orchestrator apresenta os commits atômicos propostos (pt-BR) para aprovação do usuário.
