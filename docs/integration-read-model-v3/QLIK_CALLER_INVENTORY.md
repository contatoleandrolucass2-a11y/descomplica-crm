# Inventário sanitizado de callers Qlik

## Escopo e leitura correta

Este inventário preserva a captura de 9 de agosto de 2026 e incorpora as
evidências sanitizadas obtidas em 10 de agosto de 2026. Nenhuma consulta
mutável, alteração de workflow, grant, rotação de credencial ou operação remota
foi executada para produzi-lo.

Os estados usados abaixo são:

- **confirmado**: há evidência de execução ou alteração atribuível ao papel ou
  componente;
- **potencial**: existe capacidade ou artefato, mas não há prova de execução no
  CRM novo;
- **proposto**: é o desenho de menor privilégio, ainda sem caller implantado;
- **excluído**: o componente foi inspecionado e não é caller do banco novo.

Um grant prova capacidade, não uso. O campo persistido
`source=qlik:23.1-painel-comercial-vendas` é metadado definido pela função e não
identifica processo, pessoa, host ou credencial. A captura de 9 de agosto ainda
não distinguia o caller. A correlação de 10 de agosto confirmou como publisher
o workflow n8n `r4DyPyOTDtoROXq0`, `ranking imobs`, usando o papel `anon`. O
owner técnico do workflow é Leandro Lucas, `global:owner`; owner operacional
formal e backup continuam pendentes. Nenhum uso de `service_role` foi atribuído
a esse caller.

## Matriz de callers e atores

