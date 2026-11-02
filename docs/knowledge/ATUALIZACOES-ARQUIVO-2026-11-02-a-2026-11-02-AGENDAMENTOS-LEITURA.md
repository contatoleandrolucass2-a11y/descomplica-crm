# 2026-11-02: melhorias de leitura em Agendamentos

## Publicação e persistência verificadas em produção

PR469 integrado em2556898d911f3c5d5a806b70c0ec0c800a820bd2. CI do PR41501479365
e do main41511483505 concluídas com os quatro jobs aprovados. Árvores do head
ce7a4ac1 e do merge idênticas. Imagem aprovada do main, artifact13172864422;
ZIP SHA256 af503b144a426f3dae33c734907267e4dbae5dd63cd2da1145a884403cee047c.
Prova OCI e dois perfis de runtime aprovados, sem build na VPS.

Coordenador publicou em2026-11-02T20:39:49.477Z, deployment
28c48a83-4c9e-4923-91c8-3028aabc5555, imagem
sha256:23f73788fef0a381f67edcf95a07c8d819937feb0a1bda5792cfc2ec2d549ef2.
Anterior aa28d38e/fd394210-9300-46be-aab9-b71ba59906d2. Health público confirmou
HTTP200/ok/2556898d; coordenador sem recuperação pendente. Fontes:
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/469,
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41511483505,
https://crm.descomplicapro.com.br/api/health e release:production status.

Migration20261102175113 expressamente autorizada após CI verde, aplicada via
Supabase MCP no projeto de produção confirmado, depois do app saudável e sob
as três travas compartilhadas. Backup privado com modo0600; SHA256
cf5403071a69d7f8a62171046ae2f38caae34c43c7340ca3b6b9c598aa65a698.
Payload SHA25696b76d550969795d0d5808dd3d5a286c58eabebccbb1520677241408dd677a0a.
Os84 registros anteriores do histórico permaneceram iguais. Apenas o timestamp
gerado pelo MCP para esta migration foi alinhado ao ID aprovado, por CAS de
nome/hash e função ativa, com alvo ausente. Corpos das duas funções conferem
exatamente com o SQL aprovado após normalizar CRLF; ownerpostgres,
securityinvoker/search_pathempty e ACLpostgres-only preservados.

Dois perfis passaram de28/29 para31/32cards, iguais à expansão pura do backup,
versionexatamente+1 e updated_at posterior. Cópia preexistente do usuário mantida.
Rollback requer leitor compatível; não restaurar cegamente perfis sobre edições.
Travas liberadas normalmente após conferência.

Smoke real na mesma conta: originais29 com dimensões e ordem relativa preservadas
nos dois navegadores. RankingPDV alterado por teclado de500 para510px, largura
608px e posição27/32; salvamento confirmou cada ação. Refresh no integrado
recebeu toda a geometria/ordem idênticas. Refresh em390×844 e844×390 manteve os
32cards e geometria lógica; documento375/829px, sem overflow horizontal. Undo3
no Chrome restaurou o baseline; refresh nos dois confirmou restauração exata.
Não houve logout, exclusão de cópia do usuário ou escrita em dados comerciais.

Recência real:17linhas, rolagem thin, client383/scroll1322px; data abaixo do
responsável em todas as linhas. Captura local final-integrado-recencia.jpg.
Controle conectado teve timeouts e seleções não retidas em abas auxiliares;
reprodução isolada do parent atual com31cards e transporte compacto comitou
Novembro→Outubro e Imob/House, estável2s, sem erro. Em nova aba Chrome a seleção
de outubro comitou e exibiu136registros; usuário também confirmou seleção manual
de outubro no integrado. Não houve correção de código sem causa comprovada.
As falhas temporárias de controle não comprovam defeito do aplicativo e não
foram ocultadas como passes automáticos nas abas auxiliares.

Chrome publicado: PDV10linhas em ordem decrescente (46,45,18,12...), conteúdo
client421/scroll566px, scrollbarthin. Empreendimentos têm dimensão e totais
distintos. Ponto do dia29/Outubro exibiu tooltip exatamente22 após foco.
12/10: círculo vermelho RGB255,102,123 e título com nome/explicação de Nossa
Senhora Aparecida. Somente feriados nacionais estatutários, sem datas locais.
Tabela de vencidos carregou0registros no recorte real; não inferir vencimento
de comparecimento ausente, nem substituir este resultado por linhas sintéticas.
Teste com73elegíveis/páginas50+23/CSV73 permanece a prova de casos positivos.

