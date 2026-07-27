# PAV-7 — Gerenciar Conexões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um usuário logado conecte/desconecte múltiplos providers OAuth (Google/LinkedIn/GitHub) à sua conta, com tela de gestão e validações.

**Architecture:** Reusa o fluxo OAuth existente com uma flag `intent=link` na sessão (Abordagem A do spec) para vincular providers sem novos redirect URIs. Novas funções puras na camada `users/functions` fazem link/disconnect/list; um `ConnectionsController` expõe list/disconnect; o `AuthController` ganha um branch de "modo vínculo" no callback. Frontend ganha uma `ConnectionsPage` em `/perfil/conexoes`.

**Tech Stack:** Node + Express + Drizzle ORM (Postgres), Vitest + Supertest, React + React Router + Vite.

## Global Constraints

- Sem novas migrations / mudança de schema. `accounts` e `credentials` já existem.
- Providers suportados (verbatim): `["google", "linkedin", "github"]`.
- Regra de desconexão: manter **≥ 1 método de login** (provider vinculado OU senha em `credentials`).
- Conflito ao vincular provider já usado por outro usuário → `AppError.conflict` (HTTP 409).
- Erros de domínio usam `AppError` (`src/lib/errors.ts`); `errorHandler` já mapeia `AppError` → status.
- Testes: `vitest run` (backend). Mocks via `vi.hoisted` seguindo `tests/unit/modules/auth/providers.test.ts`.
- Commits frequentes, um por task.

**Spec:** `docs/superpowers/specs/2026-07-27-pav-7-gerenciar-conexoes-design.md`

---

## File Structure

**Backend (criar):**
- `src/modules/users/functions/linkProviderToUser.ts` — vincula provider ao usuário, com checagem de conflito.
- `src/modules/users/functions/disconnectProvider.ts` — remove provider, valida último método.
- `src/modules/users/functions/listUserConnections.ts` — lista status dos providers + `hasPassword`; exporta `SUPPORTED_PROVIDERS`.
- `src/modules/auth/connections.controller.ts` — `ConnectionsController` (list, disconnect).

**Backend (modificar):**
- `src/modules/auth/auth.controller.ts` — `getUrl` grava `oauth_intent`; `callback` ganha branch de vínculo.
- `src/routes/auth.routes.ts` — rotas `GET /auth/connections`, `DELETE /auth/connections/:provider`.

**Frontend (criar):**
- `src/domains/auth/infrastructure/connectionsApi.ts` — client HTTP (get/disconnect/connect).
- `src/domains/auth/presentation/pages/ConnectionsPage.tsx` — tela "Gerenciar conexões".

**Frontend (modificar):**
- `src/app/AppRoutes.tsx` — rota `/perfil/conexoes`.

---

## Task 1: `linkProviderToUser` (vincular com checagem de conflito)

**Files:**
- Create: `backend/src/modules/users/functions/linkProviderToUser.ts`
- Test: `backend/tests/unit/modules/users/linkProviderToUser.test.ts`

**Interfaces:**
- Consumes: `createAccount({ userId, provider, profile }, tx)` de `./createAccount`; `AppError` de `src/lib/errors`.
- Produces: `linkProviderToUser({ userId: string, provider: string, profile: OAuthProfile }, tx?: DB): Promise<void>` — no-op se já vinculado ao mesmo usuário; lança `AppError.conflict` se vinculado a outro; senão cria account.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/modules/users/linkProviderToUser.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindFirst: vi.fn(),
  createAccount: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: { query: { accounts: { findFirst: mocks.accountsFindFirst } } },
}));

vi.mock("../../../../src/modules/users/functions/createAccount.js", () => ({
  createAccount: mocks.createAccount,
}));

import { linkProviderToUser } from "../../../../src/modules/users/functions/linkProviderToUser";

