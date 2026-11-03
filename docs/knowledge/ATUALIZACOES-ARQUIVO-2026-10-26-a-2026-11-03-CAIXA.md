# Histórico integral do Simulador CAIXA — 26/10 a 03/11/2026

Registros movidos de ATUALIZACOES.md sem resumir ou alterar o conteúdo.

## 2026-11-02 — Correção autorizada do deploy documental e publicação CAIXA

- Pedido explícito: corrigir a incompatibilidade e publicar a CAIXA, sem alterar
  outras páginas. Base main8697ade2; CAIXA a93d65b2 com quatro gates aprovados
  no run41523108306. CI documental41527166188 ignora três jobs e não é aprovação
  para runtime. Produção2556898d saudável; versão será reconferida na promoção.
- Solução: execução manual completa somente sobre main exata, com os mesmos
  quatro gates e imagem própria. Sem herdar aprovação, aceitar SHA antigo,
  enfraquecer CAS/locks ou transformar jobs ignorados em aprovação.
- Validação focada Node24.19/pnpm11.20: 65 testes de política/motor de deploy
  e 41 testes do contrato de CI/release aprovados. A classificação documental
  segue recusando workflow_dispatch, que executa o caminho completo.

## 2026-11-02 — CAIXA: sidebar retrátil e parcelas

- Escopo: somente `/app/simulacao/caixa`, sidebar responsiva baseada em
  Agendamentos, fundo pelos tokens do sistema e consulta mensal em diálogo.
- Base `b93d3904`; health público HTTP 200/status ok, versão
  `aa28d38e99ec5bf835e5fbde3da3520874c002ec`. Estados local e publicado distintos.
- Checkout isolado para preservar AGENTS.md e tmp/ preexistentes. O runtime
  atual sincronizou o conhecimento com sucesso neste checkout.
- Implementados menu retrátil, superfície por tema e diálogo de parcelas com
  fechamento por Escape e retorno de foco. Projeção SAC/Price mantém seguros
  e taxa constantes e informa ausência de TR futura.
- Validação local Node 24.19/pnpm 11.20: 64 testes aprovados, incluindo sete
  jornadas sintéticas no Chromium, três temas, celular, desktop, overflow e
  Axe. Tipos, ESLint focado, Prettier e diff-check aprovados. CI e promoção
  do candidato ainda pendentes; nenhum dado remoto foi alterado.
- CI `41509952787`: testes funcionais e três gates aprovados; único bloqueio
  visual em 11 capturas CAIXA. Artefato `13174094179`, digest
  `73c090556d2fe6e36677e8fbf70f6e4847164e2b112401edee1125a43832d249`;
  referências revisadas com demais imagens e limiares preservados. Teste do
  manifesto: 15 aprovados e 1 condicional. Candidato reconciliado exige nova CI.

- Abertura das melhorias de leitura: [registro](ATUALIZACOES-ARQUIVO-2026-11-02-a-2026-11-02-AGENDAMENTOS-LEITURA.md).

## 2026-10-28: redesenho exclusivo do Simulador CAIXA implementado

- A interface de `/app/simulacao/caixa` foi reorganizada em um workspace
  compacto com sidebar local de seis atalhos, formulário alinhado, ação Limpar
  no topo e Documentos, Diagnóstico e Utilitários no final. O breadcrumb usa
  `Simulador CAIXA` e os textos redundantes solicitados foram removidos.
- O desenho reutiliza a linguagem visual azul/ciano/lima do simulador
  associativo e mantém respostas específicas nos temas claro, equilibrado e
  escuro, incluindo composição móvel em duas colunas para a sidebar.
- O motor financeiro, os dados oficiais, o recálculo automático, subsídio,
  prazo por idade e cotas SBPE permaneceram sem mudança. A validação sintética
  aprovou 6 jornadas no navegador e 24 verificações estáticas focadas, com
  desktop, celular, três temas, ausência de overflow e Axe sem violações.
- O candidato autenticado do PR #414 aprovou a jornada completa e produziu o
  artefato visual `12847234187`
  (`sha256:bc8775b706f2ccdf893f3cad6491db64159168be289aefcf1c321baba118bc7a`).
  A revisão adotou somente as 11 referências da rota CAIXA e o manifesto do
  ensaio; nenhuma imagem de outra página foi substituída.
