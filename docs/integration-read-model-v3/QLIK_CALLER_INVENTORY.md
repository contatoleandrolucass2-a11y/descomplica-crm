# Inventário sanitizado de callers Qlik

## Escopo e leitura correta

Este inventário consolida somente evidências disponíveis em 9 de agosto de 2026. Nenhuma consulta mutável, alteração de workflow, grant, rotação de
credencial ou operação remota foi executada para produzi-lo.

Os estados usados abaixo são:

- **confirmado**: há evidência de execução ou alteração atribuível ao papel ou
  componente;
- **potencial**: existe capacidade ou artefato, mas não há prova de execução no
  CRM novo;
- **proposto**: é o desenho de menor privilégio, ainda sem caller implantado;
- **excluído**: o componente foi inspecionado e não é caller do banco novo.

Um grant prova capacidade, não uso. O campo persistido
`source=qlik:23.1-painel-comercial-vendas` é metadado definido pela função e não
identifica processo, pessoa, host ou credencial. O caller nominal ativo continua
**não identificado**; este documento não infere que ele seja o workflow n8n
conhecido, o exportador auditado ou um consumidor de `service_role`.

## Matriz de callers e atores

| ID     | Caller e estado                                                                                              | Autenticação observada/proposta                                                                                                                                                           | Operações                                                                                                                                                    | Frequência                                                                                                                       | Owner                                                                                           | Risco                                                                                                                                        | Menor privilégio                                                                                                                                                                  | Impacto de mudança                                                                                                         | Rollback seguro                                                                                                                                                                   | Evidência      |
| ------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| QLK-01 | **Caller remoto ativo; confirmado; nome/processo não identificado**                                          | Papel efetivo `anon`; a RPC legada também recebe `sync_token` no argumento. Valor e identidade da credencial não foram coletados.                                                         | `EXECUTE` em `publish_crm_imob_ranking(jsonb,text)`. A função `SECURITY DEFINER` cria run, grava entries/developments e conclui o run como owner `postgres`. | 26 chamadas catalogadas; 9 runs bem-sucedidos entre `00:53:46Z` e `05:07:36Z`, média observada de 31,7 min. Isso não é SLA.      | **Não identificado.** O rótulo `source` não é owner nem identidade.                             | **P0:** publicação anônima privilegiada; revogação antes do cutover também interrompe uma carga comprovadamente ativa.                       | Caller externo recebe somente Bearer M2M dedicado de um relay CRM. O relay usa uma única RPC versionada; preferir papel DB de máquina sem `BYPASSRLS`, tabelas ou outras funções. | Aplicar agora o hardening final remove a RPC e falha fechado, interrompendo atualização do ranking.                        | Antes da revogação, abortar o gate se o caller não validar. Depois do cutover, pausar o relay e corrigir aditivamente; nunca restaurar `anon`, token em argumento ou CRUD direto. | Q1, Q2, Q3, Q4 |
| QLK-02 | **Consumidor remoto de `service_role`, se existir; potencial e não identificado**                            | O remoto concede `service_role` às três tabelas Qlik e à RPC legada. Não há chamada atribuída a essa role nem posse de chave comprovada.                                                  | Capacidade de `SELECT`, `INSERT`, `UPDATE` e `DELETE` em runs, entries e developments, além de `EXECUTE` na RPC legada.                                      | Desconhecida; nenhum evento da captura foi atribuído com segurança a esse papel.                                                 | **Não identificado.** Nenhum caller do repositório foi localizado.                              | **P0:** privilégio global e CRUD direto sem necessidade/caller provados. Revogar às cegas pode revelar dependência externa tardia.           | Zero grant de tabela; uma RPC exata por papel de máquina dedicado ou relay server-only. `service_role` não sai do ambiente interno.                                               | A revogação pode quebrar um consumidor oculto; mantê-la perpetua exposição ampla.                                          | Fazer inventário read-only e ponte aditiva antes da migration final. Se surgir dependência, limitar temporariamente a uma RPC revisada; nunca restaurar CRUD global.              | Q2, Q5         |
| QLK-03 | **n8n legado `ranking imobs` (`r4DyPyOTDtoROXq0`); potencial no projeto antigo, não comprovado no CRM novo** | Credential n8n do tipo `supabaseApi` apontando ao projeto anterior. Tipo de chave, papel, valor, owner e última utilização não foram provados.                                            | Três nodes Supabase: criar run, inserir linhas e concluir run. Não contém DDL.                                                                               | Gatilho manual/recursivo documentado em 60 min; workflow ativo na auditoria, porém sem execução registrada.                      | Workflow conhecido; owner nominal e owner da credential **não identificados**.                  | **P1:** confundir este artefato com QLK-01 causaria cutover incorreto; reutilizar a credential antiga ampliaria exposição.                   | Substituir os três nodes por um único HTTP Request ao relay, com Bearer Qlik próprio; nenhuma chave Supabase no n8n.                                                              | Alterá-lo não garante migrar o caller remoto real. Ativá-lo contra o CRM novo sem prova pode duplicar ou corromper cargas. | Backup root-only com hash; candidata inativa; em falha, desativá-la e manter o legado apenas no projeto antigo, sem copiar credencial.                                            | Q6             |
| QLK-04 | **`qlik-ranking-api.service` e `qlik-ranking-export.cjs` da origem; excluídos como callers do Supabase**     | Autenticação local da API/exportador e sessão Chrome contra Qlik; a auditoria não encontrou cliente ou credencial PostgreSQL/Supabase.                                                    | Autenticar na fonte Qlik e produzir JSON. Não executam SQL, DDL, grants ou chamadas Supabase.                                                                | Nenhum cron, timer, trigger ou job de grant foi encontrado; a cadência do processo de origem não foi estabelecida nesta captura. | Processo técnico conhecido; owner nominal da origem **não documentado** neste repositório.      | **P2:** lacuna operacional de owner/frequência; não explica sozinho a publicação remota.                                                     | Permanecer source-only e enviar saída ao relay por M2M limitado, sem privilégio de banco.                                                                                         | Remover o exportador elimina a fonte, mas não revoga nem corrige os grants do CRM.                                         | Restaurar somente artefato auditado e configuração protegida após revisão autorizada da VPS; não adicionar cliente Supabase.                                                      | Q7             |
| QLK-05 | **Sessão interativa Supabase/Codex; confirmada como ator de ACL, não como publisher**                        | Identidade OAuth do conector por `POST /mcp`; nenhum valor de token foi coletado.                                                                                                         | Em 7 de agosto executou `GRANT SELECT` para `anon`/`authenticated` e ampliou duas policies.                                                                  | Um evento interativo comprovado às `04:00:30Z`; sem recorrência automática encontrada.                                           | Identidade técnica do conector conhecida; pessoa/owner nominal não registrado neste inventário. | **P1:** mudança manual privilegiada reabriu exposição e pode ser confundida com automação de ingestão.                                       | ACL/policy somente por migration revisada, identidade operacional própria, aprovação e pgTAP; acesso interativo read-only por padrão.                                             | Revogar acesso interativo sem canal operacional pode atrasar diagnóstico; mantê-lo mutável permite drift.                  | Corrigir por migration posterior e preservar auditoria; nunca aplicar grants avulsos como rollback.                                                                               | Q8             |
| QLK-06 | **Relay Qlik CRM-owned; proposto, não implantado**                                                           | Entrada: Bearer M2M exclusivo, rotacionável e sem uso interativo. Saída: preferencialmente papel DB dedicado com somente `EXECUTE`; `service_role` apenas como etapa interna excepcional. | Limitar body antes do parse, validar audience/origem/replay/schema, fixar provenance confiável e chamar uma única RPC atômica.                               | SLA ainda não aprovado. O shadow deve cobrir ao menos duas janelas completas e comparar a cadência observada.                    | **Não atribuído.** Exige owner de processo e responsável humano/equipe de escalonamento.        | **P0 se ativado sem owner/caller provado**; **P1** enquanto permanecer uma lacuna de implementação.                                          | Um endpoint, uma audience, uma credential, uma RPC; zero tabela, sequência, função adicional ou segredo Supabase no caller externo.                                               | Introduz nova capacidade de escrita, mas permite retirar o caminho anônimo sem entregar privilégio global ao n8n.          | Desabilitar relay e credential M2M; manter a RPC inerte e os runs preservados. Não reabrir tabelas ou endpoint legado.                                                            | Q9             |
| QLK-07 | **Leitura CRM Qlik compatível; proposta local, sem caller runtime encontrado**                               | Sessão `authenticated`, permissão `crm.partnerships.view`, mapping de organização verificado/vigente e reporting scope efetivo.                                                           | Somente `list_scoped_crm_imob_ranking_entries(limit,offset)`; não expõe runs totais ou developments sem mapping autorizável.                                 | Sob demanda pela aplicação; nenhuma chamada frontend/backend foi localizada na captura.                                          | Processo esperado: aplicação CRM. Owners de mappings reais ainda não foram cadastrados.         | **P1:** declarar disponibilidade antes dos mappings pode expor associação incorreta; a implementação falha fechada para linhas não mapeadas. | RPC de leitura escopada, sem `SELECT` direto nas tabelas e sem `service_role`.                                                                                                    | Usuários veem indisponibilidade até mappings e rollout; isso é intencional.                                                | Revogar `EXECUTE`/ocultar a superfície e manter dados intactos; não voltar a grants de tabela.                                                                                    | Q5, Q10        |

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

