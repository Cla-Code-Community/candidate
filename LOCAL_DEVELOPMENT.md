# Guia de Desenvolvimento Local

Este guia foi escrito para quem acabou de clonar o repositório e precisa subir o projeto do zero.

Objetivo: permitir execução local com o mínimo de tentativa e erro, usando apenas o que existe hoje no repositório.

## Visão rápida

O monorepo possui 5 blocos principais:

- frontend: aplicação principal do usuário final (React + Vite)
- backend: API Node.js/Express (TypeScript + Drizzle)
- front_admin: painel administrativo (React + Vite)
- scraper-go: serviço Go para coleta/agregação de vagas
- observability: stack de métricas e logs (Prometheus/Grafana/Loki etc.)

Além disso, há Docker Compose para infraestrutura e execução completa.

---

## 1) Pré-requisitos

### Obrigatórios

1. Git
2. Node.js 22+ (o backend exige >= 22)
3. npm (projeto usa package-lock e scripts npm)
4. Docker Desktop com Docker Compose (recomendado para subir stack completa)

### Opcionais (dependendo do fluxo)

1. Go 1.26+ (apenas se você quiser rodar o scraper-go fora do Docker)
2. PostgreSQL local (se quiser rodar backend local sem backend em container)
3. Valkey/Redis local (se quiser rodar backend/scraper local fora de container)

### Como verificar instalação

No terminal:

```bash
git --version
node -v
npm -v
docker --version
docker compose version
```

Opcional (Go):

```bash
go version
```

### Versão recomendada de gerenciador de pacotes

- Recomendado pelo projeto: npm
- Observação: existe pnpm-workspace.yaml, mas o lockfile ativo do projeto é package-lock.json.

---

## 2) Clonando o projeto

Exemplo:

```bash
git clone https://github.com/Cla-Code-Community/candidate.git
cd candidate
```

Se seu fork/repo tiver outro nome, ajuste os comandos.

---

## 3) Estrutura do monorepo

Estrutura de alto nível relevante:

- backend/
  - API Express, rotas de auth/users/jobs/keywords/saved-jobs/admin
  - migrações em backend/drizzle
  - testes unitários e integração em backend/tests
- frontend/
  - app principal (landing, login/cadastro, callback OAuth, dashboard)
  - testes em frontend/tests
- front_admin/
  - painel administrativo (dashboard, usuários, scrapers, observabilidade, auditoria, permissões)
  - testes em front_admin/tests
- scraper-go/
  - serviço Go de scraping
  - endpoints como /scrape, /health, /metrics, /api/keywords
- shared/
  - componentes compartilhados (ex.: CandidateLogo)
- docker/
  - Dockerfile multi-stage para backend/frontend/front_admin
- observability/
  - arquivos de configuração do Prometheus/Grafana/Loki/Alertmanager etc.
- docs/
  - documentação complementar
- docker-compose.infra.yml
  - PostgreSQL + Valkey
- docker-compose.yml
  - scraper-go + backend + frontend + front_admin
- docker-compose.migrate.yml
  - job de migração/backfill antes do backend
- docker-compose.observability.yml
  - stack de observabilidade

---

## 4) Instalação

Execute na raiz do monorepo:

```bash
npm install
```

Isso instala dependências da raiz e dos workspaces.

---

## 5) Variáveis de ambiente

## Arquivos de ambiente existentes

No estado atual do repositório, existem:

- .env.example (raiz)
- backend/.env.example
- frontend/.env.example

Também podem existir localmente após setup:

- .env
- backend/.env

Observação importante:

- front_admin não possui front_admin/.env.example versionado.

## Como criar

Na raiz:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Variáveis obrigatórias vs opcionais

### Obrigatórias na prática para uso completo

1. SESSION_SECRET
2. DATABASE_URL
3. CORS_ALLOWED_ORIGINS
4. FRONTEND_URL
5. GO_SCRAPER_URL (ou SCRAPER_URL em alguns fluxos)

### Necessárias somente se usar OAuth

1. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
2. GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
3. LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET

### Necessárias somente para fontes externas de scraping

1. ADZUNA_APP_ID / ADZUNA_APP_KEY
2. JOOBLE_API_KEY

### Segurança/PII

1. ENCRYPTION_MASTER_KEY
2. SEARCH_KEY
3. ENCRYPTION_KEY_ID

Se esses valores não estiverem definidos adequadamente, recursos que dependem de criptografia e busca segura podem falhar.

---

## 6) Banco de dados

## O que existe hoje

- ORM: Drizzle
- Dialeto: PostgreSQL
- Migrações: backend/drizzle
- Config Drizzle: backend/drizzle.config.js
- Não há arquivos de seeders versionados no repositório.

## Migrações (manual)

