# Fundação do relay Qlik e reconciliação de mappings

## Resultado deste incremento

Esta pasta documenta a fundação local do relay autenticado, do catálogo de
autoridades de mapping e do cutover controlado. O estado entregue é
deliberadamente inerte:

- `QLIK_RELAY_MODE=off` e `QLIK_RELAY_WRITE_ENABLED=false` por padrão;
- papel PostgreSQL `crm_qlik_relay` criado como `NOLOGIN` e sem privilégios de
  tabela, sequência ou RPC pública;
- nenhuma credencial, autoridade, organização, equipe, carteira, responsável,
  mapping ou gate real seedado;
- preview de mappings somente para Master autorizado; apply exige flag local,
  manifesto confirmado, plano ainda válido e autoridade ativa no banco;
- caminho legado preservado para não interromper o publisher anônimo antes do
  cutover;
- nenhum ambiente remoto alterado.

O Route Handler `POST /api/ingest/qlik` valida HMAC, timestamp, nonce, digest e
payload antes de abrir a conexão dedicada. Pelas ACLs versionadas do CRM, o
papel recebe somente a RPC `qlik_relay.ingest_snapshot(...)`; porém ele segue
`NOLOGIN` porque privilégios estruturais herdados de `PUBLIC` na plataforma
ainda impedem declarar isolamento efetivo. Shadow não grava fatos comerciais;
canary e active dependem simultaneamente das flags do runtime, do gate privado
e do readiness de isolamento no banco.

## Evidências e runbooks

- [Caller e consumidores](CALLER_AND_CONSUMERS.md)
- [Contrato e threat model](RELAY_CONTRACT_AND_THREAT_MODEL.md)
- [Importação e reconciliação de mappings](MAPPING_IMPORT_AND_RECONCILIATION.md)
- [Canário, métricas e alertas](CANARY_OBSERVABILITY.md)
- [Cutover e rollback](CUTOVER_AND_ROLLBACK.md)
- [Registro de mudança remota](REMOTE_CHANGE_RECORD.md)
- [Relatório de validação](VALIDATION_REPORT.md)

## Gates ainda bloqueados

O caller técnico foi identificado, mas ativação continua proibida até:

1. nomeação e aceite formal de owner operacional e backup distintos;
2. atribuição ou exclusão comprovada dos leitores `GET` residuais;
3. aprovação das autoridades e mappings reais por data stewards oficiais;
4. inventário e remediação autorizada das ACLs `PUBLIC` de `pg_net` e banco,
   até `private.crm_qlik_relay_role_isolated()` retornar `true`;
5. validação de que a conexão escolhida preserva
   `session_user = 'crm_qlik_relay'`, inclusive se usar pooler;
6. provisionamento privado da credencial PostgreSQL e da chave HMAC;
7. autorização separada para migration remota, mudança n8n, canário, cutover,
   hardening, merge e deploy.

## Ordem preservada

`#26 → #27 → #28 → #29 → relay/cutover → motores comerciais → E2E → deploy`

Esta fundação não implementa motores comerciais, filtros sem enforcement,
ranking avançado, roleta, prêmios ou regras de simuladores.
