# Análise de Segurança — Projeto Candidate (ambiente MASTER)

> **Documento de referência para criação de cards no Linear (time Painel Vagas / PAV).**
> Resultado de uma revisão AppSec read-only do branch `master`. Nenhum código foi alterado, nenhum PR foi criado e nenhum card foi criado automaticamente.
> Data da análise: **2026-10-01** · Branch: `master` · Commit base: `a4a274e`

---

## 1. Resumo da análise

Foi realizada uma análise de segurança abrangente (estática, orientada a fluxo) de todos os componentes do monorepo **Candidate**, cobrindo autenticação/autorização, gerenciamento de sessão e tokens, controle de acesso (RBAC/IDOR/BOLA), validação e sanitização de entrada, injeções (SQL/NoSQL/Command), XSS/CSRF/SSRF, exposição de dados sensíveis/PII, secrets e variáveis de ambiente, CORS, rate limiting, uploads/downloads, deserialização, dependências vulneráveis, logs, endpoints administrativos, comunicação entre serviços, Docker/infra, CI/CD e Electron.

**Postura geral:** a base é sólida em vários pontos críticos — criptografia de PII com **AES-256-GCM** (IV aleatório + auth tag), hashing de senha com **argon2id** endurecido, acesso ao banco 100% parametrizado via Drizzle (sem SQL injection), ownership consistente em recursos por usuário (sem IDOR nos endpoints de dados), CORS com allowlist fail-closed, cabeçalhos de segurança fortes na API, e Electron endurecido (contextIsolation/sandbox). Os problemas concentram-se em: **linking de contas OAuth**, **ciclo de vida de sessão/token**, **superfície administrativa não autenticada entre serviços**, **exposição de PII em massa**, **stack de observabilidade sem autenticação** e **hardening de infraestrutura/dependências**.

### Totais por severidade

| Severidade | Qtde |
|------------|------|
| 🔴 Critical | 1 |
| 🟠 High | 8 |
| 🟡 Medium | 13 |
| 🟢 Low | 17 |
| **Total** | **39** |

### Mapa de prioridade sugerido para o Linear

| Severidade | Prioridade Linear |
|------------|-------------------|
| 🔴 Critical | 1 — Urgente |
| 🟠 High | 2 — Alta |
| 🟡 Medium | 3 — Média |
| 🟢 Low | 4 — Baixa |

> Padrão de criação: **Team =** `Painel Vagas` · **State =** `Backlog`.

---

## 2. Componentes analisados

| Componente | Stack | Caminho |
|------------|-------|---------|
| Scraper | Go 1.26 | `scraper-go/` (94 arquivos `.go`) |
| Backend / APIs | Node + TypeScript (Express 5, Drizzle, iron-session) | `backend/src/` (132 arquivos `.ts`) |
| Frontend (público) | React 19 + Vite | `frontend/` |
| Frontend Administrativo | React + Vite | `front_admin/` |
| Autenticação/Autorização | OAuth (Google/GitHub/LinkedIn) + credenciais | `backend/src/modules/auth/`, `middleware/`, `modules/admin/permissions/` |
| Infra / Containers | Docker Compose, Dockerfiles | `docker/`, `docker-compose*.yml` |
| Observabilidade | Prometheus/Grafana/Loki/Promtail/cAdvisor | `observability/`, `docker-compose.observability.yml` |
| CI/CD | GitHub Actions | `.github/workflows/` |
| Dependências | npm + Go modules | `package.json`, `scraper-go/go.mod` |

> **Electron** foi analisado mas **não gera card**: passou com hardening correto (contextIsolation/sandbox/nodeIntegration) e sem conteúdo remoto — nenhuma vulnerabilidade encontrada.

---

## 3. Lista de vulnerabilidades e severidade

| # | Título | Componente | Severidade |
|---|--------|------------|------------|
| SEC-01 | Account takeover via OAuth com e-mail não verificado (auto-linking) | Backend (Auth) | 🔴 Critical |
| SEC-02 | API HTTP do scraper-go sem autenticação (inclui rotas /admin) | Scraper Go / Infra | 🟠 High |
| SEC-03 | Tokens OAuth (access/refresh) armazenados em texto puro | Backend (Auth) | 🟠 High |
| SEC-04 | Bloqueio/alteração de role/exclusão não revoga sessões ativas | Backend (Auth) | 🟠 High |
| SEC-05 | Ausência de proteção CSRF + cookie SameSite=None em produção | Backend (Auth) | 🟠 High |
| SEC-06 | Grafana exposto com credenciais padrão (admin/admin) em 0.0.0.0 | Infra | 🟠 High |
| SEC-07 | Dependência `xlsx` 0.18.5 com Prototype Pollution + ReDoS | Dependências | 🟠 High |
| SEC-08 | URLs não confiáveis do scraper renderizadas em `href` (javascript:/data:) | Frontend / Frontend ADM | 🟠 High |
| SEC-09 | Frontend ADM sem CSP/headers de segurança (sem vercel.json) | Frontend ADM | 🟠 High |
| SEC-10 | Retorno em massa de PII descriptografada (CPF/e-mail/telefone) para admin | Backend (API) | 🟡 Medium |
| SEC-11 | SSRF via `apiUrl` fornecido por arquivo no adapter Lever (sem allowlist) | Scraper Go | 🟡 Medium |
| SEC-12 | Parâmetros de scrape sem limites → DoS/amplificação | Scraper Go | 🟡 Medium |
| SEC-13 | Handlers JSON do Go sem limite de tamanho de corpo | Scraper Go | 🟡 Medium |
| SEC-14 | Respostas externas decodificadas sem `io.LimitReader` | Scraper Go | 🟡 Medium |
| SEC-15 | Endpoint `/metrics` do backend sem autenticação | Backend (API) | 🟡 Medium |
| SEC-16 | Enumeração de usuários (409 no registro + timing no login) | Backend (Auth) | 🟡 Medium |
| SEC-17 | RBAC administrativo aplicado apenas no cliente (verificar backend) | Frontend ADM | 🟡 Medium |
| SEC-18 | Loki publicado com autenticação desabilitada | Infra | 🟡 Medium |
| SEC-19 | Prometheus/observabilidade expostos sem auth em 0.0.0.0 | Infra | 🟡 Medium |
| SEC-20 | Containers executando como root (sem diretiva USER) | Infra | 🟡 Medium |
| SEC-21 | Credenciais padrão fracas de banco (`vagas/vagas`) em .env.example | Config | 🟡 Medium |
| SEC-22 | `SESSION_SECRET` não validado no boot + sessão sem TTL | Backend (Auth) | 🟡 Medium |
| SEC-23 | Mensagens de erro internas vazadas ao cliente | Backend (API) | 🟢 Low |
| SEC-24 | Injeção de wildcard LIKE na busca de usuários (admin) | Backend (API) | 🟢 Low |
| SEC-25 | IP do audit log obtido de `X-Forwarded-For` falsificável | Backend (API) | 🟢 Low |
| SEC-26 | Credenciais de admin hardcoded no script de seed | Backend (API) | 🟢 Low |
| SEC-27 | Validação de param UUID ausente em algumas rotas | Backend (API) | 🟢 Low |
| SEC-28 | Provider de credenciais morto com argon2 default (fraco) | Backend (Auth) | 🟢 Low |
| SEC-29 | Rate-limit em memória por instância + IP via XFF falsificável | Backend (Auth) | 🟢 Low |
| SEC-30 | Troca de token do GitHub ignora erros HTTP | Backend (Auth) | 🟢 Low |
| SEC-31 | `/metrics` e `/health` do scraper-go sem autenticação | Scraper Go | 🟢 Low |
| SEC-32 | Chaves de API de providers embutidas em URLs de saída | Scraper Go | 🟢 Low |
| SEC-33 | Conexão Redis/Valkey em texto puro sem auth por padrão | Scraper Go / Infra | 🟢 Low |
| SEC-34 | Montagens sensíveis do host na stack de observabilidade | Infra | 🟢 Low |
| SEC-35 | Imagens de observabilidade com tags mutáveis (`:latest`) | Infra | 🟢 Low |
| SEC-36 | Workflows CI sem `permissions` de menor privilégio | CI/CD | 🟢 Low |
| SEC-37 | Nome de branch de PR não confiável interpolado em github-script | CI/CD | 🟢 Low |
| SEC-38 | CSP do nginx de produção (frontend) permite `http://localhost:3001` | Frontend | 🟢 Low |
| SEC-39 | CSP de borda com pontos fracos menores (img-src/style-src) | Config | 🟢 Low |

