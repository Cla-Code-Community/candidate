# Greenhouse em cinco janelas

Manifesto greenhouse-v2: 3339 boards preservados do v1, sem remoções ou duplicações. A redistribuição preserva a ordem anterior e divide a sequência em 668/668/668/668/667.

| Grupo | America/Sao_Paulo | Adapters |
|---|---|---:|
| greenhouse-1 | 00h–01h | 668 |
| greenhouse-2 | 06h–07h | 668 |
| greenhouse-3 | 11h–12h | 668 |
| greenhouse-4 | 17h–18h | 668 |
| greenhouse-5 | 21h–22h | 667 |

As outras 17 janelas permanecem intactas, incluindo Jooble 20h–21h. 22h–00h permanece livre. O preset usa grupos fixos; chamadas manuais e configuração customizada mantêm o seletor anterior.

SCRAPER_GREENHOUSE_WINDOW_MAX_ADAPTERS tem padrão 680 e é independente do tamanho efetivo dos grupos. Um limite menor que algum grupo impede a execução, sem truncamento.

Migração: o hash canônico é fixado sob uma chave versionada greenhouse-v2 com fencing pelo lock global. O pin imutável v1 permanece preservado. Claims de ocorrência diários mantêm as mesmas chaves e TTL de 48h: uma ocorrência já consumida não é reexecutada com a nova versão. Não se reaproveita o checkpoint rotativo manual nos grupos fixos. Em uma troca no meio do dia, a cobertura integral da nova distribuição começa no dia seguinte; não se força replay das janelas anteriores. Nenhuma chave/dado existente é apagado.
