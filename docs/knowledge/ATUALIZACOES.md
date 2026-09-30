# Aprendizados e atualizacoes

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-09-30: Dez linhas e cabecalho compacto

- Evidencia: CI 36758571149 aprovou gates funcionais, 40 navegacoes, 193 axe e
  100 zoom. Revisa/promove 44 capturas e preserva as demais 149/thresholds.
  Preview final 40/40; Next 16.3.6 com lint/tipos/build/audit aprovados.
  CI das referencias e publicacao ainda pendentes.
- CI 36757589260 bloqueou Next 16.3.3 por advisory critico atualizado em 30/09;
  patch oficial 16.3.6. Revalidar deps mesmo quando o commit anterior passou.
- matchMedia pode receber change apos o browser desfocar o controle oculto.
  Menu preserva ultimo foco interno, limpando referencia ao interagir fora.
- Status: pendente_validacao; branch codex/compactacao-associativo.
- Fonte: quatro capturas e pedido direto do usuario; auditoria de compactacao.
- Dez unidades visiveis significa viewport limitado, sem truncar estoque.
  Alinhar alturas CSS e passo virtual: 26px desktop, 48px ate 760px.
- Dourado reservado ao hover/foco da linha selecionavel; preservar temas azuis
  e fundo Escuro original. Temas sem caixas e com indicador textual de selecao.
- Cabecalho compartilhado compacto; titulo reduzido apenas no Associativo.
- Lint/tipos/build passaram; Windows com seis falhas POSIX e um timeout DevTools.
  Reteste isolado DevTools passou. QA integrado e publicacao pendentes.
  Sem alteracao financeira; aguardar transicoes CSS antes de conferir cores.

## 2026-09-30: Correcao azul publicada e confirmada

- Status: validado; runtime b55fa6fc95eb26087c70736d618bf019818c5876.
- Fonte: PR #112, CI main 36734239866 aprovada, health publico e navegador
  autenticado; docs/audits/cores-azuis-2026-09-30.md.
- Nos tres temas, marca, destaques e positivos sao azuis. Escuro preserva a
  pagina #061f35 e o cabecalho #071a31. Nao redesenhar essa base sem novo pedido.
- Imagem imutavel comprovada, dois perfis aprovados, backup/CAS/rollback
  preservados. Nenhuma mudanca de formulas, dados, banco, contas ou n8n.
- Navegador confirmou os tres temas e estoque carregado; zero erros de console
  observados. Smoke de doze GETs e quatro concorrentes passou, sem prova de carga.
- Conhecimento final documental; nao reiniciar o runtime ao integrar esse registro.

## 2026-09-30: Preservar o azul-marinho; retirar verdes

- Status: pendente_validacao; branch codex/temas-azul-original.
- Fonte: correcao direta do usuario e paleta anterior no commit 96410f9.
- Preferencia explicita: nao substituir a base azul-marinho do modo escuro.
  Nos tres temas, destaques e estados antes verdes devem ser azuis.
- Correcao restrita aos tokens dos quatro simuladores e cabecalho compartilhado,
  sem novo redesign nem alteracao financeira. Erros e avisos seguem distinguiveis.
- Testes de contrato protegem fundos originais, paleta azul e contraste.
- Evidencia: docs/audits/cores-azuis-2026-09-30.md; lint/tipos/build locais e
  preview 40/40 aprovados. Timeouts DevTools passaram no reteste isolado.
  Seis testes POSIX exigem Linux; validate e restore da CI 36726351781 passaram.
  Matriz: 40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
  Revisa e promove 44 referencias afetadas; preserva as demais 149 e limites.
  CI integrada das referencias e publicacao pendentes.
- A promocao canonica pode gerar JSON fora do estilo Prettier: formatar o
  manifesto e executar seus contratos antes do push. CI 36730344413 mostrou
  essa diferenca de formatacao; nao alterar evidencias para corrigi-la.

## 2026-09-30: Identidade publicada na web

