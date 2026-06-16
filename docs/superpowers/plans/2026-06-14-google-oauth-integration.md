# Google OAuth Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the existing Google OAuth backend with the frontend button so users can login with Google end-to-end.

**Architecture:** Full Redirect flow — frontend redirects to Google, Google calls backend callback, backend saves session and redirects browser back to frontend. Frontend detects authenticated session and navigates to /app.

**Tech Stack:** Express (backend), React + react-router-dom (frontend), iron-session (sessions), openid-client (OAuth)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `backend/.env.example` | Add FRONTEND_URL variable |
| Modify | `backend/src/modules/auth/auth.controller.ts` | Save session + redirect instead of JSON |
| Modify | `frontend/src/services/authService.ts` | Add `getGoogleAuthUrl()` function |
| Modify | `frontend/src/components/login/RigthSide.tsx` | Add onClick to Google button |
| Modify | `frontend/src/components/login/RegisterSide.tsx` | Add onClick to Google button |
| Create | `frontend/src/pages/auth/AuthCallback.tsx` | OAuth callback page |
| Modify | `frontend/src/App.tsx` | Add /auth/callback route |

---

### Task 1: Backend — Add FRONTEND_URL env var

**Files:**
- Modify: `backend/.env.example:14-15`

- [ ] **Step 1: Add FRONTEND_URL to .env.example**

Add after the `CORS_ALLOWED_ORIGINS` line in `backend/.env.example`:

```
# URL do frontend (usada para redirect pos-OAuth)
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 2: Add FRONTEND_URL to your local .env**

Run: `grep FRONTEND_URL backend/.env || echo "FRONTEND_URL=http://localhost:5173" >> backend/.env`

---

### Task 2: Backend — Fix callback to save session and redirect

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts:64-115`

- [ ] **Step 1: Modify the callback method**

Replace the entire `callback` method in `backend/src/modules/auth/auth.controller.ts` with:

```typescript
async callback(req: Request, res: Response) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const callbackUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

    const params = AuthCallbackParamsSchema.parse({
      provider: req.params.provider,
      code: req.query.code,
      state: req.query.state,
      callbackUrl,
    });

    if (!session.oauth_state) {
      return res.redirect(`${frontendUrl}/login?error=oauth_state_missing`);
    }

    if (session.oauth_state !== params.state) {
      return res.redirect(`${frontendUrl}/login?error=oauth_state_invalid`);
    }

    delete session.oauth_state;

    const result = await this.authService.handleCallback({
      ...params,
      callbackUrl,
    });

    session.userId = result.session.userId;
    await session.save();

    return res.redirect(`${frontendUrl}/auth/callback`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

---

### Task 3: Frontend — Add getGoogleAuthUrl to authService

**Files:**
- Modify: `frontend/src/services/authService.ts` (append at end)

- [ ] **Step 1: Add the function**

Append to `frontend/src/services/authService.ts`:

```typescript
export async function getGoogleAuthUrl(): Promise<string> {
  const response = await fetch(buildUrl("/api/auth/google/url"), {
    credentials: "include",
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw createError(payload, "Falha ao obter URL de autenticacao Google.");
  }

  return payload.url;
}
```

---

### Task 4: Frontend — Wire Google button onClick in RigthSide.tsx

**Files:**
- Modify: `frontend/src/components/login/RigthSide.tsx:2,221`

- [ ] **Step 1: Add import**

Add to the imports at the top of `frontend/src/components/login/RigthSide.tsx`:

```typescript
import { login, getGoogleAuthUrl } from "@/services/authService";
```

(Replace the existing `import { login } from "@/services/authService";` on line 2)

- [ ] **Step 2: Add handler function**

Inside `RightSide()`, after the existing state declarations (after line 56), add:

```typescript
const handleGoogleLogin = async () => {
  setIsLoading(true);
  setApiError("");
  try {
    const url = await getGoogleAuthUrl();
    window.location.href = url;
  } catch (err: any) {
    setApiError(err.message || "Erro ao iniciar login com Google.");
    setIsLoading(false);
  }
};
```

- [ ] **Step 3: Add onClick to the Google button**

Change the Google button (line 221) from:

```tsx
<button type="button" disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
```

To:

```tsx
<button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
```

---

### Task 5: Frontend — Wire Google button onClick in RegisterSide.tsx

**Files:**
- Modify: `frontend/src/components/login/RegisterSide.tsx`

- [ ] **Step 1: Add import**

Add `getGoogleAuthUrl` to the imports. Find the existing authService import and add it:

```typescript
import { register, getGoogleAuthUrl } from "@/services/authService";
```

- [ ] **Step 2: Add handler function**

Inside `RegisterSide()`, after state declarations, add:

```typescript
const handleGoogleLogin = async () => {
  setIsLoading(true);
  try {
    const url = await getGoogleAuthUrl();
    window.location.href = url;
  } catch (err: any) {
    setIsLoading(false);
  }
};
```

- [ ] **Step 3: Add onClick to the Google button**

Change the Google button (line 220) from:

```tsx
<button type="button" disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
```

To:

```tsx
<button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
```

---

### Task 6: Frontend — Create AuthCallback page

**Files:**
- Create: `frontend/src/pages/auth/AuthCallback.tsx`

- [ ] **Step 1: Create the callback page**

Create `frontend/src/pages/auth/AuthCallback.tsx`:

```tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Loading from "@/Loading";

export default function AuthCallback() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      navigate("/app", { replace: true });
    } else {
      navigate("/login?error=oauth_failed", { replace: true });
    }
  }, [user, isLoading, navigate]);

  return <Loading />;
}
```

---

### Task 7: Frontend — Add /auth/callback route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx:1-8,44`

- [ ] **Step 1: Add import**

Add to imports in `frontend/src/App.tsx`:

```typescript
import AuthCallback from "./pages/auth/AuthCallback";
```

- [ ] **Step 2: Add route**

Add before the `<Route path="*"` line (line 45):

```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

---

### Task 8: Manual E2E test

- [ ] **Step 1: Start backend and frontend**

Run backend: `cd backend && npm run dev`
Run frontend: `cd frontend && npm run dev`

- [ ] **Step 2: Test happy path**

1. Navigate to `http://localhost:5173/login`
2. Click the Google button
3. Should redirect to Google consent screen
4. After authorizing, should redirect back to `/auth/callback`
5. Should then navigate to `/app` with user authenticated

- [ ] **Step 3: Test error path**

1. Navigate directly to `http://localhost:5173/auth/callback` without session
2. Should redirect to `/login?error=oauth_failed`

- [ ] **Step 4: Commit all changes**

```bash
git add backend/.env.example \
  backend/src/modules/auth/auth.controller.ts \
  frontend/src/services/authService.ts \
  frontend/src/components/login/RigthSide.tsx \
  frontend/src/components/login/RegisterSide.tsx \
  frontend/src/pages/auth/AuthCallback.tsx \
  frontend/src/App.tsx
git commit -m "feat(pav-5): integrate Google OAuth login end-to-end"
```