const profile = { id: "prov-123", email: "a@a.com" } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("linkProviderToUser", () => {
  it("cria account quando provider não está vinculado", async () => {
    mocks.accountsFindFirst.mockResolvedValue(undefined);
    await linkProviderToUser({ userId: "user-A", provider: "google", profile });
    expect(mocks.createAccount).toHaveBeenCalledWith(
      { userId: "user-A", provider: "google", profile },
      expect.anything(),
    );
  });

  it("é idempotente quando já vinculado ao mesmo usuário", async () => {
    mocks.accountsFindFirst.mockResolvedValue({ userId: "user-A" });
    await linkProviderToUser({ userId: "user-A", provider: "google", profile });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("lança conflito quando vinculado a outro usuário", async () => {
    mocks.accountsFindFirst.mockResolvedValue({ userId: "user-B" });
    await expect(
      linkProviderToUser({ userId: "user-A", provider: "google", profile }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/modules/users/linkProviderToUser.test.ts`
Expected: FAIL (module `linkProviderToUser` não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/users/functions/linkProviderToUser.ts
import { db } from "../../../db/client";
import { DB } from "../../../db/types/types";
import { AppError } from "../../../lib/errors";
import { OAuthProfile } from "../../types/auth.types";
import { createAccount } from "./createAccount";

type LinkProviderParams = {
  userId: string;
  provider: string;
  profile: OAuthProfile;
};

export async function linkProviderToUser(
  { userId, provider, profile }: LinkProviderParams,
  tx: DB = db,
): Promise<void> {
  const existingAccount = await tx.query.accounts.findFirst({
    where: (acc, { eq, and }) =>
      and(eq(acc.provider, provider), eq(acc.providerAccountId, profile.id)),
  });

  if (existingAccount) {
    if (existingAccount.userId === userId) return;
    throw AppError.conflict("Essa conta já está vinculada a outro usuário.");
  }

  await createAccount({ userId, provider, profile }, tx);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/modules/users/linkProviderToUser.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/functions/linkProviderToUser.ts backend/tests/unit/modules/users/linkProviderToUser.test.ts
git commit -m "feat(PAV-7): vincular provider a usuário com checagem de conflito"
```

---

## Task 2: `disconnectProvider` (desconectar com validação de último método)

**Files:**
- Create: `backend/src/modules/users/functions/disconnectProvider.ts`
- Test: `backend/tests/unit/modules/users/disconnectProvider.test.ts`

**Interfaces:**
- Consumes: `db` (`accounts`, `credentials` queries), `accounts` schema, `AppError`, `and`/`eq` de `drizzle-orm`.
- Produces: `disconnectProvider({ userId: string, provider: string }, tx?: DB): Promise<void>` — lança `AppError.conflict` se remover deixaria 0 métodos; senão deleta rows de `accounts` desse `(userId, provider)`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/modules/users/disconnectProvider.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindMany: vi.fn(),
  credentialsFindFirst: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    query: {
      accounts: { findMany: mocks.accountsFindMany },
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
    delete: vi.fn(() => ({ where: mocks.deleteWhere })),
  },
}));

vi.mock("../../../../src/db/schema/index.js", () => ({ accounts: {} }));

import { disconnectProvider } from "../../../../src/modules/users/functions/disconnectProvider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("disconnectProvider", () => {
  it("desconecta quando há outro método (outro provider)", async () => {
    mocks.accountsFindMany.mockResolvedValue([
      { provider: "google" },
      { provider: "github" },
    ]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("desconecta quando há senha como fallback", async () => {
    mocks.accountsFindMany.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-A" });
    await disconnectProvider({ userId: "user-A", provider: "google" });
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("bloqueia quando é o último método", async () => {
    mocks.accountsFindMany.mockResolvedValue([{ provider: "google" }]);
    mocks.credentialsFindFirst.mockResolvedValue(undefined);
    await expect(
      disconnectProvider({ userId: "user-A", provider: "google" }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/modules/users/disconnectProvider.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/users/functions/disconnectProvider.ts
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { accounts } from "../../../db/schema";
import { DB } from "../../../db/types/types";
import { AppError } from "../../../lib/errors";

type DisconnectParams = { userId: string; provider: string };

export async function disconnectProvider(
  { userId, provider }: DisconnectParams,
  tx: DB = db,
): Promise<void> {
  const userAccounts = await tx.query.accounts.findMany({
    where: (acc, { eq }) => eq(acc.userId, userId),
  });

  const hasPassword = Boolean(
    await tx.query.credentials.findFirst({
      where: (c, { eq }) => eq(c.userId, userId),
    }),
  );

  const remainingProviders = new Set(
    userAccounts.map((a) => a.provider).filter((p) => p !== provider),
  );

  const methodsAfter = remainingProviders.size + (hasPassword ? 1 : 0);

  if (methodsAfter === 0) {
    throw AppError.conflict(
      "Não é possível desconectar seu último método de login.",
    );
  }

  await tx
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/modules/users/disconnectProvider.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/functions/disconnectProvider.ts backend/tests/unit/modules/users/disconnectProvider.test.ts
git commit -m "feat(PAV-7): desconectar provider validando último método de login"
```

---

## Task 3: `listUserConnections` (status dos providers + hasPassword)

**Files:**
- Create: `backend/src/modules/users/functions/listUserConnections.ts`
- Test: `backend/tests/unit/modules/users/listUserConnections.test.ts`

**Interfaces:**
- Consumes: `db` (`accounts`, `credentials` queries).
- Produces:
  - `SUPPORTED_PROVIDERS = ["google", "linkedin", "github"] as const`
  - `type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]`
  - `type ConnectionStatus = { provider: SupportedProvider; connected: boolean; connectedAt: Date | null }`
  - `type UserConnections = { hasPassword: boolean; connections: ConnectionStatus[] }`
  - `listUserConnections(userId: string, tx?: DB): Promise<UserConnections>`

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/modules/users/listUserConnections.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountsFindMany: vi.fn(),
  credentialsFindFirst: vi.fn(),
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    query: {
      accounts: { findMany: mocks.accountsFindMany },
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
  },
}));

import { listUserConnections } from "../../../../src/modules/users/functions/listUserConnections";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listUserConnections", () => {
  it("marca conectados e retorna hasPassword", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    mocks.accountsFindMany.mockResolvedValue([
      { provider: "google", createdAt },
    ]);
    mocks.credentialsFindFirst.mockResolvedValue({ userId: "user-A" });

    const result = await listUserConnections("user-A");

    expect(result.hasPassword).toBe(true);
    expect(result.connections).toEqual([
      { provider: "google", connected: true, connectedAt: createdAt },
      { provider: "linkedin", connected: false, connectedAt: null },
      { provider: "github", connected: false, connectedAt: null },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/modules/users/listUserConnections.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/modules/users/functions/listUserConnections.ts
import { db } from "../../../db/client";
import { DB } from "../../../db/types/types";

export const SUPPORTED_PROVIDERS = ["google", "linkedin", "github"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export type ConnectionStatus = {
  provider: SupportedProvider;
  connected: boolean;
  connectedAt: Date | null;
};

export type UserConnections = {
  hasPassword: boolean;
  connections: ConnectionStatus[];
};

export async function listUserConnections(
  userId: string,
  tx: DB = db,
): Promise<UserConnections> {
  const userAccounts = await tx.query.accounts.findMany({
    where: (acc, { eq }) => eq(acc.userId, userId),
  });

  const hasPassword = Boolean(
    await tx.query.credentials.findFirst({
      where: (c, { eq }) => eq(c.userId, userId),
    }),
  );

  const connections: ConnectionStatus[] = SUPPORTED_PROVIDERS.map((provider) => {
    const account = userAccounts.find((a) => a.provider === provider);
    return {
      provider,
      connected: Boolean(account),
      connectedAt: account?.createdAt ?? null,
    };
  });

  return { hasPassword, connections };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/modules/users/listUserConnections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/functions/listUserConnections.ts backend/tests/unit/modules/users/listUserConnections.test.ts
git commit -m "feat(PAV-7): listar conexões do usuário com status por provider"
```

---

## Task 4: `ConnectionsController` + rotas `GET/DELETE /auth/connections`

**Files:**
- Create: `backend/src/modules/auth/connections.controller.ts`
- Modify: `backend/src/routes/auth.routes.ts`
- Test: `backend/tests/integration/routes/connections.routes.test.ts`

**Interfaces:**
- Consumes: `listUserConnections`, `disconnectProvider`, `SUPPORTED_PROVIDERS`, `requireAuth`, `AppError`.
- Produces:
  - `class ConnectionsController { list(req, res): Promise<Response>; disconnect(req, res): Promise<Response> }`
  - Rotas: `GET /auth/connections` (requireAuth) → `{ hasPassword, connections }`; `DELETE /auth/connections/:provider` (requireAuth) → `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/integration/routes/connections.routes.test.ts
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/lib/errors";

const mocks = vi.hoisted(() => ({
  listUserConnections: vi.fn(),
  disconnectProvider: vi.fn(),
}));

vi.mock("../../../src/modules/users/functions/listUserConnections", () => ({
  listUserConnections: mocks.listUserConnections,
  SUPPORTED_PROVIDERS: ["google", "linkedin", "github"],
}));

vi.mock("../../../src/modules/users/functions/disconnectProvider", () => ({
  disconnectProvider: mocks.disconnectProvider,
}));

// Sessão fake: injeta userId
vi.mock("../../../src/middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.session = { userId: "user-A" };
    next();
  },
}));

import { errorHandler } from "../../../src/middleware/errorHandler";
import { ConnectionsController } from "../../../src/modules/auth/connections.controller";
import { requireAuth } from "../../../src/middleware/requireAuth";

function buildApp() {
  const app = express();
  app.use(express.json());
  const controller = new ConnectionsController();
  app.get("/auth/connections", requireAuth, (req, res, next) =>
    controller.list(req, res).catch(next),
  );
  app.delete("/auth/connections/:provider", requireAuth, (req, res, next) =>
    controller.disconnect(req, res).catch(next),
  );
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connections routes", () => {
  it("GET /auth/connections retorna status", async () => {
    mocks.listUserConnections.mockResolvedValue({
      hasPassword: false,
      connections: [{ provider: "google", connected: true, connectedAt: null }],
    });
    const res = await request(buildApp()).get("/auth/connections");
    expect(res.status).toBe(200);
    expect(res.body.connections[0].provider).toBe("google");
  });

  it("DELETE /auth/connections/:provider retorna 200", async () => {
    mocks.disconnectProvider.mockResolvedValue(undefined);
    const res = await request(buildApp()).delete("/auth/connections/google");
    expect(res.status).toBe(200);
    expect(mocks.disconnectProvider).toHaveBeenCalledWith({
      userId: "user-A",
      provider: "google",
    });
  });

  it("DELETE responde 409 no último método", async () => {
    mocks.disconnectProvider.mockRejectedValue(
      AppError.conflict("Não é possível desconectar seu último método de login."),
    );
    const res = await request(buildApp()).delete("/auth/connections/google");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/routes/connections.routes.test.ts`
Expected: FAIL (`ConnectionsController` não existe).

- [ ] **Step 3: Write the controller**

```ts
// backend/src/modules/auth/connections.controller.ts
import { Request, Response } from "express";
import { AppError } from "../../lib/errors";
import { disconnectProvider } from "../users/functions/disconnectProvider";
import {
  listUserConnections,
  SUPPORTED_PROVIDERS,
} from "../users/functions/listUserConnections";

export class ConnectionsController {
  async list(req: Request, res: Response) {
    const userId = req.session.userId as string;
    const result = await listUserConnections(userId);
    return res.json(result);
  }

  async disconnect(req: Request, res: Response) {
    const userId = req.session.userId as string;
    const provider = req.params.provider;

    if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
      throw AppError.validation("Provider inválido.");
    }

    await disconnectProvider({ userId, provider });
    return res.json({ ok: true });
  }
}
```

- [ ] **Step 4: Wire the routes**

Em `backend/src/routes/auth.routes.ts`, adicione o import e as rotas logo após o bloco `// OAuth` (antes de `// Credentials`):

```ts
import { requireAuth } from "../middleware/requireAuth";
import { ConnectionsController } from "../modules/auth/connections.controller";

const connectionsController = new ConnectionsController();

// Connections (usuário logado)
router.get("/connections", requireAuth, (req, res, next) => {
  connectionsController.list(req, res).catch(next);
});
router.delete("/connections/:provider", requireAuth, (req, res, next) => {
  connectionsController.disconnect(req, res).catch(next);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/integration/routes/connections.routes.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/auth/connections.controller.ts backend/src/routes/auth.routes.ts backend/tests/integration/routes/connections.routes.test.ts
git commit -m "feat(PAV-7): endpoints GET/DELETE de conexões do usuário"
```

---

## Task 5: Modo vínculo no `AuthController` (getUrl intent + callback branch)

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Test: `backend/tests/unit/modules/auth/auth.controller.link.test.ts`

**Interfaces:**
- Consumes: `linkProviderToUser` (Task 1), `AuthService.getProfileFromProvider`, `AppError`.
- Produces: `getUrl` grava `oauth_intent="link"` na sessão quando `?intent=link` e há `userId`; `callback` vincula e redireciona para `${FRONTEND_URL}/perfil/conexoes?linked=<provider>` (sucesso) ou `?error=provider_already_linked|link_failed` (falha), sem trocar a sessão.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/modules/auth/auth.controller.link.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/lib/errors";

const mocks = vi.hoisted(() => ({
  linkProviderToUser: vi.fn(),
  getProfileFromProvider: vi.fn(),
  handleCallback: vi.fn(),
}));

vi.mock("../../../../src/modules/users/functions/linkProviderToUser", () => ({
  linkProviderToUser: mocks.linkProviderToUser,
}));

import { AuthController } from "../../../../src/modules/auth/auth.controller";

function fakeRes() {
  return {
    redirect: vi.fn(),
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as any;
}

function fakeService() {
  return {
    getProfileFromProvider: mocks.getProfileFromProvider,
    handleCallback: mocks.handleCallback,
    getAuthUrl: vi.fn(),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.APP_URL = "http://localhost:3001";
});

describe("AuthController callback — modo vínculo", () => {
  it("vincula e redireciona para /perfil/conexoes?linked= sem trocar sessão", async () => {
    mocks.getProfileFromProvider.mockResolvedValue({ id: "prov-1" });
    mocks.linkProviderToUser.mockResolvedValue(undefined);

    const controller = new AuthController(fakeService());
    const save = vi.fn();
    const req = {
      params: { provider: "google" },
      query: { code: "c", state: "s" },
      session: {
        userId: "user-A",
        role: "user",
        oauth_state: "s",
        oauth_intent: "link",
        save,
      },
    } as any;
    const res = fakeRes();

    await controller.callback(req, res);

    expect(mocks.linkProviderToUser).toHaveBeenCalledWith({
      userId: "user-A",
      provider: "google",
      profile: { id: "prov-1" },
    });
    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/perfil/conexoes?linked=google",
    );
    expect(mocks.handleCallback).not.toHaveBeenCalled();
  });

  it("redireciona com erro quando o provider já está vinculado", async () => {
    mocks.getProfileFromProvider.mockResolvedValue({ id: "prov-1" });
    mocks.linkProviderToUser.mockRejectedValue(
      AppError.conflict("já vinculado"),
    );

    const controller = new AuthController(fakeService());
    const req = {
      params: { provider: "google" },
      query: { code: "c", state: "s" },
      session: {
        userId: "user-A",
        role: "user",
        oauth_state: "s",
        oauth_intent: "link",
        save: vi.fn(),
      },
    } as any;
    const res = fakeRes();

    await controller.callback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/perfil/conexoes?error=provider_already_linked",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/modules/auth/auth.controller.link.test.ts`
Expected: FAIL (callback ainda não faz branch de vínculo).

- [ ] **Step 3: Update `getUrl` para gravar a intenção**

Em `backend/src/modules/auth/auth.controller.ts`, substitua o corpo de `getUrl` por:

```ts
  async getUrl(req: Request, res: Response) {
    const provider = req.params.provider as OAuthProvider;
    const state = randomBytes(16).toString("hex");

    (req.session as { oauth_state?: string }).oauth_state = state;

    if (req.query.intent === "link" && req.session.userId) {
      (req.session as { oauth_intent?: string }).oauth_intent = "link";
    } else {
      delete (req.session as { oauth_intent?: string }).oauth_intent;
    }

    await req.session.save();

    const url = await this.authService.getAuthUrl(provider, state);
    return res.json({ url });
  }
```

- [ ] **Step 4: Add the link branch in `callback`**

No `callback`, logo após a linha `delete (req.session as { oauth_state?: string }).oauth_state;` e ANTES de `const result = await this.authService.handleCallback(...)`, insira:

```ts
      const intent = (req.session as { oauth_intent?: string }).oauth_intent;
      delete (req.session as { oauth_intent?: string }).oauth_intent;

      if (intent === "link" && req.session.userId) {
        try {
          const profile = await this.authService.getProfileFromProvider({
            ...params,
            callbackUrl,
          });
          await linkProviderToUser({
            userId: req.session.userId,
            provider: params.provider,
            profile,
          });
          await req.session.save();
          return res.redirect(
            `${frontendUrl}/perfil/conexoes?linked=${params.provider}`,
          );
        } catch (linkError) {
          const code =
            linkError instanceof AppError
              ? "provider_already_linked"
              : "link_failed";
          return res.redirect(`${frontendUrl}/perfil/conexoes?error=${code}`);
        }
      }
```

Adicione os imports no topo do arquivo:

```ts
import { AppError } from "../../lib/errors.js";
import { linkProviderToUser } from "../users/functions/linkProviderToUser.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/modules/auth/auth.controller.link.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Run the full auth suite (regressão)**

Run: `cd backend && npx vitest run tests/unit/modules/auth tests/integration/routes/auth.routes.test.ts`
Expected: PASS (o fluxo de login existente continua funcionando).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/auth/auth.controller.ts backend/tests/unit/modules/auth/auth.controller.link.test.ts
git commit -m "feat(PAV-7): modo vínculo no callback OAuth (conectar provider logado)"
```

---

## Task 6: Frontend — `connectionsApi.ts`

**Files:**
- Create: `frontend/src/domains/auth/infrastructure/connectionsApi.ts`

**Interfaces:**
- Produces:
  - `type SupportedProvider = "google" | "linkedin" | "github"`
  - `type ConnectionStatus = { provider: SupportedProvider; connected: boolean; connectedAt: string | null }`
  - `type UserConnections = { hasPassword: boolean; connections: ConnectionStatus[] }`
  - `getConnections(): Promise<UserConnections>`
  - `disconnectProvider(provider: SupportedProvider): Promise<void>`
  - `connectProvider(provider: SupportedProvider): Promise<void>` (redireciona o browser)

- [ ] **Step 1: Write the module**

Segue o padrão de `frontend/src/domains/auth/infrastructure/authApi.ts` (base via `VITE_API_BASE_URL`, `credentials: "include"`).

```ts
// frontend/src/domains/auth/infrastructure/connectionsApi.ts
export type SupportedProvider = "google" | "linkedin" | "github";

export type ConnectionStatus = {
  provider: SupportedProvider;
  connected: boolean;
  connectedAt: string | null;
};

export type UserConnections = {
  hasPassword: boolean;
  connections: ConnectionStatus[];
};

function getBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base && base.trim().length > 0) return base.replace(/\/+$/, "");
  return "";
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

export async function getConnections(): Promise<UserConnections> {
  const response = await fetch(buildUrl("/auth/connections"), {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Falha ao carregar conexões.");
  return (await response.json()) as UserConnections;
}

export async function disconnectProvider(
  provider: SupportedProvider,
): Promise<void> {
  const response = await fetch(buildUrl(`/auth/connections/${provider}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(payload.message ?? "Falha ao desconectar.");
  }
}

export async function connectProvider(
  provider: SupportedProvider,
): Promise<void> {
  const response = await fetch(
    buildUrl(`/auth/${provider}/url?intent=link`),
    { credentials: "include" },
  );
  if (!response.ok) throw new Error("Falha ao iniciar conexão.");
  const { url } = (await response.json()) as { url: string };
  window.location.href = url;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos no arquivo criado.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/domains/auth/infrastructure/connectionsApi.ts
git commit -m "feat(PAV-7): client de API de conexões (frontend)"
```

---

## Task 7: Frontend — `ConnectionsPage` + rota `/perfil/conexoes`

**Files:**
- Create: `frontend/src/domains/auth/presentation/pages/ConnectionsPage.tsx`
- Modify: `frontend/src/app/AppRoutes.tsx`

**Interfaces:**
- Consumes: `getConnections`, `disconnectProvider`, `connectProvider`, tipos de `connectionsApi`; `NewDashboardLayout`, `ProtectedRoute` (em `AppRoutes`).
- Produces: componente default `ConnectionsPage`; rota protegida `/perfil/conexoes`.

- [ ] **Step 1: Write the page component**

Regra do botão Desconectar: desabilitado quando `connected && totalMethods <= 1` (onde `totalMethods = providers conectados + (hasPassword ? 1 : 0)`). Lê `?linked=`/`?error=` para feedback.

```tsx
// frontend/src/domains/auth/presentation/pages/ConnectionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  connectProvider,
  disconnectProvider,
  getConnections,
  type SupportedProvider,
  type UserConnections,
} from "@/domains/auth/infrastructure/connectionsApi";

const PROVIDER_LABELS: Record<SupportedProvider, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
};

const ERROR_MESSAGES: Record<string, string> = {
  provider_already_linked: "Essa conta já está vinculada a outro usuário.",
  link_failed: "Não foi possível conectar. Tente novamente.",
};

export default function ConnectionsPage() {
  const [data, setData] = useState<UserConnections | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<SupportedProvider | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  async function refresh() {
    try {
      setData(await getConnections());
    } catch {
      setError("Falha ao carregar conexões.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const linked = searchParams.get("linked");
    const errCode = searchParams.get("error");
    if (linked) setFeedback(`Conta ${linked} conectada com sucesso.`);
    if (errCode) setError(ERROR_MESSAGES[errCode] ?? "Erro ao conectar.");
    if (linked || errCode) {
      searchParams.delete("linked");
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMethods = useMemo(() => {
    if (!data) return 0;
    const connected = data.connections.filter((c) => c.connected).length;
    return connected + (data.hasPassword ? 1 : 0);
  }, [data]);

  async function handleDisconnect(provider: SupportedProvider) {
    setBusy(provider);
    setError("");
    try {
      await disconnectProvider(provider);
      setFeedback(`Conta ${PROVIDER_LABELS[provider]} desconectada.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect(provider: SupportedProvider) {
    setBusy(provider);
    setError("");
    try {
      await connectProvider(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
      setBusy(null);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1>Gerenciar conexões</h1>
      <p>Conecte ou desconecte suas contas de login social.</p>

      {feedback && <p role="status">{feedback}</p>}
      {error && <p role="alert">{error}</p>}

      {!data && <p>Carregando…</p>}

      {data && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.connections.map((c) => {
            const isLastMethod = c.connected && totalMethods <= 1;
            return (
              <li
                key={c.provider}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>
                  <strong>{PROVIDER_LABELS[c.provider]}</strong>{" "}
                  {c.connected ? "· Conectado" : "· Não conectado"}
                </span>
                {c.connected ? (
                  <button
                    onClick={() => handleDisconnect(c.provider)}
                    disabled={busy === c.provider || isLastMethod}
                    title={
                      isLastMethod
                        ? "Você precisa manter ao menos um método de login."
                        : undefined
                    }
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(c.provider)}
                    disabled={busy === c.provider}
                  >
                    Conectar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

Em `frontend/src/app/AppRoutes.tsx`, importe o componente e adicione a rota junto às demais (ex.: depois de `/auth/callback`). Use o mesmo layout do dashboard:

```tsx
import ConnectionsPage from "@/domains/auth/presentation/pages/ConnectionsPage";
```

```tsx
      <Route
        path="/perfil/conexoes"
        element={
          <ProtectedRoute>
            <NewDashboardLayout>
              <ConnectionsPage />
            </NewDashboardLayout>
          </ProtectedRoute>
        }
      />
```

> Nota: `NewDashboardLayout` já é importado em `AppRoutes.tsx` (usado no `dashboardElement`). React Router v6 rankeia por especificidade, então `/perfil/conexoes` tem precedência sobre `/perfil` independentemente da ordem.

- [ ] **Step 3: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Manual smoke (com backend + infra rodando)**

1. Logado, acesse `http://localhost:5173/perfil/conexoes`.
2. Clique **Conectar** num provider não conectado → completa OAuth → volta com `?linked=` e o provider aparece **Conectado**.
3. Com 2+ métodos, **Desconectar** um → some da lista de conectados.
4. Com só 1 método, o botão **Desconectar** fica desabilitado.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domains/auth/presentation/pages/ConnectionsPage.tsx frontend/src/app/AppRoutes.tsx
git commit -m "feat(PAV-7): tela Gerenciar conexões e rota /perfil/conexoes"
```

---

## Self-Review (feito pelo autor do plano)

**Spec coverage:**
- Modelo `authProviders` → já existe (`accounts`); sem task, documentado no spec. ✔
- Vincular quando email existe / não duplicar → já existe (`findOrCreateUser`) + reforço via Task 1 (conflito). ✔
- Conectar logado → Task 5 (modo vínculo) + Task 6/7 (frontend). ✔
- Desconectar com validação → Task 2 + Task 4 (rota) + Task 7 (UI). ✔
- Listar conexões → Task 3 + Task 4 + Task 7. ✔
- Tela "Gerenciar conexões" → Task 7. ✔
- AC (Google+LinkedIn juntos; sem duplicidade) → coberto por Tasks 1, 5, 7. ✔

**Type consistency:** `SUPPORTED_PROVIDERS`/`ConnectionStatus`/`UserConnections` definidos na Task 3 e reusados nas Tasks 4/6/7 com os mesmos campos (`provider`, `connected`, `connectedAt`, `hasPassword`). Backend usa `Date`, frontend usa `string` (serialização JSON) — intencional e documentado.

**Placeholder scan:** nenhum TODO/"handle errors" genérico; todo passo tem código real.
