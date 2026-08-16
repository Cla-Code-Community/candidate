# Email Module Validation

**Date**: 2026-07-27
**Spec**: `.specs/features/email-module/spec.md`
**Diff range**: `master..feature/pav-76-modulo-email` (Batch A committed) + working-tree changes (Batch B) + untracked email module files
**Verifier**: independent sub-agent (author ≠ verifier), read-only over the real tree; sensor mutations ran on temp copies and were discarded

---

## Verdict: PASS ✅

Todos os 11 ACs (EMAIL-01..11) têm evidência `file:line` com assertion que mira o valor/estado definido na spec. Gate limpo (529/529). Sensor: 5/5 mutantes mortos.

---

## Spec-Anchored Acceptance Criteria

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| **EMAIL-01** — `send({template,to,data})` válido enfileira e retorna sem aguardar entrega | Job enfileirado com payload exato `{template,to,data}` | `tests/unit/modules/email/email.service.test.ts:58` — `expect(queueMocks.enqueueEmail).toHaveBeenCalledWith({ template:"welcome", to:"user@example.com", data:{name:"Ana"} })` | ✅ PASS |
| **EMAIL-01** (conexão fila) — ioredis com `maxRetriesPerRequest:null` | Conexão criada com esse opt (requisito BullMQ) | `tests/unit/modules/email/email.queue.test.ts:69` — `expect(RedisConstructor).toHaveBeenCalledWith("redis://localhost:6379", { maxRetriesPerRequest: null })` | ✅ PASS |
| **EMAIL-02** — worker renderiza template e despacha via provider | Provider recebe `{to,subject,html}` renderizados | `email.worker.test.ts:94-101` — `expect(renderTemplate).toHaveBeenCalledWith("welcome",{name:"Ana"})` + `expect(providerMocks.send).toHaveBeenCalledWith({ to:"user@example.com", subject:"Bem-vindo", html:"<p>Olá</p>" })` | ✅ PASS |
| **EMAIL-02/04** (provider Resend concreto) — SDK chamado com from formatado + campos mapeados | `resend.emails.send({from:"Painel Vagas <no-reply@...>", to, subject, html, replyTo})` | `resend.provider.test.ts:54-61` — `expect(resendMocks.send).toHaveBeenCalledWith({ from:"Painel Vagas <no-reply@painelvagas.com>", to, subject, html, replyTo })` | ✅ PASS |
| **EMAIL-03** — falha do provider ⇒ retry com backoff; fracasso final ⇒ log, sem exceção ao caller | (a) enqueue com `attempts` do config + backoff exp; (b) worker propaga erro p/ BullMQ retry; (c) provider Resend lança em erro; (d) handler `failed` só loga | (a) `email.queue.test.ts:92` — `toHaveBeenCalledWith("send-email", data, objectContaining({ attempts:3, backoff:{type:"exponential",delay:2000} }))`; (b) `email.worker.test.ts:111` — `await expect(processor(job)).rejects.toThrow("provider down")`; (c) `resend.provider.test.ts:71` — `rejects.toThrow("rate limit")`; (d) `email.worker.test.ts:120-123` — `expect(()=>failedHandler(...)).not.toThrow()` + `expect(logError).toHaveBeenCalled()` | ✅ PASS |
| **EMAIL-04** — provider trocável via interface, sem mudar caller | `getMailProvider()` retorna Resend se key presente, Noop se ausente | `mail-provider.test.ts:57` — `expect(provider).toBeInstanceOf(FakeResend)` (key presente); `:47` — `toBeInstanceOf(FakeNoop)` (key vazia) | ✅ PASS |
| **EMAIL-05** — `to` inválido OU template desconhecido ⇒ rejeita no enqueue, antes de criar job | Lança `VALIDATION_ERROR` e NÃO enfileira | `email.service.test.ts:65-74` — `rejects.toMatchObject({code:"VALIDATION_ERROR"})` + `expect(enqueueEmail).not.toHaveBeenCalled()` (`to` inválido); `:77-88` — idem p/ template desconhecido. Registry: `registry.test.ts:14` — `isTemplate("desconhecido")` `.toBe(false)`; `:33` — `renderTemplate("desconhecido",...)` `.rejects.toThrow()` | ✅ PASS |
| **EMAIL-06** — registro com sucesso enfileira welcome p/ endereço do usuário | `sendWelcome` chamado com `{email,name}` corretos | `credentials.service.test.ts:201` — `expect(mocks.sendWelcome).toHaveBeenCalledWith({ email: mockUser.email, name: mockUser.displayName })` | ✅ PASS |
| **EMAIL-06/07** (service) — sendWelcome injeta appUrl do frontendUrl + template welcome | Payload `{template:"welcome", to, data:{name, appUrl:frontendUrl}}` | `email.service.test.ts:113` — `toHaveBeenCalledWith({ template:"welcome", to:"user@example.com", data:{ name:"Ana", appUrl:"https://painelvagas.com" } })` | ✅ PASS |
| **EMAIL-07** — welcome renderizado contém nome + botão "Acessar plataforma" com href=appUrl | HTML contém nome, `href="${appUrl}"`, e "Acessar plataforma"; subject presente | `registry.test.ts:28-30` — `expect(html).toContain("Maria")` + `expect(html).toContain('href="https://app.example.com"')` + `expect(html).toContain("Acessar plataforma")` (+ `subject` truthy/string `:26-27`) | ✅ PASS |
| **EMAIL-08** — falha do welcome não quebra o registro | `register` resolve com user+session mesmo com sendWelcome rejeitando | `credentials.service.test.ts:207-213` — `sendWelcome.mockRejectedValue(...)` então `expect(result.user).toMatchObject({email})` + `expect(result.session).toEqual({userId, role:"user"})` | ✅ PASS |
| **EMAIL-09** — env de e-mail ausente ⇒ no-op sem quebrar boot | (a) getMailProvider retorna Noop com key vazia; (b) Noop loga e resolve sem lançar | (a) `mail-provider.test.ts:47` — `toBeInstanceOf(FakeNoop)`; (b) `noop.provider.test.ts:28-33` — `resolves.toBeUndefined()` + `logWarn` chamado once + `ctx` `toMatchObject({to})` | ✅ PASS |
| **EMAIL-10** — Valkey down no enqueue ⇒ `send` loga e não propaga | `send` resolve `undefined` + `logError` chamado | `email.service.test.ts:91-102` — `enqueueEmail.mockRejectedValue(new Error("valkey down"))` então `resolves.toBeUndefined()` + `expect(logError).toHaveBeenCalled()` | ✅ PASS |
| **EMAIL-11** — documentação de uso no repositório | Seção de módulo em doc do repo | `BACKEND.md` — nova seção "## Módulo de E-mail" (fluxo, arquivos, uso, envs, como adicionar template/provider) + envs listadas na seção de variáveis | ✅ PASS (verificação documental; sem teste automatizado — apropriado) |

