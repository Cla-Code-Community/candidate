# Arquitetura do Frontend

O frontend usa Feature-Based Architecture. Cada funcionalidade mantém seus componentes, contratos e integrações; camadas internas existem somente quando necessárias.

## Organização

- `src/app/routes`: definição das rotas e página de rota não encontrada.
- `src/app/providers`: composição dos providers globais.
- `src/app/layouts`: layout autenticado e seus componentes de navegação.
- `src/app/dashboard`: composição, navegação, providers e tema do painel atual.
- `src/features`: applications, auth, dashboard, help, home, jobs, marketing, mentoring, notifications e profile.
- `src/shared/api`: cliente HTTP compartilhado e tratamento de erros de API.
- `src/shared/utils`, `hooks`, `ui`, `assets` e `feedback`: utilitários, hooks, componentes, recursos e contexto de feedback reutilizáveis.
- `src/styles`: estilos globais.

## Convenções das funcionalidades

- `api/`: integrações HTTP; clientes e contratos existentes são preservados.
- `hooks/`: hooks de carregamento, persistência e estado.
- `components/` e `pages/`: componentes e páginas específicos da funcionalidade.
- `domain/` e `types/`: regras puras, schemas e contratos, quando necessários.
- `application/`: contextos e providers com responsabilidade de aplicação; não são hooks.
- Arquivos pequenos de contratos, eventos ou dados podem permanecer na raiz da funcionalidade. Não criar diretórios vazios.

O catálogo anterior mantém seu contrato em `features/jobs/types/job.types.ts`, distinto do contrato do painel em `features/jobs/domain/job.ts`. O contexto e os dados demonstrativos legados permanecem em `features/jobs/legacy`. Candidaturas, notas e Kanban pertencem a `features/applications`.

## Imports

Preferir imports canônicos com `@/app`, `@/features` e `@/shared`. Preservar imports relativos locais quando claros. Código específico permanece na funcionalidade; somente recursos reutilizáveis pertencem a shared. Evitar dependências circulares. Rotas, exports, providers, APIs e modelos distintos são preservados pela organização.
