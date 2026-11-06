## 2026-11-01: abertura da página Equipe Produtiva

- Escopo: nova página com filtros comerciais existentes e quatro indicadores de
  corretores com agendamentos, visitas, pastas e vendas; acesso no menu lateral
  das etapas do Dashboard. Fontes: prints fornecidos e contratos atuais.
- Git comum confirmado; checkout inicialmente destacado e limpo em
  `0dab1578063eece6b9b5c86fa184c722388578fb`, igual a `origin/main` após fetch.
  Trabalho na branch `codex/equipe-produtiva`.
- Consulta em 01/11/2026, 23:02 (America/Sao_Paulo): health público HTTP 200,
  status `ok`, versão `332a37c375665480076fe9c167033677845207ec`, diferente do
  checkout. Fonte: https://crm.descomplicapro.com.br/api/health.
- GitHub: conector consultou runs de PR do SHA local e retornou lista vazia;
  isso não comprova CI aprovada nem reprovação. CLI `gh` ausente do PATH.
  Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm.
- Conhecimento pertinente recuperado no repositório e Obsidian: o denominador
  existente usa o cadastro vigente filtrado; período recorta fatos comerciais.
  Confirmar esse contrato no código antes de reutilizar. Nenhuma ingestão ou
  alteração remota autorizada por essa consulta.

## Implementação e validação local

- Página e sidebar implementadas no escopo pedido. Reuso do card e calendário
  existentes preserva o comportamento anterior de Agendamentos. Cadastro e
  presenças seguem a autoridade dos relatórios comerciais já coletados.
- Permissão `crm.productive_team.view` e RPC `read_crm_productive_team(text)`
  independentes: sessão, página ativa, permissão e visão autorizada. Retorno
  sanitizado remove conta, ranking, empreendimento, loja e valores financeiros.
  A leitura STABLE usa uma geração consistente para fatos e cadastro.
- Cálculos: 11 testes aprovados; loader: 11; apresentação: 3; navegação, recursos
  e regressão de Agendamentos: 36 testes aprovados em Node 24.19.0.
- Preview Chromium sintético: seis cenários, três temas em 390/1440 px, nove
  interações, axe sem violações e sem overflow; inclui calendário por teclado,
  limpar, zoom 200%, zero real e indisponibilidade. Evidência local ignorada:
  `test-results/productive-team-preview/evidence.json`. CSS Vite não comprova
  runtime Next autenticado nem banco remoto.
- pgTAP preparado com 23 asserções; execução local indisponível sem Docker.
  CI do candidato deve validar banco/restore e demais gates antes de integrar.
- Migrations locais: `20261102020840_productive_team_read.sql` e
  `20261102020921_sync_page_catalog.sql`; `pages:check` aprovou 50 páginas.
  Ativação remota exige autorização específica, backup e verificação; autorização
  permanente de deploy não inclui migrations remotas.
- Sync inicial falhou ao acrescentar a nota ao documento próximo de 256.000
  bytes. Somente a nota desta demanda foi movida integralmente para este arquivo,
  com referência no índice. Novo sync aprovou sete documentos. Nenhum histórico
  anterior foi resumido ou apagado; reavaliar particionamento em demanda própria.
- ESLint local inicialmente encontrou patch versionado ausente na instalação
  concorrente de dependências. Reaplicado somente o patch já aprovado ao pacote
  local ignorado, preservando lockfile e dependências; lint e tipos aprovados.
- GitHub confirmou PR463 integrado em `0dab1578`; CI main41375044989 ainda em
  andamento na consulta. Fonte: API pública do GitHub e PR463. A diferença com
  produção `332a37c3` corresponde a esse PR; não prova publicação desta demanda.

- Regressão real da sidebar Chromium aprovada: navegação, hover, foco, toque,
  zoom e geometria; destinos autorizados aparecem nas páginas do Dashboard.
  Teste atualizado somente para o novo item e para o alcance pedido do menu.
  Revalidação de navegação e apresentação: 25 testes aprovados após ajustes.
- Revisão independente de SQL, loader e integração não encontrou achados
  acionáveis. Build Next local aprovado, com dois avisos preexistentes de tracing
  Lead+ fora do diff; nenhuma correção incidental realizada.

## Dependências comprovadas pela primeira CI

- PR465, candidato `bef128a4`: CI41376879945 falhou em 15 asserções de inventários
  diretamente afetados pela nova página/permissão/migrations; 4.766 testes
  passaram e 112 foram ignorados. Gate bloqueado, sem merge nem publicação.
  Captura41376879955 parou no catálogo REST divergente pelo mesmo novo acesso.
- Ajustes preservam asserções estritas: 50 páginas, nova permissão somente nos
  conjuntos de Admin/Master, 100 migrations e 2.383 asserções pgTAP em 45 arquivos.
  As duas versões novas foram acrescentadas somente à lista não implantável
  pelo fluxo histórico Auth/MFA, sem mudar hashes, candidatos ou resultados
  antigos. Não há mudança de política de acesso de outra página.
- Revalidação focada das seis suítes que falharam: 130 testes aprovados em
  Node24.19.0. Os testes SQL do catálogo preservam planos e conjuntos dos demais
  papéis; execução real ainda depende da CI.
- Nova página recebeu contrato dedicado em `docs/qa/equipe-produtiva/README.md`,
  integrado como gate na matriz autenticada: CSS Next, sessão sintética, temas,
  desktop/celular, axe, teclado e zoom. Os 22 canvases históricos e suas baselines
  permanecem preservados. Verificação sintática e lint aprovados; execução remota
  isolada da nova CI ainda pendente.

## Conciliação com o elenco filtrado

- Revisão automática do PR465 identificou um P2 real: Ana atualmente no gerente A
  com venda histórica do gerente B podia elevar a equipe B para 100%, embora
  sua única corretora atual Bia não tivesse vendido. O mesmo cruzamento existia
  nos outros numeradores. A revisão independente inicial não detectou o caso.
- Reproduzido com quatro regressões vermelhas; corrigido na nova página com
  interseção de broker_key entre atividade e o mesmo cadastro filtrado usado
  pelo denominador. Homônimos permanecem indisponíveis por ambiguidade.
  `analyzeAppointments` somente expõe `filteredBrokerRoster` no retorno; não
  altera indicadores nem comportamento da página antiga.
- Node24/Vitest: 68 testes aprovados nos cálculos novos e Agendamentos, incluindo
  os quatro casos de troca de gerente, atividade sem filtro, atual e mista.
  Lint dos três arquivos aprovado. Fonte: comentário da revisão do PR465 e
  `tests/productive-team-analysis.test.ts`. Nova CI ainda necessária.

## Banco e captura autenticada do candidato 31d95b1a

- CI41378013677 aprovou `validate` e `promotable-image`. Banco e restauração
  falharam em três dependências dos novos acessos: grants_matrix precisava
  incluir a RPC auditada; duas contagens Admin passaram de 82 para 83; a fixture
  precisava limpar o JWT durante preparação postgres antes de injetar negações
  contra Master. O guard de imutabilidade funcionou e permanece integral.
  Planos de testes mantidos; execução final exige nova CI.
