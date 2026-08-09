# Consumidores e portadores de `service_role`

## Escopo e classificação

Este inventário separa três fatos que não podem ser tratados como equivalentes:

1. um grant permite uma operação;
2. uma credential presente permite que um processo tente usá-la;
3. somente uma execução observada prova um caller ativo.

O estado remoto capturado em 9 de agosto de 2026 difere do estado final
versionado nesta branch. Nenhum segredo, token, cookie ou valor de environment
foi copiado. Nenhuma operação remota foi executada.

`service_role`/secret key é uma credencial global de backend e nunca deve chegar
ao navegador, n8n externo, export de workflow, log ou argumento de processo. Um
campo de payload como `workflowKey`, `producerKey` ou `sourceKey` é provenance
declarada, não autenticação do produtor.

O único caller privilegiado implementado no runtime do repositório é o Route
Handler Salesforce. Seu código chama somente
`ingest_crm_salesforce_snapshot(jsonb)`, mas usa a secret key global; no estado
versionado, essa mesma credencial também pode executar
`ingest_crm_imob_ranking_snapshot(jsonb)` e
`ingest_crm_read_model_v3(jsonb)`. Restringir o código a uma chamada não limita o
blast radius do papel no banco.

Para v3, `private.crm_read_model_v3_sources` exige uma autoridade exata, ativa e
aprovada para dataset/source/workflow/producer, com owner ativo. Isso bloqueia
provenance declarada não aprovada, mas não autentica o produtor nem reduz as
outras capacidades da secret global. Um papel de máquina ou wrapper com zero
tabela e `EXECUTE` em uma única RPC por produtor é mitigação futura, não estado
implantado. Este inventário não rotacionou, revogou, montou ou alterou qualquer
credencial remota.

## Matriz completa de consumidores e não consumidores auditados

