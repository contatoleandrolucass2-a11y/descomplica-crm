# Integracao Qlik via VPS

Registros historicos preservados durante a conciliacao das branches
codex/qlik-ranking-vps e codex/qlik-api-session em14/10/2026. Estados abaixo
tem a data de cada observacao; nao comprovam ativacao posterior.

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