- Captura41378013692: E2E real com 50 rotas protegidas aprovou 20 testes e
  ignorou um previsto. RLS/API também aprovou. Artefato13112731441 contém seis
  capturas reais da nova rota, nos três temas em 390/1440, com ausência de fonte
  mostrada como indisponível. Revisão visual do desktop preservou título,
  filtros, quatro cards e navegação. Isso não prova dados preenchidos no Next;
  preenchimento continua coberto por fixtures unitárias e preview sintético.
- O gate visual parou após as seis capturas no zoom: medição imediata encontrou
  scrollWidth2880 para viewport1440, antes de o ResizeObserver atualizar o
  conteúdo de 1396 para 676 px. Após o recálculo, scrollWidth1440. Reprodução
  com DashboardShell real confirmou a corrida do teste; nenhum limite de
  overflow foi relaxado nem CSS do produto alterado.
- QA agora aguarda a igualdade entre largura do conteúdo e shell menos rail,
  além de ausência de overflow. Diagnóstico parcial guarda somente etapa,
  geometria, acessibilidade e contagem de erros, sem mensagens privadas.
  Preview com sidebar real passou seis telas e nove interações, axe e console
  sem erros; lint, sintaxe e formatação aprovados. Nova CI ainda pendente.

## Validação de 02/11/2026 e método de zoom

- Candidato `7cb6388`, CI41380295295: aplicação, imagem e restauração aprovadas.
  As 2.383 asserções de banco passaram nas bases inicial e restaurada. Os três
  ajustes de fixtures e inventários preservaram os guards existentes.
- Captura41380295297 aprovou novamente E2E, teclado, seis telas e axe. Artefato
  13112604133 trouxe diagnóstico: shell estabilizado em 676 px, mas scrollWidth
  1654 para viewport1440. Screenshot mostrou navbar desktop ampliada por CSS:
  esse método não atualiza media queries como o zoom do navegador.
- O teste acrescentado nesta demanda usava um método inadequado; a correção
  agora segue `checkZoom` vigente: contextos isolados com viewport CSS equivalente
  e deviceScaleFactor para canvas físico de 1440×900. Sessão passa somente como
  objeto em memória, sem arquivo de credenciais, e contextos fecham em finally.
  Nenhum header, CSS do produto, limite de overflow ou baseline foi alterado.
- Prova local da função exata e helpers reais, sobre TeamPage/Shell sintéticos:
  seis telas e cinco níveis 80/100/125/150/200 aprovados, screenshots1440×900 e
  largura CSS igual ao scroll em 1800/1440/1152/960/720. O preview confirmou
  devicePixelRatio e media queries, incluindo modo estreito em 200%.
  Evidência ignorada: `test-results/productive-team-exact-check/productive-team-results.json`.
  Transporte/theme sintéticos não equivalem ao backend autenticado final.
- Lint, sintaxe, formatação e diff aprovados. A nova CI deve executar o método
  corrigido antes de qualquer integração ou publicação.

## Atualização documental concorrente

- Em 02/11/2026, a branch remota avançou para `d4bb4d91` pelo PR466, somente
  documental. A nova CI não foi criada para `a0866c9f` porque o índice de
  conhecimento passou a ter conflito com esse main.
- Merge preserva integralmente o registro documental já integrado e a nota
  desta demanda. Somente o conflito do último parágrafo do índice foi resolvido:
  referência atual publicada `0dab1578` mais o link de Equipe Produtiva. Nenhum
  código de outra página foi alterado. Conferir novamente main/CI antes de integrar.

## Captura autenticada da página aprovada

- Candidato `34fc2e14`, captura41382879652, artefato13115485626: a página aprovou
  seis capturas reais nos três temas em 390/1440, teclado, axe e cinco níveis de
  zoom equivalente. `productive-team-results.json` registra `passed: true`,
  `keyboard: true`, `zoom: true` e cinco zoomChecks. Isso é evidência da página,
  não aprovação da matriz global inteira, que parou posteriormente.
- Falha posterior: `archive-navigation` tinha sete links estáticos esperados
  para o submenu Dashboard. A interface já tinha oito pelo novo catálogo.
  Os 40 cenários pararam no mesmo assertLinks, com Dashboard aberto e sem erros
  de runtime. Dependência comprovada do menu novo, não falha de regra financeira.
  Correção limita-se a acrescentar Equipe Produtiva nesse conjunto esperado.
- CI41382879854 aprovou 4.786 testes e falhou em uma asserção estática que
  esperava a assinatura antiga do helper de captura. A expectativa agora inclui
  o terceiro argumento opcional com default false, preservando o contrato das
  chamadas anteriores. Fonte: `tests/visual-parity-completeness.test.ts`.
- Validação local dos dois contratos corrigidos: 32 testes aprovados, lint,
  formatação e diff aprovados. Nenhum baseline nem funcionalidade de simulador
  foi alterado para liberar o gate. Capturas locais ignoradas em
  `test-results/equipe-produtiva-ci-34fc`. Nova CI ainda obrigatória.

## Conferência final e bloqueio visual — 02/11/2026

- PR465, candidato `cf284fac4bd586e42641ec46b8fedae6ead23493`: captura protegida
  https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41385963470
  concluída com sucesso. Cobertura: 154 telas responsivas, 88 temas, 242 axe,
  40 cenários de navegação e contrato dedicado Equipe Produtiva aprovado
  (seis telas, teclado, cinco zooms equivalentes). Captura inclui estado sem
  coleta; contagens preenchidas também têm provas unitárias e preview sintético.
- Artefato13116736699, ZIP SHA256
  `e447c21aef8a9c23c0b52bb4e4b9edb8f73bcf5f2f4020cc281c120bd7358df7`;
  captura `18a5174686f8af51cdde28d2c137732bb7fcd5e1`, árvore limpa.
  Cópia local ignorada: `test-results/equipe-produtiva-approved-cf`.
- A comparação com referências aponta 88 imagens em oito rotas: cinco rotas
  Dashboard afetadas e `/admin`, `/admin/paginas`, `/admin/usuarios`.
  Revisão independente dos três pares Admin1440 constatou mudanças adicionais
  de margens, bordas e header, inclusive em `/admin`, sem contador novo.
  Contagens49→50 e nova permissão são dependências reais; essas outras mudanças
  não estão justificadas por elas. Componentes Admin, ManagementCanvas,
  ProtectedShell, globals e presentation não mudaram de `0dab1578` a `cf284fac`.
  Não aprovar rebaseline Admin nem investigar/corrigir outra página neste chat.
  Nenhum baseline alterado. Reavaliação exige demanda própria e evidência da
  causa dessas divergências; gates continuam obrigatórios e bloqueiam publicação.
- CI41385963459 aprovou validate, isolated-restore e promotable-image;
  release-gates ainda comparava a matriz na consulta de encerramento. Aprovação
  da captura funcional não equivale à aprovação dessa comparação visual.
- Correção final limitada à página nova: canal inicial vem da visão autorizada
  mesmo quando a análise está ausente; chave de visão reinicia o estado.
  Trinta testes de apresentação, análise e contrato passaram localmente depois
  do ajuste. Evidências de CI anteriores não aprovam automaticamente esse SHA.