Prints reais locais: final-chrome-rankings.jpg, final-chrome-linhas.jpg,
final-chrome-vencidos.jpg, final-chrome-recencia.jpg e
final-integrado-recencia.jpg. Chrome móvel390×844: documento375px, ranking
preenchido capturado em final-celular-rankings.jpg. Integrado móvel: recência
314,656px/altura500, final-celular-recencia.jpg. Overrides dos dois navegadores
restaurados; geometria do Chrome continua exatamente igual ao baseline32.
São capturas reais, sem montagem; fixtures sintéticas continuam identificadas.
Leitura final nos dois navegadores confirmou novamente igualdade exata com o
baseline32 restaurado. GET anônimo da rota devolveu307, sem cookies nem conteúdo
privado. A sincronização passou após mover as próprias notas:8documentos.

Retomada documental encontrou origin/maina93d65b2 (outra entrega CAIXA), enquanto
runtime continua2556898d. Não publicar runtime para registrar esta tarefa.
Hook do Obsidian recusou ATUALIZACOES.md com256425bytes (limite256000). Para
preservar a sincronização, somente três notas históricas desta mesma demanda
Agendamentos foram movidas integralmente abaixo; conteúdo de CAIXA mantido.

## Histórico móvel preservado integralmente do índice

## 2026-10-30: rotação móvel simulada aprovada

- 390×844 → 844×390 → 390×844, com refresh em ambas: 28 itens preservaram
  ordem e tamanhos salvos, sem estouro horizontal; geometria vertical restaurada.
  Evidências e limites no histórico AGENDAMENTOS de 30/10/2026.

## 2026-10-30: Chrome para celular simulado aprovado

- Refresh móvel recebeu os 28 itens na ordem e dimensões salvas no Chrome.
  Visitas 303×337 px/2º; semanal 343×541 px/8º. Larguras ajustadas à coluna,
  sem estouro horizontal. Detalhes no histórico AGENDAMENTOS de 30/10/2026.

## 2026-10-30: edição móvel simulada recebida no Chrome

- Após arrastes pelo canto e pela alça em 390×844, o Chrome atualizado recebeu
  os 28 itens com ordem e dimensões idênticas. Visitas 269×313 px/3º; semanal
  273×515 px/9º. Evidência e limites no histórico AGENDAMENTOS de 30/10/2026.

## Registro original de abertura

Abertura em 17:42Z: Git comum confirmado; árvore limpa, base atualizada de d4bb4d91 para origin/main b93d3904. CI 41380947066 concluída com sucesso. PR467 integrou aa28d38e e PR468 registros b93d3904; health público consultado em 17:42:05Z retorna ok/aa28d38e. Fontes: Git origin/main, gh PRs 467/468, https://crm.descomplicapro.com.br/api/health. Versão local documental difere da versão runtime como esperado. Escopo: rolagem vertical em conteúdo excedente, datas/tooltips do comparativo, recência legível, rankings PDV/empreendimento e tabela de comparecimento vencido sem visita, feriados. Pendente esclarecer terceiro gráfico (somente dois descritos) e abrangência local de feriados. Nenhuma alteração de outras páginas, permissões ou integração autorizada por contexto.

## Implementação e evidências locais

