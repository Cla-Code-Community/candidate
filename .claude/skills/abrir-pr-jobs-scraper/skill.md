---
name: abrir-pr-jobs-scraper
description: Use quando o usuario pedir para abrir PR, criar PR, enviar PR, submeter PR, fazer pull request, ou similar no projeto Jobs Scraper Global
---

# Abrir PR Padronizado — Jobs Scraper Global

Skill para criar Pull Requests padronizados no GitHub, integrando com o Linear para buscar dados da task.

## Pre-requisitos

Antes de iniciar, verifique se todas as ferramentas estao disponiveis:

| Ferramenta | Como verificar | Se ausente |
|---|---|---|
| MCP Linear | Checar se ferramentas `mcp__linear-server__*` estao disponiveis | Informar: "O MCP do Linear nao esta configurado. Adicione o server `linear-server` nas configuracoes do Claude Code." e parar |
| GitHub CLI | Rodar `gh --version` | Informar: "O GitHub CLI (gh) nao esta instalado. Instale com `brew install gh`." e parar |
| Git | Rodar `git --version` | Informar: "Git nao esta instalado." e parar |
| npm | Rodar `npm --version` | Informar: "npm nao esta instalado." e parar |

Se qualquer ferramenta estiver ausente, informe ao usuario qual esta faltando e **pare a execucao**.

## Fluxo

Siga os passos abaixo na ordem, sem pular etapas.

### Passo 0: Verificar pre-requisitos

Rode os comandos de verificacao da tabela acima. Se algum falhar, informe e pare.

### Passo 1: Identificar task Linear

1. Obter o nome da branch atual: `git branch --show-current`
2. Tentar extrair o padrao `PAV-\d+` (case insensitive) do nome da branch
3. **Se encontrou** um codigo PAV-XX:
   - Perguntar ao usuario: "A task desenvolvida foi a **PAV-XX**?"
   - Se confirmar, usar esse codigo
   - Se negar, perguntar qual e a task
4. **Se nao encontrou** padrao na branch:
   - Perguntar ao usuario: "Qual e o codigo da task no Linear? (ex: PAV-42)"

### Passo 2: Buscar dados da task no Linear

1. Usar `mcp__linear-server__get_issue` com o codigo da task
2. Extrair: **titulo** e **URL** da task
3. **Se a task nao for encontrada:**
   - Informar ao usuario
   - Sugerir: "Deseja criar uma nova task usando `/criar-task-linear`?"
   - Alternativamente, permitir continuar com titulo e descricao manuais

### Passo 3: Verificar commits

> **Importante:** Este projeto usa um modelo de fork. O remote `origin` aponta para o fork do
> desenvolvedor (ex: `jeremiassnts/Jobs_Scraper_Global`) e o remote `upstream` aponta para o
> repositorio principal (`Benevanio/Jobs_Scraper_Global`). O PR sempre deve ser criado do fork
> (origin) para o upstream, usando a flag `--head` do `gh pr create`.

1. Buscar os commits da branch que estao a frente de develop:
   ```bash
   git fetch upstream develop
   git log upstream/develop..HEAD --oneline
   ```
2. **Se nao houver commits a frente de develop:**
   - Informar: "Esta branch nao tem commits a frente de develop. Nao ha mudancas para abrir PR."
   - Parar a execucao
3. **Se ja existir um PR aberto para essa branch:**
   - Detectar o owner do fork: `gh repo view --json owner -q .owner.login` (rodado no diretorio do projeto, que aponta para origin)
   - Verificar com: `gh pr list --head <owner-do-fork>:$(git branch --show-current) --repo Benevanio/Jobs_Scraper_Global --state open`
   - Se existir, informar ao usuario e perguntar se quer atualizar o PR existente ou parar

### Passo 4: Rodar testes

1. Rodar testes do backend:
   ```bash
   cd backend && npm test 2>&1
   ```
2. Rodar testes do frontend:
   ```bash
   cd frontend && npm test 2>&1
   ```
