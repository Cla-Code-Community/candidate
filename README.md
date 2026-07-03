# Painel de Vagas

[![CI](https://github.com/Benevanio/Jobs_Scraper_Global/actions/workflows/ci.yml/badge.svg)](https://github.com/Benevanio/Jobs_Scraper_Global/actions/workflows/ci.yml)
![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-339933)
![Monorepo](https://img.shields.io/badge/architecture-monorepo-0A66C2)
![License ISC](https://img.shields.io/badge/license-ISC-lightgrey)

Plataforma de captura, agregação e consulta de vagas com arquitetura monorepo, composta por frontend web, backend Node.js e aplicação desktop com Electron.

O produto evoluiu para um modelo orientado a serviços (API + scraper Go + cache/índices), com autenticação, preferências de usuário e integração com banco de dados.

## Links oficiais

- Gestão de produto (Linear): https://linear.app/tatame/team/PAV/all
- Design system oficial (Figma): https://www.figma.com/design/gollJBtK8PGkffNN4zk9t9/Painel-Dev---releitura?node-id=0-1&p=f&t=zU8zrFzPsNPxZ3qU-0
- Documentação backend detalhada: [BACKEND.md](BACKEND.md)
- Documentação scraper Go: [SCRAPER.md](SCRAPER.md)
- Guia de testes: [TESTING.md](TESTING.md)
- Documentação inicial do MVP (Visão PO) [ESCOPO.md](ESCOPO.md)

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura do monorepo](#arquitetura-do-monorepo)
- [Stack real do projeto](#stack-real-do-projeto)
- [Quickstart local](#quickstart-local)
- [Comandos verificados](#comandos-verificados)
- [API backend (estado atual)](#api-backend-estado-atual)
- [Docker (infra + aplicação)](#docker-infra--aplicação)
- [Desktop com Electron](#desktop-com-electron)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Testes e qualidade](#testes-e-qualidade)
- [Fluxo de desenvolvimento e branching](#fluxo-de-desenvolvimento-e-branching)
- [Git Hooks e qualidade local](#git-hooks-e-qualidade-local)
- [Inconsistências atuais mapeadas](#inconsistências-atuais-mapeadas)
- [Roadmap técnico sugerido](#roadmap-técnico-sugerido)
- [Contribuição](#contribuição)

## Visão geral

Este repositório centraliza três frentes:

- Frontend React para visualização e operação da plataforma.
- Backend Node.js/Express (TypeScript) com autenticação, preferências e rotas de domínio.
- Scraper em Go para coleta de vagas em múltiplas fontes.

Objetivo de produto: fornecer uma base robusta para busca, filtragem e gestão de vagas com foco em qualidade de dados, escalabilidade e operação contínua.

## Arquitetura do monorepo

```text
.
├─ frontend/                # Dashboard web (React + Vite)
├─ backend/                 # API Node.js (Express + TS + Drizzle)
├─ scraper-go/              # Serviço Go de scraping multi-fonte
├─ electron/                # Shell desktop
├─ docker-compose.yml       # App stack (frontend + backend + scraper-go)
├─ docker-compose.infra.yml # Infra stack (Postgres + Valkey)
└─ .github/workflows/ci.yml # CI
```

## Stack real do projeto

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS, Vitest.
- Backend: Node.js 22+, Express 5, TypeScript, Drizzle ORM, Zod, Iron Session, Redis/Valkey.
- Scraping: Go (serviço dedicado em scraper-go).
- Desktop: Electron + Electron Builder.
- Qualidade: Vitest (frontend/backend), cobertura v8, ESLint (frontend), GitHub Actions CI.
- Dados: Postgres (persistência) + Valkey/Redis (cache e índice).

## Quickstart local

### Pré-requisitos

- Node.js >= 22
- npm
- Docker e Docker Compose (opcional, recomendado para ambiente completo)

### Instalação

```bash
npm install
```

### Execução web (frontend + backend)

```bash
npm run dev
```

Execução separada:

```bash
npm run dev:frontend
npm run dev:backend
```

### Execução de testes

```bash
npm run test:coverage
```

## Comandos verificados

Os comandos abaixo existem hoje no repositório e foram conferidos nos package.json de raiz, frontend e backend.

### Raiz

- npm run dev
- npm run dev:frontend
- npm run dev:backend
- npm run scraper
- npm run scraper:watch
- npm run test
- npm run test:coverage
- npm run build
- npm run build:frontend
- npm run validate
- npm run electron
- npm run electron:dev
- npm run dist
- npm run db:generate
- npm run db:migrate
- npm run db:push

### Backend

- npm run start
- npm run dev
- npm run api
- npm run test
- npm run test:coverage
- npm run test:watch
- npm run validate
- npm run db:generate
- npm run db:migrate
- npm run db:push

### Frontend

- npm run dev
- npm run build
- npm run lint
- npm run preview
- npm run test
- npm run test:coverage
- npm run test:watch

## API backend (estado atual)

Base: /

Sistema:

- GET /health

Autenticação:

- GET /auth/:provider/url
- GET /auth/:provider/callback
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/me

Usuários:

- GET /users/profile
- PATCH /users/profile
- GET /users/preferences
- POST /users/preferences
- PATCH /users/preferences

Jobs:

- GET /jobs/search

Keywords:

- GET /keywords
- POST /keywords

Saved jobs:

- GET /saved-jobs
- GET /saved-jobs/:id
- POST /saved-jobs
- PATCH /saved-jobs/:id
- DELETE /saved-jobs/:id

Swagger:

- GET /docs

## Docker (infra + aplicação)

Este projeto separa infraestrutura de aplicação em dois arquivos compose.

1. Criar rede compartilhada (necessário uma vez):

```bash
docker network create vagas-net
```

2. Subir infra (Postgres + Valkey):

```bash
docker compose -f docker-compose.infra.yml up -d
```

3. Subir aplicação (scraper-go + backend + frontend):

```bash
docker compose up --build -d
```

4. Logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f scraper-go
```

5. Encerrar:

```bash
docker compose down
docker compose -f docker-compose.infra.yml down
```

Serviços padrão:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Scraper Go: http://localhost:8081

## Desktop com Electron

O app desktop empacota frontend + backend e inicia a aplicação com Electron.

Comandos:

```bash
npm run build:frontend
npm run electron
```

Distribuição (Windows):

```bash
npm run dist
```

Saída esperada do instalador:

- dist-electron/Vagas Full Setup X.X.X.exe

## Variáveis de ambiente

Arquivo base:

- backend/.env.example

Arquivo local:

- backend/.env

Variáveis centrais de operação:

- DATABASE_URL
- VALKEY_URL
- GO_SCRAPER_URL
- SESSION_SECRET
- CORS_ALLOWED_ORIGINS
- SEARCH_LOCATION
- SEARCH_GEO_ID
- SEARCH_LANGUAGE
- REMOTE_ONLY
- JOB_TYPES
- TIME_FILTER
- WAIT_BETWEEN_SEARCHES_MS
- PAGE_TIMEOUT_MS
- MAX_PAGES_PER_KEYWORD
- CACHE_TTL_MS

Segurança operacional:

- Nunca versionar segredos reais no Git.
- Preferir acesso interno para banco/cache em VPS.
- Em ambiente externo, usar TLS para conexões de dados sempre que possível.

## Testes e qualidade

Estrutura:

- backend/tests/unit
- backend/tests/integration
- frontend/tests/unit
- frontend/tests/integration

Threshold mínimo:

- lines >= 80%
- statements >= 80%
- functions >= 80%
- branches >= 80%

Comandos:

```bash
npm run test:coverage
npm --workspace frontend run test:coverage
npm --workspace backend run test:coverage
```

Observação importante: o backend já está configurado para coletar cobertura apenas em src/**/*.ts, evitando contagem de artefatos gerados.

## CI/CD

Workflow atual: .github/workflows/ci.yml

Executa em push para master/develop e em pull_request:

- Instalação de dependências
- Coverage frontend
- Coverage backend
- Lint frontend
- Build frontend

## Fluxo de desenvolvimento e branching

Padrão oficial:

1. Abrir card no Linear: https://linear.app/tatame/team/PAV/all
2. Criar branch de feature a partir de master
3. Desenvolver e testar localmente
4. Abrir PR da feature para develop
5. Após aprovação e validação, merge em develop
6. Abrir PR de develop para master
7. Merge em master para release

Convenção recomendada de branch:

- feature/<id-do-card>-<descricao-curta>

## Git Hooks e qualidade local

O repositório usa Husky na raiz do monorepo para padronizar validações locais em qualquer branch.

Hooks configurados:

- pre-commit: executa lint-staged para validar arquivos staged do frontend.
- commit-msg: valida mensagem de commit com commitlint (Conventional Commits).
- pre-push: executa validação do monorepo (test backend + lint/build frontend).

Bootstrap recomendado para novos ambientes:

```bash
npm run setup:dev
```

Checklist quando hooks não disparam:

1. Validar se o diretório Git foi detectado: git rev-parse --git-dir.
2. Validar hooksPath local: git config --get core.hooksPath.
3. Confirmar arquivos versionados em .husky (pre-commit, commit-msg, pre-push).
4. Reinstalar hooks: npm run prepare.
5. Em Windows, preferir Git Bash para depuração de scripts shell.

Observação importante:

- CI continua obrigatório e independente de hooks locais. Mesmo com bypass local, o pipeline valida cobertura/lint/build antes de merge.



## Roadmap técnico sugerido

### DX e onboarding

- Adicionar script único de bootstrap (exemplo: npm run setup:dev) para criar .env e validar pré-requisitos.
- Adicionar verificação automática de scripts quebrados no CI.
- Padronizar comandos cross-platform (evitar dependência de sintaxe de variável de ambiente Unix em scripts críticos).


### Segurança

- Aplicar política de rotação de SESSION_SECRET e credenciais OAuth.
- Adicionar checklist de segurança para PRs (cookies, CORS, secrets, headers).

### Performance

- Definir estratégia de paginação e filtros em camada de API com métricas por endpoint.
- Revisar TTL e cardinalidade dos índices no Valkey para reduzir consumo de memória.

### Observabilidade

- Padronizar correlação de logs por request id.
- Publicar guia mínimo de troubleshooting com sinais de saúde dos serviços frontend/backend/scraper-go.

## Contribuição

1. Abra um card no Linear.
2. Crie branch a partir de master.
3. Implemente com testes.
4. Execute validações locais:

```bash
npm run validate
npm run test:coverage
```

5. Abra PR para develop com contexto técnico objetivo.

---

Se você vai trabalhar em backend, scraper ou testes, use também:

- [BACKEND.md](BACKEND.md)
- [SCRAPER.md](SCRAPER.md)
- [TESTING.md](TESTING.md)
