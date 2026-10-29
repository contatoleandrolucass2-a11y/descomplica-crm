# Aprendizados e atualizacoes

## 2026-10-28: sincronização do Obsidian destravada por particionamento

- Causa confirmada: `ATUALIZACOES.md` chegou a 374.125 bytes, acima do limite
  deliberado de 256.000 bytes por documento do exportador. Por isso `context`,
  `search`, `sync` e os hooks recusavam a leitura antes de acessar o vault.
- O histórico foi particionado sem exclusão ou resumo: a nota corrente ficou
  com cerca de 201 KB e a continuação com cerca de 173 KB, ambas abaixo do
  limite. O arquivo histórico anterior também foi preservado integralmente.
- O runtime passou a exportar e pesquisar somente arquivos históricos curados
  que obedecem ao padrão versionado `ATUALIZACOES-ARQUIVO-*.md`. Cada partição
  mantém a validação de tamanho, credenciais, integridade, geração e origem.
- O limite não foi ampliado. Novos particionamentos devem ocorrer antes de a
  nota corrente alcançar 256.000 bytes, preservando o conteúdo integral.
- Validação com Node 24.19.0: 24 testes focados, ESLint, TypeScript, Prettier e
  `diff --check` aprovaram. `context`, `search` e `sync` concluíram com código
  zero; o sync gravou cinco documentos curados no worktree do vault.
- O runtime compartilhado e os quatro hooks gerenciados foram reinstalados. A
  repetição pelo runtime instalado retornou `unchanged`, e uma busca por
  `QIX mapping dinamico` recuperou resultados diretamente da nova partição.

## 2026-10-28: ícones personalizados na sidebar de Links Úteis

- O ajuste foi limitado à sidebar interna de Links Úteis. Cada um dos oito
  destinos recebeu um ícone semântico próprio: visão geral, WhatsApp, lojas,
  relacionamento, regras comerciais, campanha, Bora Vender e recursos.
- O componente compartilhado de ícones da navegação global não foi alterado;
  rotas, permissões e conteúdos das páginas permanecem idênticos.
- Os ícones usam os tokens azul/ciano já existentes, com realce no item ativo,
  foco visível e respeito a movimento reduzido.
- A validação focada aprovou 52 testes de Links Úteis e navegação. ESLint,
  verificação de tipos e formatação dos arquivos alterados também aprovaram.
- O PR #415 foi integrado no SHA `0bf319c41e79cd9f0a1791f0be9e9816e94db4b9`.
  As CI de pull request `40773368337` e de `main` `40779936302` aprovaram
  `validate`, `release-gates`, `isolated-restore` e `promotable-image`.
- Produção registrou o deployment `a5250ca6-2d3b-43b4-8098-bbe14a5904d7`
  em 2026-10-28T23:40:57.401Z. O health público respondeu HTTP 200,
  `status=ok` e a versão exata do SHA integrado; acesso anônimo à rota
  permaneceu protegido por redirecionamento 307 para `/login`.
- A conferência autenticada no navegador mostrou os oito ícones semânticos
  distintos no menu publicado. O coordenador encerrou o comando de promoção
  com código 1 e mensagem genérica após gravar a release; a consulta imediata
  mostrou o candidato ativo e nenhuma pendência. Reavaliar essa exceção apenas
  se o comportamento se repetir em outra promoção, sem alterar o coordenador
  no escopo desta entrega.
- O runtime de conhecimento permaneceu indisponível na abertura pelo erro
  `Documento excede o limite de exportacao.`; este registro versionado não
  equivale a uma sincronização concluída do Obsidian.

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

## 2026-10-28: gates protegidos executados no PR

- A protecao exigia `release-gates`, `isolated-restore` e `promotable-image`, mas
  o workflow os marcava como `skipped` em pull requests. A condicao foi ampliada
  somente para aceitar PR ou `push/main`; os quatro jobs continuam obrigatorios
  e repetidos no SHA final integrado.
- O teste de contrato da CI passou a exigir as duas condicoes nos tres jobs. No
  SHA `0dbbffce9b0fdfdf21da07548244c26976072889`, os quatro checks foram
  aprovados, incluindo replay de migrations, pgTAP, E2E, acessibilidade,
  responsividade, temas, zoom, teclado, comparacao visual e imagem imutavel.
- Nenhum baseline, tolerancia, migration, ACL, RLS ou dado remoto foi alterado
  por esta correcao de fluxo.

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

## 2026-10-28: evolução editável de Links Úteis publicada

- O ajuste estritamente visual das 22 baselines externas foi integrado pelo PR
  #409 no `main` `d6bc4e7f0c125fd639adf7a8fa1f773744693f1f`, sem alteração funcional
  adicional em Dashboard ou Simulador CAIXA. A CI `40660625679` aprovou
  `validate`, `isolated-restore`, `promotable-image` e `release-gates`.