- O PR #414 foi integrado como `47b5aa7c506f6d47ec82b52f6789bd795d3f042c`.
  Antes da promoção, o `main` avançou por uma entrega concorrente de Links
  Úteis; o coordenador recusou corretamente o SHA anterior sem iniciar troca ou
  deixar pendência. A página CAIXA permaneceu inalterada no novo `main`.
- A CI `40779936302` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image` no SHA integrado
  `0bf319c41e79cd9f0a1791f0be9e9816e94db4b9`. O artefato imutável
  `12857790263` teve digest
  `sha256:ac7464117ec93485e54d1032b3414f04fbc02f7ab5c9192244ffb8007f5c2b09`
  e `image.tar.gz` conferido como
  `ff6c784e05a6d399efc3eb30cc6447adaefa96de05872ce9259d286d91d3aa46`.
- A configuração da CI
  `sha256:e2eb43341cdcdfa9557c1a1dea254cf2c456f882394a3999697bff41943aa2fd`
  e o manifesto local
  `sha256:5aefe619573f19f70d5d5006e07d6418ec2e328e6ff73e2d500f6014153b2f07`
  foram conciliados por revisão, plataforma `linux/amd64`, onze camadas e
  `image:prove` nos dois perfis, sem rebuild ou retag.
- Publicação executada exclusivamente por `release:production`, com baseline
  `2699f4641c69fbac6b94c3b6ab7bdb5dc17874a9`, backup privado verificado,
  consulta no próprio minuto, CI/main exatos e CAS. Resultado: deployment
  `a5250ca6-2d3b-43b4-8098-bbe14a5904d7`, SHA e imagem candidatos,
  `deployedAt=2026-10-28T23:40:57.401Z` e `pendingDeploymentId=null`.
- Pós-publicação em `2026-10-28T23:41:16.791Z`: health público HTTP 200,
  `status=ok` e versão exata; acesso anônimo a `/app/simulacao/caixa` respondeu
  307 para `/login`. A sincronização do Obsidian ainda está indisponível pelo
  erro `Documento excede o limite de exportacao.`.

## 2026-10-28: abertura do redesenho exclusivo do Simulador CAIXA

- Escopo autorizado somente para `/app/simulacao/caixa`: novo desenho compacto,
  sidebar local com seis atalhos, acao Limpar no topo e ferramentas secundarias
  ao final da pagina. Regras financeiras, outras rotas e componentes globais
  permanecem fora do escopo.
- Estado consultado em 2026-10-28: `origin/main` no SHA
  `2699f464`, com alteracoes concorrentes somente de Meta Ads desde a ultima
  entrega CAIXA. O health publico respondeu HTTP 200, `status=ok` e versao
  `d12b20bda7e1e0cdd5a7e93bf48ffbb323190242`.
- A CI de `main` `40727474933` tinha `validate`, `isolated-restore` e
  `promotable-image` aprovados; `release-gates` ainda estava em execucao na
  consulta. O PR documental #413 de Agendamentos estava aberto e nao amplia o
  escopo desta demanda.
- O runtime oficial de conhecimento, inclusive com Node 24.19.0, retornou
  `Documento excede o limite de exportacao.` em `context`, `search` e no hook
  de troca de branch. A sincronizacao do Obsidian permanece indisponivel; o
  registro versionado segue como fonte local sem alegar sincronizacao concluida.

## 2026-10-28: Simulador CAIXA compacto publicado

- Escopo concluído somente em `/app/simulacao/caixa`: interface compacta,
  limites junto aos campos de renda e imóvel, condições guiadas, parâmetros e
  juros de obra recolhidos e resultado recalculado automaticamente. As fórmulas
  financeiras permaneceram inalteradas.
- Integração: PR #399 no SHA `cee003158d4e834b54009eaa128b77046fa0b523`;
  as referências visuais deliberadamente compactadas foram atualizadas pelo
  PR #409 no SHA final `d6bc4e7f0c125fd639adf7a8fa1f773744693f1f`.
- Evidências: 61 testes focados aprovaram motor, recálculo, cenários salvos,
  documentos, prazo, subsídio, SBPE, temas, mobile, overflow e Axe. A CI de
  `main` `40660625679` aprovou `validate`, `release-gates`,
  `isolated-restore` e `promotable-image` no SHA final.
- Publicação protegida: deployment `dc8cc769-b57a-4ce2-84b4-88cc9447559a`,
  imagem local provada
  `sha256:b97e6429e38a2d3efdefb1b76d3a79c4b5cb8515651b769a1454c3a98d673374`
  e conclusão em `2026-10-28T10:03:22.963Z` (`07:03:22.963` em
  America/Sao_Paulo). A consulta CAS posterior retornou `noop`, confirmando que
  o candidato já estava ativo sem reinício duplicado.
- Verificação pós-publicação: `/api/health` respondeu `status=ok` e versão
  exata `d6bc4e7f0c125fd639adf7a8fa1f773744693f1f`; acesso anônimo a
  `/app/simulacao/caixa` respondeu 307 para `/login`.
- Conhecimento: o runtime de sincronização continuou retornando o erro
  `Documento excede o limite de exportacao.`; a falha permanece registrada e não foi
  apresentada como sincronização concluída.

## 2026-10-28: abertura da compactação do Simulador CAIXA

- Escopo exclusivo: interface e recálculo automático de
  `/app/simulacao/caixa`, usando o fluxo linear associativo e Agendamentos
  somente como referências visuais; nenhuma outra página será alterada.
- Estado observado às `2026-10-28T05:07:18Z`: `origin/main` em
  `55175aeb5fe730f33fbd7ee5f2877fb6545f9004`; health público HTTP 200,
  `status=ok` e versão de runtime
  `33899a898b4746ea1bd6fd62cb1250bd45d53845`. A divergência é documental:
  `main` avançou após o deploy sem mudança de runtime.
- Conhecimento: `context` e `search` permaneceram indisponíveis com
  `Documento excede o limite de exportacao.`; o código atual e as evidências
  observacionais serão as fontes desta entrega.

### Implementação e validação local

- Interface compactada somente em `/app/simulacao/caixa`: etapas internas e
  cartões automáticos removidos, limites aproximados dos campos de origem,
  condições financeiras condensadas e alertas extensos retirados da tela.
- Cálculo convertido para derivação automática e síncrona dos dados atuais; o
  botão manual e o resultado obsoleto foram eliminados. Parâmetros confirmados e
  juros de obra permanecem recolhidos. Nenhuma fórmula financeira foi alterada.
- Node 24.19.0 e pnpm 11.20.0: typecheck aprovado; 61 testes de cliente e motor
  aprovados, incluindo três temas, desktop/celular, Axe, overflow, prazo, subsídio
  e cotas SBPE. Gates integrais e publicação ainda dependem do SHA candidato.

## 2026-10-28: subsídio automático do Simulador CAIXA publicado

- Integração: PR #394 incorporado ao `main` no SHA
  `33899a898b4746ea1bd6fd62cb1250bd45d53845`. A CI de push
  `40623210294` aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; o candidato visual protegido `40618704482` também foi
  aprovado.
- Artefato: `promotable-image-33899a898b4746ea1bd6fd62cb1250bd45d53845`,
  ID `12788955332`. O `image.tar.gz` conferiu com SHA-256
  `7e4fb50a3305ae1a676ee9d5f12797f3f0192d8795c36cc74fb94f9910abf76b` e
  revisão OCI exata. A configuração da CI foi
  `sha256:d784b2b17d3b424c2bcfecada39a66db76263d40fd0fb2603e513d9e5fede20d`;
  o manifesto local comprovado foi
  `sha256:4a576e060552306644b79cfa3c37a558c3c503c7ec679c6ba4ad08ffd9c52947`.
  `image:prove` aprovou os dois perfis de runtime, a mesma imagem e nenhuma
  impressão de segredo, sem rebuild ou retag.
- Publicação: o coordenador exclusivo `release:production deploy` promoveu o
  deployment `6d4758f0-7e8c-443c-910a-70e304eaa207` em
  `2026-10-28T03:50:23.707Z` (`00:50:23` BRT), partindo do deployment
  `08d382ff-e15a-4851-b8b0-b68b54c1e18f`/SHA `f98f3c73`, com travas, CAS e
  consulta ao vivo. O recibo final ficou sem pendência.
- Pós-publicação: `https://crm.descomplicapro.com.br/api/health` respondeu
  HTTP 200, `status=ok` e versão exata `33899a89`; a rota anônima
  `/app/simulacao/caixa` respondeu 307 para `/login`.