- Consulta observacional em 2026-11-02T04:38:28Z: fetch origin/main
  `d4bb4d91b8a553ae2edf0eaeb876d21e2b59b361`; health público HTTP200, status ok,
  versão `0dab1578063eece6b9b5c86fa184c722388578fb`.
  Fonte: https://crm.descomplicapro.com.br/api/health. Demanda não integrada nem
  publicada. Duas migrations remotas seguem sem aplicação e exigem autorização
  específica conforme automatic-publication.md, além dos gates aprovados.
- A API pública GitHub esgotou sua cota durante a espera. As conferências finais
  de jobs/artefatos usaram o conector GitHub autenticado já disponível; nenhuma
  conta ou permissão foi alterada. Empresa/Imob seguem sem denominador oficial
  conciliável no cadastro atual; a página comunica indisponibilidade.

## Retomada autorizada — 02/11/2026, 14:40 America/Sao_Paulo

O usuário autorizou explicitamente corrigir os bloqueios visuais de /admin,
/admin/paginas e /admin/usuarios, aplicar as duas migrations de Equipe Produtiva
e publicar depois de todos os testes aprovados. Essa autorização supera a
pendência anterior dessas operações; não abrange outras mutações remotas.

Git comum confirmado; branch codex/equipe-produtiva limpa em 897fe6ef. Git fetch
confirma origin/main b93d3904. Health público em 2026-11-02T17:40:23Z retornou
HTTP200, ok, versão aa28d38e99ec5bf835e5fbde3da3520874c002ec. Fontes: origin/main,
https://crm.descomplicapro.com.br/api/health e conector GitHub. CI41389751583:
validate, isolated-restore e promotable-image aprovados; release-gates falhou
somente na matriz visual completa. Captura protegida41389751571 aprovada.
Próximo passo: preservar as mudanças integradas desde a base, investigar as
referências Admin e validar novamente o candidato final antes de migrar/publicar.

## Correção da cascata administrativa

Causa comprovada por comparação de fontes e geometria: admin-canvas.css e
ManagementCanvas.module.css tinham seletores de igual especificidade para o
padding da raiz, borda/raio de cards e filtros/resultados. A ordem dos chunks
mudava a aparência sem mudança nessas fontes. O módulo fornece os tokens da
referência aprovada; seletores globais empatados agora usam :where, preservando
as regras descendentes mais específicas e as media queries. A correção fica
restrita às três páginas administrativas autorizadas, sem alterar o módulo
ManagementCanvas compartilhado ou inserir !important.

O main b93d3904 foi integrado preservando seu desempenho, regras e gates.
Conflitos de QA preservam o plano funcional atual e a cobertura dedicada de
Equipe Produtiva no modo completo. Inventários reconciliados:102 migrations,
47 arquivos pgTAP/2414 asserções;34 testes desses contratos passaram. Testes de
cálculo/apresentação/navegação após merge:105 aprovados. Nova CI e captura do
runtime integrado ainda necessárias. Migrations continuam não aplicadas.

Prova red/green da correção administrativa: tests/admin-css-order.browser.mjs
reproduziu18 divergências com a folha antiga e aprovou18 combinações no CSS
corrigido (3rotas,3temas,1440/390,duas ordens), sem overflow. Usa CSS real compilado
pelo Vite e DOM mínimo sintético; não substitui Next autenticado. Registros em
test-results/admin-css-order/{reference,current}/evidence.json. Tipos, catálogo,
29 testes de recursos/conhecimento e29 contratos de QA passaram. Baselines ainda
intactos; captura protegida do candidato integrado pendente.

## Captura do runtime integrado — 02/11/2026

Captura protegida41495047808 aprovada no SHA exato1e43cdfb, árvore limpa e
fingerprint459704ebddf8aba2499b55359b47c87b897b36c9b987d3a173304c987d31f37d.
Artefato13169150433, ZIP SHA256
b8a04491cce4b19850ab23605c423058981ce7acce34e17c8f7199d11523f442, conferido com
GitHub e arquivo baixado. Os242 hashes/tamanhos de imagens conferem.
Passaram154 telas responsivas,88 temas,242axe,110zooms,22comparações com canvas
aprovado,40cenários de navegação e Team6telas+5zooms+teclado. Testes preenchidos
usam fixtures; a sessão autenticada da captura apresenta ausência de coleta.

A raizAdmin voltou a passar todas11comparações. Revisão detectou residual de
ordemCSS na densidade de células de Páginas: .admin-pages-results th/td ainda
empatava com .table th/td. Essas6imagens NÃO são promovidas. O ajuste específico
é verificado em regressão e a próxima CI deve compará-lo ao baseline preservado.

Revisão independente aprovou33variantes de Visitas/Pastas/Vendas (30imagens
únicas,3desktopclaro de mesmo hash). Root inspecionou8representantes de Dashboard/
Oportunidades em1440/390/768/320 e temas médio/escuro, com comparação das bases.
A sidebar explica o reposicionamento; tabela móvel conserva rolagem própria.
Canvases estreitos do Dashboard já tinham recortes internos na referência e
não foram redesenhados nesta demanda. São limites existentes, não prova de
melhoria desses cards. As22verificações dessas duas rotas passaram no artefato.

Promovidas SOMENTE55 referências das cinco rotas Dashboard com sidebar nova,
por helper transacional existente extraído sem modificar sua implementação.
Manifesto composto preserva os187registros/imagens restantes e sua proveniência,
incluindo TODASAdmin; reviewedUpdates identifica os55arquivos, origem e hashes.
Revisão de Usuários ainda encontrou empate da summaryGrid/gap e não autorizou
absorvê-lo: CSS será estabilizado e comparado às referências originais na CI.
Nenhum limiar/gate foi reduzido. Diferença de fontes desde a captura até este
ajuste limita-se às regras administrativas, sem correspondência no DOM dessas
cinco rotas nem em Equipe Produtiva; sua evidência continua pertinente por impacto.

A regressão ampliada renderiza os componentes REAIS Administração,
PageCatalogManager e UserAccessManager (Master protegido e corretor editável),
com ações/gates/navegação sintéticos sem I/O nem CRUD. Compara toda a árvore,
32propriedades, geometria e foco nas duas ordens de CSS. Resultado corrigido:
24/24cenários aprovados,3temas×1440/390×4estados,overflow0. Os empates remanescentes
foram reduzidos somente em células/ação de Páginas e gap do resumo de Usuários.
As referências Admin antigas ficam preservadas: a captura1e43 de Usuários ainda
mostrava gap12px, portanto suas11imagens não foram promovidas. CI verify deverá
confirmar a correção contra a referência original. Fontes/teste: admin-canvas.css
e tests/admin-css-order.browser.mjs; evidência local ignorada no diretório
admin-css-order. Nenhuma migration remota aplicada nesta etapa.

## Verificação791b e aprovação seletiva de quatro referências

