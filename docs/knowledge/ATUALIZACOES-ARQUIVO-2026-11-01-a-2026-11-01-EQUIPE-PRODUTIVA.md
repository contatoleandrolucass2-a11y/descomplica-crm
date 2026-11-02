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
