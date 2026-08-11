# Merge train, migrations, canário, rollback e deploy

## Proibições atuais

Este runbook é ensaio e documentação. Não executar migration remota, importação,
alteração de workflow, shadow, canário, cutover, hardening, merge ou deploy sem
autorização explícita e separada. Todas as flags permanecem desligadas. Nenhum
passo autoriza `migration repair`, `db push --include-all`, SQL ad hoc ou force
push.

## Gate 0 — congelar release candidate

1. Registrar SHA completo da nova PR e confirmar worktree limpa.
2. Confirmar os heads da tabela abaixo diretamente no GitHub.
3. Confirmar ancestry linear, bases, estado draft/ready e CI no mesmo SHA.
4. Executar a suíte integral no SHA final.
5. Congelar imagem, digest, lockfile, migrations e feature flags.
6. Fechar todas as decisões aplicáveis do
   [pacote único](APPROVAL_PACKAGE.md).

## Merge train empilhado #26–#33

Ordem obrigatória:
`#26 → #27 → #28 → #29 → #30 → #31 → #32 → #33 → novo incremento`.

| Ordem |      PR | Head congelado                             | Base                                      | Entrega/dependência principal                                                                            |
| ----: | ------: | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
|     1 |     #26 | `81968eb72371d5a1a794d48703de41a7feb58f70` | `main`                                    | Fundação visual, catálogo e simuladores visuais.                                                         |
|     2 |     #27 | `7b84ab316cae4695d4da682d8c2512c982b98cdd` | `codex/reference-parity-foundation`       | Reconciliação de fontes/migrations e contrato Qlik inicial.                                              |
|     3 |     #28 | `8ae8a42a7182e432657676e28b4ec29ef7eb354b` | `codex/source-migration-reconciliation`   | Prova remota, scopes/RLS e ponte Qlik; contém efeitos que exigem decomposição antes de migration remota. |
|     4 |     #29 | `96d48b0e64ad85c5020d4ec69b6f1dd0bf408e08` | `codex/supabase-proof-rls-hardening`      | Governança de identidades e read model v3.                                                               |
|     5 |     #30 | `1f570d0a7b3ce64571019b121b0b4aff132e1676` | `codex/integration-read-model-v3`         | Relay/mappings/cutover inerte.                                                                           |
|     6 |     #31 | `d00118fe62296fa3e23e266585899e3ee3a78478` | `codex/qlik-relay-mapping-cutover`        | Runtime versionado dos 14 motores, sem políticas.                                                        |
|     7 |     #32 | `9f1ca6fca7c7ccd179568dc9f92cc19a0e7bce25` | `codex/commercial-engines-policy-runtime` | E2E, release gates e restore local reproduzível.                                                         |
|     8 |     #33 | `b552fa886a1855ffe5eea47b0b52ded8dfd17a92` | `codex/e2e-release-candidate-gates`       | Homologação visual isolada.                                                                              |
|     9 | nova PR | registrar no freeze                        | `codex/homologation-visual-release-gate`  | Fechamento da especificação e readiness de produção.                                                     |

Os oito heads congelados formam ancestry linear desde `main`. Isso reduz risco de
conflito, mas não substitui ensaio no estado atualizado do repositório remoto.

Estratégia de merge:

1. preservar ancestry por merge commits; se squash for obrigatório, restack de
   todos os PRs posteriores antes de continuar;
2. retargetar somente o próximo PR para `main` depois do anterior entrar;
3. executar CI completo no novo head de cada PR;
4. bloquear se base, SHA, lockfile, migrations ou arquivos sobrepostos mudarem;
5. ao final, comparar `git diff --exit-code <RC_SHA> main`;
6. registrar PR, SHA, base, migration, risco, gate e rollback no manifesto final.

Não fazer merge por este runbook enquanto a autorização separada estiver
ausente.

## Histórico remoto observado