> **Informacional (sem card):** `scraper-go/internal/kwsync/kwsync.go` define um consumidor de fila (`KWSYNC_ENABLED`) que confia em JSON da lista Valkey `scraper:keywords:pending` sem validação e grava em `keywords.json` em disco. Atualmente **não está conectado** em `cmd/server` (apenas `scheduler.Start` é chamado), portanto inacessível. Revisar antes de habilitar.

---

## 4. Cards detalhados

Cada bloco abaixo é um card independente pronto para o Linear.

---

### SEC-01 — Account takeover via OAuth com e-mail não verificado (auto-linking)

- **Componente:** Backend (Autenticação)
- **Severidade:** 🔴 Critical — Prioridade Linear: 1 (Urgente)
- **Descrição:** No login via OAuth, quando nenhum `account` corresponde ao provider id, o código busca um usuário existente por `profile.email` e vincula silenciosamente o novo provedor a essa conta — **sem verificar se o provedor afirmou que o e-mail é verificado**. `users.emailVerified` nunca é consultado no fluxo. O provider do GitHub agrava com `primaryEmail ?? user.email`, usando um e-mail possivelmente não verificado.
- **Localização no código:**
  - `backend/src/modules/users/functions/findOrCreateUser.ts` (linhas ~49-65)
  - `backend/src/modules/auth/providers/github.ts` (linhas ~47-53)
- **Evidência:**
  ```ts
  const existingByEmail = await findUserByEmail(profile.email, tx);
  if (existingByEmail) {
    await createAccount({ userId: existingByEmail.id, provider, profile }, tx);
    return { user: existingByEmail, isNewUser: false };
  }
  ```
  ```ts
  const primaryEmail = emails.find((e) => e.primary && e.verified)?.email;
  return { id: String(user.id), email: primaryEmail ?? user.email, ... };
  ```
- **Impacto:** Tomada de conta completa. A sessão é emitida para o `userId`/`role` da vítima, dando ao atacante acesso total à conta (inclusive contas com role elevado).
- **Cenário de exploração:** A vítima cadastra-se por e-mail/senha ou Google. O atacante cria uma conta GitHub (ou provedor cujo e-mail ele controla) com o e-mail da vítima e faz "login". `findOrCreateUser` casa pelo e-mail e vincula a identidade do atacante ao usuário da vítima; o callback emite sessão da vítima.
- **Correção recomendada:** Só fazer auto-link por e-mail quando o provedor afirmar `email_verified === true` (Google/LinkedIn expõem a claim; remover o fallback `?? user.email` do GitHub). Caso contrário, exigir fluxo autenticado de linking ou confirmação de posse do e-mail. Persistir e aplicar `emailVerified`.
- **Critérios de aceite:**
  - [ ] Auto-link por e-mail ocorre apenas quando o provedor confirma e-mail verificado.
  - [ ] Fallback `?? user.email` do GitHub removido; e-mail não verificado nunca vincula a conta existente.
  - [ ] Linking de provedor a conta existente exige autenticação prévia ou verificação de posse de e-mail.
  - [ ] Teste automatizado cobre tentativa de takeover via e-mail não verificado (deve falhar/exigir verificação).

---

### SEC-02 — API HTTP do scraper-go sem autenticação (inclui rotas /admin)

- **Componente:** Scraper Go / Infra (comunicação entre serviços)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** O `ServeMux` do scraper-go registra todas as rotas sem qualquer middleware de autenticação/autorização e sem segredo compartilhado. Rotas "administrativas" (`POST /admin/scrape`, `GET /admin/jobs`, `GET /admin/jobs/count`, `GET /admin/scrape/status`) e de escrita (`POST /scrape`, `POST /api/keywords`) estão totalmente abertas. O backend chama o serviço via `SCRAPER_URL=http://scraper-go:8081` sem header `Authorization`. `GET /admin/jobs` com `limit<=0` retorna **todos** os jobs.
- **Localização no código:**
  - `scraper-go/cmd/server/server.go` (registro de rotas, linhas ~73-94)
  - `scraper-go/cmd/server/admin_handlers.go` (`handleTriggerScrape` ~18, `handleGetJobs` ~121)
  - `scraper-go/cmd/server/handlers.go` (`GetSample` → `GetAll`, ~344)
- **Evidência:**
  ```go
  mux.Handle("POST /admin/scrape", handleTriggerScrape(scheduler, bgCtx))
  mux.Handle("GET /admin/jobs", handleGetJobs(jobStore))
  mux.Handle("POST /api/keywords", handleSaveKeywords(kwStore))
  ```
- **Impacto:** Qualquer workload na rede `vagas-net`, um pivô de SSRF ou um ingress mal configurado pode disparar scrapes custosos, exfiltrar toda a base de vagas e envenenar a configuração de keywords (persistida sem TTL).
- **Cenário de exploração:** `GET /admin/jobs?limit=0` (dump completo) e `POST /api/keywords` para alterar palavras-chave. **Mitigação atual:** a porta 8081 é apenas `expose` (interna), não publicada no host.
- **Correção recomendada:** Exigir segredo compartilhado (bearer) ou mTLS entre backend e scraper-go, validado em middleware; proteger `/admin` e rotas de escrita; manter 8081 interno; nunca retornar o dataset completo sem auth e sem limite máximo.
- **Critérios de aceite:**
  - [ ] Todas as rotas de escrita e `/admin/*` exigem autenticação (token/mTLS).
  - [ ] Backend envia a credencial em todas as chamadas ao scraper-go.
  - [ ] `GET /admin/jobs` impõe limite máximo; `limit<=0` não retorna tudo.
  - [ ] Porta 8081 permanece não publicada no host.

---

### SEC-03 — Tokens OAuth (access/refresh) armazenados em texto puro

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** `accessToken` e `refreshToken` dos provedores são gravados no banco como colunas `text` sem criptografia, apesar de existir a camada de criptografia de PII (`encryptText`, AES-256-GCM).
- **Localização no código:**
  - `backend/src/modules/users/functions/createAccount.ts` (linhas ~17-26)
  - `backend/src/db/schema/accounts.ts` (linhas ~24-25)
- **Evidência:**
  ```ts
  accessToken: profile.access_token ?? null,
  refreshToken: profile.refresh_token ?? null,
  ```
  ```ts
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  ```
- **Impacto:** Qualquer leitura do banco (SQLi em outro ponto, vazamento de backup, breach read-only, admin malicioso) expõe tokens OAuth vivos, reutilizáveis contra Google/GitHub/LinkedIn.
- **Cenário de exploração:** Exfiltração do banco → replay dos tokens nas APIs dos provedores.
- **Correção recomendada:** Criptografar os tokens em repouso com `encryptText` (GCM), ou deixar de persisti-los se não forem usados. Descriptografar apenas no momento do refresh.
- **Critérios de aceite:**
  - [ ] Colunas de token armazenam apenas ciphertext (GCM) ou os tokens deixam de ser persistidos.
  - [ ] Descriptografia ocorre somente no momento do uso.
  - [ ] Migration cobre dados existentes.

---

### SEC-04 — Bloqueio/alteração de role/exclusão não revoga sessões ativas

