# Backend - Documentação

Este documento descreve as principais funcionalidades, rotas, módulos e variáveis de ambiente do backend do projeto.

**Localização do código**: [backend](backend)

## Visão geral

- API REST em Express (TypeScript).
- Scraper externo em Go integrado via HTTP (`GO_SCRAPER_URL`).
- Banco de dados gerenciado com Drizzle (Postgres).
- Autenticação via OAuth (Google/GitHub/LinkedIn) e credenciais (email/senha) com `iron-session`.
- Cache/índices em memória (Redis) e integração com sistema Valkey para pesquisa rápida.
- Rotas administrativas para usuários, permissões, scrapers, auditoria e observabilidade.
- Métricas Prometheus em `/metrics`.
- Documentação OpenAPI/Swagger disponível em `/docs` (quando habilitado).

## Como executar (rápido)

Requisitos: Node.js >= 22, PostgreSQL, Redis (opcional para cache), Go scraper (opcional)

Instalar dependências e rodar API:

```bash
cd backend
npm install
npm run dev   # inicia em modo de desenvolvimento
# ou
npm start     # inicia a API
```

Testes:

```bash
npm test
npm run test:watch
```

Scripts relevantes em `backend/package.json`:

- `start`, `dev`, `api` — iniciar servidor
- `test`, `test:coverage`, `test:watch`, `validate` — testes com Vitest (`validate` roda `npm test`)
- `db:generate`, `db:migrate`, `db:push` — comandos Drizzle
- `db:seed` — popula o banco local com usuários e dados de teste (`src/scripts/seed.ts`, idempotente; ver [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md#61-seed-e-testes-da-api-local))
- `security:backfill-user-pii` — backfill de campos de PII criptografados
- `clear-cache` — limpa cache/índices no Valkey (`src/cache/clearCache.ts`)

## Arquitetura e módulos principais

- `src/app.ts` — monta a aplicação Express, middlewares e rotas.
- `src/server.ts` — inicia o servidor e registra Swagger (`/docs`).
- `src/config.ts` — leitura e validação das variáveis de ambiente.
- `src/swagger.ts` — gera especificação OpenAPI via `swagger-jsdoc`.

Módulos principais:

- `src/modules/auth` — OAuth providers, `AuthController`, `AuthService`, `credentials` (registro/login/logout).
- `src/modules/users` — perfis e preferências do usuário (`UsersController`, `UsersService`).
- `src/modules/savedJobs` — CRUD de vagas salvas (`SavedJobsController`, `SavedJobsService`).
- `src/modules/notifications` — notificações do usuário autenticado.
- `src/modules/jobs` — busca, parsing de filtros, repository com consulta em lotes e regras de matching/score de vagas.
- `src/modules/admin` — usuários admin, permissões, scrapers, auditoria, dashboard e observabilidade.
- `src/modules/email` — envio de e-mails transacionais assíncronos (ver seção [Módulo de E-mail](#módulo-de-e-mail)).

Adaptadores externos:

- `src/adapters/goScraper.ts` — envia requisições para o serviço Go que faz o scraping (`/scrape`).
- `src/adapters/goKeywords.ts` — carrega e envia keywords do/para o serviço Go.

Database / Schemas (Drizzle):

- `src/db/schema/users.ts` — tabela `users`. Campo `role` (enum `user_role`: `user` < `support` < `admin` < `super_admin`, hierarquia crescente) e `isBlocked`. Vários campos de PII (`email`, `firstName`, `lastName`, `displayName`, `phone`, `cpf`, `technologies`, `level`) existem em par: uma coluna em texto plano (legado/transição) e uma coluna `*Encrypted` com o valor cifrado (AES-256-GCM, `src/lib/security/encryption.ts`); `emailHash`/`cpfHash` guardam hash HMAC pesquisável (`src/lib/security/searchableHash.ts`) para permitir busca sem descriptografar. O fluxo de criação/atualização sempre grava a versão criptografada e zera a coluna plana.
- `src/db/schema/credentials.ts` — credenciais de login local (`email`, `emailHash`, `passwordHash`), 1:1 com `users` via `userId`.
- `src/db/schema/accounts.ts` — vínculos OAuth (`provider`, `providerAccountId`, tokens) associados a um `users.id`.
- `src/db/schema/keywords.ts` — palavras-chave (fonte `user|scraper`).
- `src/db/schema/savedJobs.ts` — vagas salvas (`saved_jobs`); campo `status` aceita `saved`, `applied`, `interviewing`, `rejected`, `accepted`; campo `notes` guarda anotação privada do usuário sobre a vaga.
- `src/db/schema/applicationEvents.ts` — `application_events`: histórico de mudança de status de uma vaga salva (`fromStatus`/`toStatus`), exposto em `GET /saved-jobs/:id/events`.
- `src/db/schema/applicationNotes.ts` — `application_notes`: múltiplas notas privadas por vaga salva (`content`, timestamps), uma tabela separada do campo legado `saved_jobs.notes` — CRUD completo em `/saved-jobs/:id/notes`.
- `src/db/schema/userPreferences.ts` — `user_preferences`: preferências de busca e checklist de carreira do usuário, criada automaticamente no registro.
- `src/db/schema/userNotifications.ts` — `user_notifications`: notificações in-app do usuário.
- `src/db/schema/auditLogs.ts` — `audit_logs`: trilha de ações administrativas (ator, ação, alvo, metadata).
- `src/db/schema/permissionRules.ts` — `permission_rules`: matriz de permissões (recurso/ação/role mínima) persistida no banco, além da matriz em código (`src/modules/admin/permissions/permissionMatrix.ts`).
- Migrações e snapshots em `drizzle/`.

Cache & Indexes:

- `src/lib/cache.ts` — helpers para Redis/Valkey; usado pelo módulo de jobs para obter ids e buscar vagas em memória.
- Busca por palavras-chave usa índices invertidos e interseção para eficiência.
- Filtros estruturados podem usar índices por família (`family`), tecnologia (`technology`), senioridade (`seniority`), localização, modelo e contrato.

## Módulo de E-mail

Módulo centralizado em `src/modules/email` para envio de e-mails transacionais de forma **assíncrona e resiliente**. Qualquer módulo do backend consome a mesma API interna (`emailService`), sem conhecer o provedor.

**Fluxo:** `emailService.send()` valida e enfileira um job na fila BullMQ `email` (sobre Valkey, via `ioredis`) → um worker in-process (`startEmailWorker`, iniciado no boot do `server.ts`) renderiza o template react-email e despacha pelo `MailProvider` configurado. Falha do provedor aciona retry com backoff exponencial; no fracasso final apenas loga. Falha ao enfileirar (ex.: Valkey indisponível) é logada e **não** propaga para o fluxo de negócio chamador.

**Arquivos:**

- `email.service.ts` — API interna (`emailService.send` / `sendWelcome`).
- `email.queue.ts` — fila BullMQ + conexão `ioredis` dedicada (`getEmailQueue`, `enqueueEmail`, `closeEmailQueue`).
- `email.worker.ts` — worker in-process (`startEmailWorker`, `stopEmailWorker`).
- `providers/mail-provider.ts` — interface `MailProvider` + `getMailProvider()` (seleciona `ResendProvider` se `EMAIL_API_KEY` presente, senão `NoopProvider`).
- `providers/resend.provider.ts`, `providers/noop.provider.ts` — provedores concretos.
- `templates/registry.ts` + `templates/*.tsx` — templates react-email e lookup por nome.

**Uso (API interna):**

```ts
import { emailService } from "./modules/email/email.service";

// Envio genérico: valida `to` (formato) e `template` (existe no registry).
await emailService.send({
  template: "welcome",
  to: "usuario@exemplo.com",
  data: { name: "Ana", appUrl: "https://painelvagas.com" },
});

// Açúcar para boas-vindas: injeta `appUrl` a partir de FRONTEND_URL.
await emailService.sendWelcome({ email: "usuario@exemplo.com", name: "Ana" });
```

`send` resolve sem aguardar a entrega. `to` inválido ou `template` desconhecido lançam `AppError.validation` (antes de enfileirar).

**Variáveis de ambiente:**

- `EMAIL_API_KEY` — chave da Resend. Vazia ⇒ `NoopProvider` (apenas loga; não envia, não quebra o boot).
- `EMAIL_FROM_ADDRESS` — endereço remetente (ex.: `no-reply@painelvagas.com`).
- `EMAIL_FROM_NAME` — nome exibido do remetente (ex.: `Painel Vagas`).
- `EMAIL_QUEUE_ATTEMPTS` — nº de tentativas do job (padrão `3`).
- `FRONTEND_URL` — reusada para o botão "Acessar plataforma" do template de boas-vindas (nenhuma env de URL nova é criada).

**Adicionar um novo template:**

1. Crie o componente react-email em `src/modules/email/templates/<nome>.tsx` (props tipadas), reusando `BaseLayout`.
2. Registre-o no mapa `templates` de `registry.ts` (subject + component) e adicione as props em `TemplateDataMap`. O `TemplateName` e `isTemplate` passam a reconhecê-lo automaticamente.
3. Consuma via `emailService.send({ template: "<nome>", to, data })`.

**Adicionar um novo provider:**

1. Implemente a interface `MailProvider` (`send({ to, subject, html, replyTo? })`) em `src/modules/email/providers/<nome>.provider.ts`. Em falha, **lance** (para o BullMQ re-tentar).
2. Ajuste `getMailProvider()` em `mail-provider.ts` para selecioná-lo pela configuração. Nenhum caller precisa mudar (contrato via interface).

## Middlewares

- `withSession` — integra `iron-session` (sessões + cookie `vagas_session`).
- `requireAuth` — valida autenticação nas rotas que exigem usuário.
- `securityHeaders` — cabeçalhos de segurança (ver seção **Segurança e criptografia**).
- `cors` — configuração de CORS (opções em `src/middleware/cors.ts`).
- `rateLimit` — limitadores de tentativas em endpoints de autenticação (`src/middleware/rateLimit.ts`).
- `validate` — validação/normalização de `body`/`query`/`params` via schemas Zod.
- `requestId` — correlação de requisições.
- `metrics` — coleta de métricas Prometheus.
- `rateLimit` (`authIpRateLimiter`, `authAccountRateLimiter`) — limita tentativas de login por IP e por conta (`AUTH_RATE_LIMIT_*`).
- `errorHandler` — tratamento centralizado de erros.

## Endpoints principais

Base: `/api/v1` (prefixo oficial, `backend/src/app.ts`). As mesmas rotas seguem respondendo sem prefixo (ex.: `/auth/login` além de `/api/v1/auth/login`) como compatibilidade temporária para clientes ainda não migrados; `GET /health` responde nos dois formatos. Veja também a seção "Versionamento da API" do [README.md](README.md).

- Sistema
  - `GET /health` — verifica disponibilidade (retorna `{ ok: true }`).
  - `GET /metrics` — métricas Prometheus.
  - `GET /docs` — UI do Swagger (quando habilitado).

- Auth / OAuth
  - `GET /auth/:provider/url` — retorna URL de autenticação (ex: `google`, `github`, `linkedin`).
  - `GET /auth/:provider/callback` — callback OAuth — processa código/state e cria sessão.

- Credenciais (email/senha)
  - `POST /auth/register` — registra usuário (cria `users`, `credentials`, `userPreferences`) e inicia sessão.
  - `POST /auth/login` — autentica e inicia sessão. Sujeito a rate limit por IP e por conta (`AUTH_RATE_LIMIT_IP_MAX`, `AUTH_RATE_LIMIT_ACCOUNT_MAX`, `AUTH_RATE_LIMIT_WINDOW_SECONDS`).
  - `POST /auth/logout` — destroi sessão.
  - `GET /auth/me` — retorna `{ user }` com o registro completo do usuário autenticado (401 se a sessão for inválida/expirada).
  - `GET /auth/connections` — lista provedores OAuth conectados ao usuário autenticado.
  - `DELETE /auth/connections/:provider` — desconecta um provedor OAuth do usuário autenticado.

- Usuários
  - `GET /users/profile` — retorna perfil do usuário autenticado.
  - `PATCH /users/profile` — atualiza campos do perfil.
  - `GET /users/preferences` — obtém preferências do usuário.
  - `POST /users/preferences` — cria preferências (caso não existam).
  - `PATCH /users/preferences` — atualiza preferências.

- Jobs
  - `GET /jobs/search?keywords=...` — busca vagas utilizando índices/Valkey/Redis. Retorna paginação e fonte (`source`).
  - Filtros aceitos incluem `keywords`, `family`, `technology`, `seniority`, `level`, `location`, `country`, `state`, `city`, `type`/`model`, `contract`/`contractType`/`jobTypes` e `matchSort`.

- Keywords
  - `GET /keywords` — lista keywords do usuário autenticado.
  - `POST /keywords` — se `KWSYNC_ENABLED=false` (padrão), retorna `403` (`{ ok:false, message: "Submissão de keywords por usuário está desabilitada." }`). Se habilitado, insere a keyword na tabela `keywords` (dedupe por `userId+keyword`) e publica na fila Valkey `scraper:keywords:pending` para o serviço Go processar (retorna 202).

- Notificações
  - `GET /notifications` — lista notificações do usuário autenticado.
  - `PATCH /notifications/:id/read` — marca uma notificação como lida.
  - `PATCH /notifications/read-all` — marca todas como lidas.
  - `DELETE /notifications` — limpa notificações conforme filtros aceitos.

- Vagas salvas (Saved Jobs)
  - `GET /saved-jobs` — lista vagas salvas do usuário.
  - `GET /saved-jobs/:id` — obtém vaga salva por id.
  - `GET /saved-jobs/:id/events` — histórico de mudanças de status da vaga salva (tabela `application_events`).
  - `GET /saved-jobs/:id/notes` — lista as notas privadas da vaga salva (tabela `application_notes`, mais de uma por vaga).
  - `POST /saved-jobs/:id/notes` — cria uma nota (`{ content }`, 1–5000 caracteres).
  - `PATCH /saved-jobs/:id/notes/:noteId` — atualiza o conteúdo de uma nota.
  - `DELETE /saved-jobs/:id/notes/:noteId` — remove uma nota.
  - `POST /saved-jobs` — cria nova vaga salva.
  - `PATCH /saved-jobs/:id` — atualiza vaga salva (inclui `status` e o campo legado de nota única `notes`, distinto das notas em `/saved-jobs/:id/notes`).
  - `DELETE /saved-jobs/:id` — remove vaga salva.

- Admin

  As rotas `/admin/*` são montadas por três routers distintos, cada um com uma role mínima diferente (`src/modules/admin/permissions/roles.ts`, hierarquia `user < support < admin < super_admin`). A matriz completa de recurso/ação/role fica em `src/modules/admin/permissions/permissionMatrix.ts` (também espelhada na tabela `permission_rules`).

  Role mínima `support` (`src/routes/support.routes.ts`):
  - `GET /admin/dashboard` — métricas gerais (usuários, vagas coletadas, status do scraper).
  - `GET /admin/scrapers`, `GET /admin/scrapers/status`, `GET /admin/scrapers/jobs`, `GET /admin/scrapers/jobs/count` — leitura de estado/dados do scraper.
  - `GET /admin/observability/health` — healthcheck agregado dos serviços.

  Role mínima `admin` (`src/routes/admin.routes.ts`):
  - `GET /admin/users` — lista usuários.
  - `GET /admin/users/:id` — obtém usuário por id.
  - `PATCH /admin/users/:id/block` — bloqueia usuário.
  - `PATCH /admin/users/:id/unblock` — desbloqueia usuário.
  - `POST /admin/users/:id/reset` — reseta credenciais/senha conforme regra do serviço.
  - `POST /admin/scrapers/run` — dispara execução dos scrapers.
    - Sucesso: `202` com `{ ok: true, message }`.
    - Execução concorrente: `409` com `{ ok: false, code: "SCRAPER_ALREADY_RUNNING", message }`.
    - Lock/Valkey indisponível: `503` com `{ ok: false, code: "SCRAPER_RUN_LOCK_UNAVAILABLE", message }`.
  - `POST /admin/scrapers/:id/run` — aplica o mesmo contrato ao scraper nomeado (`go-scraper`).
  - `GET /admin/observability/metrics` — visão de métricas administrativas.
  - `GET /admin/observability/dashboards` — lista dashboards de observabilidade.
  - `GET /admin/audit` — consulta logs de auditoria.
  - `GET /admin/permissions/rules` — lista regras de permissão.

  Role mínima `super_admin` (`src/routes/superAdmin.routes.ts`):
  - `PATCH /admin/users/:id/role` — altera a role de um usuário.
  - `DELETE /admin/users/:id` — remove um usuário definitivamente.
  - `PATCH /admin/permissions/rules` — atualiza a matriz de permissões.
  - `DELETE /admin/jobs/cache` — limpa o cache/índice de vagas no Valkey.

Observações de segurança nas rotas:

- Rotas sob `/users`, `/jobs`, `/keywords`, `/notifications`, `/saved-jobs` e `/admin` usam `withSession` + `requireAuth` (quando aplicável); `/admin/*` adicionalmente exige `requireRole`/`requirePermission` conforme a tabela acima.
- `auth` usa `withSession` para armazenar OAuth state e criar sessão; `POST /auth/login` passa também por `authIpRateLimiter`/`authAccountRateLimiter`.

## Variáveis de ambiente importantes

Definidas/consumidas em `src/config.ts` e outros módulos:

- `HEADLESS` — modo headless do scraper (bool).
- `WAIT_BETWEEN_SEARCHES_MS` — intervalo entre buscas (ms).
- `PAGE_TIMEOUT_MS` — timeout de página (ms).
- `MAX_PAGES_PER_KEYWORD` — limite de páginas por keyword.
- `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT` — dimensões do browser.
- `SEARCH_LOCATION`, `SEARCH_GEO_ID`, `SEARCH_LANGUAGE` — parâmetros de busca.
- `REMOTE_ONLY` — filtrar vagas remotas.
- `JOB_TYPES` — filtros de tipo de vaga.
- `TIME_FILTER` — filtro temporal (ex: `r604800`).
- `DATABASE_URL` — conexão com Postgres.
- `VALKEY_URL` — endpoint do Valkey (cache, fila de e-mail via BullMQ e fila de keywords do kwsync).
- `CACHE_TTL_MS` — TTL padrão (ms) do cache de vagas no Valkey.
- `KWSYNC_ENABLED` — padrão `false`. Liga/desliga tanto `POST /keywords` no backend quanto o consumidor da fila `scraper:keywords:pending` no scraper-go (ver [SCRAPER.md](SCRAPER.md)).
- `APP_URL` — URL base pública da aplicação (uso informativo/documental).
- `FRONTEND_URL` — URL do frontend; reusada no CTA do e-mail de boas-vindas e no redirect pós-OAuth.
- `EMAIL_API_KEY` — chave da Resend (vazio ⇒ envio no-op logado).
- `EMAIL_FROM_ADDRESS` — endereço remetente dos e-mails.
- `EMAIL_FROM_NAME` — nome exibido do remetente.
- `EMAIL_QUEUE_ATTEMPTS` — tentativas por job de e-mail (padrão 3).
- `GO_SCRAPER_URL` — URL usada pelos adapters `goScraper.ts`/`goKeywords.ts` (fluxo de scraping/keywords direto).
- `SCRAPER_URL` — URL usada pelo `scraperClient` nos endpoints administrativos `/admin/scrapers/*` (`config.scraperUrl`). É uma variável **distinta** de `GO_SCRAPER_URL`, apontando ao mesmo serviço Go por um caminho de integração diferente.
- `SESSION_SECRET` — senha para `iron-session` (obrigatória em produção).
- `ENCRYPTION_MASTER_KEY`, `ENCRYPTION_KEY_ID`, `SEARCH_KEY` — criptografia e campos pesquisáveis de PII.
- `AUTH_RATE_LIMIT_IP_MAX`, `AUTH_RATE_LIMIT_ACCOUNT_MAX`, `AUTH_RATE_LIMIT_WINDOW_SECONDS` — limites de tentativas de login por IP/conta e janela (segundos) do rate limiter de `POST /auth/login`.
- `CORS_ALLOWED_ORIGINS` — origens permitidas, incluindo `http://localhost:5173` e `http://localhost:5174` em desenvolvimento local com admin.
- `PROMETHEUS_URL` — integração com Prometheus para rotas de observabilidade.
- `PORT` — porta do servidor (padrão 3001).

## Segurança e criptografia

### Autenticação e sessão

- Senhas com Argon2id (`argon2`), parâmetros `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4` (`src/modules/auth/credentials.service.ts`).
- Cookies de sessão (`vagas_session`, via `iron-session`) `httpOnly` sempre; `secure` e `sameSite: "none"` quando `NODE_ENV=production`, `sameSite: "lax"` em desenvolvimento (`src/lib/session.ts`).
- Campos sensíveis de perfil (`email`, nome, telefone, CPF, tecnologias) são criptografados com AES-256-GCM (`ENCRYPTION_MASTER_KEY`) e indexados para busca via hash HMAC (`SEARCH_KEY`) — ver `src/lib/security/encryption.ts` e `src/lib/security/searchableHash.ts`.
- `toPublicUser` (`src/modules/users/users.mapper.ts`) remove os campos internos `*Encrypted`/`*Hash` antes de qualquer resposta JSON conter um `user` — apenas os campos decifrados (`email`, `firstName`, etc.) e os demais campos não sensíveis (`id`, `username`, `role`, `isBlocked`, timestamps) são expostos.

### Rate limiting (`src/middleware/rateLimit.ts`)

Limitadores por janela deslizante, com contador no Valkey quando `VALKEY_URL` está definido e fallback em memória caso contrário. Respostas incluem `RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset`; ao estourar, `429` com `Retry-After`. Falha do backend de contagem responde `503` (fail-closed).

| Rota | Limitadores | Chave |
| --- | --- | --- |
| `POST /auth/login` | `authIpRateLimiter`, `authAccountRateLimiter` | IP (hash) / e-mail (hash) |
| `POST /auth/register` | `authIpRateLimiter`, `authRegisterRateLimiter` | IP (hash) / e-mail (hash), bucket próprio |

Configuração (variável ausente usa o default; valor `≤ 0` ou não numérico também cai no default):

- `AUTH_RATE_LIMIT_IP_MAX` — máximo de tentativas por IP na janela. Default `20`.
- `AUTH_RATE_LIMIT_ACCOUNT_MAX` — máximo por e-mail na janela (login e cadastro têm buckets separados). Default `5`.
- `AUTH_RATE_LIMIT_WINDOW_SECONDS` — tamanho da janela em segundos. Default `900` (15 min).

Pendente: aplicar rate limit ao endpoint de exportação de dados (LGPD) quando a PAV-41 for mergeada.

### CORS (`src/middleware/cors.ts`)

- `CORS_ALLOWED_ORIGINS` (lista separada por vírgula) é a fonte da verdade das origens permitidas.
- Sem a env: em `production` cai apenas nas origens de produção (`*.candidate.app.br`) e loga um aviso — `localhost` **nunca** entra no allowlist de produção por fallback. Fora de produção, o fallback inclui `http://localhost:5173` e `:5174`.
- `credentials: true`; métodos `GET, POST, PATCH, DELETE, OPTIONS`; headers `Content-Type, Authorization, X-Requested-With`; preflight cacheado por 24 h. Requisições sem header `Origin` (server-to-server, mesma origem) são permitidas.
- Origem fora do allowlist retorna `403` com `{ code: "FORBIDDEN", message: "Origem não permitida." }`.

### Cabeçalhos de resposta (`src/middleware/securityHeaders.ts`)

Aplicados a todas as respostas:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — só sobre HTTPS (`req.secure`, resolvido via `trust proxy`) ou `NODE_ENV=production`. `preload` fica de fora de propósito (opt-in do time).
- `x-powered-by` desabilitado.
- CSP da API e dos frontends (Nginx/Vercel) é tratada em [SECURITY.md](SECURITY.md) (PAV-132).

### Entrada e persistência

- Corpo de requisição limitado a `16kb` (`express.json({ limit: "16kb" })`).
- Validação/normalização de entrada via schemas Zod (`middleware/validate`) nas rotas de auth, users, keywords e saved-jobs.
- Acesso ao banco via Drizzle (queries parametrizadas — sem concatenação de SQL).
- Índices únicos e constraints no DB (ex: email/username/keyword uniques) definidos nas tabelas Drizzle.

## Integração com serviço Go

- `goScraper.ts` faz POST em `${GO_SCRAPER_URL}/scrape` com `ScrapeParams` e valida `ScrapeResponse`.
- `goKeywords.ts` consulta e publica keywords via endpoints do serviço Go (`/api/keywords`).
- O backend lê o catálogo de vagas e os índices criados pelo scraper no Valkey (`scraper:job:{id}`, `scraper:jobs:keyword:*`, `scraper:jobs:family:*`, `scraper:jobs:technology:*` e `scraper:jobs:seniority:*`). O PostgreSQL não armazena o catálogo coletado; `saved_jobs` são vagas salvas pelo usuário. A indexação invertida só é atualizada depois que o scraper confirma a persistência do documento da vaga.
- Disparos administrativos usam `scraperClient` e preservam os códigos operacionais do serviço Go. O código `SCRAPER_ALREADY_RUNNING` é um conflito esperado; `SCRAPER_RUN_LOCK_UNAVAILABLE` indica política fail-closed e não inicia coleta.

## Banco de dados

- Uso de Drizzle ORM com tipos gerados em `src/db/schema`.
- Tabelas: `users`, `credentials`, `accounts`, `keywords`, `saved_jobs`, `application_events`, `application_notes`, `user_preferences`, `user_notifications`, `audit_logs`, `permission_rules` (ver detalhes de cada uma em [Database / Schemas](#arquitetura-e-módulos-principais)).
- Migrations em `drizzle/`.

## Logs e observabilidade

- `src/logger.ts` exporta `logInfo`, `logWarn`, etc.
- Erros críticos são logados; rotas tratam respostas e retornam mensagens amigáveis.

## Testes

- Testes unitários e de integração com `vitest` em `tests/`.
- Cobertura configurada em `test:coverage`.

## Docker / Infra

- `backend/Dockerfile` existe para o backend.
- O fluxo Docker principal usa `docker/node.Dockerfile` com targets para backend, frontend e admin.
- `docker-compose.yml` no projeto raiz orquestra `scraper-go`, `backend`, `frontend` e `front_admin`.
- `docker-compose.infra.yml` sobe Postgres e Valkey.
- `docker-compose.migrate.yml` executa migrations e backfill antes do backend.

## Pontos de atenção / Próximos passos sugeridos

- Garantir `SESSION_SECRET` seguro em produção.
- Documentar contrato do Valkey (se for serviço externo) e endpoints do Go scraper com exemplos de payload.
- Adicionar ao Swagger (`backend/src/swagger.ts`) os endpoints de notas de candidatura (`/saved-jobs/:id/notes*`), que ainda não estão documentados ali.
- Corrigir `backend/src/swagger.ts`: o `securitySchemes.cookieAuth` declara o cookie como `candidate_session`, mas o cookie de sessão real é `vagas_session` (`src/lib/session.ts`).

### Corrigido nesta revisão

- `toPublicUser` (`src/modules/users/users.mapper.ts`) vazava os campos internos `*Encrypted`/`*Hash` (ciphertext e hashes pesquisáveis) em toda resposta que incluísse um `user` — `/auth/register`, `/auth/login`, `/auth/me`, `/users/profile`, `/admin/users*`. A função agora remove explicitamente esses campos antes de retornar o objeto público.
- O script `scraper`/`scraper:watch` do `backend/package.json` apontava para `index.ts`/`nodemon index.ts`, mas `backend/index.js` (o único entrypoint existente) importava arquivos `.js` inexistentes e uma função `run()` que não existe em `src/app.ts` — ou seja, o comando já estava completamente quebrado e sem nenhum consumidor no repositório (scraping real é feito pelo serviço `scraper-go`). O script, o arquivo `index.js` e a dependência `nodemon` foram removidos.

---

## Exemplos de Request / Response

Seguem exemplos práticos para os endpoints mais usados. Ajuste `HOST` para seu ambiente (ex: `http://localhost:3001`).

- Registrar (credentials)

Request:

POST /auth/register

```json
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd",
  "name": "Fulano"
}
```

Response (201):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Fulano",
    "username": "fulano",
    "emailVerified": false,
    "role": "user",
    "isBlocked": false
  },
  "session": { "userId": "uuid", "role": "user" }
}
```

O `user` retornado é o registro da tabela `users` já sanitizado por `toPublicUser` (sem os campos internos `*Encrypted`/`*Hash`); o exemplo acima mostra só os campos mais relevantes.

- Login (credentials)

Request:

POST /auth/login

```json
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd"
}
```

Response (200):

```json
{
  "user": { "id": "uuid", "email": "user@example.com", "username": "fulano", "role": "user" },
  "session": { "userId": "uuid", "role": "user" }
}
```

- Buscar vagas (Jobs search)

Request:

GET /jobs/search?keywords=react,node&page=1&limit=10

Response (200):

```json
{
  "total": 123,
  "page": 1,
  "limit": 10,
  "totalPages": 13,
  "hasNext": true,
  "hasPrev": false,
  "jobs": [ { "id": "job-id", "title": "Frontend Developer", "company": "ACME" } ],
  "source": "valkey_filtered_by_keywords:react+node"
}
```

- Enfileirar keyword

Request:

POST /keywords

```json
{
  "keyword": "typescript"
}
```

Response (202) — apenas com `KWSYNC_ENABLED=true` (padrão é `false`, e a rota responde `403` nesse caso):

```json
{
  "ok": true,
  "message": "Keyword enfileirada para processamento."
}
```

- Vagas salvas (Saved Jobs) — criar

Request:

POST /saved-jobs

```json
{
  "jobLink": "https://www.linkedin.com/jobs/view/123",
  "jobTitle": "Backend Developer",
  "company": "ACME",
  "location": "São Paulo",
  "source": "linkedin",
  "keyword": "node"
}
```

Response (201):

```json
{
  "id": "uuid",
  "userId": "uuid",
  "jobLink": "https://...",
  "jobTitle": "Backend Developer",
  "company": "ACME",
  "location": "São Paulo",
  "status": "saved",
  "createdAt": "2026-05-26T..."
}
```

- Perfil do usuário

Request:

GET /users/profile

Response (200):

```json
{
  "id": "uuid",
  "displayName": "Fulano",
  "username": "fulano",
  "email": "user@example.com",
  "avatarUrl": null
}
```

---

Os exemplos acima são intencionais e servem como referência rápida para integrar o frontend ou scripts que consomem a API.

## Filtros de famílias profissionais — PAV-124

`GET /api/v1/jobs/search` (também disponível em `/jobs/search`) mantém a autenticação por sessão e o envelope de sucesso com `jobs`, `total`, `page`, `limit`, `totalPages`, `hasNext`, `hasPrev` e `source`.

O parâmetro `family` aceita um ID, IDs separados por vírgula, parâmetros repetidos ou ambos. Exemplos equivalentes:

```text
?family=backend,fullstack
?family=fullstack,backend
?family=backend&family=fullstack
?family=fullstack,backend&family=backend
```

O parser central produz `families: ProfessionalFamily[]` ordenadas lexicograficamente, sem espaços externos, valores vazios ou duplicidades, e `familyMode: "primary" | "any"`. O limite de 13 é aplicado às famílias únicas após normalização. `family=backend,` é válido; `family=` e `family=,,,` retornam 400. IDs são sensíveis à caixa: labels (`Backend`, `Full Stack`, `Dados e IA`), aliases históricos e `other` não são públicos.

As famílias são derivadas de `professionalTaxonomy.ts`, o módulo da PAV-123 já verificado contra `scraper-go/internal/taxonomy/families.json`: backend, frontend, fullstack, mobile, data, devops, platform, qa, security, product, product_design, software e leadership. Nenhuma nova taxonomia foi criada.

- `familyMode=primary`: considera somente `classification.primaryFamily`.
- `familyMode=any` (default): considera principal e relacionadas.
- `familyMode` sem `family` é validado, mas não restringe a busca.
- Repetição de `familyMode`, modo vazio ou diferente dos dois valores retorna 400.
- Famílias usam OR entre si e AND com os outros grupos de filtros.
- `fullstack` não expande para backend/frontend; devops e platform são independentes.

Exemplo: `?family=product,product_design&familyMode=primary&seniority=senior&model=remoto&country=Brasil&contract=clt`. Os parâmetros de modalidade existentes continuam sendo `model`/`type` (`model` prevalece), com os valores atuais `remoto`, `hibrido` e `presencial`. Esta tarefa não acrescenta `modality` ou um filtro `provider`, que não estavam implementados na busca auditada. Keywords, tecnologias, empresa, senioridade, nível, localização, contrato e aliases, paginação e ordenação continuam com seus parsers e predicados existentes.

Erros de validação usam o envelope padrão `{ "code": "INVALID_JOB_FAMILY" | "INVALID_FAMILY_MODE", "message": "..." }`, status 400, antes de consultar vagas ou perfil. Falhas de infraestrutura preservam o envelope legado da busca `{ "message": "...", "error": "..." }`, status 500.

`GET /api/v1/jobs/filters/options` retorna `taxonomyVersion`, as 13 famílias na ordem canônica com IDs/labels e os modos `any` (default) e `primary`. O endpoint mantém a autenticação de `/jobs`, não consulta vagas/contagens/scraper e envia `Cache-Control: public, max-age=3600` e ETag SHA-256 da versão/conteúdo. `If-None-Match` permite 304.

### Consulta, compatibilidade e limites temporários

A busca anterior já incluía principal e relacionadas; o default `any` conserva essa semântica. A validação estrita deixa de aceitar labels e listas explicitamente vazias, conforme o contrato novo. O repository verifica documentos persistidos em lotes de até 200 e aplica todos os filtros antes de contar e selecionar a página. Não há pós-filtro depois da paginação e não são carregados todos os documentos simultaneamente.

Para impedir perdas com índices estruturados incompletos, buscas filtradas usam o índice global de IDs ou a resolução existente de keywords. O campo diagnóstico `source` passa a usar `:verified_batches` nessas buscas. Isso pode recuperar vagas que os índices anteriores omitiam e mudar a ordem incidental do conjunto de candidatos; não existe ordenação cronológica garantida por Sets do Valkey. A ordem das famílias da request não altera o predicado nem o caminho de consulta. Ordenação explícita por match continua global, com desempate pela ordem dos candidatos e apenas IDs/scores retidos; o cálculo de score existente não foi alterado. A busca simples sem filtros/ordenação mantém sua priorização por perfil e hidratação atuais.

Custo temporário: O(N) documentos candidatos por busca filtrada para obter total exato; IDs permanecem em memória. Ordenação por match conserva no máximo `offset + limit` IDs/scores e hidrata novamente a página escolhida. Valkey não oferece snapshot entre essas leituras: expiração/reclassificação concorrente pode mudar documentos durante uma busca. A busca simples legada ainda estima total descontando apenas órfãos observados na hidratação da página; esse comportamento preexistente foi preservado.

Ficam para a próxima PAV: índices separados de famílias principais/relacionadas, reconstrução de índices, cache keys finais, invalidação por reclassificação e evolução de match score. Não houve mudança no Processor Go, autenticação, autorização ou rate limit (a busca não tinha limitador próprio; os limitadores de autenticação permanecem).

## Busca e cache após PAV-125

A PAV-125 evolui a PAV-124 sem mudar o parser público de `family`/`familyMode`,
os IDs da PAV-123, autenticação, rate limit ou envelope HTTP. PostgreSQL mantém o
catálogo do Processor; a busca online continua usando Valkey. Consulte
[SCRAPER.md](SCRAPER.md#catálogo-durável-e-índices-de-famílias-pav-125) para migration,
backfill, rebuild, reconciliação e rollback.

Quando existe `scraper:jobs:index-version`, o repository usa o namespace ativo.
Múltiplas famílias usam SUNIONSTORE; grupos de keywords são intersectados e a
atividade é conferida pelo ZSET de expiração. Temporárias têm TTL de 120 segundos
com renovação durante leitura e são removidas ao finalizar. IDs ficam no Valkey;
o backend hidrata lotes de até 200 documentos. Os demais predicados da PAV-124
continuam sendo verificados antes de total/paginação, porque índices legados de
senioridade, modalidade e localização não representam exatamente todas as
inferências e aliases do contrato HTTP. Não há consulta SQL por request nem
pós-filtro de famílias depois da página. Ordenação explícita por match usa ZSET
temporário com scores, sem acumular documentos de todo o catálogo no Node.
Empates usam ID determinístico; a ordenação anterior de SETs não tinha garantia.
A busca simples conserva priorização por keywords do perfil e ordenação da página.

Antes da primeira publicação de namespace, o caminho legado da PAV-124 permanece
como fallback de migração. Depois da publicação, falhas de índice não causam
fallback silencioso para dados antigos. A leitura de vagas por ID também acompanha
a versão ativa. Saved jobs continuam independentes e seus dados persistidos não
são modificados.

O cache de páginas usa `jobs:search:v2:<sha256>`. O fingerprint inclui filtros
normalizados, famílias ordenadas e deduplicadas, `familyMode`, página, limite,
ordenação, versões de contrato/taxonomia/índices, geração e contexto normalizado
de ranking. Texto, localização e perfil não aparecem diretamente nas chaves.
`JOB_SEARCH_CACHE_TTL_SECONDS=120` é configurável; o TTL é limitado pela próxima
expiração global de vaga. Publicação do cache verifica a geração atomicamente.
Uma geração nova torna entradas antigas inacessíveis; elas expiram naturalmente.
Há single-flight local por processo, sem reutilizar o lock do scraper. Falha de
cache permite executar a consulta normal. Não há lock distribuído de stampede.

Create/update/reclassificação/desativação e expiração concluídos no Processor
versionam o cache após indexação; rebuild/rollback publicam namespace e geração
juntos. Alterações de regras devem incrementar `searchContractVersion`; mudanças
de taxonomia também integram o fingerprint. A limpeza administrativa
`DELETE /admin/jobs/cache` mantém autenticação e formato de resposta, mas,
com catálogo versionado, invalida cache por geração e retorna `deleted: 0` em vez
de apagar documentos/índices ativos. É uma mudança operacional deliberada para
proteger PostgreSQL como fonte de verdade; desativação durável pertence ao Processor.

Produto e Design usam evidências positivas disponíveis: família nas preferências,
senioridade, modalidade/localização, competências, ferramentas e experiências.
Ausência de linguagem não reduz o score. Sem evidências não se inventa score.
`matchReasons` contém somente razões públicas, sem pesos ou dados privados.
As demais famílias conservam exatamente a fórmula anterior por tecnologias.
Preferências e notificações continuam exclusivamente no backend.

No contrato atual de `UserPreferences`, `jobTypes` representa modalidades
(`Remoto`, `Híbrido`, `Presencial`), e `remoteOnly` indica preferência por remoto.
Nenhum deles fornece contrato de contratação. `searchLocation` é a localização
de busca; `keywords` são termos livres usados como evidência textual, sem inferir
uma família canônica. O modelo atual não oferece uma seleção autoritativa de
família nem contrato; esses campos de match permanecem sem preferência derivada.

Limitações: a busca filtrada com cache frio ainda percorre todos os candidatos
necessários para obter total exato; consultas residuais amplas têm custo O(N).
Valkey não oferece snapshot de documentos entre todos os lotes: mudanças concorrentes
podem afetar uma resposta, embora uma geração modificada impeça publicar cache
obsoleto. O índice usa expiração em segundos; existe granularidade inferior a um
segundo em relação aos timestamps SQL. A meta operacional de p95 < 500 ms exige
medição com volume e concorrência representativos; testes locais não a comprovam.


## Snapshot administrativo e métricas de busca — PAV-126

`GET /admin/observability` (também sob o prefixo API existente) exige sessão,
role administrativa e permissão `observability.metrics`. Usa o padrão de resposta
administrativa direto, `Cache-Control: no-store`, com contrato:

```json
{
  "status": "partial",
  "timestamp": "2026-10-07T00:00:00.000Z",
  "processor": null,
  "availability": { "scraper": "down" }
}
```

Quando o Processor responde, `processor` contém execution, lock, concurrency,
progress, queues, resources, errors, rejectedTitles/rejectedTitlesSince,
dependencies e index. Sem histórico, execution.status é idle, os timestamps/source/
stage são null e durationSeconds é zero. Falhas de PostgreSQL/Valkey preservam o
snapshot e retornam status partial. O backend faz uma única chamada interna com
prazo de 2.5s, valida com Zod e remove campos extras antes de responder. Ausência
ou resposta inválida do Processor resulta no formato parcial acima, HTTP 200.
Prometheus não é dependência dessa rota. As rotas administrativas anteriores,
auth, rate limiting e contratos de famílias permanecem preservados.

Métricas HTTP existentes `http_request_duration_seconds`/`http_requests_total`
continuam com os mesmos nomes/labels. Route usa templates Express; caminhos sem
match caem em `__unmatched__`, salvo rotas prioritárias estáticas conhecidas.
Query strings e IDs não viram labels. Methods desconhecidos caem em OTHER.
Os buckets existentes permitem estimar p50/p95/p99, sem promessa de desempenho.

O cache PAV-125 expõe `candidate_jobs_search_cache_requests_total` com hit/miss/
stale/error, histogram de get/set/invalidate e invalidações por motivo fixo.
Cada request tem um resultado: reutilização local via singleflight conta como hit;
cache indisponível conta error; publicação recusada por geração diferente conta
stale. As keys, fingerprints, TTL, CAS e ranking não mudaram. Go observa invalidações
de catálogo/rebuild; Node observa a invalidação manual já existente. Nada registra
keys, texto livre, localização privada ou dados de usuário em labels.

Ver `observability/PAV-126_REPORT.md` para inventário, regras, testes, limitações e
rollback. A meta de busca p95 < 500ms requer validação em staging representativo.
