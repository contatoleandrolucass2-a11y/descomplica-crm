# Integracao Qlik via VPS

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