- **Componente:** Backend (Autenticação / Controle de acesso)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** As sessões são cookies iron-session stateless carregando `userId` e `role`. `requireAuth` apenas verifica a existência de `userId`; nunca verifica `users.isBlocked`. `requireRole`/`requirePermission` leem o `role` direto do cookie. Ações de admin (block, change_role, delete) mutam apenas o banco — não há `sessionVersion` nem revogação.
- **Localização no código:**
  - `backend/src/middleware/requireAuth.ts` (linhas ~4-10)
  - `backend/src/modules/admin/permissions/requireRole.ts` (linhas ~7-19)
  - `backend/src/modules/admin/users/adminUsers.service.ts` (block/role/delete)
- **Evidência:**
  ```ts
  export function requireAuth(req, res, next) {
    if (!req.session?.userId) { /* ... */ return 401; }
    next(); // nunca checa isBlocked, nunca relê role
  }
  ```
  ```ts
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) { return 403; } // role vem do cookie
  ```
- **Impacto:** (a) Usuário bloqueado mantém acesso até o cookie expirar; (b) admin rebaixado mantém `role` elevado no cookie; (c) usuário excluído ainda passa por `requireAuth`.
- **Cenário de exploração:** Admin bloqueia conta comprometida, mas o atacante continua operando com o cookie válido; admin demovido continua acessando endpoints de super_admin.
- **Correção recomendada:** Em cada requisição autenticada, consultar o usuário e rejeitar se `isBlocked`/excluído; obter `role` do banco (ou cache), ou adicionar `sessionVersion` incrementado em block/role-change/delete. Definir TTL (ver SEC-22).
- **Critérios de aceite:**
  - [ ] Requisições de usuário bloqueado/excluído são rejeitadas imediatamente após a ação.
  - [ ] Mudança de role invalida privilégios anteriores sem depender da expiração do cookie.
  - [ ] Testes cobrem block/demote/delete com sessão ativa.

---

### SEC-05 — Ausência de proteção CSRF + cookie SameSite=None em produção

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** A autenticação é exclusivamente por cookie de sessão HttpOnly e, em produção, o cookie é emitido com `sameSite: "none"`, desativando a proteção CSRF nativa do navegador. Não há middleware de token anti-CSRF nem validação de `Origin`/`Referer` nas rotas que mudam estado.
- **Localização no código:**
  - `backend/src/lib/session.ts` (linhas ~9-13)
  - `backend/src/app.ts` (sem middleware CSRF)
- **Evidência:**
  ```ts
  cookieOptions: { secure: isProd, httpOnly: true, sameSite: isProd ? "none" : "lax" }
  ```
- **Impacto:** `SameSite=None` envia o cookie em requisições cross-site. Logout CSRF funciona sem corpo; qualquer endpoint futuro que aceite form/urlencoded/text-plain, ou falha de CORS, torna-se explorável.
- **Cenário de exploração:** Página maliciosa dispara requisição cross-site; o cookie acompanha. Hoje mitigado parcialmente por `express.json()` (só `application/json`) + CORS, mas a dependência é frágil.
- **Correção recomendada:** `SameSite=Lax`/`Strict` quando front e API compartilham site; se cross-site, token CSRF (double-submit/synchronizer) e/ou validação estrita de `Origin`/`Referer`.
- **Critérios de aceite:**
  - [ ] Cookie usa `SameSite=Lax`/`Strict`, ou há token CSRF validado em todas as rotas mutantes.
  - [ ] Teste confirma rejeição de requisição cross-site sem token/origin válido.

---

### SEC-06 — Grafana exposto com credenciais padrão (admin/admin) em 0.0.0.0

- **Componente:** Infra (Observabilidade)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** O serviço Grafana não define `GF_SECURITY_ADMIN_PASSWORD`/`GF_SECURITY_ADMIN_USER` nem hardening de auth anônima, subindo com `admin/admin`. A porta é publicada como `3002:3000` sem bind de IP (0.0.0.0). Datasources marcados `editable: true`.
- **Localização no código:**
  - `docker-compose.observability.yml` (serviço grafana, linhas ~13-23)
  - `observability/grafana/.../datasources.yml`
- **Evidência:**
  ```yaml
  image: grafana/grafana
  ports:
    - "3002:3000"   # sem GF_SECURITY_ADMIN_PASSWORD
  ```
- **Impacto:** Qualquer um que alcance a porta 3002 entra como admin/admin, lê todos os dashboards e usa o proxy de datasource do Grafana para consultar Prometheus/Loki internamente.
- **Cenário de exploração:** Acesso à porta 3002 → login admin/admin → pivô via datasource proxy.
- **Correção recomendada:** Definir senha forte via secret, desabilitar cadastro, bind em 127.0.0.1 (ou proxy autenticado), `editable: false`.
- **Critérios de aceite:**
  - [ ] Grafana exige senha forte (sem admin/admin) via secret.
  - [ ] Porta não exposta em 0.0.0.0.
  - [ ] Datasources não editáveis pela UI.

---

### SEC-07 — Dependência `xlsx` 0.18.5 com Prototype Pollution + ReDoS

- **Componente:** Dependências (Backend)
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** `xlsx` (SheetJS) 0.18.5 do registro npm é afetado por **CVE-2023-30533** (prototype pollution) e **CVE-2024-22363** (ReDoS). Não há versão corrigida no npm; o fornecedor distribui correções apenas pelo CDN próprio (>=0.19/0.20).
- **Localização no código:**
  - `package.json` (linha ~57: `"xlsx": "^0.18.5"`)
- **Evidência:**
  ```json
  "xlsx": "^0.18.5"
  ```
- **Impacto:** Planilha maliciosa parseada → prototype pollution (potencial RCE/DoS) e ReDoS travando o event loop do Node.
- **Cenário de exploração:** Upload/importação de XLSX malicioso processado pela lib.
- **Correção recomendada:** Migrar para o build do CDN do fornecedor (`xlsx@^0.20.x` de cdn.sheetjs.com) ou substituir por `exceljs`. Nunca parsear planilhas não confiáveis com 0.18.5.
- **Critérios de aceite:**
  - [ ] `xlsx` atualizado para versão sem as CVEs (ou substituído por `exceljs`).
  - [ ] `npm audit`/scanner não reporta CVE-2023-30533 nem CVE-2024-22363.

---

### SEC-08 — URLs não confiáveis do scraper renderizadas em `href` (javascript:/data:)

- **Componente:** Frontend e Frontend ADM
- **Severidade:** 🟠 High (admin) / Medium (frontend, mitigado por CSP) — Prioridade Linear: 2 (Alta)
- **Descrição:** `job.url` / `job.jobLink` vêm do pipeline do scraper (não confiável) e são passados direto para `<a href=...>`. O React 19 não sanitiza `href`; valores como `javascript:...` ou `data:text/html,...` são renderizados. O validador `safeExternalUrl()` (allowlist http/https) existe e é usado em `FormattedJobDescription.tsx`, mas **não é aplicado** nestas células de link.
- **Localização no código:**
  - `frontend/src/domains/jobs/presentation/components/JobsTableCard.tsx` (~L187-195)
  - `frontend/src/domains/new_dashboard/components/jobs/JobDetailModal.tsx` (~L164-168)
  - `front_admin/src/modules/scrapers/ScrapersPage.tsx` (~L204-211)
- **Evidência:**
  ```tsx
  <a href={job.url} target="_blank" rel="noreferrer">{job.title}</a>
  ```
- **Impacto:** XSS armazenado disparado ao clicar. No admin é o mais grave: um link `javascript:` clicado por um admin pode disparar scrapes, bloquear/alterar role/excluir usuários como aquele admin. O admin **não** serve CSP (SEC-09), tornando-o diretamente explorável.
- **Cenário de exploração:** Vaga maliciosa com `url=javascript:...`; admin clica na `ScrapersPage`.
- **Correção recomendada:** Reutilizar `safeExternalUrl()` (http/https) em todo anchor alimentado por dados do scraper; renderizar `<span>` quando falhar.
- **Critérios de aceite:**
  - [ ] Todo `href` alimentado por dados de vaga passa por `safeExternalUrl()`.
  - [ ] URLs com esquema não http/https não são renderizadas como link.
  - [ ] Teste cobre `javascript:`/`data:` nas três telas.

---