CI41503395675: validate, imagem e restore aprovados. Todoscontratos funcionais,
154responsivas/88temas/242axe/110zooms/22canvases eTeam6+5 passaram. A comparação
falhou somente em4Usersmóveis:390claro/escuro,375,320. Administração ePáginas
passaram com baselines originais;55sidebar passaram após revisão. Nenhum
problemaCSSresidual foi demonstrado:12casosSSRreais adicionais nas375/320 e
trêstemas passaram nas2ordens, comfoco/overflowestáveis. O diff exato dos pixels
ficou exclusivamente emavatar/email sintético,contadores e matriz comEquipe
Produtiva (quebra legítima da nova descrição em375). Nada mudou nasbordas,
paddings, resumo,pessoas,instruções ourodapé. Revisão independente aprovou4pares.

Artefato13174480600, ZIP SHA256
db5261b81d84a9ce3f10ea48647bc8fc6d3a0ebe1e5718a160d418b48f57d35b. Captura
91073e44171890f88841cc4d2ab7d0ab2096123f tem árvore idêntica ao head791b2a82.
O flagdirtytrue foi preservado: fingerprint68387cf2ed328ce1f94b18a5bd8839775ff5e60a3df276e4f7077c80d0e30d7e
reproduzido comdiff rastreado vazio eexatos19outputsConectarSistemas doartefato.
Exceção exclusiva dessacaptura:reavaliar se fonte/output/hash divergir; não
concede dispensa deproveniência futura. Origem/limites registrados no manifesto.
Promovidas somente4referências Users, preservando238destaetapa. Total desde abase:
59imagens alteradas e183originais preservadas. Nenhum limiar ouassert foi reduzido.
NovaCI verify obrigatória; semmerge/deploy/mutationsremotas nestaetapa.

Prévia readonly do banco confirmou49páginas,75permissões e padrõesAdmin/Master
existentes.13descrições legadas diferem do código, mas ONCONFLICTDONOTHING da
migration as preserva: nãohaveráUPDATEextra. Planooffline com17testes permite
somente esses13textos exatos,e rejeita drift de níveis/defaults/metadados.
Backup/CAS de5tabelas e preservação integraldepermissions permanecem exigidos.
Checagem de contrato: f[7]>=1 é validado pelo schema e transform canônico; projetar
presença1 não converte volumezero/negativo emevento. Não foramadicionados testes
redundantes para essa garantia já vigente.

## Integração concorrente do PR469 — 02/11/2026

Após o push371631e0, GitHub informou conflito e não criou nova CI. Fetch confirma
main2556898d911f3c5d5a806b70c0ec0c800a820bd2 pelo PR469 (Agendamentos). Health em
2026-11-02T19:55:43Z: HTTP200/ok, versãoaa28d38e99ec5bf835e5fbde3da3520874c002ec.
Fontes: origin/main, PR469 e https://crm.descomplicapro.com.br/api/health.
São estados distintos: a entrega concorrente está integrada, não demonstrada
publicada nessa consulta. Integração preservará seus cards, regras e migration;
este chat continua autorizado a aplicar SOMENTE as duas migrations Team. Caso
a outra migration avance o banco antes da aplicação, o baseline privado será
reconferido; não aplicar a migration de outro chat por inferência.

A integração concorrente preservou os quatro componentes compartilhados
(ProductiveTeamCard, DashboardFilters, CalendarFilter e TiltCard) e todos os
campos de analyzeAppointments usados pela Team, por comparação AST antes/depois.
O ranking novo é aditivo e não modifica os resultados anteriores; seu custo
adicional não foi medido. CSS recebido limita-se à recência/rankings/canvas de
Agendamentos, não montados pela Team. Evidências anteriores das 59 referências
revisadas e da página Team permanecem pertinentes por impacto; a CI do SHA
integrado continua obrigatória. Testes focados Team19 e inventários34 passaram.
Inventário integrado:103migrations,48arquivos pgTAP/2436asserções. Nenhuma terceira
migration foi executada por este chat e o plano remoto aguarda estado vivo.

## Verificação 25e58c96 e tablet — 02/11/2026

CI41516437878 aprovou aplicação, restauração e imagem. Todos os contratos
funcionais, 242axe, 110zooms, 22canvases e Team6+5 passaram. Única falha de pixels:
Usuários768×1024, 15.601/1.516.032 (1,029067988%). Revisão independente de três
imagens integrais confirmou somente identidade sintética, contagens75→76/49→50
e o item Team. Contra791b, só3.649pixels de avatar/email mudam; resto idêntico.
Nenhum residual CSS ou mudança de geometria. Promovida somente essa referência,
241 preservadas nesta etapa; total60 alteradas/182 originais desde a base.

Artefato13179407589, ZIP SHA256
1a6e331e4406f2f0c56ff0e205971238da5bdae4064552c94f94b43e5bc6987b. Captura7fcd96ce
tem árvore idêntica ao head25e58c96:1225d6e966e7a6e5c10a0f813a1a9423eac0506b.
Fingerprint08e116e4d19d4175868e26c47a0ebcd81c97369833370ce3a27deb9cbcd28eea
reproduzido com diff vazio e19outputs sintéticos do próprio artefato. Dirty e CI
falha preservados. Exceção exclusiva dessa captura; sem alteração de limiar.
Nova CI integrada obrigatória; nenhuma migration Team aplicada ainda.

Conferência viva: produção2556898d, deployment28c48a83-4c9e-4923-91c8-3028aabc5555,
publicado2026-11-02T20:39:49.477Z, sem pendência (release:production status).
MCP confirmou85migrations, incluindo20261102175113, nenhuma das duas Team.
Essa aplicação concorrente foi apenas observada. Plano offline foi atualizado
para exigir backup integral novo de85linhas;17testes sintéticos passaram.
GitHub main avançou paraa93d65b2 (CAIXA); preservar sua entrega e referências,
sem modificar regras ou validar publicações com CI de outro SHA.

CI41526633412 interrompeu validate no contrato da referência tablet:
baseline_updated_after_review não integra o enum vigente. Corrigido somente
o rótulo para baseline_updated, preservando imagem e todos os limiares.
As outras4.902asserções Vitest passaram;113skips já previstos. Nova execução
do candidato continua obrigatória. Sync Obsidian ficou pendente porque o
índice compartilhado recebido de main tem256.512bytes, além do limite256.000;
sem ampliar o escopo para reorganizar notas de outra demanda.

## Gates aprovados e atualização estrita — 03/11/2026 UTC

CI41527348860 (e676c454) e CI41536343313 (ac27e6bb) concluíram os quatro jobs
com sucesso, incluindo matriz visual completa. O primeiro merge foi recusado
pelo GitHub: três checks esperados, proteção strict=true; main havia avançado
para8697ade2 somente com documentos. A integração ac27 foi sem conflito e
sincronizou9documentos no Obsidian. Nenhum código ou referência mudou nessa etapa.

Nova conferência em03/11UTC (02/11SãoPaulo): main855f32d6 contém correção
concorrente do publicador, permitindo CI manual completa na main exata sem
dispensar os quatro jobs. A entrega será preservada, sem editar sua política.
Health público HTTP200/ok e ledger ainda apontam2556898d, deployment
28c48a83-4c9e-4923-91c8-3028aabc5555, data real20:39:49.477Z de02/11,
sem pendência. Fontes: origin/main, GitHub runs/PR465, health e coordenador.
Nova integração/CI exigidas pela proteção; nenhuma migration Team aplicada.
O índice recebido de855 tem256.592bytes, excedendo o limite256.000; eventual
falha de sync permanece externa ao escopo, sem reordenar notas de outro chat.