- Produção observada em `2026-10-28T11:43:01Z`: health HTTP 200,
  `status=ok` e versão exata
  `d6bc4e7f0c125fd639adf7a8fa1f773744693f1f`. As rotas anônimas
  `/app/links-uteis/grupos-whatsapp` e
  `/app/links-uteis/lojas-horarios` responderam 307 para `/login`.
- A migration versionada `useful_links_documents` foi aplicada ao Supabase de
  produção como `20261028114244`. A conferência posterior comprovou RLS e RLS
  forçada, policy restritiva de MFA, ausência de DML direto para `anon`,
  `authenticated` e `service_role`, e execução das RPCs somente por
  `authenticated`. A tabela iniciou sem documentos persistidos; o conteúdo
  versionado da aplicação permanece como fallback até o primeiro salvamento.
- Os advisors não apontaram acesso anônimo novo nos objetos de Links Úteis. O
  aviso informativo de índice ausente na FK `updated_by` não bloqueia o fluxo e
  não autoriza alteração adicional. Findings preexistentes de outras áreas
  ficaram fora deste escopo.
- Exceção operacional: `pnpm release:production status` no VPS parou no
  preflight por builds de dependências ignorados pelo pnpm. Nenhuma alteração
  foi feita no servidor; publicação e versão foram confirmadas pelo health e
  pela CI do SHA exato.
- Conhecimento: o runtime continua retornando
  `Documento excede o limite de exportacao.`; a sincronização do Obsidian
  permanece pendente e não foi alegada como concluída.

## 2026-10-28: Links Úteis integrado; publicação bloqueada por gate externo

- Estado integrado: a evolução editável de Links Úteis, o sidebar exclusivo da
  área e as correções da migration/fixture estão presentes no `main`
  `cee003158d4e834b54009eaa128b77046fa0b523`. Nenhuma correção desta demanda
  alterou Dashboard, Simulador CAIXA ou as baselines dessas páginas.
- Evidência de CI: o run `40652029100` aprovou `validate`,
  `isolated-restore` e `promotable-image`. O restore comprovou a migration
  limpa, o lint SQL e as 16 asserções pgTAP de Links Úteis.
- Bloqueio externo ao escopo: `release-gates` falhou somente no artefato visual
  autenticado `12802975980`. O manifesto registrou 22 comparações divergentes,
  todas restritas a `/app` e `/app/simulacao/caixa`, após a integração
  concorrente do PR #399. As 154 rotas, 88 temas e 242 auditorias de
  acessibilidade passaram; não houve falha atribuída a Links Úteis.
- Limite aplicado: pela regra máxima de escopo, as páginas e baselines externas
  não foram corrigidas neste chat. O deploy e a migration de produção não foram
  executados porque gate falho bloqueia publicação. Reavaliar somente após um
  novo SHA de `main` corrigir e aprovar o gate externo completo.
- Produção observada em `2026-10-28T08:37:52Z`: health HTTP 200, `status=ok` e
  versão `33899a898b4746ea1bd6fd62cb1250bd45d53845`; portanto a evolução
  editável de Links Úteis ainda não está publicada.
- Conhecimento: o runtime continua retornando
  `Documento excede o limite de exportacao.`; a sincronização do Obsidian
  permanece pendente e não foi alegada como concluída.

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

## 2026-10-28: abertura da evolução editável de Links Úteis

- Escopo solicitado: substituir a lista simples do menu por navegação lateral
  equivalente à página de Agendamentos; tornar Grupos WhatsApp um quadro com
  organograma e cards editáveis, movíveis e redimensionáveis; reorganizar Lojas
  Horários por loja com os dados fornecidos e aplicar o mesmo padrão às demais
  guias de Links Úteis.
- Estado observado às `2026-10-28T03:24:54Z`: Git comum confirmado; branch
  criada de `origin/main` `33899a898b4746ea1bd6fd62cb1250bd45d53845`.
  A CI de push `40623210294` desse SHA estava em andamento; a última CI completa
  conhecida, `40615788025`, aprovou o `main` anterior `de2be3c6`.
- Produção: `https://crm.descomplicapro.com.br/api/health` respondeu HTTP 200,
  `status=ok` e versão
  `f98f3c7310f773a36325bb6114ebd12369e9e077`. O runtime publicado, o `main`
  integrado e esta branch permanecem estados distintos.
- Conhecimento: `context` e `search` falharam com
  `Documento excede o limite de exportacao.`; a sincronização do Obsidian
  permanece pendente e nenhuma conclusão nova foi atribuída a essa fonte.
