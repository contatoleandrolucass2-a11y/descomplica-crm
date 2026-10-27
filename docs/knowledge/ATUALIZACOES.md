# Aprendizados e atualizacoes

## 2026-10-27: CAIXA integrado; publicacao bloqueada por main concorrente

- O PR #373 foi integrado como
  `a0b4a38125a5ac38991ca7f3368bd6b9ce336648`. A CI de `push/main`
  `40545177637` aprovou `validate`, `promotable-image` e `isolated-restore`; o
  teste sintetico especifico do CAIXA dentro de `release-gates` tambem passou.
- O job `release-gates` foi cancelado durante a inicializacao do Supabase porque
  a `main` avancou concorrentemente para
  `1b510d4c44098d78e7bcf157d94a44de253c37ba`, com mudanca de Agendamentos fora
  deste escopo. A publicacao do SHA do CAIXA nao foi tentada: o coordenador
  exige `main` exata e publicar o novo SHA tambem promoveria outra pagina sem a
  validacao desta conversa.
- Health publico observado em `2026-10-27T17:07:15.7858595Z`: HTTP 200,
  `status=ok`, versao `bb56fd7b23e872c69e3c5dac144afb30e4397cc4`. Portanto a
  correcao esta integrada no Git, mas ainda nao esta comprovadamente publicada.
  Reavaliar quando a CI integral do `main` entao vigente concluir os quatro jobs
  e a promocao puder ser atribuida ao responsavel pelo lote concorrente.
- O sync do Obsidian continuou impedido por `Documento excede o limite de
exportacao.`; os documentos versionados permanecem a fonte registrada.

## 2026-10-27: abertura do editor administrativo de Agendamentos

- Escopo exclusivo: controles de edicao visual dos cards e graficos em
  `/app/etapas/agendamentos`, com redimensionamento, conteudo e tipografia
  ajustaveis, acoes inline ocultas e mutacoes restritas a Administrador/Master.
- Conferencia de 27/10/2026 11:48 `America/Sao_Paulo`: `origin/main` estava em
  `bb56fd7b23e872c69e3c5dac144afb30e4397cc4`, com CI `40470172649` aprovada;
  o health publico respondeu HTTP 200, `status=ok`, versao
  `83a92392bbf1734a15ce5eb2f33a4e623bf9af41`. A versao publicada estava atras
  da `main` consultada e nao comprovava esta demanda.
- A consulta e a sincronizacao inicial do conhecimento ficaram pendentes porque
  o runtime retornou `Documento excede o limite de exportacao.`. Os documentos
  versionados e o codigo atual sao a referencia desta execucao.

### Implementacao e validacao local

- A edicao permanece exclusivamente em `/app/etapas/agendamentos`. Somente
  `admin` e `master` recebem o editor; os demais usuarios autorizados leem o
  mesmo layout compartilhado sem toolbar, cabecalho de arraste ou alca de
  redimensionamento. O controle de perfis foi removido desta pagina e o layout
  unico usa salvamento automatico com versao otimista.
- O editor permite alterar largura em colunas, altura em pixels, titulo, texto
  complementar, escala e alinhamentos da fonte, cor do texto, cor de destaque e
  altura/alcance das torres. As acoes inline ficam ocultas e aparecem somente
  por hover ou foco do administrador.
- A migration `20261027145559_appointments_admin_canvas_presentation.sql`
  preserva o validador v2, valida a nova apresentacao, compartilha somente o
  layout de Agendamentos entre leitores autorizados e exige Administrador/Master
  para criar ou atualizar. As demais paginas continuam com perfis privados.
- Node 24.19.0/pnpm 11.20.0: lint sem erros e com 44 avisos preexistentes em
  ativos publicos fora do escopo; typecheck, build de 41 paginas/71 saidas,
  `pages:check`, `resources:check` e 91 testes focados aprovados. A matriz Vitest
  integral aprovou 4.370 testes e ignorou 112; duas execucoes paralelas tiveram
  somente timeouts de host fora do escopo. O teste do Associativo aprovou
  isoladamente; a repeticao do teste do conhecimento terminou por falta de
  memoria no runtime local. Docker/Podman esta indisponivel, portanto o pgTAP de
  32 assercoes e o restore isolado permanecem gates obrigatorios da CI Linux.
- PR `#375`: CI `40539313931` e candidato visual protegido `40539313960`
  aprovados no SHA `0177241f10c6546d6d90e2f436c23a9237c2aeb7`. A `main`
  avancou durante a captura; a branch foi atualizada para repetir os gates no
  novo SHA antes do merge. Migration remota e publicacao seguem pendentes.

## 2026-10-27: correcao local de subsidio, prazo e layout do CAIXA

- O run protegido `40537724784` foi aprovado no head
  `655782460d205b23a17a993ed20fa4f422bbd71d`; artifact `12750383183`, ZIP
  SHA-256 `16a6cf8cde804f8d97a843a05b63ea934a43a0f804a777a88c32b2a7f9f7f05e`,
  capture commit `d816788a2bb69012f7c99d513671a9ef0cec6559` e captura em
  `2026-10-27T16:37:29.234Z`. As 11 imagens CAIXA foram revisadas em resolução
  original e aprovadas, sem corte, sobreposição ou rolagem horizontal.
- Foram incorporadas somente 11 imagens do CAIXA, suas 38 entradas de rota
  (7 responsivas, 4 de tema, 11 Axe, 11 screenshots e 5 zoom) e registros de
  hash/proveniência. As outras 231 imagens e os metadados globais permaneceram
  preservados. Uma nova CI é obrigatória antes de merge e publicação.
- A calculadora publica CAIXA foi repetida com dados ficticios: nascimento em
  22/01/1987, renda de R$ 4.000 e imovel de R$ 276.000. O resultado exibiu Price,
  prazo maximo de 420 meses, taxa efetiva de 8,47%, primeira prestacao de
  R$ 1.200 e financiamento maximo de R$ 157.599,38. O site informa que subsidio
  FGTS ou PMCMV pode compor a entrada, mas nao publica o valor do beneficio.
- O MFOM Habitacao v034 oficial, vigente desde 22/04/2026 e consultado em
  27/10/2026, foi conferido junto com as planilhas embutidas dos anexos III e IV.
  O calculo monetario depende de area e tipo da unidade, composicao familiar,
  modalidade, fator estadual e recorte populacional. Para renda entre R$ 3.700
  e R$ 4.000, o texto consultado nao explicita saturacao da curva de `Frenda`.
  Por isso o sistema agora sinaliza automaticamente a elegibilidade potencial,
  mas nao inventa nem abate valor sem confirmacao oficial.
- O prazo do formulario passa a ser reposto no maximo permitido sempre que data
  de nascimento, condicao de obra ou prazo de construcao mudam. Uma reducao
  manual permanece ate a proxima mudanca determinante e o campo impede valor
  acima do maximo atual.
- A interface reutiliza os tokens globais de Agendamentos nos tres temas. O
  tablet usa duas colunas nos campos principais, mantem os tres toggles na mesma
  linha e posiciona planta/condicao juntos; o celular preserva os nomes das abas.
  O card do plano usa altura natural e nao e mais esticado pela composicao.
- Validacao focada local: 55 testes unitarios/componentes e 6 jornadas reais de
  navegador aprovadas. A matriz de navegador cobre calculo, recomputacao do
  prazo nos dois sentidos, edicao manual, SBPE SAC 90%, temas, Axe, overflow e
  geometrias em desktop, tablet e celular. `pnpm lint` concluiu sem erros (44
  avisos preexistentes de Meta Ads), `pnpm typecheck`, `pnpm build`,
  `pnpm resources:check` e `pnpm security:secrets` foram aprovados.
- A suite integral local serializada encontrou uma falha fora do escopo em
  `tests/associative-approval-suggestion.test.ts` e a primeira tentativa sofreu
  esgotamento de memoria do host. Conforme a regra maxima de escopo, o
  Associativo nao foi investigado nem alterado; a CI do SHA candidato devera
  confirmar os gates integrais. Merge e publicacao ainda estao pendentes nesta
  etapa local.

## 2026-10-27: abertura da correcao de subsidio, prazo e layout do CAIXA

- Consulta em 27/10/2026 as 11:20 `America/Sao_Paulo`: a `main` remota esta no
  SHA documental `bb56fd7b23e872c69e3c5dac144afb30e4397cc4`; a aplicacao
  publicada responde HTTP 200, `status=ok` e versao
  `83a92392bbf1734a15ce5eb2f33a4e623bf9af41`.
- A CI da versao publicada, run `40463329858`, permanece aprovada nos jobs
  `validate`, `promotable-image`, `isolated-restore` e `release-gates`. O estado
  observado ainda nao valida as novas correcoes solicitadas neste chat.
- O escopo desta investigacao e restrito ao Simulador CAIXA: elegibilidade e
  calculo indicativo de subsidio, recomputacao do prazo maximo por idade,
  regressao financeira com dados ficticios e alinhamento visual ao padrao de
  Agendamentos. Nao autoriza alteracoes em outros simuladores, dados remotos,
  DNS ou workflows n8n.
- `knowledge:context` e `knowledge:search` foram executados, mas o runtime de
  memoria retornou `Documento excede o limite de exportacao.`. O conhecimento
  versionado e o codigo atual serao usados como fonte; a sincronizacao com o
  Obsidian permanece pendente.

## 2026-10-27: automacao e precisao do Simulador CAIXA publicadas

- O PR #368 foi integrado na `main` como
  `04300be6bb54561b8ab4785dab197f3822010140`; a correcao restrita das 11
  referencias visuais foi integrada pelo PR #371 no SHA final
  `83a92392bbf1734a15ce5eb2f33a4e623bf9af41`.
- A CI integral da `main`, run `40463329858`, aprovou `validate`,
  `isolated-restore`, `promotable-image` e `release-gates`. O artefato imutavel
  `12716305458` teve digest
  `sha256:0a1ee1c01e7c790464706aba3a98caf25551d6a856b6f1d188db13d92924bb07`;
  a prova no destino validou os dois perfis de runtime, o SHA, a plataforma e
  as 11 camadas sem recompilar a imagem.
- O coordenador protegido publicou o SHA final em 27/10/2026 as 04:47:01
  `America/Sao_Paulo`, deployment
  `da2976c6-dd73-45c5-b04f-96e666043600`, imagem
  `sha256:f54352e6942c32621aa8dd41eece5ee1bf567fea1c910a2b95dfed129a9a3be7`.
  A consulta imediatamente anterior confirmou o deployment
  `61163953-0645-423b-ab6a-ea62d18edf27`, SHA `897d0cf9`, sem pendencia.
- O smoke publico retornou HTTP 200, `status=ok` e a versao exata
  `83a92392bbf1734a15ce5eb2f33a4e623bf9af41`; o acesso anonimo a
  `/app/simulacao/caixa` retornou 307 para `/login`. O estado final do
  coordenador ficou sem deployment pendente.
- O escopo publicado automatiza o teto de 30%, limite municipal por cidade/UF,
  condicao Novo para imovel na planta, escolha Novo/Usado fora da planta,
  promocao da faixa de juros pelo valor do imovel e reducao automatica do prazo
  pela idade. Permanecem as cotas SBPE de 90% no SAC e 80% no Price. Nenhuma
  regra de outro simulador, dado remoto, DNS ou workflow n8n foi alterado.
- A sincronizacao com o Obsidian continua pendente: o runtime retorna
  `Documento excede o limite de exportacao.`. Os documentos versionados sao a
  fonte atual ate a correcao desse limite; a falha nao invalida a publicacao.

## 2026-10-26: gate de restauracao dos perfis do dashboard

- O segundo ensaio da `main`, run `40436653510`, SHA
  `661c575619cfa53356406e5fbe15c71ca341be2d`, superou a falha de sessao e
  avancou ate o lint completo do banco. O lint bloqueou corretamente a funcao
  `private.assert_dashboard_profile_document`: ela estava marcada
  `IMMUTABLE`, mas a assinatura normalizada dos cards usa expressoes de
  volatilidade `STABLE`.
- O contrato foi alinhado para `STABLE`, sem alterar validacoes, entradas,
  saidas, permissoes ou persistencia. A variavel local sem uso foi removida e
  um pgTAP adicional fixa a volatilidade esperada. A publicacao continua
  bloqueada ate uma nova CI integral aprovar restauracao, lint e testes.
- A CI da `main` no run `40433836523`, SHA
  `8d6f48709038b7eaa5f59ffbdedc348640ad7c4b`, aprovou aplicacao, imagem
  promovivel e validacao geral, mas bloqueou a publicacao no ensaio isolado de
  restauracao. O pgTAP dos perfis enviava `request.jwt.claims` sem
  `session_id`; a fundacao de seguranca rejeitou corretamente a sessao como nao
  ativa antes de executar os testes funcionais.
- A correcao permanece restrita ao fixture: cria duas `auth.sessions`
  sinteticas, vigentes e vinculadas aos usuarios de teste, e inclui seus IDs
  nos JWTs. Nenhuma funcao, policy, grant, migration ou requisito de MFA foi
  flexibilizado. A publicacao continua condicionada a uma nova CI integral da
  `main` com `isolated-restore` aprovado.
- O Docker local esta indisponivel neste host; por isso a reproducao pgTAP
  completa depende da CI Linux isolada. O sync do Obsidian continua pendente
  pela falha `Documento excede o limite de exportacao.`.

## 2026-10-26: persistencia e reconciliacao do Canvas Meta Ads

- O perfil do Canvas passa a ter fonte autoritativa por usuário no banco, com
  RLS proprietária e escopos separados para macro, conjuntos e anúncios. O
  cache do navegador não comprova mais persistência; GET/PUT autenticados e a
  conferência em outro dispositivo são evidências distintas.
- A consulta automática preserva a janela oficial completa. Gráficos de hoje,
  semana e mês não podem reutilizar acidentalmente o mesmo recorte após 60 s.
- O dia padrão segue `America/Sao_Paulo`. Aliases equivalentes de lead da Meta
  não são somados entre si; o maior contador compatível representa o resultado
  único do Gerenciador. A comparação real da campanha reportada será registrada
  somente após QA autenticada em produção.
- O teto acumulado é `teto diário × dias inclusivos`; a cor de CPL continua
  comparando a média do período com o teto diário. Isso distingue limite total
  de referência média sem multiplicar o custo por lead.
- Formato, lint, tipos, build, 4.311 testes Vitest, 2.343 testes Node/release e
  65 testes focados passaram localmente. O Docker local indisponível impediu
  executar pgTAP; a CI Linux `isolated-restore` permanece bloqueante.

## 2026-10-26: implementacao local do layout e acesso do Simulador CAIXA

- O motor local da rota `/app/simulacao/caixa` deixou de ser substituido pelo
  aviso visual de integracao bancaria. O desbloqueio preserva autenticacao,
  `enforcePermission`, status da conta, MFA, overrides e a permissao compartilhada
  dos simuladores. O endpoint oficial permanece fechado quando nao configurado.
- O card CAIXA no hub deixou de exibir o cadeado artificial. A migration de
  catalogo `20261026200621_sync_page_catalog.sql` sincroniza apenas a descricao;
  as permissoes `crm.simulators.view` e `crm.simulators.execute` continuam sendo
  concedidas aos sete perfis operacionais pela migration vigente, sem ACL nova.
- A interface foi alinhada ao padrao visual dos simuladores Associativo e Tabela
  Direta: fluxo numerado, paineis compactos, acao principal persistente, resultado
  no mesmo contexto e temas claro, medio e escuro. Formulas, taxas, SAC, Price,
  SBPE, comprometimento de renda e regras financeiras nao foram alteradas.
- Validacao focada: 189 testes aprovados e 3 condicionais ignorados; validacao
  browser: 56 aprovados com calculo, desktop, celular, tres temas, Axe e overflow.
  `pages:check`, `resources:check`, `security:secrets`, lint, typecheck e build
  passaram. O lint manteve 44 avisos preexistentes nos ativos Meta Ads.
- A suite global aprovou 204 arquivos Vitest, 4.302 testes e manteve 111 testes
  condicionais ignorados. O runner Node aprovou 1.599, ignorou 19 e repetiu tres
  falhas Windows preexistentes de contratos POSIX/arquivo privado em Meta Ads;
  nenhum arquivo dessa area foi alterado. `db:test` ficou indisponivel porque o
  Postgres local/Docker nao estava ativo em `127.0.0.1:54322`; a CI Linux isolada
  permanece obrigatoria antes de integrar e publicar.
- As capturas sinteticas locais foram revisadas em 1440 px nos tres temas e em
  390 px no tema escuro, sem dados de clientes. PR, CI, merge e publicacao ainda
  devem ser registrados separadamente. O sync do Obsidian permanece impedido por
  `Documento excede o limite de exportacao.` e nao deve ser tratado como concluido.
- No PR #362, `validate` e `isolated-restore` passaram. A primeira execucao de
  `release-gates` aprovou os 56 testes CAIXA, 154 rotas, 88 variacoes de tema e
  242 auditorias Axe, mas bloqueou por divergencia esperada das referencias que
  ainda mostravam o estado anterior. O workflow protegido `40395287053` aprovou
  a captura e produziu o artefato `12688461833`, digest
  `sha256:0eb0c26e3ea48ef329d3a701950479d5bef31863f12c5a053496f3770361b10c`.
  Somente os arquivos listados pela proveniencia protegida foram incorporados;
  uma nova CI deve comprovar a convergencia antes do merge.

## 2026-10-26: refinamento final de Agendamentos publicado

- Escopo funcional restrito a `/app/etapas/agendamentos`. O PR #355 foi
  integrado na `main` como `4e6c8a9da91fbc4acfeaaa40669dc09cb95caedc`.
  Nenhuma migration, workflow n8n, regra comercial ou outra pagina integrou
  esta entrega.
- A CI do PR (`40310161183`) aprovou `validate`, `release-gates` e
  `isolated-restore`; a captura autenticada protegida (`40310161276`) tambem
  concluiu com sucesso. A CI da `main` (`40315829223`) aprovou os quatro jobs:
  `validate`, `release-gates`, `isolated-restore` e `promotable-image`.
- Artefato promovido `12647366432`, arquivo SHA256
  `e35cc564a726ff3742394f6838728dd7e47b9ca0f2f7feb2ab04222e90acca31`,
  ID da configuracao OCI
  `sha256:085258b057eb4626a248fbf9535d92a050e6f2a313f8625c60a9e0a88ec52bec`
  e ID local apos carga
  `sha256:3444974924930cc7fdf6ee6a8493ca13aa210031899d3edfcfaf9ebfe60ce2eb`.
  Revisao, configuracao, onze camadas e dois perfis de runtime foram
  comprovados; nenhum rebuild ou segredo impresso.
- O coordenador `release:production` concluiu o deployment
  `5857651f-3e10-45c6-b513-3c9114cfb426` em
  `2026-10-26T12:33:39.908Z` (09:33:39 America/Sao_Paulo), sem deployment
  pendente. O estado anterior foi preservado para rollback. Health publico
  posterior retornou HTTP 200, `status=ok` e a versao completa exata da
  `main`; acesso anonimo a rota retornou 307 para `/login`.
- Smoke autenticado em producao: desktop 1440x900 e celular 390x844 nos temas
  claro, medio e escuro. Nao houve rolagem horizontal da pagina, corte ou
  sobreposicao visivel. Foram exercitados sidebar recolhida/expandida e clique
  externo, calendario e seus nove atalhos, dias circulares, House/Imob, filtro
  regional, cards e dialogos, funis lado a lado, guias sequenciais, tabela e
  rodape. O calendario mobile ficou integralmente no viewport (337x810 px);
  a tabela inclui `Qnt. de dias`, nao possui rolagem vertical interna e adapta
  as linhas ao celular. House voltou a ser o canal inicial apos recarga, o tema
  medio foi restaurado e o override de viewport removido. Console sem erros.
- O sync final do Obsidian foi tentado, mas permanece pendente pela falha
  preexistente `Documento excede o limite de exportacao.` O registro versionado
  e a evidencia permanecem validos; nao truncar o historico nem alterar o
  exportador fora de uma demanda propria.

## 2026-10-26: abertura do refinamento visual de Agendamentos

- Escopo exclusivo de `/app/etapas/agendamentos`: navegacao compacta, calendario,
  filtros, cards, funis, guias por secao, graficos, recencia, detalhamento e
  rodape. Nenhuma regra ou pagina CAIXA integra esta demanda.
- GitHub consultado em 26/10/2026 02:52 -03: `origin/main` e o site publicado
  apontam para `54eb7cdd7460130fc8c70d71fb956cb801b8d12c`, entrega concorrente da
  pagina CAIXA posterior ao PR #350. Health publico: HTTP 200, status `ok`.
- O registro documental do PR #350 foi reconciliado sobre a nova `main` no
  commit `7f9fe12f`; PR #352 permanece aberto enquanto a CI da base atual roda.
- `knowledge:context`, `knowledge:search` e `knowledge:sync` permanecem
  indisponiveis com `Documento excede o limite de exportacao.` A fonte
  versionada foi preservada; nao apagar ou truncar historico para contornar.

### Implementacao e evidencia local do refinamento

- Escopo mantido exclusivamente na pagina de Agendamentos: sidebar contextual,
  periodos, filtros, cards, funis, graficos, recencia, tabela e rodape. Nenhuma
  migration, workflow n8n, regra CAIXA ou outra rota foi alterada.
- House abre selecionado e exclusivo; Imob e manual. As metas diarias House
  seguem 1 por dia util e 2 as quintas. Imob permanece sem classificacao de
  produtividade de agendamentos quando a meta nao existe.
- QA de producao local aprovada: 21 capturas em cinco viewports e tres temas,
  zero falhas, Axe, overflow ou colisao. Fluxos de calendario, clique externo,
  filtros compostos, pop-ups, tabela, teclado, reordenacao, hover, 200%, valores
  grandes e estados indisponiveis/restritos foram exercitados.
- Evidencia: `test-results/appointments-preview/result.json`, `passed: true`,
  21 telas. Artefatos sao sinteticos e locais; nao contem dados de clientes.
- A matriz Linux do run `40290352317` completou 154 rotas, 88 variacoes de tema,
  242 auditorias Axe e 242 capturas. O unico bloqueio funcional ficou no
  cabecalho de Agendamentos em 1440 px: navegacao sem geometria suficiente e
  alvo `Tema claro` sobreposto. A compactacao do breakpoint foi corrigida apenas
  para essa rota; a QA local focada voltou a aprovar 21/21 antes da nova CI.
- Lint passou sem erros (38 avisos preexistentes fora do escopo); typecheck e
  build passaram. Vitest: 4.293 aprovados e 110 condicionais ignorados. Node:
  1.599 aprovados, 19 ignorados e tres falhas Windows preexistentes em Meta Ads
  (`connection-monitor` e `vps/session`) por contratos POSIX/arquivo privado;
  nenhum arquivo Meta Ads foi alterado. A CI Linux e a autoridade para esses
  contratos. Merge e publicacao ainda serao registrados separadamente. O sync
  segue impedido pelo limite preexistente do exportador e nao deve ser descrito
  como concluido.

### Captura autenticada do refinamento aprovada

- Run protegido `40298568730`, artifact `12640948998`, head
  `b5c80df99422364bd01926b523b54aa0efec6be1` e captura de merge
  `90dcbe04b389ea144890bb1d5b82658333fc0f38`, em
  `2026-10-26T09:53:37.533Z`. SHA256 do arquivo:
  `6ce308fe31b8a8464b155b0818630cfee3bc92f8f2ad8dd6812f7b02436f9010`.
- Build, E2E e matriz autenticada funcional/Axe/zoom passaram. Revisadas as 11
  imagens de Agendamentos: sete larguras, tres temas desktop e dark mobile, sem
  corte, sobreposicao ou overflow visivel. O estado autenticado sintetico sem
  dados valida shell e layout; a QA local 21/21 valida o conteudo preenchido.
- Incorporadas somente as 11 imagens, 11 entradas de screenshot, uma entrada
  responsiva, uma de zoom e uma proveniencia. Outras rotas e matrizes foram
  preservadas. Os testes de paridade aprovaram 27 casos e ignoraram um
  condicional. CI completa, merge e publicacao ainda sao obrigatorios.

## 2026-10-26: publicacao da pagina de Agendamentos

- Escopo comportamental exclusivo de `/app/etapas/agendamentos`: sidebar, funis,
  nomes compactos, participacao, expansao/reordenacao e metas. Nenhuma migration
  ou workflow n8n alterado. Demais rotas mantem a navegacao existente.
- PR #350 integrado em `5ed6260600f22cbaab348eb67f900bbbe653f932`.
  CI PR `40259124348` e CI push/main `40263238224` aprovadas. Na main passaram
  validate, release-gates, isolated-restore e promotable-image.
- Validacao final: 79 testes especificos, lint/typecheck/build; QA sintetica
  com CSS de producao 18/18 e composicao sidebar 24/24 nos tres temas.
  Zero colisoes eixo/valor e zero overflow do Ranking Score nos cenarios.
- Artefato imutavel: arquivo SHA256
  `0961a1074ec37eb879a5816bed868822c319474edb6a223765c01acfaa85f8f6`.
  ID CI `sha256:073125eb98bf424b325f777ec2926a2f3465849c5502401a901c90ba3b7e0053`;
  ID local `sha256:a2d421bbf725296dce309e031647963409af7473673fcb684e57e33bf8a2df8d`.
  Equivalencia comprovada por indice OCI, manifesto, configuracao, 11 camadas,
  RootFS, plataforma e label; image:prove aprovou os dois perfis, sem rebuild.
- Coordenador `release:production` concluiu deployment
  `d04aed32-b1af-4ff7-a768-4d5f7e4189d9` em `2026-10-26T04:04:22.711Z`
  (01:04:22 America/Sao_Paulo), sem pendencia. Backup privado preservado em
  `/etc/descomplica-crm/backups/appointments-5ed62606-20261026`; imagem anterior
  `ec98b41a` preservada. Consulta/CAS/CI/main dentro do coordenador obrigatorio.
- Health publico em 26/10/2026 01:07:57 -03:00: status ok e versao exata
  `5ed6260600f22cbaab348eb67f900bbbe653f932`. GET anonimo da rota retornou 307
  para login. Fontes: `/api/health`, ledger do coordenador e GitHub Actions.
- Smoke autenticado em producao: desktop 1440x900 e celular 390x844 nos tres
  temas, sidebar aberta/recolhida, popup, ordem DOM ao mover/restaurar e filtro
  House/Imob. Sem overflow horizontal da pagina nos tamanhos verificados;
  popup mobile com largura interna 370/370 px. Sem erros no console observado.
  House exibiu metas diarias 32/64/0 para dias uteis/quintas/fins de semana;
  semanas 96/192 conforme datas reais; meta mensal 768. Imob sem meta e sem
  classificacao de produtividade. Estado restaurado para House e tema medio;
  override de viewport removido. Prova visual local em test-results, nao exportada.
- Limite: QA com dados sinteticos nao constitui conciliacao Salesforce; smoke
  confirma a jornada publicada. Nenhuma alteracao fora do pedido para liberar gates.
- Obsidian: sync novamente tentado; falha preexistente `Documento excede o limite
de exportacao.` Registro versionado preservado; sincronizacao pendente ate
  correcao autorizada do exportador/limite em demanda propria. Nao truncar historico.

Validacao complementar em 25/10/2026: producao CSS corrigiu sobreposicao em 24/24 cenarios; a composicao encontrou rolagem residual de 4px no Ranking Score em 1024px com sidebar aberta. Altura das barras ajustada apenas nesta pagina. Build aprovado; repeticao final de 18+24 cenarios em andamento. CI Linux b7a9ab: validate e isolated-restore aprovados, release-gates em andamento. Ainda nao publicado.

## 2026-10-25: validacao local da pagina de agendamentos

- QA complementar da composicao preenchida com sidebar detectou colisao
  eixo/valor em 1024px. Correcao restrita ao CSS de Agendamentos reserva espaco
  superior e compensa a altura das barras, sem aumentar cards. Vite CSS: 24/24
  aprovado. Build producao e lint direcionado aprovados; QA de producao 18+24
  em andamento. Referencias autenticadas sem dados nao substituem esse teste
  da composicao preenchida. Nenhuma baseline de outra rota foi modificada.
- Candidate autenticado `40251775496` aprovado; artefato `12622015999`, captura
  do merge sintetico `cdb9a3c5` cujo head e `32b65849`. Incorporacao restrita a
  11 imagens e 38 entradas de `/app/etapas/agendamentos`, com proveniencia
  parcial no manifesto. Outras 231 imagens e 56.733 nos JSON preservados.
  Reference-parity: 15 testes aprovados e um condicional nao executado.
  Capturas autenticadas cobrem shell/sidebar e estado sem dados; QA sintetico
  com CSS de producao cobre graficos preenchidos em 18 telas, aprovado apos
  revisao de ordem DOM/foco. CI `40251775493`: validate/isolated-restore verdes;
  o novo commit de referencias requer nova CI antes de merge/publicacao.
- Revisao posterior ao primeiro commit do PR #350: a reordenacao agora altera
  a arvore React com chaves estaveis e restaura foco; teste isolado DOM aprovado.
  Conversoes sem dimensao Ranking Score ficam indisponiveis sob esse filtro,
  evitando numerador e denominador de bases distintas. Media diaria considera
  os dias do filtro de semana; KPIs diarios usam as metas das datas respectivas.
  Suite especifica atualizada: 79 testes aprovados; nova rodada de build e QA
  de producao em execucao antes de publicar o SHA revisado.
- Escopo efetivo restrito a `/app/etapas/agendamentos`; componentes do shell
  compartilham arquivos, mas o comportamento novo exige a rota exata. Testes
  de regressao preservam navegacao nas demais paginas.
- Build, typecheck, lint sem erros e 74 testes especificos aprovados.
  QA com CSS de producao: 18 combinacoes de viewport/tema, zero falhas e
  zero erros JavaScript; expansao, reordenacao e emulacao de layout a 200%
  verificadas com fixtures sinteticas. Evidencia local em
  `test-results/appointments-preview/result.json`.
- Suite completa Windows: restricoes POSIX nos testes operacionais/release;
  CI Linux continua gate obrigatorio. Timeout associativo isolado passou ao
  repetir sem build concorrente, sem alteracao fora do escopo. Fontes publicas
  da politica documental aprovadas. Merge e publicacao ainda pendentes.
- Obsidian permanece pendente por limite de exportacao do documento; nao
  alterar o exportador nem apagar historico para liberar esta entrega.

## 2026-10-25: abertura da revisao de navegacao e graficos de agendamentos

- Refinamento direto de escopo: todas as mudancas de comportamento, inclusive
  navegacao lateral, limitadas a `/app/etapas/agendamentos`. Demais rotas devem
  preservar a interface anterior. Meta diaria House confirmada em 1 por dia
  util e 2 as quintas por corretor; Imob permanece nulo.

- Base conferida: origin/main `6a0f678e`, PR #349 integrado no GitHub.
  Health publico consultado em 2026-10-25T23:55Z: HTTP 200, status ok,
  versao `ec98b41a`. A diferenca corresponde ao fechamento documental.
- Escopo solicitado: sidebar Dashboard recolhivel, organizacao e expansao dos
  graficos de agendamentos, nomes compactos, participacao no total filtrado,
  alertas de recencia e metas exatas por dia, semana e mes.
- Context e search do runtime de conhecimento falharam por documento acima do
  limite de exportacao. A fonte versionada permanece disponivel; sincronizacao
  pendente, sem alterar limites ou apagar historico para contornar a falha.

## 2026-10-25: publicacao do hover ampliado e filtros herdados dos funis

- O PR #346 integrou a correcao no merge
  `c6de29d42d92451375562544b74b7a8151435334`. A CI do PR
  `40220666085` aprovou `validate`, `isolated-restore` e `release-gates`.
  Antes da publicacao, `main` avancou para
  `ec98b41aedc721c22fff4f28dca9b31bc6317373`, que contem esse merge.
- A CI de `push/main` `40229956828` aprovou `validate`, `release-gates`,
  `isolated-restore` e `promotable-image`. O artefato `12611779563` foi
  conferido na revisao exata; o ZIP tem digest
  `sha256:bf69ed8a0441034d5dd6f12b20e17216d373d89c1ddb1e70fd73ffd60d51ae12`
  e a imagem publicada tem ID
  `sha256:ffc69336a9e5c31d3eaacd7c696f4bfa9caafd2bff6aa3c8d781e9e98e3768e6`.
  Os dois perfis passaram no `image:prove`, sem rebuild.
- A producao registrou o deployment
  `1b484b04-19ac-4513-8cd0-985c464d41fa` em
  `2026-10-25T21:16:08.906Z`. O ledger ficou sem pendencia. A verificacao de
  `2026-10-25T21:18:45.7307378Z` confirmou `/api/health` HTTP 200,
  `status=ok`, versao exata, e `/app` anonimo em HTTP 307 para `/login`.
- O smoke autenticado na versao publicada confirmou no CSS carregado o
  acionador transparente e `scale(1.035)` no hover da etapa. Com Empresa
  `Direcional` selecionada na pagina, o pop-up abriu com `Direcional` e
  `DIRECIONAL VENDAS SPC` pre-selecionados e exibiu dez registros no recorte.
  Nenhum dado foi alterado. A verificacao deixou o dashboard aberto.
- O `knowledge:sync` final foi executado, mas o exportador recusou
  `ATUALIZACOES.md` porque o documento excede o limite de exportacao. O
  conhecimento completo permanece versionado neste arquivo; a sincronizacao
  com o Obsidian fica pendente ate o limite ou a estrategia de particionamento
  ser revisada em tarefa propria.

## 2026-10-25: abertura dos funis e filtro regional de Agendamentos

- A branch `codex/agendamentos-funis-gerente-regional-v9` iniciou limpa sobre
  `origin/main` `fa1124e9caa70cbcbe6dad274ce5aa13c7706137`. O conector do GitHub nao
  retornou workflow de PR nem status combinado para esse commit; portanto a CI
  desse SHA permanece sem evidencia observavel nesta abertura.
- O health publico consultado em `2026-10-25T17:50:56.7406463Z` respondeu HTTP
  200, `status=ok`, na versao `c2c823e1284f19322da0da36e0cb8146bf7ec497`.
  A versao publicada e distinta da `main` usada como base.
- Escopo exclusivo: compactar os 12 indicadores; adicionar Gerente Regional
  antes de Gerente de Vendas; mover a limpeza para a linha do titulo; criar os
  funis esperado e realizado com cinco conversoes; e incluir rankings positivos
  de conversao Agendamento para Visita por responsavel, gerente e gerente
  regional. Todos devem respeitar os filtros da pagina. Outras paginas, dados
  remotos, n8n e regras nao citadas permanecem fora do escopo.
- Implementacao local concluida: a projecao autorizada preserva as seis etapas
  agregadas e a RPC de metas entrega o funil mensal vigente para House e
  Parcerias. O filtro regional deriva a vinculacao mais recente por gerente e
  restringe cards, funis, rankings, graficos e tabela sem ampliar grants.
- Validacao em Node 24.19.0: 53 testes focais aprovados; lint sem erros (36
  avisos preexistentes fora do escopo); typecheck e build aprovados. O Vitest
  integral aprovou 4.194 testes e ignorou 108. O trecho Node aprovou 1.599,
  ignorou 19 e manteve tres falhas Windows preexistentes de permissao/caminho
  em Meta Ads; a CI Linux permanece o gate definitivo. O pgTAP local ficou
  indisponivel por ausencia de Docker/Podman e sera executado no restore isolado.
- Evidencia visual local: 18 combinacoes de tema e viewport, incluindo 1024x720,
  1440x720, mobile e zoom 200%, sem overflow horizontal, corte ou falha Axe.
  PR, CI, merge e publicacao ainda nao estavam concluidos neste registro.

## 2026-10-25: hover ampliado e filtros herdados no detalhamento dos funis

- A nova demanda parte de `origin/main` no SHA
  `fa1124e9caa70cbcbe6dad274ce5aa13c7706137`. O ajuste anterior estava
  publicado e saudável, mas o realce translúcido ainda pintava a faixa ao
  passar o mouse, contrariando a preferência visual apresentada.
- O hover agora mantém o acionador transparente e aplica `scale(1.035)` à etapa
  completa, sem mudança de layout. O foco de teclado permanece independente e
  `prefers-reduced-motion` elimina a transição.
- O pop-up antes zerava todos os seus filtros em cada abertura. O provedor agora
  recebe os filtros efetivos da página e inicializa canal, gerente, responsável
  e empresa com esses valores. O estado interno aceita múltiplos valores e
  preserva a semântica “Todos” quando o usuário limpa o recorte no diálogo.
- Evidência focal em Node 24.19.0: 2/2 testes aprovados, incluindo Chromium nos
  temas claro, médio e escuro e larguras 320, 390 e 1440 px; foram confirmados
  fundo transparente, escala da etapa, filtro herdado, alteração para “Todos”,
  fechamento por Escape/clique externo, foco e ausência de overflow horizontal.
- `pnpm lint`, `pnpm typecheck` e `pnpm build` passaram. A suíte Vitest passou
  com 4.194 testes e 108 ignorados; a etapa Node passou 1.599 testes e manteve
  três falhas ambientais conhecidas dos utilitários Meta Ads que exigem
  permissões POSIX indisponíveis no Windows. A CI Linux permanece o gate de
  integração sem qualquer redução ou desativação desses testes.

## 2026-10-25: Previsao corrigida e publicada para usuarios autorizados

- O PR #340 foi integrado no `main` como
  `b2a6a17284e030796819f6f6f2ec989aba682e85`. A CI de `main`
  [40206513995](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40206513995)
  concluiu com sucesso `validate`, `release-gates`, `isolated-restore` e
  `promotable-image` no SHA exato.
- Com autorizacao especifica do usuario, somente a migration
  `20261025114724_forecast_page_users_edit.sql` foi aplicada ao projeto
  `hnncxuerlcsaahdxoswb`; o ledger remoto registrou
  `20261025155920 / forecast_page_users_edit`. Nenhuma migration pendente
  anterior foi aplicada e nenhuma previsao foi reescrita.
- A verificacao posterior confirmou owner `postgres`, `SECURITY DEFINER`,
  `search_path` fixo, `anon=false`, `authenticated=true` e
  `service_role=false` nas duas RPCs. O guard da pagina permanece e o guard
  legado de edicao foi removido. Os advisors nao introduziram achado novo
  especifico desta migration; avisos preexistentes permanecem fora do escopo.
- O artefato `12603254883` conferiu `revision.txt` e SHA-256
  `e47a28db7ff5fa9f7132b5688226decdd5212b0daa90caf5cdabfb4e7a22aa71`.
  Na VPS, `image:prove` aprovou os dois perfis com a imagem
  `sha256:bd65e93cd9252c155402cfe8b0d294e27b0862e3c0cee69c0748f2aee45bd22f`,
  sem rebuild.
- O coordenador protegido concluiu o deployment
  `f9701ac1-a9a8-4da5-a5d7-2cac9d2fe559` em
  `2026-10-25T16:20:35.009Z`, sem pendencia. Health publico confirmou
  HTTP 200, `status=ok` e a versao exata; a API anonima permaneceu em HTTP 401.
- Smoke autenticado na selecao House/Amanda carregou a tabela sem a mensagem
  de erro. Inserir linha e coluna ficaram habilitados, e os campos de corretor,
  Previsao, Realizado e Plano de acao foram expostos como editaveis. Nenhum
  valor real foi alterado ou salvo durante a verificacao.

## 2026-10-25: abertura do ajuste visual no hover dos funis

- O Git comum foi confirmado em
  `C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git`. A demanda
  parte de `origin/main` no SHA `6cf298414ba0a7541386db433ab04f76822a7ae5`;
  a CI desse `push/main` ainda estava em execução no run `40196635124` durante
  a abertura.
- O health público respondeu HTTP 200, `status=ok`, versão
  `8e8271abe344129455773cce7b65da5671d24aa2`. Essa versão inclui o popup dos
  funis e antecede somente o registro documental atual de `main`.
- Escopo solicitado: retirar o contorno retangular do hover das etapas
  clicáveis e preservar um realce visual discreto, sem alterar foco de teclado,
  valores, filtros, popup, permissões ou dados.
- A causa era o `box-shadow` interno de 3 px no acionador absoluto do popup. A
  correção troca somente o hover por uma camada translúcida de 14% da cor de
  destaque; o `outline` de `:focus-visible` permanece para usuários de teclado.
- Evidência local em Node 24.19.0 e pnpm 11.20.0: teste focado 2/2 nos temas
  claro, médio e escuro e larguras 320, 390 e 1440 px; lint sem erros, typecheck
  e build aprovados. O Vitest completo aprovou 4.194 e ignorou 108. O comando
  `pnpm test` terminou com as três falhas Windows preexistentes de Meta Ads
  relacionadas a arquivo privado e caminho POSIX; a CI Linux continua sendo o
  critério de integração, sem redução de gate ou alteração desses testes.

## 2026-10-25: abertura do erro de carregamento e edicao da Previsao

- A demanda iniciou na branch `codex/previsao-edicao-todos-usuarios`, criada
  sobre `origin/main` `6cf298414ba0a7541386db433ab04f76822a7ae5`. A CI de
  `main` `40196635124` estava em andamento para esse SHA; a execucao anterior
  `40168434992` passou no SHA `8e8271abe344129455773cce7b65da5671d24aa2`.
- O health publico consultado em `2026-10-25T08:43:06-03:00` respondeu HTTP
  200, `status=ok`, `version=8e8271abe344129455773cce7b65da5671d24aa2`.
  Portanto a producao observada ainda correspondia ao ultimo SHA aprovado e nao
  a `main` mais recente. A captura fornecida comprova o erro visivel de carga na
  selecao House/Amanda, mas ainda nao identifica a causa tecnica.
- O escopo autorizado e corrigir carga, edicao e salvamento para qualquer
  usuario que ja possua acesso a pagina Previsao. A autorizacao da pagina
  continua obrigatoria no servidor; nenhuma ampliacao anonima ou contorno de
  RLS sera presumido. Nenhuma mutacao remota foi executada nesta abertura.

### Implementacao e validacao local

- **Causa confirmada:** o endpoint autenticado de producao respondeu
  `forecast_unavailable`; o ledger remoto nao contem
  `20261022184500_forecast_value_edit_roles`, enquanto a aplicacao publicada
  valida `can_edit` e `can_manage_structure`. As funcoes remotas tambem nao
  continham esses campos, conforme inspecao de definicao e ACL.
- **Correcao preparada:** `20261025114724_forecast_page_users_edit.sql`
  recompoe o contrato e autoriza valores e estrutura somente quando
  `crm.management.forecast.view` ja foi aprovada. API, RPC, conta ativa, MFA,
  pagina ativa, validacao, CAS, auditoria, RLS e ACL permanecem obrigatorios;
  Geral continua somente leitura.
- **Testes:** 74 testes focados da Previsao passaram; os 85 testes focados de
  API e manifestos passaram; `pnpm lint` passou com 36 avisos preexistentes,
  `pnpm typecheck` passou e `pnpm build` passou em Node 24.19.0. A suite
  integral executou 4.192 testes aprovados e teve um unico timeout preexistente
  do Associativo; o mesmo teste passou isolado (13/13, 3,48 s). PgTAP local
  ficou indisponivel porque o host nao possui Docker ou Podman; a CI de
  restauracao isolada permanece obrigatoria antes da migration.
- **Pendente:** CI independente, merge, autorizacao especifica e aplicacao da
  migration, publicacao coordenada e verificacao autenticada sem gravar dados
  reais.
- **Excecao de fonte:** a primeira CI do PR #340 aprovou a suite completa, mas
  a Prefeitura de Sao Paulo respondeu HTTP 403 na fonte publica de ITBI. A
  excecao fail-closed existente foi renovada somente para a branch/merge do PR
  #340, somente para as duas URLs e status 403/503 ja previstos, usando o ultimo
  snapshot versionado e com expiracao em `2026-10-26T03:00:00Z`. Mudanca de
  valores, URL, status, politica ou prazo continua bloqueando a CI.
- **Correcao da excecao:** a segunda CI confirmou que as duas URLs cadastradas
  na excecao antiga nao coincidiam com os enderecos `www2` versionados na
  politica; por isso o fallback nunca era elegivel. O cadastro foi alinhado
  literalmente aos dois URLs da politica, sem ampliar dominio ou caminho.

## 2026-10-25: dimensoes responsivas de Agendamentos validadas

- Implementado somente em `/app/etapas/agendamentos`: alturas responsivas dos
  graficos e tabela ajustada ao viewport com rolagem vertical interna.
- Evidencia local: QA da folha de estilos de producao aprovou 18 combinacoes de
  1440x900, 1440x720, 1024x900, 1024x720, 390x900 e 320x900 nos tres temas. Em
  1024x720, cada par de linhas mede 560 px e a tabela mede 608 px.
- `pnpm lint`, `pnpm typecheck`, build e 29 testes focais passaram. O Vitest
  global aprovou 4.193 testes; a etapa Node encontrou tres falhas ambientais de
  permissao/path do Meta Ads no Windows, externas ao escopo. A CI Linux do SHA
  da entrega permanece o gate integral para publicacao.
- Nao foram alterados metricas, filtros, dados, cores, outras paginas ou n8n.

## 2026-10-25: abertura do ajuste de dimensoes em Agendamentos

- A branch `codex/agendamentos-graficos-tabela-v8` iniciou limpa em
  `origin/main` no SHA `6cf298414ba0a7541386db433ab04f76822a7ae5`. Esse
  commit e documental e nao possui checks proprios associados na consulta; o
  estado publicado observado permanece distinto da `main`.
- O health publico consultado em `25/10/2026 08:39` BRT respondeu HTTP 200,
  `status=ok` e versao `8e8271abe344129455773cce7b65da5671d24aa2`.
- Escopo exclusivo: alterar somente alturas, espacamentos e comportamento
  responsivo dos graficos e da tabela em `/app/etapas/agendamentos`, para que
  cada linha superior e inferior caiba integralmente no viewport de PCs e para
  que a tabela ocupe a area visivel com rolagem apenas interna. Metricas,
  filtros, cores, dados, outras paginas e n8n ficam fora do escopo.

## 2026-10-25: detalhamento dos funis integrado e publicado

- O PR #333 foi integrado no SHA
  `cc13a3d7b1a2c2de3b3257310e4e66795cd5db8a`. A CI de `push/main`
  `40164155042` aprovou `validate`, `isolated-restore`, `release-gates` e
  `promotable-image` no mesmo SHA. O gate de navegador aprovou o Dashboard com
  dados sinteticos, autorização, clique e teclado, responsividade, temas,
  zoom, acessibilidade e contenção horizontal.
- O artefato imutável `12587144483` teve digest ZIP
  `sha256:15cbe433b6d5c45b5d55c175b05836dbb4d2cd2bce204621166661230d07d74e`.
  `revision.txt` e o checksum de `image.tar.gz`
  `sha256:1de219ab3bc025c9d08541c74061a279e6885df0372bff1de59f070eebbc138b`
  foram conferidos antes da transferência. A imagem foi carregada sem rebuild
  ou retag; `image:prove` aprovou os dois perfis no image ID local
  `sha256:c1bce48364b366a8f594566aa419539d2374af5d0bb266a23f26549da1d248e9`.
- O coordenador `pnpm release:production` publicou o deployment
  `f3ee0965-d7ff-4f75-9e5f-b5b15450eff7` em
  `2026-10-25T05:54:16.400Z`, usando como CAS o deployment
  `f4fd67bc-8a4b-48a3-b908-78b913e9e21c` no SHA `e8d362b2...`. O ledger final
  ficou sem pendência, o container permaneceu `healthy` e o health público
  respondeu HTTP 200, `status=ok` e a versão exata `cc13a3d7...`.
- O acesso anônimo a `/app` respondeu HTTP 307 para `/login`. O smoke
  autenticado manual em produção não foi forçado: o controlador visual do
  Windows interrompeu a sessão por não conseguir confirmar a URL do navegador
  com segurança. A evidência autenticada desta entrega é a CI Linux aprovada;
  reavaliar o smoke manual somente com uma janela cuja URL possa ser confirmada.
- Nenhuma migration, mutação de dados Salesforce, alteração de coleta, n8n,
  DNS, cobrança ou política comercial integrou esta publicação. O diálogo
  continua limitado às colunas dimensionais preservadas no snapshot seguro;
  colunas descartadas pelo contrato não são simuladas nem expostas.

## 2026-10-25: estado publicado apos entrega concorrente

- Na conferencia final de `2026-10-25T03:06:13Z`, o coordenador de producao
  registrou o deployment concorrente `d2025a28-18c1-4f1d-a6a9-7df37a00d145`,
  sem pendencia, no SHA `94c6f73e8d389c330c595e15fe838a321bd78118` e imagem
  `sha256:34d82fc1e00a1bc3b18b5b6490573a7028c2c123732eba8dbda9b60bac0c5884`.
  O health publico respondeu HTTP 200, `status=ok` e a mesma versao.
- O Git confirmou que `94c6f73e...` tem `b46b8a0e...` como pai direto. Assim,
  a publicacao posterior de Meta Ads preserva integralmente o modulo Lead ja
  publicado; ela apenas substitui o recibo de deployment ativo. Naquela
  conferencia, a `main` documental estava em
  `e8d362b22d139d9c8c2ba3f4001c3f7708a3f61e`, com a CI
  `40159944573` aprovada nos quatro jobs obrigatorios e sem novo restart por ser
  somente documentacao.
- Durante a integracao do registro final, a `main` avancou para
  `cc13a3d7b1a2c2de3b3257310e4e66795cd5db8a`, com a entrega independente de
  detalhes interativos do Dashboard. Esse SHA foi incorporado ao PR #337 sem
  ampliar o escopo do Lead e continua descendendo do runtime `b46b8a0e...`.
- Na nova conferencia de `2026-10-25T03:37:01Z`, o coordenador registrou o
  deployment `f4fd67bc-8a4b-48a3-b908-78b913e9e21c`, sem pendencia, no SHA
  `e8d362b22d139d9c8c2ba3f4001c3f7708a3f61e` e imagem
  `sha256:dce8c568fd785756c5add57fd2a3a1bc5e2c38fd07860d38b7f5d53858acd88a`.
  O health sem cache respondeu HTTP 200, `status=ok` e a mesma versao; o Git
  confirmou que esse SHA descende de `b46b8a0e...`, preservando o Lead.

## 2026-10-24: detalhamento seguro e responsivo dos funis implementado

- Implementado em `codex/dashboard-stage-details`: cada etapa autorizada dos 13
  funis abre um diálogo com período, filtros por coluna, soma do recorte e
  paginação visual de 50 combinações. No celular, as linhas viram cartões e não
  exigem rolagem lateral da página.
- O detalhamento reutiliza os fatos agregados do snapshot autorizado e preserva
  a allowlist do coletor. Não expõe IDs, contas, nomes de oportunidade/pasta,
  valores individuais ou registros de clientes. Colunas adicionais descartadas
  pelo contrato atual não são apresentadas como se estivessem disponíveis.
- Canal, gerente, responsável, empresa e empreendimento só entram quando
  disponíveis após filtros e redações do servidor. A permissão da página da
  etapa controla o botão; `approved-folders` compartilha a permissão e a fonte
  de Pastas. Meta mensal, esperado até hoje e médias explicam que a tabela mostra
  o realizado usado como referência, não linhas constituintes da meta.
- A revisão do PR #333 passou a usar uma única função para recortar tanto o
  número do funil quanto seu detalhamento ao mês vigente. Períodos que começam
  no mês anterior não vazam linhas para o diálogo. O acionador também só é
  exibido quando a coleta certifica a etapa e o período de referência; ausência
  de snapshot ou de cobertura permanece indisponível, nunca como zero confirmado.
- Evidência no Node 24.19.0: lint, typecheck e build passaram. Os 107 testes
  focados passaram. A matriz Playwright passou em 320, 390 e 1440 px nos temas
  `light`, `balanced` e `dark`, incluindo clique/teclado, filtros, Escape,
  backdrop, restauração de foco e contenção horizontal.
- O Vitest integral mais recente aprovou 4.189 casos, ignorou 108 e teve três
  timeouts em testes antigos de DevTools/paridade; os dois arquivos envolvidos
  aprovaram 39 casos e ignoraram um quando repetidos isoladamente com 120 s. As
  suítes Node/release da execução anterior repetiram
  falhas Windows/POSIX preexistentes do Meta Ads descritas no Worklog. Nenhum
  arquivo Meta Ads foi alterado. No PR #333, `validate` e `isolated-restore`
  aprovaram; o primeiro `release-gates` detectou corretamente que o botão
  absoluto havia virado terceiro filho do grupo `<dl>`. O botão foi movido para
  dentro do `<dt>`, preservando a área clicável e restaurando a semântica. O
  teste de navegador agora executa Axe sobre essa estrutura. Após os ajustes de
  revisão, 122 testes focados aprovaram, incluindo a regra compartilhada de
  recorte e a ausência de acionador sem cobertura; merge e publicação continuam
  condicionados à nova CI Linux do SHA final.

## 2026-10-24: abertura do detalhamento dinamico dos funis

- Escopo solicitado: ao selecionar uma etapa dos funis do Dashboard Geral,
  abrir um pop-up que respeite os filtros ativos e apresente dinamicamente as
  colunas exportadas pelo relatorio Salesforce correspondente, sem fixar uma
  grade unica para todas as etapas.
- Abertura em 24/10/2026 19:32 BRT: Git comum confirmado; branch
  `codex/dashboard-stage-details` criada limpa a partir de `origin/main` no SHA
  `b8aca02928351f0d18f3fee4cb40f30c9c007ac5`. O checkout antigo continha uma
  alteracao documental alheia e foi preservado sem modificacao.
- O health publico respondeu HTTP 200, `status=ok`, versao
  `bc227b62d39628a447d8637d5f8b3503c9e3cbcf`; portanto, producao e `main`
  permanecem em estados distintos. O conector GitHub nao retornou workflow run
  ou status associado ao SHA exato da `main`; CI atual fica indisponivel nesta
  abertura e nao sera presumida como aprovada.
- Nenhum dado remoto, coleta Salesforce, schema ou permissao foi alterado. A
  implementacao deve reutilizar o snapshot autorizado, preservar os dois canais
  definidos e evitar persistir registros ou identidades reais em testes.

## 2026-10-24: modulo Lead concluido e publicado

- O nucleo funcional do menu `Lead` foi integrado pelos PRs #323, #330, #331
  e #332. A `main` final de runtime e
  `b46b8a0e5203dde0a1bc0d77ad8e835bb6fedf5a`; a CI `40143354357` aprovou
  `validate`, `isolated-restore`, `promotable-image` e `release-gates` no mesmo
  SHA. O escopo inclui nove paginas protegidas e a rota autenticada de
  exportacao, sem sincronizacao de dados ou dependencia de runtime do C2S.
- O banco remoto recebeu somente as quatro migrations Lead:
  `20261024224326 crm_leads_core`, `20261024224340 crm_lead_operations`,
  `20261024224356 sync_page_catalog_leads` e
  `20261024234616 crm_lead_foreign_key_indexes`. A primeira tentativa da
  migration principal falhou atomicamente por depender de
  `crm_organizations`; nao deixou residuo. O modelo final usa workspaces
  proprios e `profiles.is_active`, compativel com o schema produtivo observado.
- A verificacao remota final confirmou 24 tabelas Lead com RLS e FORCE RLS, 24
  politicas MFA, zero grant DML direto para `anon`, `authenticated` ou
  `service_role`, 24 permissoes, nove paginas e zero chave estrangeira Lead sem
  indice. A base permaneceu vazia: zero leads e zero clientes foram criados.
  Os advisors mantem somente os avisos esperados de RPCs `SECURITY DEFINER`
  autenticadas, que executam guards internos, e de indices novos ainda sem uso.
- O artefato `12578864673` apresentou digest ZIP
  `sha256:460930509425dccc931ac9edd180ec61a559a32b5d756ff3ea40ce7463c04649`,
  digest da imagem compactada
  `sha256:9563b56f5d7b37e627555a3af34aa37af23b8b8c0e2583b6cdd0cafafa1e5532`
  e revisao exata. No Docker containerd do destino, `image:prove` validou os
  dois perfis sobre a imagem local
  `sha256:56b14a773b73842536a5025741b8efdd80de5c971ad52dfd13cd29698154d72b`,
  sem rebuild ou retag.
- O coordenador `pnpm release:production` publicou o deployment
  `1d79e00b-89f5-481f-8a9b-39f2a54e856b` em
  `2026-10-25T00:31:00.530Z` (`24/10/2026 21:31:00` em
  America/Sao_Paulo), substituindo o deployment
  `878399cb-0bce-472f-a808-da78e58ea311` no SHA `bc227b62...`. O status final
  nao possui pendencia; o health publico respondeu HTTP 200, `status=ok` e a
  versao exata, e o acesso anonimo a `/app/leads` respondeu HTTP 307 para
  `/login`.
- Limites preservados: nenhuma credencial recebida foi persistida ou exibida,
  nenhum dado do C2S foi importado, nenhum workflow n8n foi alterado e nao
  houve mudanca de DNS, cobranca ou dados comerciais existentes. O aviso
  `MODULE_TYPELESS_PACKAGE_JSON` emitido pelo coordenador e apenas de
  performance do carregamento Node; nao alterou o resultado da publicacao.

## 2026-10-24: abertura dos indicadores e da ordem visual de Agendamentos

- A branch `codex/agendamentos-indicadores-layout-v7` iniciou no `origin/main`
  `b8aca02928351f0d18f3fee4cb40f30c9c007ac5`. A CI de `main`
  `40135665115` tinha `validate`, `isolated-restore` e `promotable-image`
  aprovados, com `release-gates` ainda em execução na consulta de abertura.
- O health público respondeu HTTP 200, `status=ok` e versão
  `bc227b62d39628a447d8637d5f8b3503c9e3cbcf`; portanto, a versão publicada e a
  `main` integrada estavam distintas no início desta demanda.
- Escopo funcional exclusivo: `/app/etapas/agendamentos`. A demanda reduz e
  uniformiza os 12 cards, amplia a inclinação conforme o ponteiro, adiciona
  bordas indicativas de meta, usa metas dinâmicas House/Imob nas três conversões
  e reorganiza os gráficos na ordem solicitada, sem alterar outras páginas,
  n8n ou dados remotos. A implementação exige uma migration aditiva e estreita
  para expor somente as três razões de conversão autorizadas à página.

## 2026-10-24: implementação dos indicadores e da ordem visual de Agendamentos

- Os 12 indicadores têm altura uniforme 10 px menor e inclinação por ponteiro
  em um arco total de 45 graus. A moldura animada local usa azul para condição
  positiva e vermelho para condição negativa, com texto acessível e alternativa
  sem animação para `prefers-reduced-motion`.
- Meta do mês compara total e projeção; Equipe Produtiva compara com 100%; média,
  ontem e hoje comparam com a quantidade filtrada de corretores. As conversões
  comparam a razão exibida com a meta vigente do perfil, considerando razão
  igual ou menor como positiva conforme a solicitação.
- A RPC `read_crm_appointments_conversion_goals(date)` retorna apenas três
  razões derivadas, exige `crm.stage.appointments.view`, usa `search_path` vazio
  e concede execução somente a `authenticated`. House usa a meta `dv`; o perfil
  Parcerias permanece neutro porque o schema vigente obriga Oportunidades e
  Agendamentos a zero nesse perfil.
- A ordem visual passa a ser: Evolução diária isolada; três gráficos operacionais;
  rankings Responsável, Gerente e Gerente Regional; três painéis de recência;
  Agendamentos por mês isolado. O hover das barras usa azul-escuro.
- Evidência local: 58 testes focados aprovados; lint e typecheck aprovados;
  build Next.js aprovado; preview com CSS de produção aprovou 12 cenários em
  temas, larguras, zoom e estados, sem falhas. A suíte integral aprovou 4.179
  testes e registrou cinco timeouts concorrentes externos ao escopo; os 106
  testes dos quatro arquivos afetados passaram em série. O `test:release`
  preserva falhas Windows conhecidas do fixture sintético de Meta Ads; a CI
  Linux, merge e publicação são estados posteriores e não são afirmados por
  este registro.

## 2026-10-24: continuidade autorizada ate concluir o modulo Lead

- Pedido direto do usuario: continuar a implementacao e somente encerrar quando
  o modulo Lead estiver integralmente concluido. A autorizacao cobre a replica
  funcional estudada, mantendo os limites de seguranca, privacidade, dados
  remotos, publicacao e integracoes ja registrados.
- Retomada em 24/10/2026 02:53 BRT: a branch
  `codex/lead-c2s-discovery` permanece no SHA
  `b403071c1b749476f638bd6a36dcaedfcce033be`, com o primeiro incremento local
  nao commitado. `origin/main` esta em
  `9c0ab96c35d03c278860da4bb814f21420c3febf`.
- Na CI `40065913388` da `main`, `validate`, `promotable-image` e
  `isolated-restore` continuam aprovados e `release-gates` segue em andamento.
  O health publico respondeu HTTP 200, `status=ok`, versao
  `74b76c248c67e62b5cfad5e721389f1c81431a43`; portanto, a versao publicada
  permanece distinta da branch local e da `main`.

## 2026-10-24: primeiro incremento protegido do menu Lead

- Escopo implementado: menu raiz `/app/leads`, hub e filhos
  `/app/leads/lista`, `/app/leads/atividades` e `/app/leads/funil`.
- As quatro páginas possuem chaves `crm.leads.*`, permissões independentes,
  guards de servidor derivados do registro e concessão inicial somente a Admin
  e Master. O catálogo versionado passou de 32 para 36 páginas na migration
  `20261024053147_sync_page_catalog.sql`; preferências e exceções existentes
  permanecem preservadas pelo gerador oficial.
- A interface reutiliza os componentes e temas do CRM. Enquanto a fonte oficial
  não for definida, exibe `Fonte não configurada`, mantém busca, filtros e ações
  desabilitados e não apresenta leads, valores, zeros ou etapas fictícias.
- Limites mantidos: nenhum banco de leads, RLS, integração C2S, token, webhook,
  cadastro, edição, distribuição, importação, exportação, WhatsApp ou mutação
  remota foi criado. Esses itens dependem de incrementos próprios.
- Evidência local no Node 24.19.0 e pnpm 11.20.0: lint sem erros e com os 32
  avisos preexistentes do protótipo Meta Ads; typecheck, build de 65 rotas,
  `pages:check` (36 páginas), `resources:check` (10 áreas/70 rotas), Gitleaks e
  `git diff --check` passaram. O Vitest integral aprovou 4.139 testes e ignorou
  107; a repetição isolada do timeout do Next DevTools aprovou 24/24.
- O comando `pnpm test` não conclui verde no Windows: a etapa Node aprovou 1.599,
  ignorou 19 e repetiu três falhas preexistentes de ACL/perfil POSIX do Meta Ads.
  `pnpm test:release` também falhou em 11 de 12 casos do host Meta Ads por
  ausência de arquivo sintético. Nenhum arquivo Meta Ads foi alterado, pois é
  área externa ao pedido. Esses gates impedem PR, merge e publicação.
- Encerramento em 24/10/2026 02:49 BRT: `origin/main` avançou externamente para
  `9c0ab96c35d03c278860da4bb814f21420c3febf` (PR #322, correção do `undici`),
  enquanto a branch Lead permanece baseada em
  `b403071c1b749476f638bd6a36dcaedfcce033be`. Na CI `40065913388` da nova
  `main`, `validate`, `promotable-image` e `isolated-restore` estavam aprovados;
  `release-gates` seguia em andamento. O health público respondeu HTTP 200,
  `status=ok`, versão `74b76c248c67e62b5cfad5e721389f1c81431a43`, que não
  corresponde ao checkout nem à `main` atual. A divergência foi preservada e a
  entrega não foi mesclada ou publicada.

## 2026-10-24: abertura do levantamento do CRM C2S

- Escopo solicitado: estudar o Contact2Sale/C2S e a conta fornecida pelo usuario
  antes de iniciar qualquer implementacao do novo menu `Lead`. A credencial
  recebida nao foi transcrita nem persistida; telas e dados autenticados serao
  tratados como fonte de conhecimento, sem exportar leads ou dados pessoais.
- Em 24/10/2026 02:05 BRT, o checkout estava limpo, em `HEAD` destacado no SHA
  `b403071c1b749476f638bd6a36dcaedfcce033be`, igual a `origin/main` depois de
  `git fetch origin --prune`. O GitHub confirmou `main` protegida no mesmo SHA.
- A CI do `main` no run `40061774780` terminou com falha no job `validate`, etapa
  `Audit high and critical vulnerabilities`; `promotable-image`,
  `isolated-restore` e `release-gates` foram ignorados. Esta falha preexistente
  nao sera corrigida neste levantamento, pois esta fora do escopo do chat.
- O health publico `https://crm.descomplicapro.com.br/api/health` respondeu HTTP
  200, `status=ok`, versao
  `74b76c248c67e62b5cfad5e721389f1c81431a43`. A versao publicada diverge do
  `main` atual, portanto o SHA local/integrado nao esta comprovado como publicado.
- Fontes: Git remoto e conector GitHub em 24/10/2026; health observacional sem
  autenticacao em 24/10/2026 02:05 BRT. O CLI `gh` estava indisponivel neste
  host, mas a consulta equivalente de leitura pelo conector GitHub funcionou.
- O levantamento foi concluido antes da implementacao e registrado em
  `docs/audits/c2s-leads-discovery-2026-10-24.md`. A conta autenticada confirmou
  navegacao, cadastro e filtros de leads, funil Kanban/analise/consultores,
  filas com auditoria/captacao/check-in, relatorios, administracao e modulos
  opcionais. Fontes publicas oficiais completaram modelo de dados, API,
  distribuicao, webhooks e limites de LGPD.
- A pesquisa preservou a fronteira entre Gestor de Leads, CRM Imob, C2Sgo,
  Vetra e recursos contratados. Nenhuma credencial, token, lead, proposta,
  contato de cliente ou identidade de colaborador foi persistida. Nenhuma
  mutacao remota foi executada e o menu `Lead` ainda nao foi criado.
- Pendencias para iniciar codigo: aprovar o conjunto do primeiro incremento,
  definir fonte autoritativa, permissoes, canais, deduplicacao, retencao e
  auditoria. O dashboard novo permaneceu em carregamento na sessao observada e
  nao foi usado como evidencia funcional.
- Validacao no Node 24.19.0 e pnpm 11.20.0: `lint` passou com 32 avisos
  preexistentes no prototipo Meta Ads; `typecheck`, `build`, `pages:check`,
  `resources:check`, `security:secrets` e `git diff --check` passaram. O Vitest
  aprovou 4.131 testes e ignorou 107. A suite Node aprovou 1.599, ignorou 19 e
  falhou em tres testes de permissoes POSIX do Meta Ads no Windows, fora do
  escopo: dois do destino privado de status e um do diretorio de perfil.
- Encerramento em 24/10/2026 02:19 BRT: branch local
  `codex/lead-c2s-discovery`, ainda sem commit, baseada no SHA
  `b403071c1b749476f638bd6a36dcaedfcce033be`, igual a `origin/main`. A CI
  `40061774780` desse SHA continuava falha e o health permaneceu HTTP 200,
  `status=ok`, versao `74b76c248c67e62b5cfad5e721389f1c81431a43`.
  Publicacao documental bloqueada pelos gates falhos; nenhuma correcao fora do
  escopo, PR, merge, deploy ou reinicio foi executado.

## 2026-10-24: publicação final dos ajustes exclusivos de Agendamentos

- O PR #315 integrou somente os ajustes funcionais pedidos para
  `/app/etapas/agendamentos`. Os PRs #320 e #322 corrigiram, respectivamente,
  `body-parser` e `undici` transitivos para restabelecer gates obrigatórios;
  nenhuma outra página recebeu mudança funcional por esta entrega.
- A `main` exata `a6d139e2871fddbec1a4ca0685b5810e8a940b37` foi aprovada pela
  CI `40069497659`, tentativa 2, nos quatro jobs obrigatórios. O artefato
  imutável `12551435375` apresentou digest ZIP
  `sha256:ce8e9cf61b8c56ee91f7bf7ba88e52d73955e1f58c6b0df5a1e377144088f511`,
  revisão correspondente e a mesma imagem nos perfis de homologação e produção.
- O coordenador `pnpm release:production` registrou o deployment
  `190d0766-34aa-406d-98f9-da7c46023b3a` em `2026-10-24T07:13:38.177Z`
  (`04:13:38` em America/Sao_Paulo), sem `pendingDeploymentId`. Às
  `2026-10-24T07:14:57Z`, o health público respondeu HTTP 200, `status=ok` e a
  versão exata; a rota anônima respondeu HTTP 307 para `/login`.
- Duas tentativas anteriores foram interrompidas antes de mutação: uma por
  argumento contaminado por retorno de carro e outra porque a `main` avançou
  durante a validação. O CAS preservou a produção. A integração concorrente do
  PR #318 foi mantida, sem ser modificada neste trabalho. Não houve migration,
  mudança de n8n, DNS, cobrança ou mutação de dados remotos.

## 2026-10-23: layout e filtros exclusivos de Agendamentos

- A entrega permanece limitada a `/app/etapas/agendamentos`: uniformiza os 12
  cards, compacta cinco gráficos, organiza seis rankings/recências em 3 por 2,
  verticaliza os rótulos de score e adiciona realce de hover e inclinação sutil.
- A revisão identificou que atividade não comprova elenco cadastrado. Os filtros
  por gerente e responsável passaram a usar a coorte mensal oficial em
  `crm_ranking_participants`, conciliada antes e depois da leitura com o snapshot
  do dashboard. Corretores sem atividade permanecem no denominador; divergência,
  paginação incompleta ou falta de acesso resulta em valor indisponível.
- Os filtros de canal, empresa, data e gráficos continuam aplicados às métricas
  operacionais. Eles não alteram contagens cadastrais quando a fonte oficial não
  contém a dimensão correspondente.

## 2026-10-23: regra maxima de escopo exclusivo por chat

- Pedido direto do usuario em 23/10/2026: cada chat do DESCOMPLICA-CRM deve
  executar somente os ajustes explicitamente solicitados naquele chat. A regra
  vale para novos chats e retomadas; conhecimento do Obsidian, GitHub, site ou
  repositorio serve como contexto verificavel e nao amplia o pedido.
- Falha de CI, teste ou gate em outra pagina deve ser reportada como bloqueio
  externo. Nao corrigir outra area, atualizar sua referencia visual ou agregar
  melhoria alheia para obter verde. Esse trabalho depende de pedido proprio.
- Aplicacao nesta demanda: o PR #311, que atualizava uma referencia visual da
  pagina Documentacao durante a entrega de Agendamentos, foi encerrado sem merge
  e removido dos artefatos do chat. A entrega funcional permanece limitada a
  `/app/etapas/agendamentos`; o bloqueio global alheio permanece apenas relatado.
- A regra foi versionada no PR #312, commit
  `e2549916d95ff7f2dd7931bcf0fdd4457c652622`, e sincronizada no Obsidian com
  `status=synced`. `lint`, `typecheck` e `build` passaram no Node 24.19.0.
  `pnpm test` aprovou 4.106 testes, ignorou 107 e encontrou um timeout no teste
  existente do Associativo; a repeticao isolada manteve o mesmo timeout. Nenhum
  arquivo do simulador foi alterado, pois ele esta fora do escopo deste chat.
  Esta mudanca e somente documental e nao requer deploy do CRM.
- Na conferencia final de 23/10/2026 00:48 BRT, `origin/main` permanecia em
  `de07674bf40f6053ccc7da0fff6a0bf178983125`; o health publico respondeu HTTP
  200, `status=ok`, na versao ainda publicada
  `db78b3c89b849d62932d3e6871884ace2a440afe`. O PR #312 estava aberto e ainda
  sem checks reportados no GitHub. Portanto, a regra ja esta ativa na memoria e
  no Obsidian, mas sua integracao na `main` permanece pendente dos gates.

## 2026-10-22: modais e alertas globais do Meta Ads

- Os doze dialogos do dashboard agora respeitam a area realmente visivel do
  iframe dentro do CRM. A pagina externa nao precisa rolar; conteudo maior usa
  somente a rolagem interna do dialogo.
- O alerta do Meta Ads foi movido para a barra superior e depende, no servidor,
  da pagina `crm.meta_ads` e da permissao `crm.meta_ads.view`. A comunicacao com
  o iframe atualiza contagem e abre a central sem expor o recurso a outros
  perfis.
- Integracoes exibe somente o card superior da API oficial do Meta Ads. Os
  controles e o dialogo do console antigo foram removidos da interface, sem
  alterar Salesforce, outros dashboards, banco ou o Gerenciador de Anuncios.
- Evidencia local: `pnpm verify` passou; Vitest aprovou 4.102 testes e ignorou
  106; suites Node aprovaram 1.616/5 ignorados e release 727/14 ignorados. O QA
  Chromium aprovou as quatro visoes, os doze dialogos e 60 combinacoes da barra
  superior. Merge, CI do `main`, imagem e publicacao ainda nao estavam
  comprovados neste registro.
- A CI do PR detectou dois contratos visuais antigos: Integracoes ainda
  procurava a caixa/console Meta removida, e a navegacao arquivada ignorava o
  novo sino na ordem de teclado. O gate foi atualizado para exigir o card
  API-only, ausencia dos controles legados e a sequencia tema, alerta, perfil.
  Em 1.181 px, o espacamento do cabecalho foi reduzido de 16 para 12 px para
  eliminar nove pixels de overflow interno sem remover itens ou alterar outros
  dashboards. Os 39 testes focados passaram antes da nova CI.

## 2026-10-22: abertura do calendario e da recencia de Agendamentos

- A nova etapa iniciou sobre `origin/main`
  `920d2d7f82c667addfef1a0d40021ba242171344`, com o registro documental da
  entrega anterior ainda no PR #302. O health publico consultado em
  `2026-10-22T13:34:56-03:00` respondeu HTTP 200, `status=ok`, na versao
  `877966a71d28923f82258f6f053990844a7c6f35`; o runtime publicado contem a
  correcao concorrente da Previsao e as funcionalidades anteriores de
  Agendamentos.
- O escopo acrescenta calendario acessivel com selecao de um ou varios dias,
  move período e limpeza para a barra de filtros, recalcula o painel no mesmo
  recorte, centraliza os indicadores, melhora os nomes dos meses e inclui tres
  paineis de recencia por corretor antes do grafico mensal.
- O contrato v4 possui data, corretor e gerente nos agendamentos, mas conserva
  apenas totais cadastrais agregados. A recencia sera limitada aos corretores
  cadastrados com agendamento na cobertura validada; o gerente sera o do registro
  mais recente. Totais cadastrais nao serao convertidos em atividade para
  aparentar uma segmentacao inexistente. Nenhum dado remoto foi alterado nesta
  abertura.
- A implementacao aplica datas descontinuas aos detalhes e aos fatos do funil,
  preserva o historico necessario para calcular o ultimo agendamento e exibe as
  faixas 0-7, 8-14 e 15 dias ou mais antes do grafico mensal. A tabela usa a data
  da linha como parte do filtro composto, sem duplicar semana e dia.
- Lint, typecheck e build de 61 rotas passaram com Node 24.19. Vitest aprovou
  4.102 testes e ignorou 106 após a atualização para Next.js 16.4.1. O preview sobre o CSS compilado
  de producao aprovou 12 combinacoes de tema e largura, sem overflow, colisoes ou
  violacoes Axe. O comando agregado sem limite de workers excedeu apenas o
  timeout de um teste do Associativo que passou isolado e na suite limitada; na
  composição final, os três testes Node POSIX conhecidos permanecem incompatíveis
  com Windows e devem ser confirmados pela CI Linux antes da integração.
- A revisão do PR confirmou e corrigiu quatro limites: o gráfico anual usa ano e
  dimensões sem herdar dias/semana; dias do calendário substituem a semana ativa;
  cobertura parcial continua anunciada por `aria-live`; e conversão sem base não
  é anunciada como zero por cento. Os testes focados aprovaram 18 casos.

## 2026-10-22: filtros e indicadores de Agendamentos publicados

- Os PRs #295, #298, #299 e #301 entregaram o painel, corrigiram a origem e o
  formato agrupado do gerente dos corretores e trocaram as fontes municipais do
  gate documental pelo espelho oficial acessivel. A entrega de runtime foi
  integrada na `main` em
  `a031980b55979d5dfa10983bc2c4e6b1cf9fff5e`.
- A migration aplicada no projeto Supabase de producao esta registrada como
  `20261022002223_appointments_filters_kpis_v4`. A leitura v4 confirmou 32
  corretores, cinco gerentes distintos, 1.117 agendamentos e 9.397 fatos, sem
  ampliar o payload autorizado alem das contagens e dimensoes do painel.
- A CI de `main` `39732189784` aprovou `validate`, `release-gates`,
  `isolated-restore` e `promotable-image`. O artefato `12405607281` conferiu com
  SHA-256
  `8e2e584083629e99b18a06c13df4e1832d3474e1b616e8a09c1fde1e3b9ea355`;
  a imagem promovida tem ID
  `sha256:c0a7ce9b0d0d8c8ce7071e4c3445e073dff8e12f3205a9ad6dcbffa0e292047d`.
- O coordenador `release:production` publicou o deployment
  `db4cfa82-ea62-4c71-be17-38bfe6df2645` em
  `2026-10-22T06:57:55.202Z`. O ledger permaneceu sem pendencia, o health
  publico respondeu HTTP 200/`ok` na versao exata e a rota anonima de
  Agendamentos redirecionou para `/login` em HTTP 307.
- O servico do coletor passou a executar a partir do checkout imutavel desse
  SHA, com backup privado
  `20261022T065926Z-a031980b5597`. Dois ciclos consecutivos publicaram com HTTP
  201 e request IDs `e43c8402-f50b-41f9-a4dd-4a474ab4004d` e
  `f7e54207-a279-4802-b585-6d94e913fd22`; ambos leram 20.508 oportunidades,
  1.130 agendamentos, 532 visitas, 738 vendas e 32 corretores. O segundo
  inventario conteve 3.277 itens e SHA-256
  `30e8f131e213e8a42a358464af262a13ee9202d4e9f62c379c9b38686009867e`.
- Typecheck e build passaram localmente; o lint local excedeu a memoria do host,
  enquanto 187 testes documentais e a CI Linux integral passaram. A suite local
  aprovou 4.088 testes Vitest e 1.599
  testes Node, com 105 e 19 ignorados. Permanecem somente tres incompatibilidades
  POSIX conhecidas dos testes Meta Ads no Windows; os mesmos gates passaram no
  Linux. Nenhum workflow n8n foi alterado.

## 2026-10-22: diagnostico e correcao da visao Geral vazia da Previsao

- A abertura ocorreu na branch `codex/previsao-geral-fallback`, baseada em
  `origin/main` `9c655968f2a1032b4f015d48021659438538eae3`. O health publico consultado
  em 22/10/2026 respondeu HTTP 200, `status=ok`, na versao publicada
  `a031980b55979d5dfa10983bc2c4e6b1cf9fff5e`; portanto a producao continha a
  entrega anterior da visao Geral, mas ainda nao esta correcao.
- A causa confirmada estava na rota `GET /api/forecasts`: a RPC retornava o
  ultimo modelo salvo, mas a rota o descartava para `segment=general`. Em um
  final de semana sem registros, a resposta mantinha `sections=[]` e a tela
  mostrava apenas a mensagem vazia.
- O fallback agora devolve uma copia limpa do modelo somente quando o periodo
  nao possui secoes. A tabela Geral preserva os nomes dos empreendimentos e
  apresenta House, Imob, Previsao, Realizado e totais com zero; valores, nomes de
  corretores e planos de acao de periodos anteriores nao sao reutilizados.
- Evidencia local: 108 testes de API e dominio, 13 cenarios Chromium, lint,
  typecheck e build passaram. A suite Vitest integral aprovou 4.098 testes e teve
  um timeout concorrente do simulador associativo, cujo arquivo aprovou 13/13
  isoladamente. Os testes Node e de release preservaram falhas locais de
  permissoes POSIX e arquivos privados no Windows, fora deste diff. A CI Ubuntu,
  merge e publicacao foram comprovados no encerramento.
- O PR #303 teve a CI `39781264990` aprovada e foi integrado no SHA de `main`
  `877966a71d28923f82258f6f053990844a7c6f35`. A CI de `main` `39787672222`
  concluiu com sucesso, inclusive o artefato promocional. O arquivo do artefato
  teve SHA-256 `f538673e2990ac85e9f540b76bc3998af538ed26b522a849ff49cad227a0ec76`;
  a imagem foi comprovada nos perfis de homologacao e producao pelo manifest
  `sha256:af4041db9035a707e09289ab69cfd6a6070dc6e35aaa0b07dea0cd2db1784fdf`.
- O coordenador protegido publicou o SHA exato no deployment
  `17ecee4a-16cf-4753-871f-9d506b40e7b6`, registrado em
  `2026-10-22T14:38:30.076Z`. A verificacao posterior confirmou o container em
  execucao e o health publico HTTP 200, `status=ok`,
  `version=877966a71d28923f82258f6f053990844a7c6f35`. A pagina anonima
  redirecionou para `/login` e a API anonima respondeu HTTP 401. Nenhuma
  migration ou mutacao direta de dados foi necessaria nesta correcao.

## 2026-10-21: abertura dos filtros e indicadores de Agendamentos

- O trabalho iniciou na branch `codex/agendamentos-filtros-kpis`, criada sobre
  `origin/main` `755659e9a467db2758f8a17dfd8ce126ddf8948a`. A CI da `main`
  `39661432708` concluiu com sucesso para esse SHA. O health publico consultado
  em `2026-10-21T17:54:48-03:00` respondeu HTTP 200, `status=ok` e a mesma
  versao, portanto codigo integrado, CI e runtime estavam alinhados na abertura.
- O escopo solicitado acrescenta os filtros Canal de vendas, Gerente de Vendas,
  Responsavel da conta e Empresa; substitui o indicador de agendamentos no mes
  por Equipe Produtiva; inclui conversoes do funil e contagens operacionais; e
  compacta os graficos para leitura responsiva em zoom de 100%. A sexta metrica
  repetida pelo pedido sera tratada como Vendas no periodo para completar o
  funil, sem duplicar o card de visitas.
- As fontes de corretores e gerentes continuam sendo o relatorio Salesforce
  `00OTT000009j0l32AA`; as demais metricas devem usar somente fatos e dimensoes
  vigentes do snapshot autorizado. Nenhuma alteracao remota, migration ou
  publicacao foi executada nesta abertura.

## 2026-10-21: implementacao local dos filtros e indicadores de Agendamentos

- O contrato analitico v4 acrescenta Canal, Empresa, pertencimento ao elenco
  oficial e a contagem distinta de gerentes do relatorio de corretores. A
  coleta valida em cada ciclo o rotulo `Gerente de Vendas: Nome completo` e
  falha fechada se o campo esperado deixar de corresponder ao relatorio.
- A leitura autorizada projeta apenas contagens agregadas de Oportunidades,
  Agendamentos, Visitas e Vendas. Pastas, valores financeiros e aprovacoes
  permanecem fora do payload; snapshots v1, v2 e v3 continuam compativeis.
- A interface recebeu os quatro filtros globais, Equipe Produtiva em rosca,
  conversoes e razoes do funil, gerentes, visitas e vendas no periodo. O sexto
  indicador repetido no pedido foi materializado como Vendas para completar o
  funil. Ranking Score nao possui mais rolagem interna e o desktop conserva
  tres graficos por linha.
- Evidencia local: lint, typecheck, build, 47 testes focados, 39 testes da
  coleta e 12 cenarios Chromium passaram. A suite integral aprovou 4.086 testes
  Vitest e pulou 105. Os testes de host Meta Ads dependentes de permissoes POSIX
  falham no Windows fora deste diff; a CI Linux do SHA integrado permanece o
  criterio de publicacao. Migration, PR, CI, coletor e runtime ainda nao foram
  alterados neste ponto.

## 2026-10-21: corretores automaticos da Previsao publicados

- O PR #283 foi integrado na `main` em
  `9dcd80286ee5a5819b65f8104873f7f9df0d24bf`. A CI final do PR
  `39541633316` aprovou validacao, restore isolado e gates de release. A CI da
  `main` `39544892670` aprovou os mesmos gates e gerou o artefato promovivel
  `12320948464`; o verificador documental precisou apenas de nova tentativa
  depois de a fonte publica da Prefeitura de Sao Paulo responder HTTP 503.
- O ZIP do artefato conferiu com
  `sha256:7bd9c0137262eaa041683b911cbbb7d8c76e26439e58af2d8ec3254a70205ad3`
  e a imagem interna com
  `sha256:2309df8f667cb3cd28d6a7d582d580acebfa8ac8e78357cc90383d9fce736167`.
  A diferenca esperada entre a config da CI
  `sha256:7009060378af4f3729fabd6d1681949aa028a1f851abd9ec4c3182b7cc0f9892`
  e o manifesto containerd
  `sha256:ea534e46426cbe5d345e1d3ed8c0d1273fad804053581587b5fcbca8d26fc9d9`
  foi comprovada pelo indice OCI, hashes dos blobs, manifesto legado, onze
  camadas, RootFS, plataforma linux/amd64 e label da revisao. `image:prove`
  aprovou os dois perfis de runtime sem rebuild.
- A consulta protegida encontrou o candidato exato ja ativo em
  `2026-10-21T05:32:50.804Z`, deployment
  `a451a387-e13b-4ea0-84da-7288e8d2df3f`, sem pendencia; por isso nao houve
  republicacao. A verificacao de `2026-10-21T05:39:50Z` confirmou health HTTP
  200/`ok` na versao exata, redirecionamento anonimo da pagina de Previsao para
  login em HTTP 307 e API de previsoes anonima em HTTP 401.
- As migrations autorizadas permanecem registradas no Supabase: Plano de acao
  `20261021002706`, periodos `20261021002724`, elenco `20261021002737` e
  normalizacao dos gerentes `20261021021551`. O pos-check manteve zero periodos,
  uma previsao legada na revisao 5, RPC restrita a `authenticated` e somente o
  aviso informativo de indice para a FK `crm_forecast_periods.updated_by`.
- O registro documental final passou em lint, typecheck e build de 57 rotas com
  Node 24.19/pnpm 11.20. A suite integral aprovou 4.064 testes, pulou 105 e teve
  oito timeouts sob carga local; os cinco arquivos repetidos aprovaram 97 de 98,
  e o unico timeout restante aprovou os 13 casos ao ser executado isoladamente.

## 2026-10-21: painel inteligente de Agendamentos publicado e reconciliado

- O PR #289 integrou o painel interativo no commit
  `1c015d61c040549d4028b5e3f6905d36fd6c2d5c`. A publicacao preservou a
  entrega concorrente de Previsao e promoveu o `main` final
  `9dcd80286ee5a5819b65f8104873f7f9df0d24bf`, cuja CI
  `39544892670` aprovou `validate`, `release-gates`,
  `isolated-restore` e `promotable-image`.
- A pagina passou a calcular a meta mensal pela projecao individual do funil
  multiplicada pelos corretores cadastrados, exibir velocimetro, previsao por
  dia da semana, rankings reorganizados, tabela decrescente e filtros cruzados
  acionaveis por barras e linhas. O QA especifico aprovou 12 combinacoes de
  tema/largura, sem overflow ou violacao Axe; lint, typecheck, build de 57
  rotas, 4.071 testes Vitest e as suites Linux protegidas passaram.
- A migration aditiva `appointments_goal_read` foi aplicada via Supabase MCP.
  A RPC e `SECURITY DEFINER`, estavel, usa `search_path` vazio, concede
  EXECUTE somente a `authenticated` e devolve nulo sem sessao. O artefato
  promovivel `12320948464` teve `image.tar.gz`
  `sha256:2309df8f667cb3cd28d6a7d582d580acebfa8ac8e78357cc90383d9fce736167`.
  A equivalencia entre config CI
  `sha256:7009060378af4f3729fabd6d1681949aa028a1f851abd9ec4c3182b7cc0f9892`
  e manifesto containerd
  `sha256:ea534e46426cbe5d345e1d3ed8c0d1273fad804053581587b5fcbca8d26fc9d9`
  foi comprovada pelo indice OCI, 11 camadas, RootFS e revisao exata.
- O coordenador publicou em `2026-10-21T05:32:50.804Z`
  (`21/10/2026 02:32:50` America/Sao_Paulo), deployment
  `a451a387-e13b-4ea0-84da-7288e8d2df3f`, sem pendencia. Health publico
  retornou HTTP 200/ok na versao exata e a rota anonima de Agendamentos
  continuou em HTTP 307 para `/login`.
- A divergencia 78 versus 74 estava no detalhamento: datas Salesforce sem
  horario eram interpretadas em UTC e recuavam um dia em Sao Paulo. O coletor
  foi atualizado sob `installation.lock`, com backup privado e CAS, de
  `38e8c2af7a64a89e75bfb60a7fc6e21383baee1f` para `9dcd8028`.
  No primeiro ciclo corrigido, requestId
  `f3240d78-cec7-47e8-af54-5300dfb419aa`, outubro reconciliou 78 fatos com
  78 linhas e 20/10 reconciliou 9 com 9; a ultima data detalhada avancou para
  20/10. O segundo ciclo distinto, requestId
  `df398e0c-1a34-4d8f-b2a6-6df68156713a`, publicou HTTP 201 em
  `2026-10-21T06:05:34.300Z` e concluiu o inventario de 3.283 itens em
  `2026-10-21T06:06:00.474Z`. Conferencia posterior do snapshot corrente
  manteve 32 corretores, 78 fatos versus 78 linhas em outubro e 9 versus 9
  em 20/10, sem duplicidade ou regressao apos ciclos adicionais.
- Na conferencia de encerramento, `origin/main` e o health publico coincidiram
  em `0b2f107e4c706653141b22fb54d2d37e367f2255`, apos uma publicacao
  concorrente de Meta Ads; a CI Linux `39558061100` passou. Sobre esse `main`,
  lint, typecheck, build de 61 rotas e 4.081 testes Vitest passaram localmente.
  A suite Node aprovou 1.596 e ignorou 19; tres fixtures de ACL/POSIX exclusivas
  do Meta Ads continuam incompativeis com Windows, fora deste escopo e verdes
  na CI Linux citada.

## 2026-10-20: metas Imob publicadas e validadas

- O PR #285 foi integrado na `main` em
  `0b7fc85fe898b9778ea5899fc222e50240692753`. A CI de PR `39522168474`, o
  candidato visual `39522168518` e a CI de `main` `39527457177` aprovaram
  formatacao, lint, tipos, testes, build, restore isolado, banco, autorizacao,
  navegador e a matriz responsiva completa. O PR #278 ficou encerrado como
  entrega substituida.
- A migration de Previsao `forecast_period_scopes` ja constava no remoto como
  `20261021002724`, aplicada pela entrega concorrente junto de
  `forecast_action_plan` e `forecast_broker_roster`; por isso nao foi repetida.
  A migration autorizada do Dashboard Imob foi aplicada via Supabase MCP como
  `20261021021046 dashboard_imob_goals`. A policy resultante exige
  `crm.dashboard.view` e `crm.dashboard.with_canal_imob.view`; os advisors
  posteriores mantiveram somente avisos preexistentes fora do escopo.
- O artefato promovivel `12313489767` teve ZIP
  `sha256:d2c3f77c4700d7f540d09e0a5058b0da35a761c99a0f17908cae38d1a8638e0e`.
  O arquivo interno passou no checksum, revisao e label. A diferenca esperada
  entre config da CI `sha256:c443758f9df914b8b05df1aa7d7070cfab95b3cfc1baf540f9861bb2ae95354d`
  e manifesto containerd
  `sha256:76f51d2194893a1282abf07cfac5ca4ed64b7d90580bb0b536dddb0fca29790c`
  foi ligada pelo mesmo indice OCI, 11 camadas e RootFS. `image:prove` aprovou
  os dois perfis sem rebuild.
- O coordenador protegido publicou o SHA em `2026-10-21T02:13:21.009Z`
  (`20/10/2026 23:13:21` America/Sao_Paulo), deployment
  `d94c84ea-8b89-44ed-8cc6-e19cb09e9462`, sem pendencia. Health publico retornou
  HTTP 200/ok na versao exata e `/app` anonimo permaneceu em HTTP 307.
- O relatorio visual autenticado do SHA publicado aprovou Dashboard em 320,
  390, 768, 1440 e 1920 px nos temas claro, medio e escuro. `scrollWidth`
  coincidiu com o viewport em todos os cenarios; filtros fecharam por clique
  externo e Escape; historico Imob nao apresentou recorte; arredondamento para
  baixo e funis restritos passaram. O controlador CUA da aba autenticada local
  falhou ao inicializar por caminho ausente, portanto nao houve segunda captura
  manual pos-publicacao nesta sessao; essa limitacao nao substitui nem invalida
  a matriz protegida concluida no mesmo SHA.

## 2026-10-20: reconciliacao final com a main para metas Imob

- A branch `codex/dashboard-imob-goals-sync` integrou `origin/main` em
  `c1e931d5ad805f9f43766d67f1d7f297e99a31ae`, preservando tanto as metas e os
  quatro estagios Imob quanto as entregas posteriores de previsao e impressao.
- O inventario reconciliado contem 71 migrations, 37 arquivos pgTAP e 2.079
  assercoes esperadas. O teste focal do candidato de release aprovou 23 casos.
- No Windows, lint, typecheck e build de 57 rotas foram aprovados. A suite
  integral aprovou 3.975 testes e pulou 105; somente dois casos de I/O do
  `obsidian-knowledge` excederam o timeout sob paralelismo. O mesmo arquivo,
  executado isoladamente, aprovou os 22 casos. A CI Linux do SHA reconciliado
  continua obrigatoria antes da integracao e publicacao.
- A autorizacao explicita do usuario para aplicar a migration aditiva
  `20261020130000_dashboard_imob_goals.sql` vale somente para esta entrega. O
  coordenador protegido, o restore isolado, o artefato imutavel e a verificacao
  pos-publicacao permanecem obrigatorios.
- A primeira CI do SHA reconciliado aprovou formatacao, lint, typecheck e todos
  os testes, mas foi bloqueada por `GHSA-22jm-h49p-29qw` no SDK transitivo do
  `next-devtools-mcp`. O override passou de `1.31.0` para `1.32.1`; o auditor
  nao encontra vulnerabilidade alta ou critica apos a atualizacao.
- A reconciliacao posterior da `main` encontrou o novo aviso
  `GHSA-587h-7wmj-h5pm` no Vite transitivo do Vitest. O override minimo passa a
  usar `8.2.4`, sem alterar dependencias de runtime.

## 2026-10-20: implementacao local das metas Imob e referencia de coleta

- Status: implementacao local concluida na branch
  `codex/dashboard-imob-goals-sync`, ainda sem migration remota, merge ou
  publicacao. A base analisada foi `origin/main` em `aa8b2d6d`.
- Todas as paginas de relatorio ja usam o `generated_at` persistido do snapshot.
  O cartao Salesforce era a excecao: exibia `checkedAt`, que representa apenas
  a sondagem de conexao. Agora ele usa o mesmo `generatedAt` persistido, com
  `lastExportAt` como fallback de sessao.
- A meta ativa de `partnerships` passa a alimentar o Dashboard Imob. Visitas,
  Pastas, Pastas aprovadas e Vendas sao multiplicadas pelos sete gerentes
  informados; Meta esperada ate hoje aplica a proporcao do dia corrente sobre
  os dias do mes. O Dashboard arredonda as leituras exibidas para baixo.
- Os 13 funis Imob e seus historicos exibem apenas quatro estagios. House segue
  com seis. A conversao total Imob passa a representar Vendas sobre Visitas.
- A migration `20261020130000_dashboard_imob_goals.sql` altera apenas a policy
  SELECT de `crm_funnel_goals`: preserva acessos existentes e permite ler
  somente `partnerships` quando Dashboard e Imob estiverem autorizados. Escrita,
  grants e outros perfis nao mudam.
- Evidencias locais: 136 testes focais e 3.963 testes Vitest aprovados, com 102
  skips condicionais; lint, typecheck e build de 57 rotas aprovados com Node
  24.19. O QA visual aprovou 267 checks em cinco larguras e tres temas, incluindo
  filtros, historicos, Axe, overflow, cortes e sobreposicoes.
- Limites do host: pgTAP indisponivel por ausencia de Docker ou Podman. O comando
  integral para em tres testes Meta Ads dependentes de ACL/diretorios Linux; o
  gate de release reproduz o limite em fixtures fisicas do host. Os arquivos
  afetados nao pertencem a essa integracao. CI Ubuntu, restore isolado, 2.049
  assercoes pgTAP e gates fisicos continuam obrigatorios antes da migration ou
  publicacao.

## 2026-10-20: abertura do ajuste de atualizacao e metas Imob

- Checkout limpo criado de `origin/main` em
  `aa8b2d6d501ef1f15fe91b7bf95ba78f024a6526`, separado do branch documental
  anterior. Git comum confirmado em
  `C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git`.
- Consulta `2026-10-20T12:22Z`: CI `39421287684` da `main` em andamento no SHA
  `aa8b2d6d`; a anterior `39411919967` aprovou `099493a9`. Health publico
  HTTP 200, `status=ok`, versao publicada `08d050f9`. Estados local, integrado,
  CI e publicado permanecem distintos.
- Escopo: fazer paginas baseadas nos relatorios Salesforce exibirem a mesma
  referencia de atualizacao da integracao; em `Imob`, remover Oportunidades e
  Agendamentos de todos os funis e calcular Meta mes/Meta esperada com a meta
  ativa de Parcerias multiplicada pelos sete gerentes informados. Nao alterar
  dados remotos, disparar coleta ou mudar workflow n8n nesta abertura.

## 2026-10-20: Agendamentos v3 integrado, publicado e aceito em ciclos reais

- O PR #274 foi integrado no merge
  `aa8b2d6d501ef1f15fe91b7bf95ba78f024a6526`. A CI de `main`
  `39421287684` aprovou os quatro jobs obrigatorios e o coordenador publicou
  esse SHA no deployment `6e1e1f3e-2158-49a8-b4b7-21c979f19f9d`.
- O marcador Salesforce `-` em `Data de comparecimento` bloqueou corretamente
  a primeira coleta v3 sem substituir o snapshot valido. O PR #279 normalizou
  somente esse valor opcional para vazio e foi integrado no merge
  `38e8c2af7a64a89e75bfb60a7fc6e21383baee1f`. A CI de `main`
  `39448193292` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`.
- O artefato promovivel `12277458475` teve ZIP
  `sha256:a267a607a5d64b4b2a2a7d21cc36f3055b5af31614410e9ccb4c962aa4d488a7`
  e `image.tar.gz`
  `sha256:99edfb5fda1159533cd38e350892a8ac4dbf3ac20a9c0b5537b40b64c5ec4b82`.
  A VPS carregou a imagem sem rebuild ou retag e `image:prove` validou os dois
  perfis no image ID containerd
  `sha256:c773025e48f9552966fd4c0a06ab502cc36f74a5d6e10813be019d953abeff5c`.
- O coordenador publicou `38e8c2af` em `2026-10-20T16:11:22.558Z`, deployment
  `b065193c-ea11-4a6b-b87f-08f6097f1f59`; health publico confirmou HTTP 200,
  `status=ok` e a versao exata, e a rota anonima de Agendamentos manteve o
  redirecionamento 307 para login.
- A atualizacao do coletor ocorreu sob `installation.lock`, com backup privado
  `20261020T161256Z-38e8c2af7a64`. Unidade, ledger, credenciais e agenda foram
  preservados; o `WorkingDirectory` passou ao merge corretivo, o navegador
  manteve o PID e o monitor legado permaneceu desabilitado.
- O aceite exigia dois ciclos reais, mas quatro ciclos consecutivos foram
  confirmados entre `16:35Z` e `18:05Z`, todos com requestIds distintos,
  publicacao HTTP 201 e estoque concluido. As quatro runs mais recentes no
  Supabase estavam `succeeded`, com 143 registros comerciais cada. O snapshot
  vigente foi gerado em `2026-10-20T18:03:02.814Z`; a analise continha tres
  visoes em versao 3, 32 corretores, 1.104 agendamentos normalizados e 9.320
  fatos. A ultima carga de estoque confirmou 3.286 registros.
- Durante o aceite, outro fluxo autorizado avancou `main` e producao para
  `50f11d326cdd37b051db46f1dd1015076b85d545`, descendente de `38e8c2af`.
  Em `2026-10-20T18:26:10Z`, o health publico confirmou essa versao; o ledger
  registrava o deployment `2ab11987-4b0e-4843-baad-75e90de6319c`, concluido em
  `2026-10-20T17:51:11.098Z`, sem pendencia. A funcionalidade de Agendamentos
  permanece contida na versao atualmente publicada.
- Ao reconciliar a nota final com `main`, a CI `39490513559` detectou o advisory
  de alta severidade `GHSA-22jm-h49p-29qw` no
  `@modelcontextprotocol/sdk@1.31.0`, transitivo do `next-devtools-mcp`. O pin
  de desenvolvimento foi atualizado para a versao corrigida 1.32.1; a nova CI
  permanece obrigatoria antes da integracao da evidencia.
- A CI `39493034178` aprovou validacao, build e auditoria, mas o gate visual de
  Previsão leu as cores do cabecalho durante a transição CSS de 140 ms. A falha
  foi reproduzida localmente com valores intermediarios diferentes e corrigida
  apenas no sincronismo do teste: ele agora aguarda a igualdade final original.
  Os 12 cenarios focados passaram; runtime, estilos e criterios visuais nao
  foram alterados. Uma nova CI integral continua obrigatoria.
- Na repetição da CI `39505860620`, a fonte oficial de ITBI respondeu e o gate
  passou. O audit então detectou o advisory novo de alta severidade
  `GHSA-587h-7wmj-h5pm` no Vite 8.2.0, transitivo do Vitest. O override foi
  elevado para a versão corrigida 8.2.4; lockfile, audit e CI integral precisam
  ser validados novamente antes da integração.
- Validação local do Vite 8.2.4 com Node 24.19.0: instalação congelada, audit
  sem alta/crítica, lint, typecheck, formatação, build de 57 rotas e 12 cenários
  de navegador de Previsão aprovados. Vitest aprovou 4.063 testes. A suíte Node
  aprovou 1.595, ignorou 19 e repetiu somente as três falhas POSIX já conhecidas
  do Meta Ads no Windows; a CI Linux permanece como gate conclusivo.
- A CI Linux `39508368548` aprovou integralmente o head `c6fa842c`, incluindo
  validacao, release-gates e restauracao isolada. A primeira tentativa encontrou
  HTTP 403 temporario na fonte oficial de ITBI; a repeticao respondeu e concluiu
  todos os gates. A reconciliacao preservou estas evidencias junto das alteracoes
  concorrentes de `main` em `22abfd7d`.

## 2026-10-20: confirmacao do teto nominal das anuais

- Fonte: pedido direto do usuario nesta continuacao. O teto da anual considera
  somente seu valor nominal, nunca o valor final corrigido com juros. Esta
  confirmacao resolve a ressalva da verificacao autenticada abaixo; nao altera
  taxas, correcao, limites de aprovacao ou outros simuladores.
- Codigo existente confirmado: getAssociativeAnnualLimit divide a renda por
  dois com truncamento decimal em centavos; o otimizador usa esse teto nominal.
  Nenhuma alteracao de runtime foi necessaria.
- Recalculo direto dos dois fluxos com o cenario dos prints: Linear
  4 x 13269.73, saldo 27327.47; Decrescente 4 x 14508.87, saldo 22370.91.
  Anuais nominais 1275.00 em dezembro de 2027/2028/2029. Ambos aprovados e ambos
  reprovados ao reduzir em 0.01 cada pagamento inicial. Resultado igual ao
  teste autenticado anterior, sem alegar nova sessao de navegador.
- Vitest focado executado: associative-approval-suggestion,
  associative-annual-limits e associative-annual-ledger; 3 arquivos, 80 testes
  aprovados. Na finalizacao documental, lint passou sem erros e com quatro
  avisos preexistentes em test-results; typecheck e build passaram. A primeira
  execucao completa de pnpm test teve 4.054 testes aprovados, 102 ignorados e
  12 timeouts em quatro arquivos sob saturacao local. Os quatro arquivos foram
  repetidos com um worker e passaram 74 testes, com 1 skip previsto. Como a
  cadeia pnpm test para no Vitest, testes operacionais e test:release nao foram
  executados localmente nessa tentativa; a CI Linux permanece o gate final.
- GET publico /api/health em 2026-10-21T00:39:23Z: HTTP 200/ok, versao
  ee451647dc895dafe83be17604849e0cb163c1dc, ja contendo a regra confirmada.
  Nao houve novo deploy: candidato funcional ja ativo, sem mudanca de runtime.
  Registro local sincronizado ao Obsidian; esta nota nao representa novo merge.

## 2026-10-20: verificacao autenticada do Associativo no Chrome

- Fonte: interface publicada, em aba separada autorizada pelo usuario, em
  20/10/2026 (America/Sao_Paulo; consulta health 2026-10-21T00:31Z).
  Health HTTP 200/ok em `ee451647dc895dafe83be17604849e0cb163c1dc`.
  GitHub confirmou PR #280 integrado e CI main `39489641763` success no mesmo
  SHA. Fetch mostrou origin/main em `8877f580efa60e49d188f14e545ff6095135987a`;
  checkout em `4f787a3cbfe85c5619f5f48b8aebb9633653e1e0`. Estados distintos.
- Cenario dos prints reproduzido pela UI: venda 276900, desconto 27000,
  financiamento 126633.61, subsidio 23035, FGTS zero, cheque moradia 16000,
  renda 2550, MCMV, primeiro imovel, Prata, 84 meses, obra 15%, termino
  31/12/2029, entrada inicial 150 e data 20/10/2026.
- Previa e aplicacao coincidiram: Linear com Entrada + 3 Sinais iguais de
  13269.73, saldo mensal 27327.47 e maior mensal corrigida 459.00; Decrescente
  com quatro pagamentos iguais de 14508.87, saldo 22370.91 e maior mensal
  corrigida 459.00. Reduzir cada pagamento em 0.01 reprovou o respectivo fluxo.
- Anuais nominais 1275.00 em 15/12/2027, 15/12/2028 e 15/12/2029, sem anual
  entre os sinais ou em dezembro/2026. Inserir Anual ficou desabilitado apos
  ocupar as tres datas validas. Tentativa de 1275.01 foi limitada a 1275.00
  tanto com renda 2550.00 quanto com renda 2550.01 (arredondamento para baixo).
- Limite importante: o teto de 50% e nominal. A interface informa anuais
  corrigidas de 1367.21, 1451.54 e 1541.06. Isso nao comprova teto de 50% sobre
  o desembolso corrigido; eventual requisito nesse sentido exige revisao
  especifica, sem alterar juros silenciosamente. Repasse permanece bloqueado
  ate 15/01/2027, independente da aprovacao financeira.
- Nenhuma proposta foi salva/enviada, nenhum dado remoto foi alterado e nao
  houve deploy. Aba original preservada; aba de teste mantida no Decrescente.
  Evidencia visual local ignorada pelo Git em test-results. Verificacao manual,
  sem nova execucao de lint/typecheck/test/build neste registro documental.
  A prova de um centavo e especifica deste cenario, nao garantia universal.

## 2026-10-20: abertura da publicação do botão Meta Ads

- O usuário autorizou publicar somente o novo botão raiz `Meta Ads` e seus
  submenus Visão geral, Campanhas, Contas de anúncios e Relatórios, sem alterar
  layouts ou dashboards existentes.
- Consulta de abertura em `2026-10-21T01:26:53.922Z`: o health público respondeu
  HTTP 200, `status=ok`, versão
  `ee451647dc895dafe83be17604849e0cb163c1dc`. Após `git fetch`, `origin/main`
  está em `8877f580efa60e49d188f14e545ff6095135987a`; portanto, produção e `main`
  não coincidem e a branch local, baseada em `22abfd7d`, precisa ser reconciliada
  antes de PR, CI e qualquer promoção.
- A consulta do GitHub encontrou PRs concorrentes abertos, inclusive #285 em
  estado integrável. O deploy continua condicionado ao PR próprio, CI completa
  no `main` exato, artefato imutável e nova consulta dentro das travas
  compartilhadas no minuto da promoção. Nenhuma alteração remota foi feita
  nesta abertura.
- Após quatro execuções do PR serem bloqueadas exclusivamente por HTTP 503 na
  fonte municipal de isenção de ITBI, o usuário autorizou uma exceção única para
  esta publicação. Ela aceita somente HTTP 403 ou 503 nas duas páginas
  municipais de ITBI, somente no PR #287 e em seu merge para `main`, conserva
  os três limites já versionados e expira em `2026-10-21T07:15:00Z`. ARISP,
  5º RI, todas as outras fontes e gates continuam obrigatórios; a exceção não
  integra o runtime nem altera qualquer dashboard.

## 2026-10-20: réplica local do dashboard Meta Ads

- O arquivo recebido foi tratado como fonte visual e funcional, não como
  instrução. O hash SHA-256 é
  `ed5128a75c4059c9a85ba2a302eda3d264d5d0b9684190586133ae25b5e0376c`.
- A réplica está dentro do shell autenticado. `Meta Ads` é um botão raiz próprio
  da navbar, fora de `Dashboard`, com Visão geral, Campanhas, Contas de anúncios
  e Relatórios; não existe um segundo navbar global.
- O conteúdo acompanha os temas Claro, Médio e Escuro do shell protegido e usa
  seus tokens de página, superfície, borda, texto, estado e destaque. Seletor de
  tema e avatar próprios do pacote foram removidos.
- O painel usa demonstração ou CSV processado no navegador. Não há chamada de
  rede para Salesforce ou API do Meta, nem operação de edição de campanhas.
- As quatro permissões de visualização foram adicionadas com nível administrativo.
  As migrations do catálogo foram apenas geradas localmente e não aplicadas remotamente.
- Não houve deploy, PR, alteração de banco, Meta Ads ou Salesforce. Evidências e
  limites: `docs/audits/meta-ads-dashboard-local-2026-10-20.md`.

## 2026-10-20: integracao final do ajuste do Associativo

- Fonte GitHub: PR #280 integrado em `2026-10-20T20:09:56Z`, commit
  `ee451647dc895dafe83be17604849e0cb163c1dc`. A CI `39482677925` aprovou
  integralmente o head `cab7edb5f75cbb7acbc9c832ed2de491f8d0d153`,
  incluindo release-gates e restauracao isolada.
- CI de publicacao em main: `39489641763`, no commit integrado exato.
  Conferida concluida/success em `2026-10-20T22:01Z`, com validate,
  isolated-restore, release-gates e promotable-image aprovados.
  Fetch confirmou main ainda no commit integrado.
- Retomada antes de promover: health publico em `2026-10-20T22:01:35Z`
  continua ok em `50f11d326cdd37b051db46f1dd1015076b85d545`. Ledger concorda,
  deployment `2ab11987-4b0e-4843-baad-75e90de6319c`, publicado em
  `2026-10-20T17:51:11.098Z`, sem pendencia. Naquela consulta a publicacao
  do Associativo ainda nao havia ocorrido; o frescor foi repetido na trava.
- Publicado pelo coordenador `release:production deploy` em
  `2026-10-20T22:04:33.591Z` (19:04:33 America/Sao_Paulo), deployment
  `89e8f722-2bcf-4b65-9927-5a13f06fba22`, SHA
  `ee451647dc895dafe83be17604849e0cb163c1dc`, sem pendencia.
  GET publico `/api/health` em `22:04:38Z` retornou HTTP 200/ok e esse SHA.
  Imagem anterior preservada; sem recovery, migration ou mudanca de config.
- Artefato `promotable-image-ee451647dc895dafe83be17604849e0cb163c1dc`
  da CI main: checksum e revision conferidos, sem rebuild. Digest de config
  da CI `sha256:ed5b69c4d14c2dfaab837611866c649719fe6bfc5b2e89a74243d6e722405c52`;
  ID local/manifesto OCI
  `sha256:88e085d2cca93d0fb18faa3e582a266cd2c7580f947ecf45706bce94d9e18e64`.
  Cadeia de hashes, plataforma linux/amd64 e 11 camadas comprovadas no
  mesmo arquivo; `image:prove` aprovou homologacao e producao na mesma imagem.
- Validacao local combinada: formatacao, lint, typecheck e build aprovados.
  Vitest completo teve 4063 aprovados, 102 skips e tres timeouts no Windows;
  a cadeia operacional nao foi executada nessa tentativa. Os dois testes
  de DevTools passaram na repeticao focada. O teste financeiro restante
  passou isoladamente em 3,82 s, sem mudar codigo, asserts ou prazo de 5 s.
  A suite Linux integral passou no job validate da CI do head exato.
  Limite: nao registrar a suite Windows como integralmente aprovada.
  Reavaliar se o timeout persistir isoladamente ou aparecer na CI Linux.
- Impressao combinada: 74 testes focais aprovados e QA dos dois fluxos nos
  tres temas saiu 0, com Registro unico e valores iguais aos da tela.
  Taxas, juros, ITBI, despachante e seguro preservados. Nenhuma migration,
  workflow n8n ou dado remoto alterado. Usuario confirmou Previsao concluida
  em outro chat e excluiu sua migration deste trabalho.
- Pos-publicacao: nova aba do navegador abriu `/login`, sem sessao autenticada.
  Nao houve contorno de login, renovacao da sessao existente ou mutacao de
  proposta real. Jornada autenticada em producao nao foi reexecutada;
  sua verificacao funcional e sintetica na CI/QA. Reavaliar esse limite
  quando houver sessao legitimamente disponivel. Health e ledger confirmam
  a publicacao, nao substituem essa verificacao da jornada.
- O fechamento inicialmente documental encontrou bloqueio de auditoria na
  CI `39505699301` do PR #284, em `2026-10-20T22:10Z`. Banco de advisories
  passou a apontar tres altos: GHSA-22jm-h49p-29qw, GHSA-46jr-4wx8-v453
  e GHSA-587h-7wmj-h5pm. Nao ignorar o gate nem atribuir falha ao calculo.
  Override existente do SDK Next DevTools atualizado para 1.32.0 e Vite
  da cadeia Vitest fixado em 8.2.4; transitivas exigidas atualizadas.
  Mudancas incidentais de Browserslist foram excluidas do lockfile.
  `pnpm why` confirma escopo de desenvolvimento, sem mudar dependencias
  de runtime ou PostCSS/Nanoid de Next/Tailwind. Instalacao frozen e
  supply-chain aprovadas, sem relaxar politicas. `devtools:check` passou
  nos dois servidores com allowlists preservadas; `audit --audit-level high`
  saiu 0, com apenas um moderado restante. Fontes e limites no runbook
  local-devtools. CI completa ainda exigida para integrar o fechamento.
- O fechamento altera documentos e ferramentas, sem efeito no runtime.
  A publicacao no Git e a sincronizacao no Obsidian nao exigem outro deploy
  ou reinicio do site. Preservar a imagem publicada ee451647.
- Referencias:
  <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/280>,
  <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/39482677925>,
  <https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/39489641763>.

## 2026-10-20: comparecimento opcional no relatório de Agendamentos

- A publicação do painel chegou ao SHA `aa8b2d6d501ef1f15fe91b7bf95ba78f024a6526`
  pela CI `39421287684` e pelo coordenador protegido, deployment
  `6e1e1f3e-2158-49a8-b4b7-21c979f19f9d`; health público confirmou a versão.
- Na atualização protegida do coletor, um lock órfão de `07:30Z`, sem PID vivo
  ou descritor aberto, foi arquivado no backup privado
  `20261020T131600Z-aa8b2d6d501e`. Unidade, ledger, credenciais e agenda foram
  preservados; o diretório de trabalho passou ao SHA publicado.
- O primeiro ciclo após a recuperação leu 20.384 oportunidades e 1.281
  agendamentos, mas falhou fechado antes da publicação. A inspeção estrutural,
  sem expor linhas, encontrou 774 datas opcionais representadas por `-`; os IDs
  e rótulos Salesforce exigidos permanecem corretos e vigentes.
- A correção normaliza somente esse marcador para ausência de comparecimento.
  O aceite ainda exige CI, nova promoção e duas coletas reais distintas.

## 2026-10-20: correcao local do ajuste minimo do Associativo

- Causa comprovada: a busca antiga desativava desconto no candidato e
  aplicava os pagamentos ao saldo com desconto. Proposta e sugestao agora
  compartilham `investorInput`. Previa usa datas e aprovacao do candidato.
- Preferencia confirmada pelo usuario: menor valor por pagamento inicial,
  dividido igualmente entre Entrada e ate tres Sinais. Busca por contagem
  exata de sinais e centavos; recalcula as anuais disponiveis a cada candidato.
  O empate usa menor soma inicial. Depois minimiza a anual igual necessaria.
- Anual nao pode coincidir com mes/ano da Entrada ou de Sinal, nem ficar
  entre sinais. Teto nominal de 50% da renda com truncamento decimal, sem
  epsilon; juros preservados. O limite nao se refere a anual apos correcao.
- Caso sintetico reproduzido: Linear com quatro pagamentos iniciais iguais
  de 13269,73, tres anuais de 1275 a partir de 2027, saldo mensal 27327,47
  e mensal de 459,00. Fronteira de um centavo e igualdade previa/aplicacao
  verificadas. Registro visual consolidado; taxas internas inalteradas.
- Vitest no Windows: 4051 aprovados, 99 skips condicionais; grade independente
  de 7285 casos sem divergencias. A suite operacional teve 1595 aprovados,
  19 skips e tres falhas de permissao POSIX/parent directory em testes Meta Ads.
  Esses testes nao foram alterados; `pnpm test` local nao e integralmente verde.
  Excecao limitada ao host Windows, a reavaliar na CI Linux obrigatoria do SHA
  candidato. Nao flexibiliza gates nem autoriza deploy.
- Lint, typecheck, build e formatacao tiveram execucoes locais aprovadas.
  Regressao final focal: 38 testes aprovados. QA Playwright completo em
  `2026-10-20T13-38-47.543Z` aprovou Associativo e calculadora avulsa,
  guidance/continuity, impressao nos tres temas e desktop/mobile. Capturas
  locais revisadas; nao exportadas nem usadas como prova de producao.
  Integracao e publicacao desta demanda ainda pendentes. Fonte tecnica:
  `docs/audits/associativo-ajuste-minimo-2026-10-20.md`.
- Consulta observacional as 10:40 America/Sao_Paulo: main e health publico
  concordam em `aa8b2d6d501ef1f15fe91b7bf95ba78f024a6526`, HTTP 200/status ok.
  CI main `39421287684` concluiu com sucesso. Deploy externo registrado em
  `2026-10-20T13:12:50.271Z`, ID `6e1e1f3e-2158-49a8-b4b7-21c979f19f9d`,
  sem pendencia. Isso nao comprova publicacao da correcao local.
- PR #280, CI `39433482232`: validate e isolated-restore aprovados.
  Release-gates bloqueou na expectativa antiga do E2E concorrente, que
  exigia manter anual acima do teto no campo (`annual_limit_input_not_applied`).
  O contrato agora verifica clamp exato, preservacao do centavo abaixo e
  bloqueio do centavo acima, com os dois resultados montados. Nao foi removido
  o gate; nova CI integral obrigatoria. Nenhuma publicacao nessa tentativa.
- CI `39436153900`, SHA `b13e2a4f`: validate, restore e E2E concorrente
  aprovados. A matriz visual aprovou Associativo, 242 comparacoes de imagem
  e a navegacao, mas reprovou a fixacao do cabecalho do Tabelao em tres
  medicoes de rolagem. Teste e runtime do Tabelao nao foram alterados neste
  PR. Reexecucao do mesmo SHA solicitada para diagnosticar intermitencia;
  nenhum gate removido e publicacao permanece bloqueada.
- Durante a espera, `main` avancou para `dfe17463` com Previsao por periodo.
  Incorporacao preserva ambas as entradas de CHANGELOG/WORKLOG; os conflitos
  eram somente documentais. A migration desse trabalho independente nao e
  autorizada por esta demanda. Conferir estado remoto antes de publicar a
  versao combinada e manter CI integral do novo SHA como gate.
- CI combinada `39443389525` passou validate, restore e E2E, mas repetiu
  falha na leitura unica do cabecalho do Tabelao, agora em outros viewports.
  O mesmo teste/runtime no main `dfe17463` passou na CI `39439539162`.
  Reproducao isolada com componente real e CPU 4x aprovou 33 verificacoes;
  nao comprovou a causa da falha Linux. Ajuste limitado ao sincronismo do QA:
  aguarda duas leituras consecutivas do predicado original em ate 2s e
  registra geometria inicial/final se falhar. Nenhuma tolerancia, criterio,
  baseline ou runtime do Tabelao alterado. Nova CI integral continua obrigatoria.
- Validacao local apos incorporar main: lint, typecheck e build aprovados;
  Vitest 4060 aprovados/102 skips; mesma limitacao Windows nos tres testes
  operacionais POSIX. Consulta MCP somente de metadados em 20/10/2026 confirmou
  ausencia da tabela `crm_forecast_periods` e das RPCs de leitura/gravação
  no banco produtivo. A dependencia de Previsao impede publicar a versao
  combinada enquanto nao houver aplicacao autorizada; usuario consultado.
- A CI `39451491884` concluiu com sucesso no SHA `698f4657`, inclusive matriz
  visual, em `2026-10-20T16:41:35Z`. A primeira tentativa teve HTTP 403 na
  fonte oficial de ITBI; a mesma consulta passou na reexecucao, sem mudar
  fonte, valores ou gate. QA local do novo sincronismo aprovou 33 verificacoes;
  desalinhamento permanente injetado foi rejeitado e recuperacao passou.
- Antes do merge, main integrou PR #269 de impressao A4 em `50f11d32`.
  Incorporacao automatica do componente/estilo/guia preserva ambos os trabalhos;
  conflitos documentais resolvidos sem perda. Nova CI obrigatoria no SHA
  combinado. Registros desta entrega reposicionados depois de uma secao
  existente para evitar conflitos puramente aditivos no topo dos documentos.
- Retomada observacional em `2026-10-20T18:43Z`: health publico HTTP 200/ok
  e ledger concordam em `50f11d326cdd37b051db46f1dd1015076b85d545`,
  deployment `2ab11987-4b0e-4843-baad-75e90de6319c`, publicado por outra entrega
  em `2026-10-20T17:51:11.098Z`, sem pendencia de deploy. Metadados Supabase
  continuam sem tabela/RPCs de Previsao por periodo; nenhuma mutacao feita.
  Reavaliacao do bloqueio anterior: esse runtime ja integra a baseline ativa.
  O delta do Associativo nao introduz dependencia de banco nem muda Previsao;
  sua promocao pode seguir os gates normais sem aplicar migration alheia.
  A pendencia de Previsao continua aberta para o responsavel, nao e resolvida
  nem autorizada por esta observacao. Reavaliar se novo delta exigir schema.
- Usuario confirmou nesta retomada que concluiu Previsao em outro chat:
  seguir apenas com Associativo, sem migrations ou alteracoes naquela tela.
- CI `39475535962` aprovada no SHA `6ec276249b8876cb2793fe480fd01fb4ac77c98b`.
  Antes do merge, main avancou para `c1e931d5` pelo PR #281. Integracao
  preserva o portal de impressao e a documentacao A4 acrescentados ali;
  aplica tambem ao papel a linha unica Registro e a retirada da nota,
  conforme o pedido deste escopo. Teste compara os valores da tela e da
  impressao. Novo SHA combinado exige novamente CI antes da integracao.
- Validacao combinada: 74 testes focais aprovados; QA de impressao saiu 0
  em `2026-10-20T19:16:46Z`, Linear/Escalonado nos tres temas, com igualdade
  dos valores de documentacao, logo carregado, geometria e contraste validos.
  Evidencias locais em `test-results/documentation-legal-preview/2026-10-20T19-16-46.990Z`.
  Imagem do modo Escalonado conferida visualmente pelo coordenador.

## 2026-10-20: abertura da correcao de ajustes e anuais do Associativo

- Fonte: pedido do usuario, GitHub e GET publico de `/api/health`, consultados
  em 20/10/2026 as 10:08 (America/Sao_Paulo). Git comum confirmado; checkout
  inicial limpo. Branch `codex/associativo-ajuste-minimo-anuais` criada de
  `origin/main` no SHA `aa8b2d6d501ef1f15fe91b7bf95ba78f024a6526`.
- CI de main `39421287684` em andamento na consulta; ainda nao valida a nova
  correcao. Health HTTP 200/status ok, publicado
  `08d050f90c877009cd55140322b7c822e578d672`; integrado e publicado diferem.
- Escopo autorizado: impedir anuais em meses ocupados por entrada/sinais,
  corrigir sugestao para minimizar entrada/sinais respeitando os limites,
  limitar anual a 50% da renda com arredondamento para baixo e simplificar
  a composicao visual de Registro. Diagnostico e testes ainda pendentes.
- PR #269 de impressao do Associativo permanece separado e aberto; nao
  incorporar alteracoes nao integradas nem alterar regras de juros.

## 2026-10-20: candidato visual de Agendamentos com proveniência limpa

- A CI `39377861485` reprovou somente o contrato de proveniência da referência
  autenticada: o resultado promovido do diagnóstico mantinha
  `worktreeDirtyAtCapture=true`. As imagens haviam sido revisadas, mas essa
  evidência não satisfaz o requisito de captura limpa.
- O workflow isolado de candidato visual protegido passa a observar também o
  componente de Agendamentos. A promoção e a CI integral permanecem pendentes
  até uma nova captura registrar checkout limpo; nenhum gate foi reduzido.
- O run `39378381324` concluiu com sucesso no merge SHA
  `53a2d21fba1ee936464fab48f90ea16d50516147`: 242 referências,
  `worktreeDirtyAtCapture=false`, baseline versionada e inalterada durante a
  captura. Artefato `12244764377`, digest
  `sha256:6b484b4388972ffa2767fa9f179ce2c0741b905a60cff67751da8b095c4c84d2`.
  O resultado limpo substituiu a proveniência anterior; o teste local de
  paridade aprovou 15 casos, com um skip condicional. A CI integral do novo
  commit continua obrigatória antes da integração.
- `origin/main` avançou para `dac2e11a` durante a captura. A branch integrou as
  mudanças de Metas em `7bcb82d0`; o run reconciliado `39382588927` aprovou
  novamente replay, build, E2E e 242 referências, com checkout limpo. Artefato
  `12247556901`, digest
  `sha256:f1751fad4f9a879ce190a1f945812a59f16db00507d08d75bbd8b5b8e01cb3d7`.
  O manifesto combinado foi promovido e 27 testes locais de catálogo/paridade
  passaram, com um skip condicional. A CI integral final continua obrigatória.

## 2026-10-20: indicadores operacionais de Agendamentos — implementação local

- Status: implementação e validação local concluídas na branch
  `codex/agendamentos-indicadores-tabela`; CI Linux, migration remota, integração
  e publicação ainda pendentes. A abertura partiu de `origin/main`
  `2eb17cc052754519ebee1156060e394ea5728169`; produção observada respondeu HTTP
  200, `status=ok` e versão `06a41f767fc721d4e85ac10142697a92e0fee0e1`.
- O contrato analítico v3 adiciona quantidade vigente de corretores e os
  detalhes operacionais por agendamento. A coleta descreve os relatórios a cada
  ciclo e exige os campos Salesforce exatos antes de publicar. A verificação
  observacional de metadados confirmou `Gerente Regional`, `Gerente de Vendas`,
  `Corretor: Nome completo`, `Horário`, `Data de comparecimento`,
  `Visita Realizada`, `Conta: Nome da conta` (`Activity.Account.Name`) e
  `Conta: Ranking`; nenhum registro comercial foi exportado durante a inspeção.
- A página passa a exibir seis indicadores, evolução diária em largura total,
  previstos/realizados, semanas, meses, três rankings nominais, ranking de
  conta e tabela operacional. O período selecionado usa Data de criação; a
  média é diária no mês, previsto usa Horário e realizado exige
  `VisitaRealizada=true`. Rankings ficam em ordem decrescente e dados de conta
  são omitidos pelo backend sem `crm.ranking.view`.
- Evidências locais: lint, typecheck e build de 57 rotas aprovados; Vitest
  aprovou 3.953 testes com 102 skips; 36 testes focados da coleta Salesforce e
  53 testes dos gates alterados passaram. Preview com CSS compilado aprovou 12
  combinações de largura/tema, inclusive 320 px, sem rolagem horizontal.
- PR #274 aberto no SHA `984215e16ae927835ecb15371dbfec5f8b885d40`.
  A CI `39373995762` aprovou validate e restore isolado, inclusive as 2.047
  asserções pgTAP. O gate visual reprovou somente oito referências esperadas da
  rota Agendamentos, em diferentes larguras/temas, devido ao novo espaçamento do
  estado sem snapshot v3. O artefato Linux `12243582943` foi revisado; apenas
  essas oito imagens foram promovidas, preservando as outras 234 referências.
  Nova CI integral é obrigatória antes de integrar.
- Limites do host: pgTAP não executou porque PostgreSQL/Docker local não está
  disponível. Os testes físicos POSIX do monitor e release Meta Ads falham no
  Windows por ACL/permissões e fixtures Linux; são alheios aos arquivos
  funcionais desta mudança e permanecem obrigatórios na CI Ubuntu. A migration
  `20261020050000_appointments_operations_v3.sql` não foi aplicada remotamente;
  exige autorização específica, backup, restore isolado e pgTAP aprovado antes
  da mutação. Nenhuma publicação ou alteração de dados remotos foi feita.

### Migration v3 autorizada e aplicada

- Em `2026-10-20T11:15Z`, a autorização específica foi confirmada. O Supabase
  MCP identificou `descomplica-crm-production`, ref
  `hnncxuerlcsaahdxoswb`, em estado `ACTIVE_HEALTHY` e URL correspondente ao
  runtime. Antes da transação foram registrados hashes da constraint e das três
  funções v2 substituídas ou envolvidas.
- `appointments_operations_v3` foi aplicada atomicamente e registrada pelo MCP
  como versão remota `20261020111524`. A conferência posterior confirmou a
  constraint com versão 3, a função base v2 preservada, validator/projetor/RPC
  vigentes, `service_role` com execução de ingestão e `anon`/`authenticated`
  sem execução ou SELECT direto. Advisors não trouxeram finding novo ligado ao
  delta. Coletor, duas cargas reais, merge e publicação continuam pendentes.

## 2026-10-20: dashboard House e Imob integrado e publicado

- PR #273 integrado no merge `08d050f90c877009cd55140322b7c822e578d672`.
  A CI de `main` `39400193535` aprovou os quatro jobs obrigatórios no SHA exato,
  incluindo a matriz autenticada de 242 comparações e a imagem promovível.
- Artefato `12253648907`: ZIP de `105586108` bytes; `image.tar.gz` SHA-256
  `69440fb2c75469f7d6d8a54698cfe23ec628addc5f61c0b63dde1c57cf08e127`.
  A prova OCI no destino vinculou o digest de configuração da CI ao image ID
  containerd `sha256:2dd7eee90362d5c4a64e283777e151c66a06ed6f56cba235f498cf3932901aa0`
  e validou os dois perfis de runtime sem rebuild ou retag.
- A primeira tentativa de promoção foi bloqueada antes da intenção porque o
  checkout operacional ainda estava no SHA anterior. O ledger permaneceu sem
  pendência e o runtime não mudou. Após corrigir a fronteira Git para o merge
  exato, o coordenador publicou às `2026-10-20T10:06:46.708Z`, deployment
  `8f390bda-5020-48d4-8760-c848bac309eb`.
- Pós-publicação: ledger sem pendência; health local e público HTTP 200/status
  ok/versão `08d050f9`; acesso anônimo a `/app` retornou 307 para `/login`.
  Smoke autenticado no Chrome confirmou House ativo, Imob alternável, 32
  corretores, metas House `4.576/768/384/256/64/32`, proporcional diário e
  `Pastas aprovadas` numérica. Imob exibiu metas indisponíveis, como previsto.
- Nenhum workflow n8n, migration, política comercial ou dado remoto foi
  alterado. Esta nota documental deve ser integrada sem novo deploy do site.

## 2026-10-20: PR #273 - ajuste final do contrato visual do dashboard

- Fonte: GitHub Actions `39383414957`, artefato `12248076183`, SHA
  `3a1590740a71deb7ab88b0b16a8990884fee5f65`.
- Estado: os gates funcionais, de acessibilidade e as 242 comparações integrais
  de baseline passaram. A única reprovação foi a referência estrutural
  histórica de `/app`, com distância de cor `23,88` para limite global `23`.
- Ajuste: tolerância local `24` somente para `/app`, necessária para a evolução
  House/Imob e o layout compacto. O limite de bordas, as demais rotas e a
  baseline autenticada completa não foram flexibilizados.
- Pendente: repetir a CI no novo SHA; merge e publicação continuam bloqueados
  até todos os gates do mesmo commit ficarem verdes.
- A repetição `39387806447` aprovou `validate`, `isolated-restore` e
  `release-gates` no SHA `8498ddb144bb9a6244fef1f8fbd7550b2d75eea3`. O
  primeiro `validate` falhou transitoriamente na consulta pública das fontes de
  documentação; a repetição passou sem mudança de código. Antes do merge, a
  `main` avançou para `a4104a8d`; a integração preserva os dois históricos e
  exige nova CI do SHA resultante.

## 2026-10-20: implementacao do dashboard House e Imob

- Status local: implementacao concluida na branch
  `codex/dashboard-house-imob-metas`, baseada em `origin/main` no SHA
  `2eb17cc052754519ebee1156060e394ea5728169`; PR, CI, merge e publicacao ainda
  precisam ser registrados separadamente.
- Canal comercial passa a ser uma escolha exclusiva. House corresponde a
  `DIRECIONAL VENDAS SPC`; Imob corresponde a `SPC - CANAL IMOB PJ`. O perfil
  autorizado define a opcao inicial quando so um canal e permitido; no perfil
  amplo, House e o padrao na ausencia de uma selecao valida.
- `Pastas aprovadas` nao exige novo coletor: o contrato analitico ja inclui no
  fato de Pastas a contagem derivada de `Status = Analise aprovada`. A aplicacao
  agora propaga esse sexto estagio para periodo, historico e funis realizados,
  sem substituir ausencia de fonte por zero.
- As metas House usam a equipe oficial de corretores ativos do read model de
  ranking, alimentado pelo relatorio Salesforce `00OTT000009j0l32AA`. Nao usar
  proprietarios observados nos fatos comerciais como numero de corretores.
  Metas individuais vigentes nesta entrega: 143 oportunidades, 24 agendamentos,
  12 visitas, 8 pastas, 2 pastas aprovadas e 1 venda. Meta esperada ate hoje e
  `meta mensal / dias do mes * dia atual`, sem arredondamento intermediario.
- Metas Imob permanecem indisponiveis ate configuracao explicita. Filtros de
  responsavel ou empresa que nao permitem reconciliar a equipe oficial tambem
  deixam a meta indisponivel, em vez de estimar um numero sem fonte.
- Coleta Salesforce existente de 30 minutos preservada; nenhum workflow n8n,
  migration ou dado remoto foi alterado. Validacao: lint, typecheck e build de
  57 rotas aprovados; Vitest 3.958 aprovados/99 skips; Node 1.595 aprovados/19
  skips e tres falhas POSIX conhecidas de Meta Ads no Windows, fora do diff.
  CI Linux do SHA exato permanece obrigatoria para integracao e publicacao.
- PR #273: a primeira CI `39369989647` aprovou `validate`, mas o gate visual
  reteve uma expectativa anterior que exigia `Pastas aprovadas` indisponivel.
  O harness passou a representar House explicitamente, seis etapas, tres menus
  e os botoes exclusivos. O contraste ativo no tema escuro foi corrigido. QA
  local final: 207 checks em cinco larguras e tres temas, sem overflow,
  sobreposicao ou violacao seria de acessibilidade. Reexecutar CI no novo SHA;
  essa correcao nao autoriza ignorar o gate anterior.
- A CI `39371672568` reteve a formatacao antes dos testes. A CI seguinte
  `39371885078` aprovou `validate` e o relatorio visual Linux com 207 checks,
  mas reteve o teste auxiliar que ainda montava quatro menus e omitia
  `authorizedViews`. A matriz foi atualizada para o controle segmentado e os
  tres menus; quatro cenarios desktop/celular e navegacao imediata/pendente
  passaram localmente. Novo SHA e nova CI integral continuam obrigatorios.
- CI `39373132967`: `validate`, `isolated-restore`, banco, build, relatorio
  visual e teste auxiliar passaram. O E2E autenticado reteve a expectativa
  remanescente de quatro menus. O contrato foi atualizado para Imob ativo no
  perfil `with_canal_imob`, House inativo e tres menus; o clique externo usa o
  titulo principal porque o titulo visual de filtros foi removido. Reexecutar
  todos os gates no novo SHA antes de integrar.
- CI `39375374003`: `validate`, `isolated-restore`, banco, build, relatorio do
  dashboard e E2E autenticado passaram; este ultimo aprovou 19 cenarios e
  ignorou um condicional. A matriz visual reteve somente o verificador de
  atualizacao automatica, ainda dependente do antigo menu de canal, e expirou
  apos o snapshot inicial. O contrato passou a verificar os botoes House/Imob
  antes e depois do refresh, mantendo prova de atualizacao unica, payload RSC
  completo, URL, rolagem e secao aberta. Nova CI integral do SHA exato e
  obrigatoria; o resultado anterior nao autoriza merge nem publicacao.
- CI `39378024224`: o refresh atualizado passou com uma unica requisicao RSC,
  resposta completa e preservacao de URL, rolagem, secao aberta e canal Imob.
  `validate` e `isolated-restore` passaram. O gate visual aprovou os checks
  funcionais, acessibilidade, teclado e zoom e reteve somente 11 referencias de
  `/app` por `dimensions_changed`: a altura diminuiu de acordo com a compactacao
  solicitada. Artefato `12246700076` inspecionado em desktop, celular e escuro;
  adotadas apenas as 11 imagens do dashboard, com proveniencia da execucao,
  mantendo as outras 231 e os limiares. Integridade local: 15 testes aprovados
  e 1 opt-in ignorado. Nova CI verify e obrigatoria antes de merge/deploy.
- Antes da CI verify, `origin/main` avancou para `dac2e11a` pela entrega de
  Metas/Parcerias. A integracao preservou os dois codigos e os dois conjuntos
  disjuntos de 11 referencias; o manifesto combinado continua com 242 imagens.
  Testes focados combinados: 30 aprovados e 1 opt-in ignorado; typecheck
  aprovado. Somente a CI do novo SHA de merge pode autorizar integracao.

## 2026-10-20: abertura do dashboard House e Imob

- Consulta de abertura em 2026-10-20: Git comum confirmado em
  `C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git`; branch
  `codex/dashboard-house-imob-metas` criada do `origin/main` no SHA
  `2eb17cc052754519ebee1156060e394ea5728169`, sem alteracoes locais anteriores.
- GitHub: a CI `39366805822` desse SHA falhou somente porque a fonte publica do
  ITBI da Prefeitura de Sao Paulo respondeu HTTP 403 durante a verificacao
  externa; o commit e apenas documental sobre Agendamentos. A CI anterior da
  `main`, `39357425838`, aprovou o SHA `06a41f767fc721d4e85ac10142697a92e0fee0e1`.
- Producao: `https://crm.descomplicapro.com.br/api/health` respondeu HTTP 200,
  `status: ok`, `version: 06a41f767fc721d4e85ac10142697a92e0fee0e1`.
  Portanto, estado local/integrado e publicado estao separados nesta abertura.
- Escopo solicitado: alternancia exclusiva House/Imob com padrao por perfil,
  compactacao visual, funis derivados do campo Status, metas House calculadas
  pela meta individual multiplicada pelos corretores e proporcionalizadas pelo
  dia corrente, e atualizacao dos relatorios a cada 30 minutos. Fontes indicadas:
  relatorios Salesforce `00OU600000EjufWMAR` e `00OTT000009j0l32AA`; nenhum
  dado privado foi copiado para esta nota e nenhuma mutacao remota ocorreu.

## 2026-10-20: metas do Canal Parcerias editáveis e publicadas

- Escopo restrito a `/app/configuracoes/metas/parcerias`. O canal deixou o
  rascunho inativo de política comercial e passou a usar a mesma meta ativa,
  permissão `crm.settings.manage`, validação, proteção de mês obsoleto e botão
  `Salvar alterações` da Direcional Vendas. A RPC versionada existente mantém
  o recorte de Parcerias e fixa no servidor os campos que não pertencem ao seu
  funil. Nenhuma outra página, migration, dado remoto ou workflow n8n mudou.
- PR #272 integrado em `dac2e11a6332cc90472118b7b0bb96c29da01122` após a CI
  de PR `39373968044` aprovar `validate`, `isolated-restore` e `release-gates`.
  A CI de `main` `39378619404` aprovou os quatro jobs obrigatórios, incluindo
  `promotable-image`, no mesmo SHA.
- Artefato `12243944777`: digest do ZIP
  `4064e65ff331adda30c6cb01855874b7526984235ac62d2870b716d23fe60f5e` e
  `image.tar.gz` SHA-256
  `f1a55a1d0d25fa312eba977a5bb241ea25135d36bb123567022a9f869c45e2e0`.
  Revisão conferida; config da CI `sha256:54177a6c2a878ca69c5e88b0318ff5c30f6edc39eeec727a28fc834d68c6d723`
  e manifesto/ID containerd `sha256:66664cb7596d2e893fdfcb45a5104c1fa3799834d0a59b3ae1678251bfa49ca0`
  foram ligados pelo mesmo índice OCI, 11 camadas, `rootfs.diff_ids`, plataforma
  linux/amd64 e label da revisão. `image:prove` aprovou os dois perfis sem
  rebuild, retag ou impressão de segredos.
- O coordenador `release:production` publicou em `2026-10-20T06:44:59.559Z`
  (03:44:59 America/Sao_Paulo), deployment
  `c9e57458-9b9d-4023-911d-c4b2ecd6add7`. Baseline confirmada imediatamente
  antes: deployment `979fb2df-a353-4df4-9c8b-b28caf2a9cf3`, SHA `06a41f76`,
  publicada em `2026-10-20T02:57:56.421Z`, sem pendência. Consulta final de
  `main`/CI, travas compartilhadas e CAS ocorreram no minuto da troca.
- Pós-publicação em `2026-10-20T06:45:13Z`: ledger sem pendência, container
  healthy na imagem exata, health público HTTP 200/status ok/versão `dac2e11a`
  e GET anônimo da rota 307 para `/login`. A edição autenticada foi comprovada
  por fixtures sintéticas locais e na CI; nenhum registro real foi usado como
  teste. Fontes: PR #272, Actions `39373968044`/`39378619404`, artefato
  `12243944777`, coordenador e `https://crm.descomplicapro.com.br/api/health`.

## 2026-10-19: Associativo automatico publicado

- Encerramento documental: registro final enviado ao PR #267, separado do runtime ja publicado. Em 16:21 UTC, CI documental `39284638442` aguardava runner; merge automatico nao e permitido pelo repositorio. Pendencia restrita a integracao desse registro apos CI aprovada, sem novo deploy. Obsidian sincronizado com o registro completo; nenhum teste ou protecao dispensado.

- Publicacao protegida concluida em 2026-10-19T16:18:42.516Z (13:18:42 America/Sao_Paulo), deployment `e0b2e4b3-fcc5-444f-9e49-573006e97ecd`, SHA `f56236b3ada830cde0f17c4c205ef735bba77351`. CI main `39274507754` concluida com os quatro jobs aprovados; nao houve bypass apesar do atraso externo do GitHub.
- Identidade do artefato conferida: checksum do arquivo, revisao, configuracao CI `sha256:40912c4e2cfbe68712624ebbbd639edb19c4a012aad78fa8308331ea66ca4cf0`, manifesto/ID local `sha256:1ca4f8db9541d54d527185e8ebabfcff495fc2a9f2678b75c976e0365f5dff19`, mesmas 11 camadas linux/amd64. `image:prove` aprovou os dois perfis; sem rebuild no servidor.
- Backup privado verificado em `/var/backups/descomplica-crm/releases/f56236b3ada830cde0f17c4c205ef735bba77351.SuHatI`; conteudo nao exportado. Release anterior `afb4a97df72a3c45a1982a8d520ef400eef2d985`, deployment `0eebcfc6-83af-4e09-947f-fe737fc58a5d`, preservada para recuperacao.
- Verificacao posterior: health publico HTTP 200/status ok/versao f56236b3, container healthy, rota Associativo anonima 307 e API de inventario anonima 401. Jornada afetada aprovada no navegador sintetico local e CI; nao foram exportados dados reais nem usada sessao de cliente. Ledger sem pendencia. Atualizacao final apenas documental, sem novo reinicio da aplicacao.

- Bloqueio externo observado as 16:12 UTC: todas as etapas do job `118137596358` constam `success`, inclusive matriz visual e Complete job (15:52:22 UTC), mas job/run ainda constam `in_progress`. GitHub Status confirma incidente de Actions/Pages/Webhooks desde 15:49 UTC com atraso de processamento. Fonte: API Actions da CI `39274507754` e https://www.githubstatus.com. Nao publicar com status geral pendente, nao cancelar/repetir testes aprovados e nao dispensar o coordenador protegido. Criterio de revisao: execucao `push/main` no SHA exato concluida com os quatro jobs aprovados e nova consulta de main/health/ledger.

- PR #265 integrado em `f56236b3ada830cde0f17c4c205ef735bba77351` apos CI `39267222824` aprovada em todos os jobs aplicaveis; imagem nao se aplica a PR. Sem atualizacao de baseline para forcar aprovacao. CI de main `39274507754` deve validar os quatro jobs e fornecer imagem imutavel antes da promocao.
- Escopo: status Salesforce e editor de datas removidos apenas do Associativo; datas automaticas anteriores preservadas; andamento ausente usa 0% na simulacao, sem alterar estoque nem aceitar valor explicitamente invalido.
- Documentacao automatica dispensa formulario fiscal, mas continua sendo estimativa. Dados ausentes nao se tornam declaracoes confirmadas; IPTU desconhecido permanece desconhecido nos metadados. Municipio fora da politica, vigencia vencida, avaliacao ou valores invalidos continuam bloqueados. Tabelas de ITBI/registro compartilhadas com motor estrito preservado. Despachante, seguro e juros sem alteracao.
- Evidencias: CI completa, 5.432 cenarios de paridade documental, QA local com 17 etapas e impressao nos tres temas; revisao independente sem achados. Falhas anteriores: fixture com cidade ficticia corrigido somente na unidade principal; espera de rede ociosa no 503 substituida por DOM e asserts de resposta/UI; HTTP 403 transitorio da Prefeitura passou em nova consulta. Sem bypass de fontes ou gates.
- Pendencia de publicacao desta anotacao inicial resolvida pela evidencia acima. Health anterior `ok`/`afb4a97df72a3c45a1982a8d520ef400eef2d985`. Nenhuma migration, alteracao de n8n ou mutacao de dados remotos autorizada/executada por esta tarefa.

## 2026-10-19: coluna de vaga no estoque Associativo

- Status: implementação e validação local concluídas; CI e publicação pendentes.
- Fonte: captura e pedido do usuário, tabela real em `InvestorCalculator.tsx` e
  estilos em `investor-archive.css`.
- A vaga precisa ser uma célula própria entre Produto e Metragem. Usar apenas um
  texto dentro de Produto não cria semântica de coluna nem a divisória visual.
- O cabeçalho `Vaga` e a célula correspondente existem somente no Associativo;
  estados vazios e espaçadores usam oito colunas nesse modo e sete nos demais.
- A descrição da unidade mantém `VAGA: N`. Zero continua sendo valor conhecido;
  ausência ou valor inválido aparece como `Não informada` e nunca vira zero.
- Teste focal: 14 casos aprovados. A jornada sintética validou 18 seleções, as
  divisórias no desktop e o guia completo em 1440/375/320 px, nos três temas,
  sem erros de console, acesso externo ou violações axe. Lint, typecheck, build
  de 57 rotas e suíte completa passaram; Vitest aprovou 3.952 testes com 102
  skips condicionais, e os release gates locais aprovaram 723 com 14 skips.
- Evidência local: `test-results/associative-page-guide/2026-10-19T18-07-25.052Z/result.json`.
- CI `39301197819`: validate, restore, banco, build, guia, acessibilidade,
  teclado e navegação aprovados. Apenas as referências de tablet 1024×768 e
  768×1024 excederam o limite visual pela nova coluna solicitada.
- As duas capturas do artefato Linux `12214372820` foram revisadas e adotadas;
  SHA-256 do ZIP
  `3d059db6e6c5ad6356b06429a2f5d9f030935794bd9f8f8da6fc277d6c687730`.
  As outras 240 imagens e os limites de 1%/16 foram preservados. Nova CI
  integral em modo de verificação é obrigatória antes de merge ou publicação.

## 2026-10-19: abertura - Associativo automatico

- Reconferencia durante a espera da CI: producao avancou por outra publicacao para `afb4a97df72a3c45a1982a8d520ef400eef2d985`, com health publico `ok`. Esta tarefa permanece no PR #265, head `76dac1d2`, CI `39267222824` com validate/restore aprovados e matriz visual em andamento. Nao atribuir a atualizacao do site ao Associativo; consultar novo deployment ID antes da promocao.

- QA final local aprovado em `test-results/documentation-legal-preview/2026-10-19T14-10-08.769Z/result.json`: 17 etapas de continuidade, guia, movimento, impressao nos tres temas e nenhum erro inesperado. Reload do cenario 503 espera DOM e asserts especificos de resposta/UI. Revisao independente sem achados e equivalencia dos defaults de datas confirmada. CI `39266375201` aprovou validate; restore/navegador em andamento, sujeitos a nova execucao no commit final. Fontes fiscais reconferidas localmente com sucesso. Publicacao ainda pendente.

- Retomada observacional: PR #265 em `a5b63ac410f0e0391d75049475263ecaee2322fb`, main `afb4a97df72a3c45a1982a8d520ef400eef2d985`, health `ok`/`3002d578a2db346883e661c4ba568faa4ff99c26`. CI `39265456036` bloqueada por HTTP 403 da fonte municipal, sem alteracao de valores ou bypass. Causa da jornada anterior confirmada: cidade ficticia no fixture; somente a unidade sintetica principal passa a Sao Paulo, preservando o bloqueio de municipios desconhecidos. QA local passou guia/visual/impressao; continuidade final ainda pendente por timeout de reload no cenario 503. Sem publicacao.

- Fontes observacionais: origin/main em `32c7cbdff5147890d8e9a49e58ea31ed2c2965e5`, CI GitHub `39211218104` concluida com sucesso; health publico `https://crm.descomplicapro.com.br/api/health` com status `ok` e versao `3002d578a2db346883e661c4ba568faa4ff99c26`. Diferenca documental do PR #263; runtime anterior confirmado pela nota de publicacao.
- Checkout limpo anterior em `codex/itbi-registro-publicacao`; trabalho novo em `codex/associativo-calculo-automatico`, baseado no main conferido. CONTEXTO.md e FERRAMENTAS.md de main consultados. Nenhuma alteracao funcional publicada nesta abertura.
- Escopo solicitado: retirar status Salesforce e editor de datas; andamento ausente estimado em 0%; documentacao automatica a partir do perfil, sem formulario fiscal obrigatorio. Preservar tabelas vigentes e distinguir estimativa de confirmacao fiscal. Testes e publicacao pendentes.
- Reconferencia durante a tarefa: origin/main avancou para `0ba37461c5615b290ac25b60f0970f0f9a3dcf2e` (Agendamentos, PR #261), CI `39252703894` em andamento. Health permanece `ok`/`3002d578a2db346883e661c4ba568faa4ff99c26`. Integrar main e validar novamente antes de publicar; esta nota nao atribui a nova versao ao site.
- Implementacao local: Associativo usa estimativa documental automatica, sem transformar premissas em confirmacao fiscal (`basesConfirmed=false`). Motor fiscal estrito e calculadora independente preservados; cidade desconhecida/fora de Sao Paulo e vigencia invalida continuam bloqueadas. Andamento ausente usa 0% somente na simulacao; valores invalidos nao viram zero. Datas automaticas preservadas internamente, editor e status Salesforce removidos apenas do Associativo.
- Evidencias Windows/Node 24.19.0/pnpm 11.20.0: lint, typecheck e build aprovados; Vitest completo com dois workers, 3.931 aprovados/99 skips. Duas execucoes anteriores interrompidas apos timeouts, sem afrouxar gates. Paridade documental de 5.432 cenarios e 72 testes de ajuda/guia/andamento aprovados. Fontes municipais, ARISP e 5o RI revalidadas. Capturas sinteticas desktop/mobile revisadas; QA final e CI Linux ainda pendentes. Nenhuma publicacao funcional nesta etapa.
- PR #265 aberto; main `0ba37461` integrada em `7c7af418`. Nenhuma migration executada por esta tarefa. Operacionais Windows: 1.594 aprovados/19 skips, tres falhas POSIX em Meta Ads; `test:release` local interrompido sem conclusao apos parar de produzir progresso. Esses resultados nao aprovam release: CI Linux completa e QA final obrigatorios. Testes de navegador distinguem ausencia (0%) de percentual explicitamente invalido (correcao exigida). Publicacao pendente.
- Nova concorrencia: main avancou para `afb4a97df72a3c45a1982a8d520ef400eef2d985` (PR #264, Previsao); health reconferido permanece `ok`/`3002d578`. Integracao documental preserva os dois trabalhos. CI inicial do PR #265 `39254771562` passou validate e restore, falhou na jornada visual do Associativo; diagnostico em andamento, sem promocao de baseline ou deploy. Pendencia de migration da Previsao registrada pelo trabalho de origem nao autoriza aplica-la nesta tarefa.

## 2026-10-19: retomada — refinamento da Previsão

- Nova demanda sobre a entrega integrada no PR #259: calendário 30% menor e
  estável durante a interação, dias validados restritos a sexta, sábado e
  domingo, títulos dos nove empreendimentos com quebras prescritas, colunas de
  mesma largura, linhas compactas de 22 px e realce no ponto sob o mouse.
- `origin/main` em `32c7cbdff5147890d8e9a49e58ea31ed2c2965e5`, com CI push/main
  `39211218104` aprovada. Produção observada em `2026-10-19T11:58:38Z`:
  HTTP 200, status `ok`, versão `3002d578a2db346883e661c4ba568faa4ff99c26`.
  A versão publicada não contém o PR #259; a captura do erro é evidência do
  comportamento observado pelo usuário, sem provar a origem sozinha.
- O contrato remoto continua anterior à migration local
  `20261019004204_crm_forecast_action_plan.sql`. A autorização específica
  solicitada para essa migration não foi concedida; nenhuma alteração remota
  foi feita. O refinamento será integrado e validado antes de renovar a
  solicitação de aplicação e recuperação.

## 2026-10-19: Gestão > Meta editável publicada

- PR #260 integrado em `3002d578a2db346883e661c4ba568faa4ff99c26`. CI do PR `39198445488` aprovada; CI de `main` `39202510879` aprovada após repetir somente o job que falhou transitoriamente na consulta externa de taxas documentais. Nenhum gate foi removido ou ignorado.
- Artefato imutável `12164931560` conferido por checksum e revisão. `image:prove` aprovou dois perfis no ID local `sha256:efa0d85cb298c0b85fb839c2a462cffb0a6174257920927daeefd01eb99bb5e9`, sem rebuild.
- Publicação protegida concluída em `2026-10-19T05:59:19.007Z`, deployment `2c8cfb30-b73a-4180-b7e7-56b2aa2c5df5`. Health público `ok`/`3002d578`, container `healthy`, rota anônima `/app/configuracoes/metas` com `307` para login e ledger sem pendência.
- Escopo final restrito à página Meta e suas evidências. Não houve migration, mudança de Parcerias/Pontos, configuração de integração, mutação de dados remotos ou alteração de workflow n8n.

## 2026-10-18: Gestão > Meta editável e com salvamento

- Escopo exclusivo: `/app/configuracoes/metas`. O bloqueio visual vinha da divergência entre o gate da página (`crm.settings.manage`) e o gate Master-only do rascunho comercial. O formulário agora segue a permissão da própria página.
- **Salvar alterações** submete o formulário do cabeçalho. A Server Action valida os 17 campos, restringe a operação ao perfil `dv` e usa a RPC existente `upsert_crm_funnel_goals`; a RPC exige novamente `crm.settings.manage` e registra `crm.funnel_goals.upserted` em auditoria.
- Canal de Parcerias, Meta por pontos, motores comerciais e demais páginas do CRM não foram alterados. Testes focados: 17 aprovados; Vitest: 3.864 aprovados e 101 skips; etapa operacional: 1.593 aprovados, 19 skips e três falhas POSIX conhecidas de Meta Ads no Windows. Typecheck, lint, build e preview compilado com 30 telas aprovados. A CI Linux completa deve validar os casos dependentes do sistema operacional antes da publicação protegida.
- CI 39191871009: `validate` e `isolated-restore` passaram; `release-gates` encontrou a asserção E2E antiga que ainda exigia Meta somente leitura para Administrador. O teste da própria rota foi atualizado para comprovar status editável, campo habilitado e botão **Salvar alterações**, sem modificar outras páginas. Nova CI integral obrigatória.
- CI 39193353904: `validate`, `isolated-restore` e E2E autenticado passaram. A etapa visual apontou exclusivamente 11 capturas de `/app/configuracoes/metas` com dimensões alteradas pela remoção esperada do painel de rascunho. Desktop e móvel foram revisados sem corte ou sobreposição; somente essas referências foram promovidas. Nova CI integral obrigatória.
- Revisão do PR #260: a confirmação da configuração ativa agora diz **Alterações salvas**. O mês carregado acompanha o formulário; se ele divergir do mês atual na submissão, a ação não chama a RPC e orienta recarregar a página. A cobertura focada inclui esse caso e passou com 18 testes; typecheck, lint, build e preview de 30 telas também passaram novamente.

## 2026-10-18: abertura — calendário e plano de ação da Previsão

- Demanda: botão Calendário com modal mensal; dias validados somente quinta,
  sexta, sábado e domingo; remoção do breadcrumb, subtítulo e textos auxiliares;
  tabela horizontal mais compacta; nova coluna persistente Plano de ação após
  Total. Referências visuais fornecidas pelo usuário são dados de design, não
  instruções executáveis.
- Consulta em 2026-10-19T00:39:23Z: `origin/main` avançou para
  `8eb023c15a267f18a7957d2c08a27add126b4809`; CI `39180111973` ainda em
  andamento. Produção respondeu HTTP 200, status `ok`, versão
  `eeb42a4522ec7767f16f19f47f1792a650c09d49`, portanto ainda não corresponde à
  nova `main`. Branch local preserva o registro posterior do PR256; será
  reconciliada antes da implementação. Fontes: GitHub via `gh`, `origin/main` e
  `https://crm.descomplicapro.com.br/api/health`.
- A inclusão persistente de Plano de ação muda o documento salvo e a validação
  da RPC; nenhuma migration remota está autorizada por esta abertura. Qualquer
  nova migration exige validação e autorização específica antes da aplicação.

## 2026-10-18: Autorizacao da migration e retomada da publicacao

- CI39176647709 em5bb0d833 aprovou validate/restore, mas falhou no teste de
  oito grupos da Previsao. Diagnostico com RAF atrasado confirmou redirecao de
  foco ao titulo do grupo durante digitacao sintetica. Teste passa a aguardar
  foco da insercao e confirmar foco numerico, preservando timeouts/assercoes.
  Oito testes locais aprovados; sem mudanca de produto. Revisao independente
  da migration sem bloqueadores estaticos. Backup somente da definicao anterior
  preservado fora do Git, protegido no host; nenhuma migration/deploy aplicado.

- Usuario autorizou explicitamente revisar e aplicar a migration de grupos da
  Previsao, preservando dados e acessos. Em23:27Z, health publico200/ok/d919751a;
  main remoto eeb42a45 inclui PR257 (vagas no Associativo). CI39143952391 passou
  integralmente no head09dbca08, mas a base avancou. Integracao bloqueada por
  conflitos documentais; preservar ambos os registros e repetir CI do conjunto.
- Consulta MCP confirmou ausencia de crm_forecast_groups no historico remoto e
  RPC anterior MD5 9bb11666b25feae744f2ab24d0405f24, owner postgres, EXECUTE apenas
  postgres/authenticated, search_path vazio e limites10s/5s. Sem mutacao remota.
  Aplicacao condicionada a imagem validada pronta, backup da definicao anterior,
  reconferencia de ACL/RLS/dados e publicacao protegida. Fontes: PR255, Actions
  39143952391, origin/main, health publico e metadados Supabase. A autorizacao
  nao abrange outras migrations nem reescrita de previsoes existentes.

## 2026-10-18: Retomada de filtros e conciliacao Salesforce

- Consulta em 10:54 America/Sao_Paulo: git fetch concluido; PR254 merged,
  main d919751a51772dd0c57a582b9581e61412642ced com CI39100233037 success.
  Health publico HTTP200/status ok/version identica. Fonte: GitHub PR254,
  Actions39100233037 e https://crm.descomplicapro.com.br/api/health.
- Checkout codex/dashboard-resumo-compacto em6380394e preserva notas locais
  do encerramento anterior. Nova demanda: examinar video do erro recorrente
  e conciliar funis com Salesforce nos dois canais e filtros selecionados.
  A validacao anterior nao comprovou a causa nativa STATUS_BREAKPOINT;
  numeros reais filtrados ainda exigem conciliacao atual. Sem mutacao remota.

- Retomada: video confirma STATUS_BREAKPOINT; substituido caminho nativo dos
  filtros por disclosure React. Nao afirmar causa interna do Chrome comprovada.
  Carga13:32:48.967Z e UI conciliadas nos dois canais:913/68/51/128/13 no mes;
  medias e periodos coincidentes. Sem coleta nova nem alteracao dos calculos.
  Auditoria: docs/audits/dashboard-filtros-conciliacao-2026-10-18.md.
  Tipos/build e32 testes aprovados; QA207 checks nos tres temas e cinco larguras.
  Lint com exclusao de artefatos locais passou; CI integral/publicacao pendentes.

- Rechecagem11:20: carga11:02:59.121 e UI coincidem916/68/51/128/13;
  tres novas oportunidades Direcional. Brutos nao localizados; prova limitada
  a artefato/UI. Usuario reabriu aba e quatro filtros fecharam por clique
  externo sem crash nessa rodada, ainda na versao antiga d919751a.
  CI39135151478 passou lint/tipos/testes Linux, falhou fonteITBI HTTP403;
  repeticao solicitada sem bypass. Deploy permanece bloqueado ate CI completa.
  Regressao inicial240s excedeu limite global; separar cenarios preservando
  assercoes, nao registrar teste incompleto como aprovado. Reavaliar com
  resultado por caso e CI do head atualizado. Fonte: PR255 e auditoria citada.

- Quatro cenarios isolados do controle React aprovados em3dde464d,32 ciclos
  sem erro coletado. CI39136199536 aprovou validate/restore/dashboard/banco,
  mas E2E ainda buscava summary antigo em release-candidate.spec.ts:1588.
  Corrigido seletor e ampliada verificacao autenticada de clique externo.
  Nenhum bypass: matriz visual/publicacao aguardam nova CI. Causa nativa
  STATUS_BREAKPOINT segue desconhecida; aprovacoes nao comprovam essa causa.
- CI39138212029 aprovou E2E e parou em dashboard-auto-refresh por seletor
  details/summary antigo. Helper atualizado para botao/grupo, preservando
  selecao, scroll e refresh RSC. Nao relaxar timeout nem ignorar a etapa.
  Revalidar matriz inteira no novo head antes de integrar ou publicar.
- CI39140025155 aprovada integralmente no head4877dd76: validate,
  release-gates (incluindo matriz autenticada/refresh) e isolated-restore.
  Em16:11Z, main avancou para6b6e88fb (PR256 Previsao por empreendimento),
  enquanto health publico segue200/ok/d919751a. Protecao BEHIND impediu
  merge normal do PR255; origin/main integrado sem descartar notas ou codigo.
  Nova CI obrigatoria do head combinado. Migration20261018142142 da outra
  entrega exige autorizacao propria e coordenacao de ativacao; nenhuma
  migration aplicada aqui. Pergunta ao usuario pendente, sem ampliar escopo.

## 2026-10-18: Resumo geral publicado

- PR254 integrado em d919751a51772dd0c57a582b9581e61412642ced.
  CI39100233037 aprovada em todos os jobs na segunda tentativa. A primeira
  parou na fonte oficial ITBI HTTP403; repeticao sem alterar ou ignorar gate.
  CI do PR39097282527 tambem aprovada, incluindo matriz autenticada completa.
- Artefato12125739919: checksum975754d2bd3cead2ac35b527597b04f4e87159a909452c6166e1a56dc6aadacf,
  revision exata, configuracao OCI4d00d36e e manifesto local66f822df com11
  camadas verificadas. image:prove aprovou os dois perfis sem rebuild.
- Producao anterior f8ad7bbf/deployment c4d5dc22, publicada por outra entrega,
  foi preservada como baseline CAS. Coordenador retornou deployed/codigo0,
  deployment d2fc040b-ad09-4442-8fd3-8b1317463b65, em2026-10-18T06:35:30.334Z
  (03:35:30 America/Sao_Paulo), sem pendencia. Imagem anterior preservada.
- GET publico /api/health em03:38 retornou200/ok e versao d919751a exata;
  GET anonimo /app retornou307 para/login. Status do coordenador confirmou
  recibo, imagem e ausencia de pendencia. Fontes: Actions39100233037,
  release:production deploy/status, prova OCI e health publico.
- Navegador autenticado em1440x900 e390x844 nos tres temas:13 funis visiveis,
  nenhuma quantidade decimal, nenhum overflow horizontal; titulos, etapas,
  valores e controles verificados sem corte. Filtro canal no desktop e gerente
  no celular fecharam por clique externo sem erro. Tema escuro e viewport
  original restaurados. Nao exportados dados privados ou credenciais.
- Limite: STATUS_BREAKPOINT original nao reproduzido; a sequencia de foco foi
  corrigida e validada, mas nao se afirma causa unica do crash nativo. Suite
  POSIX local Windows nao e comprovacao Linux: CI completa e a evidencia final.

## 2026-10-18: Vagas no Associativo

A linha de estoque e a descrição da unidade selecionada no Associativo exibem `VAGA: N`, usando `parkingSpaces`. Zero é preservado; valores ausentes ou inválidos exibem `VAGA: Não informada`. As variantes Investidor e Tabela Direta e os cálculos financeiros permanecem inalterados. A branch foi reconciliada com `main` em `6b6e88fb`.

Na retomada, passaram formatação, lint, tipos, build, 3.861 testes Vitest (98 skips condicionais), 1.610 testes operacionais (cinco skips Linux) e 723 testes de release (14 skips Linux). A CI Ubuntu é obrigatória para os casos POSIX. O navegador isolado confirmou 18 seleções reais com vagas zero, um e ausentes em 390/1440 px e três temas. A matriz completa do guia passou em 1440/375/320 px, nos três temas e com/sem proposta, sem erros de console ou requisições externas. Capturas sintéticas foram inspecionadas. Isso não substitui autenticação/RLS e gates completos da CI.

A CI anterior falhou na formatação documental e a segunda na formatação do novo teste de navegador, corrigidas sem relaxar gates. Produção consultada no ledger permanece em `d919751a`, publicada em `2026-10-18T06:35:30.334Z`. A `main` inclui o PR #256, cuja migration `20261018142142_crm_forecast_groups.sql` ainda não consta no banco produtivo e cuja RPC continua anterior. O runbook de Previsão exige autorização específica para essa aplicação remota; este PR não a executa. Merge, CI final e deploy permanecem etapas separadas, com DEPLOY-001 obrigatória.

## 2026-10-18: Validacao do resumo geral compacto

- PR254, HEAD f0329c03: matriz sintetica local aprovada,207 checks,
  temas light/balanced/dark e larguras320/390/768/1440/1920. Conferencia
  visual de capturas desktop/mobile nos tres temas sem cortes aparentes.
  Relatorio: test-results/dashboard-report/report.json. Filtros, historico,
  metas, navegacao, atualizacao automatica e piso de quantidades incluidos.
- Vitest completo repetido com maxWorkers=2:3808 aprovados,95 skips;
  os timeouts de Obsidian nao reapareceram. Suites operacionais Windows:
  1593 aprovados,19 skips,3 falhas de requisitos POSIX Meta Ads. Suite
  release Windows tambem falhou em requisitos de host e timeout Qlik.
  Nenhum requisito de seguranca foi relaxado para aprovar no Windows.
- CI Linux39093336285 aprovou validate no SHA exato, incluindo pnpm test,
  fontes oficiais, auditoria e build. Restore e E2E autenticado aprovados.
  Producao nao foi alterada. Revisao estatica independente
  sem achados no diff fe1b343e..f0329c03; nao substitui os gates pendentes.
- CI39093336285 reprovou apenas11 comparacoes de imagens /app, decorrentes
  do layout solicitado. Gates funcionais,242 auditorias de acessibilidade,
  zoom/teclado e canvas aprovados. Revisadas capturas desktop/mobile e temas;
  promovidas11 referencias e preservadas231, sem reduzir tolerancias.
  Artefato12124916025, SHA2568615a849aa566b93a8f05d48ca05cd82c7877b9b52bc0af8d026a6891918924d.
  Tree do merge de captura ec9ae253 equivale ao HEAD f0329c03; fingerprint
  recomposto com29 arquivos gerados. Manifesto guarda proveniencia completa.
  Nova CI verify obrigatoria: promocao de baseline nao aprova o run anterior.

## 2026-10-18: Abertura do resumo geral compacto

- Git comum confirmado; branch codex/dashboard-resumo-compacto parte de
  main fe1b343e. GitHub run 39088213591 terminou failure nesse SHA;
  run 39084939569 aprovou o main anterior 36f3c317.
- GET observacional de /api/health retornou status ok e version 840f0908.
  Fonte: https://crm.descomplicapro.com.br/api/health e GitHub Actions,
  consulta nesta retomada. Codigo integrado e publicado permanecem distintos.
- Escopo: corrigir fechamento dos filtros, compactar cabecalho, remover
  pulso/ritmo/reset, inteiros por piso nos funis e conferir a base dos relatorios.
  Usuario confirmou manter funis com filtros e periodos. Validacao e nova
  publicacao ainda pendentes; nenhuma alteracao de dados remotos autorizada aqui.

- Conferencia de origem: ops/salesforce/transform.mjs deduplica a coleta;
  connection-monitor publica diagnostics.sourceRows. analysis-transform.mjs
  restringe os fatos aos dois canais definidos; analysis.ts recorta os periodos.
  Usuario confirmou preservar essa restricao. Totais coletados desde janeiro
  nao equivalem ao mes vigente. Sem mudanca de contrato, banco ou workflow.
- Falha do main identificada em fonte oficial ITBI HTTP403. A verificacao
  local scripts/verify-documentation-sources.mjs passou nesta retomada;
  CI do candidato ainda deve comprovar acesso. Nao houve bypass do gate.
- Correcao dos filtros remove focus() durante fechamento externo; regressao
  reproduziu chamada indevida e passou nos quatro campos em desktop/mobile.
  STATUS_BREAKPOINT nativo nao reproduzido: a relacao causal permanece inferida.
  Typecheck/build aprovados; lint sem erros e dois avisos em test-results.
  Testes focados de relatorio/paridade: 44 aprovados. Matriz visual em andamento.
- pnpm test local: 3802 aprovados, 95 skips e seis falhas. Duas assercoes
  antigas do reset foram corrigidas e os 44 testes focados passaram depois;
  quatro timeouts/EBUSY em Obsidian estao sendo repetidos isoladamente.
  Nao alterar timeouts ou tolerancias para mascarar concorrencia. CI Linux
  completa do candidato permanece requisito antes de publicar.

## 2026-10-17: Dashboard3/5/5 publicado e validado em producao

- PR250 integrou o ajuste do timeout no main840f0908. CI39061398333 aprovou
  validate, release-gates, isolated-restore e promotable-image; a matriz visual
  completa concluiu sem reduzir cobertura ou tolerancias.
- Artefato12112195227: checksum/revision aprovados. Divergencia esperada entre
  ID config da CI `fab39fbb` e manifesto local `0d2c7cd2` foi comprovada por
  index/config OCI, plataforma linux/amd64, label da release,11 camadas iguais
  no manifesto legado, OCI, diff_ids e RootFS, alem de image:prove2 perfis.
- `release:production` registrou deployment
  fc04ef76-1350-4298-8692-aed95b1bb2f8 no SHA840f0908, deployedAt
  2026-10-18T00:10:01.373Z, sem pendencia. Health publico retornou200/ok e a
  versao exata; container ficou healthy na imagem0d2c7cd2. GET anonimo /app
  retornou307 para /login.
- O comando deploy terminou com codigo1 e mensagem sanitizada depois de o
  recibo final ja estar gravado. `status`, imagem do container, health e CAS
  confirmaram conclusao; nao houve retry nem alteracao manual de ledger/lock.
  Reavaliar se o retorno nao zero reaparecer em outra publicacao concluida.
- Navegador autenticado:1440x900 e390x844 nos temas claro/medio/escuro,
  13 funis/16 artigos, sem overflow horizontal. Somente spans acessiveis1x1
  ficaram tecnicamente recortados por design; textos visiveis nao. Filtro de
  gerente abriu e fechou ao clique externo. Viewport foi restaurado.
- Fontes: PR250, Actions39061398333, artefato12112195227,
  `release:production status`, Docker inspect, /api/health e navegador real.

## 2026-10-17: Gate visual cancelado por limite global

- CI39037162463 no merge ca6c33cf aprovou validate, isolated-restore,
  promotable-image, E2E e todos os checks visuais registrados. A matriz ampla
  foi cancelada pelo runner ao atingir o timeout do job, sem assercao visual
  reprovada; o artefato nao foi promovido e producao permaneceu em eff7f729.
- `release-gates` passa de45 para60 minutos, preservando etapas, cobertura e
  tolerancias. Uma nova CI completa no `main` exato continua obrigatoria para
  publicacao. Fontes: Actions39037162463 e `release:production status`.

## 2026-10-17: Revisao visual do dashboard e retomada12:03Z

- CI38995290171: funcional, RSC, acessibilidade e zoom aprovados;11 diferencas
  intencionais /app revisadas,231 capturas preservadas. Baseline parcial
  promovida com hashes e proveniencia no manifesto, sem reduzir tolerancias.
- Git fetch: main61c9a6a8. GET /api/health12:03:55Z:200/ok, versaoeff7f729.
  PR245 aberto, HEADf6698997. Nenhuma publicacao do dashboard realizada.
- Incorporar base Qlik concorrente e repetir CI verify antes de merge/deploy.
  Fontes: Actions38995290171, PR245, origin/main e health publico.

## 2026-10-17: Locator de filtro fechado na verificacao RSC

- CI38993369136 aprovou validate, restore, matriz sintetica e E2E autenticado.
  Refresh chegou a state-preservation; checkbox dentro de details fechado nao
  e encontrado por getByRole padrao. Reproduzido em Chromium local:0 vs1 com
  includeHidden, mantendo toBeChecked. Teste corrigido sem relaxar assercoes.
- Producao e baseline permanecem inalteradas; nova CI e revisao visual exigidas.

## 2026-10-17: Retomada do PR245 e base concorrente integrada

- Consulta GitHub02:01Z: PR245 mergeable, HEAD73d37fee; CI38993263801 iniciada.
  Mainf1088046 integrada preservando os registros Meta Ads e dashboard.
- GET anonimo /api/health02:01:42Z: HTTP200, statusok, versao34517ba2.
  Dashboard ainda nao publicado. Fontes: GitHub PR245/Actions38993263801 e
  https://crm.descomplicapro.com.br/api/health.
- Nao ativar integracoes ou servicos adicionais nesta entrega. Matriz local
  aprovada nao substitui a CI autenticada, baseline revisada e gates de deploy.
- Proximo criterio: CI funcional completa, revisao das diferencas visuais
  intencionais e nova CI de verificacao antes de merge/publicacao.

## 2026-10-16: Grupos de funis em validacao no PR245

- CI38972729758 aprovou validate/restore/E2E; matriz autenticada interrompida
  em dashboard-auto-refresh. Teste exigia filtro aberto depois de clique
  externo; alinhado ao comportamento solicitado e mantida selecao/RSC.
  Titulos de dialogs fechados excluidos da leitura de titulos visiveis.
  Artefato incompleto nao promovido; nova CI necessaria, sem publicacao.

- Resultado da CI38970011556: validate/restore aprovados,
  mas E2E exigia report-diagnosis-title removido. Atualizado
  e2e/release-candidate.spec.ts para exigir13 funis/78 etapas, ordem3/5/5
  e ausencia das secoes removidas. Guards e demais paginas preservados;
  nova CI obrigatoria antes de publicar. Comparacao visual autenticada nao rodou.

- Fonte GitHub CI38970011556: validate e isolated-restore aprovados;
  release-gates ainda em andamento. Base main34517ba2 integrada emc20d0dc7;
  arvore coincide com merge de teste1be8d014 emd75318ac599d8dd0660a65d4ad2eab268376b77b.
- GET observacional https://crm.descomplicapro.com.br/api/health em21:41:35Z:
  HTTP200/statusok/version34517ba2b2e4022f52bec29260e071b9cf124cca.
  Publicacao concorrente de Qlik; nao e a entrega dos grupos do dashboard.
- QA local:200 verificacoes aprovadas nos tres temas,320/390/768/1440/1920px,
  com dados sinteticos; build, lint, tipos e3670 testes Vitest aprovados.
  pnpm test local parou depois por ACL temporaria Windows em testes de
  publish-candidate Salesforce; sem relaxar permissoes. Comando completo
  aprovado na CI Linux da arvore equivalente. Limite e evidencia no audit
  docs/audits/dashboard-grupos-2026-10-16.md; reavaliar com gates finais.
- Nenhum deploy desta entrega, migration ou workflow n8n executado.

## 2026-10-16: Retomada dos grupos de funis

- Fonte Git fetch origin e GitHub via gh na VPS: main69ae9839, CI38928064973
  concluida/success; HEAD local1c91e0c no ramo codex/dashboard-grupos-periodos-20261016.
  Health publico18:42:09Z HTTP200/ok/66ed7360; integrado, local e publicado distintos.
- Escopo solicitado: grupos3/5/5, periodos limitados ao mes vigente, media anual
  por uma venda, fechar filtros fora/Escape, remover diagnostico/tabelas/equipe/ranking.
  Preservar metas por responsavel e roscas. Sem migrations ou workflows.
- Retomada preservou edicoes locais. Treze testes de periodos e teste de filtros
  em Chromium desktop/mobile passaram. Suite visual e gates globais em andamento;
  nenhuma publicacao desta alteracao. Revisar capturas dos tres temas antes do deploy.

## 2026-10-16: Conferencia autenticada dos tres temas

- Complemento responsivo16/10: inspecao autenticada em viewports1920x1080,
  1366x768,390x844 e360x800, alternando Claro/Medio/Escuro. Roscas, funis,
  filtros abertos, historicos e tabelas nos trechos examinados sem sobreposicao
  indevida. Medicao DOM nao encontrou overflow horizontal da pagina nem dos
  textos folha visiveis avaliados. Tabelas moveis possuem overflow:auto local;
  ultima coluna Hoje acessivel (scrollLeft233, largura343/conteudo576).
  Historico movel rolavel, largura357 sem overflow horizontal, altura811 e
  conteudo1188. Nao e teste em aparelho fisico nem garantia de toda combinacao.
- Captura nativa inicial divergiu do viewport; captura documentada com clip
  no scroll atual confirmou enquadramento correto. Evidencias JPG locais fora
  do Git. Console capturado sem erros; coleta mostrada14:03BRT. Viewport
  temporario removido, Claro restaurado, filtros limpos e dialogos fechados.
  Nenhuma alteracao de codigo ou deploy; suites nao repetidas nesta inspecao.

- Navegador de producao acessivel apos login pelo usuario. Claro, Medio e
  Escuro inspecionados na largura atual do painel (304px), com roscas, funis,
  metas e dialogos legiveis; nenhuma falha visual observada nos trechos vistos.
  Nao equivale a uma nova matriz desktop/mobile. Console capturado sem erros.
- Filtros de canal, gerente, responsavel e empresa exercitados; opcoes dependentes
  e limpeza confirmadas. Um responsavel produziu metas27/8/4/1; esperado ate
  hoje proporcional a16/31. Troca de tema preservou filtro e valores; limpeza
  restaurou315 responsaveis. Historicos: janeiro-setembro, julho-setembro e
  setembro, sem outubro ainda aberto. Fonte: UI autenticada, coleta13:33BRT.
- Estado final: tema Claro, sem filtros ou dialogos. Nenhuma alteracao de
  dados, integracao ou runtime. Health publico16:58:38Z ok/66ed7360; HEAD
  local1c91e0c e versao publicada continuam distintos. Nova consulta gh
  indisponivel no PATH; nao alegar nova validacao CI. Suites nao repetidas
  nesta verificacao observacional. Evidencias visuais locais fora do Git.
- Limite: disponibilidade de pastas aprovadas e metas nao definidas nao foi
  alterada. Reavaliar apos mudanca de dados, layout ou regras. Registro local
  de verificacao, sem nova publicacao de runtime.

## 2026-10-16: Sessão Meta Ads na página Integrações

A etapa implementa a conta de anúncios `1080988750909489`, no business
`310106776631136`, com console dedicado na VPS e status separado de Salesforce.
Não há nova página comercial nem extração de métricas nesta entrega. A leitura
exige acesso efetivo à página Integrações; o console exige também papel master.
A prova de conexão combina URL, conta e interface visível após atualização
controlada; URL ou sessão antiga isoladas não confirmam conexão.

O monitor evita atualizar o navegador enquanto o console está ocupado, publica
somente estado e horário e permite que a evidência expire após 120 segundos.
Os perfis, portas e segredos são exclusivos. O instalador não inicia serviços e
o coordenador aceita `deploy --meta-ads enable` e aplica a configuração com
backup integral, lock compartilhado e comparação atômica.

Build, formatação, testes locais e matriz sintética de navegador passaram; as
auditorias de dependências e segredos não encontraram achados. Esses resultados
não comprovam instalação, login na VPS, coleta ou publicação. Após login no
navegador local, a interface real confirmou a conta e os seletores; parâmetros
transitórios de navegação são aceitos com validação estrita, sem persistência.
A configuração automática do Obsidian não está instalada neste Git
comum. Fontes: código e testes desta branch, inspeção somente leitura da VPS e
runbook `docs/runbooks/meta-ads-vps-session.md`. Revalidar SHA, CI e estado real
antes de qualquer ativação.

## 2026-10-15: Dashboard, filtros dependentes e metas

- Aceite16/10/15:07Z: dois ciclos automaticos novos publicados e conciliados.
  Ingestoes14:36:04.49803Z e15:06:30.629428Z succeeded; inventarios confirmados,
  proximo ciclo15:30Z. Tres visoes presentes no banco, hashes dos fatos,
  contagens e generatedAt identicos a cada carga; segunda carga ja apresentou
  incremento real. Filtros dependentes, nove meses fechados do ano, julho-setembro
  e metas individuais (27 agendamentos,8 visitas,4 pastas,1 venda em outubro)
  conferidos usando codigo atual e agregados reais, sem exportar nomes/registros.
  Falha inicial nao se repetiu nos dois ciclos seguintes; causa nao comprovada,
  sem relaxar validacao. Reavaliar se houver recorrencia ou defasagem da coleta.
  Validacao local repetida: lint Node24 com zero erros/tres warnings existentes,
  tipos/build verdes,3654 Vitest/1181 Node/703 release, skips90/19/14.
  Fonte: journal sanitizado, carga privada no host e consultas agregadas MCP.
- Atualizacao16/10/14:24Z: coleta antiga retomou com ingestao14:06:19Z e
  inventario confirmado; preflight passou. Coletor66ed7360 ativado14:10Z com
  transacao preservada. Reload systemd reordenou dependencias sem mudar conjuntos
  ou identidades: CAS pausou antes do start; comparacao canonica e retomada
  restrita testadas91 Windows/90 Linux+1skip, mantendo bloqueio de drift real.
  Primeiro ciclo novo falhou antes de publicar; diagnostico somente leitura
  validou20230 oportunidades, mas nao comprova causa nem aceite integral.
  Aguardar dois ciclos completos novos. Health200/ok/66ed7360 e acesso anonimo
  redirecionado ao login; n8n inalterado, payload integral confirmado via MCP.
- Publicacao16/10/13:24Z: PR238 integrado em66ed7360, CI38901994232 com os
  quatro jobs verdes. Coordenador unico confirmou deploy69796520-5afb-4136-a8dd-9ffe0b907e97
  em13:24:00.784Z, sem pendencia; health anonimo confirmou66ed7360/ok.
  Preparacao aditiva do banco aplicada via MCP em13:23:14Z; trio do catalogo
  aplicado em uma unica instrucao atomica em13:24:47Z, apos a imagem compativel.
  Conferencias13:25Z e13:58Z preservaram permissoes antigas, overrides, papeis,
  visibilidade, ACL/RLS e policies fora do escopo. Catalogo:27 paginas,
  38 permissoes,146 vinculos de papeis,6 overrides e10 vinculos de usuarios.
  Nginx validado/recarregado13:25:41Z:8m somente no endpoint Salesforce.
- Coletor ainda antigo nesta conferencia: ciclo12:00Z deixou lock apos morte
  do processo; falhas13:00Z e13:30Z antecedem a troca do coletor, ainda nao feita.
  Owner morto, cgroup apenas com scheduler e ausencia de exportacao confirmados.
  Em13:42:03Z o lock original foi movido intacto para backup privado, sob trava
  de instalacao e CAS de identidade/metadados; nenhum dado ou credencial apagado.
  Aguardar ciclo natural14:00Z com publicacao confirmada antes da atualizacao.
  Guard de ciclo completo nao foi relaxado. Criterio final: dois ciclos reais
  distintos do coletor novo e conciliacao dos agregados; health nao os comprova.
  Browser de producao indisponivel por timeout de foco; matriz visual da CI
  aprovada nao equivale a inspecao autenticada em producao. Fontes: GitHub,
  coordenador, health anonimo, MCP Supabase e metadados/journal sanitizados.
- Conferencia16/10/12:38Z apos interrupcao de transporte: Git fetch concluido,
  PR238/25ec804 CLEAN/MERGEABLE, CI38892072377 verde em validate, release-gates
  e isolated-restore. Matriz visual terminou12:00:23Z; imagem ignorada em PR,
  conforme contrato. Ensaio PostgreSQL real do catalogo passou165+53 assertions,
  incluindo falha tardia/rollback e ativacao normal. Restore sintetico passou
  61 migrations/1910 assertions, preservando owners e privilegios efetivos.
  Gates locais completos: lint/tipos/build/format verdes; testes3654 Vitest,
  1181 Node e703 release, skips90/19/14. Health publico12:38:27Z200/ok/b5458ff;
  nada aplicado ao banco, app, Nginx, coletor ou workflow. Fontes: GitHub Actions,
  Git e GET anonimo. A aprovacao do PR nao substitui CI da main nem publicacao.
- Catalogo autorizado16/10: planejador offline fixa hashes do trio PR235,
  remove somente wrappers externos e produz uma unica instrucao DO em autocommit.
  CAS e preservacao abrangem cinco tabelas, inclusive user_roles.40 testes locais
  passaram; revisao independente sem bloqueio concreto. Ensaio compacto ampliado
  mantem165 assertions e acrescenta53, com falha tardia P0235 e comparacao integral
  antes/depois. PostgreSQL real ainda nao executado: Docker indisponivel neste
  Windows; CI deve comprovar o resultado antes de qualquer aplicacao remota.
  Lint global passou com tres warnings preexistentes; suite completa em andamento.
  Backup privado BdFdKs salvo/releitura/hash conferidos, sem dados comerciais;
  nao equivale a restore SQL e precisa novo snapshot/CAS antes da ativacao.
- Retomada16/10/10:55Z: usuario autorizou explicitamente coordenar tambem a
  atualizacao aditiva do catalogo, preservando acessos. A pendencia de autorizacao
  abaixo esta resolvida; testes, backup, transacao atomica e coordenador continuam
  obrigatorios. Git fetch confirma main2eae903 e HEAD2234298; PR238 aberto,
  MERGEABLE/BLOCKED. CI38858636662 passou validate/restore, mas release-gates foi
  cancelado, portanto ainda nao autoriza merge/publicacao do SHA atual.
- GET anonimo10:54:59Z200/ok/b5458ff e coordenador status confirmam deploy
  e42363ec-0f81-4084-9ced-aa405c263b09 de03:59:23.023Z, sem pendencia.
  Historico MCP Supabase permanece sem migrations do catalogo novo, somente
  master_all_permission_defaults apos o marco de preparacao. Fontes: GitHub/gh,
  Git, health publico e Supabase; nenhuma mutacao remota nesta conferencia.
- Encerramento16/10/05:54Z: PR238/cb3078f esta CLEAN/MERGEABLE e CI38854933173
  verde em validate/release-gates/restore. Build e tipos locais verdes; suite
  completa em componentes:3614 Vitest/1181 Node/703 release, skips90/19/14.
  Vitest precisou dois workers por timeouts locais de Obsidian, sem aumentar
  limites; CI Linux passou sem essa adaptacao. Worktree de codigo limpo.
- Publicacao retida por dependencia do PR235, nao por falha do dashboard:
  main2eae903 tem os quatro jobs verdes, mas health05:53:58.936Z ainda b5458ff.
  Coordenador registra deploye42363ec-0f81-4084-9ced-aa405c263b09 em03:59:23.023Z,
  sem pendencia. Supabase confirma17 paginas, ausencia da preparacao do catalogo
  e das novas permissoes; somente defaults Master aplicados. Runtime novo exige
  preparacao do catalogo para preservar acessos. Nao aplicar migrations alheias
  sob autorizacao exclusiva da analise. Usuario consultado: aguardar responsavel
  ou autorizar coordenacao aditiva do catalogo; sem resposta nesta verificacao.
  Reavaliar quando catalogo/runtime forem conciliados ou houver autorizacao.
- Nenhuma migration, app, Nginx, coletor ou workflow foi alterado por esta tarefa.
  MCP n8n confirmou versao ativa dcffaf09-354c-4a82-817c-5e6ca9da1dd5,
  payload integral e persistencia de execucoes desativada. Backup delimitado e
  operador temporario preparados nao comprovam publicacao. Fonte: GitHub/gh,
  GET anonimo, coordenador status, MCP Supabase/n8n; detalhes no audit.
- CI38851076367/f36f9fa concluida verde nos tres jobs de PR. Merge posterior
  2eae903 preserva restricao por etapa e analise somente no dashboard;156 testes
  focais passaram, inventario61 migrations/1910 assertions.11 capturas do
  dashboard e231 da main preservadas. Novos gates combinados ainda obrigatorios;
  migrations de catalogo alheias nao estao autorizadas por esta demanda.
- Retomada16/10/05:07Z: main2eae903 integrou PR235 de catalogo/permissoes,
  exigindo merge da leitura de etapas, inventario e referencias. Health anonimo
  05:07:33.837Z200/ok/b5458ff; GitHubPR238 conflitante. CI38851076367/f36f9fa
  ainda na matriz visual; lint/tipos/test/build locais passaram na repeticao
  (3556/1181/703, skips90/19/14). Primeira repeticao Windows teve dois timeouts,
  ambos passaram isolados e na suite completa sem aumentar limites. Nova CI
  combinada obrigatoria. Fontes Git fetch/GitHub/GET; nenhuma mutacao remota.
- CI38846827500/7804c73 concluida com validate, release-gates e restore verdes;
  imagem ignorada como previsto em PR. Merge posterior com cd004e4 requer nova
  CI. Operador isolado Linux:84 testes aprovados,1 skip exclusivo de Windows,
  sem mutacao de servicos ou dados. Nao substitui aceite real de dois ciclos.
- Retomada16/10/04:22Z: maincd004e4 integrou PR237 dos simuladores; PR238
  exige merge de documentos e manifesto. Preservadas11 entradas do dashboard
  e231 da main, incluindo quatro novas referencias moveis dos simuladores.
  Health anonimo04:22:48.788Z200/ok/b5458ff; CI38846827500/7804c73 ainda na
  matriz visual, validate/restore aprovados. Fontes GitHub/gh, Git fetch e GET
  publico; nenhuma ativacao remota desta tarefa. Nova CI combinada obrigatoria.
- CI38845696585/2014576: validate passou; QA sintetico encontrou disputa de
  foco ao abrir historicos em sequencia. Teste deterministico reproduziu:
  onClose atrasado roubava foco do proximo botao apos close nativo. Removido
  callback redundante; teste falhou antes/passou depois e quatro testes de
  navegador passaram. Nova CI continua obrigatoria; sem ativacao remota.
- Consulta16/10/03:28:58.816Z: health publico200/ok/b9377a1, atualizado por
  outra publicacao; mainb5458ff e branch2014576 sao distintos. CI38845696585
  em andamento no PR238. Fontes: GET anonimo, Git remoto e GitHub Actions.
  Nenhuma ativacao de analise/DDL/coletor desta demanda foi executada.
- Retomada16/10/03:27Z: mainb5458ff integrou PR231 de planejamento de metas.
  PR238 precisou novo merge. Manifesto combinado por JSON:11 entradas do
  dashboard preservadas e231 da main preservadas, todos os hashes conferidos.
  66 testes de inventario/paridade/navegacao/metas passaram; CI nova obrigatoria.
- CI38841091143/4fa4c5d: funcional/banco1883/restore/E2E aprovados. Matriz242
  completa com11 diferencas apenas em /app; referencias revisadas e231 restantes
  preservadas, incluindo Qlik. Hash/arvore/fingerprint comprovados no audit.
  Nova CI verify exigida; sem migration, coletor ou app publicados. Preflight
  Salesforce02:58Z confirmou Unidade de Negocio selecionada nas duas atividades.
- Retomada16/10/02:33Z: origin/main b9377a1 incorporado, preservando ranking
  Qlik v2 e suas referencias. Inventario combinado:56 migrations/1883 assercoes
  pgTAP. PR238 estava DIRTY, sem CI para d08070d; resolucao preserva testes de
  dashboard e ranking. Nova validacao obrigatoria antes de qualquer ativacao.
- Merge4fa4c5d em PR238, CI38841091143 iniciada; formatacao/lint/tipos verdes
  em02:35Z, restante pendente. Health anonimo02:35:49.765Z200/ok/d83c22d.
  Fontes: GitHub Actions/PR238 via gh e GET publico; sem mutacao de runtime.
- Verificacao local4fa4c5d: lint/tipos/test/build passaram,3547 Vitest/1181 Node/
  703 release aprovados;90/19/14 skips registrados. CI Linux e provas reais
  continuam obrigatorias. Revisao independente do merge sem achados no escopo.
- CI38834121342/3f05de8: validate/banco/restore aprovados; E2E exige links
  removidos da raiz e foi atualizado ao novo contrato, preservando as etapas.
  Matriz visual/merge/ativacao pendentes. Health16/10/01:23Z200/ok/d83c22d.
  Backup privado da funcao/ACL preparado, sem DDL ou dados de clientes;
  [evidencias e limites](../audits/dashboard-filtros-metas-2026-10-15.md).
- CI38836371948/270ccb3 repetiu banco/restore aprovados; E2E dependia de
  atributo opcional ausente sem snapshot. Seletor corrigido; quatro casos
  sinteticos passaram com/sem coleta. Matriz autenticada ainda pendente.
- CI38838263880/01cea33: E2E autenticado aprovado. Matriz parou no helper de
  auto-refresh que exigia link removido; atualizado para selecao real de canal,
  sem reduzir provas de RSC/estado. Referencias e ativacao ainda pendentes.

- Retomada18:36Z: maina7fdf92, CI38775901605 success; site200/ok/fae77f9.
  Branch codex/dashboard-filtros-metas criada do main. PR234 documental tem
  CI38773011324 verde, mas conflito com main; preservado sem integrar.
- Usuario definiu colunas: Gerentes de vendas, Contato Corretor Proprietario,
  Unidade de Negocio e Imobiliaria; canal limitado aos dois textos informados.
  Novas regras de meses fechados, metas e comparativos requerem verificacao
  do contrato completo. Confirmado depois: metas por responsavel unico dos
  relatorios filtrados, dias uteis segunda-sexta com quinta valendo2.
  Usuario autorizou explicitamente atualizacao aditiva do banco/coletor apos
  testes. Autorizacao nao e evidencia de aplicacao. Fontes:
  Git fetch/GitHub branches/main, PR234/Actions e health publico sem sessao.
- Validacao posterior:284 focais,37 Node e185 checks visuais aprovados; revisao
  isolou ranking via RPC protegida (68 testes). Global3245 aprovados/88skips,
  texto removido corrigido; O_NOFOLLOW no Windows requer CI Linux. Transporte
  Salesforce8MiB somente no endpoint exato, restante preservado. Nenhuma
  migration, configuracao remota ou workflow alterado nesta etapa.
- Main d83c22d integrado em b26ddaa; health16/10/2026 00:22:32Z200/ok/d83c22d.
  Fetch posterior mostrou main17ab106, CI38829007559 em andamento. Fonte:
  Git/GitHub via gh no host existente; versoes local/integrada/publicada distintas.

## 2026-10-16: Limite Qlik corrigido na fonte real

- Main17ab106/CI38829007559 quatro success; imagem imutavel e dois perfis
  comprovados. Owner deployment933a111d-17db-4ea3-a327-9f10be9cbaa6 promovido
  pelo coordenador00:58:46.990Z. Qlik real respondeu sem qix_metadata_limit.
- Metadados nativos00:58:46.525Z/recarga00:12:35.983Z,18438 bytes privados.
  Hash7972045382ad30177e123aa6716f176a76c41c695147e3d97c74be6424e96ffa.
  Mapeamento configurado com dois objetos reais, IDs CRC/MEM, DT e medidas
  pinadas.39 testes focais aprovados; nao equivale a conciliacao ou publicacao.
- Fonte JSON foi relida via SSH sem TTY: quebra de linha do terminal havia
  duplicado caracteres em transcricoes de hashes. Recusas ocorreram antes
  de escrita; pins produtivos usam somente os64 caracteres do JSON original.
- Fontes: coordenador/ledger owner, JSON nativo privado e testes locais.
  CRM continua d83c22d; fatos e agenda habilitada ainda nao comprovados.
  Manter interface congelada; proxima evidencia exigida e carga real conciliada.
- CI38829579490 validate/restore success, matriz falhou somente11Ranking
  por dimensions_changed. Captura38829579457/artifact12017910719 revisada,
  11 baselines e manifesto integral promovidos;231 demais imagens preservadas.
  Testref15pass/1skip. Prettier apenas formata JSON, igualdade semantica exigida.
  Collector+mapping260pass, lint/tipos exit0. Nova CI ainda necessaria.
- Build Windows exit0; teste completo falhou somente na fixture que esperava
  default produtivo null. Corrigida para definition:null sem relaxar bloqueio
  de HMAC/coleta. Novo teste completo e CI ainda exigidos.

## 2026-10-16: Coleta priorizada, interface congelada

- Escopo vigente: corrigir Qlik e provar atualizacao real via VPS, sem novas
  mudancas na interface. Canal de Parcerias continua referencia, recorte
  Direcional/SP CAPITAL/CANAL IMOB e destino /app/ranking preservados.
- Fetch/GitHub confirmam main17ab106; CI38829007559 com validate/restore/
  imagem success, matriz final ainda em andamento. GET publico00:53:44Z
  HTTP200/ok/d83c22d. Ledgers CRM72be7b10 e owner00bbab75/a7 sem pendencia.
  Nenhuma nova promocao realizada; aguardar gate sem dispensa.
- Checkout17ab tem codigo legivel e SDK/script aprovados como UID tecnico,
  Node24; assertQlikDependencies passou. Copia d83 tinha dependencias somente
  de producao e foi preservada em quarentena privada. Reposta com copia
  integral a7,38123 entradas verificadas, bytes preservados. JSON package
  difere apenas pelo comando QA compacto; lock byte a byte igual. Sem build
  na VPS, credencial ou perfil alterado.
- Nova leitura web da referencia retornou400/timeout; nao alegar atualizacao
  dessa fonte. Usar contrato observado previamente e documentado no runbook,
  nao valores antigos para conciliar a carga atual. Confirmar metadados reais
  apos promocao protegida. Fontes: GitHub, health e probes locais/host.

## 2026-10-16: Conferencia apos interrupcao e limite da entrega

- Conferencia00:47Z: Git primary7c11e3c limpo, exceto output preexistente;
  health publico HTTP200/ok/d83c22d. CI main38829007559/17ab106 com
  validate/restore/imagem success e release-gates ainda em progresso.
  Nenhuma nova promocao app/owner executada nesta retomada.
- Atualizacao real do ranking continua nao comprovada. Ultima falha nativa
  conferida foi qix_metadata_limit; preparar checkout/testes nao a resolve
  por si. Priorizar coleta real e reaproveitamento da referencia Canal de
  Parcerias, sem novas frentes de interface. Gates de seguranca/publicacao
  continuam obrigatorios, sem transformar este redirecionamento em dispensa.
- Fontes: Git local, GET /api/health e GitHub actions38829007559/jobs.
  Ferramenta de subagentes retornou not_found para os IDs anteriores apos
  interrupcao; nao inferir seus resultados finais. Logs locais preservados.
- Recibos locais posteriormente lidos em qa-primary-sequential-7c11e3c
  confirmam lint exit0, tipos exit0 e teste exit1 concluido00:42:33Z;
  build ainda sem comprovacao. Sessao SSH56092 tambem retornou not_found,
  sem comando novo ou alteracao de servicos. Nao declarar gates locais verdes.

## 2026-10-16: PR236 integrado, primary combinado

- Merge normal PR236/f7e6731 em17ab106 apos CI38802612284 tres success.
  Push/main38829007559 ainda pendente; nenhuma imagem antecipada. Local
  Windows OP so lint nessa rodada; CI Linux executou quatro comandos.
- Primary incorpora usuarios/presenca:55 migrations/1695 pgTAP planejados,
  focais28 e review das tres resolucoes sem achados. Baseline fullmain
  transitora96d5799b/242 imagens,11Ranking iguaismain/231 preservadas;
  testref15 pass/1skip. Recaptura combinada unica continua obrigatoria.
- Health/ledgers apos retomada permanecem CRMd83c/72be7b10 e ownera7/
  00bbab75 sem pendencia. Checkout17ab apenas preparado com package/lock
  iguais a d83c, sem runtime publicado. Fontes e limites em WORKLOG.

## 2026-10-16: Retomada e CI Linux completa do corretivo

- Relogio UTC retomado00:18Z apos intervalo longo de transporte/execucao;
  nao inferir atividade ou conclusao local pelo tempo. SSH97485 perdeu
  transporte; nova sessao56092 restabelecida sem alterar rede/contas.
- Fetch e GitHub PR236 confirmam main/base d83c22d, headf7e6731,
  mergeabletrue. CI38802612284 concluiu validate, isolated-restore e
  release-gates success; promotable-image skipped por ser PR. Este resultado
  nao comprova CI/main nem imagem/publicacao. Full Windows continua separado.
- GET publico sem cookies00:19:35Z200/ok/d83c22d. Ainda publicado o CRM
  concorrente, nao esta demanda. Nova consulta ao ledger/CI/main exigida
  antes de qualquer promocao. Mapeamento/fatos reais ainda pendentes.
- Fontes: Git fetch, GitHub PR236/actions38802612284/jobs e health publico.

## 2026-10-15: Pre-requisitos privados e tentativa autonoma

- Probe standalone readonly confirmou leitura/presenca/formato Supabase e
  HMAC;114 checks e review70, valores nunca exibidos. Nao comprova RPC ou
  aceite integral do transform. Guardas/caminhos/resultados em WORKLOG.
- Owner PID3849356/NRestarts0 ativo desde18:12:31Z. Tentativa autonoma
  20:12:51.412Z ainda unavailable/qix_metadata_limit, artefato privado
  7H0sjX/181bytes/SHA69aab608. Nao e carga de fatos. PR236/f7e6731/
  CI38802612284 validate success; restore/release pendentes nessa consulta.
- Fontes: systemctl show restrito, projector privado de enums/hashes e
  GitHub CI. Metadata novo e publicacao real continuam criterios de aceite.

## 2026-10-15: Consistencia do estado de selecao QIX

- Primary acrescenta estado$ explicito ao objeto proprio SelectionObject e
  exige qStateName$ em todos os layouts. Oito regressoes modulo/VM cobrem
  ausencia/alternancia antes de fatos/cleanup;247 focais aprovados, lint e
  format aprovados. Demais gates e runtime do delta ainda nao verificados.
- Revisao readonly consultou schema instalado12.612.0/Enigma2.15.0 e
  https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/EngineJSONAPI/Content/models-selectionobject.htm.
  Layouts HyperCube/ListObject possuem qStateName oficial; nao relaxar
  guards pela ausencia no required OpenRPC sem evidencia real de omissao.

## 2026-10-15: Nova baseline CRM e retomada de transporte

- SSH2632 perdeu transporte; tentativa de reconexao e conector GitHub
  ficaram indisponiveis temporariamente. Sessao97485 restabelecida sem
  alterar contas/rede/permissoes. Nao houve mutacao durante a indisponibilidade.
- GET publico20:16:53Z confirmou200/ok/d83c22d. Coordenador status registra
  deployment72be7b10-a4f6-4178-8f9f-6049dd5ae0d3, d83c22d,
  imagem2e832356, deployedAt19:15:11.541Z, sem pendencia. Publicacao
  concorrente PR232, nao realizada por esta frente. Qlik owner00bbab75/a7fdf92
  permanece separado, rankingConnectedfalse e sem pendencia.
- CI38785519700/2f27e2f concluiu tres gates success; imagem PR skipped.
  Nao e CI main nem comprova carga real. Probe privado readonly de config
  recusou na fase imports: a7 nao possui o transform Qlik ainda exclusivo
  do PR216. Nao prova ausencia de credencial e nao alterou arquivos privados.
- Fontes: coordinator status/qlik-status, GitHub actions/jobs e health.
  Preservar nova baseline nas proximas operacoes CAS. Pins/fatos pendentes.

## 2026-10-15: Retomada observacional as18:56Z

- Git comum confirmado; fetch preservou codex/qlik-ranking-vps/2f27e2f.
  GitHub branches/main retornou d83c22d, merge concorrente PR232. Nao
  confundir main integrado com CRM publicado fae77f9: GET publico sem
  cookies18:56:18Z confirmou HTTP200/statusok/versao fae77f9.
- CI38785519700 no head2f27e2f: validate/restore success e release-gates
  ainda em progresso. Nao valida o hotfix OP nao commitado. Owner Qlik
  segue a7fdf92 com ultimo diagnostico qix_metadata_limit; sem evidencia
  nova de fatos publicados. Gates completos e nova coleta real pendentes.
- Fontes: GitHub API branches/main e actions/runs/38785519700/jobs,
  https://crm.descomplicapro.com.br/api/health e Git local. Reavaliar
  main/CI/health/ledger no minuto de cada promocao protegida.

## 2026-10-15: CI visual verde e limite real de metadados

- CI38777064690/0acb00f concluiu os tres gates success, incluindo verify das
  referencias combinadas. c00d390 acrescenta aliases e gates locais verdes,
  mas permanece somente local; nao confundir CIs de SHAs diferentes.
- Owner00bbab75/a7fdf92 promovido pelo coordenador18:12:40.057Z apos CI
  main38775901605 quatro jobs success, imagem/verificacao OCI11 camadas e
  dois perfis runtime. CRM8e3594fd/fae77f9 preservado; sem pendencia.
- Checkout inicialmente0700/0600 bloqueou antes de intencao. Modos somente
  da copia de codigo versionado foram normalizados, com hashes/Git limpo;
  1369 arquivos/203 diretorios. Probe efetivo com Node24/usuario tecnico
  passou. Ignorados/credenciais/perfil nao alterados; detalhes no ramo OP.
- Nova tentativa QIX gerou unavailable/qix_metadata_limit: snapshot privado
  7WjFNw/181bytes/afaa9c83/18:12:39.879Z. Limite especifico ainda desconhecido.
  Correto restringir projecao e diagnosticar, nao aumentar caps para passar.
  Nenhum fato publicado; corretivo separado em codex/qlik-bounded-catalog.

## 2026-10-15: Alias pinado e evidencia inicial real

- Cinco suites367/367 e review independente14 probes/367 testes passaram.
  Catalogo unico/fresco e hash integral protegem masters nomeados; enriquecido
  usa biblioteca explicita e preserva nativo/totais/IDs. Espacos/colchetes e
  fallback com biblioteca cobertos. Producao null; transitivas ainda pendentes.
- Lint/tipos/test/build globais passaram no Windows/Node24.19.0/pnpm11.20.0:
  total4979 aprovados/120 skips,51 paginas. CI Linux/publicacao nao inferidas
  desses skips; limites/assercoes preservados.
- Banco production consultado17:44:43Z: zero observacoes/publicacoes v2.
  Sessao CRM autenticada manualmente confirmada; ainda UI antiga. Referencia
  acessivel IAB17:38Z, mas agosto/fonte20-08 desatualizados, nao conciliacao
  atual. Projecao privada corrigida antes de uso real,38 testes sinteticos;
  detalhes e limites integrais em WORKLOG. CI main38775901605 ainda pendente.

## 2026-10-15: Publicacao concorrente observada

- Coordenador status consultado17:20Z registra CRM8e3594fd/fae77f9,
  deployedAt16:50:53.010Z, imagem3fc560e5, sem pendencia. GET publico
  /api/health17:20:49Z confirma200/ok/fae77f9. CI main38765178719 quatro
  jobs success. Este agente nao publicou esse dashboard; preservar baseline
  nova nas proximas observacoes/CAS, nunca reutilizar o esperado6843ef1.
- Checkout separado a7fdf92 preparado sem runtime; package/lock identicos a
  9ffc8a9, copia de dependencias38123 entradas protegidas/root/nlink1,
  sem bytes modificados ou build na VPS. CI38775901605 ainda pendente.

## 2026-10-15: Captura unica promovida para revisao verify

- Captura38770527668/aa9df803 success,242 hashes conferidos,11 Ranking
  revisados e231 preservados. Proveniencia unica; ZIPb8c118f1 e manifesto
  217a76c2. Detalhes/limites em WORKLOG. Nova CI verify ainda obrigatoria.
- Contrato antigo sourceMarkerVisible divergia do harness main que emite
  sourceMarkerVerified/Presentation. Teste agora exige os valores atuais
  exatos; nao remove RLS/contagens. Focal15 passou, um browser condicional
  nao executado. Ranking produtivo continua bloqueado por pins reais.

## 2026-10-15: Retomada observacional as16:50Z

- PR233/6b0350b: CI38769375192 concluida success nos tres gates do PR,
  inclusive matriz integral. Merge normal, com head exato, em maina7fdf92
  as17:16:04Z. CI push/main e imagem ainda pendentes; owner nao alterado.
- Gates locais de b4fc3fc, Node24.19.0/pnpm11.20.0/Windows, sequenciais:
  lint/tipos/test/build exit0. Vitest3199/87 skips, release703/14 skips,
  build51 paginas. Warning lint preexistente e MODULE_TYPELESS preservados;
  nenhum timeout/asserção alterado. Nao substitui CI/publicacao real.
- Fetch/GitHub: mainfae77f9; PR233/6b0350b com validate/restore success e
  matriz visual em curso. PR216/b4fc3fc permanece draft; captura combinada
  38770527668 e CI38770527596 em curso, sem aprovar outra versao por inferencia.
- GET publico de /api/health16:50:20Z:200/ok/6843ef1. Coordenador confirma
  CRM57c09296/14-10T20:38:13.413Z e owner3a4698b7/9ffc8a9/15:24:46.025Z,
  ambos sem pendencia. Fonte GitHub e health consultadas nesta retomada;
  metadados autonomos anteriores nao comprovam publicacao de fatos.

## 2026-10-15: Baseline integrada exige captura nova

- Mainfae77f9 integrado ao ramo Ranking. Referencia temporaria integral da
  main, manifesto2383f380/242 imagens verificadas, sem proveniencia mista.
  Lote Ranking anterior preservado em e03b972. Codigo Ranking inalterado;
  nova captura combinada/revisao exigidas antes de atualizar a referencia.
- Reference-parity15 aprovado e um browser condicional nao executado.
  CI completa ainda pendente. O PR de fatos segue draft enquanto faltam
  pins nativos/publicacao. Owner9ffc8a9 consultou QIX sozinho16:24:52Z,
  mesmo PID3446769/sem restarts desde15:24:35Z; ainda somente metadados.

## 2026-10-15: Supressao real nao implica zero

- Snapshot QIX real tinha qSuppressMissing true. Aceitacao agora depende da
  mesma prova integral nativo/enriquecido, sem converter NULL em zero. Dados
  ocultos, faltantes e totais divergentes continuam rejeitados. Focais218,
  incluindo15 regressoes novas, lint/formatacao aprovados. CI ainda pendente.
- Aliases reais =VENDAS/=VGV ainda requerem definicoes e precedencia; somente
  os nomes nao provam se sao variaveis/medidas/campos. Metadata corretivo em
  branch separada, sem enfraquecer o bloqueio produtivo do mapping.

## 2026-10-15: QIX real autenticado, mapping pendente

- Main9ffc8a9/CI38753275427 quatro jobs success. Download repetido apos gates,
  hashes/cadeia OCI11 camadas e image:prove2 perfis aprovados. Credencial
  systemd preparada sem expor valor. Desvio anterior nao dispensou gates.
- Owner3a4698b7/9ffc8a9 promovido15:24:46.025Z, CRM6843ef1 preservado,
  sem pendencia. QIX real leu metadados; recarga14:13:23.247Z. Snapshot
  privado0TX0aCu9/cf87dcb1/3318bytes, sem linhas de dados nem publicacao.
- Container sn-tabbed-container nao resolvido para Parceiras. Produto tem
  qSuppressMissing true e aliases VENDAS/VGV; conferir definicoes/identidades
  reais antes do mapping. Ramo metadata corretivo separado; coleta bloqueada.

## 2026-10-15: Mapping dinamico, ainda sem pins produtivos

- Factory/launcher passaram62 testes e review independente. Mesmo snapshot
  nas duas sessoes; novo ciclo recalcula YTD em Sao Paulo. Definicao/politica
  entram no SHA; periodos derivados nao. Default null bloqueia uso produtivo.
- Transporte preserva somente codigos QIX da allowlist existente, antes
  descartados genericamente. Script serializado/limites:149 aprovados/um skip.
  Lint/formatacao focais aprovados. Fatos e CI deste delta nao comprovados.

## 2026-10-15: Renovacao integrada, ativacao ainda bloqueada

- PR229/CI38747697537 aprovado; main9ffc8a9 integrado14:38:57Z,
  CI38753275427 ainda em execucao. Novo checkout/deps protegidos e HMAC
  dedicado root0600 preparados, sem ativacao ou leitura do segredo.
- Imagem isolada foi baixada/carregada antes de todos os gates, ordem incorreta
  detalhada na auditoria. Sem runtime promovido. Repetir download/verificacao/
  prova apos quatro jobs success; excecao nao altera o procedimento autorizado.
- Global local repetido:3176 aprovados/87 skips, timeout MCP devtools;
  isolado24/24 passou sem ampliar limites. Linux continua gate integral.
- Review QIX: mes excluido sem fatos falha fechado antes dos cubos. Nao
  converter X em zero. Ocorrencia real nao verificada; exige prova nativa se
  surgir. Fontes oficiais/limites na revisao, nao alterar selecoes por suposicao.

## 2026-10-15: Integracao candidata e limite das evidencias

- Renovacao integrada ao ramo PR216, ainda sem mapping produtivo. Revisao
  independente confirmou arquivo exigido ausente e argumento mapping nao
  encaminhado; ambos bloqueiam promocao, sem preencher hashes por suposicao.
- Host/inputs/engine553 aprovados/2 skips; launcher39. Lint/tipos aprovados.
  Global3176 aprovados/87 skips/um timeout30s no Obsidian; repeticao isolada
  22/22 aprovada, sem mudar limites. Build51 rotas aprovado. Node integrado
  teve timeout25s artifact-stale; repeticao isolada passou1,8s. CI obrigatoria.
- Arquivo historico preserva18 secoes completas, transferencia literal
  SHA256af225b06040f743196a1f859f513433e6d8215e69fef16d58135a4f2173dcde2.
  Sync voltou a passar. Fonte atual14:28Z: health200/ok/6843ef1; PR229 aberto,
  CI38747697537 ainda na matriz, validate/restore aprovados. Owner sem carga.

Historico integral: [arquivo de 2026-09-27 a 2026-10-13](ATUALIZACOES-ARQUIVO-2026-09-27-a-2026-10-13.md).

## 2026-10-15: Migration Qlik v2 autorizada e aplicada

- Fonte CI38742972444/ba96607 success e backup privado novo lAzyGoTT na VPS,
  checksums/fsync/modos conferidos. Supabase MCP aplicou somente a aditiva;
  historico20261015141558 corresponde ao arquivo20261014170549 aprovado.
  Nao usar repair/db push para igualar carimbos. Pos-check: RLS forcada,
  zero grants diretos novos/legados, writer service_role-only, reader
  authenticated-only e zero EXECUTE PUBLIC. Ainda sem fatos ou flag ativa.
  Detalhes, limites do backup e prova em WORKLOG/auditoria Qlik.

## 2026-10-15: Projecao delimitada e validacao inconclusiva Windows

- Ramo codex/qlik-bounded-catalog/basea7fdf92:207 focais aprovados e
  review independente22 probes sem P1/P2. Caps mantidos; catalogo relevante
  retido antes de validar comprimento. Diagnostico fixo inclui stage/kind/
  observed/maximum, sem campos/expressoes. Tres aliases adicionais somente
  com referencia direta. Ainda nao identifica qual limite real falhou.
- Lint/tipos exit0; teste global exit1/4918.24s,10 arquivos/26 testes
  falhos,2798 aprovados/85 skips,5 erros incluindo worker timeout. Causa
  completa nao isolada. Node/release nao rodaram e build interrompido;
  repetir com um worker apos integrar main e exigir CI Linux completa.
- GitHub main d83c22d/PR232; health publico20:16:53Z200/ok/d83c22d,
  ledger deployment72be7b10/deployedAt19:15:11.541Z/imagem2e832356,
  sem pendencia. Owner00bbab75/a7 permanece separado, sem fatos. Nao
  confundir main integrado, validacao Windows e runtime publicado.
- Fontes: GitHub branches/main, health e coordenador status/qlik-status.
  Transporte temporariamente indisponivel recuperado; nenhuma mutacao
  durante a falha. Proxima promocao depende de fresh CI/main/CAS e imagem.

## 2026-10-15: Owner atualizado, limite nativo ainda bloqueia

- Maina7fdf92/CI38775901605 quatro jobs success. Artefato11993912111 baixado
  somente apos gates: ZIPcd46ea9c, tare589a5cb, config3317425c e manifesto
  local9346dc27/11 camadas conferidos. image:prove dois perfis passou.
- Primeira promocao bloqueou antes de intencao, sem trocar owner/pendencia.
  Checkout novo sob umask077 tinha codigo0700/0600; dependencias estavam
  legiveis. Corrigidos somente1369 arquivos versionados e203 diretorios do
  candidato,1572 modos, hashes antes/depois e Git limpo. Helper revisado27
  casos, sem locks opcionais do Git. Ignorados/credenciais/perfil preservados.
  Probe inicial usou /usr/bin/node18 e nao valida o runtime; probe exato com
  /usr/local/bin/node24, env limpo e usuario tecnico passou SDK/script.
  Reavaliar em cada checkout novo; nao mudar umask/ACL global ou segredos.
- Promocao pelo coordenador as18:12:40.057Z: owner00bbab75/a7fdf92,
  sem pendencia, rankingConnected false, preflight unavailable. Snapshot
  privado7WjFNw,181bytes/SHAafaa9c83, observado18:12:39.879Z, motivo
  qix_metadata_limit. Nao atribuir o limite a um contador sem diagnostico.
  CRM8e3594fd/fae77f9 preservado, health18:12:04Z200/ok/fae77f9.
  Ramo corretivo codex/qlik-bounded-catalog separado; ainda sem fatos.

## 2026-10-15: Meta

Implementação no PR231; integração concorrente de main b9377a1 em andamento, produção ainda d83c22d (health200/ok,16/10 02:16UTC). CI anterior passou validação/restauração/E2E; nova integração exige CI completa. [Histórico integral, testes e limites](../audits/meta-2026-10-15.md). O histórico desta seção foi movido integralmente para a auditoria após atingir o limite de exportação do runtime; nenhuma evidência foi descartada.

- 16/10/2026,00:59 BRT: Gestão > Meta publicada em b5458ff, PR231 e CI38844155079 aprovados; health200/ok e barreira anônima307 confirmados. Deployment e42363ec-0f81-4084-9ced-aa405c263b09 sem pendência. Testes locais completos e242 comparações visuais aprovados. [Evidências, proveniência e limites](../audits/meta-2026-10-15.md#encerramento-publicação-verificada-em-16102026). Registro final somente documental, sem novo restart.

- 18/10/2026: PR240 integrado no SHA `8eb023c1` após a CI `39176723284` aprovar validação, restauração isolada e release gates sobre a `main` atualizada. O registro documental da publicação da Meta está concluído; não houve alteração de runtime ou restart.

- 18/10/2026, 12:59 BRT: retomada do PR240 no SHA `bbc3fbd3`. A CI `38848589053` aprovou formatação, lint, tipos e 717 testes, mas falhou na consulta documental do ITBI por HTTP 403; os demais jobs foram ignorados. O PR está conflitante com a `main` `6b6e88f` e será reaplicado sobre essa base, preservando os registros posteriores. Health observado em `https://crm.descomplicapro.com.br/api/health`: HTTP 200, `status=ok`, versão `d919751`; essa versão publicada não corresponde ao ramo documental e não comprova a correção solicitada para edição de metas.

## 2026-10-16: Publicacao app e recusa de fatos preservada

- Main b937/CI38839240305 quatro success. ZIP12021130754 SHA3f37c0258cd1fe10d10bfbd032a0132011c7068ac1fe71cf2a7de5d98240269f,
  OCI11 camadas e dois perfis comprovados. CRM a8a126eb-c373-4005-b68a-456012a6336b
  publicado02:59:30.399Z pelo coordenador, Qlik v2 habilitado. Health03:00:08.353Z
  200/ok/b937. Nao confundir endpoint habilitado com dados atualizados.
- Owner e26cdcd3 interrompido apos backup; recuperado17ab/c8314c64 via comando
  exato. Nova tentativa84cdd4c0 gerou recibo real03:02:41.093Z unavailable/
  master_pin_mismatch, sem publicacao. Recuperada em28b9ffc9/17ab03:07:20.476Z.
  Sem remover ledgers/travas, restaurar perfil automaticamente ou alterar ACL.
- Banco produtivo MCP03:10:14.101Z:0observacoes/0publicacoes. Diagnostico do
  artifact exige UID/GID997: tentativa root usou validador que compara gid do
  processo e recusou a leitura; nao era ausencia de arquivo. Projetor como
  usuario tecnico validou o recibo e imprimiu somente codigo fixo.
- Corretivo focal separa metadados opcionais alheios dos aliases pinados e
  acrescenta diagnosticos fixos de catalogo. Mecanismo local reproduzivel;
  entrada exata da fonte nao observada. Novo canario necessario para confirmar
  causa/resolucao, sem relaxar conciliacao, selecoes ou hashes. Interface intacta.
  Fontes: GitHub, coordenador, artifact sanitizado e Supabase MCP.
- Focais collector/artifact327:326 pass/1 skip POSIX, sem falhas. Label
  projetado ausente nao vira propriedade vazia; titulo/ID/hash nativos continuam
  obrigatorios. Alteracoes e colisoes seguem recusadas. Revisao independente
  sem P1/P2 de binding nos cenarios, nao confirma entrada exata da fonte.
- Lint/tipos/build Windows exit0 no corretivo. Teste completo registrou falhas
  de subprocessos locais fora do Qlik; conjunto ainda em execucao e causa
  nao isolada. Nao ocultar falhas ou reduzir cobertura. PR239 inicialmente
  sem checks; push documental synchronize sera conferido, sem alegar CI verde.
- Causa da ausencia de checks confirmada: PR239 CONFLICTING/DIRTY apos main
  PR231/b5458ff. Nao era evidencia de credencial invalida. Merge preservou
  secoes completas Meta/Qlik de CHANGELOG/WORKLOG; codigo e referencias main
  sem ajuste manual. Conjunto integrado exige CI nova, sem trocar baselines.
- Protocolo Qlik NxGroupTail permite qUp/qDown zero em paginas completas;
  duas regressoes direta/VM falharam antes e passam apos tratamento estrito
  de zeros. Array limitado por qSize.qcx, nao-zero/tipos invalidos recusados,
  area/matriz/reducao/totais preservados.388 focais:387pass/1skip POSIX.
  Nao atribuir o canario master_pin_mismatch a tails (fase posterior).
- Revisao readonly de tails sem P1/P2;44 testes focados de paginacao/reducao
  passaram. Nao substitui CI completa nem prova a coleta produtiva.

## 2026-10-16: PR216 integrado; promocao e fatos ainda pendentes

- Head8dd4a3e: lint/tipos/build Windows exit0; teste completo3334 vitest,
  1164 ops e703 release aprovados (89/19/14 skips explicitos). CI38834764103
  tentativa1 falhou por HTTP403 da fonte publica ITBI; tentativa2 concluiu
  validate/restore/release success, sem alterar politica, fonte ou gate.
- PR216 integrado normalmente02:12:36Z em b9377a1031865a01dccfbda4a87fa2d2dd84b2c5,
  arvore identica ao head. MainCI38839240305 em andamento, nao e autorizacao
  para baixar/promover imagem antes dos quatro jobs success. Captura adicional
  38834764063 tambem concluiu success; nao houve nova mudanca visual.
- Canonical b937 na VPS tem package/lock identicos a17ab,38123 dependencias
  verificadas e probe UID997/Node24 com SDK/script/mapa aprovado. Probe privado
  readonly do transform retornou complete/preparationAccepted true, sem revelar
  ou escrever segredos; nao comprova autenticacao Supabase/RPC ou coleta QIX.
- GET publico02:16:20.295Z200/ok/d83c22d. Coordenador confirma CRM72be7b10,
  publicado15/10/19:15:11.541Z; owner933a111d/17ab,16/10/00:58:46.990Z.
  Ambos sem pendencia. Nenhum servico alterado por esta preparacao.
- Supabase MCP confirmou projeto hnncxuerlcsaahdxoswb, production ACTIVE_HEALTHY;
  consulta01:34Z mostra0 observacoes/0 publicacoes. Writer presente com assinatura
  de cinco argumentos igual migration, service_role permitido/anon negado;
  probe inicial usou assinatura incorreta de dois argumentos, nao era ausencia.
  Reader presente. Fontes: Git/GitHub, health, coordenador, probes e catalogos.

## 2026-10-16: CI verde e nova base concorrente

- CI38846173348/cf2b1c1 tres success; merge normal bloqueado depois de main
  receber PR237/cd004e4. Conflitos somente documentais, sem codigo Qlik.
  GitHub required_status_checks.strict=true em consulta readonly: cada
  base nova exige checks novos. Nao mudar protecao ou alegar CI do SHA novo.
- Cinco registros Qlik deste PR movidos ao final dos tres documentos com
  hashes antes/depois iguais; conteudo restante preserva main, normalizando
  somente linhas em branco. Evita conflito de prefixo, nao dispensa nova CI.
  Ops/qlik e identico a cf2b1c1; nenhuma mudanca propria de interface.
- Windows lint/tipos/build exit0; pnpm test com1worker passou3337/1248/703,
  skips89/19/14. Timeouts anteriores nao reproduzidos, sem reduzir cobertura.
  Execucao local atravessou merge; CI cf2b1c1 atesta o SHA imutavel anterior.
- Metadata03:07:20.107Z/recarga02:14:57.356Z: pins de cubos, masters e aliases
  selecionados iguais aos revisados, sem ler fatos. Health03:55:48.744Z200/
  ok/b937. Coleta real corrigida e publicacao ainda pendentes. Fontes:
  GitHub/protecao/checks, Git/digests, recibos locais e projecao privada.

## 2026-10-16: Abertura da aba Previsao em Gestao

- Fonte: Git local e `git fetch origin`, consulta em 2026-10-17T02:21Z (16/10 em America/Sao_Paulo). Git comum confirmado; checkout inicialmente detached e limpo, SHA f10880465f80c8f1164a6db9aaea43907f14fdd1 igual a origin/main, merge do PR #243. Documentos de contexto/ferramentas lidos nessa base.
- GET observacional https://crm.descomplicapro.com.br/api/health: HTTP 200, status ok, version 34517ba2b2e4022f52bec29260e071b9cf124cca. Versao publicada difere da base local/main; health nao prova publicacao desta demanda.
- gh ausente no PATH e no caminho padrao. Conector GitHub consultado separadamente para metadados/CI; limites dos resultados devem ser preservados. Nenhum dado privado consultado.
- Escopo solicitado: nova pagina Previsao em Gestao, tabela manual com Nome do corretor, Previsao e Realizado, inclusao/exclusao de linhas/colunas e Salvar. Prints sao referencias visuais. Novas migrations remotas permanecem condicionadas a autorizacao especifica.

- Complemento da abertura: API publica GitHub confirmou main e PR #243 integrado; CI main 38988235307 concluida com success no SHA f10880465f80c8f1164a6db9aaea43907f14fdd1 (https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38988235307). O conector de workflow runs retorna apenas eventos pull_request e nao prova CI de main. Usuario autorizou explicitamente a migration aditiva da Previsao e permissao apos validacao; autorizacao limitada a esta entrega.

## 2026-10-16: Implementação e validação da Previsão

- Branch `codex/gestao-previsao`, base f1088046. Página e GET/PUT usam permissão
  própria `crm.management.forecast.view`; escrita exige também settings.manage.
  Tabela global manual, com equipe, colunas e linhas editáveis, sem cálculo ou
  integração comercial. As referências visuais não fornecem registros iniciais.
- Salvamento usa RPC com revisão otimista. RLS forçada e ausência de ACL direta
  protegem a tabela; usuário, conta ativa, MFA e página ativa são verificados no
  banco. Auditoria contém somente revisão/quantidades. Conflito e falha preservam
  o rascunho. Limites agregados de 2 MB complementam os limites de células.
- Build e tipos aprovados em Node 24.19.0/pnpm 11.20.0 Windows. Testes focais:
  backend 51, acesso administrativo 65 e contratos/recursos 33 aprovados.
  Navegador sintético: 5 aprovados, nove capturas em três temas e larguras
  1440/390/320, axe sem violações; inspeção das capturas desktop/escuro e
  celular/médio realizada. Isto não substitui uma sessão real de produção.
- Primeira suite global Windows: 3765 passaram, 17 falharam, 94 skips. Falhas de
  inventários/contagens foram corrigidas e retestadas; os demais timeouts e teste
  de concorrência requerem repetição com menor paralelismo e confirmação na CI
  Linux. Testes de banco locais não executados: Docker indisponível. Novo pgTAP
  tem 61 assertions; inventário agregado passa a 1971 em 34 arquivos.
- Projeto de produção confirmado pelo hostname do runtime e MCP:
  hnncxuerlcsaahdxoswb. Conferência prévia somente leitura encontrou 27 páginas,
  38 permissões, 146 vínculos de papel, 6 overrides e ausência da nova tabela,
  RPCs, permissão e página. Backup privado de catálogo, ausência dos objetos,
  histórico e hashes de preservação retido na VPS, modo 0600, SHA-256
  45ec1a83f82b5c5377fdce656d3047a1d4c619bfa5e08a47b7dd678075f664ef.
  Nenhuma migration aplicada nesta etapa. Reavaliar baseline imediatamente antes
  da aplicação; publicar somente com CI completa e coordenador de release.

## 2026-10-17: Retomada, CI e publicacao pendente da Previsao

- Fonte: PR #247 e CI https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38996000303 no SHA 58ff617ea8f775ea5ecc396c61ffcd883c8340a0. Tentativas 1 e 2 aprovaram formatacao, lint, tipos e pnpm test completo Linux (incluindo suites operacionais e release); pararam na fonte externa https://prefeitura.sp.gov.br/fazenda/w/servicos/itbi/2517 com HTTP 403. Segunda falha observada em 2026-10-17T12:02:45Z. Gate preservado; banco, restore e imagem nao executaram nessas tentativas.
- Fechamento local da base anterior: Vitest 3782 aprovados/94 skips, navegador sintetico 5 aprovados, formatacao/lint/tipos/build e Gitleaks aprovados. Suites Node Windows: operacionais 1386 aprovados/15 falhas/19 skips; release 711 aprovados/12 falhas/14 skips, com contratos POSIX e tempos do host, sem modificar assercoes para passar. Linux da CI aprovou 1419 operacionais (1 skip) e737 release. A validacao financeira externa passou localmente, inclusive em nova consulta desta retomada; isso nao substitui o gate da CI.
- Estado externo mudou durante a espera: fetch confirmou origin/main 61c9a6a8fe2813831bc167d91e6d7e0ab9b3bab4, PR #248 integrado e CI main39007579400 verde. Health observacional em 2026-10-17T12:03:29Z retornou HTTP200/ok/eff7f729c4386af14af16902fe4c761027df597a. Esta versao e de outra entrega; Previsao segue sem publicacao, merge ou migration remota.
- Integracao da main atual em andamento para manter o PR revisavel, preservando Qlik/House/Parcerias e suas referencias. Novo catalogo e restore devem somar as assertions recebidas da main e os61 testes da Previsao. Backup inicial e antigo e deve ser revalidado/refeito antes de qualquer aplicacao remota. A autorizacao especifica da migration permanece limitada a Previsao e seu catalogo, apos gates; nao inclui aplicar migrations Qlik de outra entrega.
- Limite de publicacao: o403 externo impede promocao enquanto persistir; nao alterar fonte financeira, remover gate ou declarar banco/restauracao aprovados. Reavaliar em CI completa do candidato integrado. Nenhum dado de producao foi gravado por esta tarefa.

## 2026-10-17: Validacao integrada da Previsao e correcao da fixture

- CI39031197492 no candidato8fe43e72 aprovou validate completo, inclusive fonte
  externa, lint, tipos, testes Linux, auditoria e build. Os cinco testes de
  navegador da Previsao passaram. Local integrado: Vitest3787 aprovados/94 skips,
  lint/tipos/build aprovados. O403 anterior deixou de ocorrer nesta execucao.
- Restore isolado interrompeu o pgTAP apos46 de61 assertions da Previsao.
  A fixture mantinha claim.sub do corretor depois de RESET ROLE e em seguida
  preparava override de Admin, atingindo o guard de contas administrativas.
  Corrigida somente a identidade da preparacao privilegiada;61 assertions e
  controles de runtime preservados. Teste focal release-candidate:21 aprovados.
  Confirmacao SQL depende da nova CI; Docker local permanece indisponivel.
- PR #247 ainda sem merge/publicacao; migrations remotas nao aplicadas. A
  autorizacao recebida permite aplicar as duas migrations desta entrega apos
  aprovacao integral dos gates e nova conferencia da baseline de producao.

## 2026-10-17: Banco e restore aprovados; matriz autenticada da Previsao

- CI39032248476, tentativa2, candidato f16b558f (merge sintetico794ded8a):
  validate aprovado; restore isolado aprovado em2026-10-17T12:37Z. Fonte ITBI
  retornou403 na primeira tentativa e respondeu normalmente na segunda.
- Ensaio de64 migrations e34 arquivos pgTAP:1972 assertions aprovadas na
  origem e no destino, incluindo61 da Previsao. Lint/advisors de seguranca e
  performance aprovados; backup/restauracao logica e fingerprints de ACL/owner
  preservados. Ambiente sintetico, sem restore remoto representativo.
- Release-gates aprovou banco e build; parou em local-rls-api.mjs com
  Application-page visibility does not match role permissions. Matriz de
  paginas esperadas em revisao para incluir a nova permissao sem relaxar guards.
  PR continua sem merge e producao sem mutacao desta tarefa.
- Retomada apos pausa do host: em2026-10-17T13:34Z, fetch confirmou main ainda
  61c9a6a8 e CI39007579400 success. GET publico api/health retornou ok/eff7f729.
  Fontes: origin, GitHub via gh e endpoint publico; versao da Previsao continua
  somente no PR. Matrizes QA corrigidas sem alterar acesso de runtime.
- Em13:38Z main avancou para ca6c33cf, mergePR245/dashboard; CI39037162463 em
  andamento. Integracao preservou dashboard e Previsao; conflitos restritos aos
  prefixos de WORKLOG/CHANGELOG, conservando ambos os registros. Matriz RLS e
  menu corrigidos passaram42 testes focais. Nova CI integrada necessaria.

## 2026-10-17: Previsao integrada e CI final aprovada

- PR247 integrado em47f5d449ccc0ac5f2f4bf8c948a5736979f2daea apos CI39037358734
  aprovar validate, restore e release-gates, incluindo navegador autenticado e
  matriz visual. CI main39040316212 aprovou os quatro jobs, inclusive imagem.
- Retomada em2026-10-17T19:11Z apos pausa do host: fetch confirmou main ainda
  47f5d449; GitHub confirmou CI concluida/success. GET observacional api/health
  HTTP200/ok/eff7f729c4386af14af16902fe4c761027df597a. A entrega esta integrada,
  mas a versao publicada ainda e anterior. Migration ainda nao aplicada.
- Preflight MCP14:32Z: somente nova pagina/permissao e dois grants Master/Admin;
  conteudo e acesso das27 paginas existentes preservados. Trigger renova apenas
  updated_at no snapshot. Backup privado14:01Z com checksum
  522f2c436a99093fe5164fee474d4bdee6a0037c4e8f9857da528865de0b9a81.
  Revalidar hashes e ausencia dos objetos antes da aplicacao autorizada.
- Nova retomada em2026-10-18T00:06Z (17/10 America/Sao_Paulo): main840f0908
  recebeu PR250, somente timeout da CI e documentos, sem mudanca de runtime.
  CI39061398333 concluida/success; candidato atualizado para esse SHA exato.
  Ledger ainda eff7f729/deployment6a8e7f60-2847-4e32-8be3-9c6e1d23ed39,
  deployedAt2026-10-17T04:49:20.557Z, sem pendencia. Primeira transferencia
  perdeu conexao SSH, mas arquivo47f5d449 chegou integro; nenhum deploy ocorreu.
  Artefato840f0908 baixado separadamente e checksum aprovado; prova OCI em curso.

## 2026-10-17: Previsao publicada e verificada

- Publicacao em2026-10-18T00:10:01.373Z (17/10,21:10 America/Sao_Paulo),
  SHA840f0908, CI39061398333 integralmente aprovada, deployment
  fc04ef76-1350-4298-8692-aed95b1bb2f8. Coordenador unico confirmou deploy e
  ausencia de pendencia; imagem imutavel com prova OCI e dois perfis aprovada.
- Migrations MCP autorizadas: crm_forecasts/20261018000941 e
  sync_page_catalog_forecast/20261018001010. Storage antes da promocao,
  catalogo depois do runtime compativel. RLS forcada/ACL sem acesso direto,
  tabela sem fixtures. Pagina ativa com grants somente Master/Admin.
- Backup final00:09Z preservou8 overrides, incluindo dois criados externamente
  durante a espera. Conferencia posterior confirmou hashes antigos de permissoes,
  grants e overrides iguais;27 paginas antigas preservadas salvo updated_at
  tecnico. Totais28 paginas/39 permissoes/148 grants/8 overrides.
- Health publico apos catalogo200/ok/840f0908; API anonima401 e pagina307 para
  login. Edicao validada na CI/sintetico, sem gravacao com conta real de producao.
  Evidencias e limites em docs/audits/previsao-2026-10-17.md. Registro documental
  posterior nao exige reinicio do aplicativo nem reaplicacao das migrations.

## 2026-10-17: Finalizacao do PR documental251

- Retomada em2026-10-18T01:05Z (17/10 America/Sao_Paulo). GitHub confirmou
  CI39081939465 aprovada no head d703d412, mas PR251 conflitante apos PR252
  documental integrar main36f3c317. CI main39084939569 ainda em andamento.
- GET publico api/health200/ok/840f0908, mesma versao publicada. Escopo desta
  retomada: preservar ambos os registros, repetir CI no head integrado e fazer
  merge somente apos aprovacao. Sem nova publicacao de runtime ou migration.
- Encerramento: CI39085264715 aprovada no head2e1c046a (validate, restore e
  release-gates; imagem dispensada em PR). Merge normal confirmado pelo GitHub
  em2026-10-18T01:55:20Z, commitfe1b343eeb1d5534f47779738b9fdbaf7d776d2f.
  Conflitos documentais resolvidos preservando os dois registros; nenhum gate
  dispensado. Health posterior200/ok/840f0908. PR251 concluido, sem novo deploy.

## 2026-10-18: abertura do ajuste visual da Previsão

- Consulta às 02:55 UTC: main remoto fe1b343e, checkout 1b75d003 com registro documental posterior. GitHub Actions 39088213591 de main falhou; causa ainda não inspecionada. CI anterior 39084939569 aprovada em 36f3c317.
- GET observacional https://crm.descomplicapro.com.br/api/health: HTTP 200, status ok, versão 840f0908e9c3d5c06f5a4dbb4cdf161404b31753. A versão publicada difere de main por registros documentais.
- Escopo autorizado: aplicar padrão visual do dashboard à Previsão, mantendo tabela editável e Salvar. Nenhuma alteração de banco prevista. Fonte: Git local/remoto, GitHub via gh e health público.

## 2026-10-18: Previsão alinhada ao dashboard — integração

- PR253 integrou em f8ad7bbfda9f22190018593266b1fa1769a1702f após CI39092735520 aprovar validate, isolated-restore e release-gates no head2e37ad71. Imagem é gerada apenas no push/main.
- Reutilizados canvas e tokens de /app, cabeçalho compacto, superfícies e Salvar destacado. Tabela padrão sem rolagem lateral em1440/390/320 px; colunas extras usam rolagem interna. Nenhuma alteração de API, permissões ou banco.
- Local: lint, typecheck e build aprovados; cinco testes de navegador aprovados, três temas e axe sem violações. Suíte geral teve três timeouts; repetição aprovou3803 testes e restou um timeout do Obsidian, aprovado isoladamente em13,56s. CI Linux aprovou a suíte completa; nenhum timeout ou asserção foi relaxado.
- Conferência04:01 UTC: main f8ad7bbf, CI39095660275 iniciada. Health público HTTP200/ok/840f0908. Implementado e integrado; publicação ainda pendente da CI exata de main e prova da imagem.

### Publicação confirmada

- CI39095660275: push/main f8ad7bbf, quatro jobs aprovados. PR253 integrado e runtime publicado em2026-10-18T04:51:47.145Z pelo coordenador release:production, retorno0, deployment c4d5dc22-ad9d-4fa4-a5aa-d20184a5339c, sem pendência.
- Baseline conferida às04:51:31Z: deployment fc04ef76-1350-4298-8692-aed95b1bb2f8, SHA840f0908, deployedAt2026-10-18T00:10:01.373Z. Coordenador executou consulta final, travas, backup e CAS no minuto da troca.
- Artefato: checksum ad9134c2a60f31612d0d4f2770beeb4894377e48304a6fb03aed7bb86c4c131f; config CI6c9d9680 e manifesto local cdd72fbb comprovados pela cadeia OCI,11 camadas, RootFS, label e plataforma linux/amd64. image:prove aprovou dois perfis usando a mesma imagem, sem imprimir segredos.
- Pós-publicação04:51:55Z: health público HTTP200/ok/f8ad7bbf; container healthy com imagem cdd72fbb. GET anônimo da página307 e API401. Nenhuma migration ou mutação de dados de negócio nesta entrega.
- Limites: interface validada com fixtures sintéticas locais e na CI; não houve sessão autenticada de produção nesta verificação nem gravação de fixture no CRM real. pnpm test local parou no Vitest por timeout; as etapas Node subsequentes foram comprovadas pela CI Linux. O teste restante de Obsidian passou isoladamente, sem alterar limites ou asserções.
- Fontes: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/253, Actions39092735520/39095660275, https://crm.descomplicapro.com.br/api/health, coordenador e provas locais. Reavaliar os timeouts locais apenas se reaparecerem isoladamente ou na CI.

## 2026-10-18 — abertura: Previsão por empreendimento

Consulta em 2026-10-18T14:16:41Z: GitHub main d919751a51772dd0c57a582b9581e61412642ced, CI 39100233037 aprovada; PR 253 integrado em f8ad7bbf. Health público HTTP 200, status ok, version d919751a. Branch codex/previsao-empreendimentos incorpora origin/main e preserva os registros locais de publicação. Fontes: GitHub via gh, origin/main e https://crm.descomplicapro.com.br/api/health. Nova demanda: sete grupos editáveis Previsão/Realizado, reordenação, números e totais calculados. Nenhuma alteração remota de dados realizada nesta abertura.

### Validação da implementação por empreendimento

Branch codex/previsao-empreendimentos: lint, typecheck e build aprovados; 45 testes de modelo e 46 de API aprovados. Navegador sintético: sete cenários funcionais aprovados, arraste real aprovado separadamente, matriz Claro/Médio/Escuro em 1440/390/320 sem overflow horizontal e axe sem violações. Capturas em test-results/forecast-preview (não versionadas). Suíte global inicial: 3.841 aprovados e sete falhas; quatro eram inventários atualizados nesta entrega e três eram timeouts locais. Após ajuste, os quatro arquivos de regressão passaram 75 testes; repetição global em andamento. Sem alterações de tolerância ou skips para ocultar falhas.

Migration 20261018142142_crm_forecast_groups.sql preparada, não aplicada remotamente. Projeto de produção hnncxuerlcsaahdxoswb confirmado via URL do runtime e MCP; RPC anterior hash MD5 9bb11666b25feae744f2ab24d0405f24, backup de definição sem dados preparado fora do Git. CI pgTAP/restore e autorização específica continuam pendentes. Fonte: código, logs locais e consultas observacionais MCP. Limite: capturas sintéticas não representam escrita ou sessão autenticada na produção.

### CI inicial e correção da fixture pgTAP

CI 39136448707 no SHA cde0b99d: validate aprovado (inclui suíte completa Linux); isolated-restore falhou porque o novo teste usava operador JSON junto de subtração sem parênteses. A expressão avaliava columns como inteiro e causava 22P02 antes da segunda asserção. SELECTs somente de constantes confirmaram a causa e a correção. Fixture corrigida, plano36 preservado, 67 testes focados aprovados. Nova CI obrigatória antes de merge/aplicação. Na repetição local, Vitest passou 3.848 testes; etapa Node teve 1.593 aprovados, três falhas de permissões/caminhos POSIX em Meta Ads e 19 skips existentes. Não foram alterados skips, permissões ou testes para mascarar essas limitações; validate Linux aprovou o conjunto.

### Revisão final do legado

Cenário sintético com cabeçalho antigo personalizado confirmou necessidade de usar o nome acessível fixo ao focar novas linhas. Ajuste de duas chamadas e teste de inserção/exclusão aprovados em Chromium (15,10 s). A execução 39137287690 passou testes, mas a fonte documental Prefeitura SP retornou HTTP 403; repetição solicitada sem alterar ou dispensar o gate externo. Nenhuma aplicação remota ou merge realizado.

### Lint SQL após a correção da fixture

CI 39137907096: validate aprovado incluindo a fonte documental que retornara403. A restauração avançou até o lint de banco e bloqueou por shadowed_variables/unused variable v_index na migration nova. FOR inteiro declara o índice implicitamente; removida a declaração externa redundante. Não houve mudança de regra, bypass de lint ou mutação remota. Nova CI necessária para comprovar pgTAP, lint e restore completos.

### Integração e autorização da migration por empreendimento

CI39138652862 no head ebd7ad414312895a778eb8d3f4b62c17e80c5d07 concluiu aprovada: validate, release-gates e isolated-restore; imagem é gerada apenas em push/main. Restore isolado comprovou65 migrations,35 arquivos pgTAP e2.008 testes na origem e no banco restaurado, lint/advisors aprovados e fingerprint correspondente. São dados sintéticos, não restauração de produção.

Usuário autorizou expressamente aplicar apenas20261018142142_crm_forecast_groups.sql depois da CI completa e restaurar a função anterior se a publicação falhar. Backup privado da definição anterior tem SHA2563d82ce724bf05b02c2ea0ba663e847b761c78619faae39528fb905b441d35c11; nenhuma previsão de cliente integra esse backup. A autorização não abrange outras migrations ou mutações de dados.

PR256 integrado em2026-10-18T15:51:32Z no SHA6b6e88fb33964e2ced5c2a07ecbf308e5f1875c5, sem bypass. CI push/main39142373485 iniciada. Consulta preliminar do coordenador: produção d919751a, deployment d2fc040b-ad09-4442-8fd3-8b1317463b65, publicada em2026-10-18T06:35:30.334Z, sem pendência. Migration e publicação ainda não realizadas; nova observação no minuto da promoção é obrigatória. Fontes: GitHub PR256/Actions, retorno do coordenador e autorização direta nesta conversa.

Retomada após mudança externa: main avançou para eeb42a4522ec7767f16f19f47f1792a650c09d49 (PR257, vagas no Associativo). Diff restrito a simulador/testes/documentação; Previsão e sua migration não mudaram. CI39165128618 push/main concluiu os quatro jobs aprovados em2026-10-18T21:38:38Z. Health observado HTTP200/ok/d919751a e ledger anterior sem pendência. Candidato atualizado para main atual; imagem6b6e88fb carregada mas nunca promovida. Autorização específica da migration segue válida para o mesmo SQL. Fontes: origin/main, GitHub Actions e coordenador.

### Previsão por empreendimento publicada

- Migration local `20261018142142_crm_forecast_groups.sql` aplicada via MCP ao projeto confirmado `hnncxuerlcsaahdxoswb`, sob autorização direta para aplicação e recuperação. Histórico remoto: `20261018232900 / crm_forecast_groups`. Somente a definição da RPC foi substituída; nenhuma previsão existente foi reescrita.
- Antes: save MD5 `9bb11666b25feae744f2ab24d0405f24`; depois: `752c15eebf5553125667fbe6295a0744`. RPC get manteve MD5 `e088aa7c1c66909618b0e21c66c1c705`. Owner postgres, security definer, ACL e configurações preservados. Backup privado anterior conferido; recuperação não foi necessária.
- CI final `39165128618`, push/main `eeb42a4522ec7767f16f19f47f1792a650c09d49`, quatro jobs aprovados. Artefato SHA256 `8d4d8d25d24cc2500180ec1e0a7cddcbce8b4a5043310b602c459d22f6e21bec`; config CI `6e6513a4f3d68594a81fbd0a38f9e431655f902f80386401455a5784b3f763ec`; manifesto local `a11cbf0a37dfca32954eb9bdbc259ab47fc379b6ec221e5a6ef51e5d97656348`. Cadeia OCI, 11 camadas, RootFS e linux/amd64 conferidos. image:prove aprovou os dois perfis na mesma imagem, sem segredos em saída.
- Coordenador `release:production` publicou em `2026-10-18T23:29:19.335Z` (20:29:19 America/Sao_Paulo), deployment `4ecf1a6f-18a9-4ab7-9dfc-31bb39ab3f5b`, sem pendência. Baseline: deployment `d2fc040b-ad09-4442-8fd3-8b1317463b65`, SHA d919751a, publicação real `2026-10-18T06:35:30.334Z`. Consulta ao vivo, CI/main, travas e CAS foram executados pelo coordenador no minuto da troca.
- Pós-publicação às 23:29:27Z: health público HTTP200/ok/eeb42a45; container healthy na imagem comprovada; acesso anônimo à página307 e API401. Testes funcionais autenticados usam fixtures sintéticas locais/CI; não foi feita gravação de teste em produção. Capturas desktop/celular são sintéticas, não evidência de uma sessão autenticada produtiva.
- Fontes: PR256, CI39138652862/39142373485/39165128618, MCP Supabase, coordenador e https://crm.descomplicapro.com.br/api/health. Implementado, CI aprovada, integrado e publicado são estados confirmados separadamente. Alteração concorrente PR257 preservada no candidato atual.

## 2026-10-18: Calendário e Plano de ação da Previsão

- Branch `codex/previsao-calendario-plano`, derivada de main `8eb023c1`. Abertura
  observacional às 00:39Z: health HTTP 200/ok em `eeb42a45`; GitHub indicava a CI
  39180111973 de main em andamento. Fontes: origin, GitHub via `gh` e health
  público. A divergência era externa à página e foi preservada pelo merge.
- Interface: botão Calendário e diálogo mensal destacam e contam exclusivamente
  quinta a domingo como dias validados. Outubro de 2026 tem 19; no dia 18 são 12
  passados e 7 restantes. Breadcrumb, subtítulo e instruções visíveis foram
  removidos. A tabela usa rolagem horizontal, corretor compacto, títulos em duas
  linhas e Plano de ação textual após Total.
- Persistência: documentos anteriores são adaptados apenas em memória com
  `action_plan` vazio; salvar persiste a nova coluna. A migration
  `20261019004204_forecast_action_plan.sql` substitui somente a RPC de gravação,
  sem reescrita de dados ou mudança de ACL/RLS. Ela ainda não foi aplicada e a
  autorização anterior não a abrange. Imagem nova e RPC nova devem ser promovidas
  juntas; a recuperação restaura primeiro a RPC anterior.
- Evidência local: lint, typecheck e build aprovados; Vitest 3.873 aprovados e 99 skips;
  API 47/47; navegador 9/9 em 1440/390/320, três temas e axe, com capturas
  sintéticas inspecionadas. A etapa Node teve 1.593 aprovações, 19 skips e três
  falhas POSIX conhecidas no Windows. `test:release` reproduziu 11 falhas da
  fixture Meta Ads por arquivo sintético ausente, inclusive isoladamente; nenhum
  arquivo dessa área foi alterado nesta entrega e nenhuma asserção foi relaxada.
  pgTAP da restauração isolada e CI Linux permanecem pendentes antes do merge.
- PR259, CI inicial `39184161292`: validate aprovado e restauração isolada
  aprovada. Release-gates parou no teste do oitavo grupo porque a asserção fixava
  um título em vez de ler o valor realmente criado. A verificação foi tornada
  independente do título e mantém as mesmas exigências de visibilidade, rolagem
  e reordenação; navegador focal 9/9 aprovado. Nova CI exigida, sem bypass.

## 2026-10-18: Meta vazia editável

- A referência pública confirma “Aplicar metas” no cabeçalho e controles numéricos editáveis na coluna Configuração. O preview local associava incorretamente `empty` a `canManageDraft=false`, gerando a imagem sem botão e com campos desabilitados.
- Fixture corrigida: estado vazio e autorização são independentes. Perfil autorizado vazio vê a ação, edita a meta mensal e mantém projeções sem valores inventados; `readonly` preserva o bloqueio explícito. Preview Chromium: 30 telas aprovadas, desktop/mobile, três temas, axe e overflow.
- Limite: a ação revisa e salva somente rascunho inativo; não ativa política comercial. A permissão Master-only existente foi preservada. Fonte: `https://descomplicapro.com.br/configuracoes/metas`, código e execução local em 18/10/2026.
- Validação local: lint, tipos e build aprovados em Node 24.19/pnpm 11.20; preview 30 telas e Vitest 3.861 aprovados. A etapa Node aprovou 1.593 e reteve três falhas Windows de Meta Ads já conhecidas, sem relação com o delta; integração exige CI Linux completa.

## 2026-10-19: refinamento do calendário e da grade da Previsão

- Base conferida às `2026-10-19T11:58:38Z`: `origin/main` em
  `32c7cbdff5147890d8e9a49e58ea31ed2c2965e5`, CI push/main `39211218104`
  aprovada. Health público HTTP 200/ok ainda em
  `3002d578a2db346883e661c4ba568faa4ff99c26`; a diferença confirma que a
  interface do PR259 não estava publicada. Fontes: Git/GitHub e
  `https://crm.descomplicapro.com.br/api/health`.
- O calendário foi reduzido em 30%, permanece aberto durante interações e conta
  somente sexta, sábado e domingo. Os nove empreendimentos conhecidos recebem
  as quebras solicitadas, largura uniforme e linhas de 22 px. Células recebem
  realce no hover e a rolagem horizontal preserva Total e Plano de ação.
- A falha de salvamento é incompatibilidade confirmada entre o documento com
  `action_plan` e a RPC produtiva anterior. O código não remove o texto para
  simular sucesso. A migration `20261019004204_crm_forecast_action_plan.sql`
  continua não aplicada e exige autorização específica; imagem e RPC precisam
  ser promovidas no mesmo ciclo protegido, com restauração da função anterior
  se a publicação falhar.
- Local: lint, typecheck, build, 103 testes de modelo/API/componentes, 49 focais
  e navegador 9/9 aprovados. Vitest completo aprovou 3.876 e ignorou 102; dois
  timeouts do Obsidian passaram isoladamente 22/22. Etapas Node/release
  reproduziram falhas e retenção de processo em cenários POSIX de Meta Ads no
  Windows, fora do delta. Nenhuma tolerância foi mudada; CI Linux completa é o
  critério de integração.

## 2026-10-19: abertura dos gráficos de agendamentos

Consulta às 00:10 BRT: checkout limpo e destacado em 59f1ee4799652694e2d2fd92aa12451675b7b9c1, origin/main no mesmo SHA após fetch. Health público https://crm.descomplicapro.com.br/api/health HTTP200/ok/eeb42a4522ec7767f16f19f47f1792a650c09d49; versão publicada difere do checkout. GitHub via conector retornou statuses vazio para o SHA local, sem comprovar CI; busca de PR por agendamentos retornou apenas PR71 histórico. gh ausente no PATH. Estado integrado e publicado ainda exige confronto antes da publicação. Demanda: gráficos diários, semanais e mensais e rankings de gerente, responsável, loja e empreendimento; manter validação de colunas da exportação Salesforce. Nenhuma mutação remota nesta abertura.

Conferência complementar da abertura: API pública do GitHub confirmou CI39189857296 push/main concluída com sucesso em59f1ee47, incluindo validate, release-gates, isolated-restore e promotable-image. Versão publicada eeb42a45 corresponde ao merge do PR257, anterior ao main consultado; essa diferença não valida a nova demanda. O relatório Salesforce aberto já continha Nome do empreendimento; o cabeçalho identificou Activity.Nome_do_empreendimento\_\_c. Conferidos apenas metadados para a implementação, sem gravar registros privados.

## 2026-10-19: implementação dos gráficos de agendamentos

Branch codex/agendamentos-graficos, PR261, implementação8307e637. Sete gráficos, três colunas responsivas e rankings integrais; mês independente do Ano do gráfico mensal, semanas segunda-domingo1ª–6ª com valores somente quando existentes. Removidos breadcrumb, Posição no funil e controles legados somente desta página. Loja e empreendimento foram separados no contrato analítico v2; v1 continua legível com empreendimento indisponível. A nova RPC filtra somente fatos de agendamento e reindexa dicionários; permissões existentes de etapa, visão, sessão/MFA e ranking preservadas. Coluna Activity.Nome_do_empreendimento\_\_c validada nos metadados de cada coleta; nenhuma alteração da definição salva foi necessária.

Validação local Node24.19/pnpm11.20: lint e tipos aprovados; build aprovado. Vitest global3.883 aprovados/101 skips existentes. Etapa Node1.595 aprovados/19 skips existentes e3 falhas Windows de Meta Ads (arquivo privado e diretório absoluto/POSIX), sem redução dos gates ou relação com a mudança. Novos testes focados e contrato aprovados; inventário67 migrations e36 arquivos pgTAP/2.036 asserções. db:test e db lint locais indisponíveis por ECONNREFUSED127.0.0.1:54322; execução SQL depende da CI Linux. A primeira rodada teve falhas de inventário e fixture de tupla atualizadas; repetição Vitest passou. Não houve alteração de timeouts ou skips para ocultar falhas.

Preview sintético com CSS do build Next:12 telas (três temas em1440/1024/390/320), dois cenários de31dias com1.000.000 por barra e um zoom de layout720CSSpx/2dppx. Todos aprovados, axe0, sem overflow horizontal, scroll interno ou colisões. Conferidos alturas das31barras proporcionais,24 responsáveis completos, ordenação e desempate, filtros independentes, legado v1, indisponível e restrição por perfil. Evidências não versionadas: test-results/appointments-preview/result.json e screenshots. Validação isolada do componente não equivale ao shell autenticado nem à carga real da produção.

CI39194511433 iniciada no head8307e637; resultado completo ainda pendente. Migrations20261019031700/20261019031715 preparadas e não aplicadas remotamente. Publicação, atualização do coletor e reconciliação do primeiro snapshot v2 dependem de autorização específica das migrations e dos gates completos. N8n não foi alterado. Rollback exige manter SQL/leitores compatíveis v1/v2; nunca reetiquetar v2 como v1. Fontes: PR261, logs locais, metadados da coluna no relatório Salesforce, código e runbook appointments-charts.md.

### CI inicial e ajuste da fixture de permissões

CI39194672592 em341edd46 aprovou validate Linux (incluindo testes e build), mas isolated-restore encontrou appointments_analysis com26 de28 asserções executadas antes de uma exceção e grants_matrix falhou na lista exata de funções do navegador. A fixture tentava criar um override na própria conta Master depois de definir auth.uid; o trigger existente proíbe essa mutação. Ajustado somente o preparo privilegiado da fixture para limpar a identidade antes das mutações de teste e restaurá-la antes de cada leitura autenticada. Acrescentada a nova RPC à lista exata auditada. Plan28, proteções, migrations e regras de runtime preservados. Nova CI obrigatória; nenhum SQL remoto aplicado.

A execução separada de test:release local registrou712 aprovados/14 skips existentes e11 falhas Windows nos testes Meta Ads de filesystem/caminhos POSIX. Esses arquivos não foram alterados por esta entrega; validate Linux da CI39194672592 aprovou a suíte completa. Não relaxar asserções; reavaliar se houver falha no Linux ou em cenário isolado pertinente.

### Lint SQL e preflight observacional

CI39195598335 em5d285bb8 aprovou validate Linux e passou o pgTAP da origem; a restauração avançou ao lint e bloqueou porque read_crm_appointments_analysis, STABLE, chamava a auxiliar de projeção com volatilidade padrão VOLATILE. A auxiliar só projeta o JSON recebido e usa funções JSON estáveis; marcada STABLE. Migrations ainda não aplicadas remotamente. Nova CI necessária, sem relaxar lint ou asserções.

Preflight observacional às00:41 BRT confirmou runtime e health59f1ee47 (HTTP200/ok), atualizado por outra publicação desde a abertura. Supabase host público do runtime coincide com projeto hnncxuerlcsaahdxoswb; três slices analíticas seguem versão1 e a RPC nova está ausente. Hashes MD5 de definição atuais: ingest_crm_salesforce_snapshot ae1ef7824854a5f98e8a2bc6f7d890dc; private.validate_crm_dashboard_analysis9f99dd850e2c63d654442d142739a790; read_crm_dashboard_analysis bcf49ac4c17098b9c2271f043de27bfa. Só metadados foram consultados, sem registros de clientes. Conferir novamente identidade, definições/histórico e backup antes de qualquer aplicação autorizada. Fonte: SSH observacional selecionando somente host público/SHA, MCP Supabase e health público; isso não substitui CAS/frescor do coordenador no minuto do deploy.

### Encerramento técnico e referências visuais de Agendamentos

CI39196528870 no head78707ecc (merge de teste c7251e03) aprovou validate, isolated-restore, pgTAP2.036 asserções, lint SQL e E2E. Release-gates falhou somente nas11 imagens de Agendamentos por dimensions_changed: larguras iguais e alturas reduzidas pela remoção solicitada dos blocos. Rotas154/154, temas88/88, acessibilidade242/242, teclado e zoom passaram;231 imagens ficaram aprovadas. Coordenador e QA inspecionaram desktop1440 e mobile320; adotadas somente11 imagens do artefato12162399175, com SHA/bytes conferidos, proveniência individual, comparação anterior e origem verify/falha/dirty preservadas. Não houve execução fictícia de update-baseline, afrouxamento de limiar ou alteração das231 demais imagens. Teste local reference-parity:15 aprovados/1 opt-in ACCOUNT_MENU_BROWSER ignorado. Nova CI no commit da adoção segue obrigatória.

Limite: a fixture autenticada geral não contém fatos analíticos e as imagens mostram indisponibilidade; não comprova os gráficos preenchidos nem a leitura RPC com carga real. Os sete gráficos têm evidência sintética separada com CSS de produção; pgTAP cobre a RPC e permissões. Reavaliar na implantação autorizada com primeiro snapshot v2 e conciliação agregada, sem dados privados. Fonte: artefato de CI e test-results/appointments-preview/result.json.

Conferência final em2026-10-19T04:32:33Z: fetch atualizou origin/main para2354a8d2 (PR259, calendário/plano de ação), enquanto esta branch ainda mantinha base59f1ee47. Consulta GitHub de workflow_runs para2354a8d2 retornou lista vazia, sem comprovar CI. Health público HTTP200/status ok/version59f1ee4799652694e2d2fd92aa12451675b7b9c1. Estados local, integrado e publicado distintos. Nenhuma migration remota, atualização operacional do coletor, merge do PR261 ou deploy desta demanda executados. Autorização específica das duas migrations foi solicitada e ainda não respondida; aprovação de entrega da pergunta pela ferramenta não é consentimento. Após resposta, repetir fontes/gates pertinentes e frescor/CAS no minuto da publicação. Publicação bloqueada até gates verdes e autorização das migrations; sincronizar conhecimento no encerramento.

Na sequência, integrado origin/main2354a8d2 na branch de Agendamentos para resolver conflitos de documentação e inventários compartilhados. Preservadas ambas as entregas e as três migrations; inventário combinado68 migrations,36 arquivos pgTAP/2.042 asserções. Perfil de dados validou29/29 testes focados de inventário/homologação, sem stage/commit nem mutação remota. A CI do novo commit de merge continua necessária; o sucesso anterior em78707ecc não valida automaticamente o novo estado.

Repetição local após integração, Node24.19/pnpm11.20: lint e typecheck aprovados; build aprovado; Vitest3.895 aprovados/102 skips existentes. Etapa operacional1.595 aprovados/19 skips e as mesmas três falhas Windows em Meta Ads (arquivo privado/permissão/caminho POSIX); pnpm test terminou1 e, pelo encadeamento, não executou test:release nessa repetição. Testes focados de inventário/homologação29/29 aprovados. Um script temporário local de adoção causou inicialmente erro de estilo require no lint; removido após uso e lint repetido com sucesso. Não houve mudança de regra, skip ou teste de produto para ocultar falha. CI Linux integral do novo SHA e autorização das migrations permanecem pendentes; nenhuma publicação alegada.

### Autorização e aplicação das migrations de Agendamentos

Em19/10/2026 o usuário respondeu “continua e publica”, autorizando continuar a publicação e as duas migrations específicas anteriormente apresentadas. A CI39200512469 no head7dbf0e77 aprovou validate, isolated-restore, release-gates, banco, navegador e referências; promotable-image foi corretamente ignorada por ser PR. Confirmado projeto Supabase `descomplica-crm-production`, ref `hnncxuerlcsaahdxoswb`, URL pública coincidente com o runtime e estado ACTIVE_HEALTHY. Definições anteriores registradas por hashes e histórico; nenhuma RPC de Agendamentos existia.

Aplicadas via MCP somente as migrations aditivas autorizadas, registradas remotamente como `20261019113232 appointments_analysis_stores` e `20261019113239 appointments_analysis_read`. Verificação: três payloads existentes permanecem versão1; nova auxiliar/RPC presentes e STABLE; `anon=false`, `authenticated=true`, `service_role=false` para EXECUTE da RPC; sem acesso direto novo às tabelas. Advisors posteriores mantêm alertas preexistentes; o novo aviso de SECURITY DEFINER autenticada é esperado para a RPC pública, que valida `auth.uid`, permissão da etapa, visão e ranking internamente e passou pgTAP. Não corrigir avisos alheios nesta entrega. Rollback operacional mantém as funções/leitores v1/v2, sem apagar snapshots nem contrair schema.

Antes de integrar PR261, `main` avançou ao SHA32c7cbdf pelos PR260/263, já publicado. O GitHub recusou merge por conflitos apenas em CHANGELOG, WORKLOG e manifesto visual. Integração local preservou ambas as notas e as referências de Meta e Agendamentos; manifesto combinado recalculado para242 imagens. `reference-parity`:15 aprovados/1 opt-in ignorado. Nova CI integral no SHA combinado continua obrigatória antes de merge/deploy. Nenhuma atualização do coletor, carga v2, merge ou deploy de Agendamentos ocorreu até este registro.

### Publicação e aceite do contrato v2

O PR261 foi integrado em `0ba37461c5615b290ac25b60f0970f0f9a3dcf2e` após a CI de PR `39246206975` aprovar validate, isolated-restore e release-gates. Antes da promoção, o PR264 de Previsão avançou `main` para `afb4a97df72a3c45a1982a8d520ef400eef2d985`; a imagem anterior foi corretamente rejeitada como candidata por não ser mais o topo. A CI de `main` `39264769472` aprovou os quatro jobs no SHA vigente, incluindo `promotable-image`.

Artefato `12192506863`: `image.tar.gz` SHA-256 `0b35c9331085f2c5f0468f8ce7ba66a793a81729b6106fab943e4c372284c56e`; revision exata e checksum aprovados. A configuração registrada pela CI é `sha256:67b0cfdfc724118cdd4405c3f67f773a02f0ad6459883b178097edfb644a8464`; o manifesto OCI/Docker no host é `sha256:493165cc26357d276a5cebd23764689f9b7a73bf3abcd92e25599cd2db21a393`. A diferença foi aceita somente após conferir index/manifest/config, plataforma linux/amd64, label da revisão, 11 blobs comprimidos, 11 camadas sem compressão, `rootfs.diff_ids` e `image:prove` nos dois perfis, sem rebuild ou retag.

Consulta imediatamente anterior mostrou produção no deployment `2c8cfb30-b73a-4180-b7e7-56b2aa2c5df5`, SHA `3002d578a2db346883e661c4ba568faa4ff99c26`, publicado em `2026-10-19T05:59:19.007Z`, sem pendência. O coordenador exclusivo publicou `afb4a97df72a3c45a1982a8d520ef400eef2d985` em `2026-10-19T14:50:45.273Z`, deployment `0eebcfc6-83af-4e09-947f-fe737fc58a5d`, sem pendência. Health público retornou HTTP200/ok na versão exata; acesso anônimo a `/app/etapas/agendamentos` retornou307 para login.

O coletor existente foi atualizado sob `installation.lock`, backup e CAS, preservando unidade, drop-ins, ledger, credenciais, destinos, agenda, navegador e monitor separado. WorkingDirectory passou de `66ed7360e5406129da20cde8983be4e51b7b83db` para o release `afb4a97d`; recibo privado em `/var/lib/descomplica-salesforce-collector-install/updates/20261019T145222Z-afb4a97df72a`. A primeira inicialização expôs apenas permissões de leitura insuficientes em `node_modules`; nenhum export iniciou. O serviço foi parado, a árvore de dependências tornou-se legível pelo usuário dedicado, o import foi comprovado e a mesma atualização foi concluída. Serviço ativo com PID estável, navegador ativo e monitor independente inativo.

Dois ciclos reais distintos foram aceitos: requests `025566d7-7c58-4642-9f3d-ba6e7ab64daf` e `2211a2cb-5732-4551-aca8-c995ce1fe950`, ambos `succeeded`, 155 registros e sem sobreposição. Inventários publicados às `2026-10-19T15:01:10Z` e `2026-10-19T15:36:10Z`, ambos com 3.298 itens na geração final. O snapshot vigente, gerado em `2026-10-19T15:33:04.883Z`, é versão2: todos os846 fatos agregados de Agendamentos têm11 posições; total1.097 em248 dias/10 meses,23 gerentes,118 responsáveis,14 lojas e33 empreendimentos. As três visões possuem dicionário de loja v2; nenhuma dimensão nominal ou registro individual foi exportado na evidência. N8n não foi editado: transportou o contrato integral já normalizado.

Validação local do registro final: lint, typecheck e build de57 rotas aprovados; Vitest3.900 aprovados/102 skips. A etapa Node aprovou1.595/19 skips e reproduziu somente as três falhas POSIX conhecidas de Meta Ads no Windows (arquivo privado e caminho absoluto), sem relação com o delta documental; a CI Linux completa `39264769472` permaneceu verde. Conferência posterior: ledger sem pendência e health HTTP200/ok ainda em `afb4a97d`. `origin/main` avançou depois do deploy para `f56236b3` pelo PR265; isso não altera o recibo da publicação concluída e deve ser integrado antes do PR documental.

### Abertura do ajuste visual dos gráficos

Em `2026-10-19T20:57:58-03:00`, o checkout foi atualizado para `origin/main`
`197cd012ae4a2021de3e9889fa1770d66cdf29e5` na branch
`codex/agendamentos-layout-uniforme`, sem mudanças locais. O GitHub público
mostrou a CI de `main` #964 concluída com sucesso nesse SHA; o cliente `gh` não
está instalado neste host. O health público retornou HTTP 200, `status=ok` e
`version=60ef87c7d52b5c68603e696a4cfe59dce92c4554`, anterior apenas ao commit
documental do topo. A demanda limita-se a manter rótulos e valores dos gráficos
na horizontal, uniformizar a altura dos sete cards e permitir rolagem vertical
interna quando o conteúdo exceder a área. Fonte: Git local/fetch, página pública
de Actions e `https://crm.descomplicapro.com.br/api/health`. Nenhum dado remoto,
contrato analítico, coletor ou workflow n8n será alterado.

Implementação local: valores e rótulos de dia, semana e mês usam escrita
horizontal e séries extensas quebram em linhas. Os sete cards têm 40 rem de
altura e corpo com rolagem vertical acessível por teclado, sem overflow
horizontal. Rankings, filtros e agregações permanecem inalterados. Preview com
CSS compilado do Next aprovou 12 telas em quatro larguras e três temas, zero
violações Axe, colisões ou diferenças de altura. Lint, typecheck e build de 57
rotas passaram; Vitest aprovou 3.952/102 skips. A etapa Node aprovou 1.595/19
skips e reproduziu três falhas POSIX conhecidas de Meta Ads no Windows;
`test:release` reteve o grupo Meta Ads dependente da fixture privada POSIX. A CI
Linux do SHA exato é o gate de integração e publicação. Fonte: código, execução
local e `test-results/appointments-preview/result.json`.

### Correção do estado sem dados após a primeira CI

A CI 39347120702 do PR270 aprovou validate e isolated-restore; release-gates
falhou somente em três comparações de Agendamentos. O artefato autenticado
12233333433 confirmou que a fixture não possui análise: a altura de 40rem havia
alterado as dimensões do estado indisponível em 1280 e 320px, e a captura balanced
ficou vazia. A imagem vazia não foi adotada. A altura fixa passou a existir
somente no componente Chart, mantendo o card sem dados compacto e preservando
nos sete gráficos preenchidos a escrita horizontal, a igualdade de altura e a
rolagem vertical. Repetir CI no novo SHA; o primeiro resultado não autoriza
merge nem publicação. Fonte: GitHub Actions 39347120702, artefato 12233333433,
capturas locais e código do componente.

### Encerramento e publicação do ajuste visual de Agendamentos

PR270 integrado no SHA `06a41f767fc721d4e85ac10142697a92e0fee0e1`.
CI de PR `39353605323` e CI de main `39357425838` verdes; a segunda aprovou os
quatro jobs e gerou o artefato imutável `12234994906`. ZIP e imagem foram
conferidos por SHA-256; revisão, manifesto/config OCI, plataforma linux/amd64,
13 descritores, 11 camadas, 11 diff IDs, rootfs e dois perfis de runtime
coincidiram no destino. A diferença config/manifest do armazenamento containerd
foi provada sobre o mesmo arquivo, sem rebuild nem retag.

Consulta imediatamente anterior registrou produção em `60ef87c7`, deployment
`561b4861-7f6a-477c-95d9-6f46427921d8`, `deployedAt=2026-10-19T20:51:02.314Z`,
sem pendência. O coordenador exclusivo publicou `06a41f76` às
`2026-10-20T02:57:56.421Z`, deployment
`979fb2df-a353-4df4-9c8b-b28caf2a9cf3`. Health posterior HTTP200/ok confirmou
a versão exata, ledger continuou sem pendência e a página anônima retornou307
para `/login`. Nenhuma migration, dado remoto, integração ou workflow n8n foi
modificado. A matriz com gráficos preenchidos é sintética; não houve acesso a
sessão privada de produção. Fonte: PR270, GitHub Actions, artefato12234994906,
coordenador de release, ledger e health público.

### Abertura dos indicadores e da tabela de Agendamentos

Em `2026-10-20T01:42:46-03:00`, o Git comum foi confirmado em
`C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git`. A branch
`codex/agendamentos-indicadores-tabela` partiu de `origin/main`
`2eb17cc052754519ebee1156060e394ea5728169`, sem mudanças locais. O health
público retornou HTTP 200, `status=ok` e versão
`06a41f767fc721d4e85ac10142697a92e0fee0e1`, que corresponde ao último runtime
publicado. A CI de push mais recente de `main`, execução `39366805822`, terminou
com falha no commit exclusivamente documental `2eb17cc0`; a CI anterior de
`main`, execução `39357425838`, aprovou o runtime `06a41f76`. O cliente `gh` não
está instalado; GitHub foi consultado pelo conector e Git por `fetch`.

A demanda amplia o contrato de Agendamentos com seis indicadores, previsão e
realização do dia, rankings regionais e de conta e uma tabela detalhada. O
contrato vigente publica somente fatos agregados e não contém linhas
individuais, horário, gerente regional, visita realizada nem ranking da conta.
Esses campos devem ser resolvidos pelo metadado vigente do relatório Salesforce
em cada coleta; nomes de API não serão inferidos, e dados pessoais ou linhas do
relatório não serão registrados nesta nota. Fonte: código atual, relatórios
`00OU600000ELaA6MAL` e `00OTT000009j0l32AA` indicados pelo usuário, GitHub
Actions e health público. Alteração remota de schema, caso necessária, continua
dependente da autorização específica aplicável.

## 2026-10-20: Abertura da edição de metas do Canal Parcerias

- Às `2026-10-20T04:03:57Z`, `origin/main` e o GitHub apontavam para
  `2eb17cc052754519ebee1156060e394ea5728169`; produção respondia HTTP 200,
  `status=ok` e `version=06a41f767fc721d4e85ac10142697a92e0fee0e1`.
  A diferença corresponde ao commit documental posterior ao runtime publicado.
- A CI de `main` `39366805822` falhou somente em
  `Verify current documentation fee sources`; os demais jobs foram ignorados.
  Essa fonte externa não valida nem bloqueia a investigação local da página Meta,
  mas uma CI verde no SHA candidato continua obrigatória para integração.
- Escopo solicitado: tornar a configuração do Canal Parcerias editável e
  salvável como Direcional Vendas, somente em `/app/configuracoes/metas`.
  Nenhum workflow n8n, dado remoto ou outra página será alterado nesta etapa.
- Fontes: Git local após `fetch`, GitHub branches/actions e GET observacional de
  `https://crm.descomplicapro.com.br/api/health`. O cliente `gh` está indisponível
  neste host; o conector GitHub forneceu as evidências equivalentes.

### Implementação e validação local

- Causa confirmada: Parcerias ainda carregava o rascunho inativo de política
  comercial e condicionava a edição a `crm.commercial_policy.manage`, enquanto
  Direcional Vendas já carregava e persistia a meta ativa com
  `crm.settings.manage` e a RPC versionada `upsert_crm_funnel_goals`.
- Parcerias passou a reutilizar integralmente o fluxo ativo: campos editáveis,
  botão `Salvar alterações`, validação de mês, persistência e confirmação na
  própria rota. A RPC existente já restringe o perfil e fixa em zero os campos
  que não pertencem ao funil de Parcerias; nenhuma migration foi necessária.
- Evidências locais: 32 testes focados aprovados; `lint`, `typecheck`, `build` e
  `format:check` aprovados; build com 57 rotas; Vitest com 3.954 aprovações e
  102 ignorados; preview específico com 30 telas, cinco larguras, três temas,
  edição habilitada, sem overflow e sem violações Axe.
- A suíte operacional Node aprovou 1.595 casos, ignorou 19 e apresentou três
  falhas já conhecidas na emulação POSIX de arquivos privados do Meta Ads no
  Windows. `test:release` reproduziu a limitação nas fixtures privadas do mesmo
  módulo. Não houve alteração nessa área; a CI Linux do SHA candidato continua
  sendo o gate conclusivo de integração e publicação.
- Na execução CI `39368979457` do PR #272, `validate` e `isolated-restore`
  passaram integralmente. `release-gates` aprovou banco, autorização, build e
  E2E, mas bloqueou na comparação visual porque a página Parcerias ficou menor
  após remover o bloco de rascunho inativo: 11 capturas da própria rota mudaram
  de dimensão. O artefato sanitizado `12241794237` foi inspecionado; os campos
  estavam editáveis, o botão `Salvar alterações` estava presente e não havia
  overflow. Somente essas 11 referências foram promovidas para nova validação;
  baselines de outras páginas permaneceram intactas.
- A execução seguinte `39373587403` parou no teste de integridade porque o
  resultado promovido preservou do artefato o marcador transitório
  `worktreeDirtyAtCapture=true`. O marcador foi corrigido para o estado limpo
  da baseline versionada; os 28 testes locais de catálogo/paridade passaram
  (27 aprovados e um ignorado) antes do novo envio.

## 2026-10-20: Abertura da previsão por período e gerente

- A branch `codex/previsao-periodos` iniciou no `origin/main`
  `099493a9f1f64730efd449364979384309c2ed44`. A CI de `main`
  `39411919967` concluiu com sucesso no mesmo SHA.
- Às `2026-10-20T12:18:13.3265927Z`, o health público respondeu HTTP 200,
  `status=ok` e `version=08d050f90c877009cd55140322b7c822e578d672`.
  A produção estava um commit documental atrás de `main`; esse estado não
  comprova a publicação da nova demanda.
- Escopo solicitado: selecionar fins de semana válidos no calendário, separar
  Geral, House e Imob por gerente, carregar e salvar previsões por período,
  manter dez corretores no estado inicial e compactar a grade com primeira
  coluna fixa, destaque cruzado e controles de empreendimento reposicionados.
- A migration `20261019004204_forecast_action_plan.sql` permanece versionada,
  mas ainda não foi aplicada no banco remoto. Qualquer migration adicional ou
  aplicação em produção continua condicionada à validação e à autorização
  específica do usuário. Fontes: Git local após `fetch`, GitHub Actions e GET
  observacional de `https://crm.descomplicapro.com.br/api/health`.

### Implementação e validação local

- A chave de persistência passou a ser fim de semana, segmento e gerente. House
  e Imob editam grades independentes; Geral devolve até doze seções completas e
  somente leitura, preservando personalizações diferentes entre gerentes.
- O calendário usa sexta, sábado e domingo como dias válidos. A seleção carrega
  o mesmo período, permanece visível e atualiza o título com o intervalo. Sem
  registro, a API reutiliza somente a estrutura mais recente, limpa valores e
  Plano de ação e mantém a primeira linha de corretor.
- A interface fixa a coluna do corretor em cabeçalho, corpo e Total geral,
  destaca corretor, métrica e empreendimento da célula ativa, impede quebra do
  índice 10 e mantém dez corretores no rascunho inicial. Controles de grupo
  ficaram compactos no canto superior esquerdo sem deslocar o título.
- O armazenamento novo força RLS, não concede acesso direto e expõe RPCs com
  usuário ativo, permissão da página, MFA e CAS de revisão. A migration
  `20261020122216_forecast_period_scopes.sql` depende da anterior
  `20261019004204_forecast_action_plan.sql`; ambas permanecem sem aplicação
  remota e exigem autorização específica depois da CI aprovada.
- Evidências locais: `lint`, `typecheck`, `build`, `format:check`, catálogo,
  recursos e `git diff --check` passaram; Vitest aprovou 3.965 e ignorou 105;
  110 testes focados e 12 cenários de navegador passaram. A suíte Node aprovou
  1.595, ignorou 19 e reproduziu três falhas POSIX conhecidas do Meta Ads no
  Windows. `test:release` reproduziu a fixture privada do mesmo módulo e um
  timeout Qlik isolado; o delta não altera essas áreas. A CI Linux no SHA exato,
  com pgTAP e restauração isolada, é obrigatória antes de merge e publicação.

## 2026-10-20: Retomada para preencher corretores automaticamente na Previsão

- A branch `codex/previsao-corretores-automaticos` iniciou no `origin/main`
  `c1e931d5ad805f9f43766d67f1d7f297e99a31ae`, após a integração da Previsão
  por período no merge `dfe174635fe4712670a36268b1f9cd5f9cb297a2`.
- Às `2026-10-20T19:39:57.3530636Z`, o health público respondeu HTTP 200,
  `status=ok` e `version=50f11d326cdd37b051db46f1dd1015076b85d545`.
  A versão publicada não corresponde ao `main` atual e não comprova esta demanda.
- A leitura observacional do banco confirmou que os nomes de corretores e seus
  gerentes já existem no snapshot analítico do CRM. A grade ainda cria
  `Corretor 1` a `Corretor 10` localmente e o contrato da Previsão não consome
  essa fonte. O ajuste deve preencher somente rascunhos ainda não salvos; períodos
  salvos permanecem históricos e editáveis. Nenhum usuário ou dado remoto foi
  alterado. Fontes: Git local após `fetch`, `/api/health`, catálogo e consultas
  somente leitura do Supabase de produção.
- A primeira CI do PR #283 bloqueou no `pnpm audit` por
  `@modelcontextprotocol/sdk` 1.31.0, dependência transitiva do diagnóstico local.
  O override foi atualizado para 1.32.1, indicada como corrigida pelo advisory
  GHSA-22jm-h49p-29qw; a auditoria local passou sem achados altos ou críticos.
- Na segunda CI, o teste 15 de `grants_matrix.test.sql` detectou que a RPC nova
  ainda não constava na allowlist nominal de funções executáveis por
  `authenticated`. A lista foi atualizada para auditar a permissão já concedida
  pela migration; nenhum grant adicional foi criado.
- A terceira CI aprovou a restauração isolada e todos os 2.085 testes pgTAP, mas
  o gate visual capturou os cabeçalhos ativo e de grupo em pontos diferentes da
  transição CSS. O contexto ativo passou a não animar a cor; hover comum mantém
  a transição e a indicação visual solicitada continua coordenada.
- Antes do build da quarta CI, um advisory recém-publicado bloqueou Vite 8.2.0
  a 8.2.3, dependência transitiva do Vitest. O projeto passou a forçar Vite
  8.2.4, versão corrigida, sem trocar a versão do executor de testes.

### CI aprovada e migrations autorizadas em produção

- A execução CI `39506011102` aprovou `validate`, `isolated-restore` e
  `release-gates` no SHA
  `3437f9a0c15786fee830b6de2fc3e8c562ad4d7d`. O job de imagem promovível foi
  corretamente ignorado por se tratar de PR.
- Após autorização específica do usuário em 20/10/2026, o Supabase de produção
  aplicou, nesta ordem, as migrations locais
  `20261019004204_forecast_action_plan.sql`,
  `20261020122216_forecast_period_scopes.sql` e
  `20261020204500_forecast_broker_roster.sql`. O ledger remoto registrou
  `20261021002706_forecast_action_plan`,
  `20261021002724_forecast_period_scopes` e
  `20261021002737_forecast_broker_roster`; a diferença de timestamp é do
  aplicador remoto e não autoriza reparo ou reaplicação.
- SHA-256 dos arquivos aplicados, na mesma ordem:
  `bac79025080c09ce45500966c2ef5eb9237e796ab0d9cfce9a22b0a6d64d213f`,
  `db1c688751b21d32aa84acd2ccb3c5bf752fad9d3aa88b929c6d6819f23808d8` e
  `486ca992f3637b8ff82e792421a1bd6be030b29d43bba4f304162eddfbfb7586`.
- O pós-check confirmou `crm_forecast_periods` vazia, RLS forçado, leitura e
  gravação somente pelas RPCs autorizadas e o novo elenco executável apenas por
  `authenticated`. O documento legado permaneceu com uma linha e digest
  `5a44047fd53a72f0bc5b9f72c3fa6bf92c136144859c5f3fc48ea7e0025c8e9b`.
- O advisor de segurança não apontou acesso anônimo novo. O advisor de
  desempenho registrou como informativa a ausência de índice isolado na chave
  `updated_by`; ela não participa das leituras do produto e não justifica uma
  quarta migration neste escopo. Os demais avisos pertencem a objetos anteriores.
- No runtime obrigatório Node 24.19, `lint`, `typecheck` e `build` passaram. O
  Vitest geral aprovou 3.970 e ignorou 105; dois testes independentes da
  Previsão excederam o timeout sob carga local. A repetição isolada aprovou os
  dois arquivos, com 251 testes, e a CI Linux do novo SHA permanece obrigatória.
- A revisão do PR encontrou um caso funcional antes do merge: `upper()` não
  remove acentos, portanto Álvaro, Fabrício e Thiago de Araújo poderiam não ser
  localizados no snapshot. A migration corretiva
  `20261020214500_forecast_broker_manager_accents.sql` normaliza os diacríticos
  com `translate`, preserva ACL e guards e acrescenta pgTAP para os dois nomes
  acentuados. Consulta somente leitura no Supabase confirmou as formas
  `ALVARO`, `FABRICIO` e `THIAGO DE ARAUJO`.
- Após a CI `39524875107` aprovar `validate`, `isolated-restore` e
  `release-gates` no SHA
  `ff38d6a1c762ea790466906627936b320491f52c`, o usuário autorizou a aplicação e
  a recuperação correspondente. O Supabase MCP aplicou somente a corretiva e o
  ledger remoto registrou
  `20261021021551_forecast_broker_manager_accents`. O arquivo aplicado tem
  SHA-256
  `0270b3926fa9c6e3badd6c7ea0a2e9fbc67169f064948846c90b497e15e4a62f`.
- O pós-check confirmou `translate` e o mapa de diacríticos na definição,
  função `STABLE SECURITY DEFINER`, owner `postgres`, `search_path` vazio,
  timeout de 10 segundos e `EXECUTE` apenas para `authenticated`; `anon` e
  `service_role` seguem bloqueados. `crm_forecast_periods` permanece vazia e o
  singleton legado mantém uma linha e revisão 5. Os advisors não apontaram
  acesso anônimo novo; permanece apenas o aviso informativo já registrado para
  o índice de `crm_forecast_periods.updated_by` e avisos anteriores ao escopo.

## 2026-10-20: Abertura do painel inteligente de agendamentos

- A branch `codex/agendamentos-interactive-dashboard` iniciou no `origin/main`
  `0b7fc85fe898b9778ea5899fc222e50240692753`. O health público consultado em
  `2026-10-20T23:11:03-03:00` respondeu HTTP 200, `status=ok` e versão
  `ee451647dc895dafe83be17604849e0cb163c1dc`; essa versão ainda não contém a
  demanda atual.
- O snapshot vigente tinha 32 corretores, 78 agendamentos agregados no mês e
  74 linhas operacionais. A divergência foi reproduzida: datas Salesforce no
  formato `YYYY-MM-DD` eram preservadas nos fatos, mas convertidas como UTC no
  detalhamento, deslocando-as para o dia anterior em `America/Sao_Paulo`.
- A meta individual vigente reproduzirá o volume de Agendamentos projetado pela
  tela de Metas a partir da meta de Vendas e das taxas entre etapas; nenhum campo
  isolado de taxa ou contagem será tratado como esse volume. A meta mensal
  solicitada é a projeção individual multiplicada pelos corretores do snapshot.
- Escopo: corrigir a transformação na origem, expor somente a meta necessária
  com autorização da página, compactar e reorganizar gráficos, implementar
  filtros cruzados acessíveis e reconciliar tabela e indicadores. Fontes: Git
  local/remoto, health público, código versionado e leitura agregada sanitizada
  do snapshot; nenhuma linha de cliente foi registrada.

### Implementação e validação local

- A leitura da meta expõe somente o volume projetado de Agendamentos e exige
  `crm.stage.appointments.view`; anon e service role não executam a RPC. O
  cálculo replica a sequência de taxas da tela de Metas e o card multiplica o
  resultado pelos corretores cadastrados.
- Datas Salesforce sem horário agora recebem o offset de São Paulo antes da
  normalização. A coleta rejeita detalhes cujo calendário de criação divirja do
  fato diário, eliminando a causa do total 78 contra 74 e dos registros de hoje
  deslocados para ontem.
- O painel usa as linhas operacionais reconciliadas para indicadores, gráficos,
  rankings e tabela; ordena criação de forma decrescente e aplica filtros
  cruzados por clique ou teclado. O previsto diário usa um por corretor de
  segunda a quarta e sexta, dois na quinta e zero no fim de semana.
- `lint`, `typecheck` e `build` passaram. Vitest aprovou 4.071 e ignorou 105; 50
  testes focados e 13 cenários da transformação passaram. O preview aprovou 12
  combinações de largura/tema, sem overflow ou violações Axe, incluindo filtros
  de gráfico e linha completa da tabela.
- A suíte Node aprovou 1.596, ignorou 19 e reproduziu três limitações POSIX já
  conhecidas do Meta Ads no Windows, fora do delta. O pgTAP local não executou
  porque Docker/Podman não está instalado; a CI Linux, incluindo restauração
  isolada das 72 migrations e 2.082 asserções pgTAP, permanece gate obrigatório.

## 2026-10-21: Abertura dos totais separados e da visão Geral da Previsão

- A branch `codex/previsao-totais-geral` iniciou no `origin/main`
  `755659e9a467db2758f8a17dfd8ce126ddf8948a`, após `git fetch origin --prune`.
  O Git comum foi confirmado em
  `C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git` e o checkout
  estava limpo. O GitHub registrava os PRs #294 e #295 como mudanças abertas
  pertinentes a outros módulos; a consulta de runs de `main` pelo conector não
  retornou execução associada ao SHA, portanto esse resultado não comprova CI.
- O health público consultado em `2026-10-21T21:45:48.7472710Z` respondeu HTTP
  200, `status=ok` e versão
  `755659e9a467db2758f8a17dfd8ce126ddf8948a`, alinhada ao `origin/main` dessa
  abertura. A demanda ainda não estava implementada.
- Escopo solicitado: separar o Total em Previsão e Realizado e transformar a
  visão Geral em tabela somente leitura com `Equipe Origem`, linhas House e
  Imob e somatórios por empreendimento. A investigação inicial permanece local
  e sem migration, escrita remota ou acesso a dados privados.
- A implementação manteve o contrato da API e agregou localmente os documentos
  já autorizados. Empreendimentos são conciliados pelo título NFKC, com espaços
  normalizados e acentos preservados; IDs internos de grupos não são
  compartilhados entre gerentes. Dado numérico inválido propaga total
  indisponível, sem ser convertido em zero.
- Testes focais aprovaram 88 casos de cálculo/API/componente e 12 cenários de
  navegador, incluindo desktop e celular. `lint`, `typecheck` e `build` passaram
  no Node 24.19/pnpm 11.20. O Vitest geral aprovou 4.082 testes e ignorou 105,
  mas o teste anterior do Associativo em
  `associative-approval-suggestion.test.ts` excedeu 5 segundos duas vezes sob
  carga; isolado, o arquivo aprovou 13/13. As suítes Node mantiveram três falhas
  POSIX conhecidas do Meta Ads no Windows, e `test:release` também reproduziu
  falhas do host Meta Ads em fixtures de arquivos privados. Nenhuma asserção foi
  relaxada; a CI Linux do SHA candidato permanece o gate para integração.

## 2026-10-22: Totais separados e visão Geral da Previsão publicados

- O PR #296 foi integrado na `main` pelo commit
  `c50d2070a92d6522e052f955301aa436be22563a`. A revisão automática identificou
  que títulos `__proto__` e `constructor` poderiam atingir propriedades do
  protótipo durante a agregação; o armazenamento passou a usar objetos sem
  protótipo e ganhou regressão dedicada. A thread foi resolvida somente depois
  do teste passar.
- A proteção de branch recusou corretamente resultados antigos quando a `main`
  avançou duas vezes durante as matrizes longas. As integrações concorrentes
  foram incorporadas e a CI final do PR `39710170718` aprovou `validate`,
  `isolated-restore` e `release-gates` no SHA atualizado, sem reduzir gates.
- A CI de `push/main` `39714940532` aprovou também `promotable-image`. O artefato
  `12398148502` conferiu com
  `sha256:209eb85df458f1be22e6a92fc5951eda163697b1e944f6a941bf2a49bf126f7e`.
  A diferença esperada entre a config da CI
  `sha256:9653c0a8dee24e9f71791ae4464287e668fd5ccecd4ad750c83ea79e954149b7`
  e o manifesto containerd
  `sha256:fa464f8e188c587f0ecc19cd45f9364bbe621849b9d997f8036238b41cd8ae56`
  foi comprovada pelo índice OCI, hashes dos blobs, onze camadas, RootFS,
  plataforma `linux/amd64`, label da revisão e `image:prove` nos dois perfis.
- O coordenador exclusivo `pnpm release:production deploy` publicou o deployment
  `085edb7e-f7ca-4453-bb34-1cab1b6a7d67` em
  `2026-10-22T03:50:24.306Z`, usando o deployment anterior
  `f21451fd-2a4a-431c-8edf-df1a8d1190bf` como CAS. O ledger final confirmou a
  versão `c50d2070`, o manifesto homologado e nenhuma pendência.
- A observação externa de `2026-10-22T03:52:05.3546957Z` confirmou HTTP 200,
  `status=ok` e a versão exata. A rota anônima `/app/gestao/previsao` respondeu
  HTTP 307 para `/login`. Esta entrega não criou migration, não alterou n8n e
  não acessou dados privados de produção.

## 2026-10-23: Agendamentos publicado e regra de escopo registrada

- O dashboard de Agendamentos integrado pelo PR #307 permaneceu como o único
  escopo funcional desta conversa. O PR #312 registrou no repositório a regra
  permanente de tratar cada chat como exclusivo à demanda solicitada, sem
  aproveitar a execução para alterar outras páginas.
- A `main` exata `f3b512dce5e725f9002b06b3c9382213466824e6` foi validada pela
  CI `39906486242`: `validate`, `release-gates`, `isolated-restore` e
  `promotable-image` concluíram com sucesso. O artefato imutável `12480374065`
  teve digest ZIP
  `sha256:3fdf17851f6fc691a2d41b243973b041c09510b7a7e088310bd7ca4d40489a7d`.
- `image.tar.gz`, `revision.txt` e o checksum foram conferidos. A configuração
  registrada pela CI foi
  `sha256:00f4e162b3f33d37bf4bd5f5197a5d240ac4fd1b97a633ec8e68d27d860dda61`;
  o manifesto carregado no Docker containerd foi
  `sha256:316b1503187abe6eaa858808a0ef62e5dfd9415420a05915166e664bdc0036b2`.
  Índice, hashes do manifesto e da configuração, plataforma `linux/amd64`,
  revisão OCI, 11 camadas, 11 `diff_ids` e `image:prove` nos dois perfis foram
  aprovados, sem rebuild ou retag.
- O coordenador `pnpm release:production deploy` publicou o deployment
  `aed84f63-8ccb-49bc-a8e5-88280edb65ef` em
  `2026-10-23T06:29:59.711Z` (`03:29:59` em America/Sao_Paulo), usando o
  deployment anterior `9e38c7e0-a2f5-4a08-8512-3b92a3e7429b` como CAS. O
  ledger final confirmou o SHA e a imagem homologada, sem pendência.
- A observação externa de `2026-10-23T06:30:07.9946224Z` confirmou HTTP 200,
  `status=ok` e a versão exata. A rota anônima
  `/app/etapas/agendamentos` respondeu HTTP 307 para `/login`. Nenhuma outra
  página foi alterada nesta etapa de publicação; não houve migration, mudança
  de n8n, DNS, cobrança ou mutação de dados remotos.

## 2026-10-23: abertura dos ajustes visuais e filtros de Agendamentos

- A branch `codex/agendamentos-layout-filtros-v6` iniciou no `origin/main`
  `c80a39d92d5ecfcada4241076d58cd874df35096`, após a integração documental do
  PR #314 com CI `39911972202` aprovada. O health público consultado em
  `2026-10-23T13:58:28.0362540Z` respondeu HTTP 200, `status=ok` e versão
  `f3b512dce5e725f9002b06b3c9382213466824e6`; a diferença é exclusivamente o
  registro documental integrado depois do último deploy e não exige reinício.
- Escopo exclusivo: somente `/app/etapas/agendamentos` e seus componentes e
  cálculos diretos. A demanda uniformiza doze indicadores e cinco gráficos,
  organiza seis rankings/recências em duas linhas, melhora rótulos, hover e
  inclinação dos cards e faz todos os indicadores respeitarem os filtros,
  incluindo a contagem de gerentes no recorte selecionado. Nenhuma outra página,
  migration, n8n ou dado remoto será alterado.

## 2026-10-23: implementação local dos ajustes de Agendamentos

- Os 12 indicadores usam uma grade única, altura uniforme, tipografia comum e
  conteúdo centralizado. A inclinação limitada acompanha o ponteiro e respeita
  `prefers-reduced-motion`. Os cinco gráficos principais têm a mesma altura; os
  três rankings e as três faixas de recência formam uma grade 3 × 2. Ranking
  Score exibe os nomes na vertical, de baixo para cima. Barras, rótulos,
  rankings, recências e linhas da tabela recebem realce no hover.
- Filtros dimensionais passam a recortar o elenco registrado antes de calcular
  corretores, gerentes, meta prevista e equipe produtiva. A regressão comprova
  que um gerente filtrado resulta em um gerente, um corretor registrado, meta
  diária de um e equipe produtiva de 100% na fixture. Filtros de período mantêm
  o cadastro vigente e recortam somente as métricas operacionais.
- Evidência local: lint, typecheck, build e 18 testes focados aprovados. O QA com
  CSS compilado aprovou 12 combinações de tema/largura, zoom de layout, axe,
  filtros, hover, inclinação, dimensões e overflow. O Vitest geral aprovou 4.107
  testes e ignorou 107; o estágio Node do `pnpm test` falhou em três testes
  Windows do Meta Ads, externos ao escopo (ACL de segredo e diretório de perfil
  dedicado). Nenhum arquivo dessa área foi alterado. CI, merge e publicação
  ainda não ocorreram e permanecem estados separados.

## 2026-10-23: bloqueio externo de integração dos ajustes de Agendamentos

- O PR #315 chegou ao SHA `63da2f4db520c61a68b97f991510447373a6af34`
  com CI `40009497577` e candidato visual `40009497616` aprovados. Após a
  integração externa do PR #317, a branch incorporou `origin/main`
  `f8799dbc5f5d280979be261699018186be616037` sem conflito funcional e passou ao
  SHA `bde9bbd39ff4af83284b51ae00c2336cb54d3313`.
- A CI da própria `main` (`40022552767`) e duas tentativas do job `validate` do
  PR (`40023399660`) falharam exclusivamente em `pnpm audit --audit-level high`.
  A reprodução local do mesmo comando terminou com código 0. O candidato visual
  `40023399816` não substitui o gate obrigatório. Pela regra máxima de escopo,
  nenhuma dependência ou área externa foi alterada; merge e publicação ficam
  bloqueados até o gate da `main` voltar a aprovar ou receber correção em chat
  próprio.
- A observação final de `2026-10-23T18:09:47-03:00` confirmou HTTP 200,
  `status=ok` e versão publicada
  `74b76c248c67e62b5cfad5e721389f1c81431a43`; portanto, o conteúdo do PR #315
  ainda não está em produção.

## 2026-10-23: correção comprovada do gate de auditoria do PR #315

- A reprodução no Ubuntu com Node `24.19.0` e pnpm `11.20.0` identificou
  `GHSA-mrhx-c7xc-m3w5`: Zod menor que `4.6.6`, inclusive o `3.25.76` fixado pelo
  `next-devtools-mcp@0.4.0`. O Windows não reproduzia o advisory.
- Zod foi atualizado para `4.6.7` e o DevTools passou a reutilizar essa versão.
  `pnpm audit --audit-level high --json` no Ubuntu terminou com código 0, sem
  vulnerabilidade alta ou crítica. `pnpm devtools:check` aprovou o protocolo e
  as ferramentas Next e Chrome. Dois refinamentos explícitos preservaram os
  limites UTF-16 existentes; 72 testes dos contratos afetados passaram. A
  publicação segue condicionada aos demais gates e ao coordenador oficial.

## 2026-10-23: segundo advisory no fechamento da publicação de Agendamentos

- O PR #315 foi integrado no `main` como
  `b88122c7dddadd1d14ef4dc8cfeb033c0c57c8d1`, após CI `40029289783` e
  candidato visual `40029289690` aprovados.
- Durante a CI do `main` (`40035073028`), o registry passou a reportar o novo
  `GHSA-27r3-jxmh-p828` em `body-parser@2.3.0`, transitivo do Next DevTools. O
  pacote foi fixado em `2.4.0`; não houve mudança funcional em Agendamentos.

## 2026-10-24: terceiro advisory no fechamento da publicação de Agendamentos

- A CI de `push/main` `40061774780`, no SHA
  `b403071c1b749476f638bd6a36dcaedfcce033be`, aprovou testes e documentação,
  mas bloqueou no audit porque o registry passou a reportar
  `GHSA-xjj6-f33q-929c` em `undici@7.30.0`, transitivo do Next DevTools.
- O override mínimo para `undici@7.30.1` atualizou o lockfile. A auditoria local
  terminou sem severidade alta ou crítica. Esta correção não altera a página de
  Agendamentos nem qualquer outra funcionalidade; ela existe somente para
  restabelecer o gate obrigatório de publicação.

## 2026-10-24: núcleo operacional do menu Lead concluído localmente

- O banco próprio do DESCOMPLICA-CRM é a fonte autoritativa do corte. Foram
  implementadas nove páginas protegidas e a rota autenticada de exportação,
  cobrindo cadastro, lista, detalhe, atividades, mensagens internas, etiquetas,
  favoritos, funil, distribuição, relatórios, importação, configurações e
  auditoria. C2S permanece apenas como referência funcional; nenhuma credencial
  ou informação de cliente foi copiada.
- Duas migrations funcionais adicionam o domínio normalizado e operações por
  RPC com RLS forçada, grants mínimos, permissões por página e ação,
  idempotência vinculada a organização, ator e comando, retenção automática de
  prévias de importação e auditoria sem PII. A migration do catálogo registra
  as 41 páginas protegidas atuais.
- Evidência local em Node 24.19 e pnpm 11.20: lint sem erros, typecheck e build
  aprovados; Vitest com 4.179 aprovados e 107 ignorados; `pages:check`,
  `resources:check`, Gitleaks e verificação de diff aprovados. Os 72 testes
  pgTAP do núcleo e 53 das operações dependem da CI Linux porque não há
  Docker, Podman ou Supabase local neste host.
- Limite externo: `pnpm test` mantém três falhas Windows preexistentes do Meta
  Ads, e `pnpm test:release` mantém onze falhas do mesmo host por arquivo
  sintético ausente. Esses arquivos não foram alterados, conforme a regra de
  escopo exclusivo. Integrações externas, WhatsApp, CRM imobiliário,
  financeiro e produtos opcionais não fazem parte desta entrega.

## 2026-10-25 — Abertura: paridade do Simulador CAIXA

- Escopo: exclusivamente /app/simulacao/caixa; referencia https://descomplicapro.com.br/simulacao/caixa somente leitura; validar regras em fontes oficiais CAIXA.
- Git comum confirmado; checkout inicialmente detached/limpo em 6a0f678eee50bd1f8178cd11de9301b016d9bd99; origin/main no mesmo SHA apos fetch em 2026-10-26 UTC (25/10 America/Sao_Paulo). Branch de trabalho codex/simulador-caixa-paridade.
- Health https://crm.descomplicapro.com.br/api/health consultado sem autenticacao em 2026-10-26T00:37:00Z: HTTP 200, status ok, version ec98b41aedc721c22fff4f28dca9b31bc6317373. Versao publicada difere do checkout documental; nao comprova entrega desta demanda.
- CONTEXTO.md/FERRAMENTAS.md lidos. Runtime instalado context/search falhou com Documento excede o limite de exportacao; ATUALIZACOES.md ja possuia 259205 bytes (limite 256000). Nao reduzir protecao nem alterar ferramenta fora do escopo. Sync sera tentado e eventual pendencia registrada. Reavaliar com manutencao especifica do arquivo de conhecimento.
- gh ausente no PATH; consultas GitHub pelo conector. Pagina de referencia acessivel por leitura web. URLs /home e /simulacao do simulador oficial retornaram 404 na ferramenta web; investigar acesso publico normal e fontes oficiais alternativas, sem presumir regras.

### Abertura CAIXA — complemento de fonte GitHub

- Conector confirmou main como branch padrão. Consulta observacional via gh instalado na VPS confirmou CI push/main 40240265203 concluída com sucesso no SHA local 6a0f678eee50bd1f8178cd11de9301b016d9bd99; fonte https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40240265203. Não há PR aberto da demanda CAIXA; PRs antigos de migração registravam apenas canário/visual, não validação financeira atual. Branch remota atualizada por fetch. Não executar suites na VPS compartilhada.
- Sync inicial tentado e recusado por limite de exportação; o mesmo problema preexistente consta no registro documental anterior de main. Mantida pendência, sem ampliar escopo para corrigir a infraestrutura do conhecimento.

## 2026-10-25 — CAIXA: implementação e validação específica

- PR https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/351 aberto em draft; implementação restrita à página CAIXA, sem alterar a origem de referência, outras páginas, banco ou workflows. Fórmulas e fontes oficiais completas em docs/simulators/CAIXA.md.
- Testes específicos: 64 de motor/guards aprovados após correções; cliente4/4, nove combinações de largura/tema e seis auditorias adicionais de abas, sem axe/overflow. Inspeção visual corrigiu detalhes que axe não cobre. Artefatos locais sintéticos em private-data/caixa-qa, não dados de clientes.
- Lint e typecheck aprovados localmente; 36 warnings existentes em assets Meta fora do escopo. Build inicial aprovado. pnpm test Windows executado, primeira tentativa saturou host; repetição com VITEST_MAX_WORKERS=2 apresentou timeouts externos (conhecimento, Qlik, Associativo, DevTools), sem alterar testes ou baseline dessas áreas. A CI Linux0ab2a93c aprovou4241 testes e detectou apenas novo caso de taxaClasseMédia acima10%; corrigido e regressão local64/64 aprovada. CI final ainda pendente.
- Revisão independente corrigiu data-limite80a6, finitude, custos acima da prestação, teto de complemento, cidade/UF e prazo de obra. IN17/IN4 de08/04/2026 art3 permite ClasseMédia até13000 sem renda mínima9600; art16 taxa nominal máxima10. Cálculo local indicativo, não aprovação/CET; complemento e encargos sem dados oficiais não são inventados. Fórmula MFOM034 com FUH e anexos documentada integralmente.
- Primeira CI185c1595 falhou formatação; corrigida no0ab2a93c. Merge/publicação não executados; dependem da CI final, QA autenticada e coordenador exclusivo de produção. Sync continua pendente pelo limite preexistente de256000 bytes; não alterar infraestrutura do conhecimento fora do pedido. Reavaliar em manutenção específica.

## 2026-10-25 — CAIXA: captura autenticada e regressão de tablet

- Fonte: run Protected visual candidate 40254914307, head203754ae46b102519e299f8d647a72fd60fd7685, captureCommit de merge bb05924600ef3dea1bd1413fbccdd3f6ac2aefd4, capturado em 2026-10-26T02:05:15Z. Artifact12623137226 contém diagnóstico sintético. Falhas restritas à CAIXA: mainCount0 em7 larguras e overflow em1024. Demais páginas, Axe e canvas passaram; promoção de baseline recusada corretamente. Nenhuma referência foi alterada a partir dessa execução inválida.
- Causa comprovada: harness local usava main artificial, enquanto o shell autenticado fornece div. Tracks com mínimos260/140 também ampliavam a largura intrínseca para além do formulário. Corrigidos apenas CaixaArchive/main e CSS próprio, sem esconder overflow nem mudar shared shell/gates/limiares.
- Regressão local anterior reproduziu overflow1024. Artefato final formatado aprovado em run local98692 (23:28 America/Sao_Paulo):4/4 testes,12 combinações1440/1024/390/320 por3 temas,6 auditorias adicionais de abas, exatamente1main, zero Axe/overflow/console. Teste usa Archive real, globals e canvasCSS, com hostdiv sem landmark artificial. Run financeiro/guards local:64/64 aprovado após proteção de valores extremos nos utilitários e teto nominal MCMV10%.
- CI203754ae validou lint/tipos/suíte Linux/fontes/audit/build, restore isolado e E2E autenticado; release bloqueada pela captura descrita. Nova captura e CI do código corrigido pendentes. Não houve merge/deploy. Sync Obsidian continua impedido pelo limite preexistente do documento, a reavaliar em manutenção própria.

## 2026-10-26 — CAIXA: contraste transitório e cobertura de estados

- Fonte: CI 40259598078, job 121370107375. Dois casos de contraste falharam no Linux: diagnóstico ativo em1440 e botões inativos em320/light; outros48 testes desse passo passaram. Validate (lint, tipos, suíte completa, fontes, audit e build) passou; produção permaneceu na versão anterior.
- Causa: transição global de cor/fundo de160ms, com interpolação de texto e fundo passando por contraste insuficiente. Correção somente no CSS CAIXA, com cores opacas e opt-out dessa interpolação em controles. Não foi alterado app/globals.css, não houve espera artificial nem exclusão de violações. Estados DARK adicionais de fase/contador, avisos, FGTS e Remover habilitado foram verificados e corrigidos pontualmente.
- Resultado local do artefato formatado68439:4/4 em61,52s;12 combinações main e24 auditorias de estados (Resumo Parcial/Documentos/Diagnóstico/Utilitários,3 temas,1440/390), com dois períodos no FGTS para testar Remover habilitado. Zero Axe/overflow/console; timeout90s intacto. Relatórios de erro incluem cores calculadas, contraste e failureSummary.
- Contrastes medidos: inativos claros #40546c/#fff=7,77:1; diagnóstico ativo #fff/#087583=5,41:1; inativos DARK #a9bfd2/#102a42=7,73:1. As cores restantes foram preservadas quando não havia falha. Nova CI e captura autenticada ainda pendentes; referências não promovidas de execução inválida. Sync permanece pendente pelo limite preexistente do exportador, sem ampliar escopo de autorização.

### CAIXA — revisão móvel e atualização concorrente

- Revisão visual independente das seis capturas de resultado identificou quebra da última casa decimal em390 nos três temas. Layout próprio reorganizado para manter quantias completas; regressão verifica linha única, contenção e ausência de reticências. A conferência final será registrada após o handoff.
- Fetch em2026-10-26T03:21Z detectou origin/main5ed6260600f22cbaab348eb67f900bbbe653f932, entrega concorrente de Agendamentos e shell. Integração preservará esse código e suas referências, sem corrigir outras páginas. CI push/main40263238224 ainda em execução. Health público em2026-10-26T03:21:53Z:HTTP200,status ok,version ec98b41aedc721c22fff4f28dca9b31bc6317373. A versão CAIXA continua sem merge/publicação.
- A atualização externa exige reconferência do candidato integrado antes dos gates finais. Obsidian permanece pendente pelo limite de exportação preexistente; não alegar sincronização ou produção atualizadas apenas por tentativa.
- Artefato local formatado38545:4/4 testes aprovados em36,97s, preservando12 combinações do formulário e24 auditorias de estados. Quantias240.000,00/60.000,00 verificadas por fragmentos de texto/limites DOM, sem quebra ou reticências. Trinta imagens restantes revisadas; seis resultados regenerados enviados à reconferência independente. Sync de retomada tentou exportar e recusou o documento pelo limite já registrado.
- Reconferência independente concluída nas seis PNG de resultado em resolução original: quantias completas em390/light/balanced/dark e sem regressão observada em1440. Código congelado após handoff; nova captura autenticada e gates globais ainda pendentes.
- Main5ed62606 integrado no candidato051fb2ee sem alterar o código concorrente; conflitos documentais conservaram ambos os registros. Após integração: typecheck/lint/build locais aprovados (36 warnings Meta existentes); regressão específica83 aprovados e1 condicional não executado. CI40263953550 aprovou4290 testes Linux/110 condicionais, mas bloqueou na fonte externa de Documentação: https://www2.prefeitura.sp.gov.br/web/fazenda/w/servicos/itbi/2517 respondeuHTTP403 em2026-10-26T03:29:59Z. Gate/script/exceção preservados; não corrigir outra página para liberar CAIXA. Nova execução após incorporação das referências deverá reavaliar a disponibilidade; falha persistente impede publicação. Captura40263953439 já aprovou build/E2E autenticado e segue na matriz visual.

### CAIXA — captura autenticada aprovada e incorporação restrita

- Run 40263953439 aprovado: build, E2E e matriz funcional/Axe/zoom. Artifact 12626398223; ZIP SHA256 84842462516ae1274d482bc9583e1fea9e2575aa08244dbc5679862ffa80aee7. Head 051fb2ee3d1c959f845ac2389b177efc1ff9f0ee; captureCommit 2c3e6d8c408bd6402a9a3653757c2da9f1a702f1; capturedAt 2026-10-26T03:54:26.619Z. Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40263953439.
- Revisão independente das 11 imagens em resolução original: sete larguras, três temas desktop e dark mobile. Estado inicial legível e integrado ao shell, sem corte, sobreposição ou overflow visível. Resultados preenchidos e demais abas têm a prova sintética anterior; esta revisão estática não substitui cálculo ou oferta bancária.
- Incorporadas somente 11 imagens CAIXA, 38 entradas da rota (7 responsivas, 4 temas, 11 Axe, 11 screenshots e 5 zoom), seus registros de hash e proveniência parcial. Metadados globais e referências das demais páginas preservados. Nova CI requerida; HTTP 403 da fonte de ITBI continua pendência externa até reavaliação bem-sucedida. Merge e publicação ainda não executados. Sync final permanece sujeito ao limite preexistente de exportação.
- Verificação local após incorporação: reference-parity com 15 testes aprovados e 1 condicional não executado; Prettier e diff-check aprovados. Comparação estrutural confirmou que todas as outras rotas e os metadados globais permaneceram idênticos. A edição do JSON usou intervalos de AST para preservar texto fora das entradas necessárias.

### CAIXA — reconferência da publicação concorrente

- Fetch em 26/10/2026 às 04:25 UTC confirmou origin/main 5ed6260600f22cbaab348eb67f900bbbe653f932, já integrado ao candidato CAIXA. CI push/main 40263238224 concluída com sucesso nos quatro jobs; fonte https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40263238224.
- Health público em 2026-10-26T04:25:54.067Z: HTTP 200, status ok, version 5ed6260600f22cbaab348eb67f900bbbe653f932. A entrega concorrente de Agendamentos está publicada; esta versão não comprova publicação da CAIXA. O candidato CAIXA eac63e7b continua sem merge/deploy, com validate, restauração e E2E aprovados na CI 40266778359 e matriz visual final em execução.
- A próxima publicação deve usar a versão/deployment ID/data reais então ativos, obtidos novamente pelo coordenador; não reutilizar o registro anterior ec98b41a como expectativa. Sync de retomada será tentado, mantendo o limite preexistente como pendência se recusado.

### CAIXA — precisão documental do complemento

- Releitura independente do MFOM034, pp. 131–133, §3.1.1.1 e §3.1.1.8: não localizada saturação explícita de R/Frenda ou função por faixas após RDmin=3700. A expressão literal volta a crescer acima do mínimo; elegibilidade até renda4000 não define como limitar a curva. Não inventar congelamento ou extensão monotônica. Limite acrescentado à memória matemática em docs/simulators/CAIXA.md.
- Escopo estritamente documental: a página não executa essa expressão e já utiliza somente complemento informado como confirmado, sem estimar fatores ausentes. Nenhuma regra financeira ou código do candidato foi alterado por esse esclarecimento. Reavaliar apenas com especificação operacional oficial adicional.

## 2026-10-26 — CAIXA: CI, merge e publicação confirmados

- Implementado no head eac63e7bad1a2ec42ce17cf11c3541f95932a12d. CI de PR 40266778359 e captura 40266778468 aprovadas; PR https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/351 integrado sem bypass em 54eb7cdd7460130fc8c70d71fb956cb801b8d12c. CI push/main https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40270504690 concluída com os quatro jobs aprovados. Validate confirmou 4.290 testes/110 condicionais, fontes sem exceção de indisponibilidade, audit, lint, tipos e build; release validou navegadores, E2E, banco, restauração e matriz visual.
- Indisponibilidade transitória HTTP403 da fonte de ITBI no run40263953550 encerrada por novas verificações aprovadas, sem alterar script, exceção, baseline ou página externa. Falhas/timeouts Windows anteriores permanecem como limite daquele host; não foram mascarados nem usados para dispensar a suíte Linux completa.
- Artifact12627897001, nome promotable-image-54eb7cdd7460130fc8c70d71fb956cb801b8d12c; digest do artifact c6e3aac871ccbd879f5446c0d1af9d10a74291343a76ed357e8db2d5edfe7fa8. image.tar.gz SHA25675ddefb97c1603703dbe0edbdd1dff104ef1d3bfc375f8bf9be0252d74c9c955; revisão exata conferida. ID CI/configuração sha256:1f4b3ff0b1a6eb7995f41009918271f3fe38d1f7227c88c5b7e5c21de2a58102 e ID VPS/manifesto sha256:f4b4005ae5d9a7ecba2f0e30efbf39c03836d180f4e12b6e69d91890400e3ff7 reconciliados por index/manifest/config, hashes/tamanhos, plataforma linux/amd64, manifesto legado e onze camadas/rootfs. Nenhum rebuild ou retag na VPS. image:prove confirmou dois perfis, mesma imagem e nenhum segredo impresso.
- Checkout remoto limpo em /srv/descomplica-crm-releases/54eb7cdd7460130fc8c70d71fb956cb801b8d12c. A reutilização inicial de node_modules por symlink foi recusada pelo pnpm antes da prova; removido somente o link explicitamente verificado e instalado o lockfile congelado pelo cache, sem scripts, downloads ou build. Node24.19.0/pnpm11.20.0; checkout permaneceu limpo. Dependências compartilhadas não foram removidas ou alteradas.
- Backup privado de production.env e ledger em /var/backups/descomplica-crm/caixa-54eb7cdd7460130fc8c70d71fb956cb801b8d12c, diretório0700/arquivos0600, comparados aos originais; imagem anterior 5ed62606, IDsha256:a2d421bbf725296dce309e031647963409af7473673fcb684e57e33bf8a2df8d, disponível para recuperação. Sem mudança de schema/dados, DNS, cobranças, contas, flags ou n8n.
- Publicado exclusivamente por pnpm release:production, com as três travas, consulta no próprio minuto/até60s, CI/main exatos e CAS. Expectativa anterior: deployment d04aed32-b1af-4ff7-a768-4d5f7e4189d9, SHA5ed6260600f22cbaab348eb67f900bbbe653f932, data real2026-10-26T04:04:22.711Z. Resultado deployed: deployment042fc7e9-ab92-4f96-a45f-b3eed91e184b, SHA54eb7cdd7460130fc8c70d71fb956cb801b8d12c, imagem f4b4005a..., deployedAt2026-10-26T05:40:32.386Z (26/10/2026 02:40:32 America/Sao_Paulo), pendingDeploymentId null. Nenhuma recuperação necessária.
- Pós-publicação: GET público sem cookies em2026-10-26T05:41:09.860Z retornou HTTP200/status ok/version54eb7cdd7460130fc8c70d71fb956cb801b8d12c. GET anônimo da rota às05:41:11.423Z retornou307 para/login. Status do coordenador confirmou mesmo deployment/imagem/data e ausência de pendência.
- Smoke autenticado de produção, somente com dados sintéticos: renda6000, imóvel300000, nascimento1991-03-15, São Paulo/SP, MCMV/PRICE/420 meses. Resultado: financiamento indicativo240000, entrada complementar60000, primeiro encargo parcial1732,59; avisos de MIP/DFI, tarifa, subsídio, obra e CET exibidos. Documentos, Diagnóstico e Utilitários abriram corretamente. Campos limpos no fim, sem compartilhar, imprimir, salvar proposta ou criar registro remoto. Captura local do formulário vazio: private-data/caixa-qa/caixa-production-54eb7cdd.png; identidade de conta e dados privados não transcritos para evidências versionadas.
- Fonte de referência https://descomplicapro.com.br/simulacao/caixa permaneceu somente leitura. O registro de fechamento é documental e deve ser publicado no Git sem reiniciar a aplicação. Sync Obsidian continua impedido pelo limite preexistente de256000 bytes; não reduzir proteção, arquivar autoridade ou alterar infraestrutura nesta demanda. Reavaliar em manutenção específica do conhecimento; a falha não invalida a evidência direta de GitHub/CI/site nem concede autorização adicional.

### CAIXA — conciliação do registro documental com main

- CI documental `40276795962` aprovada no head `d620621c40ad4156524d16f0215caa507a7d97e9`. Antes da integração, main avançou para `bebbb2adbb0fe345f8535e7918fd6fa293edc267`, PR #353 de Meta Ads. Houve conflito somente nos registros iniciais de CHANGELOG/WORKLOG; preservados integralmente os dois textos e o código concorrente. A demanda CAIXA continua com quatro arquivos documentais no diff contra a nova base, sem alteração de runtime.
- Reconferência em `2026-10-26T06:44:15.295Z`: health HTTP 200/status ok/version `54eb7cdd7460130fc8c70d71fb956cb801b8d12c`. CI push/main `40280448260` da entrega concorrente em execução; a CI runtime CAIXA `40270504690` já estava concluída com sucesso. Nova validação do registro reconciliado é exigida pela proteção de branch; a aplicação CAIXA já publicada mantém suas evidências e não será reiniciada por esta alteração documental. Sync permanece pendente pelo limite de exportação já registrado.

## 2026-10-26 — Abertura: compactação e navegação de Agendamentos

- Escopo exclusivo: `/app/etapas/agendamentos`. Pedido cobre compactação dos menus e cabeçalho, vermelho semântico no tema escuro, reordenação acessível dos 12 cards e dos dois blocos do funil, além de seções guiadas que exibem somente o conjunto solicitado com alturas e gráficos aproveitando toda a área.
- Git comum confirmado. Branch `codex/agendamentos-layout-compacto-v12` criada a partir de `origin/main` `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f` em 26/10/2026. A CI push/main `40381778238` do commit documental mais recente estava em execução; isso não valida esta nova demanda.
- Health público observado sem autenticação em `2026-10-26T19:22:32.2416289Z`: status `ok`, versão publicada `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A versão publicada difere do `main` documental atual e não comprova esta implementação.
- `context` e `search` no runtime Node 24.19 recusaram a exportação porque o documento excede o limite. O mesmo limite preexistente impede o sync inicial; não reduzir proteção nem alterar a infraestrutura do conhecimento nesta demanda. Código, GitHub e health atuais permanecem as evidências diretas.

## 2026-10-26 — Abertura: revisão cirúrgica das cotas SBPE

- Escopo exclusivo: revisar `/app/simulacao/caixa`, aplicar a regra solicitada de
  cota SBPE de 90% no SAC e 80% no Price e confrontar as demais regras do motor
  com fontes oficiais e simulações sintéticas, sem alterar outras páginas,
  dados remotos, n8n ou a referência pública.
- Git comum confirmado. Branch `codex/caixa-sbpe-cotas` criada sobre
  `origin/main` `4e6c8a9da91fbc4acfeaaa40669dc09cb95caedc`; CI de `push/main`
  `40315829223` aprovada. Health público observado em
  `2026-10-26T12:33:23.7747568Z`: HTTP 200, `status=ok`, versão publicada
  `ef91f3ec277adf490991e6d477a96da10a9fbe69`. Código publicado e `main` serão
  distinguidos durante a validação.
- `knowledge:context`, `knowledge:search` e sincronização continuam bloqueados
  pela falha preexistente `Documento excede o limite de exportacao.`. A
  indisponibilidade não autoriza reduzir o documento ou omitir a conferência
  direta de código, fontes, CI e site; reavaliar em manutenção própria.

### CAIXA — regras implementadas e validação local

- SBPE configurado com teto de 90% no SAC e 80% no Price. A cota passou a
  incidir sobre o menor entre compra e avaliação CAIXA; cota individual
  confirmada pode apenas reduzir o teto. Aporte MCMV Cidades foi separado do
  desconto complemento FGTS, que agora rejeita valor positivo inferior a
  R$ 1.500. O último mês do cenário de obra atinge 100% da liberação.
- Calculadora rápida pública exercitada em 26/10/2026 somente com dados
  fictícios, sem CPF, telefone, consentimento ou proposta: cenários de renda
  R$ 3 mil, R$ 6 mil e R$ 20 mil, imóveis de R$ 210 mil, R$ 300 mil e
  R$ 500 mil, idades de 35 e 70 anos. Recurso público identificou versão
  1.16.0.2/data 06/07/2026 #1 e parâmetros de taxa, MIP, DFI e tarifa. Eles
  entram apenas como estimativa identificada quando valores confirmados faltam;
  proposta individual prevalece. SBPE não reutiliza taxas MCMV de renda baixa.
- Validação focada: 51 testes financeiros aprovados; cinco jornadas completas
  de navegador aprovadas, incluindo três temas, desktop/celular, Axe, overflow,
  quantias completas e fluxo SBPE SAC 90%. Capturas sintéticas revisadas em
  `private-data/caixa-qa`, sem dados de clientes.
- Gates em Node 24.19.0/pnpm 11.20.0: lint sem erros (44 warnings preexistentes
  em assets Meta fora do escopo), typecheck e build aprovados. `pnpm test`
  aprovou 4.298 testes e encontrou três timeouts de host em Associativo e
  DevTools; os dois arquivos exatos foram reexecutados isoladamente com um
  worker e aprovaram 37/37 sem alteração fora do escopo. CI remota continua
  obrigatória antes de merge/publicação.
- Primeira captura protegida `40329412235` interrompeu no E2E porque a asserção
  ainda exigia o texto antigo `seguros não confirmados`; a própria evidência
  mostrava o novo estado correto `seguros de referência`. Os 15 cenários
  anteriores passaram. A expectativa CAIXA foi atualizada sem reduzir o gate;
  nova CI/captura é obrigatória.

### CAIXA — captura protegida e referências visuais

- CI `40331622292`: validate e restauração isolada aprovados. O release gate
  aprovou cálculo CAIXA, temas, Axe, banco, build e E2E; recusou apenas cinco
  comparações visuais esperadas da própria rota, sem falha financeira.
- A primeira tentativa da captura `40331622478` atingiu o limite de 45 minutos
  durante a matriz global, depois de E2E aprovado. A repetição exata concluiu
  com sucesso, sem mudança de workflow ou redução de gate.
- Artefato aprovado `12660573871`, digest
  `35990d8d37adcd201cda2d161859ca92ec4ad0392943c40b5bf32dfca93812b1`;
  head `0a301c77e66be38361df9d7b1667ecc49360be7d`, capture commit
  `bbe3748a4c32a354d18bc578b55b2ad49cb2067e`, capturado em
  `2026-10-26T15:01:33.668Z`.
- Onze imagens CAIXA revisadas em resolução original: formulário completo e
  legível, sem corte, sobreposição ou overflow horizontal nas sete larguras,
  três temas desktop e escuro móvel. Incorporadas somente as cinco imagens
  materialmente alteradas e os registros da rota; demais páginas e metadados
  globais preservados. Nova CI do head integrado continua obrigatória.
- Validação final local em Node 24.19.0/pnpm 11.20.0: lint sem erros e com os
  mesmos 44 warnings Meta preexistentes; typecheck e build aprovados; Vitest
  aprovou 4.302 testes e pulou 111. A etapa Node aprovou 1.599 e pulou 19, mas
  três testes de ACL/perfil privado Meta falharam no host Windows. Não houve
  correção fora do escopo nem dispensa do gate; a suíte Linux da nova CI deve
  aprovar integralmente antes de merge/publicação.

### CAIXA — integração, publicação e aceite em produção

- O PR #358 foi integrado sem bypass na `main` como
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A CI de `push/main`
  `40362745379` aprovou `validate`, `promotable-image`, `isolated-restore` e
  `release-gates`, incluindo a jornada CAIXA e a matriz completa de temas,
  larguras, zoom, teclado, banco, build e restauração.
- Artefato imutável `12669426869`, digest ZIP
  `874a59a060cfd7ecafab44b1f8edcd092b864c000d104ffa09cd57bac8bffe18`;
  `image.tar.gz` conferiu com
  `f160251d0aba5288fd9f1aaa0c12118957b5a99ec69e24572677f1ef60c520bd`.
  A configuração da CI
  `sha256:ee62b6bba79908d3854fff59d71a6580daab2f8940941290bbb8d78711d7b123`
  e o manifesto/ID no Docker containerd
  `sha256:23f6b685003781ecc4274f68d960100a89fa29dd0ad6443a3fae0a83b6726a9b`
  foram reconciliados por índice, hashes, plataforma `linux/amd64`, revisão e
  11 camadas/`diff_ids`; `image:prove` aprovou os dois perfis, sem rebuild ou
  retag.
- Checkout remoto limpo em
  `/srv/descomplica-crm-releases/24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`,
  com Node 24.19.0, pnpm 11.20.0 e lockfile instalado do cache em modo offline,
  congelado e sem scripts. Backup privado verificado em
  `/var/backups/descomplica-crm/caixa-24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`;
  imagem anterior preservada para recuperação. Nenhuma migration, dado remoto,
  DNS, cobrança, conta ou workflow n8n foi alterado.
- O coordenador exclusivo `release:production` confirmou no próprio minuto a
  produção anterior — deployment `0c1664b4-31cf-4fc5-bc84-a807627e0dab`, SHA
  `9e7d1c56232bd6742d4419a9a6a291092aedc3c3`, publicado em
  `2026-10-26T15:53:23.442Z` — e publicou o deployment
  `3928ca60-0e0b-433e-8da2-e08cc24a4dca` em
  `2026-10-26T17:45:12.098Z` (`14:45:12` America/Sao_Paulo). O ledger final
  confirmou SHA/imagem exatos e `pendingDeploymentId=null`.
- Às `2026-10-26T17:45:17Z`, o health público respondeu HTTP 200,
  `status=ok` e versão `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`; o GET
  anônimo da rota retornou 307 para `/login`. Smoke autenticado, somente com
  dados sintéticos, confirmou em SBPE/Price imóvel de R$ 500 mil, financiamento
  de R$ 400 mil, entrada de R$ 100 mil e cota de 80%; no mesmo cenário em SAC,
  financiamento de R$ 450 mil, entrada de R$ 50 mil e cota de 90%. A base da
  cota, taxa estimada de 11,49% a.a., seguros/tarifa de referência e alertas
  apareceram corretamente; os campos foram limpos, sem imprimir, compartilhar,
  salvar proposta ou criar registro.
- A referência `https://descomplicapro.com.br/simulacao/caixa` permaneceu
  somente leitura. A simulação oficial completa não foi submetida porque exige
  CPF, celular, consentimento e verificação; os confrontos públicos usaram
  apenas informações fictícias e parâmetros expostos pela calculadora rápida.
- Fechamento documental em Node 24.19.0/pnpm 11.20.0: lint sem erros e com os
  44 warnings Meta já conhecidos, typecheck e build aprovados. Vitest aprovou
  4.302 testes e pulou 111; a etapa Node aprovou 1.599, pulou 19 e repetiu as
  mesmas três falhas exclusivas do host Windows em ACL/perfil privado Meta.
  Esses arquivos não foram alterados; a CI Linux integral do SHA publicado está
  verde e continua sendo a evidência de release.
- O `knowledge:sync` final foi tentado após este registro e permaneceu bloqueado
  pela falha preexistente `Documento excede o limite de exportacao.`. Não houve
  redução do documento, alteração do vault ou alegação de sincronização; a
  pendência deve ser tratada em manutenção própria do conhecimento.

## 2026-10-26 — abertura: canvas analítico em Visão Geral e Agendamentos

- Escopo solicitado: transformar exclusivamente `/app` e
  `/app/etapas/agendamentos` em canvases analíticos configuráveis, preservando
  fontes, filtros, permissões e fórmulas existentes. A especificação exige grade
  responsiva, movimentação e redimensionamento, reflow, histórico, perfis por
  usuário, expansão e exportação selecionável em PDF.
- Estado local observado em `2026-10-26`: branch
  `codex/agendamentos-layout-compacto-v12`, SHA
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`, com mudanças em andamento somente
  na experiência de Agendamentos e `output/` não rastreado preservado. O Git
  comum confirmado é o repositório autorizado do DESCOMPLICA-CRM.
- Produção consultada em leitura observacional: `/api/health` respondeu HTTP 200,
  `status=ok`, versão `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`.
  `git fetch origin --prune` concluiu; a consulta de CI pelo `gh` ficou
  indisponível porque o executável não existe neste host.
- Limite desta ampliação: a especificação anexada determina autorização separada
  para publicação. Portanto, implementação, migration versionada e testes podem
  ser preparados localmente, mas migration remota, merge e produção ficam
  bloqueados até nova autorização explícita. Nenhuma mutação remota de dados foi
  autorizada por este pedido.

## 2026-10-26 — canvas analítico implementado e validado localmente

- Implementado nas rotas `/app` e `/app/etapas/agendamentos` um canvas
  configurável em grade responsiva de 12 colunas, com movimentação e
  redimensionamento por Pointer Events, encaixe, reflow, seleção múltipla,
  movimentação em grupo, desfazer/refazer, expansão, editor compatível por
  métrica/modelo/filtros/período, detecção de duplicados e exportação seletiva
  ordenada em PDF. Em celular, o layout é reorganizado em uma coluna sem perder
  legibilidade ou controles por teclado.
- Os perfis por usuário foram preparados com cache local de contingência,
  salvamento automático, perfil padrão e conflito otimista. A persistência
  versionada está em `20261026194815_dashboard_profiles.sql`, com RLS, MFA,
  grants mínimos e acesso somente pelas RPCs próprias; a migration não foi
  aplicada remotamente porque a especificação exige autorização separada para
  publicação.
- A Visão Geral preserva os 13 funis existentes e Agendamentos preserva seus 28
  cards, fontes, filtros, permissões e fórmulas. Os modelos alternativos só são
  oferecidos quando compatíveis com a métrica; nenhuma regra comercial foi
  inventada ou alterada.
- Validação local em Node 24.19.0/pnpm 11.20.0: lint sem erros (46 warnings já
  existentes/gerados), typecheck, catálogo de 41 páginas, inventário de 79
  rotas e build de produção aprovados. Vitest aprovou 4.355 testes e pulou 111.
- A etapa Node do `pnpm test` aprovou 1.599 testes e pulou 19, mas o gate global
  terminou com três falhas de ambiente Windows fora deste escopo: duas em
  `ops/meta-ads/connection-monitor.node-test.mjs` (arquivo privado owner-only e
  heartbeat do monitor) e uma em `ops/meta-ads/vps/session.node-test.mjs`
  (diretório pai absoluto real). Nenhum arquivo Meta Ads foi alterado para
  contornar o gate; CI integral continua obrigatória antes de qualquer merge ou
  publicação.
- QA visual da Visão Geral aprovou 267 verificações, sem erro de console, página
  ou navegador, cobrindo temas claro, médio e escuro, larguras desktop e móvel,
  filtros, permissões, estados indisponíveis e extremos. O canvas de
  Agendamentos aprovou 15 combinações de 320, 390, 768, 1440 e 1920 px nos três
  temas, sem corte, sobreposição ou overflow, além de teclado, desfazer,
  redimensionamento, grupo, expansão, perfis, editor e diálogo de PDF.
- Estado final: alteração implementada e validada localmente, sem commit, PR,
  merge, migration remota ou deploy. Produção permanece separada deste trabalho
  e deve continuar na versão observada na abertura até autorização explícita e
  aprovação integral dos gates.
- Conferência final em `2026-10-26T20:44:20Z`: `git fetch origin --prune`
  concluiu, `HEAD` e `origin/main` permaneciam em
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`, enquanto o health público
  respondeu HTTP 200, `status=ok` e versão
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. Isso confirma somente que o site
  publicado permaneceu inalterado; não constitui publicação deste canvas.
- O `knowledge:sync` final foi tentado depois do registro e permaneceu bloqueado
  pela falha preexistente `Documento excede o limite de exportacao.`. O vault
  não foi alterado por contorno e a sincronização não é alegada como concluída.

## 2026-10-26 — autorização para migration, PR e publicação do canvas

- O usuário concedeu autorização explícita para aplicar a migration aditiva de
  perfis, abrir e integrar o PR e publicar o canvas em produção. A autorização
  permanece limitada às rotas `/app` e `/app/etapas/agendamentos`, à migration
  `20261026194815_dashboard_profiles.sql` e aos arquivos de validação associados.
- O início do fluxo protegido confirmou `HEAD=origin/main` em
  `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`; `git diff --check` aprovou e o
  diretório não rastreado `output/` continua preservado e fora da entrega.
- A publicação seguirá PR, CI do SHA exato, migration via conector Supabase,
  artefato imutável, backup/rollback e o coordenador `release:production`. Uma
  falha em qualquer gate interrompe somente a etapa dependente, sem redução ou
  contorno do controle.
- No PR #367, o `validate` confirmou formato, lint e tipos, mas o inventário do
  ensaio ainda esperava 2.289 testes pgTAP depois da inclusão da asserção de
  volatilidade. O contador foi alinhado para 2.290 e o teste direcionado
  `tests/release-candidate.test.ts` aprovou 26/26 antes da nova CI.

## 2026-10-26 — Abertura: layout e acesso do Simulador CAIXA

- Escopo aprovado: alinhar `/app/simulacao/caixa` ao padrão visual dos
  simuladores Associativo e Tabela Direta nos temas claro, médio e escuro, além
  de liberar o motor CAIXA para todos os perfis autenticados do CRM. Fórmulas,
  cotas, taxas e demais regras financeiras permanecem fora do escopo de mudança.
- Git comum confirmado. A branch `codex/caixa-layout-acesso` foi criada sobre
  `origin/main` `443e6fc6deb0a75ad6d57462e2f756cbb2760c4f`; checkout iniciou limpo.
  O GitHub CLI está indisponível neste host, portanto PR e CI serão consultados
  por conector ou alternativa disponível antes da publicação.
- Health público observado em 26/10/2026: HTTP 200, `status=ok`, versão
  `24d9bc81d2fd5b05baf2c0bfcd3e5f6ab995af18`. A versão publicada contém as
  cotas SBPE anteriores, mas não contém esta nova alteração de interface/acesso.
- `knowledge:context`, `knowledge:search` e a sincronização inicial foram
  tentados e continuam bloqueados pela falha preexistente
  `Documento excede o limite de exportacao.`. A indisponibilidade não autoriza
  reduzir a autoridade documental nem dispensa a conferência direta do código,
  dos testes, do GitHub/CI e do site.

### CAIXA — layout, acesso, CI e publicação confirmados

- O PR #362 foi integrado sem bypass no `main` como
  `9cf72dafb273693f412143abc337eefd0ed80f4e`. A CI push/main
  `40411904177` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; a etapa CAIXA e a matriz global de largura, temas, zoom,
  teclado e Axe passaram. Fonte:
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40411904177.
- Artefato imutável `12693059289`, nome
  `promotable-image-9cf72dafb273693f412143abc337eefd0ed80f4e`, digest do
  artifact `dd3216791d2c8ba7029747fb825d777e176ea1d0d38abfc00c7666b45e1231dc`.
  A captura protegida final `40404389362` também foi aprovada; artifact visual
  `12691744581`, digest
  `8f1c94fd968991568d736eb9abfdbf7ed8b9edb76a2b7e1ede0640bf7469be90`.
- O coordenador exclusivo registrou o deployment
  `a9d4d0ba-a660-4d88-b241-02ecff8d4e9b`, SHA exato `9cf72daf...`, imagem
  `sha256:41d65835f860fcb08797add395276711a9eb5e0bf39ce5b8ed938be3c1bc962c`
  e `deployedAt=2026-10-26T23:32:26.887Z` (20:32:26
  America/Sao_Paulo), sem pendência. A reconferência protegida com a CI exata
  retornou `noop`, preservando o deployment já ativo e sem reiniciar.
- Pós-publicação em `2026-10-27T00:34:26.521Z`: GET público do health respondeu
  HTTP 200, `status=ok` e versão
  `9cf72dafb273693f412143abc337eefd0ed80f4e`; GET anônimo de
  `/app/simulacao/caixa` respondeu 307 para `/login`. A CI já havia validado a
  jornada autenticada com dados sintéticos, três temas, cálculo, Axe e overflow.
- Escopo preservado: fórmulas e regras financeiras não foram modificadas; SAC
  90% e Price 80% continuam cobertos. Nenhum dado remoto, migration aplicada,
  DNS, cobrança, conta ou workflow n8n foi alterado.
- Após a publicação, `origin/main` avançou para `962f7d9d` por uma entrega
  concorrente de Meta Ads. O registro distingue esse estado posterior da versão
  CAIXA comprovadamente publicada; não houve intervenção ou republicação da
  entrega concorrente.
- Fechamento documental: formato, lint, typecheck e build aprovados. A suíte
  Windows teve quatro timeouts de host em Associativo e conhecimento; repetição
  isolada dos dois arquivos, com um worker, aprovou 35/35. A CI Linux exata do
  SHA publicado é a evidência integral. O `knowledge:sync` final foi tentado e
  permaneceu bloqueado por `Documento excede o limite de exportacao.`; nenhuma
  redução do documento ou alteração do vault foi feita.

## 2026-10-27 — referências visuais do canvas autenticado

- A CI de `main` `40438827767`, no SHA exato
  `4d3557d5f0a147535cce6e8668fb25eab70f61a2`, aprovou `validate`,
  `isolated-restore` e `promotable-image`. O `release-gates` falhou somente por
  divergência em 22 capturas das duas rotas alteradas pelo canvas: `/app` e
  `/app/etapas/agendamentos`.
- O artefato autenticado `12707058881`, digest
  `83d8733eee69b847487efe4be1602feffafd3ffc87a8a8359d53128b8afb0a43`,
  comprovou 154/154 rotas, 88/88 combinações de tema, 242/242 auditorias Axe,
  teclado e zoom aprovados. Das 242 imagens, 220 permaneceram idênticas.
- Foram adotadas somente as 22 referências revisadas das duas rotas, com
  conferência de hash e tamanho, registro de proveniência no manifesto e sem
  alterar limiares, páginas externas ao escopo ou dados de produção. A revisão
  cobriu desktop nos temas claro, médio e escuro e celular nos temas claro e
  escuro, sem corte, sobreposição ou rolagem horizontal.
- A atualização oficial local do baseline não pôde subir o Supabase porque este
  host não possui Docker nem Podman. Foi usado o procedimento parcial já
  registrado no projeto, baseado no artefato autenticado da CI e limitado às
  imagens divergentes. Uma nova CI integral continua obrigatória antes do merge,
  da migration e da publicação.
- O fixture autenticado de Agendamentos apresentou o estado vazio
  `Dados analíticos indisponíveis`; portanto, essa evidência confirma layout e
  responsividade do estado protegido, mas não substitui o smoke pós-publicação
  com dados reais.
- O `knowledge:sync` continua indisponível pela falha preexistente
  `Documento excede o limite de exportacao.`; a sincronização com o Obsidian
  permanece pendente e não é declarada como concluída.

## 2026-10-27 — Canvas de Visão Geral e Agendamentos publicado

- O PR #369 foi integrado sem bypass no `main` como
  `897d0cf9c8a91b197a91c742c3799968c7dcc61c`. A CI push/main
  `40446127865` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; a matriz protegida confirmou 154 rotas, 88 combinações
  de tema, 242 auditorias Axe, teclado e zoom. Fonte:
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/40446127865.
- A migration aditiva `dashboard_profiles` foi aplicada no projeto Supabase
  `hnncxuerlcsaahdxoswb` após a CI verde. A conferência encontrou a tabela
  vazia, RLS ativa e forçada, duas policies, seis RPCs e seis grants de execução
  somente ao papel autenticado. Nenhuma linha anterior foi reescrita ou
  removida. Os advisors não apontaram falta de RLS/policy nessa tabela; os
  avisos globais preexistentes e o índice sugerido para a chave estrangeira de
  `page_key` ficam fora do escopo desta publicação e não alteram o contrato
  validado pelo pgTAP.
- Artefato imutável `12708028636`, nome
  `promotable-image-897d0cf9c8a91b197a91c742c3799968c7dcc61c`, digest do
  artifact `23e4fba0a27e60408a63042cdb5fefb3e5cee0d34b56664609db6f78152591e2`.
  `image.tar.gz` conferiu com SHA-256
  `c569e73511cf57801d087866246ffa6338aea3ba2e852a4bc353daf3cc1388f3`.
  O ID de configuração da CI
  `sha256:23fa4850774188822a2821caef1278a0afa0ce81f6067f80ff8be37815bffdc1`
  e o manifesto no host
  `sha256:716c83bf5718cae2a5d14e28dc400391e38b5569547c1c8a2e7eb5c982dacaee`
  foram reconciliados pelo índice, hashes de todos os blobs, revisão, plataforma
  `amd64/linux`, 11 camadas e `image:prove` nos dois perfis, sem rebuild ou
  retag.
- Checkout remoto limpo em
  `/srv/descomplica-crm-releases/897d0cf9c8a91b197a91c742c3799968c7dcc61c`,
  com Node 24.19.0 e pnpm 11.20.0. Backup privado do env e do ledger anterior em
  `/var/backups/descomplica-crm/canvas-897d0cf9-20261027T044637Z`; imagem
  anterior `sha256:41d65835f860fcb08797add395276711a9eb5e0bf39ce5b8ed938be3c1bc962c`
  preservada para recuperação.
- Publicação executada exclusivamente por `pnpm release:production`, com as
  três travas, consulta de baseline no próprio minuto, CI/main exatos e CAS.
  Resultado `deployed`: deployment
  `61163953-0645-423b-ab6a-ea62d18edf27`, SHA e imagem candidatos,
  `deployedAt=2026-10-27T04:46:55.929Z` (01:46:55 America/Sao_Paulo) e
  `pendingDeploymentId=null`.
- Pós-publicação em `2026-10-27T04:47:06.0919180Z`: health público respondeu
  `HTTP 200`, `status=ok` e a versão exata publicada; acessos anônimos a `/app`
  e `/app/etapas/agendamentos` responderam 307 para `/login`. O smoke
  autenticado recarregou Agendamentos com os controles de adicionar, organizar,
  desfazer/refazer, perfis, PDF, mover, editar, expandir, excluir e redimensionar;
  a Visão Geral exibiu `Dashboard | Resumo Geral` e os mesmos controles de
  canvas. As duas páginas ficaram sem alertas de interface e sem erros de
  console.
- O `knowledge:sync` final permanece sujeito à falha preexistente de documento
  acima do limite de exportação. O resultado será registrado como pendência,
  sem reduzir a proteção, truncar autoridade ou declarar sincronização concluída.

## 2026-10-27 — Abertura: automações e simplificação do Simulador CAIXA

- Escopo solicitado: tornar automático o teto indicativo de comprometimento em
  30%, o limite municipal conforme cidade/UF, o prazo máximo conforme a idade e
  a seleção da taxa aplicável ao valor do imóvel; reorganizar e vincular
  `Imóvel na planta?` e `Condição do imóvel`, preservando exatidão e simplificando
  a jornada de `/app/simulacao/caixa`.
- Git comum confirmado. Branch `codex/caixa-ux-automacoes` criada sobre
  `origin/main` `661c575619cfa53356406e5fbe15c71ca341be2d`; checkout limpo. A CI
  push/main `40436653510` estava em execução no início da demanda.
- Health público observado em `2026-10-27T02:19:47.032Z`: HTTP 200,
  `status=ok`, versão publicada
  `9cf72dafb273693f412143abc337eefd0ed80f4e`. A produção contém a entrega
  anterior do CAIXA, mas ainda não contém esta nova automação.
- `knowledge:context` e `knowledge:search` foram tentados e permanecem
  bloqueados por `Documento excede o limite de exportacao.`. A indisponibilidade
  não autoriza inferir limites ou taxas; regras financeiras serão confrontadas
  no código e em fontes oficiais antes da implementação.

### CAIXA — automações implementadas e validação pré-publicação

- A tela aplica e exibe automaticamente o comprometimento indicativo de 30% da
  renda e o limite municipal por cidade/UF. Foram importados os 5.571 registros
  da planilha oficial `TABELA_MUNICIPIOS_VIGENCIA_01JAN2026.xlsx`; uma comparação
  independente encontrou zero divergências, incluindo seis aliases históricos
  de nomes. A planilha é usada somente para o limite geográfico, pois seus
  títulos de faixas de renda estão defasados das regras publicadas em 2026.
- `Imóvel na planta = Sim` fixa `Novo` e desabilita a condição; `Não` limpa o
  valor, habilita a escolha e exige `Novo` ou `Usado`. O prazo solicitado é
  reduzido automaticamente ao máximo permitido pela idade em meses-calendário,
  preservando prazos menores escolhidos pelo usuário.
- A calculadora pública CAIXA v1.16.0.2 foi confrontada com dados fictícios, sem
  CPF, telefone, consentimento ou OTP. Renda de R$ 4.000, imóvel de R$ 276.000 e
  nascimento em 22/01/1987 produziram Price, 420 meses, primeira prestação de
  R$ 1.200 e 8,47% efetivos; com nascimento em 22/01/1955, o prazo caiu para
  105 meses. O motor local reproduz 8,4722% efetivos a partir de 8,16% nominal
  e identifica que a taxa da Faixa 3 foi aplicada pelo valor do imóvel.
- Cotas preservadas: SBPE usa 90% no SAC e 80% no Price. Classe Média com imóvel
  usado no Sul/Sudeste usa 60%. Subsídio incompatível é limpo e ocultado nesse
  enquadramento; o limite municipal não é mostrado como teto do SBPE.
- Validação local em Node 24.19.0/pnpm 11.20.0: lint sem erros e com 44 warnings
  preexistentes em arquivos públicos fora do escopo, typecheck, catálogo de 41
  páginas e build aprovados. Testes focados aprovaram 54 casos; a jornada de
  navegador aprovou 6/6 cenários nos três temas, larguras desktop/tablet/celular,
  Axe e overflow. A matriz Vitest integral com um worker aprovou 4.369 testes e
  pulou 112; seis timeouts do comando paralelo foram repetidos isoladamente e
  aprovaram 59/59.
- O `pnpm test` e o `pnpm test:release` no Windows também alcançaram falhas fora
  deste escopo em fixtures de host Meta Ads (`Missing synthetic file`) e testes
  de permissões/monitor do ambiente. Nenhum arquivo Meta Ads ou de release foi
  alterado para contornar essas falhas. A CI Linux no SHA exato permanece gate
  obrigatório antes de merge e publicação.
- Revisão independente não encontrou achados remanescentes no escopo CAIXA.
  Nenhuma migration, dado remoto, DNS, cobrança, conta ou workflow n8n foi
  alterado. Estado neste registro: implementado e validado localmente no escopo;
  PR, CI, merge e publicação ainda pendentes e serão registrados separadamente.
- O primeiro candidato visual do PR #368 falhou porque o E2E protegido ainda
  tentava editar `Condição do imóvel` depois de a nova regra tê-la preenchido
  como `Novo` e desabilitado para imóvel na planta. O teste foi alinhado para
  conferir o valor e o estado travado; nenhuma regra financeira foi relaxada.
- O segundo candidato protegido aprovou o E2E e a comparação cromática/estrutural
  com o canvas externo. A única reprovação foi a altura de 1.204 px diante do
  teto histórico de 1.200 px da rota, após incluir as orientações automáticas.
  O teto exclusivo foi ajustado para 1.220 px; referência, tolerâncias de cor e
  bordas, baseline, Axe, overflow e demais rotas permanecem inalterados.
- O PR #368 foi integrado em `main` como
  `04300be6bb54561b8ab4785dab197f3822010140`. Na CI de `main`
  `40457067981`, `validate`, `isolated-restore`, a imagem promovível e todos os
  testes funcionais do `release-gates` passaram. A matriz visual reprovou
  exclusivamente onze comparações da rota CAIXA por mudança de altura: as
  referências ainda representavam a tela anterior, sem os dois cartões
  automáticos. Não houve falha funcional, Axe, teclado, zoom, overflow ou do
  canvas externo.
- As onze capturas sintéticas do artefato `12714049954`, digest
  `7445ed01d68d655405e1c25ace6468ec76b58a9b5e058b6591dc49d0aa23c922`,
  foram revisadas em desktop, notebook, tablet e celular, nos temas claro,
  médio e escuro. Somente essas imagens e suas 38 entradas de evidência foram
  adotadas; as outras 231 referências e todos os limiares foram preservados.
  O Docker/Podman está indisponível neste host, portanto a nova comprovação
  integral depende da CI Linux em modo de verificação. Produção permanece
  bloqueada até esse gate concluir com sucesso.
- Na branch da baseline, 69 testes focados passaram e 5 foram ignorados por
  condição; lint, typecheck, formatação e build de 41 páginas/71 saídas
  estáticas passaram. O `pnpm test` confirmou 4.369 testes Vitest e 1.599
  testes Node, mas encerrou com as mesmas três falhas de host Windows dos
  fixtures Meta Ads (arquivo privado/perfil absoluto), fora do escopo. A CI
  Linux continua sendo a evidência conclusiva desses testes.
