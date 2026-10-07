---
name: abrir-pr-jobs-scraper
description: Use quando o usuario pedir para abrir PR, criar PR, enviar PR, submeter PR, fazer pull request, ou similar no projeto Jobs Scraper Global
---

# Abrir PR Padronizado — Jobs Scraper Global

Skill para criar Pull Requests padronizados no projeto **Jobs Scraper Global**, integrando Git, GitHub e Linear e produzindo uma descrição técnica proporcional à complexidade da alteração.

O objetivo desta skill é garantir que todo PR:

- esteja vinculado corretamente à task do Linear;
- respeite o fluxo de fork do projeto;
- seja comparado contra a versão atual de `upstream/develop`;
- tenha validações compatíveis com os módulos realmente alterados;
- apresente uma descrição útil para revisão técnica;
- não dependa apenas das mensagens de commit para explicar a entrega;
- seja criado somente após preview e confirmação do usuário;
- preserve rastreabilidade, segurança e clareza operacional.

---

## Sumário

1. [Princípios gerais](#princípios-gerais)
2. [Fluxo resumido](#fluxo-resumido)
3. [Pré-requisitos](#pré-requisitos)
4. [Passo 0 — Verificar pré-requisitos](#passo-0--verificar-pré-requisitos)
5. [Passo 1 — Identificar a task do Linear](#passo-1--identificar-a-task-do-linear)
6. [Passo 2 — Buscar dados da task](#passo-2--buscar-dados-da-task)
7. [Passo 3 — Verificar Git, branch, commits e PR existente](#passo-3--verificar-git-branch-commits-e-pr-existente)
8. [Passo 4 — Analisar as alterações](#passo-4--analisar-as-alterações)
9. [Passo 5 — Executar testes e validações](#passo-5--executar-testes-e-validações)
10. [Passo 6 — Gerar a documentação do PR](#passo-6--gerar-a-documentação-do-pr)
11. [Passo 7 — Montar e mostrar o preview](#passo-7--montar-e-mostrar-o-preview)
12. [Passo 8 — Confirmar ou editar](#passo-8--confirmar-ou-editar)
13. [Passo 9 — Criar o PR](#passo-9--criar-o-pr)
14. [Regras para escrever a descrição](#regras-para-escrever-a-descrição)
15. [Como adaptar o PR à complexidade](#como-adaptar-o-pr-à-complexidade)
16. [Erros comuns](#erros-comuns)
17. [Modelo padrão de PR](#modelo-padrão-de-pr)
18. [Exemplo preenchido](#exemplo-preenchido)

---

## Princípios gerais

Ao executar esta skill, siga estes princípios:

1. **Não invente informações.**
   - Não marque testes como executados se não foram executados.
   - Não declare impacto inexistente sem analisar o diff.
   - Não invente arquivos, migrations, riscos, comandos ou resultados.

2. **A descrição do PR deve refletir o estado final da implementação.**
   - Não transforme apenas mensagens de commit em texto.
   - Use task do Linear, diff, arquivos alterados, código final e resultados de validação.

3. **A documentação deve ser proporcional à mudança.**
   - Alterações pequenas devem gerar PRs concisos.
   - Alterações arquiteturais, de infraestrutura, contratos, banco ou múltiplos módulos exigem mais contexto.

4. **O usuário sempre vê o preview antes da criação.**

5. **Testes falhando não bloqueiam automaticamente o PR.**
   - Mostre os resultados com clareza.
   - Explique se a falha aparenta estar relacionada ou não à alteração.
   - O usuário decide se deseja prosseguir.

6. **O PR deve partir do fork do desenvolvedor para o upstream.**

7. **O identificador da task e o link do Linear não devem ser removidos quando a integração Linear ↔ GitHub depender deles.**

---

## Fluxo resumido

Ao abrir um PR:

1. Verifique as ferramentas necessárias.
2. Identifique a branch atual.
3. Extraia o código `PAV-XX`, se existir.
4. Confirme a task com o usuário.
5. Consulte o Linear quando disponível.
6. Atualize a referência de `upstream/develop`.
7. Verifique commits à frente de `develop`.
8. Verifique se já existe PR aberto para a branch.
9. Analise o diff e identifique módulos afetados.
10. Execute as validações adequadas às alterações.
11. Gere a documentação do PR com base no estado final do código.
12. Monte o título e o corpo completos.
13. Mostre o preview.
14. Aguarde confirmação do usuário.
15. Faça push da branch, se necessário.
16. Crie o PR do fork para `Cla-Code-Community/candidate:develop`.
17. Retorne o link do PR criado.

---

## Pré-requisitos

Antes de iniciar, verifique as ferramentas relevantes.

| Ferramenta | Como verificar | Se ausente |
| --- | --- | --- |
| Git | `git --version` | Informar que Git não está instalado e parar |
| GitHub CLI | `gh --version` | Informar que o GitHub CLI não está instalado e parar |
| Linear MCP | Verificar ferramentas `mcp__linear-server__*` | Tentar seguir com dados manuais da task, quando viável |
| npm | `npm --version` | Exigir somente se módulos Node forem afetados |
| Go | `go version` | Exigir somente se módulos Go forem afetados |

### Regra de degradação do Linear

A ausência do MCP do Linear não precisa bloquear automaticamente a geração do PR.

Se o Linear não estiver disponível:

1. informe claramente a limitação;
2. tente obter do usuário:
   - código da task;
   - título;
   - URL;
3. prossiga somente se houver informação suficiente para manter a rastreabilidade.

Se a integração automática Linear ↔ GitHub depender obrigatoriamente do link e ele não estiver disponível, informe isso no preview.

---

## Passo 0 — Verificar pré-requisitos

Execute as verificações básicas:

```bash
git --version
gh --version
```

Descubra os módulos afetados antes de exigir ferramentas específicas como npm ou Go.

Não bloqueie a execução por ausência de uma ferramenta que não seja necessária para os arquivos alterados.

---

## Passo 1 — Identificar a task do Linear

1. Obter a branch atual:

```bash
git branch --show-current
```

1. Tentar extrair o padrão:

```text
PAV-\d+
```

A busca deve ser case insensitive.

1. Se encontrar um código `PAV-XX`, confirmar com o usuário:

> A task desenvolvida foi a **PAV-XX**?

1. Se o usuário confirmar, usar o código.

2. Se negar, pedir o código correto.

3. Se não houver código na branch, perguntar:

> Qual é o código da task no Linear? Ex.: PAV-42

Não assumir silenciosamente que o código encontrado na branch é o correto.

---

## Passo 2 — Buscar dados da task

Quando o MCP do Linear estiver disponível:

1. usar `mcp__linear-server__get_issue`;
2. buscar a task pelo código;
3. extrair:
   - identificador;
   - título;
   - URL;
   - descrição, quando útil para compreender o objetivo;
   - critérios de aceite, quando disponíveis.

### Se a task não for encontrada

Informar ao usuário.

Permitir:

- corrigir o código;
- informar título e URL manualmente;
- criar a task por outro fluxo, se houver skill própria para isso.

Não inventar título ou URL.

---

## Passo 3 — Verificar Git, branch, commits e PR existente

> **Modelo de fork**
>
> O remote `origin` aponta para o fork do desenvolvedor.
>
> O remote `upstream` aponta para:
>
> `Cla-Code-Community/candidate`
>
> O PR deve ser criado do fork para o upstream.

### 3.1 Identificar os remotes

```bash
git remote -v
```

Confirme que:

- `origin` é o fork;
- `upstream` é o repositório principal.

### 3.2 Detectar o owner do fork

Não use `gh repo view` para descobrir o owner do fork.

Use:

```bash
FORK_OWNER=$(git remote get-url origin | sed -E 's#.*[/:]([^/]+)/[^/]+(\.git)?$#\1#')
```

### 3.3 Atualizar `upstream/develop`

```bash
git fetch upstream develop
```

### 3.4 Verificar commits à frente

```bash
git log upstream/develop..HEAD --oneline
```

Se não houver commits:

> Esta branch não tem commits à frente de `upstream/develop`. Não há mudanças para abrir PR.

Parar a execução.

### 3.5 Verificar PR existente

```bash
gh pr list \
  --head "$FORK_OWNER:$(git branch --show-current)" \
  --repo Cla-Code-Community/candidate \
  --state open
```

Se já existir PR aberto:

- mostrar número e link;
- perguntar se o usuário deseja atualizar o PR existente;
- não criar um PR duplicado sem confirmação explícita.

---

## Passo 4 — Analisar as alterações

Antes de escrever a descrição do PR, analise a implementação.

### 4.1 Obter diff

```bash
git diff upstream/develop..HEAD
```

Para visão resumida:

```bash
git diff --stat upstream/develop..HEAD
```

Para lista de arquivos:

```bash
git diff --name-status upstream/develop..HEAD
```

### 4.2 Obter commits

```bash
git log upstream/develop..HEAD --oneline
```

### 4.3 Identificar o escopo real

Determine:

- quais módulos foram alterados;
- quais funcionalidades foram criadas ou corrigidas;
- se houve alteração de API ou contrato;
- se houve alteração de banco ou migration;
- se houve alteração de configuração;
- se houve alteração de infraestrutura;
- se houve alteração de segurança/autorização;
- se houve alteração de dados pessoais ou privacidade;
- se houve documentação atualizada;
- se existem riscos operacionais;
- se há necessidade de rollback especial.

### 4.4 Não usar commits como única fonte

As mensagens de commit ajudam a compreender o histórico, mas a descrição do PR deve refletir o **estado final do diff**.

---

## Passo 5 — Executar testes e validações

As validações devem ser escolhidas com base nos módulos afetados e nas instruções já existentes no repositório.

### 5.1 Regra geral

Antes de executar comandos, procure orientações em arquivos como:

- `AGENTS.md`;
- `README.md`;
- `CONTRIBUTING.md`;
- documentação do módulo;
- `package.json`;
- Makefiles;
- scripts do projeto;
- workflows de CI;
- documentação específica do processor/backend/frontend.

### 5.2 Não executar suítes irrelevantes por padrão

Não rode automaticamente todos os testes do monorepo se:

- a alteração estiver isolada;
- existirem testes focados suficientes;
- o repositório documentar uma validação específica.

### 5.3 Exemplos de validação Node

Quando aplicável:

```bash
npm test
npm run typecheck
npm run build
npm run lint
```

Use somente scripts realmente existentes.

### 5.4 Exemplos de validação Go

Quando aplicável:

```bash
go test ./...
go build ./...
go vet ./...
```

Use validações mais focadas quando a alteração estiver isolada e isso fizer sentido.

### 5.5 Validações Git

Quando aplicável:

```bash
git diff --check
```

### 5.6 Consolidar resultados

Exemplos:

```text
Backend tests — PASS
Frontend typecheck — PASS
Processor tests — PASS
git diff --check — PASS
```

ou:

```text
Backend tests — FAIL
5 testes falhando em módulo não relacionado à alteração
Frontend typecheck — PASS
```

### 5.7 Testes falhando

Falhas não bloqueiam automaticamente a criação do PR.

O preview deve mostrar:

- comando executado;
- resultado;
- número de falhas, quando disponível;
- se há indícios de relação com a alteração;
- qualquer limitação de ambiente.

Nunca apresentar teste não executado como `PASS`.

---

## Passo 6 — Gerar a documentação do PR

A descrição deve ser construída a partir de:

- task do Linear;
- diff;
- commits;
- arquivos afetados;
- documentação do repositório;
- testes e validações executados;
- impactos observados.

### 6.1 Objetivo

Explique:

- o problema resolvido;
- o resultado entregue;
- como a mudança se relaciona com a task.

Evite descrição genérica como:

> Ajustes diversos no sistema.

Prefira:

> Adiciona classificação de vagas por produto no processor e atualiza o pipeline para produzir a taxonomia esperada pela API.

### 6.2 Resumo das alterações

Liste mudanças concretas e verificáveis.

Exemplo:

```markdown
- Adiciona classificação de produto ao pipeline.
- Atualiza a taxonomia utilizada pelo classifier.
- Inclui testes focados para classificação e geração de keywords.
```

### 6.3 Arquivos ou módulos afetados

Não é necessário listar todos os arquivos de um PR enorme.

Priorize:

- módulos;
- diretórios;
- arquivos arquiteturalmente importantes;
- contratos;
- configurações.

### 6.4 Como testar

Informe comandos realmente aplicáveis.

Não invente comandos.

### 6.5 Impactos

Avalie somente o que fizer sentido:

- banco/migrations;
- configuração;
- segurança;
- privacidade/LGPD;
- contratos/API;
- infraestrutura;
- documentação.

### 6.6 Riscos

Documente riscos reais da mudança.

Não invente riscos apenas para preencher a seção.

### 6.7 Rollback

Para alteração simples, pode ser suficiente:

> Reverter o commit/PR.

Para mudanças com migration, contrato, infraestrutura ou dados, explique os passos necessários.

### 6.8 Fora do escopo

Use para explicitar itens próximos ao problema, mas deliberadamente não tratados nesta entrega.

---

## Passo 7 — Montar e mostrar o preview

> **Importante**
>
> O identificador `PAV-XX` no título e o link do Linear no corpo podem ser utilizados pela integração Linear ↔ GitHub para vincular o PR à task e movimentar o card automaticamente.
>
> Não remover essas referências quando forem necessárias à automação.

### Título

```text
PAV-XX: <título da task no Linear>
```

### Target

```text
Cla-Code-Community/candidate
base: develop
head: <FORK_OWNER>:<branch-atual>
```

### Body

Gerar o corpo conforme o [Modelo padrão de PR](#modelo-padrão-de-pr), adaptando as seções à complexidade da alteração.

Mostrar o preview completo ao usuário.

Perguntar:

> O PR está correto? Confirma a criação? (s/n)

---

## Passo 8 — Confirmar ou editar

### Se o usuário confirmar

Seguir para o Passo 9.

### Se o usuário não confirmar

1. perguntar o que deseja alterar;
2. ajustar somente o necessário;
3. gerar novo preview;
4. pedir confirmação novamente.

Não criar o PR antes da confirmação.

---

## Passo 9 — Criar o PR

### 9.1 Verificar se a branch existe no fork

```bash
git ls-remote --heads origin "$(git branch --show-current)"
```

Se não existir:

> A branch ainda não foi enviada ao remote. Deseja fazer push agora? (s/n)

Se confirmado:

```bash
git push -u origin "$(git branch --show-current)"
```

Se negado, parar.

### 9.2 Detectar owner do fork

```bash
FORK_OWNER=$(git remote get-url origin | sed -E 's#.*[/:]([^/]+)/[^/]+(\.git)?$#\1#')
```

### 9.3 Criar o PR com GitHub CLI

```bash
gh pr create \
  --repo Cla-Code-Community/candidate \
  --base develop \
  --head "$FORK_OWNER:$(git branch --show-current)" \
  --title "PAV-XX: <titulo>" \
  --body "<body completo>"
```

Para bodies grandes, prefira arquivo temporário quando apropriado:

```bash
gh pr create \
  --repo Cla-Code-Community/candidate \
  --base develop \
  --head "$FORK_OWNER:$(git branch --show-current)" \
  --title "PAV-XX: <titulo>" \
  --body-file /tmp/pr-body.md
```

### 9.4 Fallback se `gh pr create` falhar

Erros típicos:

```text
No commits between ...
Head sha can't be blank
Head ref must be a branch
```

Antes do fallback, valide a comparação diretamente na API:

```bash
gh api \
  "repos/Cla-Code-Community/candidate/compare/develop...$FORK_OWNER:$(git branch --show-current)" \
  --jq '{status:.status, ahead_by:.ahead_by}'
```

Se retornar:

```text
ahead_by > 0
```

a branch está à frente de `develop` e o problema pode estar na montagem do `--head`.

Criar via API REST.

Exemplo conceitual:

```bash
PAYLOAD=$(mktemp)

cat > "$PAYLOAD" <<JSON
{
  "title": "PAV-XX: <titulo>",
  "head": "$FORK_OWNER:$(git branch --show-current)",
  "base": "develop",
  "body": "<body em JSON válido>"
}
JSON

gh api \
  --method POST \
  repos/Cla-Code-Community/candidate/pulls \
  --input "$PAYLOAD" \
  --jq '{number:.number, url:.html_url}'

rm -f "$PAYLOAD"
```

Ao montar JSON manualmente, garanta escaping correto do body.

### 9.5 Concluir

Retornar:

- número do PR;
- título;
- base;
- head;
- URL.

---

## Regras para escrever a descrição

A descrição do PR deve ser proporcional à alteração.

### Sempre fazer

- relacionar a mudança com a task;
- analisar o diff final;
- explicar o resultado entregue;
- informar validações realmente executadas;
- destacar impactos relevantes;
- registrar limitações conhecidas;
- diferenciar claramente `PASS`, `FAIL` e `NOT RUN`.

### Evitar

- copiar mensagens de commit como descrição;
- escrever frases vagas;
- criar seções enormes sem conteúdo útil;
- preencher tudo com `N/A`;
- afirmar que não há impacto sem analisar;
- incluir secrets;
- incluir valores reais de `.env`;
- incluir tokens;
- incluir credenciais;
- incluir dados pessoais desnecessários.

### Linguagem

Use linguagem técnica, direta e revisável.

Prefira:

> Atualiza o classifier para produzir a categoria de produto antes da etapa de geração de keywords.

Evite:

> Foram feitas melhorias importantes no sistema para que tudo funcione melhor.

---

## Como adaptar o PR à complexidade

### PR pequeno

Exemplos:

- correção localizada;
- teste;
- ajuste de tipagem;
- pequena refatoração sem mudança de contrato.

Seções normalmente suficientes:

- Linear;
- Objetivo;
- Resumo das alterações;
- Como testar;
- Validação.

### PR médio

Exemplos:

- feature em um módulo;
- mudança de comportamento;
- alteração em múltiplos arquivos relacionados.

Adicionar quando relevante:

- Arquivos/módulos afetados;
- Impactos;
- Riscos;
- Fora do escopo.

### PR grande

Exemplos:

- arquitetura;
- infraestrutura;
- Docker;
- múltiplos serviços;
- API + processor;
- banco/migrations;
- autenticação/autorização;
- contratos;
- mudanças operacionais.

Usar o modelo completo, incluindo:

- objetivo;
- resumo;
- arquitetura, se necessário;
- módulos afetados;
- como testar;
- validações;
- banco/migrations;
- configuração;
- segurança;
- privacidade;
- documentação;
- riscos;
- rollback;
- fora do escopo;
- checklist.

### Regra importante

Seções sem relevância podem:

- ser omitidas; ou
- ser resumidas em uma única linha.

Não invente impacto para preencher template.

---

## Erros comuns

### Não atualizar `upstream/develop`

Sempre execute:

```bash
git fetch upstream develop
```

antes da comparação.

### Não confirmar a task

Mesmo que a branch contenha `PAV-XX`, confirme com o usuário.

### Criar PR sem preview

Nunca criar sem mostrar o conteúdo completo e receber confirmação.

### Usar commits como descrição

Commits explicam o histórico.

O PR deve explicar a entrega final.

### Rodar testes irrelevantes

Escolha validações de acordo com os módulos afetados.

### Bloquear automaticamente por teste falhando

Mostre a falha e permita decisão consciente do usuário.

### Marcar teste não executado como PASS

Nunca.

### Esquecer o modelo de fork

O PR deve usar:

```text
fork:branch -> Cla-Code-Community/candidate:develop
```

### Não usar `--head`

No modelo de fork, informar explicitamente:

```bash
--head "$FORK_OWNER:<branch>"
```

### Usar owner errado

Derive o owner a partir de `origin`.

Não dependa de `gh repo view` para isso.

### Criar PR duplicado

Verifique PR existente antes.

### Incluir informações sensíveis

Nunca incluir:

- `.env` real;
- tokens;
- chaves;
- certificados;
- credenciais;
- secrets;
- dados pessoais desnecessários.

---

## Modelo padrão de PR

Use este modelo como referência canônica.

Adapte as seções conforme a complexidade da alteração.

### Título

```text
PAV-XX: <título da task>
```

### Corpo

````markdown
## Linear

Close PAV-XX

<URL da task>

## Objetivo

<Explique de forma objetiva o problema resolvido, o resultado entregue e a relação com a task.>

## Resumo das alterações

- <alteração principal>
- <alteração principal>
- <alteração principal>

## Arquivos / módulos afetados

- `<módulo ou caminho relevante>`
- `<módulo ou caminho relevante>`

## Arquitetura

<Opcional. Use quando houver alteração arquitetural, de fluxo entre serviços ou infraestrutura.>

```text
<diagrama textual simples, se ajudar a revisão>
```

## Como testar

```bash
<comandos realmente aplicáveis>
```

## Validação

- [ ] Testes relevantes executados
- [ ] Build executado quando aplicável
- [ ] Typecheck executado quando aplicável
- [ ] Lint/vet executado quando aplicável
- [ ] `git diff --check`
- [ ] Documentação atualizada quando aplicável
- [ ] Nenhum segredo ou artefato sensível incluído

### Resultados

- `<comando>` — PASS / FAIL / NOT RUN
- `<comando>` — PASS / FAIL / NOT RUN

## Impacto de banco / migrations

<Sem impacto ou descrição objetiva das alterações.>

## Impacto de configuração

<Sem impacto ou descrição de novas variáveis, arquivos ou comportamento de ambiente.>

## Impacto de contratos / API

<Sem impacto ou descrição das alterações em endpoints, payloads, eventos, protobuf, schemas etc.>

## Impacto de segurança / privacidade

<Sem impacto relevante ou descrição do impacto avaliado.>

## Impacto de documentação

<Sem impacto ou arquivos/documentos atualizados.>

## Riscos

- <risco real da alteração>
- <limitação conhecida, se houver>

## Rollback

<Explique como reverter com segurança. Para mudanças simples, "reverter o PR" pode ser suficiente.>

## Fora do escopo

- <item relacionado, mas deliberadamente não tratado nesta entrega>

## Checklist

- [ ] Task do Linear confirmada
- [ ] Diff revisado contra `upstream/develop`
- [ ] Testes/validações relevantes executados
- [ ] Nenhum segredo ou credencial incluído
- [ ] PR parte do fork correto
- [ ] Base do PR é `develop`
- [ ] Preview confirmado pelo usuário
````

---

## Exemplo preenchido

> Exemplo ilustrativo.
>
> Os nomes abaixo servem apenas para demonstrar o nível de detalhe esperado.

### Título

```text
PAV-128: corrigir classificação de produto no processor
```

### Corpo

````markdown
## Linear

Close PAV-128

https://linear.app/exemplo/issue/PAV-128

## Objetivo

Corrigir a classificação de produto no processor para que as vagas processadas sejam associadas à taxonomia esperada pela plataforma antes da geração de keywords.

A alteração mantém o escopo no pipeline de processamento e não modifica autenticação ou gerenciamento de usuários.

## Resumo das alterações

- Atualiza a lógica de classificação de produto.
- Ajusta a taxonomia usada pelo classifier.
- Integra a classificação ao pipeline antes da geração de keywords.
- Adiciona testes focados para classifier, keywords e pipeline.
- Atualiza a documentação técnica relacionada ao processor.

## Arquivos / módulos afetados

- `scraper-go/internal/classifier/`
- `scraper-go/internal/keywords/`
- `scraper-go/internal/pipeline/`
- `SCRAPER.md`

## Como testar

```bash
cd scraper-go

go test ./internal/classifier/...
go test ./internal/keywords/...
go test ./internal/pipeline/...
go test ./...
go build ./...
```

## Validação

- [x] Testes focados executados
- [x] Suíte Go executada
- [x] Build Go executado
- [x] `git diff --check`
- [x] Documentação revisada
- [x] Nenhum segredo incluído

### Resultados

- `go test ./internal/classifier/...` — PASS
- `go test ./internal/keywords/...` — PASS
- `go test ./internal/pipeline/...` — PASS
- `go test ./...` — PASS
- `go build ./...` — PASS
- `git diff --check` — PASS

## Impacto de banco / migrations

Sem alteração de schema ou migrations.

## Impacto de configuração

Sem novas variáveis de ambiente.

## Impacto de contratos / API

Sem alteração de contrato público da API.

A mudança ocorre no processamento interno das vagas.

## Impacto de segurança / privacidade

Sem impacto relevante identificado.

A alteração não adiciona autenticação, autorização, coleta de dados pessoais ou novos secrets.

## Impacto de documentação

Atualiza `SCRAPER.md` para refletir o fluxo de classificação utilizado pelo processor.

## Riscos

- Mudanças futuras na taxonomia podem exigir atualização dos testes de classificação.
- Regras excessivamente genéricas podem aumentar falsos positivos de classificação.

## Rollback

Reverter o PR restaura a lógica anterior de classificação.

Não há migration ou alteração de dados persistidos que exija rollback adicional.

## Fora do escopo

- Alterações de autenticação.
- Alterações no frontend.
- Mudanças no contrato público da API.

## Checklist

- [x] Task do Linear confirmada
- [x] Diff revisado contra `upstream/develop`
- [x] Testes/validações relevantes executados
- [x] Nenhum segredo ou credencial incluído
- [x] PR parte do fork correto
- [x] Base do PR é `develop`
- [x] Preview confirmado pelo usuário
````

---

## Resultado esperado da skill

Ao concluir, a skill deve ter produzido:

1. task confirmada;
2. contexto atualizado de `upstream/develop`;
3. branch validada;
4. diff analisado;
5. testes e validações documentados;
6. descrição proporcional à complexidade;
7. preview aprovado;
8. PR criado do fork correto;
9. link final retornado ao usuário.

A skill deve priorizar **clareza, rastreabilidade, revisão técnica e segurança**, sem transformar PRs simples em documentos excessivamente burocráticos.
