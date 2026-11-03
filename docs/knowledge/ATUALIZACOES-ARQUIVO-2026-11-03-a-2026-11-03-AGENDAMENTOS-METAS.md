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

## Reconciliação da base durante CI

Main avançou de093453c6 para1f155c6b com detalhes de Equipe Produtiva. O componente compartilhado TiltCard ganhou details opcional; ausência conserva título, children e retorno de foco anteriores. O call site de Agendamentos não passa essa opção. Merge de código automático; conflitos apenas em WORKLOG, CHANGELOG e índice do conhecimento preservaram ambos os registros. Table, Columns, comparação e regras de vencidos/metas desta entrega não mudaram. Proteção strict exige CI no novo head combinado. Reavaliada a dependência compartilhada, sem editar a outra página ou atualizar baselines.

Retomada observacional em2026-11-03T13:43Z após interrupção do acompanhamento:
headb2987970, origin/main1f155c6b, árvore antes do registro limpa. CI41639944217
com validate, imagem e restore aprovados e release-gates na matriz visual.
Health público HTTP200/ok ainda em f3c4f126. Fontes Git/gh/health reconferidas;
registro e sync locais não alteram o SHA candidato nem aprovam sua publicação.

Coordenação temporária: publicador do PR478/CAIXA informou janela de integração e publicação, após ciclos invalidados por main concorrente. Não abrir novos merges/deploys por esta frente até concluir essa janela. PR482 já está integrado em950dfb9a; verificar que a versão conjunta publicada é descendente desse SHA antes do smoke de Agendamentos. Não cancelar CI, criar locks artificiais ou dispensar gates. Esta nota registra coordenação, não concede autorização adicional nem altera regras permanentes.

## Encerramento comprovado — 03/11/2026

PR482: head b29879709c7e7fdc262c0ff19a0b845bfb073760, CI41639944217 com
quatro gates aprovados; merge950dfb9a01f7f972b2fa1e8fbf193e35b0315de4,
CI main41647058472 também aprovada. Versão conjunta com CAIXA
82ee8deb38b5c86f9781504f60c673ee69d9ab44 é descendente comprovada desse merge;
CI41654312258 passou nos quatro gates. Fontes: Git origin e GitHub Actions
do repositório contatoleandrolucass2-a11y/descomplica-crm, consultas03/11.

Publicação observada pelo coordenador release:production status:
deployment1d4c8ac7-f800-4513-ac2b-48ba4fd192a2, imagem
sha256:4aaa101b9e02da54ea2435095ce4a82543842d9396be3a1ea51be4b3ab5d3b0b,
2026-11-03T15:35:48.568Z (12:35:48.568 São Paulo), pendingDeploymentId null.
Health público200/ok na versão exata82ee8deb; rota protegida sem sessão307
para login. Janela coordenada encerrada. Esta frente não repetiu publicação,
não executou SQL, migration, ingestão ou mudança de permissões.

Smoke real após publicação, mesma conta no Chrome e integrado: outubro/House
136 registros gerais e84 vencidos, todos carregados simultaneamente. Vencidos
usam data prevista anterior ao dia atual SP03/11 e visitaNão. Rolagem até o fim
confirmada84/84. Exportador e textoPDF/CSV removidos. Contagem84 permanece
visível abaixo do título com ferramentas sobrepostas no topo. Meta semanal60
é caminho horizontal M0,24.308761910625037 H100; mensal20 corretores com
texto Meta de agendamentos. Os31 valores da média anual são inteiros;
dia05 é5. QA local anterior comprova tooltip numérico e9 combinações visuais.

Persistência real: cópia do gráfico alterada de500 para501px no integrado,
salvo automaticamente e reload dos dois preservaram501. Restauração500 e
movimento da posição15 para16 no Chrome apareceram no integrado após reload;
ordem original restaurada. Em390×844, card Visitas alterado194→195px e
posição5→6; Chrome atualizado confirmou195/posição6. Restaurado194/posição5
e reload dos dois confirmou igualdade dos32 IDs, ordens, larguras e alturas.
Tela844×390 após reload mantém o mesmo layout lógico, sem overflow horizontal;
390×844 também sem overflow. Override de viewport removido ao encerrar.
Celular é emulação responsiva, não aparelho físico; logout não repetido.

Discrepância inicial1px: DOM antes da publicação mostrava501 no gráfico,
mas leitura remota pontual comprovou500 salvo desde11:48:07.807218Z,
version414, anterior à baseline12:13Z, sem updateposterior. Origem do DOM501
não determinada. Teste explícito posterior501→reload→501 foi aprovado;
nenhuma normalização501→500 encontrada no canonicalizador de passo1px.
Timeout de comando no Chrome durante restauração foi conferido antes de
repetir: altura194 já aplicada; somente a ordem ainda pendente foi restaurada.

Artefatos reais locais ignorados pelo Git em test-results/appointments-metas-live:
layout-before.json, layout-final.json, chrome-vencidos-completo.jpg,
integrado-meta-semanal-completo.jpg, integrado-meta-mensal-completo.jpg,
celular-vertical-semanal.jpg e celular-horizontal-mensal.jpg. Capturas nativas,
sem exportar clientes/perfis ao GitHub ou Obsidian. Resultados locais sintéticos
continuam identificados separadamente. Sem alegar novos testes de logout,
reinício físico de navegador ou toque físico nesta rodada.

Registro final exclusivamente documental; aplicação funcional concluída.
Seção histórica própria candidato completo29/10 movida integralmente do índice
ao arquivo AGENDAMENTOS-ROLAGEM para recuperar limite de exportação256000bytes,
sem compressão ou descarte do conteúdo. Sincronizar após integrar este registro;
documentação não exige reinício nem novo deploy de runtime.
