# Aprendizados e atualizacoes

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-10-02: Paleta do Tabelao como referencia do Associativo

- Status: pendente_validacao; branch codex/associativo-paleta-tabelao.
- Fonte: novo pedido do usuario e leitura da pagina /app/simulacao/tabelao.
- Referencia escura confirmada no DOM: fundo #061f35, painel #0a2b47,
  cabecalho de secao #0e4163 e campos #071a31. Tabelao somente leitura.
- A nova direcao substitui o azul quase preto anterior. Remover overrides
  exclusivos para herdar os tokens comuns evita duplicar a paleta; nao alterar
  tokens compartilhados nem seletores do Tabelao para atender o Associativo.
- Dourado e brilho de 3s continuam exclusivos das selecoes/proximas acoes.
- 28 testes focados, lint, tipos, build e 8 testes Node aprovados. Navegador:
  6/6 jornadas, 3/3 comparacoes de paleta e revisao desktop/celular aprovadas.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas POSIX conhecidas.
  CI Linux integral e publicacao pendentes; nao reduzir gates.

## 2026-10-02: Tipografia e caixa de frase no Tabelao

- Status: pendente_validacao; branch codex/tabelao-tipografia-ptbr, base d7c06b6.
- Fonte: sete capturas e confirmacao do usuario para preservar nomes proprios
  e siglas; TabelaoClient, TabelaoFilters, CSS local e tabelao-presentation.
- Fonte unica de 11px para corpo/cabecalho; titulos nao quebram palavras nem
  dependem da caixa alta herdada. A coluna Planta libera espaco para os titulos
  Regiao, Metragem, Vagas e Estoque, mantendo o total das larguras em 100%.
- Formatar somente o rotulo exibido; manter valores dos selects, identificadores
  de estoque e comparadores comerciais originais. Isso evita regressao de filtros
  ao corrigir acentos ou a grafia de Terreo/Tipo/Adaptavel.
- Trocar Incorporadora por Empresa apenas na pagina solicitada. Outras tabelas
  usam seus contratos existentes e nao pertencem a esta mudanca.
- Nove cenarios Playwright locais, 42 testes do formatador, 17 contratos focados,
  lint do codigo, tipos e build aprovados. Suite Windows: 1405 aprovados e seis
  falhas POSIX; oito testes Node aprovados. Auditoria: tabelao-tipografia-2026-10-02.
- CI Linux 37028915320: 1411 Vitest e oito Node aprovados, banco/restore/E2E
  e matriz funcional verdes. Sete capturas revistas e promovidas; 186 imagens
  preservadas por hash. Reexecucao final/publicacao pendentes no PR #133,
  que recebera a evidencia de fechamento apos validacao da release real.
- A revisao detectou siglas compostas e filtros C/AP versus C/ AP. Normalizar
  somente vocabulario comum na apresentacao; preservar palavras desconhecidas
  e separadores evita descaracterizar nomes ou tornar opcoes indistinguiveis.
- CI 37033511673 aprovada antes da atualizacao paralela de main d79bf8c.
  Ao integrar manifestos visuais concorrentes, reconciliar registros por caminho
  com JSON, manter proveniencias e validar todos os hashes instalados. Preservadas
  sete imagens Tabelao, duas Associativo e 184 comuns; CI combinada pendente.

## 2026-10-02: Azul noturno e retorno ao dourado no Associativo

- Status: validado e publicado; PR #134, runtime d79bf8c.
- Fonte: pedido posterior do usuario, investor-archive.css e testes de temas.
- A solicitacao mais recente substitui o prata por dourado metalico e pede
  azul quase preto; nao reaplicar #001c54/#002774 por referencia anterior.
- Tokens restritos ao Associativo preservam as outras tabelas. O brilho de 3s
  continua somente na acao pendente e respeita prefers-reduced-motion.
- Testes focados: 28 aprovados, incluindo contraste >=4.5:1 nos fundos escuros
  e em todas as paradas do gradiente dourado. CI 37030093010 aprovou 1369 Vitest,
  oito Node, banco, restore, E2E e matriz funcional completa. Apenas duas
  capturas escuras diferiram, revisadas e promovidas sem alterar tolerancias;
  191 referencias preservadas. CIs 37034089884 e 37037035430 verdes.
