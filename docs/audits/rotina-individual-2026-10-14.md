# Auditoria da Rotina individual

## Publicacao confirmada em 14/10/2026

- PR215: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/215,
  integrado em 2026-10-14T05:02:31Z. SHA de runtime/main:
  faae8e9efa487c44d01b991a3949ce1627ad2980.
- CI do PR38510935022 e main38514527676 completas/aprovadas. Main inclui
  validate (lint, tipos, testes, build), isolated-restore, release-gates e
  promotable-image. Banco:1323 pgTAP. QA da Rotina comprova isolamento entre
  duas contas, persistencia, Semana/Hoje, teclado, scroll e acessibilidade.
- Imagem: config CI sha256:a2e5efd862e8d8fd33bea005c2c1fa043765c47f066fd71375fcedc6cc9b0536;
  manifesto OCI/Docker sha256:067dab81d8b20fe3a833ee7b172aa48427237dfff835939cd2708acbece0c2de.
  Checksum do arquivo, label, plataforma linux/amd64 e11 camadas conferidos.
  Perfis homologation/production usam a mesma imagem, sem build na VPS.
- Supabase hnncxuerlcsaahdxoswb: baseline05:26Z e releitura05:43Z confirmam
  cinco objetos novos ausentes,36 migrations e funcoes existentes intactas.
  Backup aplicavel e de metadados/ACL/ausencia mais SQL, nao dump integral:
  /var/backups/descomplica-crm/migrations/routine-completions-20261014.Wn631L,
  root0700/arquivos0600, manifesto8733c878d3b7d5848adc1cf56187abf5c3ecb61b6061686133220566d2911251.
  Nenhum dado de cliente, usuario ou texto completo foi exportado.
- Aplicada somente migration autorizada crm_routine_completions por MCP.
  Fonte20261014020437, registro remoto20261014054331; diferenca de timestamp
  gerada pelo MCP, sem reparar historico ou aplicar pendencias alheias.
  RLS forcada; tabela somente postgres, RPCs somente postgres/authenticated,
  helpers somente postgres. Policy restritiva vincula auth.uid e MFA.
  Domingo2026-10-19T02:59:59Z pertence a semana12/10;03:00Z inicia19/10.
  Hashes das RPCs existentes, House rev2/26 linhas e Imob rev3/18 preservados.
- Primeiro preparo parou antes do coordenador por zod ausente no checkout
  novo. Instaladas apenas dependencias do lock com pnpm install --prod
  --frozen-lockfile --ignore-scripts (cache local). Nao houve troca de runtime,
  bypass, alteracao de lockfile ou build no host. Reavaliar esse requisito
  em cada checkout novo antes de executar o coordenador.
- Backup runtime verificado em
  /var/backups/descomplica-crm/releases/faae8e9efa487c44d01b991a3949ce1627ad2980.3PKaUE,
  manifesto b4e5fd312d36232b6e474d5765657a4d36fd71626c2bc27eecd828b19f1e6961.
  Env, ledger e Compose privados preservados; imagem anterior792320b disponivel.
- Deploy exclusivo via pnpm release:production, com locks, CAS e consulta no
  minuto da troca. Deployment574a7a95-c8e3-480b-80f5-870cec5600d7, concluido
  2026-10-14T05:45:08.644Z (02:45:08 Sao Paulo), sem pendencia.
  Anterior8fff7f32-9d09-4a61-8241-c4cf35acf120,792320b,04:15:43.522Z.
- Pos-publicacao: health200/ok/faae8e9 as05:46:39Z; container healthy,
  OOMfalse/restarts0; inventario e conclusoes anonimas401, rotas privadas307.
  UI autenticada:108 textos exatamente iguais a revisao aprovada,93 controles
  semana/18 Hoje habilitados e desmarcados, fonteGeist13px/400/18.2px.
  Captura local ignorada: test-results/routine-preview/regional-imob-conclusoes-publicado.png.
- Limites: nao marcou atividades reais para simular trabalho concluido.
  Escrita entre contas/dispositivos e reset foram exercitados na CI; producao
  recebeu leitura autenticada, catalogo e limite temporal sem mutacao ficticia.
  Historico de conclusoes preservado; rollback da aplicacao nao apaga tabela.
  N8n, clientes, propostas e regras financeiras nao foram alterados.
- Fechamento documental no PR219, branch codex/rotina-evidencias-publicacao.
  Auto-merge recusado pelo GitHub por configuracao existente; nao a alteramos.
  Integracao deste registro depende dos gates do proprio PR, sem novo deploy.
  Runtime do PR215 permanece publicado e validado independentemente da nota.

## 2026-10-14: Integracao concorrente durante validacao da Rotina

