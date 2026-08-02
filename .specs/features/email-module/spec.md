# Módulo de E-mail Centralizado — Specification

**Task:** PAV-76 · **Team:** Painel Vagas

## Problem Statement

A plataforma passou a ter domínio próprio e precisa enviar e-mails transacionais (boas-vindas, contato/suporte e, futuramente, recuperação de senha, confirmação de e-mail, alertas de vagas). Hoje não existe nenhum mecanismo de envio. Sem um ponto único, cada funcionalidade implementaria seu próprio envio — duplicando código e dificultando manutenção e troca de provedor.

## Goals

- [ ] Expor uma **API interna única** de envio de e-mail, consumível por qualquer módulo do backend.
- [ ] Enviar de forma **assíncrona e resiliente** (fila com retry), sem que a falha de e-mail derrube o request que o originou.
- [ ] Separar **lógica de envio** (provider) de **templates** (react-email), ambos versionados no projeto.
- [ ] Entregar o fluxo funcional de **boas-vindas** como primeiro consumidor real, disparado tanto no **registro por e-mail/senha** quanto no **primeiro login social** (Google, GitHub, LinkedIn) — apenas para contas recém-criadas.
- [ ] Deixar o provedor **trocável** via configuração, sem alterar código chamador.
- [ ] Documentar o uso do módulo no repositório.

## Out of Scope

| Feature | Motivo |
| --- | --- |
| **Contato/Suporte** (endpoint + e-mail) | Removido do escopo pelo usuário: o link de "Ajuda & Suporte" foi retirado do frontend em outro PR e só voltará quando a seção for decidida. A arquitetura mantém a API interna genérica, então plugar esse fluxo depois é só um novo template + caller. |
| Recuperação de senha, confirmação de e-mail, troca de e-mail | Evolução futura (PAV-8, PAV-36); o módulo apenas prepara terreno. |
| Alertas de vagas / notificações em lote | Evolução futura; exige fan-out e agregação próprios. |
| Persistência de logs de envio em DB (`email_logs`) | Decisão do usuário: MVP só loga. Auditoria em DB fica para depois. |
| UI de administração de e-mails / dashboard | Não solicitado. |
| Preferências de opt-in/opt-out por usuário | `userPreferences.emailNotifications` já existe mas seu enforcement não é escopo desta task. |
| Segundo provedor (SES/SMTP) implementado | Só a interface é entregue; implementação concreta apenas Resend. |

---

## Assumptions & Open Questions

| Assumption / decisão | Escolha | Racional | Confirmado? |
| --- | --- | --- | --- |
| Provedor inicial | Resend | Decisão do usuário; API simples, integra com domínio próprio. | y |
| Transporte assíncrono | Fila BullMQ sobre Valkey | Decisão do usuário (quer jobs); BullMQ compatível com Valkey (verificado). | y |
| Templates | react-email, versões React fixadas em 19.x | Decisão do usuário; casa com frontend, evita quebra de build. | y |
| Persistência de envios | Somente log (sem tabela) | Decisão do usuário. | y |
| Deployment do worker BullMQ | **In-process** (inicia junto do servidor Express) | Volume baixo no MVP; simples. Extraível p/ processo separado depois sem mudar a fila. | y |
| Comportamento se env de e-mail ausente | Log de aviso + envio vira no-op (não derruba boot) | Ambiente local sem chave não deve quebrar a API. | y |
| Fluxo de contato/suporte | **Fora do escopo** | Seção removida do produto; volta em task futura. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: API interna de envio + entrega assíncrona ⭐ MVP

**User Story**: Como desenvolvedor de qualquer módulo do backend, quero chamar uma única API interna (`emailService.send(...)`) para disparar um e-mail, para não implementar envio próprio.

**Why P1**: É o núcleo do módulo — sem isso nada mais existe. Vertical slice: enfileira → worker renderiza template → provider envia.

**Acceptance Criteria**:
1. WHEN um módulo chama `emailService.send({ template, to, data })` com dados válidos THEN o sistema SHALL enfileirar um job de e-mail e retornar sem aguardar a entrega.
2. WHEN um job de e-mail é processado pelo worker THEN o sistema SHALL renderizar o template HTML indicado e despachá-lo através do provedor configurado (Resend).
3. WHEN o despacho pelo provedor falha THEN o worker SHALL re-tentar com backoff até o limite configurado e, no fracasso final, registrar erro em log — sem lançar exceção para o caller original.
4. WHEN o provedor é trocado via configuração THEN nenhum código chamador SHALL precisar de alteração (contrato via interface `MailProvider`).
5. WHEN `to` é um e-mail inválido OU `template` é desconhecido THEN o sistema SHALL rejeitar no momento do enqueue com erro de validação, antes de criar o job.

**Independent Test**: Chamar `emailService.send` com um provider fake em memória e asseverar que o job foi enfileirado, o template renderizou HTML esperado e o provider recebeu `{ to, subject, html }`; simular falha do provider e asseverar retry + log.

---

### P1: E-mail de boas-vindas no registro e no primeiro login social ⭐ MVP

