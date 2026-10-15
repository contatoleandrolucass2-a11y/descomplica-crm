# Integracao Qlik via VPS

## 15/10/2026: Metadados autenticados

Main9ffc8a9, CI38753275427 com os quatro jobs success. A imagem foi baixada
novamente apos os gates para qlik-owner-verified-9ffc8a9-fJcSJDzQ: ZIP77602d8a,
tar83950120, config5530412d e manifesto local64f2aad6,11 camadas. Prova de dois
perfis aprovada. A preparacao antecipada contrariou a ordem do runbook e nao
foi usada para promover; repeticao posterior corrigiu a sequencia, sem waiver.

Helper do release aprovado preparou qlik-login.cred. Owner3a4698b7-b4b5-48cd-a55f-da61f15e53b9
promovido15:24:46.025Z pelo coordenador, sem pendencia e sem alterar CRM6843ef1.
QIX real acessivel, snapshot privado0TX0aCu9/cf87dcb1,3318bytes, observedAt
15:24:45.675Z e reload14:13:23.247Z. Nenhuma linha de fatos ou cliente lida.
Status pending: partners_membership_unproven. Native sn-tabbed-container usa
referencias childRefId; produto tem supressao de ausentes e aliases VENDAS/VGV.
Este ramo corrige coleta de metadados, nao habilita ranking/fatos/boot.

## Retomada em 15/10/2026

Mainad49634, CI38640654844 com quatro jobs aprovados. Artefato11929858423:
ZIP4c6ed829, tar e91870b2, config CIeda816fd, manifesto/image local1cee9135.
Cadeia de11 camadas e dois perfis runtime conferidos na VPS, sem rebuild.
Dependencias copiadas de lockfile identico tinham arquivos0600; bloqueio
pre-intencao EACCES confirmado pelo probe nao-root. Leitura normalizada somente
na copia candidata, preservando conteudo/ownership/links privados. Probe passou.
Promocao pelo coordenador:159addfc-ba27-4dc4-a623-bdb98c453bac,
deployedAt2026-10-15T13:18:04.215Z, SHAad49634, sem pendencia. Preflight real
reauth_required. CRM6843ef1 segue publicado; ainda sem carga real Qlik.

Falha QA38639662097 reproduzida isoladamente: request contado antes do JSON,
enquanto controller impedia novo evento. Espera foi corrigida sem ampliar
timeouts ou remover assercoes. QA75/75, regressao1/1 e35 testes focais passaram;
regressao integrada a CI. Renovacao de login via cofre autorizado em implementacao.

Registros historicos preservados durante a conciliacao das branches
codex/qlik-ranking-vps e codex/qlik-api-session em14/10/2026. Estados abaixo
tem a data de cada observacao; nao comprovam ativacao posterior.

## 17:52Z: V2 local e owner integrado

GitHub: PR224 head a282b3dde1e660670b1bedba84eb1611beb06b0b,
CI38605138409 concluida success, merge77ddc69d79678d6944c34c5a3ac0f5c8a2ee2f8c.
CI push/main38610165621 pendente. Fontes: GitHub MCP/gh, git fetch e GET publico
https://crm.descomplicapro.com.br/api/health em2026-10-14T17:52:19Z:
HTTP200,ok,version001969010d1d33297b9d42148be95832feefb6ab. Estados distintos.

Checkout canonico77ddc69 criado na VPS; pnpm11.20.0 instalou dependencias
fixadas com ignore-scripts/package-import-method=copy. Nenhum build, suite
pesada, restart, upgrade do owner ou alteracao da imagem CRM na VPS.

Backup privado: /srv/descomplica-backups/qlik-v2-pre-20261014-emn0Ed,
root:root0700. Tres SQL root:root0600 gerados pelo CLI Supabase2.115.0
ligado ao projeto hnncxuerlcsaahdxoswb; bytes/checksums relidos, fsync executado:

| Arquivo     |   Bytes | SHA256                                                           |
| ----------- | ------: | ---------------------------------------------------------------- |
| schema.sql  |  187265 | cc4f19611d5a4264e66407acc4a6d302f4450e1f8d4918e777e03fdb93b9b0a6 |
| data.sql    | 5794245 | a6b0ea1db77f2039ed3e0725f6540f3ccbee986c24cf4e764ad14d05069fbd4c |
| history.sql |  291723 | da1d7a2e17ffd325af604b4ce691373c9bb64ec59b9dbf697f906709bbd08d0e |