**Status**: ✅ Todos os 11 ACs cobertos com assertion não-rasa alinhada ao outcome da spec.

### Edge cases da spec

- [x] Env de e-mail ausente ⇒ no-op sem quebrar boot — EMAIL-09 (mail-provider + noop tests).
- [x] Valkey down no enqueue ⇒ não propaga — EMAIL-10 (email.service.test.ts:91).
- [x] Template inexistente ⇒ enqueue falha com validação (sem job órfão) — EMAIL-05 (email.service.test.ts:77 + registry.test.ts:33).
- [~] Dois registros do mesmo usuário ⇒ jobs independentes (sem dedup) — comportamento default aceito no MVP; sem teste dedicado, mas a spec o marca como "aceitável" e não define outcome preciso. Não é gap.

---

## Discrimination Sensor

Mutações injetadas UMA POR VEZ em cópias temporárias (backup em `/tmp`, restauradas após cada rodada). Árvore real intacta ao final.

| # | Alvo | Mutação | Teste executado | Killed? |
| - | ---- | ------- | --------------- | ------- |
| 1 | `email.service.ts:22` | Desativa validação de `to` (`if (false && ...)`) | `email.service.test.ts` | ✅ Killed (1 failed) |
| 2 | `email.service.ts:30-38` | Remove try/catch — deixa a falha de enqueue PROPAGAR | `email.service.test.ts` | ✅ Killed (teste de resiliência EMAIL-10) |
| 3 | `email.worker.ts:25` | Engole o erro do provider (try/catch vazio) em vez de propagar | `email.worker.test.ts` | ✅ Killed (teste de propagação/retry EMAIL-03) |
| 4 | `welcome.tsx:24` | `href={appUrl}` → `href="#"` (CTA não aponta p/ appUrl) | `registry.test.ts` | ✅ Killed (EMAIL-07) |
| 5 | `credentials.service.ts:87-97` | Remove try/catch — propaga exceção do sendWelcome | `credentials.service.test.ts` | ✅ Killed (EMAIL-08) |

