# Design: Skill abrir-pr-jobs-scraper

**Task:** [PAV-56](https://linear.app/tatame/issue/PAV-56/criar-skill-do-claude-code-para-abertura-de-prs-padronizados)
**Data:** 2026-06-17
**Abordagem:** Skill pura em Markdown (sem scripts auxiliares)

## Objetivo

Criar uma skill do Claude Code que automatiza a abertura de Pull Requests padronizados no GitHub, integrando com o Linear para buscar dados da task e garantindo consistencia no formato.

## Estrutura

Arquivo unico: `.claude/skills/abrir-pr-jobs-scraper/skill.md`

Frontmatter:
- `name: abrir-pr-jobs-scraper`
- `description`: acionada quando o usuario pedir para abrir PR, criar PR, enviar PR, submeter PR, ou similar

Segue o mesmo padrao da skill `criar-task-linear`.

## Pre-requisitos

A skill deve verificar antes de iniciar o fluxo:

| Ferramenta | Como verificar | Se ausente |
|---|---|---|
| MCP Linear | Checar se ferramentas `mcp__linear-server__*` estao disponiveis | Informar e parar |
| GitHub CLI (`gh`) | `gh --version` | Informar e parar |
| Git | `git --version` | Informar e parar |
| npm | `npm --version` | Informar e parar |

## Fluxo

```
0. Verificar pre-requisitos
   ├── MCP Linear disponivel?
   ├── gh instalado?
   ├── git disponivel?
   └── npm disponivel?
   → Se algum faltar, informar e parar

1. Identificar task Linear
   ├── Extrair padrao PAV-XX da branch atual (git branch --show-current)
   ├── Se encontrou → "A task desenvolvida foi a PAV-XX?" (confirmar)
   └── Se nao encontrou → perguntar qual e a task

2. Buscar dados da task no Linear
   └── mcp__linear-server__get_issue → titulo, URL

3. Rodar testes
   ├── Rodar testes do backend (cd backend && npm test)
   ├── Rodar testes do frontend (cd frontend && npm test)
   └── Consolidar resultado (ex: "Backend: 305/305 | Frontend: 42/42")

4. Gerar descricao do PR
   ├── Listar commits da branch vs develop (git log)
   ├── Analisar diffs (git diff origin/develop)
   └── Gerar resumo curto em linguagem natural, relacionando com a task e o projeto

5. Montar preview do PR
   ├── Titulo: "PAV-XX: <titulo da task no Linear>"
   ├── Descricao: template estruturado
   └── Mostrar tudo ao usuario formatado

6. Confirmar ou editar
   ├── Se confirma → criar PR
   └── Se nao → perguntar o que quer alterar, regenerar preview

7. Criar PR
   └── gh pr create --base develop --repo Benevanio/Jobs_Scraper_Global --title "..." --body "..."
```

## Template do PR

**Titulo:** `PAV-XX: <titulo da task no Linear>`

**Body:**

```markdown
## Descricao
<resumo curto em linguagem natural das mudancas, contextualizando com a task e o projeto>

## Linear link
<URL da issue no Linear>

## Como foi testado
<resultado consolidado dos testes, ex: "Testes unitarios passando — Backend: 305/305 | Frontend: 42/42">
```

O campo "Como foi testado" vem pre-preenchido com o resultado dos testes, mas o usuario pode editar no preview.

## Tratamento de erros

| Cenario | Comportamento |
|---|---|
| Task nao encontrada no Linear | Informar ao usuario. Sugerir criar uma nova task via `/criar-task-linear`. Alternativamente, permitir continuar com titulo e descricao manuais |
| Testes falhando | Mostrar resultado com falhas no preview. Nao bloquear — usuario decide se prossegue |
| Branch sem commits a frente de develop | Informar que nao ha mudancas e parar |
| PR ja existe para essa branch | Informar e perguntar se quer atualizar o existente ou parar |
| Remote/repo inacessivel | Informar e parar |

## Target do PR

O PR e sempre criado contra o repositorio `Benevanio/Jobs_Scraper_Global` na branch `develop`, usando `gh pr create --repo Benevanio/Jobs_Scraper_Global --base develop`.

## Decisoes de design

- **Deteccao de task:** Tenta extrair PAV-XX da branch, mas sempre confirma com o usuario. Se a branch nao e sugestiva, pergunta diretamente.
- **Descricao automatica:** Resumo em linguagem natural gerado pelo Claude a partir dos commits/diffs — texto curto focado no que foi desenvolvido e como se relaciona com a task.
- **Testes:** Roda backend e frontend automaticamente, preenche o campo, mas usuario pode editar no preview.
- **Sem scripts auxiliares:** Toda a logica e executada pelo Claude usando ferramentas disponiveis (MCP, Bash).
- **Target fixo:** Sempre `Benevanio/Jobs_Scraper_Global` branch `develop`.
