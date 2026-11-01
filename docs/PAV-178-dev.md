# PAV-178 — publicação controlada em DEV

## Diagnóstico e comportamento entregue

O scheduler, a coleta e o processamento já compartilhavam o catálogo PostgreSQL e a projeção versionada do Valkey. O hotfix preserva resultados devolvidos com erro e separa o prazo da coleta de até 30 segundos adicionais para processamento, respeitando shutdown e perda do lock. Transações confirmadas permanecem no catálogo quando há falha de indexação; `indexed_revision < revision` identifica pendências recuperáveis pelos comandos existentes de manutenção.

O resumo `GET /admin/scrape/status` agora inclui `lastRun`, com provedores, resultado, vagas salvas/indexadas e categoria do erro. Um timeout com persistência retorna `lastRun.status=partial`; a observabilidade mantém `execution.status=failed`, `lastStatus=timeout` e `partial=true`. O histórico detalhado permanece em memória e reinicia com o processo.

O deploy executava `db:seed` junto às migrations. Esse script cria contas e vagas de demonstração, sem dados estruturais necessários à aplicação. Sua chamada automática foi removida; migrations e backfill de PII foram preservados. As duas entradas de fixtures exigem `APP_ENV=local`, `ALLOW_DEMO_SEED=true` e runtime fora de produção. Não executar seeds na publicação em DEV.

O registry mantém os oito provedores e seus controles originais por flags/credenciais. Não foi transferido o registry temporário limitado ao LinkedIn. Greenhouse e Lever agora reutilizam seu cache somente na mesma execução, evitando dados ou erros presos durante toda a vida do processo.

## Configuração de operação

| Variável | Padrão | Comportamento |
|---|---|---|
| `SCRAPER_SCHEDULER_ENABLED` | `true` | Usar `false` na primeira publicação; disparo manual continua disponível. |
| `SCRAPER_SCRAPE_TIMEOUT` | `50m` | Duração Go positiva, por exemplo `300s`; valores inválidos impedem a inicialização. |
| `SCRAPER_PROVIDER_WINDOWS` | vazio | Janelas diárias UTC no formato `provider=HH:MM-HH:MM`, separadas por vírgulas. |
| `SCRAPER_GREENHOUSE_BATCH_SIZE` | `1000` | Inteiro de 1 a 1000; começar com lote menor e medir. |
| `SCRAPER_MAX_CONCURRENCY` | `12` | Limite global já existente. |
| `SCRAPER_PROVIDER_MAX_CONCURRENCY` | `2` | Limite por provedor já existente, sujeito aos overrides existentes. |

Exemplo de planejamento, **não uma recomendação de horários definitivos**:

```text
SCRAPER_SCHEDULER_ENABLED=false
SCRAPER_SCRAPE_TIMEOUT=50m
SCRAPER_PROVIDER_WINDOWS=linkedin=00:00-01:00,gupy=01:00-02:00,greenhouse=02:00-03:00
SCRAPER_GREENHOUSE_BATCH_SIZE=100
```

`SCRAPER_SCRAPE_TIMEOUT` governa o scheduler e os disparos administrativos assíncronos. O endpoint público síncrono `/scrape` mantém seu limite anterior de 15 minutos; ele não é o caminho recomendado para a coleta operacional de DEV.

As janelas são em UTC, com início inclusivo e fim exclusivo. `24:00` é aceito como fim. Janelas que cruzam a meia-noite devem ser divididas. Sobreposição, provider desconhecido ou provider indisponível no registry impedem a inicialização. Não existe cálculo automático pelo fuso do host.

Com janelas configuradas, o scheduler executa somente o provider da janela ativa. Uma reserva diária no Valkey impede repetir a janela depois de reinício ou por outra réplica. O lock global existente impede sobreposição com cron, disparos manuais e buscas públicas. Se o lock estiver ocupado, a janela tenta novamente enquanto ainda houver tempo. Os últimos 35 segundos ficam reservados para processamento/liberação; o contexto limita a execução ao fim da janela.

**Sem janelas, permanece o modo legado de execução conjunta a cada três horas. Não habilitar esse modo em DEV sem decisão operacional explícita.** Uma execução manual também pode ocupar uma janela; nesse caso a exclusão global prevalece.

## Disparo individual e contratos

Com autenticação e permissão administrativa existentes no backend:

```http
POST /admin/scrapers/linkedin/run
POST /admin/scrapers/greenhouse/run
```

Os mesmos endpoints têm o prefixo `/api/v1` disponível. Também é possível enviar `{"sources":["linkedin"]}` em `POST /admin/scrapers/run`. A integração Node → Go usa `POST /admin/scrape` com o mesmo corpo. Ausência de seleção preserva a execução conjunta. ID desconhecido ou provider desabilitado retorna erro; nunca há fallback silencioso para execução global.

Respostas relevantes: 400 para seleção inválida, 409 para lock ocupado, 429 com `Retry-After` quando o provider está bloqueado e 503 para indisponibilidade do lock. O disparo é assíncrono: consultar status/observabilidade para conhecer o resultado final, pois aceitação HTTP não significa coleta completa.

