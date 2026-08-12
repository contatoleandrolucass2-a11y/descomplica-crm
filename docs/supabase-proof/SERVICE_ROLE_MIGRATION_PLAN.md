# Plano de migração do `service_role`

## Proibição para automação externa

O n8n externo nunca recebe `service_role`, secret key Supabase ou qualquer
credencial com `BYPASSRLS`. Guardar essa chave no cofre interno do n8n reduz
exposição acidental, mas não reduz o privilégio da credencial; portanto não é um
controle suficiente.

Ordem de preferência:

1. relay server-side autenticado por credencial M2M Qlik dedicada, curta,
   rotacionável e sem uso interativo;
2. quando o relay não for viável e houver revisão formal, papel DB dedicado com
   `NOINHERIT`, sem `BYPASSRLS`, sem tabela/sequência e apenas `EXECUTE` na RPC
   exata;
3. nunca acesso direto do n8n com `service_role`.

## Consumidores

| Consumidor                  | Operação/tabela                                                                       | Necessidade                                        | Substituição                                                                                                                                   | Teste                                                                                                                | Rollback                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Rota Salesforce server-only | Publica snapshot em dashboard/ranking/ingestion                                       | Snapshot atômico validado                          | Manter `ingest_crm_salesforce_snapshot(jsonb)`; zero CRUD direto                                                                               | Contrato v2, idempotência, stale/rate limit, grants                                                                  | Reativar versão anterior da RPC; nunca abrir tabelas                                        |
| n8n/Qlik externo            | Hoje publica pela RPC legada como `anon`; workflow antigo também tinha escrita direta | Ingestão periódica, não privilégio Supabase global | Identificar owner e migrar para relay server-side com M2M; alternativa formal é papel DB mínimo para `ingest_crm_imob_ranking_snapshot(jsonb)` | Audience/expiração/replay, schema, limites, idempotência, atomicidade, contagens e ausência de `service_role` no n8n | Manter caminho legado somente na janela controlada; abortar hardening se caller não validar |
| Relay Qlik server-only      | Chama uma RPC de ingestão após validar o caller                                       | Escrita atômica estritamente delimitada            | Confinar credencial Supabase ao servidor ou usar papel DB dedicado; nunca expor a chave ao workflow                                            | Egress/secret scan, ACL da RPC, zero CRUD, logs redigidos e rotação                                                  | Desabilitar relay/M2M; não reabrir tabela nem entregar chave global ao n8n                  |
| `service_role` remoto Qlik  | CRUD direto nas três tabelas                                                          | Nenhum caller do repositório encontrado            | Remover CRUD; se ainda usado transitoriamente pelo relay, limitar o caminho operacional à RPC e planejar papel de máquina menor                | Matriz exige zero table grants; caller externo prova não possuir a chave                                             | Reverter somente por migration revisada e autorização; nunca restaurar segredo no n8n       |
| QA local                    | Cria/remove usuário efêmero                                                           | Exercitar Auth/RLS                                 | Stack local e Admin API local                                                                                                                  | Remoção ao final, nenhuma credencial versionada                                                                      | Parar stack e apagar projeto temporário                                                     |

## Ordem segura

1. congelar inventário de callers e responsáveis;
2. registrar contrato e identificador idempotente;
3. provisionar relay e credencial M2M, ou aprovar formalmente o papel DB mínimo;
4. publicar endpoint/RPC segura sem remover caminho antigo;
5. migrar caller e observar ao menos duas janelas completas;
6. comparar contagens/checksums e falhas;
7. provar que n8n/export/workflow não contém `service_role` ou secret key;
8. revogar EXECUTE legado e CRUD direto em homologação;
9. executar pgTAP/grants/contratos;
10. somente então repetir em produção com autorização.

Não existe plano seguro que comece revogando `service_role`. A migration Qlik
deste PR expressa o estado final desejado, mas seu gate remoto depende do
cutover acima.

Também não existe plano seguro que resolva o cutover entregando `service_role`
ao n8n. A concessão local de `EXECUTE` à role global é somente estado técnico
intermediário; não autoriza distribuir sua credencial nem aplicá-la remotamente.