| ID     | Caller e estado                                                                                          | Autenticação observada/proposta                                                                                                                                             | Operações                                                                                                                                                    | Frequência                                                                                                                | Owner                                                                                           | Risco                                                                                                                                        | Menor privilégio                                                                                                                                                         | Impacto de mudança                                                                                        | Rollback seguro                                                                                                                                                      | Evidência       |
| ------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| QLK-01 | **n8n `ranking imobs` (`r4DyPyOTDtoROXq0`); caller remoto ativo e confirmado**                           | Papel efetivo `anon`; headers de publicação e verificador do contrato estão persistidos como literais no workflow. Valores não foram coletados.                             | `EXECUTE` em `publish_crm_imob_ranking(jsonb,text)`. A função `SECURITY DEFINER` cria run, grava entries/developments e conclui o run como owner `postgres`. | Agenda de 30 min; 28 execuções retidas, 27 sucessos e um erro. Os 27 sucessos correlacionaram 1:1 com runs `succeeded`.   | Owner técnico: Leandro Lucas, `global:owner`. Owner operacional formal e backup **pendentes**.  | **P0:** publicação anônima privilegiada e literais persistentes; revogação antes do cutover interrompe carga comprovadamente ativa.          | Caller externo recebe somente HMAC-SHA256 dedicado do relay CRM, com key ID, timestamp, nonce e digest; zero credencial Supabase, tabela, sequência ou função adicional. | Aplicar agora o hardening final remove a RPC e interrompe atualização do ranking.                         | Manter legado até canário aprovado; depois pausar relay e corrigir aditivamente. Nunca restaurar `anon`, segredo em argumento ou CRUD direto.                        | Q1, Q2, Q3, Q11 |
| QLK-02 | **Consumidor remoto de `service_role`, se existir; potencial e não identificado**                        | O remoto concede `service_role` às três tabelas Qlik e à RPC legada. Não há chamada atribuída a essa role nem posse de chave comprovada.                                    | Capacidade de `SELECT`, `INSERT`, `UPDATE` e `DELETE` em runs, entries e developments, além de `EXECUTE` na RPC legada.                                      | Desconhecida; nenhum evento da captura foi atribuído com segurança a esse papel.                                          | **Não identificado.** Nenhum consumer de `service_role` foi localizado; QLK-01 usa `anon`.      | **P0:** privilégio global e CRUD direto sem necessidade/caller provados. Revogar às cegas pode revelar dependência externa tardia.           | Zero grant de tabela; uma RPC exata por papel de máquina dedicado ou relay server-only. `service_role` não sai do ambiente interno.                                      | A revogação pode quebrar um consumidor oculto; mantê-la perpetua exposição ampla.                         | Fazer inventário read-only e ponte aditiva antes da migration final. Se surgir dependência, limitar temporariamente a uma RPC revisada; nunca restaurar CRUD global. | Q2, Q5          |
| QLK-03 | **Estado histórico do mesmo workflow; captura de 7 de agosto supersedida**                               | A captura anterior mostrava credential `supabaseApi` e projeto antigo. A revisão ativa de 10 de agosto usa HTTP Request direto com papel `anon`; nenhum valor foi coletado. | Historicamente três nodes Supabase; na revisão confirmada, solicita o export Qlik, normaliza e chama a RPC legada.                                           | O registro histórico falava em 60 min e não tinha execução; a revisão confirmada agenda 30 min e possui correlação 27/27. | Owner técnico agora confirmado como Leandro Lucas; owner formal e backup continuam pendentes.   | **P1:** usar a captura antiga como estado atual levaria a cutover, credential e rollback incorretos.                                         | Migrar a revisão ativa confirmada para um único HTTP Request ao relay, sem chave Supabase no n8n.                                                                        | Alterar outro workflow não migra o caller ativo; alterar este antes do canário interrompe a publicação.   | Preservar a captura histórica; desativar somente a revisão confirmada na janela aprovada, mantendo rollback lógico.                                                  | Q6, Q11         |
| QLK-04 | **`qlik-ranking-api.service` e `qlik-ranking-export.cjs` da origem; excluídos como callers do Supabase** | API local controlada e sessão de origem Qlik; a auditoria não encontrou cliente ou credencial PostgreSQL/Supabase.                                                          | Autenticar na fonte Qlik e produzir JSON para o workflow. Não executam SQL, DDL, grants ou chamadas Supabase.                                                | Serviço ativo; a cadência efetiva vem do workflow n8n confirmado a cada 30 min.                                           | Owner técnico do processo: usuário de sistema `root`; owner humano/formal **não documentado**.  | **P2:** lacuna operacional de owner; o serviço explica a origem, mas não publica no Supabase sozinho.                                        | Permanecer source-only e entregar saída ao relay por M2M limitado, sem privilégio de banco.                                                                              | Remover o exportador elimina a fonte, mas não revoga nem corrige os grants do CRM.                        | Restaurar somente artefato auditado e configuração protegida após revisão autorizada; não adicionar cliente Supabase.                                                | Q7, Q11         |
| QLK-05 | **Sessão interativa Supabase/Codex; confirmada como ator de ACL, não como publisher**                    | Identidade OAuth do conector por `POST /mcp`; nenhum valor de token foi coletado.                                                                                           | Em 7 de agosto executou `GRANT SELECT` para `anon`/`authenticated` e ampliou duas policies.                                                                  | Um evento interativo comprovado às `04:00:30Z`; sem recorrência automática encontrada.                                    | Identidade técnica do conector conhecida; pessoa/owner nominal não registrado neste inventário. | **P1:** mudança manual privilegiada reabriu exposição e pode ser confundida com automação de ingestão.                                       | ACL/policy somente por migration revisada, identidade operacional própria, aprovação e pgTAP; acesso interativo read-only por padrão.                                    | Revogar acesso interativo sem canal operacional pode atrasar diagnóstico; mantê-lo mutável permite drift. | Corrigir por migration posterior e preservar auditoria; nunca aplicar grants avulsos como rollback.                                                                  | Q8              |
| QLK-06 | **Relay Qlik CRM-owned; candidato local, desligado e não implantado remotamente**                        | Entrada: HMAC-SHA256 exclusivo sobre método, path, key ID, timestamp, nonce e digest; saída por papel PostgreSQL dedicado `NOLOGIN`.                                        | Limitar body antes do parse, validar HMAC/replay/schema, fixar provenance confiável e chamar uma única RPC atômica.                                          | Zero com a flag desligada; exige duas janelas shadow e duas canary antes do active.                                       | Owner operacional e responsável de escalonamento ainda **não formalizados**.                    | **P0 se ativado sem owner/canário ou com helper de isolamento falso**; ACLs `PUBLIC` de `pg_net` e banco ainda bloqueiam `LOGIN`.            | Um endpoint, um key ID, um HMAC, uma RPC; zero tabela, sequência, função adicional ou segredo Supabase no caller externo.                                                | Permite retirar o caminho anônimo após aprovação; no estado atual não muda tráfego nem escrita remota.    | Manter modo `off`, segredos desmontados, papel `NOLOGIN` e RPC inerte. Não reabrir tabelas ou endpoint legado.                                                       | Q9, Q11         |
| QLK-07 | **Leitura CRM Qlik compatível; proposta local, sem caller runtime encontrado**                           | Sessão `authenticated`, permissão `crm.partnerships.view`, mapping de organização verificado/vigente e reporting scope efetivo.                                             | Somente `list_scoped_crm_imob_ranking_entries(limit,offset)`; não expõe runs totais ou developments sem mapping autorizável.                                 | Sob demanda pela aplicação; nenhuma chamada frontend/backend foi localizada na captura.                                   | Processo esperado: aplicação CRM. Owners de mappings reais ainda não foram cadastrados.         | **P1:** declarar disponibilidade antes dos mappings pode expor associação incorreta; a implementação falha fechada para linhas não mapeadas. | RPC de leitura escopada, sem `SELECT` direto nas tabelas e sem `service_role`.                                                                                           | Usuários veem indisponibilidade até mappings e rollout; isso é intencional.                               | Revogar `EXECUTE`/ocultar a superfície e manter dados intactos; não voltar a grants de tabela.                                                                       | Q5, Q10         |
| QLK-08 | **Leitores diretos `GET`; atividade confirmada, consumidor não atribuído**                               | Logs mostram leituras das três tabelas Qlik sem user-agent atribuível; papel, processo e owner não foram correlacionados.                                                   | Leitura direta de runs, entries e developments pela Data API legada.                                                                                         | Presente na amostra recente; frequência de negócio não estabelecida.                                                      | **Não identificado.** Nenhum workflow ativo ou caller do repositório correspondeu às leituras.  | **P1:** aplicar hardening sem classificar o leitor pode revelar dependência oculta; atribuí-lo sem prova cria falso owner.                   | Leitura humana deve migrar para RPC autenticada e escopada; auditorias devem usar canal read-only identificado.                                                          | O hardening removerá a leitura direta; impacto permanece desconhecido até correlação.                     | Correlacionar request ID, origem sanitizada e janela. Nunca preservar `SELECT` anônimo como rollback.                                                                | Q11             |