### SEC-09 — Frontend ADM sem CSP/headers de segurança (sem vercel.json)

- **Componente:** Frontend ADM
- **Severidade:** 🟠 High — Prioridade Linear: 2 (Alta)
- **Descrição:** O `frontend/` público possui `vercel.json` e `nginx.conf` com CSP forte + X-Frame-Options/X-Content-Type-Options/Referrer-Policy. O `front_admin/` possui apenas `nginx.conf`. Se o admin for implantado na Vercel (como o público), será servido **sem CSP e sem headers de segurança** — a superfície de maior privilégio é a menos protegida.
- **Localização no código:**
  - `front_admin/` (ausência de `vercel.json`); comparar com `frontend/vercel.json`
- **Evidência:** `frontend/vercel.json` presente com `script-src 'self'; ... frame-ancestors 'none'`; `front_admin/vercel.json` ausente.
- **Impacto:** Sem CSP, o XSS de `href javascript:` (SEC-08), injeção de script inline e clickjacking ficam sem mitigação no console administrativo.
- **Cenário de exploração:** Atacante enquadra (iframe) ou injeta no admin e age com privilégios de admin. Compõe com SEC-08.
- **Correção recomendada:** Adicionar `vercel.json` ao `front_admin` espelhando os headers do frontend (ou confirmar que o nginx é o único deploy). Manter `script-src 'self'`.
- **Critérios de aceite:**
  - [ ] Admin serve CSP, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy em produção.
  - [ ] Caminho de deploy do admin documentado e validado (headers presentes na resposta real).

---

### SEC-10 — Retorno em massa de PII descriptografada (CPF/e-mail/telefone) para admin

- **Componente:** Backend (API / Exposição de dados)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** `GET /admin/users` (lista) e `GET /admin/users/:id` mapeiam cada linha por `toPublicUser`, que descriptografa e-mail, telefone e **CPF** de todos os usuários retornados (até 100 por chamada).
- **Localização no código:**
  - `backend/src/modules/admin/users/adminUsers.repository.ts` (`findMany` ~53-58, `findById` ~61-64)
  - `backend/src/modules/users/users.mapper.ts` (`toPublicUser` ~125-164)
- **Evidência:**
  ```ts
  return { data: data.map(toPublicUser), total, limit, offset };
  cpf: cpfEncrypted ? decryptText(cpfEncrypted) : user.cpf,
  phone: phoneEncrypted ? decryptText(phoneEncrypted) : user.phone,
  ```
- **Impacto:** Qualquer conta com role `admin` (não só super_admin) pode exfiltrar a PII sensível de toda a base em massa — anula a criptografia em nível de campo; risco LGPD.
- **Cenário de exploração:** Admin itera offsets em `GET /admin/users?limit=100` e coleta todos os CPFs.
- **Correção recomendada:** Não descriptografar CPF/telefone na projeção de lista (mascarar/omitir); descriptografar só na visualização de registro único com permissão dedicada e auditoria por revelação.
- **Critérios de aceite:**
  - [ ] Listagem não retorna CPF/telefone/e-mail em texto puro.
  - [ ] Revelação de PII completa exige permissão específica e gera auditoria.

---

### SEC-11 — SSRF via `apiUrl` fornecido por arquivo no adapter Lever (sem allowlist)

- **Componente:** Scraper Go
- **Severidade:** 🟡 Medium (High se os arquivos de companies/tenants forem remotos ou graváveis) — Prioridade Linear: 3 (Média)
- **Descrição:** Cada entrada de `leverCompanies.json` tem um `apiUrl` copiado direto para `a.apiURL` e retornado por `postingsEndpoint()` como a URL completa, sem validação de scheme/host e sem allowlist. O path do arquivo vem de `LEVER_COMPANIES_FILE` sem validação.
- **Localização no código:**
  - `scraper-go/internal/adapters/lever/adapter.go` (`FetchLeverSlugs` ~105-126; `postingsEndpoint` ~253-263; `BuildLeverAdapters` ~443-469)
  - `scraper-go/internal/interfaces/leverCompanies.json`
- **Evidência:**
  ```go
  func (a *LeverAdapter) postingsEndpoint() string {
      if a.apiURL != "" {
          return a.apiURL
      }
  ```
- **Impacto:** Quem influenciar o JSON de companies pode apontar o adapter para hosts internos (ex.: `http://169.254.169.254/...`) e o serviço busca/parseia a resposta.
- **Cenário de exploração:** `apiUrl` apontado para metadata/serviço interno → exfiltração via corpo retornado.
- **Correção recomendada:** Allowlist estrita de hosts (`api.lever.co`, `api.eu.lever.co`), rejeitar não-https/host fora, derivar endpoint do slug no servidor, validar paths de `LEVER_COMPANIES_FILE`/`GREENHOUSE_COMPANIES_FILE`/`INHIRE_TENANTS_FILE` contra base dir.
- **Critérios de aceite:**
  - [ ] Hosts de saída validados contra allowlist; schemes não-https rejeitados.
  - [ ] Paths de arquivos de config restritos a diretório-base esperado.
  - [ ] Teste bloqueia `apiUrl` malicioso (metadata/host interno).

---

### SEC-12 — Parâmetros de scrape sem limites → DoS/amplificação

- **Componente:** Scraper Go
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** Campos de `ScrapeRequest` passam quase sem limites. `MaxPagesPerKeyword`, `WaitBetweenSearchesMs`, `PageTimeoutMs` e o slice `Keywords` nunca têm teto; adapters só aplicam default quando o valor é `<= 0`. (`MaxConcurrency` É corretamente limitado.)
- **Localização no código:**
  - `scraper-go/cmd/server/handlers.go` (`handleScrape` ~33-53; `searchConfigFromRuntime` ~94-118)
  - `scraper-go/internal/domain/job.go` (`ScrapeRequest` ~31-45)
- **Evidência:**
  ```go
  maxPages := req.MaxPagesPerKeyword
  if maxPages <= 0 {
      maxPages = defaultTheMuseMaxPages
  }
  ```
- **Impacto:** `POST /scrape` (não autenticado, SEC-02) com `maxPagesPerKeyword` enorme e muitas keywords martela provedores pelo timeout do pipeline (~15min), consumindo CPU/memória/banda e arriscando ban de IP.
- **Cenário de exploração:** `POST /scrape {"maxPagesPerKeyword":1000000, "keywords":[...]}`.
- **Correção recomendada:** Impor máximos no servidor (limitar `MaxPagesPerKeyword`, `ResultsPerPage`, tamanho de `Keywords`, mínimo de `WaitBetweenSearchesMs`), espelhando os caps de batch de `internal/config/config.go`.
- **Critérios de aceite:**
  - [ ] Parâmetros de scrape têm tetos impostos no servidor.
  - [ ] Requisição com valores abusivos é normalizada/rejeitada.

---

### SEC-13 — Handlers JSON do Go sem limite de tamanho de corpo

- **Componente:** Scraper Go
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** `handleScrape` e `handleSaveKeywords` chamam `json.NewDecoder(r.Body).Decode(...)` sem `http.MaxBytesReader`.
- **Localização no código:**
  - `scraper-go/cmd/server/handlers.go` (`handleScrape` ~35; `handleSaveKeywords` ~150)
- **Evidência:**
  ```go
  if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
      http.Error(w, "invalid json body", http.StatusBadRequest)
  ```
- **Impacto:** Cliente não autenticado envia corpo arbitrariamente grande → alocação/buffering e DoS por exaustão de memória.
- **Cenário de exploração:** `POST /api/keywords` com corpo de centenas de MB.
- **Correção recomendada:** `http.MaxBytesReader(w, r.Body, N)` + `DisallowUnknownFields` onde apropriado.
- **Critérios de aceite:**
  - [ ] Corpos têm limite de tamanho; exceder retorna 413/400.

---

### SEC-14 — Respostas externas decodificadas sem `io.LimitReader`