- Status: validado; runtime 2c002df10fa2777165fec5b96f707ed971422e74.
- Fonte: PRs #109/#110, CI main 36667629540 aprovada, health publico e navegador
  autenticado em crm.descomplicapro.com.br; auditoria de identidade versionada.
- Imagem imutavel conferida por checksum, config, manifesto e onze camadas;
  dois perfis de runtime aprovados. Backup privado, CAS e rollback preservados.
- Marca sem Inteligencia comercial; Claro/Medio/Escuro, menu/Escape e estoque
  confirmados no Associativo publicado, sem erros de console observados.
- Smoke anonimo somente leitura: doze GETs com concorrencia quatro, health 200
  na nova versao, inventory/snapshot 401 e no-store, zero falhas.
- Limites: nao houve benchmark de capacidade nem mutacao de propostas/dados.
  Navegacao nas quatro rotas, temas, acessibilidade e zoom validados na CI.
- Atualizacoes deste registro sao documentais; nao reiniciar a aplicacao por elas.

## 2026-09-30: Auditoria pode mudar entre PR e main

- Status: pendente_validacao; branch codex/correcao-auditoria-identidade.
- Fonte: CI PR 36662908716 aprovada; merge 83f1b2f; CI main 36664719186 bloqueada
  por brace-expansion. Advisories GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p e
  GHSA-q2hr-2g5m-vwhr consultados na base oficial GitHub em 2026-09-30.
- Atualiza somente as duas resolucoes para 1.1.21 e 5.0.12. Instalacao frozen
  e politica supply-chain aprovadas; audit passou sem vulnerabilidades conhecidas.
- A CI do PR nao dispensa a CI do SHA final. Nao ignorar auditoria nem publicar
  imagem antiga quando um novo advisory aparecer. Producao permanece inalterada.
- Reteste local: lint, tipos e build aprovados; 987 testes passaram, um skip
  e seis falhas POSIX preexistentes no Windows. Nao alterar essas assercoes.
- Pendente: CI Linux integrada, imagem imutavel e publicacao.

## 2026-09-30: Validacao da identidade e referencias

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: CI 36660701681, captura e985f6791de4dfd5681cc47429a6d5f06bc61d25,
  docs/audits/identidade-navegacao-2026-09-29.md e authenticated-results.json.
- Linux, banco, advisors, restore e E2E aprovados. Navegacao 40/40,
  acessibilidade 193 e zoom 100 aprovados; somente 44 diffs visuais previstos.
- Capturas inspecionadas apos corrigir temas/tablet e filtros/mobile;
  44 referencias promovidas, outras 149 preservadas, sem afrouxar thresholds.
- Reteste local: 63 testes focados e preview 40/40 com cookies reais;
  revisao estatica independente sem novos achados. Preview usa dados sinteticos.
- Pendente: CI integrada das referencias, merge e publicacao com imagem imutavel.

## 2026-09-29: Identidade e navegacao dos simuladores

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: ArchiveHeader.tsx, SiteMenu.tsx, ThemeSwitch.tsx e auditoria de identidade.
- Cabecalho compartilhado substitui quatro copias de marca; remove subtitulo.
- Navegacao compacta usa estado independente dos popovers para que abrir
  um submenu nao feche o pai. Escape fecha um nivel por vez e restaura foco.
- Em accordion, fechar no pointerdown pode deslocar o proximo acionador antes
  do click. Fronteira de dismiss compartilhada preserva o gesto e a exclusao
  mutua; nao alterar globalmente todos os popovers por esse caso.
- Temas permanecem visiveis e so persistem com consentimento funcional.
- CSS legado fixava cores escuras nos simuladores; trocar apenas data-theme
  nao comprova aplicacao visual do tema. Validar tambem conteudo e controles.
- Primeira rodada: tipos/build aprovados, 57 contratos das tabelas aprovados;
  22 testes Obsidian passaram isolados apos dois timeouts por concorrencia.