- Conhecimento: o registro versionado foi atualizado, mas o runtime de sync
  permaneceu indisponível com `Documento excede o limite de exportacao.`; a
  sincronização do Obsidian não foi alegada como concluída.

## 2026-10-27: subsídio automático do Simulador CAIXA

- Abertura: `origin/main` e o checkout estavam em
  `de2be3c6c03e9d0cd58ed209a40b1b5bea41e985`; o health público respondeu HTTP
  200, `status=ok` e versão
  `f98f3c7310f773a36325bb6114ebd12369e9e077`. A consulta foi observacional e
  não acessou dados autenticados.
- Causa: o motor classificava renda até R$ 4 mil como elegível, mas atribuía
  `confirmedSubsidy ?? 0`; portanto nenhum valor automático participava da
  composição financeira.
- Implementação: fórmula literal do MFOM Habitação v034, pp. 131–133, com
  `FDr` do Anexo III, `Fpop` do Anexo IV cruzado com REGIC 2018 e população
  IBGE 2026, `FDfin`, `FUH`, tetos e redutores. Tipo/área da unidade e
  dependentes são solicitados somente no cenário elegível. O valor confirmado
  manualmente continua prevalecendo.
- Cobertura territorial: 5.570 dos 5.571 municípios têm fator automático. Boa
  Esperança do Norte/MT permanece sem `Fpop`, pois é posterior à REGIC 2018;
  não foi criado fallback presumido.