- Publicacao por imagem imutavel, onze camadas/dois perfis comprovados,
  backup/CAS/rollback verificados e doze leituras publicas sem erro.
- Navegador autenticado confirmou cores computadas e brilho 3s; selecao local
  descartada ao final, sem salvar proposta. Registro posterior nao muda runtime.

## 2026-10-02: Ordem territorial e falhas transitorias do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-layout, base 727c858.
- CI 37003636668 aprovou 1367 Vitest, oito Node, validacoes de banco/restore,
  E2E e todos os criterios funcionais da matriz autenticada. Sete diferencas
  visuais restritas ao Tabelao foram revisadas e promovidas com proveniencia;
  186 referencias preservadas. CI das referencias/publicacao ainda pendentes.
- Fonte: pedido e capturas do usuario, tabelao-inventory.mjs, tabelao-region.mjs
  e testes de inventario/regiao. A consulta real foi somente observacional.
- Prioridade comercial das regioes: Leste, Sul, Norte, Oeste e Centro. Agrupar
  por regiao antes do nome evita misturar zonas; a chave de apresentacao inclui
  regiao para nao reunir projetos homonimos de localizacoes distintas.
- O rótulo de carga depende de consulta realmente pendente. Timeout/falha nao
  podem continuar indefinidamente como carga nem virar regiao presumida.
- Retry de transporte limitado a uma tentativa depois dos demais lotes, com
  os mesmos tres CEPs por lote; 401/403/400 e contrato contraditorio nao repetem.
- Divergencias atuais eram tipo/titulo do logradouro. CODLOG na camada municipal
  segmento_logradouro por HTTPS comprova identidade, sem remover tokens como
  prova ou criar mapa projeto/zona. Backend local confirmou 22/22 CEPs atuais em
  02/10/2026 08:37 BRT; Itaim Bibi pertence a Oeste mesmo com bairro Brooklin.
- Retry respeita Retry-After com espera abortavel ate dez segundos. Acima do
  orcamento, nao chamar antes do prazo. CEPs excedentes ao limite nao ficam pendentes.
- 405 testes focados, lint do codigo, tipos, build e oito testes Node aprovados.
  Suite Windows: 1361 aprovados, quatro skips e seis falhas POSIX preexistentes.
  Chromium local: nove cenarios aprovados para letras verticais, ordem, filtros,
  colunas compactas e cabecalho rolando, com capturas revisadas. CI autenticada
  e publicacao pendentes; nao usar esta nota como prova de release.

## 2026-10-02: Replica de Calcular documentacao

- Status: pendente_validacao; branch codex/calcular-documentacao.
- Fonte: pedido do usuario e pagina publica /simulacao/calcular-documentacao,
  bundles DocumentationCalculator-BjH7PIsT.js e documentation-calculator-rules-DI3ss1MX.js.
- O modulo lib/archive-investor/documentation-calculator-rules.mjs ja corresponde
  a referencia em 2.048 entradas comparadas, incluindo limites e erros; reutilizar
  sem criar outro motor. Esta evidencia nao homologa a politica como regra oficial.
- A nova replica usa a rota protegida existente e o item antes Em breve no SiteMenu.
  Nao requer habilitar runtime WF16, n8n, migrations ou novas permissoes.
- Conteudo integral inclui ajudas Em construcao, impressao, auditoria e alertas.
- Lint, typecheck, build, 32 testes focados e oito testes Node aprovados. Matriz local
  final: 12 combinacoes sem overflow ou violacoes Axe, impressao e layout de zoom 200%.
- Decoracao com overflow hidden podia gerar scroll interno ao focar e redimensionar;
  overflow clip localizado preserva a geometria. Testar limites internos, nao so o body.
- Suite Windows: 1.271 aprovados, quatro skips e 20 falhas POSIX/timeouts sob carga.
  CI Linux e publicacao pendentes no PR #130; gates nao foram reduzidos.
- CI 36968955807: 1.293 testes Vitest e oito Node aprovados, restore aprovado;
  E2E conservava a expectativa antiga de 403. Ao liberar pagina de arquivo, atualizar
  tambem protectedSurfaces, hub e smoke, preservando perfis negados e APIs oficiais.