| ID    | Caller/estado                                                                                                | Autenticação                                                                                                                                                             | Operações                                                                                                                                                                            | Frequência                                                                                                                                            | Owner                                                                                                                                       | Risco                                                                                                                                                                                             | Menor privilégio                                                                                                                                                              | Impacto de mudança                                                                                                                                                                                  | Rollback seguro                                                                                                                                    | Evidência       |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| SR-01 | **Route Handler `POST /api/ingest/salesforce`; consumer runtime implementado, implantação atual desativada** | Entrada por Bearer M2M Salesforce dedicado; saída pelo cliente server-only criado com secret key Supabase global.                                                        | Valida flag/body/schema e chama somente `ingest_crm_salesforce_snapshot(jsonb)`; a credential também pode executar as RPCs Qlik e v3.                                                | Sob demanda. Snapshot local autorizado: flag de ingestão `false`; três tentativas retidas retornaram `503`; nenhuma escrita bem-sucedida foi provada. | Processo: aplicação Next.js. Owner nominal da integração e da credential **não documentado**.                                               | **P1:** a secret permanece presente no ambiente/container mesmo desativada; comprometimento alcança as três capacidades de ingestão, não apenas a chamada existente no código.                    | Não montar/preservar a secret quando a flag estiver `false`; ao ativar, isolar o worker. Papel de máquina/wrapper com somente `EXECUTE` na RPC Salesforce é mitigação futura. | Limpar a secret com a flag desligada não altera a resposta atual. Trocar o papel sem migrar a rota quebra ingestão futura.                                                                          | Manter flag `false`; restaurar montagem/role somente após teste e autorização. Rotação ocorre depois do inventário, nunca por documentação ou log. | S1, S2, S3, S15 |
| SR-02 | **Grant remoto da RPC Salesforce; consumer exato não comprovado em produção**                                | `service_role` possui `EXECUTE` em `ingest_crm_salesforce_snapshot(jsonb)`. O grant não identifica qual processo tem a credential.                                       | Publicar snapshot Salesforce pela RPC atômica.                                                                                                                                       | Nenhuma execução bem-sucedida apareceu na amostra de acesso local retida; histórico remoto de chamadas não foi obtido.                                | **Não identificado** no plano operacional; SR-01 é o caller de código esperado, não prova uso remoto.                                       | **P1:** capacidade válida sem owner/last-used formal; revogar pode afetar caller externo desconhecido.                                                                                            | Uma identidade de máquina por integração, uma RPC e auditoria de uso; zero tabela.                                                                                            | Revogação prematura pode interromper ingestão futura; manutenção sem owner prolonga credential órfã.                                                                                                | Confirmar last-used/owner read-only; migrar para papel dedicado antes de revogar `service_role`. Regrantar somente a RPC por migration autorizada. | S4              |
| SR-03 | **Caller Qlik ativo; confirmado como `anon`, portanto não é consumer comprovado de `service_role`**          | Papel efetivo `anon` mais verificador no argumento legado; valor não coletado.                                                                                           | Publica pela RPC `SECURITY DEFINER` legada.                                                                                                                                          | 26 execuções catalogadas; 9 runs recentes, média observada 31,7 min.                                                                                  | **Não identificado.**                                                                                                                       | **P0:** exposição anônima ativa e risco de atribuição falsa a `service_role`/n8n.                                                                                                                 | Relay com Bearer próprio e papel DB dedicado ou secret confinada internamente; uma RPC.                                                                                       | Revogar antes do cutover quebra carga ativa.                                                                                                                                                        | Ponte aditiva, duas janelas e hardening final; nunca entregar `service_role` ao caller.                                                            | S5              |
| SR-04 | **Consumer Qlik remoto de `service_role`, se existir; potencial e não identificado**                         | O remoto concede CRUD direto nas três tabelas Qlik e `EXECUTE` na RPC legada a `service_role`; não há evento de uso atribuído.                                           | Pode ler, inserir, alterar e apagar runs/entries/developments, ou publicar pela RPC.                                                                                                 | Desconhecida. Grant não é frequência.                                                                                                                 | **Não identificado; nenhum caller do repositório localizado.**                                                                              | **P0:** capacidade global direta, proibida pela política do repositório, sem necessidade provada.                                                                                                 | Zero tabela; relay chama somente `ingest_crm_imob_ranking_snapshot(jsonb)` por papel de máquina dedicado.                                                                     | Revogar pode revelar dependência oculta; não revogar mantém exposição crítica.                                                                                                                      | Inventário e ponte antes da migration final; se houver dependência, limitar temporariamente à RPC, nunca restaurar CRUD.                           | S4, S5          |
| SR-05 | **n8n `ranking imobs`; consumer potencial apenas do projeto antigo**                                         | Credential `supabaseApi`; tipo de chave/papel não provado e project ref anterior ao CRM novo.                                                                            | Três nodes de escrita direta; sem DDL.                                                                                                                                               | Trigger manual/recursivo de 60 min; ativo sem execução registrada na auditoria.                                                                       | Workflow conhecido; owner nominal/credential **não identificados**.                                                                         | **P1:** pode portar privilégio excessivo no projeto antigo; não é evidência do caller novo.                                                                                                       | HTTP ao relay com M2M dedicado; nenhuma credential Supabase no n8n.                                                                                                           | Reutilização no CRM novo pode duplicar carga e expor a chave; revogação antiga sem owner pode afetar legado.                                                                                        | Candidata inativa e backup root-only; reativar somente contra o projeto antigo enquanto autorizado.                                                | S6              |
| SR-06 | **Relay Qlik server-only; consumer proposto, não implementado**                                              | Entrada M2M específica; saída preferencial por papel DB `NOINHERIT`/sem `BYPASSRLS` com uma assinatura. Uso interno de `service_role` é somente alternativa transitória. | Validar e executar uma RPC Qlik atômica; sem CRUD.                                                                                                                                   | SLA não definido; deve observar ao menos duas janelas antes do cutover.                                                                               | Owner de processo e responsável de escalonamento **não atribuídos**.                                                                        | **P1** enquanto não existe; **P0** se a secret for entregue ao caller externo.                                                                                                                    | Credential/audience por fonte, chamada única, logs redigidos, rotação e egress allowlisted.                                                                                   | Habilita o cutover seguro, mas cria nova superfície de máquina.                                                                                                                                     | Desabilitar relay/M2M e deixar RPC inerte; nunca reabrir tabela ou `anon`.                                                                         | S7              |
| SR-07 | **`ingest_crm_read_model_v3(jsonb)`; capacidade local versionada, sem caller runtime**                       | `EXECUTE` somente para `service_role`; campos de produtor/origem vêm no payload e não autenticam o caller.                                                               | Ingestão v3 atômica, hash de payload, replay, mappings verificados, quarentena/rejeição e publicação de ponteiro; `crm_read_model_v3_sources` exige autoridade ativa/aprovada exata. | Nenhuma: não há Route Handler ou workflow ligado; esta branch é aditiva/local.                                                                        | Owner do processo produtor **não cadastrado**. Owners de mapping e da source authority são controles distintos da identidade da credential. | **P1:** a RPC genérica aceita vários datasets; a authority restringe provenance aceita, mas qualquer portador da secret ainda compartilha as três capacidades e não fica vinculado a um produtor. | Endpoint/worker interno autentica audience e fixa fonte/produtor/workflow fora do payload; wrappers ou papéis dedicados por produtor com uma RPC exata são futuros.           | Revogar agora não afeta runtime conhecido, mas impede o futuro dual-write. Implantar sem binding permite provenance autoatribuída por qualquer portador da secret que conheça uma authority válida. | Manter sem caller remoto; em incidente, revogar `EXECUTE` e suspender a authority do produtor, preservando runs/fatos para auditoria.              | S8, S15         |
| SR-08 | **`scripts/qa/local-rls-api.mjs`; consumer real somente local**                                              | Obtém secret/service-role da saída local do Supabase CLI; fetch e banco são validados como loopback.                                                                     | Auth Admin cria/remove usuários efêmeros; prepara/limpa fixtures e testa RLS/RPCs locais.                                                                                            | Manual via `pnpm qa:security:rls-api`; não faz parte de `pnpm test`/CI normal.                                                                        | Operador local que iniciou o QA; nenhuma conta pessoal é usada pelo script.                                                                 | **P2:** privilégio alto, contido em stack local; risco principal é escape de loopback ou cleanup incompleto.                                                                                      | Chave efêmera da stack local, allowlist de loopback, usuário sintético e cleanup obrigatório.                                                                                 | Remover a capacidade quebra QA de Auth/RLS, não produção.                                                                                                                                           | Parar/recriar a stack local e repetir cleanup; nunca apontar o script ao remoto.                                                                   | S9              |
| SR-09 | **`scripts/qa/local-authenticated-visual.mjs`; consumer real somente local**                                 | Descobre secret local e cria cliente Admin; API/banco precisam ser loopback.                                                                                             | Cria/remove usuário QA e fixtures para smoke visual autenticado.                                                                                                                     | Manual via `pnpm qa:visual:authenticated`; fora da CI normal.                                                                                         | Operador local do QA.                                                                                                                       | **P2:** mesmo limite de stack local e cleanup.                                                                                                                                                    | Secret local efêmera, endpoint loopback, conta sintética e remoção verificada.                                                                                                | Remover impede o smoke autenticado local.                                                                                                                                                           | Encerrar processos, limpar usuário/fixtures e recriar stack descartável.                                                                           | S10             |
| SR-10 | **Exportador Salesforce candidato; excluído como consumer Supabase**                                         | Sessão Salesforce `sid` obtida de Chrome já autenticado com MFA; nenhum valor é persistido no repositório.                                                               | Chama Analytics Reports API `v61.0`, transforma e grava JSON local atômico `0600`; não chama CRM/Supabase.                                                                           | Frequência de 30 min é intenção legada, não scheduler no script.                                                                                      | Operador da sessão MFA e owner Salesforce ainda exigem cadastro formal.                                                                     | **P2:** expiração de sessão/fonte; não justifica `service_role`.                                                                                                                                  | Continuar source-only; enviar o agregado a endpoint M2M, nunca adicionar secret Supabase ao exportador.                                                                       | Remover paralisa a coleta candidata, sem efeito em grants.                                                                                                                                          | Reautenticação MFA e rerun autorizado; não contornar MFA nem copiar cookie.                                                                        | S11             |
| SR-11 | **n8n Salesforce candidato `GnSUcxUhyPYq6d1l`; excluído no estado atual**                                    | Nenhuma credential configurada.                                                                                                                                          | Webhook e validação parcial; responde `202`; não possui node HTTP externo ou destino Supabase.                                                                                       | Inativo e sem agenda.                                                                                                                                 | Workflow conhecido; owner nominal não registrado.                                                                                           | **P2:** ativação prematura poderia criar falsa sensação de ingestão; hoje não porta privilégio.                                                                                                   | Antes de ativar, um único HTTP Request ao CRM com Bearer dedicado e contrato completo; nunca `service_role`.                                                                  | No estado atual, não publica nada.                                                                                                                                                                  | Manter/desativar candidata e preservar export; remover qualquer credential indevida antes de reativação.                                           | S12             |
| SR-12 | **`POST /api/refresh/salesforce`; excluído como consumer de `service_role`**                                 | Sessão SSR `authenticated`, permissão `crm.salesforce.refresh`, mesma origem; webhook externo recebe Bearer próprio.                                                     | RPCs autenticadas de begin/finish e `fetch` ao webhook; não importa o cliente privilegiado.                                                                                          | Sob demanda; flag local atual `false`, URL/secret de refresh vazias.                                                                                  | Usuário autenticado solicitante mais processo Next.js; owner do webhook não cadastrado.                                                     | **P2:** endpoint externo é risco separado, mas não usa secret key Supabase.                                                                                                                       | Manter sessão/permissão/origin/timeout; credential externa distinta.                                                                                                          | Desabilitar impede refresh manual, não a leitura da última base.                                                                                                                                    | Flag `false`; nenhum grant `service_role` deve ser adicionado.                                                                                     | S2, S13         |
| SR-13 | **Workflow legado `Funil de Vendas`; consumer potencial do Supabase antigo, papel desconhecido**             | Credential do workflow antigo não foi classificada como publishable, role limitada ou service role.                                                                      | Alteração externa grava/remove estoque no Supabase anterior; fora do CRM novo.                                                                                                       | Workflow ativo histórico; último processamento completo e frequência atual não são confiáveis.                                                        | Owner da alteração/credential **não identificado**.                                                                                         | **P1:** writer concorrente e privilégio desconhecido; copiá-lo mistura estoque sem contrato no CRM novo.                                                                                          | Manter isolado; exigir owner, schema, papel mínimo e contrato oficial antes de qualquer migração.                                                                             | Revogar sem inventário pode afetar legado; copiar cria superfície não autorizada.                                                                                                                   | Preservar backup e não alterar; nenhuma reativação contra o CRM novo.                                                                              | S14             |
| SR-14 | **pgTAP com `SET LOCAL ROLE service_role`; não é consumer de credential**                                    | Troca de role dentro da conexão local de teste; nenhum secret é carregado pelo SQL.                                                                                      | Prova grants, nega tabelas e exercita RPCs em transação revertida.                                                                                                                   | `pnpm db:test`/execução local de banco, não chamada externa.                                                                                          | Suite de testes do repositório.                                                                                                             | **P2:** falso positivo de inventário se busca textual for tratada como uso real.                                                                                                                  | Manter simulação transacional e stack descartável.                                                                                                                            | Remover reduz cobertura de segurança.                                                                                                                                                               | Reverter a transação/recriar banco local; nunca classificar o teste como caller remoto.                                                            | S15             |