- Consulta04:12Z: origin/main avancou para 792320ba037ea48655739aaeefe5295b95c33631
  (dashboard); CI38506931120 concluida/aprovada. Health publico HTTP200/ok ainda
  em 0fdbb80. Fontes: git fetch/ls-remote, GitHub Actions e /api/health.
- PR215 em 69756e2 ficou conflitante nos tres documentos de registro. Ambos os
  conjuntos de notas preservados; harness integrado automaticamente. Nenhuma
  funcionalidade de dashboard foi reescrita nesta resolucao. Nova CI combinada
  obrigatoria; consultar ledger/versao novamente antes de qualquer publicacao.
- Correcao da captura administrativa validada no componente real em Chromium:
  3/3 testes, dimensoes iguais com uma/duas contas em1440/390 e scroll zero.
  ESLint focal aprovado. Limiares, mascaras e referencias visuais preservados.

## 2026-10-13: Abertura de conclusao individual semanal

- Complemento solicitado: revisar portugues de regional imob, preservando
  sentido e tipografia; conclusoes individuais com virada segunda 00h Brasilia.
- Consulta em 2026-10-14T02:00Z: fetch sem divergencia de main, health publico
  200/ok e origin/main em 0fdbb80aa79d731bcd458ca4bc892ecc76be2918.
  Branch documental e9ef9c1/PR212: validate aprovado; gates ainda em andamento
  na CI38498361340. Isto nao valida a funcionalidade ainda nao implementada.
- Fontes: GitHub PR212/actions, GET /api/health e runbook shared-routines.
  Migracao nova depende de autorizacao especifica; nao aplicar por inferencia.
- Usuario confirmou conclusoes individuais e autorizou migration aditiva apos
  testes/backup. Revisao de 40 textos distintos salva as 23:05 e 108 campos
  conferidos apos recarga; 18 linhas/93 atividades preservadas. Trecho de
  imobiliarias sem produzir ha 60 dias confirmado explicitamente.
- Projeto confirmado pelo SUPABASE_URL do runtime: hnncxuerlcsaahdxoswb.
  Antes da mudanca, tabela/RPCs/helpers novos ausentes; 36 migrations remotas,
  ultima 20261013035612. Registro local ignorado completions-before.json;
  nenhuma rotina existente ou cliente exportado. House rev2/26 linhas e
  Imob rev3/18 linhas observadas. Docker local indisponivel; banco/restore
  devem ser validados na CI isolada antes da migration.
- Implementacao: checkbox individual por atividade, API autenticada, RPCs
  vinculadas a auth.uid e tabela sem grants diretos aos papeis da API. Semana
  calculada no banco, segunda 00h America/Sao_Paulo; historico anterior nao
  aparece na semana nova. Marcacoes nao dependem do armazenamento do navegador.
- Validacao local: lint sem erros, typecheck/build aprovados; 80 testes de
  API/inventario de migrations aprovados. Suite serial: 2713 aprovados,
  78 ignorados e tres falhas; duas do manifesto foram corrigidas e retestadas.
  Restante: symlink Salesforce no Windows (502 esperado, 200 recebido), fora
  dos arquivos da Rotina; verificar CI Linux, sem dispensar o gate.
- UI Chromium: 73 testes aprovados antes do ajuste final de foco; regressao
  focal de PUT/GET e scroll aprovada depois. QA sintetico de dois usuarios e
  quatro analises axe aprovados. Banco real isolado e publicacao pendentes.
- CI38501459791: validate aprovado; restore executou 1323 testes e encontrou
  apenas contador legado da matriz RLS (40, agora 41 tabelas). Lista nominal
  e 81 testes novos passaram. Contador atualizado sem remover as verificacoes.
  Suite Chromium final, incluindo correcao de foco: 73/73 aprovados.
- CI38502364540: validate, 1323 testes pgTAP, advisors, restore e E2E de
  autorizacao aprovados. Matriz visual bloqueada no setup da segunda conta
  sintetica (SQLSTATE 23505); corrigir fixture, repetir CI e somente depois
  migrar/publicar. Nenhuma mutacao remota de schema realizada neste ponto.
- Causa do 23505: guard de profiles na migration 20260809144137, linhas
  1743-1753, exige escopo compativel antes de aprovar/ativar o broker. Fixture
  do leitor precisa de pessoa, equipe, vinculo e concessao de escopo proprio;
  nao e necessario alterar guards ou permissoes de producao.
- CI38504861394: fixture corrigida; routine-results.json confirma duas contas
  distintas, marcacoes independentes persistidas, conteudo compartilhado intacto,
  Semana/Hoje, teclado e quatro auditorias axe sem violacoes. Rotina passou
  tambem na matriz de cinco larguras/tres temas e rolagem. Gate geral falhou
  somente em /admin/usuarios: nova conta virou selecao automatica, mudando o
  estado da captura (desktop 1324px contra referencia 1187px/limite1200).
  Corrigir selecao deterministica da conta QA original, sem mudar UI, limites
  ou imagens de referencia. Fonte: artefato candidato do mesmo run.