- Preview: 40 combinacoes de rota/largura e tres temas do cabecalho aprovados.
  CI Linux 36650605575 passou validacao, banco, restore e E2E autenticado;
  matriz parou em sete checks de navegacao (seis cores durante transicao e
  um timeout de clique). Gate agora espera a cor final e guarda diagnostico
  incremental. Nova matriz/publicacao pendentes; nenhuma baseline promovida.
  Preview completo posterior: 40/40, tres temas e zero erros de navegador,
  incluindo Direta/320. Fonte: test-results/identity-full-preview.json local.
  Sem alteracao financeira.
- CI 36653241052: navegacao 39/40; atalho global de cookies interceptava clique
  na Direta/320. Camadas corrigidas para atalho < navegacao < painel de cookies.
  Seis testes do gate aprovados; CUA confirmou troca de submenu e abertura/
  fechamento de preferencias com o componente real no preview. CI final pendente.
- CI 36655323860 aprovou 40 navegacoes, 193 auditorias de acessibilidade e 100
  cenarios de zoom; diferencas visuais limitadas a 44 capturas dos simuladores.
  Inspecao manual identificou largura legada de 44 px nos temas/tablet e colisao
  de Limpar filtros na Direta/mobile. Correcoes e checks geometricos adicionados;
  nao promover capturas anteriores com esses defeitos. Nova CI obrigatoria.

## 2026-09-29: Colunas compactas e celulas repetidas do Tabelao

- Status: validacao local concluida; CI/publicacao pendentes; branch codex/tabelao-colunas-compactas.
- Fonte: TabelaoClient.tsx, investor-archive.css e tabelao-inventory.mjs.
- Textos de empreendimento, endereco e limitador passam a quebrar em larguras
  delimitadas. O min-width da tabela nao deve redistribuir espaco excedente.
- Mesclar rotulos consecutivos somente depois de agrupar por empreendimento e
  incorporadora. Nao excluir plantas nem unir A/B/A atraves de um valor distinto.
- Testes focados iniciais: 62 aprovados. Lint, tipos, build e Gitleaks aprovados.
  Suite Windows: 978 aprovados, quatro skips e seis falhas POSIX preexistentes;
  oito testes Node aprovados. Navegador sintetico local passou em sete cenarios,
  revisao independente sem achados; 75 testes focados finais aprovados.
  CI 36526268323: 984 testes Linux, matriz funcional/acessibilidade e restore
  aprovados. Sete referencias do Tabelao inspecionadas e atualizadas, com
  proveniencia por imagem; outras 186 preservadas. Nova CI e publicacao pendentes.
  Evidencias: docs/audits/tabelao-colunas-2026-09-29.md.

## 2026-09-29: Cabecalho compacto do Associativo

- Status: validacao local e inspecao visual concluidas; nova CI integrada e publicacao pendentes.
- Fonte: AssociativeTableArchive.tsx e investor-archive.css.
- Remove somente a trilha e o rotulo redundantes do topo; preserva H1, ajuda e guia.
- Espacamento reduzido fica limitado a investor-associative-table-page.
- Captura autenticada da CI 36520154289 validou navegacao, acessibilidade,
  teclado, zoom e responsividade; onze referencias exclusivas do Associativo
  foram inspecionadas e promovidas.
- O teste do catalogo passa a reconhecer as vinte verificacoes do Tabelao que
  o capturador atual ja executava; nenhuma referencia visual do Tabelao mudou.
- Teste especifico, lint, tipos, inventario e build aprovados. Suite Windows:
  972 aprovados, um skip e seis falhas POSIX preexistentes; nova CI Linux exigida.

## 2026-09-28: Tabelao e indisponibilidade concorrente

- Status: validacao local concluida com limitacao POSIX; branch codex/tabelao-concorrencia.
- Fonte: app/api/inventory e snapshot; TabelaoClient; tabelao-payload.ts;
  docs/audits/tabelao-concorrencia-2026-09-28.md.
- Deduplicar somente promessas em andamento nao contem consultas sucessivas
  quando a origem falha rapidamente. O intervalo de cinco segundos deve comecar
  na falha compartilhada, sem ser prolongado por cada novo acesso.
- Cada acesso continua autorizado antes do cache ou erro compartilhado; nunca
  reutilizar sessao nem devolver estoque vencido como recuperacao.
