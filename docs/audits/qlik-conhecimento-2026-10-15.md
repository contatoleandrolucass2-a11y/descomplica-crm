# Registros de conhecimento Qlik recebidos de main

Os registros abaixo foram movidos integralmente de `ATUALIZACOES.md` durante a integração do painel de usuários, somente para respeitar o limite de exportação do arquivo. São evidências históricas das respectivas entregas e não autorizam novas operações.

## 2026-10-15: Renovacao candidata da sessao Qlik

- Owner159addfc/ad49634 promovido13:18:04Z pela CI38640654844 e coordenador;
  resultado real reauth_required. Credencial cifrada systemd e renovacao
  Microsoft Entra em implementacao, conforme autorizacao existente de uso do
  cofre. Focais101/201/32/14 aprovados,2 skips fisicos. Global/CI/uso real
  pendentes. Runbook qlik-vps-session documenta origem, travas e limites.
  Referencias de fatos/ranking copiadas deba96607 sao historico do PR216,
  nao codigo de coleta ja integrado nesta branch operacional.
- API Qlik documenta CSRF204, nao apenas200. Probe candidato/testes corrigidos
  antes do uso real. Chromium final39 passou; review tambem corrigiu titulo
  KMSI duplicado e contagem de senha contida no usuario. ACL systemd real
  confirmada com credencial sintetica; cofre real permanece intocado.

## 2026-10-15: Retomada da conexao Qlik

- Owner Qlik promovido pelo coordenador em13:18:04.215Z:159addfc/ad49634,
  sem pendencia; preflight real reauth_required. Imagem CI11929858423 e cadeia
  de11 camadas conferidas; image:prove2 perfis. EACCES previo foi corrigido
  apenas na leitura da copia candidata de dependencias. CRM permanece6843ef1.
- Corrida da QA dashboard reproduzida: request contado antes de consumir JSON.
  Espera agora acompanha consumo;75 checks,1 regressao e35 testes focais
  aprovados, sem ampliar limites. Regressao acrescentada a CI. Nova CI exigida.

- Fontes13:10Z: git fetch/GitHub e GET publico /api/health. Mainad49634,
  CI push38640654844 concluida com validate, release-gates, isolated-restore
  e promotable-image aprovados. Site200/ok ainda6843ef1. Localab715e6 inclui
  essa main; PR216 remoto ainda precisa novo push/CI apos integracao.
- Falha anterior38639662097 ocorreu na QA sintetica dashboard, espera por nova
  leitura de status apos eventos, sem falha de codigo/formatacao. Investigar
  corrida antes de repetir. Owner, dados e agenda ainda nao comprovados;
  consultar recibos atuais da VPS antes da promocao protegida.

## 2026-10-14: Atualizacao dos identificadores da fonte Qlik

- Retomada20:46Z: PR227/64d9f24 passou CI38628006919 na segunda tentativa.
  Primeira falhou em fill_financing do Associativo, cujos arquivos nao mudaram;
  causa nao isolada, nao declarar correcao por rerun. GitHub confirmou main
  6843ef1/PR225, somente documentos sobre d660ba9. Protecao strict exigiu merge
  dessa base; integrado sem conflitos em2e06e4f, com nova CI obrigatoria.
  GET /api/health20:46:44Z200/ok6843ef1; data/deployment ID ainda exigem
  coordenador ao publicar. Nenhum upgrade Qlik, schema ou fatos publicados.

- Abertura19:40Z, branch codex/qlik-source-refresh, base/main d660ba9.
  Git fetch confirmou main; CI38620208026 com validate/imagem/restore/E2E
  aprovados, matriz visual ainda pendente. Health publico19:40:30Z200/ok77ddc69.
  Fonte GitHub, Git e GET /api/health; nao confundir main com publicado.
- Navegacao autenticada pelo catalogo Qlik: a antiga pasta772db774 retorna
  Pasta nao localizada; 23.1.7 - Vendas agora abre46d5bcf7-965d-40fc-a808-2fdde2d0f74d
  no mesmo aplicativo7c000871. DOM visivel identifica PRODUTO26aed86d e
  containerParceiras8b78e5d8, mantendo tabcIdpUYysrvJ. Sem coleta/exportacao.
  Atualizar somente o preflight e testes; confirmar Engine depois, sem atribuir
  o motivo da republicacao nem presumir estabilidade futura dos IDs.
- Owner VPS segue2f0907e e boot disabled; nenhuma atualizacao real publicada.
  Reavaliar vinculo apos CI/promotion e metadados reais. Nao amplia recorte,
  autorizacoes ou acesso a clientes. Candidato216 continua separado.