Limites: public/private e historico de migrations; schema/dados coletados
separadamente, sem snapshot comum. Nao inclui schemas gerenciados completos,
bytes Storage ou prova de restore deste backup. Nao exportado para chat/Git;
somente metadados acima. O ensaio CI de schema/restore continua obrigatorio
antes da migration aditiva; esse arquivo nao autoriza cadeia global ou DROP.

Candidato local: contrato/endpoint/reader v2, migration isolada e pgTAP254,
publisher limitado e opcao de ativacao HMAC recuperavel. UI real usa reader
autenticado; fixture sintetica Playwright1440/390 revisada, sem overflow ou
sobreposicao, com12 combinacoes largura/tema. Nao comprova Qlik ou RLS real.
pnpm test exit0:3113 Vitest/83 skips, operacionais verdes e release528/14 skips.
Lint/tipos/build/inventario e gitleaks passaram; warning lint legado mantido.
Uma credencial fake hardcoded em teste existente gerava falso positivo;
trocada por fixture gerada, sem ignore/rotacao/mudanca de segredo real.
PostgreSQL e matriz autenticada ficam para CI. Nenhum dado Qlik publicado.

## 2026-10-14: Credenciais systemd e revisao do ciclo

VPS confirmou systemd255.4-1ubuntu8.17. Probe transitorio nao secreto:
LoadCredential=probe:/etc/hostname, usuario tecnico997 e getfacl apenas sobre
metadados, sem ler/imprimir conteudo. Unidade descomplica-qlik-credential-probe
usou --wait/--pipe/--collect, saiu0 em14ms; nenhum owner/CRM alterado.
Diretorio root/root0500 com ACL nominal UID997/r-x e maskr-x (mode0550);
arquivo root/root0400 com ACL nominal UID997/r-- e maskr-- (mode0440).
Group/other sem acesso. Leitor inicial rejeitava esses bits; revisao exige
validar ACL efetiva e principal unico, nao liberar grupo0440 genericamente.
Fonte oficial: systemd/systemd v255 src/core/exec-credential.c, linhas176-191.
Essa prova verifica o mecanismo, nao usa chave real nem autentica o Qlik.

## 2026-10-14: Conexao Qlik para ranking via VPS

- Qlik -> VPS -> /app/ranking: referencia Canal de Parcerias; recorte confirmado
  Direcional/SP CAPITAL/CANAL IMOB, IMOBs/produtos e VGV/contratos. Mapa, limites
  e criterios em [mapeamento](../runbooks/qlik-partnerships-mapping.md).
- Browser rootless/pipe privado e cofre instalados; sessao visual12:47Z valida,
  saved:true, sem segredo lido. Recuperacao excepcional de socket residual,
  backups, causas e criterio de revisao em [sessao](../runbooks/qlik-vps-session.md).
- SDK/preflight desligados, sem coleta. API usa sessao browser;
  OAuth nao e requisito universal. Verify corrigido OK; CI/handshake pendentes.
  Historico/testes no WORKLOG. UI sem fonte; Salesforce/grants intactos.
- Fontes16:57Z: GitHubPR216/224, fetch e health. Main0019690; site200/ok5c4d95e;
  SSH14:51Z: browser2f0907e ativo/disabled. Main conciliado eme85e620;
  CI224/1d96204: codigo/restore/E2E OK, visual rodando. Coleta/RPC pendentes.
  Usuario autorizou duas coletas conciliadas e recorte completo para ranking.view.
- PR224 conciliado com main, sem conflito; detalhes WORKLOG. Sem deploy.

## 2026-10-14: Qlik operacional separado

- Branch codex/qlik-api-session de main5c4d95e; prepara ops/qlik/SDK/runbooks
  sem alterar /app/ranking, Salesforce ou banco. UI e fatos seguem no PR216.
- Fontes GitHub/fetch/health16:22Z: main0019690, site200/ok5c4d95e. SSH15:56Z:
  browser2f0907e ativo/disabled. PR224 draft; instalador corrigido e teste107/3.
  Novo preflight desligado, sem handshake real, coleta, migration ou agenda.
- Usuario autorizou duas coletas independentes conciliadas com totais Qlik
  no lugar do shadow legado e recorte completo para crm.ranking.view. Mapa em
  docs/runbooks/qlik-partnerships-mapping.md e qlik-vps-session.md; WORKLOG
  registra testes e pendencias. Windows falhou symlink Salesforce; Linux validate
  cc8c712 passou CI; main0019690 conciliado em1c5466e. Nova CI pendente.

## 2026-10-14: Revisao local do runtime autonomo

Candidato ainda nao promovido. `qix-ranking` recebeu97 testes aprovados,
incluindo dimensao fisica qIsCalculated=false, estado D nao selecionado e
rejeicao de paginas reduzidas. Totais nativos, pagina completa, selecoes,
recarga e hashes das definicoes continuam obrigatorios. Mapeamento produtivo
ainda depende dos metadados reais; nenhum fixture foi tratado como fonte.