**User Story**: Como novo usuário, quero receber um e-mail de boas-vindas quando minha conta é criada — seja por cadastro com e-mail/senha ou pelo primeiro login social (Google, GitHub, LinkedIn) —, para confirmar que minha conta foi criada.

**Why P1**: Critério de aceite explícito da task (template funcional de boas-vindas) e primeiro consumidor real da API interna. Como a maioria dos cadastros ocorre via login social, o gatilho precisa cobrir esse caminho além do registro por credenciais.

**Acceptance Criteria**:
1. WHEN um usuário completa o registro por e-mail/senha com sucesso THEN o sistema SHALL enfileirar um e-mail de boas-vindas para o endereço do usuário.
2. WHEN um usuário faz login social (Google, GitHub ou LinkedIn) E uma conta é criada pela primeira vez THEN o sistema SHALL enfileirar um e-mail de boas-vindas para o endereço do usuário.
3. WHEN um usuário faz login social E a conta já existe (relogin, ou vínculo de um novo provider a um usuário que já se cadastrou antes) THEN o sistema SHALL NÃO enfileirar e-mail de boas-vindas.
4. WHEN o e-mail de boas-vindas é renderizado THEN ele SHALL conter o nome do usuário e o HTML do template de boas-vindas.
5. WHEN o e-mail de boas-vindas é renderizado THEN ele SHALL incluir um botão "Acessar plataforma" cujo link aponta para `FRONTEND_URL` (env já existente, reusada).
6. WHEN o enfileiramento do e-mail de boas-vindas falha THEN o fluxo de origem (registro OU login social) SHALL concluir normalmente mesmo assim (falha de e-mail é logada, não propagada).

**Independent Test**: (a) Executar `CredentialsService.register` com fila mockada e asseverar que um job "welcome" foi enfileirado com o `to`/nome corretos. (b) Executar `AuthService.handleCallback` para um perfil OAuth sem usuário correspondente e asseverar que boas-vindas é enfileirado; repetir para um usuário já existente (achado por provider ou por e-mail) e asseverar que **não** é enfileirado. (c) Em ambos os fluxos, forçar erro no envio e asseverar que a operação de origem ainda conclui com sucesso.

---

## Edge Cases

- WHEN as variáveis de ambiente de e-mail (ex: `EMAIL_API_KEY`) estão ausentes THEN o sistema SHALL logar aviso e tratar o envio como no-op, sem derrubar o boot da API.
- WHEN o Valkey está indisponível no momento do enqueue THEN o `emailService.send` SHALL logar erro e não propagar exceção que quebre o fluxo de negócio chamador.
- WHEN dois registros do mesmo usuário disparam boas-vindas THEN cada envio é um job independente (sem dedup no MVP — aceitável).
- WHEN um usuário que já se cadastrou por e-mail/senha faz login social pela primeira vez THEN o provider é vinculado à conta existente e boas-vindas NÃO é reenviado (usuário não é considerado novo).
- WHEN um usuário faz relogin social (conta já vinculada ao provider) THEN nenhum e-mail de boas-vindas é enfileirado.
- WHEN o template referenciado não existe no registry de templates THEN o enqueue SHALL falhar com erro de validação (não gerar job órfão).

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| EMAIL-01 | P1 API interna — enqueue não-bloqueante | Design | Pending |
| EMAIL-02 | P1 API interna — worker renderiza + envia via provider | Design | Pending |
| EMAIL-03 | P1 API interna — retry com backoff + log no fracasso | Design | Pending |
| EMAIL-04 | P1 API interna — provider trocável via interface | Design | Pending |
| EMAIL-05 | P1 API interna — validação de `to`/`template` no enqueue | Design | Pending |
| EMAIL-06 | P1 Boas-vindas — enfileira no registro por e-mail/senha | Design | Pending |
| EMAIL-07 | P1 Boas-vindas — template com nome/HTML | Design | Pending |
| EMAIL-08 | P1 Boas-vindas — falha não quebra fluxo de origem | Design | Pending |
| EMAIL-09 | Edge — env ausente vira no-op sem quebrar boot | Design | Pending |
| EMAIL-10 | Edge — Valkey down no enqueue não propaga | Design | Pending |
| EMAIL-11 | Doc — documentação de uso no repositório | Design | Pending |
| EMAIL-12 | P1 Boas-vindas — enfileira no primeiro login social (Google/GitHub/LinkedIn, usuário novo) | Design | Pending |
| EMAIL-13 | P1 Boas-vindas — não reenvia em relogin/vínculo de provider a usuário existente | Design | Pending |

**ID format:** `EMAIL-NN` · **Status:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 13 total, 0 mapeados a tasks (Tasks ainda não iniciada).

---

## Success Criteria

- [ ] Um módulo consegue enviar e-mail com uma única chamada, sem conhecer o provedor.
- [ ] E-mail de boas-vindas chega em ambiente local e produção (template HTML funcional).
- [ ] Falha de provedor/fila nunca derruba o fluxo de negócio chamador.
- [ ] Trocar provider = implementar interface + mudar env, sem tocar callers.
- [ ] Documentação de uso adicionada ao repositório.