Rodando no workspace backend:

```bash
npm run db:migrate --workspace=backend
```

Alternativas:

```bash
npm run db:generate --workspace=backend
npm run db:push --workspace=backend
```

## Migrações via Docker

No fluxo Docker completo, há o serviço migrate em docker-compose.migrate.yml que roda:

- db:migrate
- security:backfill-user-pii

## Usuários padrão

Não há usuários padrão documentados como seed no repositório.

Como criar usuário para testes:

1. Use a tela de cadastro em /register
2. Ou envie POST /auth/register

---

## 7) Docker

## 7.1 Subir stack completa (recomendado para onboarding)

1; Criar rede:

```bash
docker network create vagas-net
```

2; Subir infra + app + migrate:

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.migrate.yml up --build -d
```

## 7.2 Parar stack

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.migrate.yml down
```

## 7.3 Rebuild

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.migrate.yml up --build -d
```

## 7.4 Logs

Logs de todos os serviços:

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.migrate.yml logs -f
```

Logs de um serviço específico (exemplo backend):

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml -f docker-compose.migrate.yml logs -f backend
```

## 7.5 Observabilidade (opcional)

Subir stack de observabilidade:

```bash
docker compose -f docker-compose.observability.yml up -d
```

Parar:

```bash
docker compose -f docker-compose.observability.yml down
```

---

## 8) Executando o projeto

Você tem 2 caminhos principais.

## Caminho A: Docker completo (mais simples para começar)

Use o comando da seção de Docker.

Portas esperadas:

- frontend: <http://localhost:5173>
- front_admin: <http://localhost:5174>
- backend: <http://localhost:3001>
- scraper-go: <http://localhost:8081>

## Caminho B: Node local (frontend + backend)

Na raiz:

```bash
npm run dev
```

Isso sobe:

- frontend em 5173
- backend em 3001

Para incluir admin junto:

```bash
npm run dev:admin
```

Comandos separados:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:front_admin
```

Observação importante para o Caminho B:

- Se backend estiver fora de container, DATABASE_URL e VALKEY_URL precisam apontar para serviços acessíveis pelo host.
- No compose de infra atual, PostgreSQL e Valkey não estão expostos por portas no host por padrão.
- Portanto, para backend local funcionar, você precisa:
  1. usar banco/valkey locais no host, ou
  2. expor portas no compose (ajuste manual), ou
  3. rodar backend também em container.

---

## 9) Acessando a aplicação

URLs principais:

- App principal: <http://localhost:5173>
- Login: <http://localhost:5173/login>
- Cadastro: <http://localhost:5173/register>
- Dashboard app: /home, /dashboard, /vagas, /mentoria, /perfil, /ajuda
- Callback OAuth: /auth/callback

Backend:

- Health: <http://localhost:3001/health>
- Swagger: <http://localhost:3001/docs>
- Metrics: <http://localhost:3001/metrics>

Scraper:

- Health: <http://localhost:8081/health>
- Metrics: <http://localhost:8081/metrics>
- Admin jobs count: <http://localhost:8081/admin/jobs/count>

Front admin:

- <http://localhost:5174>
- rota de login: /login
- rotas principais: /dashboard, /users, /scrapers, /observability, /audit, /permissions, /settings

## Login/senha padrão

Não há credenciais padrão versionadas/documentadas para produção/local no repositório.

Fluxo recomendado para ambiente local:

1. criar usuário via cadastro na aplicação principal
2. usar login com email/senha criados

Para OAuth, é necessário configurar credenciais de provedores no .env.

---

## 10) Fluxo da aplicação (visão funcional)

## Aplicação principal (frontend)

1. Landing page pública em /
2. Cadastro em /register
3. Login em /login
4. Callback OAuth em /auth/callback
5. Após autenticação, acesso a rotas protegidas:
   - /home
   - /dashboard
   - /vagas
   - /mentoria
   - /perfil
   - /ajuda

## Backend

- Sessão via cookie (iron-session)
- Rotas protegidas para usuários autenticados:
  - /users
  - /jobs
  - /keywords
  - /notifications
  - /saved-jobs
  - /admin

## Scraper e fila

- Backend pode enfileirar keywords no Valkey (chave scraper:keywords:pending)
- Scraper-go processa keywords e agrega vagas

## Front admin

- Login próprio do painel
- Controle de acesso por papel (support/admin/super_admin)
- Seções administrativas para operação da plataforma

---

## 11) Testando manualmente (roteiro prático)

Abaixo, os testes manuais sugeridos para os módulos principais.

## 11.1 Login

Passos:

1. Acesse <http://localhost:5173/login>
2. Tente enviar vazio
3. Informe credenciais inválidas
4. Informe credenciais válidas

