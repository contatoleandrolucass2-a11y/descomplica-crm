## Retomada: regionais pendentes e visibilidade do resumo — 07/11/2026

- Pedido: buscar vínculo regional dos seis corretores pendentes em outros relatórios e mostrar nas duas tabelas do popup e no resumo; investigar a tabela abaixo dos quatro cards que o usuário não visualiza.
- Git comum confirmado; checkout inicial limpo, HEAD/main 9d8ad1cd01c1d2fd775283a4cb57bacc11ee583e. Branch de trabalho codex/equipe-regionais-resumo-20261107. Fetch sem divergência. GitHub main CI documental 42250061953 success; CI funcional 42230895044 success no SHA 9ee2c0cf.
- Health público em 2026-11-07T05:57:06.551Z: HTTP 200/status ok/version 9ee2c0cf7fe11df21efeb58cc19c615d71058948. Código integrado documental e runtime permanecem distintos. Fonte: https://crm.descomplicapro.com.br/api/health e GitHub do repositório.
- Notas pertinentes recuperadas do checkout e Obsidian. Evidência anterior não substitui consulta atual dos relatórios nem comprova visibilidade autenticada; investigar sem inferir Regional pelo gerente e sem exportar dados privados. Nenhuma nova migration ou ingestão aplicada nesta abertura.

### Investigação e preparação

- GET de metadata via sessão dedicada Salesforce na VPS confirmou os campos de
  pessoa Regional em Oportunidades, Pastas, Visitas e Vendas. Projeção anterior
  descartava esses nomes. Execuções observacionais delimitadas por corretor,
  sem salvar relatórios nem publicar/exportar dados, confirmaram30ativos e cinco
  pendentes; dois com evidência própria e três sem registros nas quatro fontes.
  GET inicial truncava Oportunidades/Pastas em2000linhas e não foi usado como
  prova de ausência; consultas por corretor retornaram allData=true.
- Última evidência própria dos dois casos presentes: Visitas em06/11/2026 e
  Oportunidades em13/10/2026, com gerente oficial coincidente e Regional único
  nessas datas. Histórico contém dois regionais, portanto não atribuir por
  gerente nem descartar mudança de vínculo. Cadeia Owner.Manager foi descartada:
  zero coincidências com os25vínculos regionais conhecidos.
- Nova aba da rota publicada, usando sessão já autenticada e CUA, mostrou o
  resumo com cinco gerentes e total30. Não foi reproduzida ausência completa;
  em1280x585 a quinta linha ficava parcialmente oculta pela rolagem interna.
  Ajuste específico para desktop de altura<=650 mantém cinco linhas e total
  visíveis em testes sintéticos nos três temas. Sem captura nominal em arquivo.
- Browser final:48layouts/72popups/50verificações do resumo/12de indicadores,
  aprovado. Testes backend novos3/3 aprovados após corrigir fixture de Visitas
  sem Unidade de Negócio; primeira falha preservada como evidência. Prettier
  dos quatro arquivos backend aprovado. CI completa e ativação ainda pendentes.
- Produtor aditivo reutiliza regional_manager_name; sem migration/RPC/ACL nova.
  Coletor observado ativo em0307bd47, com quatro drop-ins preservados. Trocar
  somente a imagem do app não muda esse produtor; preparar atualização imutável,
  backup, CAS, encerramento natural do ciclo e duas cargas conciliadas.
- Revisão independente encontrou placeholder Salesforce "-" tratado como pessoa.
  Corrigido na projeção das cinco fontes e no observador comum; observação recente
  ausente continua bloqueando histórico antigo. Foco regional7/7 e transform10/10
  aprovados. ESLint sem erros e apenas dois warnings preexistentes; novo warning
  removido. Helper operacional privado preparado e self-test aprovado, sem aplicar.

### Autorização, integração e preparação operacional

- Usuário autorizou em07/11 a atualização somente do coletor após os quatro
  gates do main, com backup/CAS/rollback e duas cargas conciliadas; informou
  não ter outra fonte para os três corretores sem registros. Não há nova
  migration. Metadata adicional de Canal Imob não oferece pessoa Regional.