## Evidências indexadas

- **Q1 — atividade e risco remoto:**
  `docs/supabase-proof/REMOTE_PROOF.md:74-90` registra `anon`, CRUD de
  `service_role`, a RPC legada e 26 execuções; nenhuma revogação é autorizada por
  essa prova.
- **Q2 — implementação e ACL da RPC legada:**
  `docs/supabase-proof/REMOTE_DDL_SANITIZED.sql:1150-1307` mostra a função
  `SECURITY DEFINER`, o verificador sanitizado e as escritas; o `EXECUTE` para
  `anon` e `service_role` está em
  `docs/supabase-proof/REMOTE_DDL_SANITIZED.sql:3985-3990`.
- **Q3 — última janela observada:**
  `docs/reconciliation/REMOTE_SCHEMA_SANITIZED.md:129-140` registra nove runs,
  horários, média e última contagem sanitizada.
- **Q4 — `source` não identifica o caller:**
  `docs/supabase-proof/REMOTE_DDL_SANITIZED.sql:1196-1203` mostra o literal
  persistido pela própria função; a divergência de frequências e a identidade
  ausente estão em `docs/reconciliation/INTEGRATION_CONTRACTS.md:28-33`.
- **Q5 — capacidade remota sem caller de repositório:**
  `docs/supabase-proof/REMOTE_DDL_SANITIZED.sql:4147-4170` lista CRUD direto de
  `service_role`; `docs/supabase-proof/REMOTE_PROOF.md:103-113` registra que
  nenhum caller Qlik frontend/backend foi localizado.
