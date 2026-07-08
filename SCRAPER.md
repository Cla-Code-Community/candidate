# Scraper Go - Documentação

Este documento descreve o scraper implementado em Go localizado em `scraper-go/`.

## Visão geral

## Exemplos por adaptador

Abaixo há exemplos simplificados do payload esperado internamente e de como cada adaptador normalmente formata/retorna vagas.

- LinkedIn
  - Comportamento: consulta o endpoint público `jobs-guest` e faz parsing HTML com `goquery`.
  - Exemplo (Job individual retornado pelo adaptador):

```json
{
  "id": "24a1b2c3d4e5f6a7b8c9d0e1",
  "title": "Frontend Engineer",
  "company": "Empresa X",
  "location": "São Paulo, SP",
  "url": "https://www.linkedin.com/jobs/view/123456789/",
  "source": "LinkedIn",
  "sources": ["LinkedIn"],
  "keyword": "react",
  "keywords": ["react"]
}
```

- Adzuna
  - Comportamento: usa API oficial (quando `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` configurados) e retorna JSON com campos estruturados.
  - Exemplo (Job adaptado):

```json
{
  "id": "adzuna-987654",
  "title": "Desenvolvedor Backend",
  "company": "ACME",
  "location": "Remoto",
  "url": "https://www.adzuna.com/descricao/987654",
  "source": "Adzuna",
  "sources": ["Adzuna"],
  "keyword": "node",
  "keywords": ["node"]
}
```

- Jooble
  - Comportamento: integra com Jooble API quando `JOOBLE_API_KEY` presente; pode usar Redis para controle de cota.
  - Exemplo (Job adaptado):

```json
{
  "id": "jooble-13579",
  "title": "Data Engineer",
  "company": "Empresa Y",
  "location": "Curitiba, PR",
  "url": "https://jooble.org/vaga/13579",
  "source": "Jooble",
  "sources": ["Jooble"],
  "keyword": "data",
  "keywords": ["data"]
}
```

- Greenhouse / Lever / TheMuse
  - Comportamento: adaptadores per-company que fazem scraping/parsing da vaga ou consomem endpoints públicos por empresa.
  - Exemplo (job adaptado genérico):

```json
{
  "id": "greenhouse-abc123",
  "title": "Product Manager",
  "company": "Startup Z",
  "location": "Los Angeles, CA",
  "url": "https://boards.greenhouse.io/companyz/jobs/321",
  "source": "Greenhouse",
  "sources": ["Greenhouse"],
  "keyword": "product",
  "keywords": ["product"]
}
```

Esses exemplos ilustram o contrato interno entre adaptadores e pipeline: o pipeline espera `models.Job` com campos normalizados (URL limpa, título/empresa/local, `Source` e `StableID` calculável). O `jobstore.StableID` deriva o ID a partir de título+empresa+local ou URL.

## Especificação OpenAPI (local)

Criei uma especificação OpenAPI mínima em `openapi.yaml` descrevendo os endpoints HTTP públicos do serviço Go (`/scrape`, `/api/keywords`). Ela pode ser usada para gerar clientes ou documentação interativa.

Arquivo: `scraper-go/openapi.yaml` (no repositório)

---

O scraper é um serviço que consulta múltiplas fontes de vagas (LinkedIn, Adzuna, Greenhouse, TheMuse, Lever, Jooble, etc.), agrega os resultados, remove duplicatas e persiste/retorna as vagas via cache (Redis / Valkey). Ele foi projetado para ser usado internamente pelo backend Node.js, que delega buscas ao serviço Go.

Componentes principais:

- `cmd/server` — inicializador e ponto de entrada.
- `internal/adapters` — coleções de adaptadores por fonte que implementam a interface `Adapter`.
- `internal/pipeline` — core do pipeline de scraping, orquestra execução concorrente e indexação.
- `internal/jobstore` — persistência em Redis (valkey) para jobs, índices e IDs estáveis.
- `internal/cache` — abstração de cache com implementação Redis e memória (fallback).
- `internal/dedup` — regras para deduplicação/merge de vagas.
- `internal/keywords` — carregamento e persistência de keywords (configuração).
- `internal/inflight` — deduplicador de requisições concorrentes (singleflight).

## Como executar

Requisitos: Go >= 1.26, Redis (opcional, mas recomendado)

Construir e executar:

```bash
cd scraper-go
go build ./cmd/server
./server
```

Rodar em desenvolvimento (carregando `.env`):

```bash
cd scraper-go
go run ./cmd/server
```

Docker: há um `Dockerfile` em `scraper-go/`. No Docker Compose, configure `VALKEY_URL=redis://valkey:6379/0` no `.env` da raiz para que o scraper acesse o Valkey pelo nome do serviço na rede Docker.

## Endpoints HTTP

O serviço expõe endpoints HTTP (implementação em `cmd/server` e arquivos associados). Principais rotas:

- POST `/scrape` — body JSON com `ScrapeRequest` para disparar uma busca em todas as fontes configuradas. Retorna `ScrapeResponse` com `jobs`, `total`, `cachedAt` e `fromCache`.
- GET `/health` — verifica se o scraper está online e qual cache está em uso.
- GET `/api/keywords` — retorna as keywords atualmente carregadas.
- POST `/api/keywords` — atualiza/persiste as keywords (aceita `keywords: string[]`).
- GET `/admin/scrape/status` — informa se existe uma execução em andamento.
- GET `/admin/jobs/count` — retorna a quantidade de vagas persistidas no Valkey.
- GET `/admin/jobs` — lista as vagas persistidas no Valkey.