## Greenhouse: lotes, retomada e rate limit

O despacho individual de Greenhouse ordena os adapters por identidade e executa até o tamanho configurado. O checkpoint `scraper:provider:greenhouse:checkpoint` guarda offset e hash da lista. A gravação usa comparação atômica com o proprietário do lock global. O offset só avança quando coleta, persistência e indexação terminam sem erro. Alterar a lista reinicia o ciclo com segurança; os IDs estáveis tornam a repetição idempotente.

A retomada é por lote, não por página ou empresa concluída dentro de lote parcial. Timeout e erros não avançam o checkpoint: resultados confirmados ficam disponíveis e o próximo disparo repete esse lote. Uma empresa permanentemente inválida pode impedir seu avanço; medir e revisar o registry antes de habilitar varreduras grandes. Não há descarte automático dessas empresas.

Greenhouse interpreta `Retry-After` em segundos ou data HTTP; sem cabeçalho válido usa um minuto. O maior prazo informado pelos adapters é gravado no Valkey, condicionado à propriedade do lock. O bloqueio sobrevive ao reinício e vale para disparos individuais e conjuntos. Uma janela bloqueada por rate limit não é consumida; poderá executar após o prazo, se ainda estiver aberta. Fora dela, aguarda uma nova janela. Os demais providers mantêm suas políticas anteriores; não houve unificação geral de retries.

## Busca e recuperação

O backend consulta a versão ativa em `scraper:jobs:index-version` e hidrata documentos em `scraper:jobs:ns:<versao>:job:<id>`. Há fallback legado quando não existe versão ativa. O catálogo SQL continua sendo a fonte durável para reconstrução da projeção. IDs de um índice sem documentos não permitem recriar o conteúdo das vagas.

O Processor recusa inicializar com índice legado não vazio e sem versão ativa, até uma migração/reconstrução explícita. Verificar essa condição no destino é **bloqueador do deploy**; não remover a proteção, apagar índices ou executar reconstrução automaticamente. Uma reconstrução eventual exige autorização e procedimento separado.

## Validação local

Sem chamar providers ou iniciar o servidor:

```bash
cd scraper-go
go test ./... -count=1 -timeout=25s
go test -race ./internal/cronjob ./internal/pipeline -run 'Test(Collection|ProviderRetry|ManualProvider|ProviderWindowClaim|Greenhouse|RunWithConcurrencyCancel)' -count=1 -timeout=20s
```

Os testes com miniredis precisam de sockets locais. Integrações SQL e Redis/Valkey reais são opt-in: configurar `PAV125_TEST_DATABASE_URL` e `PAV125_TEST_VALKEY_URL` **somente para instâncias descartáveis dedicadas**. A suíte cria seus próprios schemas/chaves. Nunca apontar essas variáveis para DEV compartilhado ou produção.

```bash
cd backend
npx --no-install tsc --noEmit -p tsconfig.json
npx --no-install vitest run tests/unit/modules/admin tests/unit/modules/jobs tests/unit/libs/cache.test.ts tests/unit/scripts/seed.test.ts tests/unit/scripts/seedPolicy.test.ts tests/unit/scripts/seedCatalogJobs.test.ts tests/integration/routes/admin.routes.test.ts tests/integration/routes/searchJobs.routes.test.ts
# Somente com Redis/Valkey descartável explicitamente configurado:
npx --no-install vitest run tests/integration/jobs.valkey.test.ts
```

## Checklist de publicação em DEV

- [ ] Revisar o PR único para `develop`, incluindo os commits anteriores da PAV-178.
- [ ] Confirmar ausência de `.env`, `compose.pav178-test.yml`, binários e `cspell.json` no diff do PR.
- [ ] Confirmar o registry completo e as flags/credenciais dos providers selecionados.
- [ ] Verificar catálogo, versão ativa e compatibilidade das migrations no destino, sem alterar dados.
- [ ] Publicar inicialmente com `SCRAPER_SCHEDULER_ENABLED=false`; não executar seeds.
- [ ] Após publicação autorizada, executar somente um provider e conferir salvos/indexados, documentos reais na busca e liberação do lock.
- [ ] Medir CPU, memória, requisições, duração e progresso de cada lote. Definir janelas com margem a partir dessas medições.
- [ ] Reduzir Greenhouse se um lote não concluir dentro da janela; tratar empresas com falha permanente antes de habilitar sua varredura automática.
- [ ] Configurar janelas sem sobreposição e somente então habilitar o scheduler.
- [ ] Acompanhar resumo parcial, erros, Retry-After e checkpoint nas primeiras execuções.
- [ ] Manter rollback restrito à imagem/versão de DEV e ao desligamento do scheduler; preservar catálogo e volumes.

A publicação, validação com providers reais e definição dos horários finais não foram executadas nesta rodada. Não há garantia de que 30 segundos bastem para drenar qualquer backlog, nem isolamento por processo para adapters que desrespeitem cancelamento. O estado de janelas/checkpoints depende da retenção configurada no Valkey.