## Publicação e ativação verificadas — 03/11/2026 UTC

Estado funcional: publicado e ativo. PR465 integrado no SHA
6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573. CI41555924747 aprovou os quatro jobs
do PR; CI41561175667 aprovou os quatro jobs do main exato, incluindo banco,
restauração, autorização, matriz visual completa e contrato dedicado Team.
Fontes: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/465 e
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41561175667.

Artefato de imagem13197220640 da mesma CI. image.tar.gz SHA256 conferido:
fc2ab400d1de6a4cfec1c6651ea89ef0f535c61c5c8bbb265755692a3088b0d3.
Config ID da CI:sha256:177d1c5166bec40747b34776d3822d43e0c9ebc96b337c367664ec7bf22ce98a.
Manifesto/ID local:sha256:a1d98a02f7565162d6d5a7f6ef735fc7774d5364f9c9c39e3d2fca7cecfd9e3a.
Prova validou30blobs,14camadas, revisão, linux/amd64 e equivalência integral de
rootfs e formatos Docker/OCI. image:prove confirmou dois perfis na mesma imagem,
sem imprimir segredos. Não houve rebuild ou retag na VPS. A instalação própria
de dependências do publicador reutilizou545pacotes em cache, sem downloads;
o primeiro vínculo compartilhado foi recusado antes de qualquer remoção e
substituído por instalação frozen no checkout isolado, preservando o anterior.

Publicação exclusiva por release:production, três locks e CAS. Consulta viva em
03/11 02:41:15UTC confirmou deployment anterior28c48a83-4c9e-4923-91c8-3028aabc5555,
SHA2556898d e data real02/11 20:39:49.477UTC. Publicação nova concluída em
03/11 02:41:32.581UTC (02/11 23:41:32.581America/Sao_Paulo): deployment
f854e369-d792-45e4-9ff8-504e75651453, SHA6a0b1df5 e ID local comprovado acima,
sem pendência. A conferência final de minuto e CI/main foi feita pelo coordenador.

Após runtime compatível, operação de banco manteve os mesmos três locks até
verificação final; liberação normal confirmada. Backup consistente de cinco
tabelas, schema/ACL/RLS, funções e85linhas de histórico, capturado02:42:47.36875UTC,
persistido somente no arquivo privado root:root0600:
/etc/descomplica-crm/migration-backups/equipe-6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573-preapply.json.
SHA256:c011fca6cd849c1b4052f64b169b59504b17f6a28b21859908345bc83cd22efb.
Cópias temporárias locais privadas removidas após comparação; nenhuma linha,
identidade ou justificativa individual foi exportada para Git ou Obsidian.

Aplicadas somente as duas migrations autorizadas, com pins originais já
registrados, locks/CAS das cinco tabelas e preservação verificada no próprio DO:
20261102020840_productive_team_read.sql e20261102020921_sync_page_catalog.sql.
Envelopes SHA256:696f8caf3ce63770a1b68950d932121da9b497313bc640570dfd439843247366
e31025e019faf7c556cb7a96b6648659c2d4efec9419edd2946b1170067692b13.
O MCP gerou versões20261103024406 e20261103024523; após releitura de nome,
statement único, hash e corpos reais, somente essas linhas foram reconciliadas
por CAS para20261102020840/productive_team_read e20261102020921/sync_page_catalog.
Histórico final87, com todas as85linhas anteriores integralmente preservadas.

Comparação pós-aplicação02:46:41UTC: app_pages49→50, permissions75→76,
role_permissions260→262, user_roles16→16 e user_permission_overrides71→71.
Todos os conteúdos antigos de permissões/concessões/exceções, estados das páginas,
schema, owners, ACL e RLS permaneceram iguais; somente updated_at das páginas
foi desconsiderado como metadado do UPDATE. Treze descrições legadas preservadas.
Página ativa, permissão crm.productive_team.view/min_level10 e defaults somente
admin/master. Duas funções com corpos exatos, ownerpostgres e search_path vazio:
projetor privado invoker sem execução cliente; leitura pública STABLE/SECDEF com
execução apenas authenticated, guardada por sessão, página e visão autorizadas.
anon e service_role continuam sem EXECUTE em ambas; authenticated não executa
diretamente o projetor privado. Nenhuma terceira migration foi aplicada por este chat.

Provas de produção: RPC com chave pública anônima negadaHTTP401/código42501;
as onze rotas afetadas (sete Dashboard, Team e três Admin) redirecionaram307 ao
login, sem cookies. Health público200/ok/6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573.
Credenciais e corpos de respostas privadas não foram impressos. Não houve login
com contas reais; jornada autenticada e dados financeiros permaneceram na CI
isolada com dados sintéticos. Não foi feita gravação comercial para smoke.

Limites preservados: Imob/Empresa indicam indisponibilidade quando a autoridade
não fornece cadastro conciliável. Nenhum denominador foi inferido da atividade,
nenhuma coleta ou workflow n8n foi alterado. CI/merge/publicação/ativação são
estados distintos e agora verificados para a entrega funcional. Este encerramento
é somente documental, sem outro restart ou promoção. Sync Obsidian permanece
pendente porque o índice compartilhado recebido de main excede256.000bytes
(arquivo atual256.679); reavaliar após correção dessa fonte, sem alterar notas
de outras demandas para ocultar a falha.

## Ajuste visual solicitado — 03/11/2026

Escopo: somente Equipe Produtiva. Remover breadcrumb, elevar conteúdo e sidebar
ao padrão externo de Agendamentos, acrescentar vidro mantendo os efeitos atuais
e compactar para o desktop do print, preservando acesso ao conteúdo em telas
estreitas/zoom. Sem alteração de cálculos, permissões ou banco.
Abertura: Git comum confirmado, árvore limpa, branch base38bec742. Main remoto
no mesmo SHA, CI documental41569465098 aprovada. Site observado200/ok na versão
6a0b1df51ff8e8f9ed0711bd114f4c5ab6d41573. Busca do conhecimento indisponível:
índice compartilhado excede o limite de exportação; não alegar sincronização.
Fontes: origin/main, GitHub e /api/health em03/11/2026. Reutilizados contexto e
ferramentas desta conversa; nenhuma fonte de instruções mudou desde main38bec.

### Validação local do ajuste visual — 03/11/2026

- Implementado: breadcrumb/horário duplicado removidos, sidebar externo com
  offset medido do cabeçalho e vidro nos cards. Bordas e eventos preservados.
- Chromium isolado aprovou 48 combinações (oito viewports, três temas, fonte
  presente/ausente), sem overflow vertical nos desktops testados; referência
  6a0b1df5 falha. Evidência local: test-results/productive-team-layout/current.
- Cabeçalho e dados sintéticos; aprovação de runtime Next depende da CI.
  Nenhuma migration nova. Sync segue limitado pelo índice compartilhado acima
  de 256000 bytes; não alterar notas de outras demandas para liberar esta.
