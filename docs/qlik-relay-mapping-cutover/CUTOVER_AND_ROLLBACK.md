# Cutover e rollback do relay Qlik

## Estado atual

Este é um runbook futuro, não um registro de execução. Neste incremento não
houve migration remota, provisionamento de credencial, mudança de workflow,
canário, cutover, merge ou deploy. As duas flags do relay permanecem desligadas
e os catálogos privados permanecem vazios.

## Pré-condições obrigatórias

O executor deve abortar antes da primeira mutação se qualquer item faltar:

- ordem de merges aprovada e SHA da imagem registrado;
- backup restaurável do banco e export sanitizado do workflow, ambos com hash;
- owner operacional e backup distintos, ativos e formalmente responsáveis;
- janela aprovada por Segurança, Dados e Operações;
- conta QA dedicada; nenhuma conta Master/Admin pessoal em automação;
- reader `GET` residual atribuído ou comprovadamente descontinuado;
- migrations ensaiadas sobre restore isolado e drift remoto reconciliado;
- plano de inventário/remediação das ACLs estruturais de `pg_net` e dos bancos
  aprovado pelos respectivos owners; a execução ocorre somente depois da
  instalação inerte criar o helper de readiness;
- credencial HMAC e senha PostgreSQL geradas por canal privado, sem aparecer em
  PR, shell history, logs, argumentos de processo ou export do n8n;
- dashboards/consultas de saúde e canal de alerta acompanhados por duas pessoas;
- workflow legado e procedimento de retorno prontos, sem reabrir acesso direto
  a tabelas.

## Fase 1 — instalação inerte

1. Aplicar somente a pilha aprovada. A ponte em
   `20260809144143_qlik_rls_contract_hardening.sql` deve preservar
   `publish_crm_imob_ranking(jsonb,text)` quando ela existir.
2. Aplicar a migration deste incremento e verificar: papel `NOLOGIN`, zero
   registros nos catálogos novos, RLS forçada e nenhuma flag de runtime ativa.
3. Publicar a imagem ainda com `QLIK_RELAY_MODE=off` e
   `QLIK_RELAY_WRITE_ENABLED=false`.
4. Confirmar que o endpoint retorna `503 ingestion_unavailable` sem ler o body
   e que a carga legada mantém sua cadência e contagens.

Falha em qualquer passo: parar. O legado continua sendo o único publisher.

## Fase 2 — provisionamento privado e shadow

Somente após autorização própria:

1. repetir o inventário somente leitura de ACLs, aplicar apenas em mudança
   separada autorizada a remediação pelos owners `supabase_admin`/dos bancos e
   abortar se o helper de isolamento não retornar `true`;
2. cadastrar os dois owners e a linha de credencial com `enabled=false`;
3. cadastrar o gate `qlik_ranking` como `disabled` e evidenciar rollback;
4. provisionar login/senha do papel dedicado por canal privado; o estado
   versionado `NOLOGIN` garante que a migration isolada não cria acesso útil;
5. validar em conexão descartável pelo mesmo endpoint direto/pooler que será
   usado no runtime que `session_user` é exatamente `crm_qlik_relay`; qualquer
   outro valor fecha o wrapper e exige retorno imediato a `NOLOGIN`;
6. instalar HMAC, key ID e URL PostgreSQL dedicada no cofre/runtime;
7. preparar uma cópia inativa do workflow confirmado para emitir exatamente o
   mesmo body e `requestId`, assinando a requisição canônica;
8. habilitar a credencial e mudar o gate para `shadow` por operação auditada;
9. configurar `QLIK_RELAY_MODE=shadow` e manter write em `false`;
10. fazer a candidata chamar primeiro o caminho legado e depois o relay com os
    mesmos bytes; nunca registrar headers ou body;
11. observar no mínimo duas execuções agendadas distintas com
    `comparisonStatus=matched`, contagens iguais e nenhuma escrita adicional.

Nenhum `LOGIN`, senha, credential, gate habilitado ou configuração de runtime
pode ser criado antes de o passo 1 terminar com o helper em `true`. Se a
remediação de ACL falhar, a instalação inerte permanece e todo o restante desta
fase é abortado.

Replay do mesmo request não conta como nova janela. Qualquer mismatch,
`legacy_run_missing`, `replay_conflict`, rejeição, atraso ou ausência de
telemetria zera o gate e impede canário.

## Fase 3 — canário

Com duas janelas válidas e aprovação humana registrada:

1. escolher uma única execução agendada e pausar o scheduler legado sem apagar
   seu estado;
2. mudar o gate para `canary` e, de forma coordenada, configurar mode `canary`
   e write `true`;
3. publicar um snapshot somente pelo relay;
4. reconciliar request ID, timestamps, row counts, development counts, hashes,
   estado do run e ausência de duplicatas;
5. validar leitura autenticada e isolamento por perfil com contas QA;
6. repetir o canário em uma segunda janela distinta e observar ambas por
   completo antes de ampliar.

O canário falha com qualquer alerta definido em
[Canário e observabilidade](CANARY_OBSERVABILITY.md). Não se corrige falha com
grant de tabela, `service_role`, bypass de RLS ou mudança manual de fatos.

## Fase 4 — cutover

Após aprovação do canário:

1. registrar evidência final e mudar o gate para `cutover`;
2. configurar mode `active` e write `true` na mesma janela operacional;
3. ativar somente o workflow relay e manter o legado pausado, recuperável;
4. observar no mínimo duas janelas completas e comparar cadência, contagens,
   erros, latência e leituras autorizadas;
5. rotacionar o verificador legado e limpar literais/histórico somente depois
   da estabilidade aprovada;
6. abrir um incremento separado para revogar/remover a RPC legada e executar o
   hardening destrutivo. Esta branch não contém essa remoção.

## Rollback imediato

O rollback é lógico, preserva evidências e nunca restaura grants diretos:

1. definir o gate como `rolled_back` ou `disabled`;
2. definir `QLIK_RELAY_MODE=off` e `QLIK_RELAY_WRITE_ENABLED=false`;
3. desabilitar a linha de credencial e reiniciar somente o runtime pelo
   procedimento autorizado;
4. pausar a candidata e reativar o workflow legado verificado;
5. confirmar uma execução legada completa e as leituras autenticadas;
6. preservar runs, ledger, batches, mappings, auditoria e logs sanitizados;
7. abrir incidente com request IDs e hashes, nunca com payload ou segredo.

Se o verificador legado já tiver sido rotacionado, o retorno exige credencial
de rollback previamente preparada no cofre. Não reutilizar valor exposto nem
criar usuário em produção durante o incidente.

## Hardening posterior

A revogação de `anon` e a remoção de
`publish_crm_imob_ranking(jsonb,text)` só podem ocorrer em migration nova,
depois de cutover estável, rotação concluída, consumidores residuais resolvidos
e autorização destrutiva explícita. O merge desta branch não satisfaz esses
gates.