- Implementação candidata: a navegação lateral reutiliza o catálogo autorizado;
  todas as guias usam cards movíveis e redimensionáveis; Grupos WhatsApp inclui
  organograma vertical/lateral e quatro cards de apoio; Lojas Horários contém os
  oito agrupamentos por endereço solicitados. A edição compartilhada é restrita
  a `admin`/`master`, com revisão otimista, limite de corpo e validação duplicada
  na API e no banco.
- Persistência candidata: migration aditiva RPC-only, RLS forçada, MFA e grants
  mínimos. A restauração/pgTAP local não pôde iniciar porque o host não possui
  Docker nem Podman; essa evidência continua obrigatória na CI do SHA candidato.
- Evidência local: 90 testes funcionais focados e 26 testes do manifesto de
  release passaram; lint dos arquivos afetados, tipos, catálogo, inventário e
  build com Node 24.19.0 passaram. Neste ponto o estado é implementado e validado
  localmente; CI, integração e publicação ainda não foram alegadas.
- Correção de escopo antes da publicação: a tentativa de generalizar o shell
  compartilhado foi recusada porque tocava arquivos e referências do Dashboard.
  `DashboardShell`, navegação superior, CSS compartilhado, testes e as onze
  baselines foram restaurados integralmente. O sidebar passou a existir somente
  no layout de Links Úteis, com contrato automatizado que impede dependência
  dessa área nos três arquivos compartilhados. O SHA integrado `c48ccd55` não
  foi publicado; uma nova CI e nova integração são obrigatórias.
- Gate de banco do `main` corrigido: a restauração isolada `40637253409`
  interrompeu o novo pgTAP após 5 de 16 asserções porque a fixture inicializava
  o leitor como `master` e depois tentava convertê-lo para `broker_house` com
  escopos ativos incompatíveis. A correção mantém somente o editor como master
  e aprova explicitamente o perfil leitor; não altera migration, runtime, dados
  remotos ou qualquer página fora de Links Úteis. Nova CI integral é obrigatória.
- Segunda validação da fixture: a restauração isolada `40639421924` confirmou
  que um perfil aprovado `broker_house` exige escopo ativo compatível. O teste
  de Links Úteis passou a criar organização, equipe, pessoa e escopo sintéticos
  dentro da própria transação pgTAP. Não há alteração de migration, runtime ou
  dados remotos; uma nova CI integral permanece obrigatória.

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

## 2026-10-27: Links Úteis publicado e catálogo aplicado em produção

- Runtime: a versão publicada permaneceu em
  `f98f3c7310f773a36325bb6114ebd12369e9e077`, com HTTP 200 e `status=ok`
  em `https://crm.descomplicapro.com.br/api/health` às
  `2026-10-28T01:27:59Z`. A rota anônima `/app/links-uteis` respondeu 307 para
  `/login`, preservando o guard de acesso.
- Banco: a migration versionada `20261027160500_sync_page_catalog.sql` foi
  aplicada via Supabase MCP no projeto de produção `hnncxuerlcsaahdxoswb` e
  registrada remotamente como `20261028012746 sync_page_catalog`.
- Verificação remota: o catálogo retornou exatamente oito registros ativos e
  navegáveis — hub Links Úteis e sete subpáginas — com os caminhos e permissões
  esperados. Ranking Geral não integra esse grupo. As oito permissões têm nível
  mínimo 10 e sete concessões por papel, incluindo `master` e `admin`, conforme
  a herança inicial preservada de `crm.dashboard.view`.
- Integração e publicação: o código funcional já estava integrado pelo PR #376;
  os contratos pgTAP foram incorporados ao `main` em `f98f3c73`, cuja CI
  `40600846185` aprovou os quatro jobs e cujo deployment protegido
  `08d382ff-e15a-4851-b8b0-b68b54c1e18f` promoveu a imagem imutável
  `sha256:3dec01b76ff1c97375c73461cb649da86c8e946087f26cf0f87a88a5380aa3c9`.
- Limite conhecido: `knowledge:sync` continuou falhando com
  `Documento excede o limite de exportacao.`. O registro versionado foi
  atualizado, mas a sincronização do Obsidian permanece pendente e não foi
  alegada como concluída.

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

## 2026-10-27: editor administrativo de Agendamentos integrado; deploy bloqueado externamente

- Escopo concluido: os PRs #375, #378 e #381 integraram o editor administrativo
  exclusivo de `/app/etapas/agendamentos`, com ajuste persistente de largura,
  altura, conteudo, fonte, alinhamento, cores e escala das torres. Os controles
  inline ficam ocultos no uso comum, nao existe perfil de layout e somente o
  administrador pode editar a pagina.