- PR513/c90f6f7d aprovado na CI42345815784, quatro jobs success; release-gates
  durou53m6s. Integrado emcc5479b7fcd288a9fff49b8b0cb0512feac5ab42.
  CI de main42350072525 em andamento; ainda não autoriza publicação.
  Árvore Git7bdef43ae956efae8188f7683a35900469b597aa é idêntica no PR e main;
  isso permite reusar a revisão, sem dispensar os gates do SHA exato.
- Main havia avançado com PR512/7c0c8769, cuja CI42345394446 passou. Integração
  preservou seus31arquivos e conciliou apenas os registros de CHANGELOG/WORKLOG.
  CAIXA e o chat de Agendamentos autorizados confirmaram ausência de nova
  publicação prevista; foram informados do PR513 e da versão integrada.
- Checkout remoto isolado preparado em/srv/descomplica-crm-releases/cc5479b7fcd288a9fff49b8b0cb0512feac5ab42,
  Node24.19.0/pnpm11.20.0, lockfile congelado e nenhum build/suite pesada na VPS.
  Dependências inicialmente EACCES para usuário dedicado. Cópia com inodes
  disjuntos, conteúdo/symlinks idênticos e troca atômica preservou metadados do
  cache original; nova cópia root:descomplica-salesforce, diretórios0750 e
  arquivos0640/0750. Manifesto de62.807entradas, hash
  ee8d040a4148391d485068a5a5c534db7e537e6b0069f96217dcb5bbe9f1373d.
  Importação do coletor como usuário dedicado aprovada; checkout limpo.
- Artefato principal13565915683 da CI42350072525, revisão cc5479b7: ZIP167321073
  bytes/SHA2566da465a6898fb7b187ae02a042d44ed4ef5a1d9f0f362b1d33e964a2a212b429
  verificado antes da extração; image.tar.gz confere checksum. ID CI
  sha256:3032d93ef3c5e5969f916269aa579fd74cc2615792fe0a97a8889c858e22f471.
  Apenas preparação; imagem ainda não promovida e coletor antigo preservado.
- Helper operacional privado SHA25606c0eafab28d65a1cf0dfde4ada9638df517348183ee3f7eb6443cd8cdbeff8d,
  self-test aprovado; exige digest revisado de18fontes
  98581f8403bcfb36d0d9fd865e496819ae64c6bedf48611ffcfb2286d4a73239.
  Comparação sintética de fingerprint entre Node/Postgres aprovada, incluindo
  Unicode e null, para verificar as120linhas de ranking nas cargas reais.

### Publicação funcional e atualização do coletor

- Main CI42350072525/cc5479b7 aprovada nos quatro jobs; release-gates56m18s.
  Artefato conferido: arquivo interno SHA256291d0760f6f4ce4c25e9a2fafc8cee3c6f586fe02edaac92cf56c7d035a73e2b;
  identidade localOCI5d2aa09dbc9e91649e80ffe23a99e7d1b8221151a21deec91ea837ae941d9392,
  30blobs/14layers, RootFS e legacy/OCI equivalentes, linuxamd64 e revisão exata.
- Consulta no minuto da troca confirmou deployment anterior30a25353, runtime9ee2c0cf
  de06/11 às15:57:44.674UTC. Promoção exclusiva release:production, com travas/CAS,
  backup e fontes GitHub/CI/health atuais. Resultado deployed em07/11/2026
  às08:11:22.051UTC (05:11:22.051 America/Sao_Paulo), deployment
  5d1ca8b4-569f-4950-bb3e-acfe86f7fed4; pendingDeploymentId=null. Sem recuperação
  ou segundo deploy. Health200/ok/versioncc5479b7, rotas Team/Agendamentos
  anônimas307/login e estilos da imagem servida conferidos pelo probe.
- Plano do coletor confirmado somente com dois arquivos de runtime alterados,
  18fontes/digest revisado e mesmo deployment aprovado. Aplicação sob lock de
  instalação, backup/CAS, término natural do ciclo e cgroup vazio. Novo drop-in
  97-equipe-regional-reports-20261107.conf aponta para releasecc5479b7 e preserva
  os quatro anteriores, memória, usuário, agenda, credenciais e demais serviços.
  Backup privado em/var/lib/descomplica-salesforce-collector-install/equipe-regional-reports-20261107-KddCUi.
  PID2600978 estável por8s em08:12:22.962UTC; duas cargas ainda em observação.
