# PAV-182 — Viabilidade de recuperar Match das vagas salvas

## Resultado da auditoria

O contrato atual não permite recuperar uma vaga específica do catálogo por
identificador estável. O enriquecimento das vagas salvas não foi implementado.
O Kanban mantém `Não calculado` quando a API não fornece compatibilidade.

## Endpoint e perfil

- O frontend usa `searchDashboardJobs`, em
  `src/features/jobs/api/dashboardJobsApi.ts`, para consultar `GET /jobs/search`.
- O endpoint também está disponível sob `/api/v1/jobs/search` conforme a montagem
  das rotas em `backend/src/app.ts`.
- O cliente utiliza cookies da sessão (`withCredentials`). O controller envia
  `req.session.userId` para `SearchJobsService`, que carrega o perfil atual por
  `JobProfileMatchService` e utiliza o cálculo existente de compatibilidade.
- A busca devolve `matchScore`, `matchSource` e `matchedTechnologies` quando
  disponíveis. Ausência de score não equivale a um percentual calculado de zero.

## Contrato de consulta

O parser `backend/src/modules/jobs/parsers/jobSearchQuery.parser.ts` aceita:

- `keywords`, `family`, `familyMode`, `technology`, `company`;
- `model`/`type`, `level`, `seniority`, `contract`/`contractType`/`jobTypes`;
- `location`, `continent`, `country`, `state`, `city`;
- `matchSort`/`sort` e paginação `page`, `limit`.

Não há filtro de ID original, ID externo, URL, `jobLink` ou lote de IDs/URLs.
Enviar esses parâmetros não cria uma consulta por identidade: o parser não os
inclui nos filtros. As rotas públicas de catálogo são `/jobs/search` e
`/jobs/filters/options`; não existe rota de detalhe ou lookup do catálogo.
O limite de resultados por página é 100, definido em `backend/src/lib/pagination.ts`.

## Identificadores e correspondência

- A vaga salva possui um UUID de `saved_jobs`, diferente do ID do catálogo.
- Ela preserva `jobLink`, título, empresa, localização, fonte e uma keyword,
  mas não uma associação ao ID original do catálogo nem os dados de Match.
- O frontend gera um ID de apresentação `recommended:<link>:<índice>` para a
  busca. Esse valor não é um identificador de catálogo aceito pelo endpoint.
- Quando há URL original válida, `jobLink` permite comparar exatamente com
  `url` de um resultado recebido. Isso não oferece um mecanismo para localizar
  esse resultado sem percorrer a busca, nem garante unicidade no catálogo.
- Se a URL original estiver ausente, o frontend gera um link `canddate.local`
  com dados textuais e índice da página; esse fallback não identifica uma vaga
  original de forma estável.
- Título igual, empresa parcial ou primeiro resultado textual não comprovam
  identidade. Providers diferentes e vagas homônimas não podem ser associados
  automaticamente. A busca por empresa usa substring; keywords usam índices
  de busca, sem contrato de correspondência exata por URL.

## Decisão de implementação e performance

Nenhuma nova requisição foi adicionada. Não há busca por card, varredura do
catálogo, paginação ilimitada ou cache novo de pontuações. A página atual de
resultados não foi utilizada como mecanismo de recuperação das vagas salvas:
ela não garante disponibilidade após recarregar e pode excluir essas vagas
pelos filtros ativos.

## Dependência para uma solução definitiva

É necessário um contrato autenticado de consulta em lote por identidade estável,
ou enriquecimento de `/saved-jobs` no servidor com associação ao catálogo.
Esse contrato deve resolver correspondências ausentes ou ambíguas explicitamente,
reutilizar o mesmo serviço de Match e o perfil atual, preservar zero real e
retornar score ausente quando não houver cálculo. Deve também definir expiração
e invalidação por mudanças de perfil/catálogo. Não basta persistir um percentual
fixo nem reaproveitar pontuações antigas pelo título.

Essa alteração depende de backend e ficou fora desta etapa. Não há contrato
novo, endpoint proposto implementado ou alteração do cálculo de compatibilidade.