- Evidência focada: 61 testes financeiros/visuais passaram, incluindo o caso
  São Paulo, renda R$ 4.000, imóvel R$ 275 mil, apartamento de 50 m² e família
  não unipessoal, cujo resultado indicativo é R$ 3.638,05. A matriz sintética
  passou em desktop/celular, três temas, Axe e ausência de overflow. Lint sem
  erros, tipos e build passaram com Node 24.19.0.
- Gate externo: a suíte Vitest integral aprovou 4.440 testes e pulou 112. O
  bloco Node/release no Windows manteve falhas fora do escopo em fixtures e
  permissões privadas de Meta Ads (`Missing synthetic file` e ACL/diretório),
  sem relação com o Simulador CAIXA; nenhuma área externa foi alterada.
- Conhecimento: `knowledge:sync` permaneceu indisponível com `Documento excede
o limite de exportacao.`. O registro versionado foi atualizado; a
  sincronização do Obsidian não foi alegada como concluída.

## 2026-10-27: Simulador CAIXA publicado no SHA f98f3c73

- Integração: PR #389, commit final de `main`
  `f98f3c7310f773a36325bb6114ebd12369e9e077`. A CI de push `40600846185`
  aprovou `validate`, `isolated-restore`, `promotable-image` e `release-gates`.
  O gate funcional do CAIXA, migrations, restore lógico, pgTAP, build, E2E,
  acessibilidade, teclado, temas e matriz responsiva passaram.
- Artefato: `promotable-image-f98f3c73`, ID `12777624788`, ZIP
  `sha256:983d9e567b574b8dbdadcdb6fa2624a59517f41a28eb80973eefbac45aaeff45`
  e `image.tar.gz`
  `sha256:14a34dd67df547773b3a5b1e051c078121675a0ae454b35948f67458a1285953`.
  A diferença entre config CI `sha256:c3c4da1c2f4ce21355d1bea0bcb4c8417e00d8eb9f08852dce9025d990155c13`
  e manifesto containerd `sha256:3dec01b76ff1c97375c73461cb649da86c8e946087f26cf0f87a88a5380aa3c9`
  foi comprovada no mesmo artefato: índice, manifesto, config, Linux/amd64,
  revisão OCI, 11 camadas, `rootfs.diff_ids` e os dois perfis de runtime
  coincidiram, sem rebuild ou retag.