- **Componente:** Scraper Go
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** Todos os adapters (exceto o caminho de *detalhe* do InHire) decodificam `resp.Body` com `json.NewDecoder(resp.Body)` sem limite. Um upstream hostil — ou alvo de SSRF via SEC-11 — pode retornar corpo ilimitado ou gzip-bomb.
- **Localização no código:**
  - `scraper-go/internal/adapters/{greenhouse,lever,jooble,gupy,themuse,adzuna}/adapter.go`
  - Padrão correto a copiar: `inhire/adapter.go` (~239, ~694)
- **Evidência:**
  ```go
  var data greenhouseListResponse
  if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
  ```
- **Impacto:** OOM do scraper a partir de uma única resposta upstream gigante; amplificado com vários adapters concorrentes.
- **Cenário de exploração:** Upstream retorna resposta/compressão descomunal.
- **Correção recomendada:** `io.LimitReader(resp.Body, maxBytes)` antes de decodificar, consistente em todos os adapters.
- **Critérios de aceite:**
  - [ ] Todos os adapters limitam o tamanho do corpo lido do upstream.

---

### SEC-15 — Endpoint `/metrics` do backend sem autenticação

- **Componente:** Backend (API)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** O endpoint Prometheus `/metrics` é registrado na raiz do app, fora de `withSession`/`requireAuth` e da rota RBAC `/admin/observability/metrics`.
- **Localização no código:**
  - `backend/src/app.ts` (linhas ~68-71)
- **Evidência:**
  ```ts
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
  ```
- **Impacto:** Divulgação de dados operacionais internos (rotas, volumes, latências, contador `jobSearchesTotal`); bypass da rota admin já protegida.
- **Cenário de exploração:** `GET /metrics` por qualquer um que alcance o serviço.
- **Correção recomendada:** Exigir auth + permissão de observabilidade ou restringir a rede interna/bearer. (Checar `/docs` Swagger em `server.ts` também.)
- **Critérios de aceite:**
  - [ ] `/metrics` exige autenticação/allowlist de rede.

---

### SEC-16 — Enumeração de usuários (409 no registro + timing no login)

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** (a) `register` retorna `409 "Email já cadastrado"` quando o e-mail existe. (b) `login` curto-circuita sem argon2 quando a credencial não existe, enquanto e-mail existente sempre roda `argon2.verify` (lento) — oráculo de timing.
- **Localização no código:**
  - `backend/src/modules/auth/credentials.service.ts` (`register` ~43-48; `login` ~109-119)
  - `backend/src/modules/auth/providers/credentials.ts` (`verifyCredentials` ~40-54)
- **Evidência:**
  ```ts
  if (existingCredential) { throw AppError.conflict("Email já cadastrado"); }
  if (!credential) { throw AppError.unauthorized("Credenciais inválidas"); }
  const valid = await argon2.verify(credential.passwordHash, password);
  ```
- **Impacto:** Enumeração de e-mails cadastrados para phishing/credential-stuffing.
- **Cenário de exploração:** Probing de e-mails medindo status/tempo de resposta.
- **Correção recomendada:** Resposta genérica no registro; no login, sempre executar `argon2.verify` dummy contra hash constante quando não houver credencial.
- **Critérios de aceite:**
  - [ ] Registro não revela existência da conta.
  - [ ] Login com tempo equivalente para e-mail existente vs. inexistente.

---

### SEC-17 — RBAC administrativo aplicado apenas no cliente (verificar backend)

- **Componente:** Frontend ADM
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** A matriz de permissões está hardcoded no bundle do navegador e anexada ao usuário no cliente a partir de `/auth/me`. Acesso a rotas e gating de features decididos no React. **Nota:** a auditoria do backend indicou RBAC server-side robusto; este card é para **confirmar** que *todo* endpoint privilegiado reforça role/permission no servidor.
- **Localização no código:**
  - `front_admin/src/lib/api/auth.api.ts` (`ROLE_PERMISSIONS` ~L10-33)
  - `front_admin/src/app/routes/ProtectedRoute.tsx` (`ROLE_HIERARCHY` ~L6-23)
  - `front_admin/src/modules/auth/hooks/useAuth.ts` (`hasPermission` ~L144-145)
- **Evidência:**
  ```ts
  if (ROLE_HIERARCHY[isLoggedIn.role] < ROLE_HIERARCHY[minRole]) return <Navigate to="/403" />;
  ```
- **Impacto:** Modelo de privilégios legível no bundle; se algum endpoint depender da UI para gating, role baixo chama direto.
- **Cenário de exploração:** Usuário de baixo privilégio chama endpoint admin diretamente.
- **Correção recomendada:** Tratar guards de cliente como UX; garantir authz server-side por ação/role em todos os endpoints; considerar entregar permissões pelo servidor.
- **Critérios de aceite:**
  - [ ] Inventário confirma `requireRole`/`requirePermission` no backend para cada endpoint admin.
  - [ ] Teste de autorização negativa (role baixo → 403).

---

### SEC-18 — Loki publicado com autenticação desabilitada

- **Componente:** Infra (Observabilidade)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** `auth_enabled: false` e Loki publicado em 0.0.0.0:3100.
- **Localização no código:**
  - `observability/loki/loki-config.yml` (linha ~1)
  - `docker-compose.observability.yml` (ports `3100:3100`, ~28-29)
- **Evidência:**
  ```yaml
  auth_enabled: false
  ```
- **Impacto:** Qualquer cliente no host lê/empurra logs (possível PII) e consulta o store sem credenciais.
- **Cenário de exploração:** `GET`/`POST` na API do Loki a partir da rede do host.
- **Correção recomendada:** Não publicar 3100 (interno em `vagas-net`) ou gateway autenticado; auth multi-tenant.
- **Critérios de aceite:**
  - [ ] Loki não acessível sem autenticação a partir do host.

---

### SEC-19 — Prometheus/observabilidade expostos sem auth em 0.0.0.0

- **Componente:** Infra (Observabilidade)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** Prometheus publicado em 0.0.0.0:9091 sem auth (não tem auth nativa). Exporters/alertmanager com config default.
- **Localização no código:**
  - `docker-compose.observability.yml` (prometheus ports `9091:9090`, ~2-11)
  - `observability/alertmanager/alertmanager.yml`
- **Evidência:**
  ```yaml
  ports:
    - "9091:9090"
  ```
- **Impacto:** Endpoints revelam topologia/metricas internas a quem alcançar a porta; auxilia reconhecimento.
- **Cenário de exploração:** `GET http://host:9091`.
- **Correção recomendada:** Bind em 127.0.0.1/rede de gerência; proxy autenticado.
- **Critérios de aceite:**
  - [ ] Portas de observabilidade não expostas em 0.0.0.0 sem auth.

---

### SEC-20 — Containers executando como root (sem diretiva USER)

- **Componente:** Infra (Containers)
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** Backend e scraper-go não dropam privilégios. Backend roda `npx tsx src/server.ts` como root; runtime Go (alpine) roda `/go-scraper` como root. Sem `cap_drop`/`read_only`/`no-new-privileges`.
- **Localização no código:**
  - `docker/node.Dockerfile` (stage backend ~15-21, sem `USER`)
  - `scraper-go/Dockerfile` (stage runtime ~17-33, sem `USER`)
- **Evidência:** Dockerfiles sem linha `USER`; serviços compose sem `security_opt`/`cap_drop`.
- **Impacto:** RCE no backend/scraper escala para root dentro do container, ampliando o raio de um escape.
- **Cenário de exploração:** RCE no serviço → root no container.
- **Correção recomendada:** `USER` não-root em ambos os Dockerfiles, `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, root FS read-only onde viável.
- **Critérios de aceite:**
  - [ ] Containers de backend e scraper rodam como não-root.
  - [ ] `no-new-privileges` e `cap_drop: [ALL]` aplicados.

---

### SEC-21 — Credenciais padrão fracas de banco (`vagas/vagas`) em .env.example

- **Componente:** Config / Infra
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** `POSTGRES_USER=vagas` / `POSTGRES_PASSWORD=vagas` / `POSTGRES_DB=vagas` e `DATABASE_URL=postgresql://vagas:vagas@...`. Defaults literais copiados para o `.env` real; consumidos por `docker-compose.infra.yml`/`docker-compose.migrate.yml`/postgres-exporter.
- **Localização no código:**
  - `.env.example` (linhas ~52-58)
  - `docker-compose.infra.yml` (~6-8), `docker-compose.migrate.yml` (~12), `docker-compose.observability.yml` (~55)
