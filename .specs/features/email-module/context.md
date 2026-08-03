# Email Module — User Decisions (context)

Captured during the discuss phase of PAV-76. These constrain the design.

| Área | Decisão do usuário | Detalhe |
| --- | --- | --- |
| Provedor | **Resend** como primeira implementação | Atrás de interface `MailProvider` para troca futura barata. |
| Estratégia de envio | **Fila de jobs (BullMQ)** | Usuário quer sistema de jobs. Projeto usava Redis; hoje usa Valkey. Verificado: BullMQ é 100% compatível com Valkey via ioredis. |
| Templates | **react-email** | ⚠️ Fixar versões de `react`/`react-dom`/`@types/react` em **19.x** para casar com o frontend (React 19.2.7) e não quebrar o build. |
| Persistência | **Somente logar** (sem tabela) | Sem `email_logs` no MVP. Auditoria em DB fica como evolução futura. |

## Verificações técnicas (Knowledge Verification Chain)

- **BullMQ + Valkey:** compatível em produção (Valkey = fork Redis 7.2.4). BullMQ usa adapter ioredis; backend hoje usa `node-redis` só p/ cache (`src/lib/cache.ts`) → BullMQ adiciona conexão ioredis dedicada ao mesmo `VALKEY_URL` com `maxRetriesPerRequest: null`.
- **react-email + React 19:** `render()` async funciona 100% com React 19; `@react-email/render` 2.1.0 suporta `react-dom ^19`. Bug conhecido com `@types/react@18` → fixar `@types/react@19`. Requer `jsx: react-jsx` no tsconfig do backend.
- **Frontend React:** `^19.2.7` (frontend/package.json).
- **Backend engine:** Node >= 22.