- Concorrência preservada: antes da troca, o coordenador observou a produção
  ativa `a63dfc01b81cfb0476f2f3f5e19cf209b690e998`, deployment
  `42fd5f68-d360-4086-8418-05554a210e20`, publicado em
  `2026-10-27T23:12:22.622Z`. O CAS usou essa baseline real; nenhum estado
  anterior foi presumido.
- Publicação: deployment `08d382ff-e15a-4851-b8b0-b68b54c1e18f`, concluído em
  `2026-10-28T00:18:07.167Z`, sem pendência. O health público retornou HTTP 200,
  `status=ok` e o SHA exato `f98f3c73`; o container ficou saudável e a rota
  anônima `/app/simulacao/caixa` respondeu 307 para `/login`.
- Conhecimento: o runtime continuou falhando com
  `Documento excede o limite de exportacao.`; o registro versionado foi
  concluído, mas a sincronização do Obsidian permanece pendente e não foi
  alegada como bem-sucedida.

## 2026-10-27: retomada autorizada da publicação do Simulador CAIXA

- Fonte observacional de abertura: `origin/main` em
  `c5e4f69d0242e581d86e73f8be49212676473b6b` após `git fetch origin`; health
  público `https://crm.descomplicapro.com.br/api/health` retornou HTTP 200,
  `status=ok` e `version=bb56fd7b23e872c69e3c5dac144afb30e4397cc4`.
- O Simulador CAIXA estava integrado, mas ainda não publicado. O usuário
  autorizou explicitamente corrigir o bloqueio externo e publicar sem ampliar
  a mudança além dos contratos de teste de Links Úteis.
- A correção alinha três testes pgTAP ao catálogo já versionado pela migration:
  49 páginas, 74 permissões CRM/páginas, 82 defaults administrativos e as oito
  permissões de Links Úteis herdadas pelos papéis que já possuíam Dashboard.
  Migration, runtime e regras financeiras do CAIXA não foram alterados.
- `knowledge:context` e `knowledge:search` foram tentados pelo runtime instalado
  e falharam com `Documento excede o limite de exportacao.`; nenhuma atualização
  do Obsidian foi alegada.

## 2026-10-27: revisão das referências do Dashboard para liberar o CAIXA

- Após autorização explícita do usuário para remover o bloqueio e concluir a
  publicação, foram revisadas as 11 imagens da rota `/app` reprovadas na CI
  `40555682643`. A fonte foi o artefato diagnóstico `12762530739`, com ZIP
  verificado em
  `sha256:0a1140cb6d320c57336d5cff93ba879b7ea446431da0a7a2e78445185e5322ec`.
- A inspeção visual cobriu desktop, notebook, tablet, celular e os temas claro,
  médio e escuro. Canvas, ações, cartões e funis permaneceram legíveis, sem
  corte, sobreposição ou rolagem horizontal. A variação de data e valores é
  compatível com os fixtures sintéticos dependentes do dia da captura.
- Foram promovidas somente 11 imagens e seus registros. As outras 231 capturas,
  o código funcional, o limite de 1% e a tolerância de 16 níveis por canal não
  foram alterados. O manifesto passou a
  `43aa7d39d536e2532e3e4db4223ca2900d3ed219bc3d9a4599f13c160c228046`.
- Esta revisão remove o único bloqueio conhecido da execução anterior, mas não
  comprova publicação. O SHA final ainda deve obter os quatro jobs verdes da CI,
  gerar artefato imutável homologado e passar pelo coordenador protegido de
  produção antes de o health público poder ser registrado como atualizado.

## 2026-10-27: CAIXA integrado; publicacao bloqueada por gate externo

- O PR #373 foi integrado como
  `a0b4a38125a5ac38991ca7f3368bd6b9ce336648`. Depois do pedido explicito de
  publicacao, o primeiro candidato `075df4db` falhou duas vezes porque a acao
  oculta `Excluir Media do ano` do Dashboard interceptava o controle de
  historico. A correcao concorrente entrou no `main` como `6955a6c8`, que passou
  a ser o candidato exato da publicacao.