## 2026-10-13: Capitalizacao da rotina regional imob

- Pedido complementar aplicado pela UI autenticada: primeira letra maiuscula
  e demais minusculas em cada atividade, sem reescrever o conteudo.
- Fonte computada identica a House: Geist, 13px, peso 400, linha 18.2px.
  Nenhuma alteracao de CSS, codigo, permissao ou schema.
- Salvo no CRM em 13/10 as 22:54; apos recarga, os 108 campos correspondem
  integralmente a matriz transformada, com 93 atividades e 18 linhas.
  Captura local: test-results/routine-preview/regional-imob-sentence-case.png.
- Validacao operacional de leitura, edicao, salvamento e recarga aprovada.
  Suite de codigo nao repetida nesta operacao de dados; resultados e limite
  da validacao anterior permanecem na nota abaixo. Nao houve novo deploy.
- Fechamento em 2026-10-14T01:55Z: health publico 200/ok na versao
  0fdbb80aa79d731bcd458ca4bc892ecc76be2918. PR212 aberto, SHA 6eaca7a:
  validate e isolated-restore aprovados, release-gates em andamento.
  Fontes: /api/health do CRM e GitHub actions/runs/38496863633.

## 2026-10-13: Cadastro da rotina Gerente regional imob

- Abertura em 13/10 as 22:22 de Sao Paulo (2026-10-14T01:22Z): main e
  health publico 200/ok em 0fdbb80aa79d731bcd458ca4bc892ecc76be2918.
  GitHub CI main 38462971446 concluida com sucesso. Checkout anterior
  d4d06e3 limpo; nova branch parte do main observado.
- PR207 documental anterior continua aberto; validate da CI38425311572
  falhou em Verify current documentation fee sources. Nao equivale a falha
  da release da Rotina, validada e publicada em etapa anterior.
- Pedido atual autoriza cadastrar conteudo do Excel fornecido somente na
  funcao Gerente regional imob, preservando as outras funcoes. Conferir fonte,
  estado vazio, correspondencia por dia e persistencia pela UI autenticada.
  Sem necessidade presumida de mudanca de codigo, migration ou novo deploy.
- Concluido pela UI autenticada em 13/10 as 22:27 de Sao Paulo: mensagem
  Salvo no CRM. Fonte TESTE1.xlsx, aba GERENTE REGIONAL IMOB, D6:I26.
  Dezoito linhas com 93 atividades; linhas 19, 20 e 25 integralmente vazias
  removidas na apresentacao compacta. Dias e vazios individuais preservados.
  Apenas espacos repetidos/de borda normalizados; textos e caixa preservados.
- Extracao OOXML somente leitura, com FileShare.ReadWrite porque Excel mantinha
  o arquivo aberto. Comparacao independente por SHA-256 da matriz normalizada:
  2702986a13c1a617492dee6d07ccfa8b516322961cbcc1e7acac79535ee9d06c.
  Arquivo original inalterado; nenhum conteudo da planilha versionado.
- UI confirmou funcao vazia antes do cadastro, 108 campos e 93 preenchidos
  identicos a fonte antes de salvar e apos recarregar. Hoje exibiu as 18
  atividades da terca-feira correspondentes. Gerente regional house conferido
  antes/depois sem mudanca. Console sem erros. Screenshot local em
  test-results/routine-preview/regional-imob-cadastrada.png.
- Operacao de conteudo autorizada pelo pedido atual; nao alterou codigo,
  permissoes, schema, n8n ou runtime. Nao necessita publicacao de imagem.
  Persistencia verificada por recarga autenticada; nao foi usada outra conta
  ou computador, nem alegada nova auditoria de RLS nesta operacao.
- Validacao documental: lint e typecheck aprovados; build separado exit 0.
  pnpm test executado: 2662 passaram, 63 skips e uma falha no teste existente
  tests/salesforce-inventory-api.test.ts:164 (symlink, esperado 502, recebido
  200). Nenhum arquivo de estoque ou teste foi alterado. A causa nao foi
  diagnosticada nesta tarefa de conteudo; revisar esse contrato no Windows
  em trabalho proprio, sem reduzir assertions. Etapas Node de coletor/release
  nao executadas nessa rodada porque a suite Vitest interrompeu o encadeamento.
  Logs locais imob-documentation-verify.log e imob-documentation-build.log.
  Nao alegar suite integral aprovada nem novo deploy. CI do main observado
  continuava aprovada na abertura; registro documental segue PR separado.
- Encerramento em 2026-10-14T01:38:26Z (13/10, 22:38 Sao Paulo): health
  publico permanece HTTP200/ok/0fdbb80a; somente os tres documentos alterados.