- **Q6 — workflow n8n legado:**
  `docs/runbooks/qlik-ranking-ingestion.md:12-16` registra ID, três operações,
  projeto anterior, trigger e ausência de execução; a conclusão da auditoria
  também está em `WORKLOG.md:220-229`.
- **Q7 — componentes da origem não escrevem no CRM:**
  `docs/SUPABASE_REMOTE_DRIFT_AUDIT.md:108-117` exclui exportador, service,
  scheduler de banco e credentials n8n apontando ao projeto novo.
- **Q8 — ator que reabriu grants/policies:**
  `docs/SUPABASE_REMOTE_DRIFT_AUDIT.md:93-106` registra horário, operações e
  origem OAuth/MCP sem inferir pelo owner SQL.
- **Q9 — contrato final e precondição:**
  `supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql:1-12`
  proíbe aplicação antes do relay; a revogação/drop está em
  `supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql:145-184` e
  a RPC única para `service_role` em
  `supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql:620-629`.
- **Q10 — leitura escopada local:**
  `supabase/migrations/20260809144143_qlik_rls_contract_hardening.sql:631-720`
  exige permissão e mapping por organização, revoga todos os papéis e concede
  somente a `authenticated`.
- **Q11 — identificação definitiva de 10 de agosto:**
  `docs/qlik-relay-mapping-cutover/CALLER_AND_CONSUMERS.md` registra workflow,
  revisão ativa, papel `anon`, owner técnico, upstream, correlação 27/27,
  literais persistentes e leitores `GET` não atribuídos. O registro de
  inspeções somente leitura está em
  `docs/qlik-relay-mapping-cutover/REMOTE_CHANGE_RECORD.md`.

## Provas resolvidas e pendências operacionais

As inspeções de 10 de agosto resolveram, sem exportar segredos:

1. workflow, revisão ativa, nodes e agenda do publisher;
2. papel efetivo `anon` e ausência de uso comprovado de `service_role`;
3. serviço upstream e separação entre fonte e publisher;
4. correlação 27/27 entre execuções n8n bem-sucedidas e runs remotos;
5. owner técnico do workflow.

Continuam pendentes:

1. aceite formal do owner operacional e nomeação de backup;
2. atribuição ou exclusão comprovada dos leitores `GET`;
3. rotação dos literais após canário e limpeza aprovada de histórico/backups;
4. duas janelas shadow e duas janelas canary completas no relay, que permanece
   desligado por padrão;
5. autorização explícita para cutover e hardening final.

## Cutover mínimo e rollback

1. **Ponte aditiva:** disponibilizar a RPC/relay seguro sem remover a RPC legada
   e sem mudar leitores.
2. **Shadow controlado:** executar manualmente, repetir o mesmo payload, exigir
   noop idempotente, reconciliar contagens/hashes e observar duas janelas.
3. **Canário controlado:** somente com isolamento do papel comprovado, ativar a
   candidata do workflow `r4DyPyOTDtoROXq0` e observar duas janelas completas; a
   agenda observada de 30 minutos não substitui SLA aprovado.
4. **Troca do caller confirmado:** promover para active somente depois dos gates
   2+2, sem ampliar a superfície do papel dedicado.
5. **Hardening final autorizado:** revogar `anon`, `EXECUTE` legado e CRUD direto
   de `service_role`, então remover a função legada por migration revisada.
6. **Rollback lógico:** pausar produtor/relay, preservar runs e evidências e
   publicar uma correção aditiva. Nunca restaurar acesso anônimo, segredo em
   argumento, matching por nome ou grants diretos de tabela.

O relay local permanece desligado. O hardening local existente representa o
estado final e falha fechado se aplicado cedo. Ele não substitui a ponte
aditiva nem constitui autorização para alterar o remoto.

O papel `crm_qlik_relay` também permanece `NOLOGIN` e não pode ser ativado:
grants estruturais herdados de `PUBLIC` no Supabase incluem `pg_net` e
`CONNECT`/`TEMP` de banco. A eliminação do bloqueio exige inventário remoto
somente leitura e remediação futura autorizada por `supabase_admin` e owners dos
bancos. `private.crm_qlik_relay_role_isolated()` deve permanecer `false` até
que o papel tenha apenas a superfície aprovada.