## Superfície de privilégio por estado

| Estado                               | Grants diretos de tabela para `service_role` | RPCs públicas executáveis por `service_role`                                                                           | Uso comprovado                                                                                             |
| ------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Remoto capturado em 2026-08-09       | CRUD nas três tabelas Qlik                   | `ingest_crm_salesforce_snapshot(jsonb)` e a legada `publish_crm_imob_ranking(jsonb,text)`                              | O publisher Qlik ativo foi observado como `anon`; nenhum uso de `service_role` foi atribuído com segurança |
| Estado final versionado nesta branch | Nenhum grant direto em tabela pública        | `ingest_crm_imob_ranking_snapshot(jsonb)`, `ingest_crm_read_model_v3(jsonb)` e `ingest_crm_salesforce_snapshot(jsonb)` | Salesforce possui caller de código, mas está desativado; Qlik relay e produtor v3 não existem no runtime   |

O estado versionado é uma allowlist de capacidades, não autorização para aplicar
migrations remotamente. A divergência Qlik exige cutover do caller ativo antes
da revogação final. A linha Salesforce descreve uma chamada de código; a linha
versionada descreve o alcance real da credencial. Nenhuma mudança de credential
ou ACL remota foi feita durante este inventário.

## Evidências indexadas

- **S1 — caller privilegiado Salesforce:**
  `POST` em `app/api/ingest/salesforce/route.ts` valida flag/Bearer, cria o
  cliente e chama somente `ingest_crm_salesforce_snapshot`; a função
  `createPrivilegedClient` em `lib/auth/supabase/privileged.ts` usa a secret key
  server-only global.
