# Atualizações de conhecimento

## 2026-10-07 — Conectar Sistemas Salesforce

- Fonte: pedido do usuário, `docs/runbooks/salesforce-n8n-migration.md`,
  `docs/INGESTION.md` e código atual de `ops/salesforce`.
- Status: implementado localmente; validação integral e publicação ainda pendentes.
- Mudança: nova guia `/app/configuracoes/conectar-sistemas` com gate
  `crm.settings.manage`, máscara operacional Salesforce e estado seguro de
  ingestão/refresh sem expor credenciais ao navegador.
- Integração: `ops/salesforce/run-every-30-minutes.mjs` roda ciclos seriais de
  30 minutos, chama o exportador candidato e envia somente o payload v2 para
  `/api/ingest/salesforce` usando Bearer M2M.
- Limite operacional: o runner não renova nem contorna MFA; expiração da sessão
  Salesforce falha fechado e exige novo login manual no Chrome dedicado.
- Pendências: reconciliar a primeira coleta real, configurar segredos por
  ambiente e executar gates finais antes de ativar agenda permanente.
