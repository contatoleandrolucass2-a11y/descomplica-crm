# Historico operacional Qlik

Secao integral preservada por limite do sincronizador durante merge de
main efc6a20. Estados abaixo sao das datas indicadas, nao ativacao atual.

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
