# abrir-pr-jobs-scraper Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude Code skill that automates standardized PR creation on GitHub, integrating with Linear for task data.

**Architecture:** Single Markdown skill file at `.claude/skills/abrir-pr-jobs-scraper/skill.md` following the same pattern as the existing `criar-task-linear` skill. The skill contains instructions that Claude follows step-by-step using available tools (MCP Linear, Bash with `gh`/`git`/`npm`).

**Tech Stack:** Claude Code skill (Markdown), GitHub CLI (`gh`), Linear MCP, Git, npm

## Global Constraints

- Skill file follows the exact frontmatter + Markdown pattern of `.claude/skills/criar-task-linear/skill.md`
- All text in the skill file must be in Portuguese (matching the existing skill)
- PR target is always `Benevanio/Jobs_Scraper_Global` branch `develop`
- AGENTS.md rule: never auto-commit — always ask the user before committing

---

### Task 1: Create the skill file

**Files:**
- Create: `.claude/skills/abrir-pr-jobs-scraper/skill.md`

**Interfaces:**
- Consumes: Pattern from existing `.claude/skills/criar-task-linear/skill.md`
- Produces: Fully functional skill invocable as `/abrir-pr-jobs-scraper`

- [ ] **Step 1: Create the skill file with frontmatter and pre-requisites section**

Create `.claude/skills/abrir-pr-jobs-scraper/skill.md` with the following content:

```markdown
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

1. Buscar os commits da branch que estao a frente de develop:
   ```bash
   git fetch origin develop
   git log origin/develop..HEAD --oneline
   ```
2. **Se nao houver commits a frente de develop:**
   - Informar: "Esta branch nao tem commits a frente de develop. Nao ha mudancas para abrir PR."
   - Parar a execucao
3. **Se ja existir um PR aberto para essa branch:**
   - Verificar com: `gh pr list --head $(git branch --show-current) --repo Benevanio/Jobs_Scraper_Global --state open`
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
   git diff origin/develop..HEAD
   ```
2. Obter a lista de commits:
   ```bash
   git log origin/develop..HEAD --oneline
   ```
3. Gerar um **resumo curto em linguagem natural** das mudancas:
   - Foco no que foi desenvolvido
   - Como as mudancas se relacionam com a task e o projeto
   - Texto conciso (3-5 frases no maximo)

### Passo 6: Montar e mostrar preview

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

1. Criar o PR via GitHub CLI:
   ```bash
   gh pr create \
     --repo Benevanio/Jobs_Scraper_Global \
     --base develop \
     --title "PAV-XX: <titulo>" \
     --body "<body completo>"
   ```
2. Confirmar ao usuario com o link do PR criado

## Erros comuns

- **Nao verificar pre-requisitos** — sempre verificar antes de iniciar
- **Nao confirmar a task com o usuario** — sempre perguntar, mesmo que a branch seja sugestiva
- **Criar PR sem preview** — sempre mostrar preview e aguardar confirmacao
- **Bloquear por causa de testes falhando** — mostrar as falhas, mas deixar o usuario decidir
- **Esquecer de buscar origin/develop atualizado** — sempre rodar `git fetch origin develop` antes de comparar
```

- [ ] **Step 2: Verify the skill is discoverable**

Run: invoke the skill to confirm Claude Code recognizes it:
```
/abrir-pr-jobs-scraper
```
Expected: The skill content is loaded and Claude begins following the instructions (starting with pre-requisite checks). Cancel after confirming it's recognized — no need to create an actual PR.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/abrir-pr-jobs-scraper/skill.md
git commit -m "feat(pav-56): criar skill abrir-pr-jobs-scraper para PRs padronizados"
```

---

### Task 2: Register skill in settings description

**Files:**
- Check: `.claude/settings.local.json` (no changes expected)

**Interfaces:**
- Consumes: Skill file from Task 1
- Produces: Confirmation that skill appears in available skills list

The skill should be auto-discovered from `.claude/skills/`. This task verifies that by checking the skills list shown in system-reminder messages.

- [ ] **Step 1: Verify skill appears in available skills**

Start a new Claude Code conversation and check that `abrir-pr-jobs-scraper` appears in the system-reminder skills list. No file changes needed — skills in `.claude/skills/` are auto-discovered.

- [ ] **Step 2: Test the full flow (dry run)**

Invoke `/abrir-pr-jobs-scraper` and walk through the full flow on the current branch:
1. Confirm pre-requisites are checked
2. Confirm task detection works (extracts PAV-XX from branch name)
3. Confirm Linear integration fetches task data
4. Confirm tests are run for both backend and frontend
5. Confirm description is generated from commits/diffs
6. Confirm preview is shown with correct format
7. Cancel at the confirmation step (do not actually create the PR)

Expected: All steps execute correctly up to the confirmation prompt.

- [ ] **Step 3: Commit spec and plan docs**

```bash
git add docs/superpowers/specs/2026-06-17-abrir-pr-padronizado-design.md docs/superpowers/plans/2026-06-17-abrir-pr-jobs-scraper.md
git commit -m "docs(pav-56): adicionar spec e plano de implementacao da skill abrir-pr"
```