- **Evidência:**
  ```
  POSTGRES_PASSWORD=vagas
  DATABASE_URL=postgresql://vagas:vagas@localhost:5432/vagas
  ```
- **Impacto:** Se a porta do Postgres for exposta ou a `vagas-net` alcançável, `vagas:vagas` dá acesso total (PII criptografada + dados).
- **Cenário de exploração:** Conexão direta ao Postgres com credenciais conhecidas.
- **Correção recomendada:** `.env.example` com `POSTGRES_PASSWORD` vazio + comentário para gerar valor forte; nunca senha funcional por padrão.
- **Critérios de aceite:**
  - [ ] `.env.example` não contém senha de banco funcional.
  - [ ] Documentação instrui a gerar senha forte.

---

### SEC-22 — `SESSION_SECRET` não validado no boot + sessão sem TTL

- **Componente:** Backend (Autenticação) / Config
- **Severidade:** 🟡 Medium — Prioridade Linear: 3 (Média)
- **Descrição:** `password: process.env.SESSION_SECRET!` usa non-null assertion sem validação de presença/tamanho (iron-session exige ≥32 chars). Nenhum `ttl`/`maxAge` configurado.
- **Localização no código:**
  - `backend/src/lib/session.ts` (linhas ~5-14)
- **Evidência:**
  ```ts
  export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET!,
    cookieName: "vagas_session",
    cookieOptions: { secure: isProd, httpOnly: true, sameSite: isProd ? "none" : "lax" },
  };
  ```
- **Impacto:** Secret vazio/fraco sobe silenciosamente; secret fraco permite ataque offline ao cookie selado → forja de sessão. Sem TTL amplia o impacto da falta de revogação (SEC-04).
- **Cenário de exploração:** Deploy com `SESSION_SECRET` ausente/curto.
- **Correção recomendada:** Validar ≥32 chars no boot (fail fast, como `encryption.ts`); definir `ttl`/`maxAge`; considerar array de secrets para rotação.
- **Critérios de aceite:**
  - [ ] App falha no boot se `SESSION_SECRET` ausente/curto.
  - [ ] Sessão tem TTL/maxAge explícito.

---

### SEC-23 — Mensagens de erro internas vazadas ao cliente

- **Componente:** Backend (API)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Alguns handlers retornam `(error as Error).message` cru em todos os ambientes, contornando o `errorHandler` global (que suprime `cause` em produção).
- **Localização no código:**
  - `backend/src/modules/jobs/controllers/searchJobs.controller.ts` (~33-40)
  - `backend/src/routes/keywords.routes.ts` (~23-28)
  - `backend/src/routes/superAdmin.routes.ts` (~41-51)
- **Evidência:**
  ```ts
  res.status(500).json({ message: "Erro ao recuperar vagas em memória.", error: (error as Error).message });
  ```
- **Impacto:** Texto de exceção (erros de driver DB/cache) retornado a chamadores, auxiliando recon.
- **Cenário de exploração:** Forçar erro e ler detalhes internos.
- **Correção recomendada:** Remover `error.message` das respostas (ou `next(error)`).
- **Critérios de aceite:**
  - [ ] Respostas de erro não contêm detalhes internos em produção.

---

### SEC-24 — Injeção de wildcard LIKE na busca de usuários (admin)

- **Componente:** Backend (API)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** `search` do usuário embutido em `ilike` como `%${filters.search}%` sem escapar `%`/`_`. Não é SQLi (Drizzle parametriza), mas os metacaracteres de padrão são interpretados.
- **Localização no código:**
  - `backend/src/modules/admin/users/adminUsers.repository.ts` (`findMany` ~30-41)
- **Evidência:**
  ```ts
  ilike(users.username, `%${filters.search}%`),
  ilike(users.displayName, `%${filters.search}%`),
  ```