- Deadline da pagina inclui leitura do corpo; cancelamento de uma pagina nao
  pode cancelar a consulta compartilhada de outros usuarios no servidor.
- Lint, tipos, build e formatacao aprovados. Windows: 967 testes aprovados,
  quatro skips condicionais e seis falhas POSIX preexistentes. Endpoints:
  92 testes aprovados; payload exercita trinta consultas isoladas. Gitleaks
  passou. Gates Linux, navegador e publicacao pendentes; consultar auditoria/PR.

## 2026-09-28: Conteudo e ajudas do Associativo

- Status: pendente_validacao integrada/publicacao. Base publicada: b297614.
- Fonte: associative-learning-content.ts, InvestorCalculator e auditoria
  docs/audits/associativo-manual-conteudo-2026-09-28.md; referencias oficiais nela.
- Perfil e manual compartilham tres ajudas. Guia possui 27 topicos e seus locais.
- Indicador "Maximo da renda por anual" exclui a anual mesmo quando o total
  da mesma linha mensal a inclui. Descrever exatamente o indicador, nao como
  comprometimento global de todas as despesas da familia.
- Motor local e WF13 versionado nao sao equivalentes. Perfil/documentacao usam
  bases diferentes e podem divergir de modalidade perto dos limites. Explicar
  essas limitacoes; nao alterar calculos em pedido exclusivamente editorial.
- ITBI e registro sao estimativas locais; primeiro imovel declarado nao e prova
  de primeira aquisicao nem garantia de isencao. Exigir conferencia oficial.
- Testes: 145 de dominio e cinco do manual aprovados. Suite Windows: 950 pass,
  um skip, seis falhas POSIX preexistentes. CI Linux e QA final ainda exigidos.
- Lint, tipos, build, oito testes Node e QA isolado (30 capturas/axe) aprovados.
  Matriz integrada deve confirmar o mesmo comportamento no build autenticado.
- Evidencias finais de CI e release devem ficar no PR da branch
  codex/associativo-manual-conteudo, sem inferir publicacao deste checkpoint.

## 2026-09-28: Manual Associativo com abas acessiveis

- Atualizar uma imagem revisada exige atualizar seu tamanho/hash no catalogo
  authenticated-results.json. Registrar origem por baselineRevision e manter
  delta anterior real; o teste de integridade nao deve ser enfraquecido.

- Status: comportamento validado na CI 36486887891; referencia visual atualizada
  para o menu corrigido. Evidencias finais de CI/publicacao: PR #104.
- Fonte: AssociativeLearningManual.tsx/module.css; InvestorCalculator;
  docs/audits/associativo-manual-2026-09-28.md.
- Isolar a moldura interativa do manual preserva textos e os outros simuladores.
  Manter abas e fechar fora da area rolavel evita perder a navegacao em celular.
- Ancoras policy/faq sao preservadas quando o componente esta montado; a
  selecao da unidade continua sendo previa aos recursos finais da simulacao.
- Testes: tres unitarios novos aprovados; lint, tipos e build locais aprovados.
  Windows: 948 pass, um skip e seis falhas POSIX preexistentes. CI Linux exigida.
- Matriz acrescentada: cinco viewports, tres temas, ambos os paineis,
  teclado, foco, ancoras, axe, geometria e capturas. Evidencias em test-results.
  Rodada local isolada do componente passou com 30 capturas e zero violacoes
  axe; oito testes Node tambem passaram. Sem dados ou credenciais de producao.
- Sem alteracao de calculos, politica comercial, backend, migrations ou n8n.
- QA deve aguardar o evento nativo close para validar efeitos posteriores ao
  fechamento; hidden/foco podem ocorrer antes da limpeza da ancora.
- O manifesto Next carrega CSS legado apos o modulo: regras de titulo/foco
  precisam de especificidade suficiente, nao apenas da ordem dos imports.
- Tema intermediario no SiteMenu do arquivo chama-se Medio; no shell geral,
  Equilibrado. A matriz do manual usa o controle local, preservando a proposta.