- CI41575292605/PR479 aprovou validate, restore e imagem, mas bloqueou
  no contrato da própria Equipe Produtiva: backdrop-filter computado como none
  em 390px. Causa reproduzida com Lightning CSS do PostCSS de produção: prefixo
  WebKit após a propriedade padrão elimina a declaração padrão na otimização.
  Ordem corrigida; teste de navegador passou a usar esse otimizador e aprovou
  48 combinações. Referência57e2f6eb falha precisamente em blur=none.

## Ajuste visual publicado — 03/11/2026

- PR #479: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/479.
  Head bc335da7, merge/main f3c4f126990ee634531d30c653403d66d44a4c7f.
  CI do PR 41579177528 e da main 41585221159: validate, release-gates,
  isolated-restore e promotable-image concluídos com sucesso.
- Evidência autenticada do PR: productive-team-results.json, seis capturas
  nos três temas (390/1440 px), teclado e cinco níveis equivalentes de zoom
  aprovados; nenhum erro de navegador ou violação bloqueante de acessibilidade.
  Desktop 1920×714, 1440×900, 1280×720, 1280×476 e 960×600 sem overflow vertical.
  Sidebar externo alinhado ao cabeçalho de 58 px, sem breadcrumb/horário duplicado,
  blur 12 px/saturate 1.12 computados. Captura: test-results/productive-team-layout/ci-dark-1440.webp.
- Local: 24 testes Vitest, lint focado e tipos aprovados antes do ajuste CSS;
  48 combinações Chromium com componentes reais, fixtures sintéticas e
  otimizador de produção aprovadas após integrar a base. Build local compilou,
  mas foi interrompido durante tipos após a causa do prefixo ser reproduzida;
  não foi usado como gate completo. A CI do candidato fornece esse gate.
- Diff produção 6a0b1df5→f3c4f126 inclui PR #474/Agendamentos previamente integrado;
  nenhuma migration nova. A CI completa do SHA integrado valida esse conjunto.
  Sem alterações adicionais de páginas, regras, dados, acesso ou baselines.
- Artefato da CI 41585221159: SHA256 do arquivo 8786353338d7e179dc384cf03deed6fedb48f294897b22484edfb608e3883da0;
  config CI sha256:7cd42f95372720d69d0f9113490cf4b06b02c9712efb95266faa90b8ae9935d1;
  ID local/manifest sha256:8f0382311f406b762fed486aa6c0b22f8e0f2592b18307832dc75d30e9494606.
  Prova de 30 blobs/14 camadas, rootfs/config/revision equivalentes; perfis
  homologação e produção aprovados com a mesma imagem e segredos sintéticos.
- Coordenador release:production publicou deployment b66918d3-6a95-4012-b96c-41ecabf27a70
  em 2026-11-03T06:42:26.927Z (03:42:26.927 America/Sao_Paulo), com consulta no
  próprio minuto, CAS, locks, imagem anterior preservada e pendingDeploymentId=null.
- Pós-publicação observacional: https://crm.descomplicapro.com.br/api/health
  HTTP 200/status ok/version f3c4f126990ee634531d30c653403d66d44a4c7f;
  /app/equipe-produtiva e /app/etapas/agendamentos HTTP 307 para /login sem sessão.
  CSS da imagem ativa contém vidro e shell condicional. A jornada autenticada
  foi conferida no ambiente isolado da CI; nenhum login pessoal em produção.
- Sync voltou a funcionar após integrar d83c9497, que reduziu o índice curado;
  a indisponibilidade anterior fica registrada como condição resolvida.
  Encerramento somente documental: sem novo restart ou republicação do runtime.

## Tabelas nominais no pop-up — abertura em 03/11/2026

- Pedido: dois grupos em cada pop-up dos quatro cards, Equipe Produtiva e
  Equipe não Produtiva. Colunas na ordem Gerente Regional, Gerente de Vendas
  e Responsável, com ordenação alfabética e os filtros vigentes do indicador.
- Consulta em 03/11/2026, 08:38 America/Sao_Paulo: Git comum confirmado,
  main/checkout 093453c68c05f3303ecf1f75a5e694707b8dbd5d sem mudanças locais;
  CI documental 41592078541 concluída com sucesso. Runtime continua em
  f3c4f126990ee634531d30c653403d66d44a4c7f, health HTTP 200/status ok.
  Fontes: GitHub actions e https://crm.descomplicapro.com.br/api/health.
- Branch nova codex/equipe-produtiva-detalhes. Reutilizar contratos autorizados
  do cadastro e relatórios; nenhuma coleta, alteração remota ou migration
  adicional autorizada por este pedido. Busca pertinente no Obsidian recuperou
  registros locais e referências de outros worktrees; conferir no código.

### Implementação do detalhe nominal — 03/11/2026

- ProductiveTeamCard ganha listas produtiva/não produtiva por etapa a partir
  do mesmo Set e cadastro filtrado dos números, sem alterar cálculo, acesso
  ou snapshots. Deduplicação por chave e ordenação pt-BR por Regional, Gerente
  de Vendas e Responsável. Sem cadastro confiável, listas ficam indisponíveis.
- Fonte existente do cadastro contém key/owner/manager. Regional não está
  armazenado nessa projeção; o detalhe usa somente vínculo conhecido e estável
  de Agendamentos no período. Ausência/conflito/mudança aparece Não informado.
  Fontes locais: ops/salesforce/export-candidate.mjs, productive-team-data.ts,
  migration 20261102020840 e productive-team.ts. Nenhum relatório remoto foi
  consultado; não se afirma inexistência do campo no relatório bruto remoto.
- A RPC própria já retorna nomes e exige permissão da página/visão; não há
  masking adicional a remover. Nenhuma nova concessão, endpoint, SQL ou migration.
- UI: duas tabelas no pop-up dos quatro cards, com cabeçalhos na ordem pedida,
  nomes integrais, vazio distinto de indisponível e montagem somente ao abrir.
  Dois blocos no desktop, empilhados no celular, cabeçalho de fechamento fixo.
- Validação inicial: 20 testes de análise e 13 testes de apresentação/regressão
  aprovados, lint focado e tipos aprovados. Navegador isolado aprovou 48 cenários
  de layout e 72 aberturas; cenário longo em celular identificou deslocamento
  do modal herdado de position:relative do card. Correção exclusiva do modal
  para position:fixed/inset:0 aprovada no mesmo contrato. Rerun aprovou também
  listas de 180 corretores em desktop/celular, 90/90 linhas integrais, filtro
  Responsável, Escape e retorno do foco, sem ampliar tolerâncias. Evidências:
  test-results/productive-team-layout/current/evidence.json e capturas details-\*.png.
  Cabeçalho/dados locais sintéticos; CI/merge/publicação ainda pendentes.

### Integração e bloqueio de concorrência — 03/11/2026

- PR #481 integrado em 1f155c6b7345b781868f43ada41295f8967a7f92; CI do PR
  41630586257 e da main 41639086133 aprovaram os quatro gates. Contrato
  autenticado: 24 aberturas, seis capturas de detalhes com acessibilidade,
  teclado/zoom e geometria aprovados. Fixtures do runtime sem fontes nominais
  confirmaram indisponibilidade; partição positiva foi validada localmente.