- Baseline anterior à troca conciliado: request1194b2de-1ecb-4e81-ac46-3e431e3bba92,
  geração07:03:29.392UTC,120linhas/30corretores/5gerentes/5regionais pendentes;
  fingerprint Node e PostgreSQL f629d0775fb6471532a36fd364bddf39 idêntico,
  snapshots de dashboard/ranking consistentes e recibo succeeded.
- Primeira carga nova conciliada: requesteb4bc8e7-ddb1-4360-a593-6d83495f0fad,
  geração08:15:08.474UTC,30corretores/120participantes,27regionais conhecidos e
  três pendentes. Payload SHA2569100199d3c57cff0dc624e849fb336bb7ddef1ee29580254a1ecf2d8dbca19b8;
  Node/PostgreSQL MD5707abcdc6a21edb9ae4105c1fd1ff230 idêntico nas120linhas,
  snapshots consistentes e recibo succeeded. Estoque automático3481 sem mudança
  de sua configuração. A segunda carga natural ainda está em observação.
- Produção autenticada via sessão existente/CUA, sem criar login ou exportar
  nomes: resumo7colunas/5gerentes/total30/trêsvínculos pendentes. Em1280x585,
  cinco linhas visíveis, footer termina em496,05px, rolagem do documento=0.
  Agendamentos possui16+14corretores nas duas tabelas; Visitas8+22, com zero
  ausentes na produtiva e três na não produtiva. Os dois vínculos recuperados
  foram conferidos nas linhas responsáveis e no resumo, com nomes abreviados.
  Ordem dos três subtítulos correta. Aba de Equipe Produtiva deixada aberta.
  Prova desta etapa é inspeção DOM autenticada; não foi salva captura nominal.

### Encerramento funcional — 07/11/2026

- Segunda carga natural concluída e conciliada: request
  2c9ebb9d-da8d-4222-8731-a08286e5e4d2, geração 08:33:11.387 UTC,
  payload SHA256 2bea1c18680dec042ccf64ed91ce98880616df3e8cd835c3acd0b12e1aa0fc99.
  Trinta corretores, cinco gerentes, 120 participantes, 27 vínculos regionais
  conhecidos e três ausentes. Estoque automático confirmou 3481 unidades.
- Fingerprint Node e PostgreSQL 707abcdc6a21edb9ae4105c1fd1ff230 idêntico nas
  duas cargas novas; cada consulta confirmou sua geração atual, snapshots
  consistentes e recibo succeeded. Os dois request IDs são distintos. A prova
  de igualdade no banco complementa o helper, que só declara reconciliação
  operacional e mantém databaseEqualityProved=false em seu próprio recibo.
- Helper encerrou com two_natural_cycles_reconciled, exit 0. PID 2600978
  preservado, coletor active na release cc5479b7 e NeedDaemonReload=no. Não
  houve rollback, eliminação de locks, intervenção em n8n ou restauração de
  snapshots antigos. Os dois regionais canônicos da base permanecem distintos;
  os três casos sem registro não receberam vínculo por inferência de gerente.
- Conferência final em 08:37:16.466 UTC: health HTTP 200/status ok/version
  cc5479b7fcd288a9fff49b8b0cb0512feac5ab42; main no mesmo SHA. Conferência
  autenticada anterior permanece válida: o fingerprint dos 120 participantes
  não mudou entre as duas cargas. Não repetir navegação/testes aprovados sem
  alteração relevante. Fontes: health público, GitHub PR513/CI42350072525,
  recibos privados do coletor, SELECTs agregados Supabase e DOM via CUA.
- Limite remanescente: três corretores não possuem registros próprios nos
  quatro relatórios consultados; usuário informou não ter fonte adicional.
  Reavaliar automaticamente quando um relatório fornecer vínculo explícito
  compatível com o gerente oficial. Este limite não autoriza atribuir Regional
  por semelhança de nome, gerente ou cadeia Owner.Manager.
- Encerramento restante é documental: publicar estes registros no Git e
  sincronizar conhecimento. Não promover outra imagem nem reiniciar serviços
  apenas para registrar a publicação já concluída.