- A CI de `push/main` `40555682643` aprovou `validate`, `promotable-image` e
  `isolated-restore`. Dentro de `release-gates`, passaram CAIXA, Dashboard,
  Associativo, banco, autorizacao, build, E2E, acessibilidade, teclado e zoom.
  O job `122373158107` falhou somente na comparacao protegida de 11 imagens da
  rota `/app` em viewports e temas do Dashboard: todas registraram drift de 2%,
  acima do limite imutavel de 1%.
- Pela regra maxima de escopo, as referencias visuais do Dashboard nao foram
  aprovadas nem alteradas neste chat. O artefato diagnostico `12762530739`
  confirmou zero falhas de rota, tema, acessibilidade e canvas; somente as 11
  comparacoes de baseline ficaram reprovadas.
- O artefato promovivel `12757242651` foi baixado e conferido: digest do ZIP
  `sha256:613d0621ff1c6a908334e6e76cb81117e3e0427b02b19e124d61ca2fc5556e12`,
  SHA-256 interno `b129ab2248c6abda8c3bfe19a02f86b6f69bc6bd66b9c32db87bcf65eaaa4f70`
  e image ID esperado
  `sha256:5b4a0aa12e1e589899ec89de877c43ab0ff9c95f752c05320cd092213bc2714b`.
  A transferencia para diretorio isolado da VPS preservou o checksum; a imagem
  nao foi carregada nem ativada.
- A publicacao nao foi tentada porque o coordenador exige os quatro jobs verdes.
  A correcao CAIXA permanece integrada no Git, mas esta revisao ainda nao esta
  comprovadamente publicada. Reavaliar quando as 11 referencias do Dashboard
  forem revisadas em escopo proprio e um novo `main` exato tiver CI integral.
- Conferencia final em `2026-10-27T18:57:21.7231154Z`: health publico HTTP 200,
  `status=ok`, versao `bb56fd7b23e872c69e3c5dac144afb30e4397cc4`. O registro do
  coordenador permaneceu no deployment `4d1479e7-e087-499e-92f8-d6aee906bf74`,
  publicado em `2026-10-27T15:21:08.364Z`, sem deployment pendente. Portanto
  nao houve mutacao de producao nesta tentativa.
- Validacao documental local com Node 24.19.0/pnpm 11.20.0: lint sem erros e
  com 44 avisos preexistentes, typecheck e build de 41 paginas/71 saidas
  aprovados; Vitest aprovou 4.373 testes e ignorou 112. O comando integral de
  testes parou depois em tres casos operacionais Meta Ads dependentes de modos
  POSIX no host Windows; a CI Linux `40555682643` aprovou o job `validate` do
  mesmo SHA. Essa limitacao local nao substitui nem corrige o bloqueio real do
  `release-gates` descrito acima.
- O sync do Obsidian continuou impedido por `Documento excede o limite de
exportacao.`; os documentos versionados permanecem a fonte registrada.

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

## 2026-11-02 — Encerramento CAIXA: publicação comprovada

- Escopo: somente CAIXA (PR470) e correção autorizada do protocolo (PR475).
  Fontes: GitHub/main6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573,
  CI41561175667 (quatro jobs aprovados), ledger privado lido via SSH e
  GEThttps://crm.descomplicapro.com.br/api/health em2026-11-03T02:43:46Z:
  HTTP200, statusok, versão6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573.
- Deploymentf854e369-d792-45e4-9ff8-504e75651453,
  publicado em2026-11-03T02:41:32.581Z; sem operação pendente. Publicação
  concorrente já ativa reconhecida; nenhuma repetição nem migration por este chat.
- Chrome real na rota CAIXA: menu expande/recolhe, resultado automático para
  renda fictícia6000/imóvel300000/nascimento1991-03-15/São Paulo;
  PRICE420 meses, primeira prestação1800,420 linhas, saldo final0.
  Escape fecha e retorna foco ao botão; Limpar limpa os dados fictícios.
- Evidência local: caixa-publicado-parcelas.png no diretório de visualizações
  desta sessão. Testes focados e matriz visual prévios reutilizados; nenhum
  teste financeiro integral contra CAIXA foi alegado nesta entrega de interface.
