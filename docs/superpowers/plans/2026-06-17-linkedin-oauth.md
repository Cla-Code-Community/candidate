# PAV-6: LinkedIn OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable LinkedIn social login end-to-end, following the same pattern as the existing Google OAuth (PAV-5).

**Architecture:** The backend already has a generic OAuth architecture with `:provider` routes, a provider registry, and a LinkedIn provider file (`linkedin.ts`). The LinkedIn provider has a signature bug that needs fixing. The frontend needs a new `getLinkedinAuthUrl()` service function, LinkedIn button handlers in login/register components, and the Facebook button replaced with LinkedIn. Email-absent profiles must be rejected.

**Tech Stack:** Express + openid-client + iron-session (backend), React + react-router-dom (frontend), Vitest + supertest + @testing-library/react (tests)

## Global Constraints

- Coverage thresholds: 80% lines, functions, branches, statements (frontend `vitest.config.js`)
- Backend tests use `vitest` + `supertest` with mocked `AuthService` and `iron-session`
- Frontend tests use `vitest` + `@testing-library/react` with mocked `authService` module
- All OAuth providers must conform to `OAuthProviderImplementation` interface from `auth.types.ts`
- Session cookies use `iron-session` with `SESSION_SECRET` env var

---

### Task 1: Fix LinkedIn provider signature and add email validation

**Files:**
- Modify: `backend/src/modules/auth/providers/linkedin.ts:34-48` (fix `exchangeLinkedinCode` signature)
- Modify: `backend/src/modules/auth/auth.service.ts:22-49` (add email validation in `handleCallback`)
- Test: `backend/tests/integration/routes/auth.routes.test.ts` (add LinkedIn-specific and email-absent tests)

**Interfaces:**
- Consumes: `ExchangeCodeParams` from `backend/src/modules/types/auth.types.ts` — `{ code: string; state?: string; callbackUrl: string }`
- Produces: `exchangeLinkedinCode(params: ExchangeCodeParams): Promise<OAuthProfile>` matching `OAuthProviderImplementation`

- [ ] **Step 1: Write failing test — LinkedIn callback with valid state**

Add this test inside the existing `describe("GET /:provider/callback")` block in `backend/tests/integration/routes/auth.routes.test.ts`:

```ts
it("redireciona ao frontend em callback valido para linkedin", async () => {
  const res = await request(app)
    .get(`${BASE}/linkedin/callback?code=li-code-123&state=valid-state-abc123`)
    .expect(302);

  expect(res.headers.location).toContain("/auth/callback");
  expect(mockAuthService.handleCallback).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "linkedin",
      code: "li-code-123",
      state: "valid-state-abc123",
    }),
  );
});
```

- [ ] **Step 2: Write failing test — email absent redirects with error**

Add this test inside the existing `describe("GET /:provider/callback")` block:

```ts
it("redireciona com erro quando profile nao tem email", async () => {
  mockAuthService.handleCallback.mockRejectedValueOnce(
    new Error("oauth_email_required"),
  );

  const res = await request(app)
    .get(`${BASE}/linkedin/callback?code=abc123&state=valid-state-abc123`)
    .expect(302);

  expect(res.headers.location).toContain("/login?error=oauth_failed");
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && npx vitest run tests/integration/routes/auth.routes.test.ts --reporter=verbose
```

Expected: The new LinkedIn callback test should PASS (routes are already generic), and the email-absent test should also PASS (the controller already catches errors and redirects). If they pass, they confirm existing behavior works — proceed to fix the provider bug.

- [ ] **Step 4: Fix `exchangeLinkedinCode` signature to match `ExchangeCodeParams`**

Replace the function signature and body in `backend/src/modules/auth/providers/linkedin.ts` (lines 34-48):

```ts
import { ExchangeCodeParams, OAuthProfile } from "../../types/auth.types";
```

Update the import at line 6, then replace the function:

```ts
export async function exchangeLinkedinCode({
  callbackUrl,
  state,
}: ExchangeCodeParams): Promise<OAuthProfile> {
  const config = await getConfig();

  if (!state) {
    throw new Error("State ausente");
  }

  const tokens = await authorizationCodeGrant(config, new URL(callbackUrl), {
    expectedState: state,
  });

  const claims = tokens.claims();

  if (!claims || typeof claims !== "object") {
    throw new Error("Invalid LinkedIn claims");
  }

  const getString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  const getNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;

  return {
    id: getString(claims.sub) ?? "",

    email: getString(claims.email),
    name: getString(claims.name),

    given_name: getString(claims.given_name),
    family_name: getString(claims.family_name),

    picture: getString(claims.picture),

    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,

    expires_at: getNumber(claims.exp),
  };
}
```

- [ ] **Step 5: Add email validation in `handleCallback`**

In `backend/src/modules/auth/auth.service.ts`, add email check after getting the profile (line 37, before `findOrCreateUser`):