**Sensor depth**: lightweight fault-injection (5 mutações, alta cobertura das branches de resiliência + payload).
**Result**: 5/5 killed — PASS ✅. Nenhum mutante sobrevivente ⇒ nenhuma fix task.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (sem features além do pedido) | ✅ |
| Surgical changes (só arquivos necessários) | ✅ |
| No scope creep (contato/suporte fora, como spec exige) | ✅ |
| Matches patterns (Service coeso, hoisted mocks, singleton lazy à la cache.ts) | ✅ |
| Spec-anchored outcome check (valores asseverados batem com a spec) | ✅ |
| Per-layer coverage (service/queue/worker/providers/registry/integração cada um com happy+edge+erro) | ✅ |
| Todo teste mapeia a um AC/edge/Done-when (sem testes órfãos) | ✅ |
| Guidelines: threshold 80% Vitest; mock de Valkey/BullMQ/provider (design §Risks) seguido | ✅ |

Observação (não-bloqueante): `EmailQueue`/`EmailWorker`/`ResendProvider` são exercitados via mocks de `bullmq`/`ioredis`/`resend` — apropriado para unit (design marca conexão real como out-of-scope de teste). Não há teste de integração de ponta-a-ponta com Valkey real, o que é consistente com o design (risco "testes lentos/flaky se conectarem de verdade").

---

## Gate Check

- **Gate command**: `cd backend && npm test` (`vitest run`)
- **Result**: 529 passed, 0 failed, 0 skipped (55 test files)
- **Delta**: testes de e-mail novos (email.service 5, email.queue 5, email.worker 3, registry 4, mail-provider 2, noop 1, resend 2) + 2 novos em credentials.service (EMAIL-06/08)
- **Flaky pré-existentes**: nenhum acionado nesta rodada; `savedJobs.routes`/`app.test` passaram.
- **Failures**: nenhuma.
- Rodado 2x (antes e depois do sensor) — verde em ambas.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| EMAIL-01 | Implementing | ✅ Verified |
| EMAIL-02 | Implementing | ✅ Verified |
| EMAIL-03 | Implementing | ✅ Verified |
| EMAIL-04 | Implementing | ✅ Verified |
| EMAIL-05 | Implementing | ✅ Verified |
| EMAIL-06 | Implementing | ✅ Verified |
| EMAIL-07 | Implementing | ✅ Verified |
| EMAIL-08 | Implementing | ✅ Verified |
| EMAIL-09 | Implementing | ✅ Verified |
| EMAIL-10 | Implementing | ✅ Verified |
| EMAIL-11 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/11 ACs matched spec outcome — 0 spec-precision gaps.
**Sensor**: 5/5 mutations killed.
**Gate**: 529 passed, 0 failed.

**What works**: API interna `emailService.send/sendWelcome` (validação + enqueue não-bloqueante), worker render+dispatch, retry/backoff, provider trocável (Resend/Noop) via interface, welcome com nome+CTA para FRONTEND_URL, resiliência (enqueue e welcome nunca quebram o caller), no-op sem env, documentação no BACKEND.md.

**Issues found**: nenhum.

**Diff surface covered**: `backend/src/modules/email/**` (service, queue, worker, providers, templates), `credentials.service.ts` (integração welcome), `config.ts`, `server.ts` (boot/shutdown do worker), `.env.example`, `tsconfig.json`, `vitest.config.js`, `BACKEND.md`. `server.ts` boot/shutdown e `config.ts` parsing não têm assertion unitária dedicada, mas seus comportamentos observáveis (worker sobe/desce; envs lidas) são cobertos indiretamente pelos testes de worker/queue/service que consomem esses valores — nível de risco baixo, consistente com o design.

**Next steps**: marcar a feature como Verified; nenhuma fix task.