- CI 36483450994 identificou corte preexistente do menu em 1024px; reproduzido
  no navegador publicado. Cabecalho Associativo passa a duas linhas entre
  821 e 1100px, sem alterar os demais simuladores. QA mede o seletor de tema;
  referencia de 1024px requer atualizacao visual justificada, sem relaxar gates.
- CI 36486887891: 30 capturas/axe do manual aprovadas; matriz funcional inteira
  aprovada. Unica divergencia foi a imagem 1024x768 do cabecalho corrigido,
  inspecionada e atualizada com hashes/proveniencia no relatorio. Demais 192
  comparacoes preservadas; nova CI confirma a referencia. Consultar evidencias
  do PR #104 para o estado final, nao inferir deploy deste checkpoint.

## 2026-09-28: Associativo, estoque e publicacao automatica

- Status: validado; PR #102 integrado e release 3d92b7a publicada em 15:01 UTC.
- Fonte: docs/audits/associativo-concorrencia-2026-09-28.md; rotas inventory;
  calculator-rules, approval-rules, installment-memory e testes de concorrencia.
- HTTP 200 nao comprova corpo recebido: duas aberturas falharam com transferencias
  parciais e timeout de 25 segundos. Compressao so nas duas rotas autorizadas.
- Identidade ausente/duplicada nao deve enriquecer valores financeiros.
  Validar payload antes do cache e cada usuario antes de compartilhar resposta.
- Validar parcelas antes de alocacao; calendario estrito, indices anuais reais
  e comparacao monetaria em centavos, inclusive painel e sugestoes.
- CI integrada detectou clamp assincrono de parcelas: invalidade precisa
  permanecer visivel, nao ser aceita em um estado transitorio de um frame.
- Usuario reiterou autorizacao permanente de publicar alteracoes concluidas
  apos validacao em qualquer chat deste Git comum. Persistida nas instrucoes
  globais delimitadas ao projeto e automatic-publication.md. Sem ampliar
  permissoes para DNS, contas, cobrancas, migrations ou dados remotos.
- Concorrencia usa identidades/dados sinteticos locais; nao prova capacidade
  de producao. Build da imagem ocorre no runner CI, nao no VPS.
- CI 36437130674: 948 Vitest, oito Node, 1.042 pgTAP e 20 E2E aprovados;
  restore, lint, tipos e build passaram. Quatro sessoes, 20 chamadas simultaneas
  e zero erros em ambiente sintetico; nao equivale a 20 usuarios distintos.
- Producao: estoque autenticado carregou, duas respostas comprimidas completas,
  12 sondagens de leitura sem erro e acesso anonimo negado. Quantidade extrema,
  anual acima do limite e preservacao de proposta conferidas na pagina publicada.
- Docker classic identifica config; containerd identifica manifesto. Nao
  comparar digests de tipos distintos nem ignorar diferenca: provar checksum,
  ligacao manifesto/config, plataforma, label e camadas; revalidar dois perfis
  e registrar ID do host antes do CAS. Prova e hashes no relatorio de auditoria.
- Pendencias: fonte live informa 07/08/2026; transporte funcionando nao comprova
  atualidade comercial. Divergencia preexistente de autoridade entre WF13
  oficial e arquivo nao autoriza substituir formulas.

## 2026-09-28: Caveman automatico e regressao do estoque

- Status: validado (local; gates Linux vinculados ao PR, sem publicacao).
- Fonte: PR #101; docs/audits/caveman-ferramentas-2026-09-28.md; FERRAMENTAS.md;
  InvestorCalculator.tsx; rota inventory/snapshot; testes e QA sintetico.
- Caveman Lite rege concisao, nao exatidao financeira; Cavecrew complementa os
  sete agentes crm-\* existentes. Onze skills locais constam no inventario.
- Next DevTools/Chrome DevTools sao diagnosticos locais, sem contas novas,
  telemetria, CrUX ou conexao a navegador pessoal. MCP configurado nao implica
  ferramenta carregada no chat atual; conferir em nova sessao e usar runbook.
