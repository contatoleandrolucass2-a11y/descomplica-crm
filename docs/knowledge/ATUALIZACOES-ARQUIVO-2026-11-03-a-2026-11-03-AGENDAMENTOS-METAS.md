# 2026-11-03 — Agendamentos: metas, média inteira e vencidos

## Abertura e retomada

Conferência em 2026-11-03T12:07Z. Git comum confirmado, árvore limpa na retomada,
base atualizada de d83c9497 para origin/main093453c68c05f3303ecf1f75a5e694707b8dbd5d.
PR474 integrado em d83c949707bb92a367db26210d3c870bf93d042f; CI41575950480 terminou
success após repetir somente release-gates, cujo primeiro início do Supabase
isolado falhou. Main atual documental: CI41592078541 success. Runtime observado
por GET público https://crm.descomplicapro.com.br/api/health: HTTP200/statusok,
versionf3c4f126990ee634531d30c653403d66d44a4c7f; CI41585221159 success.
Git confirma que d83c9497 é ancestral da versão publicada, portanto PR474 já
está incorporado. Não republicar o candidato antigo. Fontes: Git origin/main,
GitHub via gh, health público. Contexto e busca temática de conhecimento lidos;
notas anteriores são contexto, não ampliam autorização.

Escopo solicitado: média do comparativo arredondada para cima, referência
semanal constante igual à maior soma semanal do mês, meta mensal igual ao
cadastro de corretores, rótulo de meta, remoção do bloco informativo/exportação
da tabela, contagem legível durante hover e diagnóstico/correção dos vencidos
sem visita. Preservar permissões, dimensões, ordem e filtros dos cards.
Validar em conjunto, publicar após gates e sincronizar resultados. Nenhuma
migration remota nova autorizada nesta etapa. Controle visual bloqueado no
turno anterior será tentado novamente pelo mecanismo documentado, sem
contornar verificações de segurança, login ou permissões.

## Implementação e evidências focadas

Causa do zero comprovada: attendedAt vem de Activity.Data_de_comparecimento\_\_c
(visita real); scheduledAt vem de Activity.ActivityDateTime (previsão). Leitura
remota somente agregada no projeto confirmado hnncxuerlcsaahdxoswb encontrou731
registros House sem visita, todos com scheduledAt e nenhum com attendedAt.
Outubro/House:136 registros;84 vencidos usando hoje-SP03/11, contra74 usando a
referência antiga do snapshot01/11. A correção usa query.calendarDate atual
fornecida pelo servidor da página e conserva filtros, autorização e snapshot.
Não altera ingestão, banco, ACL/RLS ou dados comerciais. A data prevista é
mostrada somente na tabela de vencidos; a geral conserva a data real.

weeklyTarget calcula a maior soma semanal do mês nos loops de dimensões já
existentes, sem segunda análise integral. Equipe/canal/empresa/ranking/mês
recalculam a referência; selecionar dia/semana/período não reduz o alvo mensal
de referência semanal. Mensal usa goalBrokerCount; o velocímetro e metas
comerciais cadastradas permanecem os mesmos. Média anual usa Math.ceil antes
da apresentação; null continua indisponível e não vira zero.

Contagem da tabela fica abaixo do título, com espaço para controles flutuantes;
mensagem de sucesso PDF/CSV e botão de exportar retirados conforme pedido.
Estados de carga/erro/atualização continuam recuperáveis. A API de exportação
permanece compatível e coberta por testes; não há paginação visual.

Node24.19/Vitest4.1.11:48 testes de comparativo/referência,80 de dados/controller/
actions/weeklyTarget e17 de UI/resumo/SSR aprovados. Asserções novas de null
em fixtures exigiram anotação no tipo do domínio; typecheck global e15 testes
overdue/actions repetidos passaram. Lint focado e formatação aprovados.
Caso existente de20mil registros usa timeout15s somente na CLI local Windows;
pipeline não teve timeout/asserts/baselines alterados. Navegador sintético
de detalhes aprovado:136 linhas simultâneas, scroll até última, filtros rápidos,
drag/resize/cópia sem consulta adicional, ausência de exportador e paginação,
sem erros JS ou requests externos. Artefato local test-results/appointments-detail.

Preflight real via controle documentado: Chrome e integrado acessíveis na mesma
conta;32 IDs, larguras, alturas e ordem idênticos. Baseline sanitizada em
test-results/appointments-metas-live/layout-before.json, fora do Git, sem
identificador de conta. QA visual, CI do candidato, integração/publicação e
prints pós-publicação ainda não são alegados por esta nota.

QA integrado final:9/9 cenários, três temas em1440×1000,390×844 e844×390.
Dados/transporte/perfis sintéticos locais, componentes e CSS reais. Meta
semanal96 permanece ao selecionar semana40; mensal2 corretores; média/tooltip
inteiro5. Tabelas136 gerais e84 vencidos têm scroll até o fim, data prevista,
contagem visível no hover sem interseção com a barra inteira, sem paginação,
bloco PDF/CSV ou exportador visível. Sem overflow do documento, erros JS ou
requests externos. Script tests/appointments-metas.browser.mjs; result.json e
12 imagens prefixadas sintetico- em test-results/appointments-metas. Imagens
locais inspecionadas pelo coordenador. São evidências sintéticas, não prints
do site publicado. Gates da CI e smoke real continuam etapas posteriores.