O histórico remoto termina em `20260809031936` e contém 17 versões. As dez
migrations abaixo existem somente na árvore futura do release candidate. As
três primeiras possuem versão anterior ou intercalada ao último registro remoto;
um `db push` normal não as aplica como a árvore local e `--include-all` não está
autorizado.

## Ordem das dez migrations futuras

| Ordem | Migration                                                    | Fase pretendida                             | Bloqueio antes de remoto                                                                                                           | Tratamento obrigatório                                                                                                                                                       |
| ----: | ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | `20260807185611_secure_qlik_ingestion_contract.sql`          | Histórico local do contrato Qlik            | Revoga ACL/policies usadas por consumidores legados e tem versão anterior ao remoto máximo.                                        | Não aplicar como está. Preservar como histórico local e levar somente efeitos ainda necessários para uma migration forward revisada. A RPC segura é recriada posteriormente. |
|     2 | `20260808174817_require_sensitive_access_change_reasons.sql` | Hardening auditável de mudanças sensíveis   | Versão anterior ao remoto máximo.                                                                                                  | Reproduzir o trigger/função idempotentes na migration forward, após comparar o schema remoto restaurado.                                                                     |
|     3 | `20260809024000_simulator_visual_catalog.sql`                | Catálogo visual sem regra comercial         | Versão anterior ao remoto máximo; altera catálogo e herança visual.                                                                | Reproduzir somente catálogo/permissão aprovados na migration forward; nenhuma política ou grant comercial.                                                                   |
|     4 | `20260809144137_pending_onboarding_scope_foundation.sql`     | Foundation de onboarding e reporting scopes | Remove permissões v2, desativa perfis não-Master e marca contas como `legacy_review`. Owners, mappings e grants ainda não existem. | Decompor em schema aditivo e enforcement posterior. Não aplicar a conversão de perfis/permissões antes da reconciliação e aprovação por coorte.                              |
|     5 | `20260809144143_qlik_rls_contract_hardening.sql`             | Ponte Qlik e leitura escopada               | Dropa policies de leitura e revoga grants diretos das três tabelas; leitores `GET` residuais não foram atribuídos.                 | Decompor ponte/RPC aditivas do hardening. Preservar caminho legado até relay, leitores, canário e cutover aprovados.                                                         |
|     6 | `20260809181422_integration_identity_governance.sql`         | Owners, mappings, fila e lineage            | Depende da foundation de scopes; owners/mappings reais ausentes.                                                                   | Aplicar somente estrutura vazia após a fase 4 ser aditiva; não seedar owners nem associações.                                                                                |
|     7 | `20260809181424_crm_read_model_v3.sql`                       | Read model v3                               | Depende de scopes/governança; fonte, mappings e grants reais ausentes.                                                             | Aplicar estrutura e permissões sem herança; nenhuma source authority ativa e nenhuma rota produtiva habilitada.                                                              |
|     8 | `20260810165927_qlik_relay_mapping_cutover.sql`              | Relay, importação e observabilidade         | Papel permanece `NOLOGIN`; ACLs estruturais, HMAC, DB credential, owner/backup e leitores estão pendentes.                         | Aplicar somente foundation inerte após preflight de roles; gates vazios, mode off e write false.                                                                             |
|     9 | `20260810201703_commercial_engines_policy_runtime.sql`       | Runtime dos 14 motores                      | Políticas, owners, casos de ouro, grants e gates oficiais ausentes.                                                                | Aplicar somente catálogo/runtime vazio; papel `NOLOGIN`, sem policy, grant, gate ou execução.                                                                                |
|    10 | `20260811120000_commercial_configuration_drafts.sql`         | Rascunho/preview de metas e pontos          | Depende do runtime; rascunho não é política oficial.                                                                               | Manter privado, hashes-only e desconectado de gates/read paths. Nunca promover draft por migration ou seed.                                                                  |

Esta tabela define dependência lógica, não autorização de execução. Os arquivos
`20260807185611`, `20260809144137` e `20260809144143` não podem chegar ao remoto
com os efeitos atuais. A estratégia recomendada é:

1. preservar o histórico remoto e os markers no-op já versionados;
2. decompor as migrations nunca aplicadas remotamente em foundation aditiva e
   fases de enforcement/hardening;
3. criar uma migration forward posterior a `20260811120000`, gerada pela CLI,
   que converta somente os efeitos seguros das versões antigas;
4. manter qualquer desativação de perfil, revogação Qlik e remoção da RPC legada
   em migrations futuras separadas, com precondições verificáveis e autorização
   própria;
5. ensaiar os bytes finais sobre restore representativo antes de escolher
   qualquer comando remoto.

Nunca usar `migration repair` para fingir convergência. Nunca usar
`db push --include-all` ou executar arquivos individuais para contornar a ordem.

## Ensaio obrigatório de backup e restore

1. Capturar inventário e histórico remoto somente por leitura.
2. Criar backup atual criptografado fora do Git, em diretório `0700`, com
   artefatos `0600`, recipient/custódia aprovados e SHA-256.
3. Confirmar checksum antes e depois da transferência.
4. Restaurar em PostgreSQL/Supabase 17 isolado, sem rede pública e sem dados na
   homologação visual.
5. Provar objetos, owners, ACLs, RLS, policies, funções, histórico, contagens
   agregadas e checksums permitidos contra o remoto capturado.
6. Aplicar a sequência futura já decomposta, com todas as flags/gates off.
7. Executar pgTAP, lint/advisors, smoke por perfil, ausência anônima, schema
   drift e comparação antes/depois.
8. Ensaiar rollback lógico e restauração para o fingerprint inicial.
9. Remover o alvo descartável e registrar cleanup; preservar o backup conforme a
   retenção/custódia aprovadas.

O ensaio reproduzível versionado usa duas stacks locais construídas pelas
migrations e declara `representativeRemoteRestore=false`. Separadamente,
[`production-restore-results.json`](production-restore-results.json) registra o
ensaio representativo, somente leitura, do backup produtivo de 11 de agosto:
restore, sequência futura, rollback limpo e cleanup passaram em container sem
rede. Nenhuma dessas provas autoriza migration remota; a decomposição das três
migrations de risco continua obrigatória.

## Sequência app-first e rollback floor

1. Congelar backup/restore, migrations finais, imagem e flags.
2. Publicar somente depois de autorização uma imagem compatível, com read model
   v3, relay e motores desligados. Antes da foundation aditiva, ausência exata
   da RPC de drafts e das colunas/tabelas de onboarding cai para leitura legada
   fail-closed: drafts não carregam, aprovação escopada não aparece e perfis são
   rotulados como legado em revisão. Erros de permissão, rede ou payload não
   usam fallback.
3. Confirmar `/api/health` com `DEPLOYMENT_VERSION`, autenticação, CSP e ausência
   de dados comerciais anônimos.
4. Aplicar apenas foundations aditivas aprovadas e ensaiadas.
5. Confirmar gates, credentials, authorities, mappings, policies e grants reais
   ainda ausentes.
6. Após novas permission keys no banco, o rollback floor da aplicação é esta RC
   ou imagem comprovadamente equivalente e posterior a `d00118f`.
7. Rollback funcional preferido: mesma imagem compatível, flags off, gates
   revogados e dados/auditoria preservados. Não reabrir grants diretos.

## Importações e reconciliação

Nenhuma importação ocorre no deploy da foundation.

1. Owners e backups são aprovados separadamente.
2. Mappings recebem preview, conflito por item, manifesto/hash do plano e dupla
   confirmação; não há matching por nome.
3. Policies comerciais recebem preview, casos de ouro, owner/backup, hashes,
   vigência e grant por engine/coorte.
4. Drafts de metas/pontos permanecem privados e não podem ser tratados como
   policy version.
5. Apply exige autorização remota própria, mesmo com preview verde.

## Shadow e canário

### Relay e read model v3

1. Provisionar credenciais privadas somente após owner/backup, TLS e menor
   privilégio aprovados.