- Sync do conhecimento impedido por documento acima do limite de exportação.
  Exceção restrita ao registro no Obsidian; reavaliar quando a infraestrutura
  permitir exportar. Não corrigir infraestrutura ou outras páginas neste chat.

## 2026-11-03 — Abertura: ajustes visuais exclusivos da CAIXA

- Git comum confirmado; branch codex/caixa-sidebar-hover, base main38bec742,
  checkout limpo. GitHub CI41569465098 aprovada; health público HTTP200/ok
  com produção6a0b1df5. Fontes consultadas em03/11/2026; versões distintas.
- Pedido: sidebar rente à esquerda e altura da tela, hover como Agendamentos,
  conteúdo expansivo sem reorganizar linhas durante hover, título ao lado,
  formulário compacto com campos transparentes, modal central e impressão.
  Referências Agendamentos/Associativo somente leitura; motor preservado.
- Context/search indisponíveis por limite de exportação do conhecimento;
  referências versionadas consultadas. Sync será tentado, sem ampliar escopo
  para corrigir a infraestrutura de conhecimento.

## 2026-11-03 — CAIXA: sidebar e parcelas publicados e validados

- PR #478 integrado em82ee8deb38b5c86f9781504f60c673ee69d9ab44. CI de
  main41654312258 com validate, release-gates, isolated-restore e
  promotable-image aprovados; CI do PR41647692259 também aprovada.
- DEPLOY-002: diff produção→candidato inclui entregas concorrentes de Equipe
  Produtiva e Agendamentos, preservadas sem edição por este chat. Evidências
  anteriores reutilizadas e CI obrigatória executada no candidato integrado.
  Janela de publicação coordenada com autorização explícita do usuário.
- Artefato13239149238; ZIP SHA-256
  fd45461f8d1006338f106535a9d07f0a962303eacb3281b0df2424aee870f492.
  Config da CI b36be44c5c960fcd44868253054308c8f0094954407fabc1b0314520736b1614
  e manifesto local4aaa101b9e02da54ea2435095ce4a82543842d9396be3a1ea51be4b3ab5d3b0b
  conciliados pelo mesmo arquivo, hashes/tamanhos dos blobs e14 camadas,
  linux/amd64 e rootfs. image:prove confirmou os dois perfis; sem rebuild na VPS.
- Backup privado conferido em/var/backups/descomplica-crm/caixa-hover-82ee8deb.
  Coordenador release:production publicou com lock, CAS e consulta ao vivo:
  deployment1d4c8ac7-f800-4513-ac2b-48ba4fd192a2,03/11/2026
  15:35:48.568UTC (12:35:48.568America/Sao_Paulo), sem pendência.
- Health público03/11/2026 15:39:27UTC: HTTP200/ok, versão82ee8deb;
  acesso anônimo à CAIXA redireciona/login307. Chrome autenticado: sidebar
  rente à esquerda, top58 no fim do header e altura até o fim da tela;
  hover44→208→44 sem overflow. Fundo#061f35, fonte Geist e campos transparentes.
- Cenário fictício: renda6000, imóvel300000, São Paulo/SP, nascimento1991-03-15;
  cálculo automático PRICE420, primeira prestação1800. Modal central no viewport
  desktop e390x844,420 linhas, saldo final zero, botão Imprimir habilitado;
  Escape devolve foco e Limpar remove o cenário. Impressão integral verificada
  pela suíte isolada, sem imprimir fisicamente em produção. Motor preservado.
- Evidências locais nesta sessão: caixa-sidebar-hover-publicado.png,
  caixa-parcelas-centralizadas-publicado.png e caixa-parcelas-mobile-publicado.png.
  Capturas após redimensionamento foram conferidas novamente após o layout
  estabilizar; falha transitória de captura CDP não alterou código ou dados.
- Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/478
  e actions/runs/41654312258, health público e inspeção visual da rota solicitada.
  Registro final somente documental; não exige reinício nem nova publicação da aplicação.
- Sync final tentou exportar o registro e falhou: documento excede o limite de
  exportação. Obsidian permanece pendente para esta nota; o sync anterior ao
  registro havia passado. Exceção somente de conhecimento, sem efeito no deploy;
  reavaliar após ajuste da infraestrutura em demanda própria.