Usuário confirmou somente dois rankings. Sem jurisdição informada, feriados
limitados às datas nacionais fixas, sem presumir ponto facultativo ou feriado
municipal. Fontes conferidas: Lei662/1949 na Câmara
(https://www2.camara.leg.br/legin/fed/lei/1940-1949/lei-662-6-abril-1949-347136-normaatualizada-pl.html),
Lei14.759/2023 no Senado (https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2023-12-21%3B14759),
Lei6.802/1980 e calendário federal2026 no MGI/AgênciaGov. Textos explicativos
próprios, sem copiar artigos. Os marcadores não alteram metas ou cálculos.

Fonte dos rankings: Activity.PDV\_\_c.Name separado da dimensão de empreendimento
já coletada, confirmado em ops/salesforce/export-candidate.mjs e
analysis-transform.mjs. Sem nova coleta, join de pessoas ou integração. Filtros
por ranking de conta ou regional sem vínculo confiável retornam indisponível;
as quantidades e percentuais vêm do mesmo recorte agregado.

Data de comparecimento usa attendedAt, oriunda de Activity.Data_de_comparecimento\_\_c;
vencido é data civil SãoPaulo anterior a calendarDate e visitPerformed=false.
Ausentes/hoje/futuro/visitaSim não entram. subsetoverdue é validado no servidor
antes de paginação/CSV, com cache/cursor separado e guards/snapshot existentes.

Node24.19/pnpm11.20: tipo e lint focado aprovados; análise, renderização,
comparação, transporte e backend de detalhes passaram em testes focados.
Inventário de release26/26 aprovado após acrescentar migration e pgTAP novos.
Falhas iniciais de contagem28→31 e inventário100→101 foram corrigidas, sem
remover asserções ou reduzir gates. DB local ECONNREFUSED127.0.0.1:54322;
SQL não foi executado aqui.22asserções novas aguardam CI obrigatória.

QA real de componentes/CSS em Chromium isolado com dados sintéticos:
test-results/appointments-reading/result.json e
test-results/appointments-comparison-days/result.json:6/6 combinações por suite,
três temas e1440/390, scroll e leitura até último registro, tooltip só numérico,
datas alinhadas e meses28/29/30/31/filtros. Integração em
test-results/appointments-reading-integration/result.json:6/6, rankings35,
vencidos73 (páginas50+23/CSV73), feriado12/10 vermelho com explicação; sem erros
de página, requisições externas ou overflow. Transporte dessa QA é mock;
seleção/paginação reais estão cobertas pelos testes de servidor, não por produção.

Migration20261102175113 expande catálogo e insere somente três métricas ausentes
nos perfis de Agendamentos. IDs existentes, dimensões e apresentação mantidos;
ordem relativa preservada, com reindexação. Lock/preflight/CAS/version/timestamp
e rollback transacional mantidos; excesso50cards/bytes aborta sem truncar.
Revisão independente somente leitura não demonstrou vulnerabilidade; constatou
que pgTAP cobre helper/ACL/limites, sem provar concorrência de produção.
Aplicação remota ainda não autorizada. Exige backup e cliente/rollback compatível
com métricas novas. Não reverter removendo cards como efeito incidental.

## Autorização e revisão final do candidato

PR469 aberto. Usuário autorizou explicitamente aplicar em produção a migration
20261102175113 após CI verde, incluindo backup e expansão dos layouts existentes.
A aprovação não se estende a outras migrations. Preflight observacional MCP
confirmou projeto descomplica-crm-production/hnncxuerlcsaahdxoswb, PostgreSQL17.6,
2perfis de Agendamentos, máximo29cards e nenhum acima47; nenhum dado alterado.

Revisão final corrigiu a apresentação de fonte indisponível nos novos rankings e
na tabela de vencidos, preservando distinção de ausência e vazio.65testes de
análise/renderização/rankings passaram após a correção. CI anterior do mesmo PR
foi substituída pelo candidato atualizado; resultados do SHA anterior não serão
usados para aprovar publicação do novo. A geometria atual de29cards foi guardada
localmente sem conteúdo de clientes para comparação posterior; a cópia já presente
não pertence a este teste e não será excluída.

CI41497055089/SHA724804d7 falhou no inventário de homologação, pois a migration
nova ainda não constava da lista nonDeployableRepositoryVersions.4863testes
aprovados/112condicionais e2falhas específicas de inventário. Acrescentada só
20261102175113 à lista não aplicável de homologação; baseline histórica,
candidatos/hash/execução Auth/MFA mantidos. É dependência mecânica da migration
criada aqui, não correção de outra página. Não houve aplicação de Auth/MFA.

Restore do run41497872036 parou em appointments_reading_cards.test.sql:66:
operator is not unique: unknown - unknown. A expressão c->'layout' - 'order'
precisava de parênteses para aplicar subtração ao JSONB extraído. Corrigido
para (c->'layout') - 'order', sem mudança da migration autorizada. As11primeiras
asserções rodaram sem falhas antes do erro de parsing; a suite integral não
foi declarada aprovada. SELECT sintético observacional no PostgreSQL17.6 confirmou
apenas a expressão corrigida, sem DDL ou alteração remota. Nova CI obrigatória.

Roteiros manuais appointments-preview.mjs e appointments-calendar-comparison.mjs
receberam somente expectativas diretamente afetadas:31cards/32após cópia,
13gráficos/16incluindo recência,31rótulos e exclusão de details+overdue do preset.
Sintaxe/Prettier/diff-check e4checagens isoladas aprovadas. Suites manuais integrais
não foram repetidas; o ramo legado do preview conserva seletores pré-canvas e
não comprova a tela atual. Não foi reescrito por ser uma limitação anterior,
sem relação com a contagem solicitada. QA atual usa os componentes reais e
fixtures descritos acima, sem atualizar baselines para ocultar diferenças.