```ts
async handleCallback({
  provider,
  code,
  state,
  callbackUrl,
}: AuthCallbackParams): Promise<{
  user: User;
  session: Session;
}> {
  const profile = await this.getProfileFromProvider({
    provider,
    code,
    state,
    callbackUrl,
  });

  if (!profile.email) {
    throw new Error("oauth_email_required");
  }

  const user = await findOrCreateUser({
    provider,
    profile,
  });

  const session = await this.createSession(user);

  return {
    user,
    session,
  };
}
```

- [ ] **Step 6: Run all backend tests**

```bash
cd backend && npx vitest run --reporter=verbose
```

Expected: All tests pass, including the new LinkedIn-specific tests.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/modules/auth/providers/linkedin.ts src/modules/auth/auth.service.ts tests/integration/routes/auth.routes.test.ts && git commit -m "$(cat <<'EOF'
fix(pav-6): fix LinkedIn provider signature and add email validation

- Fix exchangeLinkedinCode to match ExchangeCodeParams interface (use callbackUrl + expectedState like Google)
- Add email validation in handleCallback — reject profiles without email
- Add integration tests for LinkedIn callback and email-absent case

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `getLinkedinAuthUrl` to frontend auth service

**Files:**
- Modify: `frontend/src/services/authService.ts:127-139` (add new function after `getGoogleAuthUrl`)
- Test: `frontend/tests/unit/services/auth.service.test.tsx` (add LinkedIn tests)

**Interfaces:**
- Consumes: `buildUrl`, `parseResponse`, `createError` from same file (internal helpers)
- Produces: `getLinkedinAuthUrl(): Promise<string>` — exported function called by login/register components

- [ ] **Step 1: Write failing tests for `getLinkedinAuthUrl`**

Add a new `describe` block at the end of `frontend/tests/unit/services/auth.service.test.tsx` (before the closing `});` of the root describe):

```tsx
describe("getLinkedinAuthUrl", () => {
  it("should return LinkedIn auth URL on success", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        jsonData: { url: "https://www.linkedin.com/oauth/v2/authorization?state=abc" },
      })
    );

    const url = await auth.getLinkedinAuthUrl();

    expect(url).toBe("https://www.linkedin.com/oauth/v2/authorization?state=abc");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/linkedin/url"),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("should throw error on failure with message", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 500,
        jsonData: { message: "Provider unavailable" },
      })
    );

    await expect(auth.getLinkedinAuthUrl()).rejects.toThrow("Provider unavailable");
  });

  it("should throw error on failure without message", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 500,
        jsonData: {},
      })
    );

    await expect(auth.getLinkedinAuthUrl()).rejects.toThrow(
      "Falha ao obter URL de autenticacao LinkedIn."
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run tests/unit/services/auth.service.test.tsx --reporter=verbose
```

Expected: FAIL — `auth.getLinkedinAuthUrl is not a function`

- [ ] **Step 3: Implement `getLinkedinAuthUrl`**

Add at the end of `frontend/src/services/authService.ts`:

```ts
export async function getLinkedinAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/api/auth/linkedin/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao obter URL de autenticacao LinkedIn.");
  }

  return payload.url;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run tests/unit/services/auth.service.test.tsx --reporter=verbose
```

Expected: All tests pass, including the 3 new LinkedIn tests.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/services/authService.ts tests/unit/services/auth.service.test.tsx && git commit -m "$(cat <<'EOF'
feat(pav-6): add getLinkedinAuthUrl to frontend auth service

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Replace Facebook button with LinkedIn in login and register components

**Files:**
- Modify: `frontend/src/components/login/RigthSide.tsx` (import + handler + button replacement)
- Modify: `frontend/src/components/login/RegisterSide.tsx` (import + handler + button replacement)
- Test: `frontend/tests/unit/components/login/RigthSide.test.tsx` (add LinkedIn button test)
- Test: `frontend/tests/unit/components/login/RegisterSide.test.tsx` (add LinkedIn button test)

**Interfaces:**
- Consumes: `getLinkedinAuthUrl(): Promise<string>` from `@/services/authService` (Task 2)
- Produces: LinkedIn login button visible in login and register pages, wired to `handleLinkedinLogin`

- [ ] **Step 1: Write failing test for LinkedIn button in RigthSide**

Add to the mock at the top of `frontend/tests/unit/components/login/RigthSide.test.tsx` — update the mock to include `getLinkedinAuthUrl`:

```tsx
const mockLogin = vi.fn();
const mockGetLinkedinAuthUrl = vi.fn();

vi.mock("@/services/authService", () => ({
  login: (...args: any[]) => mockLogin(...args),
  getLinkedinAuthUrl: (...args: any[]) => mockGetLinkedinAuthUrl(...args),
}));
```

Add `mockGetLinkedinAuthUrl.mockReset();` to the `beforeEach` block.

Add this test at the end of the describe block:

```tsx
it("redireciona para LinkedIn OAuth ao clicar no botao LinkedIn", async () => {
  mockGetLinkedinAuthUrl.mockResolvedValueOnce(
    "https://www.linkedin.com/oauth/v2/authorization?state=abc"
  );

  render(<RigthSide />);

  const linkedinButton = screen.getByRole("button", { name: /linkedin/i });
  fireEvent.click(linkedinButton);

  await waitFor(() => {
    expect(mockGetLinkedinAuthUrl).toHaveBeenCalled();
    expect(window.location.href).toBe(
      "https://www.linkedin.com/oauth/v2/authorization?state=abc"
    );
  });
});
```

- [ ] **Step 2: Write failing test for LinkedIn button in RegisterSide**

Update the mock at the top of `frontend/tests/unit/components/login/RegisterSide.test.tsx`:

```tsx
const mockRegister = vi.fn();
const mockGetLinkedinAuthUrl = vi.fn();

vi.mock("@/services/authService", () => ({
  register: (...args: any[]) => mockRegister(...args),
  getLinkedinAuthUrl: (...args: any[]) => mockGetLinkedinAuthUrl(...args),
}));
```

Add `mockGetLinkedinAuthUrl.mockReset();` to the `beforeEach` block.

Add this test at the end of the describe block:

```tsx
it("redireciona para LinkedIn OAuth ao clicar no botao LinkedIn", async () => {
  mockGetLinkedinAuthUrl.mockResolvedValueOnce(
    "https://www.linkedin.com/oauth/v2/authorization?state=abc"
  );

  render(<RegisterSide />);

  const linkedinButton = screen.getByRole("button", { name: /linkedin/i });
  fireEvent.click(linkedinButton);

  await waitFor(() => {
    expect(mockGetLinkedinAuthUrl).toHaveBeenCalled();
    expect(window.location.href).toBe(
      "https://www.linkedin.com/oauth/v2/authorization?state=abc"
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd frontend && npx vitest run tests/unit/components/login/RigthSide.test.tsx tests/unit/components/login/RegisterSide.test.tsx --reporter=verbose
```

Expected: FAIL — cannot find button with name "linkedin"

- [ ] **Step 4: Implement LinkedIn button in `RigthSide.tsx`**

Update imports at the top of `frontend/src/components/login/RigthSide.tsx`:

```tsx
import { login, getGoogleAuthUrl, getLinkedinAuthUrl } from "@/services/authService";
```

Add handler inside the `RightSide` component, after `handleGoogleLogin`:

```tsx
const handleLinkedinLogin = async () => {
  setIsLoading(true);
  setApiError("");
  try {
    const url = await getLinkedinAuthUrl();
    window.location.href = url;
  } catch (err: any) {
    setApiError(err.message || "Erro ao iniciar login com LinkedIn.");
    setIsLoading(false);
  }
};
```

Replace the Facebook button (second button in the grid, around line 236) with:

```tsx
<button type="button" onClick={handleLinkedinLogin} disabled={isLoading} aria-label="LinkedIn" className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
  <svg className="h-5 w-5 fill-[#0A66C2]" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
</button>
```

- [ ] **Step 5: Implement LinkedIn button in `RegisterSide.tsx`**

Update imports at the top of `frontend/src/components/login/RegisterSide.tsx`:

```tsx
import { register, getGoogleAuthUrl, getLinkedinAuthUrl } from "@/services/authService";
```

Add handler inside the `RegisterSide` component, after `handleGoogleLogin`:

```tsx
const handleLinkedinLogin = async () => {
  setIsLoading(true);
  setApiError("");
  try {
    const url = await getLinkedinAuthUrl();
    window.location.href = url;
  } catch (err: any) {
    setApiError(err.message || "Erro ao iniciar login com LinkedIn.");
    setIsLoading(false);
  }
};
```

Replace the Facebook button (second button in the grid, around line 233) with:

```tsx
<button type="button" onClick={handleLinkedinLogin} disabled={isLoading} aria-label="LinkedIn" className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
  <svg className="h-5 w-5 fill-[#0A66C2]" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
</button>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd frontend && npx vitest run tests/unit/components/login/RigthSide.test.tsx tests/unit/components/login/RegisterSide.test.tsx --reporter=verbose
```

Expected: All tests pass, including the new LinkedIn button tests.

- [ ] **Step 7: Run full test suites**

```bash
cd backend && npx vitest run --reporter=verbose
cd frontend && npx vitest run --reporter=verbose
```

Expected: All backend and frontend tests pass. Coverage thresholds met.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/login/RigthSide.tsx frontend/src/components/login/RegisterSide.tsx frontend/tests/unit/components/login/RigthSide.test.tsx frontend/tests/unit/components/login/RegisterSide.test.tsx && git commit -m "$(cat <<'EOF'
feat(pav-6): replace Facebook button with LinkedIn in login/register

- Add handleLinkedinLogin handler in RigthSide and RegisterSide
- Replace Facebook button with LinkedIn button using inline SVG icon
- Add tests for LinkedIn button click triggering OAuth redirect

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```