Exemplo de `ScrapeRequest` (JSON):

```json
{
  "keywords": ["react", "node"],
  "searchLocation": "Brasil",
  "searchGeoId": "106057199",
  "searchLanguage": "pt",
  "jobTypes": "C,F",
  "timeFilter": "r604800",
  "remoteOnly": true,
  "resultsPerPage": 25,
  "maxPagesPerKeyword": 5,
  "waitBetweenSearchesMs": 3000,
  "pageTimeoutMs": 15000,
  "maxConcurrency": 50
}
```

Exemplo de `ScrapeResponse` (JSON):

```json
{
  "jobs": [
    {
      "id": "...",
      "title": "Frontend Engineer",
      "company": "Empresa X",
      "location": "São Paulo, SP",
      "url": "https://...",
      "source": "LinkedIn",
      "sources": ["LinkedIn"],
      "keyword": "react",
      "keywords": ["react"]
    }
  ],
  "total": 1,
  "cachedAt": "2026-05-26T10:00:00Z",
  "fromCache": false
}
```

> Observação: os nomes dos endpoints e o prefixo podem variar conforme a implementação local; verifique `cmd/server` para confirmar a porta e rotas ativadas.

## Pipeline de scraping

Fluxo principal:

1. Recebe `ScrapeRequest` com keywords e configuração.
2. Verifica cache (`internal/cache`). Se encontrado, retorna resultado cacheado.
3. Caso contrário, executa `pipeline.ScrapeAllSources` que:
   - Constrói lista de adaptadores (`adapters.GetAdapters`).
   - Cria tarefas (adapter × keyword) e executa concorrente com limite (`MaxConcurrency`).
   - Cada adaptador realiza requisições HTTP específicas, parseia HTML/JSON com `goquery` e retorna `models.Job`.
   - Agrega resultados e aplica deduplicação (`dedup.DedupeJobs`).
   - Persiste vagas novas no `jobstore` (Redis) e atualiza índices invertidos (função `IndexJobsInValkey`).
   - Escreve resultado no cache para próximas requisições.

Concorrência e resiliência:

- Semáforos por adaptador (ex.: LinkedIn usa um semáforo de 5 simultâneos para proteção).
- Tratamento de status 429 com backoff; aborta apenas a keyword afetada em caso de falhas persistentes.
- Uso de `inflight` para evitar que múltiplas requisições idênticas disparem scrapes simultâneos.

## Adaptadores

Cada adaptador em `internal/adapters` implementa a interface `Adapter` com `SourceName()` e `Search(ctx, keyword, req)`.
Implementações incluem:

- `linkedin.go` — busca via endpoint público `jobs-guest` do LinkedIn; parsing com `goquery`.
- `adzuna.go` — integra via API Adzuna (se configurada com `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`).
- `jooble.go` — integra com Jooble API (se `JOOBLE_API_KEY` configurada); pode usar Redis para quota.
- `greenhouse.go`, `lever.go`, `themuse.go` — adaptadores por empresa/plataforma com parsing/integração próprios.

Boas práticas nos adaptadores:

- Normalização de campos (URL, título, empresa, localização).
- Derivação de `ID` estável via `jobstore.StableID` (título+empresa+local ou URL normalizada).
- Dedupe local antes de retornar ao pipeline.

## Persistência e índice (Valkey)

- `jobstore.SaveBatch` persiste vagas no Redis com TTL e mantém um índice global (`scraper:jobs:index`).
- `pipeline.IndexJobsInValkey` cria índices invertidos por keyword e sub-termos (`scraper:jobs:keyword:<term>`), além de manter TTL para índices.
- `jobstore.StableID` garante IDs determinísticos para permitir identificação e deduplicação entre execuções.

## Cache e configuração

- Cache é abstraído por `internal/cache` com implementações Redis (`NewRedisCache`) e memória (fallback para testes).
- Chave de cache do scraper é construída por `pipeline.BuildCacheKey` (consistente com os parâmetros de busca).

## Testes

- Há testes e fixtures (ex.: `internal/keywords/keywords.test.json`) para validar normalização.
- Recomenda-se executar `go test ./...` dentro de `scraper-go`.

## Variáveis de ambiente importantes

- `VALKEY_URL` — conexão Redis/Valkey. Em Docker Compose, use `redis://valkey:6379/0`; em execução local fora do Docker, use uma URL acessível pelo host, por exemplo `redis://localhost:6379/0`.
- `JOOBLE_API_KEY` — Jooble integration.
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — Adzuna API.
- Configurações de logging e quota podem ser definidas via `.env`.

## Observações operacionais

- Projetado para rodar frequentemente; use caching e indexação para reduzir chamadas repetidas.
- Monitorar erros 429 e ajustar `WaitBetweenSearchesMs` / semáforos por adaptador.
- Verifique logs estruturados (slog JSON) para métricas de sucesso/falhas por adaptador.

---

Arquivo gerado: `scraper-go/SCRAPER.md`.