- **Impacto:** Ampliar matches arbitrariamente ou forçar varreduras `ILIKE` custosas (DoS menor).
- **Cenário de exploração:** `search=%`.
- **Correção recomendada:** Escapar `%`, `_`, `\` no termo antes de interpolar.
- **Critérios de aceite:**
  - [ ] Metacaracteres LIKE escapados no termo de busca.

---

### SEC-25 — IP do audit log obtido de `X-Forwarded-For` falsificável

- **Componente:** Backend (API / Logs)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** O `ip` do audit é lido direto do header `x-forwarded-for` em vez do `req.ip` validado pelo proxy (`trust proxy = 1`).
- **Localização no código:**
  - `backend/src/modules/admin/audit/audit.service.ts` (`fromRequest` ~40-43)
- **Evidência:**
  ```ts
  ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket.remoteAddress,
  ```
- **Impacto:** Ator em ações sensíveis pode forjar `X-Forwarded-For` para poluir a atribuição de IP (anti-forense).
- **Cenário de exploração:** `X-Forwarded-For: 1.2.3.4` ao executar ação admin.
- **Correção recomendada:** Usar `req.ip`.
- **Critérios de aceite:**
  - [ ] Audit log usa `req.ip`; header manual não influencia o IP registrado.

---

### SEC-26 — Credenciais de admin hardcoded no script de seed

- **Componente:** Backend (API / Scripts)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** O seed cria `admin@localhost.test` / `Admin@123456` (role `admin`) e um usuário com senhas fixas, sem guard impedindo rodar contra DB não-local.
- **Localização no código:**
  - `backend/src/scripts/seed.ts` (`SEED_USERS` ~39-56)
- **Evidência:**
  ```ts
  { username: "local.admin", displayName: "Local Admin",
    email: "admin@localhost.test", password: "Admin@123456", role: "admin" },
  ```
- **Impacto:** Se o seed rodar contra staging/produção, provisiona admin previsível.
- **Cenário de exploração:** Execução acidental do seed em ambiente compartilhado.
- **Correção recomendada:** Assert `NODE_ENV !== "production"` (abortar) e/ou senhas via env.
- **Critérios de aceite:**
  - [ ] Seed aborta fora de dev/local.
  - [ ] Senhas de seed não fixas/usáveis em prod.

---

### SEC-27 — Validação de param UUID ausente em algumas rotas

- **Componente:** Backend (API)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Rotas sem `validate({ params })`; `:id` não-UUID chega ao `eq()` (uuid). Ownership mantido no serviço (sem IDOR) — defesa em profundidade.
- **Localização no código:**
  - `backend/src/routes/notifications.routes.ts` (`PATCH /:id/read` ~31)
  - `backend/src/routes/savedJobs.routes.ts` (`GET /:id`, `GET /:id/events` ~23-28)
- **Evidência:**
  ```ts
  router.patch("/:id/read", (req, res, next) => { controller.markRead(req, res).catch(next); });
  ```
- **Impacto:** `:id` malformado → erro de cast do Postgres como 500.
- **Cenário de exploração:** `PATCH /abc/read`.
- **Correção recomendada:** Aplicar os schemas de params uuid existentes.
- **Critérios de aceite:**
  - [ ] Rotas retornam 400 para `:id` não-UUID.

---

### SEC-28 — Provider de credenciais morto com argon2 default (fraco)

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** `registerWithCredentials` faz hash com `argon2.hash(password)` (default) em vez do `argonOptions` endurecido, e insere credencial com `userId: ""` (FK inválida). Código morto, mas exportado.
- **Localização no código:**
  - `backend/src/modules/auth/providers/credentials.ts` (`registerWithCredentials` ~24-31)
- **Evidência:**
  ```ts
  const passwordHash = await argon2.hash(password); // default params
  await db.insert(credentials).values({ email: encryptText(normalizedEmail), emailHash, passwordHash, userId: "" });
  ```
- **Impacto:** Se religado: hashes mais fracos e linhas órfãs/colisão de unique constraint.
- **Cenário de exploração:** N/A (código morto) — risco se religado sem revisão.
- **Correção recomendada:** Remover ou alinhar a `argonOptions` + `userId` real.
- **Critérios de aceite:**
  - [ ] Função removida ou alinhada ao padrão endurecido.

---

### SEC-29 — Rate-limit em memória por instância + IP via XFF falsificável

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Sem `VALKEY_URL`, o limiter usa `Map` local (não compartilhado entre réplicas). IP de `req.ip` com `trust proxy = 1` pode ser spoofado se a topologia difere. Endpoints OAuth sem rate limiting.
- **Localização no código:**
  - `backend/src/middleware/rateLimit.ts` (~30-32, ~106-108, ~141-146)
  - `backend/src/app.ts` (`app.set("trust proxy", 1)` ~38)
- **Evidência:**
  ```ts
  const entry = process.env.VALKEY_URL ? await consumeFromValkey(...) : await consumeFromMemory(...);
  function clientIp(req) { return req.ip || req.socket.remoteAddress || "unknown"; }
  ```
- **Impacto:** Brute force distribuído / rotação de IP via XFF dilui o guarda de 20/IP. (O limiter por conta de 5/tentativa permanece como backstop.)
- **Cenário de exploração:** Credential-stuffing de uma origem spoofando XFF.
- **Correção recomendada:** Exigir store compartilhado (Valkey) em produção; confirmar `trust proxy` igual ao nº real de hops; rate limiting nos endpoints OAuth.
- **Critérios de aceite:**
  - [ ] Produção exige store de rate-limit compartilhado.
  - [ ] Endpoints OAuth têm rate limiting.

---

### SEC-30 — Troca de token do GitHub ignora erros HTTP

- **Componente:** Backend (Autenticação)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Diferente do LinkedIn, a troca do GitHub nunca checa `tokenRes.ok`; em falha, `access_token` é `undefined`, chamadas seguintes rodam com `Bearer undefined` e `String(user.id)` vira `"undefined"`, fluindo para `findOrCreateUser`.
- **Localização no código:**
  - `backend/src/modules/auth/providers/github.ts` (~19-56)
- **Evidência:**
  ```ts
  const { access_token } = await tokenRes.json(); // sem checar tokenRes.ok
  return { id: String(user.id), email: primaryEmail ?? user.email, ... };
  ```
- **Impacto:** Perfil malformado; aresta a endurecer junto de SEC-01.
- **Cenário de exploração:** Falha transitória na troca de token.
- **Correção recomendada:** Checar `tokenRes.ok`/`userRes.ok` e lançar; rejeitar quando `user.id` ausente.
- **Critérios de aceite:**
  - [ ] Falha HTTP na troca de token do GitHub resulta em erro explícito.

---

### SEC-31 — `/metrics` e `/health` do scraper-go sem autenticação

- **Componente:** Scraper Go
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** `GET /metrics` (promhttp) e `GET /health` sem auth; `/health` revela o backend de cache.
- **Localização no código:**
  - `scraper-go/cmd/server/server.go` (~77-78); `handlers.go` (`/health` ~120-128)
- **Evidência:**
  ```go
  mux.Handle("GET /metrics", promhttp.Handler())
  ```
- **Impacto:** Reconhecimento (internals Go/process, build info) por qualquer um na rede.
- **Cenário de exploração:** `GET /metrics` interno.
- **Correção recomendada:** Restringir `/metrics` à rede/credencial de monitoramento; `/health` mínimo.
- **Critérios de aceite:**
  - [ ] `/metrics` do scraper restrito a rede/credencial de monitoramento.

---

### SEC-32 — Chaves de API de providers embutidas em URLs de saída

- **Componente:** Scraper Go
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Chave do Jooble no path da URL; `app_id`/`app_key` do Adzuna na query string. Segredos em URL vazam por logs de proxy/upstream.
- **Localização no código:**
  - `scraper-go/internal/adapters/jooble/adapter.go` (`fetchPage` ~232-236)
  - `scraper-go/internal/adapters/adzuna/adapter.go` (`buildURL` ~91-92)
- **Evidência:**
  ```go
  endpoint = endpoint + "/" + a.apiKey
  ```
- **Impacto:** Se algum intermediário logar URLs completas, as credenciais são divulgadas. (O serviço em si não loga.)
- **Cenário de exploração:** Logs de proxy capturam a URL com a chave.
- **Correção recomendada:** Auth via header onde suportado; garantir não-logging; rotacionar chaves se logs puderem tê-las capturado.
- **Critérios de aceite:**
  - [ ] Chaves fora de URL onde possível, ou garantia documentada de não-logging.

---

### SEC-33 — Conexão Redis/Valkey em texto puro sem auth por padrão

- **Componente:** Scraper Go / Infra
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Conexão de `VALKEY_URL` via `redis.ParseURL`, default `redis://localhost:6379` (texto puro, sem senha). TLS/auth só se o operador fornecer. Dados sem criptografia no Valkey. (Chaves seguras — prefixos fixos + sha256.)
- **Localização no código:**
  - `scraper-go/cmd/server/server.go` (`newRedisClient` ~129-151)
  - `scraper-go/internal/cache/factory.go` (~13-36)
- **Evidência:** `redis.ParseURL(VALKEY_URL)` com default `redis://localhost:6379`.
- **Impacto:** Em deploy com Valkey não autenticado, jobs cacheados, keywords, quota e run-lock são legíveis/graváveis por quem tiver acesso de rede.
- **Cenário de exploração:** Acesso de rede ao Valkey sem auth.
- **Correção recomendada:** `rediss://` + credenciais em produção, validar no startup, isolar a rede.
- **Critérios de aceite:**
  - [ ] Produção usa Valkey autenticado/criptografado; startup valida.

---

### SEC-34 — Montagens sensíveis do host na stack de observabilidade

- **Componente:** Infra (Observabilidade)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Promtail monta `/var/run/docker.sock` (ro) e logs; node-exporter roda com `pid: host` e monta a raiz do host ro; cadvisor monta raiz/docker ro. Combinado com containers root (SEC-20), amplia a superfície de escape.
- **Localização no código:**
  - `docker-compose.observability.yml` (promtail ~42-43; node-exporter ~72-74; cadvisor ~82-86)
- **Evidência:**
  ```yaml
  - /var/run/docker.sock:/var/run/docker.sock:ro
  - /:/host:ro,rslave   # com pid: host
  ```
- **Impacto:** Leitura do FS do host + socket do Docker auxilia escalonamento/recon se um container de observabilidade for comprometido.
- **Cenário de exploração:** Comprometimento de container de observabilidade → recon do host.
- **Correção recomendada:** Rodar observabilidade em host isolado; preferir docker-socket-proxy; remover o mount do socket do promtail se desnecessário.
- **Critérios de aceite:**
  - [ ] Montagens do host restritas/isoladas; socket do Docker via proxy ou removido onde desnecessário.

---

### SEC-35 — Imagens de observabilidade com tags mutáveis (`:latest`)

- **Componente:** Infra (Supply chain)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** A maioria das imagens de observabilidade não tem tag, resolvendo para `:latest` (prometheus, grafana, exporters, node-exporter, cadvisor, alertmanager).
- **Localização no código:**
  - `docker-compose.observability.yml` (linhas ~3, 14, 52, 61, 70, 80, 92)
- **Evidência:**
  ```yaml
  image: prom/prometheus   # sem tag
  image: grafana/grafana   # sem tag
  ```
- **Impacto:** Builds não reprodutíveis e drift de supply-chain; imagem upstream nova/envenenada puxada automaticamente no rebuild.
- **Cenário de exploração:** Upstream comprometido entregue via `:latest`.
- **Correção recomendada:** Pinar versões/digests (como já feito para loki/promtail e postgres/valkey).
- **Critérios de aceite:**
  - [ ] Todas as imagens de observabilidade pinadas por versão/digest.