- CI 36970005859: validate, restore, 20 E2E (um skip) e matriz dedicada autenticada
  aprovados. Atualizar tambem assertDisabledItems de archive-navigation ao ativar
  um link; simulationLinks sozinho nao remove a expectativa antiga de bloqueio.
  Artefato 11211986933 conferido por SHA-256; nenhum baseline promovido com gate falho.
- CI 36971939367: todos os criterios funcionais aprovados, incluindo 140 responsivos,
  80 de tema, 193 auditorias Axe, 100 de zoom e navegacao 4 rotas x 10 larguras.
  Sete diferencas visuais intencionais do hub foram revisadas e promovidas pelo
  promotor transacional existente; outras 186 imagens preservadas por hash.
  Captura 47318329 tem arvore identica a 5ec9311; artefato 11213300733 validado.
  Nova CI e publicacao pendentes, sem reduzir limite de diferenca ou tolerancia.
- Integracao com main 29a487b: manifestos concorrentes devem ser unidos por caminho,
  preservando imagens e hashes aprovados de cada escopo. Os 186 registros da main
  e sete do hub tem proveniencia separada; isso nao substitui nova CI integrada.

## 2026-10-02: Prata e confirmacao explicita no Associativo

- Status: validado e publicado. PR #129; CIs 36971256999, 36973571026 e 36998281910. Runtime 727c8583ab46a51f81fddb7e0c0ec01b4803a531 inclui o
  Associativo e a integracao paralela, sem reverter trabalho de outro escopo.
- Gate de origem recusou preparar revisao anterior quando a main avancou.
  Reconciliar tip, CI e versao viva antes de CAS; nao contornar a verificacao.
- Imagem imutavel comprovada, backup validado e 12 leituras publicas sem erro.
  Jornada autenticada confirmou etapas sequenciais. Fechamento sem novo runtime.
- Fonte: dezoito prints do usuario, InvestorCalculator.tsx, investor-archive.css
  e ArchiveHeader. Nova direcao visual substitui o dourado da etapa anterior.
- Enquadramento automatico nao equivale a confirmacao do usuario. Renda libera
  modalidade; somente sua confirmacao libera primeiro imovel, sem mudar regras.
- Usar um unico espacamento para padding do formulario e gap das duas colunas;
  recalcular a posicao da orientacao e sua seta com o mesmo token.
- Brilho recorrente de 3s deve depender do estado pendente, ter contorno interno
  e desligar em prefers-reduced-motion. Nao animar o painel inteiro.
- D de marca e cabecalho compartilhados afetam capturas de outras tabelas;
  revisar o escopo completo antes de promover referencias visuais.
- Alterar renda invalida confirmacoes dependentes, inclusive Ranking. QA de
  edicao precisa confirmar novamente, exigindo proposta bloqueada antes disso.
- Tabela de aprovacao conserva alturas fixas legadas com !important: layout
  mobile por regra precisa liberar alturas de tr/th/td, nao apenas quebrar texto.
- Evidencias completas da implementacao e publicacao:
  docs/audits/associativo-prata-2026-10-02.md.
- CI 36968663861: funcional completo aprovado; 44 referencias alteradas
  somente nas quatro tabelas, revisadas por viewport e tema. Promocao canonica
  preserva 149 imagens fora do escopo, mesmo quando ha drift abaixo de 1%.

## 2026-10-02: Capacidade por CEP, nao apenas por lote

- Status: validado (regressao e CI); publicacao pendente; branch codex/tabelao-regioes-fila.
- Fonte: smoke real de 598e117, lib/archive-investor/tabelao-region.mjs,
  tests/inventory-regions.test.ts e docs/runbooks/tabelao-regions.md.
- Tres requests de oito CEPs equivalem a 24 consultas, nao tres. Com mapa frio,
  a fila de cinco segundos descartava CEPs antes dos tres slots serem liberados.
- Cliente usa um lote de tres CEPs, ordenado e progressivo; paginas simultaneas
  compartilham consultas por CEP no servidor. API preserva contrato de oito CEPs.
- Duas regressoes integradas falharam antes e passaram depois; 235 testes focados
  aprovados. CI 36961528199 totalmente aprovada em 825d8a3. Tipos, build, lint
  do codigo e oito testes Node locais aprovados; seis falhas POSIX no Windows.
- Main documental 0ef7b2f integrada, sem mudar runtime; CI conjunta obrigatoria.
  Evidencia final da publicacao e da carga real de regioes sera registrada no PR #128.