- Imagem 1f155c6b homologada, mas o coordenador recusou a promoção antes de
  qualquer troca: main avançou para 950dfb9a01f7f972b2fa1e8fbf193e35b0315de4
  pelo PR #482 (Agendamentos). Produção segue f3c4f126, deployment b66918d3,
  pendingDeploymentId=null e health HTTP 200/status ok. Não houve recuperação
  nem redefinição automática do estado esperado.
- Conferência ao vivo em 03/11, após 13:45 UTC: PR #482 tem quatro gates
  aprovados; CI da nova main 41647058472 em execução. Mudanças compartilhadas
  preservam CardDetails e a partição de Equipe Produtiva; apenas metas/tabelas
  de Agendamentos mudaram nessa base. Nenhuma migration acrescentada.
- Prosseguir somente com CI/imagem da main exata ou reconhecer candidato já
  ativo; nunca promover 1f155c6b após avanço da main. Evidências: GitHub PRs
  #481/#482, runs citados, release:production status e health público.

### Janela coordenada de publicação — 03/11/2026

- Coordenação da entrega CAIXA comunicou janela para integrar PR #478,
  aprovar a CI da main exata e publicar. Aguardar sem novos merges/deploys;
  preservar código e gates, sem criar locks alternativos ou cancelar entregas.
- GitHub confirma head 6e5d90cd63d6eba1a59cc6d2024cfe7595aac609 do PR #478:
  validate, imagem e restore aprovados; release-gates em execução na CI 41647692259. Ancestralidade Git confirma inclusão de 1f155c6b (tabelas de
  Equipe Produtiva) e da main 950dfb9a. Não foi lido histórico privado de chat.
- Esta demanda mantém sua verificação pendente até confirmar a versão ativa,
  sua CI/imagem aprovadas e os detalhes de Equipe Produtiva nessa versão.
  Nenhuma publicação, merge adicional ou alteração da CAIXA foi feita aqui.

## Detalhes nominais publicados — 03/11/2026

- Implementação do PR #481, merge 1f155c6b7345b781868f43ada41295f8967a7f92,
  incluída na publicação coordenada 82ee8deb38b5c86f9781504f60c673ee69d9ab44
  pelo PR #478, sobre a base do PR #482. Ancestralidade Git conferida; nenhum
  arquivo de Equipe Produtiva, análise nominal ou extensão CardDetails mudou
  entre 950dfb9a e 82ee8deb. Não houve alteração da CAIXA por este chat.
- CI do PR #481 (41630586257), da sua main 1f155c6b (41639086133) e da base
  950dfb9a (41647058472) aprovadas nos quatro gates, incluindo matriz completa
  e contrato de Equipe Produtiva. Novo runtime 82ee8deb aprovado nos quatro
  gates em 41654312258; matriz focada em simuladores conforme o diff da CAIXA.
  Contrato nominal anterior reutilizado para os componentes inalterados,
  sem transformar cobertura focada em nova aprovação da matriz completa.
- Aceite local: 20 testes de análise e 13 de apresentação/regressão, lint e
  tipos aprovados; 48 cenários de layout e 72 aberturas dos quatro pop-ups,
  dois grupos de 90 em lista de 180, filtro, nomes integrais, rolagem, Escape
  e foco aprovados. Fonte ausente distinta de equipe vazia. Dados sintéticos.
- Aceite no runtime Next isolado: 24 aberturas dos quatro indicadores nos
  três temas/duas larguras, tabelas e cabeçalhos corretos, indisponibilidade,
  geometria, teclado/zoom aprovados; seis capturas de detalhes com axe aprovado.
  Sem fontes nominais nesse runtime: partição com nomes confirmada nos testes
  de dados e navegador com fixtures positivas, sem consultar nomes em produção.
- Ledger do coordenador e Docker conferidos após a janela: deployment
  1d4c8ac7-f800-4513-ac2b-48ba4fd192a2, SHA 82ee8deb, imagem ativa
  sha256:4aaa101b9e02da54ea2435095ce4a82543842d9396be3a1ea51be4b3ab5d3b0b,
  label de revisão correspondente e pendingDeploymentId=null. Publicado em
  2026-11-03T15:35:48.568Z (12:35:48.568 America/Sao_Paulo). Imagem anterior
  f3c4f126/sha256:8f0382311f406b762fed486aa6c0b22f8e0f2592b18307832dc75d30e9494606
  preservada. Nenhum segundo deploy, retag ou recuperação foi executado aqui.
- Pós-publicação observacional: health HTTP 200/status ok/version 82ee8deb;
  /app/equipe-produtiva e /app/etapas/agendamentos retornam HTTP 307 para login
  sem sessão. CSS da imagem ativa contém tabelas nominais, vidro e shell da
  página. Fontes: https://crm.descomplicapro.com.br/api/health, Docker,
  release:production status e runs GitHub citados. Nenhuma migration nova.
- Dados: nomes já pertenciam ao read model autorizado. Regional ausente,
  conflitante ou instável no período continua Não informado. Não houve nova
  coleta, concessão, endpoint ou remoção de masking. Registro final somente
  documental; sincronizar Obsidian e não reiniciar o runtime para este registro.

## Regional oficial e resumo compacto — abertura em 06/11/2026

- Pedido: preencher Regional com o vínculo dos relatórios nas duas tabelas,
  usar primeiro nome/sobrenome nos pop-ups e reduzir linhas/cards. Acrescentar
  tabela de oito colunas abaixo dos cards e remover as duas notas indicadas.
- Git comum confirmado, checkout limpo em 628f4402 antes do fetch; nova branch
  codex/equipe-produtiva-resumo-regional baseada na main 7084fda6c437c5ae85cd1f2b58d630a895888208.
  CI documental 42108445799 aprovada. Health público HTTP 200/status ok em
  0307bd47c3d73f068ef07ae035eb1adcdccb1c1d, que inclui PR #504 de vínculo
  oficial de Agendamentos. Código integrado e runtime são versões distintas.
- Fontes: Git/GitHub, https://crm.descomplicapro.com.br/api/health e busca
  pertinente no Obsidian. Conferir os contratos atuais antes de reutilizar
  notas de 03/11. Nenhuma coleta ou migration remota executada nesta abertura.

### Preparação e validação focada — 06/11/2026

- Esclarecimento do usuário substitui as oito colunas iniciais: retirar
  Responsável da conta e agrupar por gerente de vendas, com quantidade dinâmica
  de linhas e percentuais por base filtrada. Implementadas sete colunas;
  total ponderado usa o mesmo percentual global dos cards.
- RPC v2 aditiva expõe roster_manager_name/regional_manager_name já existentes,
  mantendo v1, guard, projeção autorizada e ACL. Arquivo preparado:
  20261106035242_productive_team_official_hierarchy.sql; sem alteração de dados,
  coleta, concessões ou aplicação remota. Aprovação antiga das duas migrations
  originais não autoriza esta nova função. Docker local indisponível:39asserts
  pgTAP desta suíte dependem da CI isolada. Inventário106migrations/2492asserts.
