# Cutover e rollback

## Estado atual: somente local e shadow

As duas migrations desta etapa foram aplicadas apenas ao Supabase local. As
rotas de produção, o catálogo `app_pages` e seus gates v2 permanecem
inalterados. O v3 só pode ser aberto nas rotas autenticadas
`/app/read-model-v3/*` quando o servidor recebe exatamente
`CRM_READ_MODEL_V3_SHADOW_ENABLED=true`; a flag é `false` por padrão, as
rotas não entram na navegação e possuem `noindex`.

Não houve migration remota, alteração de workflow, escrita em dado real, grant
remoto, merge ou deploy.

## Bloqueio P0 da pilha base

A pilha cronológica contém
`20260809144143_qlik_rls_contract_hardening.sql` antes das migrations v3. Essa
migration do PR base remove o caminho legado usado pelo caller Qlik que continua
ativo. Como o processo e o owner nominais do caller ainda não foram
identificados e nenhum relay foi implantado, **a pilha PR #28 + esta PR não é
aplicável remotamente na ordem atual**.

Não existe uma “Fase A” executável apenas rodando as migrations existentes. Antes
de qualquer migration remota, o PR base deve ser reestruturado e revalidado para
separar:

1. ponte aditiva sem revogação do caller atual;
2. relay server-side de menor privilégio;
3. hardening destrutivo, somente depois do cutover aprovado e observado.

Este documento não autoriza editar migration já aplicada, restaurar token em
argumento nem reabrir grants diretos. A correção da ordem precisa de decisão e
PR próprios antes do merge da pilha.

## Pré-requisitos de qualquer publicação v3

1. Identificar processo e owner nominal do caller Qlik ativo.
2. Confirmar por leitura de logs endpoint, principal, origem, frequência e duas
   janelas reais.
3. Obter IDs oficiais das dimensões Salesforce; nomes não atendem o contrato.
4. Provisionar owners formais de mapping e de cada dataset.
5. Reconciliar mappings, vigências e evidências; nenhuma associação por nome.
   Aprovar também o manifesto de escopos que cada snapshot certifica, inclusive
   escopos vazios.
6. Criar relay server-side com credencial própria; nunca entregar
   `service_role` ao navegador ou ao caller externo.
7. Reconciliar contagens, valores decimais, watermarks, duplicidade e escopos.
8. Validar Master, Admin, gestor e corretor com contas QA dedicadas.
9. Obter autorizações separadas para migration remota, alteração de workflow,
   cutover, merge e deploy.

## Autoridade obrigatória da fonte

`ingest_crm_read_model_v3` falha com `42501` enquanto não existir uma linha
ativa em `private.crm_read_model_v3_sources`. A autorização é uma tupla exata:

`dataset_key + source_key + workflow_key + producer_key`

Ela também exige:

- `owner_id` ativo em `private.crm_integration_owners`;
- `approved_at`, `approved_by` e `evidence_reference`;
- `is_active = true`;
- cobertura `complete` quando `require_complete_coverage = true`;
- no máximo uma autoridade ativa por dataset.

Nenhuma autoridade real é seedada nesta PR. Cadastro, rotação ou desativação
devem ocorrer somente por migration revisada. A rotação segura cadastra a nova
tupla inativa, valida o relay em ambiente autorizado e troca os estados na mesma
migration. O rollback desativa a nova tupla; nunca concede acesso direto às
tabelas nem apaga runs.

## Sequência futura proposta

### Fase 0 — corrigir a pilha Qlik

- separar a ponte aditiva do hardening destrutivo do PR base;
- provar que o caller legado segue funcionando após a parte aditiva;
- manter toda a pilha bloqueada para migration remota até essa prova.

### Fase 1 — shadow local/homologação autorizada

- aplicar apenas migrations aprovadas em ambiente não produtivo;
- cadastrar owners, mappings e uma autoridade de fonte por migration;
- manter `CRM_READ_MODEL_V3_SHADOW_ENABLED=false` por padrão;
- habilitar a flag somente durante QA autenticada e desligá-la ao terminar;
- publicar v3 em paralelo, sem alterar `app_pages` ou leitores v2.

### Fase 2 — reconciliação

- provar replay igual/noop e replay conflitante;
- comparar v2/v3 por grão, competência, etapa, dimensão e manifesto de escopo;
- testar cross-tenant, atraso, indisponibilidade e erro;
- medir ingestão e leitura no limite contratual;
- observar duas janelas completas de cada fonte.

### Fase 3 — autorização e interface

- **3A, aplicação primeiro:** publicar uma imagem que reconheça as quatro
  chaves v3, mantendo zero atribuição em `role_permissions`, flag desligada e
  rotas fora do catálogo. Validar autenticação e permissões v2 antes de seguir;
- aprovar a matriz de herança das quatro permissões v3 e reconciliar grants e
  lineage;
- **3B, grant separado:** somente depois do smoke da imagem compatível, aplicar
  migration própria de `role_permissions` para o menor grupo autorizado;
- planejar compatibilidade/redirect de URLs v2 e v3 e criar migration separada
  para o catálogo de navegação;
- trocar leitores por grupo pequeno, com flag e rollback testados;
- antes de voltar para uma imagem que desconheça as chaves v3, revogar suas
  atribuições por migration. Manter permissões novas efetivas durante esse
  rollback pode invalidar todo o contexto de autorização da imagem antiga.

A flag shadow, isoladamente, **não é cutover de produção**.

### Fase 4 — Qlik

- implantar e observar relay seguro;
- trocar o caller com autorização explícita;
- somente então aplicar revogações finais;
- nunca restaurar grants diretos como rollback.

## Rollback lógico do shadow

1. Definir `CRM_READ_MODEL_V3_SHADOW_ENABLED=false` e reiniciar o runtime pelo
   procedimento operacional aprovado.
2. Revogar por migration qualquer atribuição das quatro permissões v3 antes de
   restaurar uma imagem que ainda não reconheça essas chaves.
3. Desativar a autoridade da fonte por migration, se a publicação precisar ser
   pausada.
4. Preservar runs, fatos, mappings, histórico, fila e lineage.
5. Corrigir a origem e publicar um novo run; nunca atualizar fatos imutáveis.
6. Manter as rotas e os gates v2 de produção sem alteração.

## Rollback de ambiente local descartável

Em um banco local sem dados reais, reverter em ordem inversa:

1. revogar RPCs v3;
2. remover ponteiros, competências, fatos e runs;
3. remover a autoridade de fontes e permissões v3;
4. remover triggers, histórico, fila e lineage;
5. restaurar constraints antigas somente após provar ausência de referências.

Em homologação ou produção, o rollback deve ser aditivo e versionado. Não apagar
histórico nem editar uma migration já aplicada.

## Proibições

- não aplicar a pilha atual remotamente;
- não criar autoridade de fonte por endpoint público;
- não usar flag shadow como autorização;
- não reabrir tabelas Qlik para `anon`, `authenticated` ou `service_role`;
- não restaurar segredo em argumento;
- não realizar merge, deploy ou mudança de workflow sem autorização explícita.