- Validacao do escopo: lint sem erros (44 avisos preexistentes), typecheck,
  build de 41 paginas/71 saidas, matriz do Dashboard com 267 verificacoes e
  4.372 testes aprovados/112 ignorados. A CI dos PRs do editor foi aprovada.
- Estado final consultado em 27/10/2026: `main`
  `e8125eebec9c9fd7737f686e9b2822e7f568c9b4`, CI `40589040344`. Os jobs
  `validate` e `promotable-image` passaram, mas `isolated-restore`
  (`122490128029`) falhou porque a area Links Uteis manteve contratos pgTAP
  antigos: 82 permissoes atuais contra 74 esperadas, alem de contagens de
  paginas e defaults divergentes.
- O bloqueio pertence a outra pagina/funcionalidade. Pela regra maxima de
  escopo, nenhum teste, baseline, permissao ou codigo de Links Uteis foi
  alterado neste chat. O gate falho impede `release:production`; portanto a
  migration do editor e o runtime nao foram aplicados em producao.
- Health publico permaneceu HTTP 200, `status=ok`, versao
  `bb56fd7b23e872c69e3c5dac144afb30e4397cc4`. A sincronizacao com o Obsidian
  continua pendente porque o runtime retorna
  `Documento excede o limite de exportacao.`

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

## 2026-10-27: DEPLOY-002 — validação por impacto para todos os publicadores

- Por pedido direto do usuário, a regra antes registrada no cofre local passa
  a compor as instruções compartilhadas: AGENTS.md, o runbook
  `docs/runbooks/impact-based-validation.md`, os procedimentos de publicação
  e a skill de validação. Aplica-se a todos os desenvolvedores e agentes.
- Validar o diff completo entre produção e candidato e as jornadas afetadas;
  reutilizar evidências válidas e ampliar a revisão somente com justificativa.
  O escopo de análise não autoriza editar áreas fora do pedido do chat.
- Gates obrigatórios do SHA candidato, proteções de publicação e DEPLOY-001
  permanecem intactos. Documentação não exige deploy da aplicação. A integração
  no Git e a adoção por cada desenvolvedor são evidências distintas.
- Base documental consultada: main `73f0c359decf3d182c8bab0ef5dbe2d9df0459f0`.
  Esta entrega altera somente Markdown; não modifica workflows, runtime, banco
  ou produção. A validação local cobre diff, referências e formatação; os checks
  obrigatórios permanecem na CI do PR. Resultados remotos devem ser consultados
  no SHA correspondente, sem inferir aprovação a partir desta nota.

## 2026-10-27: preservacao visual da Visao Geral no editor de Agendamentos

- A CI de `main` `40555682643` aprovou banco, autorizacao, E2E, Dashboard e os
  demais jobs, mas bloqueou a publicacao por deriva visual exclusiva de `/app`:
  os 11 comparativos da Visao Geral excederam o limite de pixels porque o novo
  wrapper flexivel de apresentacao era aplicado tambem a cards sem configuracao.
- O wrapper e suas regras flexiveis agora sao condicionais a existencia de
  `card.presentation`. Cards antigos da Visao Geral preservam o DOM e o layout
  anteriores; os ajustes de conteudo, fonte, cor, posicao e torres continuam
  disponiveis somente quando configurados no editor de Agendamentos.
- Banco e runtime de producao nao foram alterados: a falha do gate interrompeu
  migration e promocao antes de qualquer mutacao remota.

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

## 2026-10-27: isolamento final das acoes ocultas de Agendamentos

- A CI de `main` `40550745986` aprovou `validate`, `promotable-image` e
  `isolated-restore`, mas o `release-gates` encontrou uma regressao de clique na
  Visao Geral: a toolbar compartilhada surgia no hover e interceptava o botao
  de historico mensal. A falha pertencia a esta entrega, nao ao PR posterior.
- O comportamento oculto agora depende da propriedade
  `hideCardActionsByDefault`, ativada somente em
  `/app/etapas/agendamentos`. A Visao Geral voltou ao layout anterior, com a
  toolbar em linha; Agendamentos mantem as acoes ocultas ate hover/foco.
- Validacao local com Node 24.19.0: typecheck, 27 testes focados e a matriz
  `scripts/qa/dashboard-report.mjs` aprovaram. A matriz ampla concluiu 267
  verificacoes, incluindo temas, viewports, Axe e todos os popups de historico,
  sem falhas. Nova CI no SHA corretivo permanece obrigatoria antes da
  publicacao.

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

## Arquivos históricos

- [Continuação de 2026-10-15 a 2026-10-27](ATUALIZACOES-ARQUIVO-2026-10-15-a-2026-10-27-CONTINUACAO.md).
- [Histórico de 2026-09-27 a 2026-10-13](ATUALIZACOES-ARQUIVO-2026-09-27-a-2026-10-13.md).
