# Taxonomia profissional do Candidate — v1

A fonte canônica é `scraper-go/internal/taxonomy/families.json`. Go incorpora esse artefato no binário; não lê arquivos da taxonomia em produção. O backend mantém um contrato TypeScript equivalente em `backend/src/modules/jobs/types/professionalTaxonomy.ts`. Os testes comparam IDs, labels, ordem e versão; o backend compara também os aliases históricos. Alterações futuras devem atualizar os dois contratos e passar os testes de sincronização. Essa solução mantém os builds Docker atuais, sem geração de código ou dependência runtime entre os serviços.

## IDs e apresentação

Há exatamente 13 famílias públicas, nesta ordem estável. Labels são apresentação; IDs são contrato e não devem ser renomeados.

| ID | Label |
| --- | --- |
| backend | Backend |
| frontend | Frontend |
| fullstack | Full Stack |
| mobile | Mobile |
| data | Dados e IA |
| devops | DevOps |
| platform | Plataforma e Cloud |
| qa | QA e Testes |
| security | Segurança |
| product | Produto |
| product_design | Design de Produto |
| software | Engenharia de Software |
| leadership | Liderança Técnica |

Fullstack é uma especialidade própria; devops e platform são distintos. Software representa engenharia generalista, leadership representa liderança técnica. Produto e Design de Produto são famílias distintas.

## Contrato e versionamento

`primaryFamily` contém no máximo um ID canônico ou o diagnóstico interno `other`. `relatedFamilies` contém zero ou mais IDs públicos, sem duplicatas nem repetição da principal, na ordem canônica acima. Lista vazia é válida. No JSON Go, `relatedFamilies` vazio continua omitido por `omitempty`; o backend aceita ausência/null e normaliza para `[]`. Os nomes e tipos serializados existentes não mudam.

`taxonomyVersion = "v1"` identifica IDs, labels e regras aqui descritos. No Go, a versão é acessível por `taxonomy.Version()` e `classifier.TaxonomyVersion()`; no backend, pela constante `taxonomyVersion`. Não há novo campo persistido. Essa metadata identifica a implementação executando; não atribui retroativamente uma versão a registros históricos.

## Classificação, precedência e desempate

O classificador mantém os termos existentes e o fallback por texto/tecnologias quando não há evidência forte no título. Quando o título reconhece uma família técnica, sua pontuação de título é usada na escolha principal: descrições conflitantes não eliminam nem substituem essa evidência. Descrição ainda pode fornecer tecnologias, senioridade e famílias relacionadas. Isso pode alterar confidence/relatedFamilies em comparação com classificações anteriores; não há promessa de scores históricos idênticos.

A escolha ordena por prioridade, pontuação decrescente e ID em ordem lexical, nesta sequência. Prioridades: product_design (6), product (5), liderança técnica explícita (4), família técnica com termo forte no título (3), fallback (0). Produto e Design exigem título e conservam as exclusões e o complemento limitado da PAV-122. A razão registra o termo do título; o fallback mantém sua razão genérica. Mapas não participam do desempate.

Exemplos obrigatórios:

- Product Designer → product_design; Product Manager → product.
- Product Security Engineer → security; Product Data Engineer → data.
- Engineering Manager Backend → leadership; relacionadas `[backend]` para esse título sem evidência adicional.
- Full Stack Engineer → fullstack; relacionadas `[backend, frontend]` para esse título sem evidência adicional.
- Platform DevOps Engineer → devops: `devops` é um termo direto, enquanto `platform engineer` não é uma frase contígua nesse título.
- Platform Engineer / DevOps Engineer → devops em empate de pontos/prioridade pelo desempate lexical; ambas as famílias continuam disponíveis.
- Backend/Frontend/Mobile/Platform/DevOps/QA/Security Engineer → respectiva família; Software Engineer → software; Engineering Manager → leadership.

## Diagnóstico e valores desconhecidos

`other` não integra a lista pública, não recebe label público e não é indexado como família profissional. Nunca é convertido automaticamente para software. Continua disponível para rejeição e diagnóstico; não deve ser oferecido como opção normal de filtro. Esta task não altera parsers ou filtros existentes.

Validação pública é estrita e exige ID canônico lowercase. Na compatibilidade de leitura, normalização aplica trim/lowercase e somente os aliases comprovados abaixo. Labels não são aceitos genericamente como IDs. Valor desconhecido/vazio produz ausência no helper de normalização; a hidratação backend representa a principal desconhecida como `other`, com `inScope=false`, preservando os demais campos diagnósticos. Relacionadas desconhecidas ou `other` são removidas. Nenhuma normalização escreve no Valkey.

## Compatibilidade histórica e auditoria

O Go da PAV-122 já emitia os 13 IDs lowercase, mas não havia contrato compartilhado, labels ou versão. Suas relacionadas eram deduplicadas na ordem de pontuação. O backend aceitava strings livres e hidratava JSON sem normalizar; o seed continha Backend, Frontend, Fullstack, Dados e Infraestrutura.

Casing de IDs existentes é normalizado. Os únicos aliases adicionais comprovados pelo seed são `dados → data` e `infraestrutura → devops`. Infraestrutura identifica os cargos de infraestrutura do seed; não é uma conversão genérica de toda vaga de plataforma. Novos seeds escrevem IDs canônicos. Labels como Full Stack ou Plataforma e Cloud não são aliases implícitos.

Duplicatas, principal repetida nas relacionadas, valores vazios e desconhecidos são tratados na leitura. Não foi acessado catálogo de produção e não se afirma ausência desses casos nos dados reais. Não é necessária migration destrutiva: IDs canônicos foram preservados e os contratos existentes continuam legíveis. Registros antigos não são reclassificados automaticamente; aplicar novas precedências ao catálogo histórico exige uma operação de reconciliação separada.

## Índices, limites e validação

Nenhum índice de nova família é criado. A exclusão de índices product/product_design da PAV-122 permanece; índices técnicos existentes continuam funcionando. Valores desconhecidos/other não emitem índices profissionais. Cache keys, match score, filtros, frontend e front_admin permanecem fora deste contrato.

O processamento não adiciona I/O, workers, filas ou locks. Stable IDs, deduplicação e ownership de contexto permanecem inalterados. A taxonomia tem tamanho fixo e normalização determinística.

Validação: `go test ./...`, `go test -race ./...`, `go vet ./...`, testes backend de taxonomia, cache/hidratação, busca, filtros e seed, e `git diff --check`. O teste backend é descoberto pelo target oficial Vitest/coverage da CI. A CI atual não executa Go; testes Go são obrigatórios localmente, e institucionalizá-los na CI permanece uma dívida separada.