2. Resolver ou descontinuar cada leitor `GET` residual.
3. Importar mappings somente após preview sem conflito e hashes aprovados.
4. Executar duas janelas shadow completas, sem substituir o publisher legado.
5. Comparar contagens, freshness, hashes, rejeições, replay, rate limit,
   cobertura e isolamento por scope.
6. Promover somente a coorte canário aprovada; write exige simultaneamente flag
   runtime e gate DB.
7. Interromper se houver divergência acima do limite, `409`, `429`, `5xx`, atraso,
   ampliação de escopo ou perda de observabilidade.

Rollback: colocar relay em `off`, write em `false`, revogar gate/credential nova,
preservar runs e evidências e manter o publisher legado somente dentro da janela
aprovada. Nunca restaurar `anon`, verifier em argumento ou CRUD direto como
solução permanente.

### Motores comerciais

1. Importar somente uma policy oficial por engine/version e todos os casos de
   ouro aprovados.
2. Executar shadow apenas para engine e coorte permitidos; shadow não retorna
   resultado ao usuário.
3. Conferir ledger, replay, precisão, arredondamento, limites, período e outputs
   contra os casos oficiais.
4. Promover active somente com grant temporal, janela e autorização próprias.
5. No primeiro limiar violado, revogar gate/grant e voltar à versão oficial
   anterior ou desligar o engine.

## Cutover e hardening final

Somente depois de shadow/canário aprovados, mappings/grants reconciliados,
readers residuais zerados e owners/backup presentes:

1. congelar publisher e alterações de políticas na janela;
2. executar cutover pelo comando humano autorizado;
3. provar duas janelas estáveis e rollback ainda executável;
4. em autorização posterior separada, aplicar migration de hardening que remova
   RPC/ACL legada e converta perfis/coortes aprovados;
5. repetir pgTAP, RLS, nove perfis, ausência anônima e smoke;
6. registrar digest, SHA, migrations, flags e aceite de owner/backup.

O hardening nunca participa do mesmo comando que provisiona foundation, importa
mappings, ativa relay ou promove policy.

## Rollback por fase

| Fase              | Ação segura                                                                                             | Proibido como rollback                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Merge train       | Reverter PR/commit conforme estratégia aprovada e rerodar CI.                                           | Force push ou editar histórico compartilhado.                        |
| App flags off     | Reapontar para imagem/digest anterior compatível.                                                       | Voltar a imagem abaixo do rollback floor.                            |
| Foundation DB     | Manter objetos aditivos inertes e flags/gates off; usar migration compensatória revisada se necessário. | Drop/SQL ad hoc ou `migration repair`.                               |
| Mapping/policy    | Suspender authority/gate e aplicar nova decisão auditada.                                               | Update/delete direto, reapontar IDs ou sobrescrever versão.          |
| Shadow/canário    | Retirar coorte, revogar gate/credential nova e preservar ledger.                                        | Reabrir grants de tabela ou distribuir `service_role`.               |
| Cutover/hardening | Pausar novo caller, usar caminho de rollback previamente aprovado e migration compensatória.            | Restaurar exposição anônima, segredo em argumento ou policy sem RLS. |

## Validação reproduzível

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec supabase db reset --local --no-seed
pnpm db:test
pnpm exec supabase db lint --local --level warning --fail-on warning
pnpm exec supabase db advisors --local --type security --level warn --fail-on warn
pnpm exec supabase db advisors --local --type performance --level warn --fail-on warn
pnpm qa:security:rls-api
pnpm qa:e2e:release
pnpm qa:visual:authenticated
pnpm db:rehearse
pnpm audit --audit-level high
pnpm security:secrets
pnpm security:secrets:history
pnpm security:osv
git diff --check
actionlint .github/workflows/ci.yml
```

Também validar imagem Docker/Compose, smoke HTTPS da homologação, health de
produção e ausência de alteração em Supabase, n8n, Qlik, Salesforce, VPS, DNS e
Nginx fora do escopo explicitamente autorizado.