Wrapper/credencial/launcher:158 testes focais aprovados no Node24.19/Windows.
Timeout abrange criacao, navegacao, execucao e descarte da pagina. Descarte
incerto bloqueia reutilizacao e permite somente ao main Linux encerrar o
processo; Restart/KillMode existentes recolhem os filhos. Reinicio real por
essa condicao ainda nao ensaiado. ACL do credential runtime continua exata;
alteracoes de mtime/size em pais compartilhados nao invalidam arquivo intacto.

Engine/CLI:312 testes aprovados apos reproduzir e corrigir fechamento de
recibo sem reconferencia final do owner. Divergencia de unidade/atividade/boot
preserva pendencia. Status/noop indicam evidencia registrada; confirmacao nova
indica verificada. Nao reinterpretar status registrado como ciclo executado agora.

Lint global, typecheck e build passaram. Suite Vitest local teve3173 aprovados,
86 skips e quatro falhas: tres timeouts e seletor CSS antigo; este ultimo foi
corrigido com12 testes focais aprovados. Suite release focada completa no
Windows terminou com varios spawnSync ETIMEDOUT de25s, sem ampliar limites;
uma observacao local mostrou menos de500MB de RAM livre, mas nao prova toda
a causa. CI Linux do runtime combinado continua obrigatoria. Nao executar
essas suites pesadas na VPS compartilhada.

PR227/64d9f24 passou CI38628006919 na segunda tentativa; primeiro E2E falhou
em fill_financing do Associativo, sem mudanca desses arquivos. Causa nao
isolada, nao declarada corrigida pelo rerun. Main6843ef1 documental exigiu
atualizacao pela protecao strict. Novo head4f814a8/CI38635047586 pendente.
Merge automatico indisponivel no repositorio; configuracao nao alterada.
Health publico20:46:44Z200/ok6843ef1, sem evidencia de carga Qlik real.

## 2026-10-14: Validacao combinada e baseline revisada

Suite local com VITEST_MAX_WORKERS=1 terminou exit0 em21:06:34Z:3177 Vitest,
649 ops e664 release aprovados, skips87/19/14. Lint, tipos e build passaram.
Ultima correcao do diagnostico foi posterior,21:06:48Z; possui106 testes
focais/1 skip, lint e formatacao aprovados. Nao atribuir a suite anterior ao
diff posterior. CI Linux combinada continua obrigatoria. Limites de testes
inalterados; concorrencia Vitest limitada reduziu pressao local, sem provar
que toda falha anterior tinha essa causa.

Captura38634304020 aprovada em26m6s,43 testes browser e matriz completa.
Artefato11929276378, ZIP SHA256
b5ade6f21a181ef3331703ff5a8870ecf044e6bee46aeace3d6d7925fb1ad32d verificado
no GitHub, VPS e desktop. Capture548d2f2a9207c5bafabb0d18303bf99aba871c96,
pais6843ef1/679c6fe. Revisao11 imagens aprovada;768 agora mantem abas inteiras.
Todos242 hashes/tamanhos conferidos antes de copiar;231 imagens alheias
identicas. Incorporados somente11 WebP Ranking e manifesto completo original.
154 rotas,88 temas,242 Axe e110 zoom aprovados. Baseline e sintetica e nao
comprova disponibilidade de dados Qlik. CI normal verify permanece obrigatoria.

Consulta SSH20:56Z: ledger CRM57c09296-d8d8-421b-bca7-c12d10b4d50e,
SHA6843ef1, deployedAt2026-10-14T20:38:13.413Z, sem pendencia. Qlik-status
registrado com preflightStatus:null/rankingConnected:false, sem pendencia.
Nenhum upgrade owner, migration, HMAC ou coleta real realizado nesta etapa.

CI38638975238/ff75f51 falhou em Formatting somente no manifesto gerado.
Normalizado pelo Prettier, com assert.deepEqual(JSON.parse(antes),
JSON.parse(depois)) aprovado. SHA256 dos bytes originais
941c62b726abeed916c822f72ce5ad823626ed26117120ed5adf03c8bb3f92a0;
apos formatacao6059b95f1b41af5a7cf1edee045ee16b31f812b0dc105f34d82832230980b6cc.
Nenhum campo, proveniencia ou imagem alterado. Nova CI completa exigida.
CI38634304252 do head679 foi cancelada por substituicao; captura38638975159
duplicava lote ja revisado e foi cancelada. Nao foram removidos gates obrigatorios.