## Provas ainda necessárias para identificar QLK-01

Com autorização explícita e acesso somente leitura, coletar sem exportar
segredos:

1. workflow ID, revisão ativa, nós, endpoint e histórico de execução do n8n
   atual;
2. tipo da credential, project ref, owner, criação, rotação e last-used, nunca o
   valor descriptografado;
3. serviço/processo efetivo na VPS de origem, agenda, usuário de sistema e
   destino de egress;
4. logs Supabase/PostgREST da assinatura legada com role, status, latência,
   origem e user-agent sanitizados;
5. correlação por `requestId`/run e contagens durante pelo menos duas janelas;
6. owner nominal e backup operacional para o processo e sua credential.

Até essas provas convergirem, `r4DyPyOTDtoROXq0`, o exportador e qualquer
consumer de `service_role` permanecem hipóteses separadas. Rótulos de payload,
nome de workflow, owner SQL e intervalo aproximado não resolvem identidade.

## Cutover mínimo e rollback

1. **Ponte aditiva:** disponibilizar a RPC/relay seguro sem remover a RPC legada
   e sem mudar leitores.
2. **Shadow controlado:** executar manualmente, repetir o mesmo payload, exigir
   noop idempotente e reconciliar contagens/hashes.
3. **Troca do caller identificado:** ativar somente a candidata e observar duas
   janelas completas; não inferir SLA pela média de 31,7 ou pelo trigger de 60
   minutos.
4. **Hardening final autorizado:** revogar `anon`, `EXECUTE` legado e CRUD direto
   de `service_role`, então remover a função legada por migration revisada.
5. **Rollback lógico:** pausar produtor/relay, preservar runs e evidências e
   publicar uma correção aditiva. Nunca restaurar acesso anônimo, segredo em
   argumento, matching por nome ou grants diretos de tabela.

O hardening local existente representa o estado final e falha fechado se
aplicado cedo. Ele não substitui a ponte aditiva nem constitui autorização para
alterar o remoto.