- Nao confundir region_lookup_busy com ambiguidade geografica. Contagem de
  requests HTTP reduzida nao basta para provar o comportamento com cache frio.

## 2026-10-01: Regioes e vagas do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-vagas.
- Fonte: pedido do usuario, origem de estoque configurada, ViaCEP, Localiza Sampa,
  GeoSampa WFS; lib/inventory/region-lookup.ts e docs/runbooks/tabelao-regions.md.
- postalCode e parkingSpaces ja chegam da origem HTTP. A consulta atual nao prova
  atualizacao do estoque nem vinculo com uma coluna SQL; preservar generatedAt.
- CEP pode abranger distritos de zonas diferentes. Nao usar primeiro resultado,
  faixas aproximadas de CEP, bairro como distrito ou codigos entre sistemas.
- Localiza Sampa e GeoSampa usam codigos de distrito diferentes. Cruzar os nomes
  oficiais e nm_regiao_05; nao interpretar o codigo de regiao isoladamente.
- Fonte HTML sem API/SLA e apenas HTTP verificado: parse estrutural, contagem de
  linhas, CEP e logradouro cruzados; qualquer conflito fica nao confirmado.
- Cache territorial nao leva sessao; autorizar cada request antes dele. Consultas
  opcionais nao podem sobrescrever endereco, selecoes ou impedir uso do estoque.
- Vagas entram na chave da opcao, no estoque e nas facetas. null nao vira zero.
- 335 testes focados aprovados; sete cenarios Chromium com componente/CSS reais
  passam. Fonte atual: 20/22 CEPs confirmados, dois conflitos mantidos nao confirmados.
- Lint do codigo, tipos, build e oito testes Node aprovados. Windows registra seis
  falhas POSIX e timeouts na suite de conhecimento, sem alterar gates.
- CI Linux 36952238409: 1.279 Vitest e oito Node aprovados, quatro skips;
  formato, lint, tipos, build, banco, restore isolado e E2E aprovados.
- Matriz funcional passou (140 rotas, 80 temas, 193 axe, 100 zoom). Sete capturas
  do Tabelao revisadas e promovidas; outras 186 preservadas. PR #125, captura
  dd373aa e codigo 02074e7. CI final e publicacao pendentes; fechamento no PR.