---

### SEC-36 — Workflows CI sem `permissions` de menor privilégio

- **Componente:** CI/CD
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** Nenhum workflow declara `permissions:`, então o `GITHUB_TOKEN` recebe o escopo default do repo. `ci.yml` roda `npm ci` + build em `pull_request`.
- **Localização no código:**
  - `.github/workflows/ci.yml` (sem `permissions:`, ~1-39)
  - `.github/workflows/block-master-pr.yml` (sem `permissions:`)
- **Evidência:** `ci.yml` com `on: pull_request` e nenhuma chave `permissions:`.
- **Impacto:** PR malicioso que dispare scripts de build/postinstall roda com token amplo. (Usa `pull_request`, não `pull_request_target` — evita o pwn-request clássico.)
- **Cenário de exploração:** PR de fork com script de install malicioso.
- **Correção recomendada:** `permissions: contents: read` no `ci.yml` e `pull-requests: write` escopado no `block-master-pr.yml`; considerar não rodar scripts de install não confiáveis em PRs de fork.
- **Critérios de aceite:**
  - [ ] Workflows declaram `permissions` de menor privilégio.

---

### SEC-37 — Nome de branch de PR não confiável interpolado em github-script

- **Componente:** CI/CD
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** O `head.ref` do PR é embutido num template-literal do corpo de comentário via `github-script`. É usado pelo client `github` autenticado (não shell) e o workflow é `pull_request` — **não** é command injection nem expõe secrets. Hardening apenas.
- **Localização no código:**
  - `.github/workflows/block-master-pr.yml` (bloco `script:`)
- **Evidência:**
  ```js
  const sourceBranch = context.payload.pull_request.head.ref;
  ```
- **Impacto:** Mínimo — conteúdo cosmético de comentário.
- **Cenário de exploração:** Branch com nome especial refletido no comentário.
- **Correção recomendada:** Opcionalmente sanitizar/encodar o ref no comentário.
- **Critérios de aceite:**
  - [ ] Ref do branch sanitizado/encodado no comentário (opcional/hardening).

---

### SEC-38 — CSP do nginx de produção (frontend) permite `http://localhost:3001`

- **Componente:** Frontend (Config)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** O CSP servido pelo nginx inclui `http://localhost:3001` (backend de dev) no `connect-src`, junto das APIs HTTPS. Origem de dev residual num header de produção que afrouxa a política.
- **Localização no código:**
  - `frontend/nginx.conf` (linha do `connect-src`)
- **Evidência:**
  ```
  connect-src 'self' http://localhost:3001 https://api.github.com https://api.candidate.app.br https://jobsglobalscraper.ddns.net
  ```
- **Impacto:** Baixo; higiene de config e potencial mixed-content. (A versão Vercel omite localhost.)
- **Cenário de exploração:** N/A direto; afrouxamento de política.
- **Correção recomendada:** Remover `http://localhost:3001` do CSP de produção do nginx.
- **Critérios de aceite:**
  - [ ] CSP de produção do frontend sem `http://localhost:3001`.

---

### SEC-39 — CSP de borda com pontos fracos menores (img-src/style-src)

- **Componente:** Config (Edge/Vercel)
- **Severidade:** 🟢 Low — Prioridade Linear: 4 (Baixa)
- **Descrição:** `style-src 'self' 'unsafe-inline'` permite estilos inline (tradeoff React, aceitável) e `img-src 'self' data: https:` permite imagens de qualquer origem HTTPS (amplo). `script-src` está correto como `'self'`.
- **Localização no código:**
  - `vercel.json` (header CSP, linha ~8)
- **Evidência:**
  ```
  style-src 'self' 'unsafe-inline' ...; img-src 'self' data: https:
  ```
- **Impacto:** Baixo — `unsafe-inline` em styles habilita injeção CSS limitada; `img-src` amplo enfraquece marginalmente controles de exfil. Sem enfraquecimento de script.
- **Cenário de exploração:** Exfil via requisição de imagem para host arbitrário.
- **Correção recomendada:** Restringir `img-src` aos hosts usados; estilos por nonce/hash a longo prazo.
- **Critérios de aceite:**
  - [ ] `img-src` restrito a hosts necessários.

---

## 5. Controles verificados como corretos (não geram card)

Registrado para contexto — validados no código e **corretos**:

- **Criptografia de PII:** AES-256-GCM com IV aleatório de 12 bytes + auth tag, formato versionado, validação estrita de chave. Sem reuso de IV, sem ECB/CBC. (`lib/security/encryption.ts`)
- **Hashing de senha:** argon2id (64MB / t=3 / p=4) nos fluxos reais. (`credentials.service.ts`, `adminUsers.repository.ts`)
- **Hash pesquisável:** HMAC-SHA256 com secret obrigatório e `timingSafeEqual`. (`lib/security/searchableHash.ts`)
- **Sem SQL injection:** acesso via query builder parametrizado do Drizzle; únicos `sql\`\`` são constantes (`now()`).
- **IDOR/BOLA bem tratado:** savedJobs, applicationNotes, notifications, keywords e user preferences escopam tudo por `userId` + id do recurso; `assertOwnsResource` retorna 404.
- **OAuth state:** `randomBytes(16)`, armazenado server-side e validado antes do uso (CSRF-on-callback presente); redireciona só ao `FRONTEND_URL` fixo (sem open redirect).
- **RBAC server-side:** `requireRole(min)` + `requirePermission(resource, action)`; matriz default-deny; `IMMUTABLE_RULES`; `delete`/`change_role` restritos a super_admin; `can()` falha seguro.
- **Mass assignment prevenido:** zod via `validate()` (strip de desconhecidos); `updateProfileSchema` não expõe `role`/`isBlocked`.
- **Sem SSRF no backend:** chamadas de saída usam host:port de env; `scraperClient` com timeout de 5s.
- **Sem command injection**, **sem path traversal** com entrada do usuário, **sem deserialização insegura** relevante.
- **Headers/hardening:** `express.json({ limit: "16kb" })`, `x-powered-by` off, CSP estrito na API, `X-Frame-Options: DENY`, nosniff, HSTS; errorHandler suprime `cause` em produção.
- **CORS:** allowlist explícita, fail-closed em produção; `credentials: true` só com allowlist (sem `*`).
- **Frontend:** tokens **não** em localStorage/sessionStorage (cookie HttpOnly); sem `dangerouslySetInnerHTML`/`eval`; `FormattedJobDescription` sanitiza HTML de scraper; `rel="noopener noreferrer"`; sem secrets no bundle.
- **Electron endurecido:** `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`; sem conteúdo remoto; `preload.js` não expõe nada; CSP estrito em `loading.html`.
- **Segredos:** `.env` **não** versionado nem no histórico git; `.env.example` sem secrets reais; `.env` montado read-only no scraper-go; `ENCRYPTION_MASTER_KEY`/`SEARCH_KEY` falham fechado se ausentes/inválidos.
- **CI:** usa `on: pull_request` (não `pull_request_target`), então PRs de fork não recebem secrets.
- **Proxy Vercel não é open proxy:** destino `https://jobsglobalscraper.ddns.net` hardcoded; só o path é influenciável.

---

## 6. Priorização sugerida

1. **Imediato:** SEC-01 (takeover OAuth), SEC-08 + SEC-09 (XSS href + admin sem CSP — corrigir juntos), SEC-06 (Grafana admin/admin), SEC-07 (xlsx).
2. **Curto prazo:** SEC-03 (tokens em texto puro), SEC-04 (revogação de sessão), SEC-05 (CSRF/SameSite), SEC-02 (auth backend↔scraper).
3. **Médio prazo:** SEC-10 a SEC-22.
4. **Hardening contínuo:** SEC-23 a SEC-39.

---

> **Nota de processo:** esta atividade não implementou correções, não abriu PRs, não alterou o ambiente MASTER e não criou cards no Linear. Este README é o único artefato de saída e serve como fonte para a criação manual dos cards (time Painel Vagas / PAV).