- **S2 — flags e injeção de environment:**
  `getSalesforceIngestConfiguration` em `lib/crm/salesforce/config.ts` falha
  fechado sem flag/credentials; `compose.yaml` e
  `deploy/system/descomplica-configure-env` definem a injeção e persistência dos
  campos de environment.
- **S3 — metadado local autorizado e sanitizado:**
  A inspeção autorizada de metadados de `/etc/descomplica-crm/production.env`
  encontrou modo `0640 root:deploy`, flags Salesforce `false`, secret key/ingest
  secret presentes e refresh URL/secret vazios; valores não foram lidos. A
  amostra sanitizada de `/var/log/nginx/access.log.4.gz` registrou três pares de
  tentativas a ingest/refresh com `503`; IP, user-agent e demais campos não foram
  coletados.
- **S4 — ACL remota:**
  `docs/supabase-proof/REMOTE_DDL_SANITIZED.sql` registra grants das funções
  `ingest_crm_salesforce_snapshot` e `publish_crm_imob_ranking`, além dos grants
  diretos nas três tabelas Qlik.
- **S5 — caller Qlik e identidade ausente:**
  `docs/supabase-proof/REMOTE_PROOF.md` registra a chamada como `anon`, o risco e
  a ausência de caller Qlik no runtime do repositório.