- Filtrar nao inicia proposta: somente selecao da unidade bloqueia substituicao
  pela fonte viva. Filtrar/limpar deve preservar unidade e valores preenchidos.
- Snapshot frio precisa compartilhar leitura em andamento e limpar falhas para
  retry, sempre apos autorizacao individual; no-store e integridade preservados.
- Vitest 4.1.11 aprovado no PR #65 e integrado; nao migrar major sem necessidade.
- Testes Windows: 806 aprovados, seis falhas POSIX preexistentes e um skip;
  oito testes Salesforce passaram separadamente. Lint/tipos, inventario, MCPs,
  Gitleaks, pnpm audit e OSV passaram; scanners sem achados conhecidos apos
  corrigir o SDK transitivo do Next MCP para 1.30.1. Sem ignores de seguranca.
- Pendencias: gates finais desta branch, fontes/politicas de negocio e eventual
  publicacao explicitamente autorizada. Nenhum ganho percentual foi medido.

## 2026-09-28: prontidao e selecao das ferramentas

- Status: validado (instalacoes e verificacoes locais; gates Linux vinculados ao PR).
- Fonte: scripts/knowledge/doctor.mjs; tests/project-resource-doctor.test.ts;
  catalogo de plugins; releases oficiais Gitleaks v8.30.1 e OSV-Scanner v2.6.0.
- Codex Security agora consta instalado/habilitado, atualizando a observacao
  historica anterior. Selecionar skill por alvo, cumprir preflight e preservar
  aprovacoes; nao acionar scans completos em tarefas sem demanda de seguranca.
- Gitleaks/OSV instalados em ~/.local/bin no Windows, com hashes verificados.
  secrets passou; OSV encontrou somente o advisory moderado GHSA-82fw-gwwq-j7x9
  em Vitest/@vitest/mocker 4.1.10, rastreado no PR #65; achado nao foi suprimido.
- resources:doctor distingue disponibilidade local de autenticacao e testes.
  Docker nao instalado neste desktop; gates isolados continuam na CI Linux.
- Doctor real, 16 testes novos, 26 de conhecimento/inventario, lint, tipos,
  build e formatacao passaram. Suite geral Windows tem seis falhas POSIX
  preexistentes; um timeout inicial nao repetiu com dois workers. Oito testes
  Node Salesforce passaram separadamente; CI Linux valida o candidato integral.
- Revisao independente corrigiu falsos positivos de Supabase sem binario e
  scanner antigo. O diagnostico exige CLI Supabase na versao do pacote e
  Gitleaks 8.19+ serie 8 / OSV serie 2; novos majors precisam ser validados.
- Perfil crm-qa aplicado em delegacao real e inventario validado: 40 arquivos,
  nove areas, sete perfis e quatro skills. Nao foram executados todos os perfis.
- Pendencias: conferir conexoes quando forem usadas; MCP n8n nao exposto nesta
  sessao, sem alteracao de workflow nem fallback REST. PostHog/Datadog opcionais
  nao equivalem a telemetria do CRM configurada. Sem SDK, conta nova ou deploy.

## 2026-09-28: recursos e busca entre chats

- Status: validado (mecanismo e instalacao local; gates Linux vinculados ao PR).
- Fonte: PR #99 (recursos-memoria-crm); docs/audits/recursos-crm-2026-09-28.md; scripts/knowledge;
  tests/obsidian-knowledge.test.ts; tests/project-resources.test.ts.
- Conhecimento compartilhado e documental: agentes registram aprendizados,
  nao conversas completas. knowledge:search recupera trechos do checkout e
  aprendizados de outros worktrees sincronizados; nao treina o modelo.
- Sete agentes locais e quatro skills de dominio. Novas sessoes carregam os
  arquivos; nao ha injecao retroativa em chats nem autorizacao adicional.
- Manifesto cobre 40 arquivos de rotas/APIs em nove areas, com teste que detecta
  rotas novas sem mapeamento. Nao certifica todos os slugs ou papeis dinamicos.