Resultado esperado:

- validações de campo aparecem
- credenciais inválidas não autenticam
- credenciais válidas redirecionam para área protegida

## 11.2 Cadastro

Passos:

1. Acesse <http://localhost:5173/register>
2. Preencha campos obrigatórios
3. Teste telefone opcional vazio
4. Teste telefone válido
5. Teste telefone inválido

Resultado esperado:

- cadastro válido cria conta e redireciona para login
- telefone vazio é permitido
- telefone inválido exibe erro e bloqueia envio

## 11.3 Busca de vagas

Passos:

1. Faça login
2. Vá para /vagas
3. Acione busca/filtros

Resultado esperado:

- requests de busca retornam sem quebrar a UI
- estados de loading/erro são exibidos corretamente

## 11.4 Vagas salvas

Passos:

1. Em /vagas, salve uma vaga
2. Abra lista de salvas
3. Edite status/notas se disponível
4. Remova vaga salva

Resultado esperado:

- operações de criar/editar/remover refletem na interface

## 11.5 Perfil e preferências

Passos:

1. Vá para /perfil
2. Atualize dados do perfil
3. Atualize preferências

Resultado esperado:

- alterações persistem
- recarregar a tela mantém dados

## 11.6 Painel administrativo

Passos:

1. Acesse <http://localhost:5174/login>
2. Faça login com conta com permissão
3. Navegue por dashboard/users/scrapers/observability/audit/permissions/settings

Resultado esperado:

- acesso a páginas conforme papel
- usuário sem papel mínimo deve cair em 403

---

## 12) Como reproduzir bugs corretamente

Use sempre este formato:

1. Contexto
   - branch
   - commit
   - ambiente (Docker ou local)
   - variáveis relevantes
2. Passos para reproduzir
   - sequenciais e exatos
3. Resultado atual
4. Resultado esperado
5. Evidências
   - print, log, request/response, stack trace

Modelo:

- Passos:
  1. ...
  2. ...
  3. ...
- Resultado atual: ...
- Resultado esperado: ...

Exemplo real (telefone):

- Passos:
  1. abrir /register
  2. inserir telefone muito longo
  3. tentar enviar
- Resultado atual (bug): campo aceitava valor inválido
- Resultado esperado: bloquear dígitos excedentes e rejeitar telefone inválido

---

## 13) Testes automatizados

## 13.1 Monorepo (cobertura consolidada)

Na raiz:

```bash
npm run test:coverage
```

## 13.2 Backend

```bash
npm run test --workspace=backend
npm run test:coverage --workspace=backend
npm run test:watch --workspace=backend
```

## 13.3 Frontend

```bash
npm run test --workspace=frontend
npm run test:coverage --workspace=frontend
npm run test:watch --workspace=frontend
```

## 13.4 Front admin

```bash
npm run test --workspace=front_admin
npm run test:coverage --workspace=front_admin
```

## 13.5 Testes de integração e E2E

- Integração: existe no backend (backend/tests/integration).
- E2E browser (Playwright/Cypress): não há suíte E2E ativa/versionada no estado atual do repositório.

---

## 14) Checklist antes de abrir Pull Request

Use esta checklist:

- [ ] Projeto instala do zero (npm install)
- [ ] App sobe localmente (npm run dev) ou Docker completo
- [ ] Backend responde /health
- [ ] Frontend abre sem erro crítico
- [ ] Testes do escopo alterado passando
- [ ] Cobertura mantida para o escopo afetado
- [ ] Lint sem erros no frontend/front_admin
- [ ] Sem erro de TypeScript no escopo alterado
- [ ] Funcionalidade validada manualmente
- [ ] Sem regressões observáveis
- [ ] Logs limpos (sem erro não tratado)

---

## Comandos úteis extras

Builds:

```bash
npm run build:frontend
npm run build:front_admin
```

Validação rápida da raiz:

```bash
npm run validate
```

Electron:

```bash
npm run electron
npm run electron:dev
```

---

## Referências do projeto

- README.md (visão geral)
- BACKEND.md (detalhes da API)
- SCRAPER.md (detalhes do scraper-go)
- TESTING.md (roteiro de QA)
- frontend/README.md
- front_admin/README.md

---

## Lacunas identificadas no estado atual (sem suposição)

1. Não há front_admin/.env.example versionado.
2. Não há seed oficial versionado para usuários/dados iniciais.
3. Não há credenciais padrão oficiais documentadas para login local.
4. Não há suíte E2E browser ativa/versionada.
5. Há documentação antiga em alguns pontos com prefixo /api que pode divergir das rotas montadas em runtime (que usam /auth, /users, /jobs, etc.).

Se você for manter este guia, priorize resolver essas lacunas para reduzir tempo de onboarding.