- **S6 — n8n Qlik antigo:**
  `docs/runbooks/qlik-ranking-ingestion.md` registra operações, project ref
  anterior, trigger e ausência de execução.
- **S7 — fronteira Qlik pretendida:**
  `docs/runbooks/qlik-ranking-ingestion.md` proíbe a secret no n8n e define
  relay/papel mínimo; a função `ingest_crm_imob_ranking_snapshot` e seu grant
  estão em
  `supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql`, com ACL
  provada por `supabase/tests/qlik_ingestion_contract.test.sql`.
- **S8 — capacidade v3 sem caller:**
  `docs/INGESTION.md` declara a etapa local sem Route Handler/workflow. A
  migration `20260809181424_crm_read_model_v3.sql` define
  `private.crm_read_model_v3_sources`, `ingest_crm_read_model_v3` e suas ACLs;
  `supabase/tests/read_model_v3.test.sql` prova source authority e nega acesso
  direto, enquanto `supabase/tests/grants_matrix.test.sql` prova a allowlist das
  três RPCs de ingestão.
- **S9 — QA RLS local:**
  `scripts/qa/local-rls-api.mjs` descobre a chave local, força loopback, cria
  usuário sintético e limpa o estado.
- **S10 — QA visual local:**
  `scripts/qa/local-authenticated-visual.mjs` descobre a stack local, cria o
  cliente Admin e prepara/limpa o QA. Os comandos manuais e a CI normal estão
  separados em `package.json` e `.github/workflows/ci.yml`.
