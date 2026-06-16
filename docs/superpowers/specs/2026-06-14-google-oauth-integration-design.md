# PAV-5: Google OAuth Integration (Frontend + Backend Fix)

## Objetivo

Integrar o botao "Entrar com Google" no frontend com o backend OAuth ja implementado, usando fluxo Full Redirect.

## Contexto

- Backend tem endpoints `GET /api/auth/google/url` e `GET /api/auth/google/callback` implementados
- Frontend tem botao Google renderizado em `RigthSide.tsx` e `RegisterSide.tsx` sem onClick
- O callback do backend retorna JSON em vez de redirecionar — precisa ser corrigido
- O callback do backend nao persiste `userId` na sessao — precisa ser corrigido

## Fluxo

```
1. Usuario clica botao Google
2. Frontend chama GET /api/auth/google/url
3. Frontend redireciona o navegador para a URL retornada (Google consent)
4. Google autentica e redireciona para GET /api/auth/google/callback?code=...&state=...
5. Backend valida state, troca code por tokens, cria/encontra usuario
6. Backend salva session.userId no cookie
7. Backend redireciona para FRONTEND_URL/auth/callback
8. Frontend (pagina /auth/callback) chama GET /api/auth/me
9. AuthContext recebe o usuario, navega para /app
```

Em caso de erro no passo 5-6, backend redireciona para `FRONTEND_URL/login?error=oauth_failed`.

## Mudancas

### Backend

#### 1. Nova variavel de ambiente `FRONTEND_URL`

- Adicionar em `.env.example`: `FRONTEND_URL=http://localhost:5173`
- Usada exclusivamente para o redirect pos-OAuth

#### 2. `auth.controller.ts` — metodo `callback`

Antes (atual):
```ts
const result = await this.authService.handleCallback({...});
return res.json(result);
```

Depois:
```ts
const result = await this.authService.handleCallback({...});
session.userId = result.session.userId;
await session.save();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
return res.redirect(`${frontendUrl}/auth/callback`);
```

Erro:
```ts
catch (error) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
}
```

### Frontend

#### 3. `authService.ts` — nova funcao `getGoogleAuthUrl`

```ts
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

#### 4. `RigthSide.tsx` e `RegisterSide.tsx` — onClick no botao Google

Adicionar handler que:
1. Chama `getGoogleAuthUrl()`
2. Redireciona com `window.location.href = url`

#### 5. Nova pagina `AuthCallback.tsx`

Componente em `/auth/callback` que:
1. Mostra loading spinner
2. Chama `/auth/me` via AuthContext (que ja faz isso no mount)
3. Se usuario autenticado, navega para `/app`
4. Se falha, navega para `/login` com mensagem de erro

#### 6. `App.tsx` — nova rota

```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

## Criterios de aceite

- Login Google funciona end-to-end (clicar botao -> autenticar -> chegar no /app)
- Conta criada automaticamente quando nao existe
- Usuario fica autenticado no app apos login social (cookie de sessao persistido)
- Erros no OAuth redirecionam para /login com indicacao visual de falha
- Funciona tanto na pagina de login quanto na de registro

## Fora de escopo

- Login com Facebook ou Apple (botoes existem mas nao serao integrados agora)
- Refresh de tokens OAuth
- Linking de contas (usuario ja logado conectar Google)
