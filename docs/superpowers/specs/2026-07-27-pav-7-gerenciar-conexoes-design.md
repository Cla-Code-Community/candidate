# PAV-7 — Vincular conta social a usuário local + Gerenciar conexões

**Ticket:** [PAV-7](https://linear.app/tatame/issue/PAV-7) · EPIC 1 — Autenticação + Login Social
**Branch:** `feature/pav-7-gerenciar-conexoes`
**Data:** 2026-07-27

## Contexto

Boa parte do backend já existe:

- A tabela `accounts` (`src/db/schema/accounts.ts`) já é o modelo de providers pedido pelo ticket:
  `userId`, `provider`, `providerAccountId`, tokens, com `uniqueIndex(provider, providerAccountId)`.
- `findOrCreateUser` (`src/modules/users/functions/findOrCreateUser.ts`) já faz o **merge** no login:
  busca por provider → senão por email (vincula ao usuário existente sem duplicar) → senão cria usuário + account.
  Isso já satisfaz o critério "não cria duplicidade quando o email já existe".
- Login OAuth (`google`, `linkedin`, `github`) e login local (email/senha via `credentials`) funcionam.
- Sessão via `req.session` (`userId`, `role`); OAuth guarda `oauth_state` na sessão e valida no callback.

**Falta** para fechar o PAV-7 (escopo desta branch — os 4 itens):

1. Conectar um provider estando **já logado** (hoje o OAuth só faz login).
2. Desconectar um provider, com validação para não trancar o usuário para fora.
3. Listar as conexões do usuário atual.
4. Tela "Gerenciar conexões" no frontend.

## Decisões de produto

- **Conectar logado (modo vínculo):** reusar o fluxo OAuth atual com uma flag de intenção (`intent=link`),
  em vez de endpoints/redirect URIs novos. Motivo: não exige cadastrar novas redirect URIs nos consoles
  OAuth (Google/LinkedIn/GitHub), reaproveitando o `state`/CSRF e o código de provider já existentes.
- **Regra de desconexão:** manter **≥ 1 método de login**. Conta como método: qualquer provider vinculado
  **ou** senha (`credentials`). Só bloqueia remover o **último** método. Usuário pode ser só-OAuth.
- **Conflito ao conectar:** se a conta do provider já estiver vinculada a **outro** usuário, **bloquear com erro**
  (`provider_already_linked`). Não migra nem faz merge silencioso.

## Modelo de dados

Sem mudança de schema. Nenhuma migration nova. `accounts` e `credentials` já cobrem o necessário.

## Backend

### Service

Novos métodos (reusando `findUserByProvider`, `createAccount` e a leitura de `credentials`):

- **`linkProvider(userId, provider, profile)`**
  - Busca `account` por `(provider, providerAccountId = profile.id)`.
  - Já vinculado ao **próprio** `userId` → sucesso idempotente (no-op).
  - Vinculado a **outro** usuário → lança `provider_already_linked`.
  - Senão → `createAccount({ userId, provider, profile })`.
- **`listConnections(userId)`**
  - Retorna, para cada provider suportado (`google`, `linkedin`, `github`):
    `{ provider, connected: boolean, connectedAt?: Date }`.
  - Mais `hasPassword: boolean` (existe linha em `credentials` para o usuário).
- **`disconnectProvider(userId, provider)`**
  - `methodsAfter = (providers vinculados distintos, exceto o removido) + (hasPassword ? 1 : 0)`.
  - Se `methodsAfter === 0` → lança `cannot_remove_last_method`.
  - Senão → deleta a(s) linha(s) de `accounts` de `(userId, provider)`.

### Rotas (`src/routes/auth.routes.ts`)

- **Conectar:** reusa `GET /auth/:provider/url`, aceitando query `?intent=link`.
  No `AuthController.getUrl`, quando `intent=link`, guarda `oauth_intent="link"` na sessão
  (ao lado de `oauth_state`).
- **Callback:** em `AuthController.callback`, após validar o `state` (lógica atual inalterada):
  - Se `oauth_intent === "link"` **e** `req.session.userId` existe:
    - Obtém o profile via provider (`getProfileFromProvider`).
    - Chama `linkProvider(req.session.userId, provider, profile)`.
    - **Não** altera a sessão.
    - Redireciona para `${FRONTEND_URL}/perfil/conexoes?linked=<provider>`
      (ou `?error=<code>` em falha).
  - Senão → fluxo de login atual (cria/atualiza sessão, redireciona para `/auth/callback`).
  - Sempre limpa `oauth_intent` ao final (sucesso ou erro).
- **Listar:** `GET /auth/connections` (com `requireAuth`) → `listConnections(req.session.userId)`.
- **Desconectar:** `DELETE /auth/connections/:provider` (com `requireAuth`) → `disconnectProvider(...)`.

As rotas `/connections` e `/connections/:provider` não colidem com `/:provider/url` e
`/:provider/callback` (segmentos e/ou métodos distintos).

### Tratamento de erros

Códigos mapeados no `errorHandler` para HTTP:

- `provider_already_linked` → 409
- `cannot_remove_last_method` → 409

No modo link, falhas no callback viram redirect `?error=<code>` (o frontend traduz para PT-BR).

## Frontend

- **Rota:** `/perfil/conexoes`, dentro do `ProtectedRoute` (`src/app/AppRoutes.tsx`).
- **API client** `connectionsApi.ts` (segue o padrão de `authApi.ts` / `getBaseUrl`/`buildUrl`):
  - `getConnections()` → `GET /auth/connections`.
  - `disconnect(provider)` → `DELETE /auth/connections/:provider`.
  - `connect(provider)` → chama `GET /auth/:provider/url?intent=link` e faz `window.location = url`.
- **UI:** lista os 3 providers (`google`, `linkedin`, `github`) com estado **Conectado / Não conectado**:
  - **Conectar** (não conectado) → inicia OAuth em modo vínculo.
  - **Desconectar** (conectado) → confirmação, depois `disconnect`.
  - Botão Desconectar **desabilitado** quando for o último método (front calcula por `connections` + `hasPassword`;
    o backend revalida como fonte da verdade).
  - Ao retornar do OAuth, lê `?linked=` / `?error=` da URL e exibe toast de sucesso/erro.

## Testes

- **Unit (service):**
  - `linkProvider`: idempotente (mesmo usuário), conflito (`provider_already_linked`), vínculo novo.
  - `disconnectProvider`: bloqueia último método (`cannot_remove_last_method`), remove quando há outro método.
  - `listConnections`: estados conectado/não conectado e `hasPassword`.
- **Integration (rotas):**
  - `GET /auth/connections` (autenticado vs 401).
  - `DELETE /auth/connections/:provider` (200 e 409 no último método).
  - Callback com `intent=link`: vincula sem trocar a sessão; conflito redireciona com `?error=`.
- Seguir os padrões de `tests/unit/modules/auth` e `tests/integration/routes`.

## Fora de escopo (YAGNI)

- Re-autenticação antes de desconectar.
- Exibir email/detalhes da conta vinculada na tela.
- Novas migrations ou colunas.
- Alterar o comportamento de merge-por-email do login atual.

## Critérios de aceite (do ticket)

- Um usuário pode ter Google + LinkedIn vinculados. ✔ via `linkProvider` + tela.
- Não cria duplicidade quando o email já existe. ✔ já garantido por `findOrCreateUser`; reforçado por
  `provider_already_linked` no modo vínculo.