- **S11 — exportador Salesforce:**
  `ops/salesforce/export-candidate.mjs` fixa origem/API/relatórios, chama somente
  Salesforce e usa sessão Chrome/MFA com arquivo local `0600`.
- **S12 — candidata n8n Salesforce:**
  `ops/salesforce/n8n-candidate-workflow.json` contém apenas
  webhook/validação/resposta; `ops/salesforce/n8n-candidate.node-test.mjs` prova
  ausência de credential/node externo, e `WORKLOG.md` registra o ID inativo.
- **S13 — refresh não privilegiado:**
  `POST` em `app/api/refresh/salesforce/route.ts` usa sessão/permissão/origin e
  chama o webhook com Bearer distinto.
- **S14 — writer Salesforce/estoque antigo:**
  `docs/runbooks/salesforce-n8n-migration.md` separa candidata, alteração externa,
  projeto antigo e processamento incompleto.
- **S15 — simulação pgTAP:**
  `supabase/tests/grants_matrix.test.sql` prova que `service_role` executa
  exatamente as três RPCs de ingestão; `supabase/tests/read_model_v3.test.sql`,
  `supabase/tests/qlik_ingestion_contract.test.sql` e
  `supabase/tests/secure_ingestion.test.sql` exercitam cada ACL com role local,
  sem credential de runtime.

## Ações P0/P1 antes de qualquer cutover

1. **P0 Qlik:** identificar QLK-01 e qualquer SR-04 com acesso read-only a logs,
   workflows e metadados de credential; não aplicar o hardening final antes
   disso.
2. **P1 custody:** com autorização operacional, remover a secret key do
   container/env quando Salesforce estiver desativado; validar `503` e ausência
   da variável no processo sem exibir valores.
3. **P1 identidade de máquina:** atribuir owner nominal e backup a Salesforce,
   Qlik e produtor v3; registrar audience, last-used e rotação sem armazenar
   secrets na documentação.
4. **P1 redução de privilégio:** criar papéis/wrappers específicos por produtor,
   com zero tabela e uma única RPC. Essa mitigação ainda não existe; o relay deve
   fixar provenance autenticada em vez de confiar nos campos enviados pelo
   payload ou apenas na source authority.
5. Fazer execução manual, replay idêntico, replay conflitante, reconciliação e
   duas janelas em paralelo antes de revogar qualquer caminho anterior.
6. Rotacionar secret key e Bearers somente após inventário de todos os callers e
   autorização explícita; nunca reutilizar uma credential n8n antiga.

## Princípios de rollback

- rollback é lógico e aditivo: suspender caller, revogar a RPC nova e preservar
  runs, fatos, mappings, fila e auditoria;
- não restaurar grants diretos de tabela, `anon`, segredo em argumento ou uma
  secret key no n8n;
- regrantar uma capacidade exige migration revisada, owner, teste de ACL/RLS e
  autorização remota separada;
- QA pode ser recriado apenas na stack local descartável; suas chaves nunca são
  promovidas para homologação ou produção.