- MCP SELECT agregado, projeto verificado por hostname hnncxuerlcsaahdxoswb:
  snapshotref06/11, generated04:03:53.025Z, updated04:07:15.226870Z;
  30corretores,5gerentes,2regionais conhecidos e7regionaisnull. Os sete não têm
  agendamentos próprios na análise (inclusive identidade normalizada), nem
  visitas;3 têm pastas e4 têm vendas. Pastas possui coluna regional no contrato,
  mas a projeção retém apenas identificador da oportunidade, não o nome regional.
  Fonte ao vivo não consultada; isso não prova ausência nos relatórios originais.
- Um gerente possui dois regionais confirmados. O resumo mantém ambos em
  nomes separados/abreviados, identifica quantidade sem vínculo e não duplica
  gerente nem denominador. Null por corretor não usa inferência histórica.
  Corrigir a projeção compartilhada/coletor exige diagnóstico e validação
  próprios; nenhuma ampliação incidental para outras páginas foi realizada.
- Focados aprovados:26análise,15loader,6SSR e34inventário/homologação.
  Chromium47,90s:48layouts/72popups,180corretores,30gerentes com scroll interno,
  filtros,7colunas, total ponderado, dois regionais e pendências. Capturas
  sintéticas em test-results/productive-team-layout/current; nenhuma identidade
  real exportada. ESLint/Prettier/diff/sintaxe focados aprovados.
- Cards144px, popup compacto opt-in com primeiro nome/último sobrenome e title
  integral; comportamento compartilhado de Agendamentos preservado. Removidas
  somente as duas notas pedidas. CI completa, aprovação da migration nova,
  merge e publicação desta revisão continuam pendentes nesta etapa.
- PR508/head5bf82246, CI42161270488: validate e promotable-image aprovados.
  Restore isolado executou50arquivos/2492asserts e apontou uma falha no test15
  de grants_matrix: a nova RPC faltava na lista exata das funções autenticadas.
  Correção restrita ao inventário dessa função, sem mudar concessões reais.
  Log também registrou rate limit Docker; a falha pgTAP foi independente e
  reproduzível pela comparação estática da lista. Nenhuma aplicação remota.

### Aprovação e integração — 06/11/2026

- Usuário autorizou especificamente a nova migration20261106035242 após os
  testes. PR508/head524abbc8, CI42162934633: quatro gates aprovados; restore
  2492asserts e matriz completa (release-gates47m5s). Leitura v2 e ACL testadas.
  QA confirmou fixture global sem análise nominal: resumo preenchido/regionais
  oficiais e nulos são comprovados pelos focados sintéticos, não pela matriz
  global indisponível. Nenhum teste duplicado ou baseline alterado.
- Refresh externo05:28UTC: main avançou para6ae947fe/PR507 (alinhamento e
  navegação de Agendamentos). Diff compartilhado confrontado: condicionais de
  rótulo e CSS estão limitados a Agendamentos; Equipe Produtiva preservada.
  Nenhuma autoridade ou regra de deploy mudou. Não editar páginas dessa revisão.
  Health público200/ok ainda0307bd47; versão integrada e publicada distintas.
  CI da nova main não foi localizada pelo conector nesta consulta; publicação
  exige quatro gates da main final, sem usar os da PR como autorização de deploy.
  CLI recuperou a consulta: main6ae947fe possui CI42164749623 em execução;
  nenhuma execução dessa outra entrega foi cancelada.
- Backup aplicável: metadados da função v1 e fingerprint do histórico, sem
  registros pessoais, persistidos root:root0600 na VPS em
  /etc/descomplica-crm/migration-backups/equipe-20261106-v2-before.json,
  SHA256e19da9c4dac4423d305cedbb3c5c71b98ab373318bd857da629dfbacd058f317.
  Hash local/remoto e sincronização de disco conferidos. Envelope operacional
  preserva SQL aprovado40ce2127fdf0899aab3b9300375ec97f62bad66f5332648e4fdb54d18192d53c,
  com travas, CAS e pós-validação; nenhuma concessão ou linha existente alterada.
- Aplicada somente a migration autorizada via Supabase MCP em05:29UTC,
  registro20261106052910/productive_team_official_hierarchy. Envelope operacional
  SHA2565276509e2db7221cff4e9bb2991cc86b48350e7d7f5441faa41cfbfaece43df1,
  SQL original byte-idêntico ao aprovado. Bodymd5 v2 local/remoto
  29c94c01db28f7d6d6dd031dae0202b3; v1 permanece91ebffe4f16ddfac558889416fd54fb8.
  Ownerpostgres, STABLE, SECURITYDEFINER/searchpathvazio, authenticatedexecute,
  anon/service/PUBLIC negados, sem sessão retorna null. Histórico89→90;
  as89linhas anteriores mantêm MD5d87c1453fc7c17d27b29b5a03efd1679. Não houve
  alteração de dados, coleta ou função antiga. Rollback da aplicação conserva
  a função aditiva, podendo continuar na v1 sem remover dados.
- Merge do PR508 encontrou conflitos somente em WORKLOG/CHANGELOG. Preservados
  ambos os registros, com Agendamentos antes da seção Equipe Produtiva para
  reduzir colisão com novos registros no topo. Código de PR507 integrado intacto.
  Nova CI do candidato combinado obrigatória; não reutilizar a aprovação da PR
  antiga como prova desse SHA. Aplicação publicada segue0307bd47 nesta etapa.

### Legibilidade do indicador compacto — 06/11/2026

- Medição adicional justificada pelo valor43,3% do print: a fixture principal
  com50% não cobria texto decimal. No anel48px/fonte1,3rem,43,3% mede58,98px e
  100% mede53,20px, excedendo o próprio anel. Reproduzido960/1280 em três temas.
  Evidência sintética test-results/productive-team-donut-measure.
- Correção restrita ao CSS de Equipe Produtiva: card160px/anel64px/fonte1,05rem
  e margens compactas.43,3% mede47,61px e100%42,95px, abaixo do interior49,92px.
  Título/anel/descrição íntegros; cinco gerentes+total visíveis1280x720/1920x1080;
  960x600 admite rolagem interna da tabela. Documento sem scroll vertical nas
  nove combinações. Evidência test-results/productive-team-donut-option-b.
- Aplicar regressão permanente e executar navegador focado uma vez após CSS
  final; nova CI obrigatória porque o CSS mudou. RPC/migration já autorizada e
  aplicada permanecem iguais; nenhum outro banco ou página foi alterado.
- Regressão permanente adicionada ao navegador e checkProductiveTeam. Fonte
  final aprovada em60,42s:48layouts/72popups/9cenários de rótulos decimais,
  50resumos e listas/filtros. Primeira tentativa interrompida no setContent/load
  após34layouts/24popups, sem asserção visual falhar; causa não confirmada.
  Repetição sequencial autorizada passou, com processo novo, sem ampliar
  timeout ou alterar asserções. ESLint/Prettier/sintaxe/diff focados aprovados.
  Evidência final test-results/productive-team-layout/current/evidence.json e
  decimal-gauge-dark-1280.png. SSR/dados não repetidos: nenhum contrato JS mudou.