- Navegador em 27/09: 19 rotas inspecionadas em leitura com Master. Dashboard
  sem overflow global nas quatro larguras, mas metas ainda sem fonte segura;
  ranking bloqueado por politica e parcerias aguardando conciliacao. Confirmar
  estado atual antes de agir; nao remover bloqueios por suposicao.
- Catalogo confirmou plugins principais instalados; autenticacao e telemetria
  sao verificacoes separadas. Codex Security apenas sugerido, nao confirmado.
- Validacao: 26 testes especificos, lint, tipos, build e formatacao passam.
  Suite geral Windows: 744 passam, seis falhas POSIX conhecidas e um skip;
  oito testes Node Salesforce passam em execucao separada. CI Linux e o gate
  integral, nao suprimir as falhas locais para obter resultado verde.
- Revisao independente corrigiu isolamento entre repositorios, proveniencia de
  fallback, geracoes intercaladas e tamanho dos titulos; regressao automatizada.
- Instalacao compartilhada atualizada e conferida nos tres checkouts, inclusive
  busca a partir da branch antiga e leitura pelo CLI do Obsidian. Backup de
  100 arquivos restaurado com hashes equivalentes em 28/09/2026.
- Audit: dois moderados em Vitest/@vitest/mocker, sem altos/criticos. Atualizacao
  ja proposta no PR Dependabot #65; nao foi misturada a esta entrega.
- Diagnostico CLI: configuracao carregada, mas verificacao opcional do MCP n8n
  sofreu timeout. Revalidar o conector quando necessario; nenhuma alteracao de
  workflow ou credenciais foi tentada e nao existe fallback REST autorizado.
- Nenhuma publicacao em producao ou alteracao de dados remotos.

## 2026-09-27: desempenho do estoque

- Status: validado.
- Fonte: PRs #94 e #95; docs/runbooks/inventory-performance.md;
  CI 36349004691; conferencias de producao neste chat.
- Fontes de estoque em paralelo, cache de 30 segundos com autorizacao antes do
  cache, deduplicacao e reducao de calculos repetidos dos filtros.
- Benchmark de facetas por regiao: mediana de 57,023 ms para 12,449 ms em 3.301
  unidades. Nao representa reducao equivalente no tempo total de abertura.
- Regra compacta herdada com !important impediu inicialmente o alvo de 44 px.
  Corrigida a prioridade CSS e acrescentada medicao geometrica no teste visual.
- Validacao: lint, tipos, testes, build e matriz visual aprovados na CI Linux.
  Conferencia real confirmou filtros utilizaveis, botao de 44 px e console limpo.
- Limite operacional: a VPS sofreu pressao de memoria com testes visuais
  extensivos. Preferir a CI para a matriz pesada; nao interromper servicos alheios.
- Nao houve alteracao de regras financeiras, schema ou workflows n8n.

## 2026-09-27: memoria local e ferramentas automaticas

- Status: validado (instalacao e testes locais especificos).
- Fonte: scripts/knowledge/obsidian.mjs e docs/runbooks/obsidian-project-memory.md.
- Documentos tecnicos selecionados sao exportados para o vault local. Cada
  checkout tem estado separado; historico deduplicado por conteudo e revisao.
- Hooks Git locais sincronizam commits, merges, checkouts e rewrites. AGENTS.md
  define consulta inicial, roteamento automatico de skills e registro final.
- Notas editadas manualmente, links simbolicos e possiveis credenciais bloqueiam
  a exportacao. Nenhum plugin comunitario, SDK ou servico pago e necessario.
- Validacao: 14 testes especificos aprovados, incluindo hook post-commit real,
  worktrees, concorrencia, idempotencia e preservacao de notas manuais.
- Instalacao conferida nos tres checkouts locais; o CLI do Obsidian leu o indice
  gerado. Backup anterior com 77 arquivos e restauracao por hash aprovada.
- Lint, tipos e build das 41 rotas passaram no Windows. A suite geral encontrou
  as seis falhas preexistentes ligadas a permissoes POSIX; consultar a CI Linux
  do PR para a validacao integral antes do merge.
- Nenhuma alteracao de producao, conta, plugin comunitario ou regra financeira.