- CI 36954481187 passou integralmente em 805e0ca. Integrada main ef0a2fb
  (guia do Associativo, PR #126), preservando seus arquivos e as referencias
  visuais. Nova CI conjunta e publicacao pendentes; nenhum deploy desta etapa.

## 2026-10-01: Cabecalhos e alinhamento do Tabelao

- Status: pendente_validacao; branch codex/tabelao-cabecalhos-centralizados.
- Fonte: pedido e captura do usuario, TabelaoClient.tsx, investor-archive.css,
  scripts/qa/authenticated-visual.mjs e auditoria tabelao-cabecalhos-2026-10-01.
- Titulo e corpo devem compartilhar o tamanho de fonte. Remover regras de
  4/6px, permitir altura automatica e manter limites de largura para quebra.
- Mover uma coluna exige atualizar colgroup, thead e tbody juntos. Com rowspan,
  td:first-child nao identifica a primeira coluna logica; conferir padding e
  geometria das celulas pelos headers depois de filtros e ordenacao.
- Centralizacao inclui th de rowgroup, td, titulos e wrappers de texto.
- Sete cenarios locais aprovados, com componente/CSS reais e fixtures; colunas
  compactas mantidas em 115/145/73px externos, sem corte de texto ou overflow.
  Typecheck e 55 testes focados aprovados; 992 testes Windows aprovados,
  quatro skips e seis falhas POSIX conhecidas. Build e lint do codigo aprovados.
  CI 36916047513 aprovou Linux, banco, restore, E2E e toda a matriz funcional.
- Sete capturas revisadas com fontes reais e tres temas, apenas do Tabelao;
  promocao canonica preservou as outras 186 referencias e os limiares 1%/16.
  CI final 36919972124 aprovada; main f1d71da integrada posteriormente sem
  sobrescrever o Associativo. Catalogo conciliado por rota com proveniencia;
  capturas preservadas. Nova CI conjunta/publicacao pendentes, fechamento no PR #123.

## 2026-10-01: Proxima acao dourada no Associativo

- Status: publicado_verificado_2026-10-02; runtime 598e1171; PR #126.
- Fonte: nove capturas e pedido do usuario; referencias publicas somente leitura,
  InvestorCalculator.tsx, investor-archive.css e auditoria guia-dourado.
- Dourado indica etapa atual, sem mudar as paletas azuis. Nao destacar a linha
  Financiamento enquanto o Perfil estiver incompleto: usar estagio qualification.
- Borda pulsante com scale ultrapassava o ledger. Usar pseudo-elemento interno
  inset 0, border-box, sem transform; manter popovers e foco acessiveis.
- Quantidade precisa reservar a mesma coluna de 26px do prefixo R$; igualar
  apenas wrappers nao igualava a largura das caixas de edicao.
- % Maximo da renda mensal e mudanca de rotulo, nao de regra. Manter indicadores
  de maior mensal e maior mensal + Evolucao de Obra distintos e atualizar ajudas.
- Estilos legados de background-clip/text-fill podem manter o $ azul mesmo com
  color dourado; verificar a pintura efetiva, nao apenas computed color.
- Inputs iguais no desktop nao devem diminuir alvos mobile: manter 44px.
- `hasTouch` isolado nao comprovou ponteiro coarse neste host. Usar contexto
  mobile real e conferir media query; neutralizar transform legado fora do hover.
- Jornada visual 6/6, mesma pagina 3/3 e coarse real/desktop 2/2. Suite Windows
  com limites POSIX registrados; CI Linux do PR 36954146586, main 36956549122 e
  integrada 36958962302 aprovadas. Nenhum gate enfraquecido.
- Main avancou com PR #125 do Tabelao; publicar descendente validado em vez
  de sobrescrever o trabalho concorrente. Imagem/backup/CAS/rollback verificados,
  12 GETs sem erro e pagina autenticada carregada. Referencias permaneceram intactas.
- Fonte final: docs/audits/associativo-guia-dourado-2026-10-01.md. Encerramento
  documental nao requer outro deploy nem prova de capacidade em producao.

## 2026-10-01: Layout inicial e FAQ do Associativo

- Status: validado; runtime f1d71da81a21cf139acc26b95a6cacc218b79325.
- Publicacao: PR #122, CI final do PR 36919448507 e CI main 36923454213 verdes.
  Imagem imutavel verificada em onze camadas e dois perfis, com backup/CAS/rollback.
- Fonte: quatro capturas e material de FAQ fornecidos pelo usuario;
  investor-archive.css, AssociativeLearningManual.module.css e QA compacto.
- Compactacao reduz margens e remove contorno duplicado dos filtros, sem
  overflow:hidden global, sem truncar estoque e sem alterar altura virtual.
- Guia usa largura intrinseca; ouro metalizado aplica-se a hover, foco e selecao.
- Paineis usam contornos de 6/8px, sem sombras amplas ou brilho continuo do guia.
- Anexo educacional nao e politica comercial: preservar exemplos e ressalvas,
  verificar fontes oficiais e explicitar divergencias com o runtime vigente.
- Previa em 1280x580 coube sem rolagem global; CI verifica esse tamanho e os
  tres temas antes de qualquer selecao. Nao misturar essa verificacao com o
  estado de proposta aberta, que deve conservar rolagem normal.
- CI 36915441302 aprova Linux (1.006 testes, quatro skips condicionais e oito
  Node), banco, restore, E2E, 40 navegacoes, 193 axe, zoom/teclado e manual
  em 30 capturas. Onze diferencas exclusivas do Associativo foram revisadas
  e promovidas pela rotina canonica; demais 182 referencias preservadas.
- Lint, tipos e build locais aprovados; seis falhas Windows de POSIX/symlink
  nao reproduziram na CI Linux. Publicacao e verificacao pos-deploy concluidas.
- Health local/publico confirma a release; doze GETs anonimos sem erros, com
  estoque e snapshot protegidos por 401. Esse smoke nao comprova capacidade.
- UI autenticada em 1280x580: zero rolagem global nos tres temas, dez linhas,
  guia 32px com 25,33px de folga total e card 8px. Ouro metalizado confirmado
  por foco, sem selecionar unidade real. Guia/Escape/retorno de foco aprovados.
- Em viewport muito baixo, preservar acesso ao conteudo: 1280x529 exigiu 16px
  de rolagem. Nunca esconder overflow global para simular uma tela que cabe.
- Console sem erros/avisos; nenhuma proposta alterada. Evidencia completa em
  docs/audits/layout-manual-associativo-2026-10-01.md. Registro documental sem restart.

## 2026-10-01: Alinhamento do fechamento do Associativo

- Status: validado; runtime 5878c3bce83990496d886c3311527724beb7d9f9.
- Fonte: captura e pedido do usuario; AssociativeTableArchive.tsx,
  investor-archive.css, PR #120, CI main 36881065033, health, navegador
  autenticado e docs/audits/rodape-associativo-2026-10-01.md.
- O aviso preliminar e o contato pertencem a uma grade comum alinhada pelo topo;
  abaixo de 760px passam para uma coluna, sem sobreposicao ou overflow horizontal.
- Navegador local com dados sinteticos mediu 0px de diferenca no desktop e
  empilhamento correto no celular, sem erros ou avisos no console.
- Matriz de navegacao 40/40 aprovada nos quatro simuladores, tres temas e dez
  larguras por rota, sem erros de runtime.
- CI 36862800456 aprovou validacao Linux, banco, E2E e restore isolado. Tres
  diferencas visuais esperadas em 768, 1024 e 1280px foram inspecionadas e
  promovidas pela rotina canonica; outras 190 referencias foram preservadas.
- Lint, tipos, teste focado e build aprovados. Suite Windows: 994 aprovados,
  um skip e sete falhas de POSIX/symlink ou timeout Chrome; CI Linux aprovada.
- Imagem imutavel com onze camadas e dois perfis, backup/CAS/rollback verificados.
  Doze GETs anonimos sem erro nao provam capacidade. UI publicada confirmou 0px
  no desktop e empilhamento correto no celular, sem console ou selecao de unidade.
- Preservar textos, tres temas, estoque, simulacao e demais rotas.
- Este registro documental deve ser integrado e sincronizado sem novo deploy.

## 2026-10-01: Filtros compactos publicados e conferidos

- Status: validado; runtime de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c.
- Fonte: PR #118, CI main 36807945046, health e navegador autenticado;
  docs/audits/filtros-associativo-2026-09-30.md.
- CI integral verde; imagem imutavel, onze camadas/dois perfis, backup e CAS.
- UI real confirma titulo a 8px do menu, guia de 32px, ajudas alinhadas,
  metadados a esquerda de Limpar filtros e dez linhas, sem overflow da pagina.
- Guia/ajuda/Escape/foco passaram; nenhum erro de console. Sem selecionar
  unidades reais ou alterar propostas. Doze GETs anonimos passaram; nao prova carga.
- Preservar navy/azuis e selecao dourada. Para layouts compactos, conferir
  tambem fonte real e proposta aberta em tablet, nao somente estado inicial.
- Resultado apenas documental: publicar no Git e sincronizar sem novo deploy.

## 2026-09-30: Estoque Associativo compacto e selecao dourada

- CI 36800158280: gates funcionais, banco, restore, E2E, 40 navegacoes,
  193 axe e zoom aprovados. Onze capturas revisadas/promovidas, exclusivas
  do Associativo; demais 182 e thresholds preservados. CI final/deploy pendentes.

- Proposta selecionada: regra antiga movia a ajuda para segunda linha em
  561-1100px com cabecalho fixo de 40px. Mantem a ajuda na terceira coluna;
  QA exige botao contido e sem colidir com titulo/conteudo seguinte.

- CI 36798139339 aprova E2E; falha visual em 768px mostrou o guia em duas linhas.
  Largura em vw encolhia o texto junto da ajuda. Usa 260px limitado ao conteiner;
  conferir fontes reais, nao apenas fallback Arial, antes de homologar geometria.

- CI 36797025028: validacao Linux, banco, restore e concorrencia sintetica passam.
  E2E exigia Filtros do estoque; contrato atualizado para ajuda/acao no cabecalho.
  Matriz local completa passou em 40 navegacoes/tres temas. CI integral pendente.

- Status: pendente_validacao; branch codex/associativo-filtros-compactos.
- Fonte: nove capturas do usuario, InvestorCalculator.tsx, CSS com escopo
  Associativo e docs/audits/filtros-associativo-2026-09-30.md.
- Selecao persistente usa o mesmo dourado do hover/foco, com texto escuro.
- Limpar filtros fica no cabecalho, metadados a esquerda; ajuda ao lado de
  Escolha a unidade. Sem Guia completo ou Filtros do estoque redundantes.
- CSS compartilhado tem sobrescritas tardias: conferir geometria renderizada,
  altura dos campos no celular e alinhamento dos icones; nao alterar outras rotas.
- Preservar propostas ao limpar filtros, dez linhas e estoque virtual completo.
- Local: lint/tipos/build, 30 combinacoes de geometria e dois contextos de toque
  aprovados. Obsidian 22/22 na reexecucao; seis limitacoes POSIX exigem CI Linux.
- CI, revisao visual e publicacao pendentes. Nao confundir codigo com release.

## 2026-09-30: Topo compacto publicado e conferido

- Status: validado; runtime 843fd113a3a1f6b6fd3b6b12b6de58de180256ce.
- Fonte: PR #116, CI main 36780351488, health e navegador autenticado;
  docs/audits/topo-associativo-2026-09-30.md.
- Titulo e Guia completo ficam a 8px da linha do menu; botao 36px em ponteiro
  preciso e 44px em toque. Mantem tres paletas e tamanho do titulo.
- CI integral aprovada; imagem imutavel com onze camadas e dois perfis comprovados,
  backup/CAS/rollback preservados. Doze GETs anonimos sem erro; nao prova carga.
- UI publicada confirmou geometria, guia, Escape, retorno de foco e nenhum erro
  de console. Usa nova aba sem recarregar a aba de trabalho; nao altera propostas.
- Registro documental: publicar no Git e sincronizar sem reiniciar a aplicacao.

## 2026-09-30: Alinhamento superior do titulo e guia

- CI 36774530982 aprovou testes Linux, banco, restore, E2E, navegacao e axe.
  Onze capturas revisadas e promovidas; demais 182 preservadas. Comparador
  continua em 1%/16 por canal. CI final e publicacao ainda pendentes.
- Status: pendente_validacao; branch codex/topo-associativo-compacto.
- Fonte: pedido e duas capturas do usuario; investor-archive.css e contrato
  scripts/qa/associative-compact-layout.mjs.
- Escopo somente Associativo: titulo e guia alinhados pelo topo, margem de 8px
  apos o menu e entre linhas no celular; botao 36px, com 44px para ponteiro coarse.
- Preservar as tres paletas, altura do menu e regras financeiras. Validacao
  deve conferir geometria real, toque, guia funcional, temas e zoom.
- Geometria: 30 combinacoes largura/tema e dois contextos de toque aprovados.
  Guia/Escape/foco/axe passaram em desktop/celular. Lint/tipos/build aprovados;
  Windows 994 testes aprovados, um skip, seis falhas POSIX. Oito testes Node passaram.
- CI Linux, referencias visuais e publicacao pendentes; nao interpretar
  implementado como publicado. Evidencia: docs/audits/topo-associativo-2026-09-30.md.

## 2026-09-30: Compactacao publicada e verificada

- Status: validado; runtime d9c2bee07fd6304006e28e357bf8e918a2031bf4.
- Fonte: PR #114, CI main 36764731943, health e navegador autenticado;
  docs/audits/compactacao-associativo-2026-09-30.md.
- Estoque Associativo mostra dez unidades por vez sem limitar resultados.
  Hover/foco dourado; passo virtual alinhado a 26px/48px no breakpoint 760px.
- Cabecalho compartilhado 56px em desktop/tablet; temas sem caixas, com texto,
  icones e sublinhado ativo. Titulo Associativo 2rem desktop e 1.475rem mobile.
- Mantem azul-marinho e tres paletas. Next 16.3.6 atende advisory critico; gates
  completos aprovados. Foco do menu preservado mesmo quando CSS oculta o controle.
- Publicacao com imagem imutavel, backup/CAS/rollback e dois perfis comprovados.
  Doze GETs anonimos sem erro, sem prova de carga. Confirmacao UI sem propostas
  ou dados alterados; nova aba evita descartar trabalho na aba do usuario.
- Registro apenas documental: publicar no Git e sincronizar sem reiniciar runtime.

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