3. Consolidar os resultados em uma string, ex:
   - Se todos passaram: "Testes unitarios passando — Backend: 305/305 | Frontend: 42/42"
   - Se houve falhas: "Backend: 300/305 (5 falhando) | Frontend: 42/42"
4. **Se testes falharem:** nao bloquear. Mostrar o resultado no preview — o usuario decide se prossegue.

### Passo 5: Gerar descricao do PR

1. Obter o diff completo contra develop:
   ```bash
   git diff upstream/develop..HEAD
   ```
2. Obter a lista de commits:
   ```bash
   git log upstream/develop..HEAD --oneline
   ```
3. Gerar um **resumo curto em linguagem natural** das mudancas:
   - Foco no que foi desenvolvido
   - Como as mudancas se relacionam com a task e o projeto
   - Texto conciso (3-5 frases no maximo)

### Passo 6: Montar e mostrar preview

> **Por que o formato importa:** o identificador `PAV-XX` no titulo e o link do Linear no corpo sao o que a integracao Linear ↔ GitHub usa para vincular o PR ao card e move-lo automaticamente (para **In Review** ao abrir o PR e para **Done** ao mergear). Nao remova o `PAV-XX` do titulo nem o link do Linear do corpo — sem eles, o card nao se move sozinho.

Montar o PR completo e mostrar ao usuario:

**Titulo:**
```
PAV-XX: <titulo da task no Linear>
```

**Target:**
```
Benevanio/Jobs_Scraper_Global (branch develop)
```

**Body:**
```markdown
## Descricao
<resumo gerado no passo 5>

## Linear link
<URL da task no Linear>

## Como foi testado
<resultado dos testes do passo 4>
```

Mostrar tudo formatado e perguntar: **"O PR esta correto? Confirma a criacao? (s/n)"**

### Passo 7: Confirmar ou editar

- **Se o usuario confirmar:** seguir para o passo 8
- **Se o usuario nao confirmar:**
  - Perguntar o que deseja alterar
  - Ajustar os campos conforme solicitado
  - Mostrar o preview novamente (voltar ao passo 6)

### Passo 8: Criar o PR

> **Modelo de fork:** O PR e criado do fork (origin) para o upstream (Benevanio/Jobs_Scraper_Global).
> E necessario usar `--head <owner-do-fork>:<branch>` para que o GitHub identifique corretamente
> a branch de origem no fork.

1. Verificar se a branch foi enviada ao remote (origin = fork):
   ```bash
   git ls-remote --heads origin $(git branch --show-current)
   ```
   - **Se a branch nao existe no remote:** perguntar ao usuario: "A branch ainda nao foi enviada ao remote. Deseja fazer push agora? (s/n)"
   - Se confirmar, rodar: `git push -u origin $(git branch --show-current)`
   - Se negar, parar a execucao
2. Detectar o owner do fork:
   ```bash
   FORK_OWNER=$(gh repo view --json owner -q .owner.login)
   ```
3. Criar o PR via GitHub CLI:
   ```bash
   gh pr create \
     --repo Benevanio/Jobs_Scraper_Global \
     --base develop \
     --head "$FORK_OWNER:$(git branch --show-current)" \
     --title "PAV-XX: <titulo>" \
     --body "<body completo>"
   ```
4. Confirmar ao usuario com o link do PR criado

## Erros comuns

- **Nao verificar pre-requisitos** — sempre verificar antes de iniciar
- **Nao confirmar a task com o usuario** — sempre perguntar, mesmo que a branch seja sugestiva
- **Criar PR sem preview** — sempre mostrar preview e aguardar confirmacao
- **Bloquear por causa de testes falhando** — mostrar as falhas, mas deixar o usuario decidir
- **Esquecer de buscar upstream/develop atualizado** — sempre rodar `git fetch upstream develop` antes de comparar
- **Nao usar --head no gh pr create** — como o projeto usa fork, e obrigatorio passar `--head <owner-do-fork>:<branch>` para o PR ser criado corretamente
