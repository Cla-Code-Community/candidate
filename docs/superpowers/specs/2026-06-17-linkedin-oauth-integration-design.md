# PAV-6: LinkedIn OAuth Integration

## Objetivo

Integrar login social com LinkedIn no app, seguindo o mesmo padrao do Google OAuth (PAV-5). O backend ja possui o provider implementado — o foco e validar o backend e implementar o frontend.

## Contexto

- Backend tem provider `linkedin.ts` implementado com `openid-client` (mesmo padrao do Google)
- Rotas genericas `GET /api/auth/:provider/url` e `GET /api/auth/:provider/callback` ja funcionam
- Provider registrado em `auth.provider.ts`, types incluem `"linkedin"` no enum `OAuthProvider`
- Variaveis `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` ja no `.env.example`
- Frontend tem 3 botoes sociais (Google, Facebook, Apple) — Facebook sera substituido por LinkedIn
- App LinkedIn ja criado no LinkedIn Developers com credenciais disponiveis

## Abordagem

Minimal Delta — aproveitar 100% da infraestrutura existente. Nao refatorar codigo do Google, apenas replicar o padrao para LinkedIn.

## Fluxo

```
1. Usuario clica botao LinkedIn
2. Frontend chama GET /api/auth/linkedin/url
3. Frontend redireciona o navegador para a URL retornada (LinkedIn consent)
4. LinkedIn autentica e redireciona para GET /api/auth/linkedin/callback?code=...&state=...
5. Backend valida state, troca code por tokens, cria/encontra usuario
6. Backend salva session.userId no cookie
7. Backend redireciona para FRONTEND_URL/auth/callback
8. Frontend (pagina /auth/callback) chama GET /api/auth/me
9. AuthContext recebe o usuario, navega para /app
```

Em caso de erro no passo 5-6, backend redireciona para `FRONTEND_URL/login?error=oauth_failed`.
Se email ausente no profile, redireciona para `FRONTEND_URL/login?error=oauth_email_required`.

## Mudancas

### Backend

#### 1. Validacao do provider `linkedin.ts`

Arquivo existente: `backend/src/modules/auth/providers/linkedin.ts`

Validar que:
- Discovery URL `https://www.linkedin.com/oauth` funciona com `openid-client`
- Credenciais `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` estao no `.env`
- Callback URL no app LinkedIn matches `${APP_URL}/auth/linkedin/callback`

Nenhuma mudanca estrutural necessaria — rotas, provider registry, e types ja estao prontos.

#### 2. Tratamento de email ausente

No fluxo de callback, apos obter o profile do LinkedIn, verificar se `profile.email` existe. Se nao existir, redirecionar para `/login?error=oauth_email_required` em vez de criar usuario sem email.

### Frontend

#### 3. `authService.ts` — nova funcao `getLinkedinAuthUrl`

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

#### 4. `RigthSide.tsx` e `RegisterSide.tsx` — botao LinkedIn

Em ambos os componentes:
- Importar `getLinkedinAuthUrl` do authService
- Adicionar handler `handleLinkedinLogin` (mesmo padrao do `handleGoogleLogin`)
- Substituir o botao Facebook (segundo no grid) por botao LinkedIn
- Usar SVG inline para icone LinkedIn (mesmo padrao do botao Apple)
- Adicionar `onClick={handleLinkedinLogin}`

#### 5. `AuthCallback.tsx` — sem mudanca

A pagina de callback e generica — chama `refreshUser()` e redireciona. Funciona para qualquer provider.

## Testes

### Integracao backend

Estender `backend/tests/integration/routes/auth.routes.test.ts`:
- `GET /api/auth/linkedin/url` — retorna URL de autorizacao valida
- `GET /api/auth/linkedin/callback` — com state valido, processa login
- `GET /api/auth/linkedin/callback` — com state invalido, redireciona com erro
- Caso de email ausente — redireciona com `?error=oauth_email_required`

### Testes frontend

- `getLinkedinAuthUrl()` chama endpoint correto e retorna URL
- Botao LinkedIn em `RigthSide.tsx` e `RegisterSide.tsx` dispara `handleLinkedinLogin`
- `AuthCallback.tsx` continua funcionando (nao regressao)

### Cobertura

Manter niveis minimos de coverage exigidos pelo projeto.

## Criterios de aceite

- Login LinkedIn funciona end-to-end (clicar botao -> autenticar -> chegar no /app)
- Conta criada automaticamente quando nao existe
- Usuario fica autenticado no app apos login social (cookie de sessao persistido)
- Email ausente no profile LinkedIn resulta em erro claro, nao em usuario sem email
- Erros no OAuth redirecionam para /login com indicacao visual de falha
- Funciona tanto na pagina de login quanto na de registro
- Testes de integracao backend e frontend passando
- Coverage minimo atendido

## Fora de escopo

- Login com Facebook ou Apple (botoes existem mas nao serao integrados agora)
- Refresh de tokens OAuth
- Linking de contas (usuario ja logado conectar LinkedIn)
- Refatoracao do frontend para funcao generica de social auth
