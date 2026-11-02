# Frontend

Aplicação web principal do Cand!Date!, voltada para usuários finais.

Ela concentra a landing page pública, autenticação, callback OAuth e dashboard de vagas com filtros, detalhes, vagas salvas, perfil e preferências.

## Stack

- React 19
- TypeScript
- Vite 8
- React Router
- Tailwind CSS
- Vitest + Testing Library

## Como executar

Na raiz do monorepo, instale as dependências:

```bash
npm install
```

Para subir frontend e backend juntos:

```bash
npm run dev
```

Para executar apenas este workspace:

```bash
npm run dev --workspace=frontend
```

Por padrão o Vite usa <http://localhost:5173>.

## Variáveis de ambiente

Crie o arquivo local a partir do exemplo:

```bash
cp frontend/.env.example frontend/.env
```

Variáveis usadas:

- `VITE_API_BASE_URL`: URL base da API, normalmente `http://localhost:3001`.
- `VITE_API_PROXY_TARGET`: alvo do proxy Vite quando chamadas relativas forem usadas.

## Organização

O frontend segue uma arquitetura Feature-Based, com domínio separado quando necessário:

- `src/app`: composição da aplicação, providers, rotas e layouts autenticados.
- `src/features/auth`: login, registro, callback OAuth e estado de sessão.
- `src/features/jobs`: busca, filtros, paginação e interface de vagas, preservando os contratos distintos dos catálogos.
- `src/features/marketing`: landing page pública.
- `src/app/dashboard`: composição, providers, tema e navegação do painel. As funcionalidades de home, vagas, candidaturas, mentoria, perfil, ajuda e notificações estão em `src/features/`.
- `src/shared`: componentes de UI, assets, hooks e utilitários reutilizáveis.

Veja também [ARCHITECTURE.md](ARCHITECTURE.md).

## Comandos

```bash
npm run dev --workspace=frontend
npm run build --workspace=frontend
npm run lint --workspace=frontend
npm run test --workspace=frontend
npm run test:coverage --workspace=frontend
npm run test:watch --workspace=frontend
npm run preview --workspace=frontend
```

## Testes

Os testes ficam em `frontend/tests` e cobrem componentes, páginas, hooks, contexto de autenticação, serviços e regras de domínio.

Para rodar somente os testes do frontend:

```bash
npm run test --workspace=frontend
```

Para cobertura:

```bash
npm run test:coverage --workspace=frontend
```
