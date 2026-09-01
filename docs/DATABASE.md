# Banco de dados

## Estado atual

O schema versionado usa PostgreSQL 17 no Supabase local. Existem 42 arquivos de
migration: 34 etapas canônicas e sete versões remotas reconciliadas por markers
ou convergências seguras. Nenhuma regra, política ou valor comercial é seedado.
O rebuild contém 39 tabelas públicas,
17 privadas, 12 papéis, 26 permissões e 17 páginas autorizadas. Quatro rotas
futuras de simuladores continuam no código, mas fora do catálogo e respondem
`403` para todo perfil até autorização explícita.

Isso não descreve convergência com produção. A captura somente leitura de 9 de
agosto encontrou quatro versões então somente remotas, hoje representadas por
markers locais sem o SQL inseguro, além de migrations locais ainda não
aplicadas. A exposição Qlik remota segue incompatível com a allowlist. A matriz
completa, hashes e ordem segura estão em
[`docs/reconciliation/MIGRATION_MATRIX.md`](reconciliation/MIGRATION_MATRIX.md).
Somente os gates isolados P0 Qlik e RBAC do Canal foram aplicados remotamente;
nenhum cutover Qlik ou do read model v3 foi realizado.

## Migrations

1. `20260519190726_access_control_foundation.sql`: tabelas, papéis, permissões, RLS e auditoria.
2. `20260522010552_access_control_admin_functions.sql`: funções administrativas e bootstrap master.
3. `20260527120000_authorization_context_rpc.sql`: contexto efetivo de autorização.
4. `20260721120000_fix_remove_user_permission_override_ambiguity.sql`: correção de ambiguidade em override.
5. `20260804041218_page_catalog_and_crm_permissions.sql`: catálogo de páginas, permissões CRM, provisionamento de contas, bloqueio de inativos e RPCs administrativas.
6. `20260804043416_dashboard_read_model.sql`: snapshots, resumos por visão, métricas e empreendimentos do dashboard.
7. `20260804044701_funnel_goals.sql`: metas mensais normalizadas, RLS e upsert auditado dos funis DV/parcerias.
8. `20260804045945_point_settings.sql`: pesos e objetivos normalizados do ranking, RLS e substituição auditada.
9. `20260804050720_ranking_read_model.sql`: snapshots e atividades agregadas do ranking por corretor/período.
10. `20260804052500_secure_salesforce_ingestion.sql`: ingestão transacional e refresh Salesforce auditado.
11. `20260804191713_normalize_new_project_grants.sql`: matriz explícita de grants compatível com os defaults fail-closed dos novos projetos Supabase.
12. `20260806222732_salesforce_source_availability.sql`: flags fail-closed para metas/roleta e wrapper privado do contrato de ingestão v2.
13. `20260807001159_reconcile_remote_imob_schema_and_grants.sql`: versionamento aditivo das tabelas Qlik de ranking de imobiliárias, identidade remota do catálogo e reconstrução fail-closed da matriz de grants.
14. `20260807185611_secure_qlik_ingestion_contract.sql`: correção idempotente do drift Qlik e RPC transacional exclusiva do `service_role`, sem acesso direto às tabelas.
15. `20260808174817_require_sensitive_access_change_reasons.sql`: motivo obrigatório e validação transacional para alterações administrativas sensíveis.
16. `20260808235856_grant_imob_ranking_service_role.sql`: marker histórico no-op; não reproduz o grant direto remoto proibido.
17. `20260809004414_add_atomic_imob_ranking_publish_rpc.sql`: marker histórico no-op; não copia verificador, RPC ou grants remotos.
18. `20260809010942_restrict_imob_ranking_rpc_roles.sql`: marker histórico no-op; não reproduz a execução anônima remota.
19. `20260809024000_simulator_visual_catalog.sql`: permissão de leitura e hierarquia protegida do hub e das cinco jornadas visuais de simulação, sem tabela ou motor comercial.
20. `20260809031936_qlik_ranking_developments.sql`: marker histórico no-op; a forma segura é convergida posteriormente.
21. `20260809144137_pending_onboarding_scope_foundation.sql`: onboarding pendente, hierarquia de reporting scopes, grants temporais/revogáveis, delegação direcional, locks de topologia e administração escopada fail-closed.
22. `20260809144143_qlik_rls_contract_hardening.sql`: ponte Qlik aditiva, limites de payload, ACL sem tabela direta, ingestão interna mínima e leitura humana escopada. Preserva a RPC legada até hardening destrutivo posterior ao cutover.
23. `20260809181422_integration_identity_governance.sql`: owners, mappings externos versionados, histórico auditável, fila de reconciliação e lineage dos grants de reporting scope.
24. `20260809181424_crm_read_model_v3.sql`: autoridades privadas de fonte, dimensões canônicas, runs/fatos imutáveis, ingestão v3 e leitura autenticada por dataset, permissão e scope efetivo.
25. `20260810165927_qlik_relay_mapping_cutover.sql`: papel/RPC exclusivos do relay, credenciais e gates vazios, ledger sanitizado, saúde agregada e importação de mappings com preview/apply atômico.
26. `20260810201703_commercial_engines_policy_runtime.sql`: runtime privado/versionado para motores comerciais, com zero política, gate ou grant real seedado.
27. `20260811120000_commercial_configuration_drafts.sql`: rascunhos privados e versionados de metas/pontos, preview determinístico, optimistic locking e auditoria hashes-only; não existe RPC de ativação.
28. `20260813115335_emergency_qlik_public_read_hardening.sql`: contenção P0 isolada que força RLS, remove policies de leitura, revoga todo acesso direto às três tabelas Qlik e restringe a RPC legada ao caller `anon` temporário com `search_path` seguro; dados e RBAC do Canal permanecem inalterados.
29. `20260813140000_partnerships_rbac_convergence.sql`: convergência RBAC isolada que cria a permissão Master-only do Canal, remove vínculos/overrides residuais apenas dessa chave e alinha `app_pages` ao guard da rota.
30. `20260813151446_emergency_qlik_public_read_recontainment.sql`: roll-forward P0 idempotente que restabelece RLS forçada, remove novamente toda policy de leitura e revoga ACL direta após regressão remota; não reproduz as migrations inseguras nem autoriza rollback público.
31. `20260813143000_master_simulator_execution_gate.sql`: gate aditivo que concede `crm.simulators.execute` somente ao Master, sem ativar fórmula, flag ou integração.
32. `20260814045436_wf13_master_page_access_convergence.sql`: correção forward isolada que cria `crm.simulators.view` Master-only e converge o hub/rota WF13 com o guard, sem ativar outro motor.
33. `20260824230058_auth_mfa_legal_foundation.sql`: recuperação de senha, MFA, sessão lembrada, consentimentos legais privados e convergência exata do catálogo produtivo de 17 páginas.
34. `20260824230100_role_isolation_net_fail_closed.sql`: isolamento fail-closed das funções Auth/MFA por identidade, AAL e grants mínimos, sem alterar integrações ou motores.
35. `20260901204113_multi_master_source_controlled.sql`: remove somente a unicidade legada de Master, preserva lookup indexado e restringe toda nova promoção ao bootstrap owner-only, versionado e auditado.

## Desenvolvimento local

```bash
pnpm db:start
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local
pnpm db:test
pnpm exec supabase db advisors --local --type security
pnpm exec supabase db advisors --local --type performance
pnpm exec supabase db reset --local --no-seed
pnpm db:stop
```

O reset é destrutivo para o banco local. Não use comandos equivalentes contra ambiente remoto sem backup e autorização.

`supabase test db` planeja 1.041 testes pgTAP em 26 arquivos. A cobertura inclui
52 casos da fundação Auth/MFA/legal, 12 do isolamento fail-closed e 12 da
convergência exata de páginas, além das suítes existentes de autorização,
dashboard, Qlik, Salesforce, read models e runtime comercial. Ela verifica nomes,
schema, grants, policies, constraints, disponibilidade e autoridade de fontes,
preservação de dados, mappings, lineage, provisionamento, usuários inativos,
overrides, limites de payload, delegação direcional, cardinalidade de escopo,
serialização de topologia, cálculos e auditoria. Cada novo domínio deve ampliar
esse conjunto.

## RLS e grants

RLS e grants são camadas complementares. Cada nova tabela exposta precisa:

- grants mínimos por papel;
- RLS ativada;
- policies separadas por ação quando necessário;
- índice para colunas usadas pelas policies;
- teste com usuário autorizado e não autorizado;
- auditoria para alterações administrativas.

O advisor de segurança mantém apenas o `INFO` intencional de
`crm_ingestion_runs` com RLS e sem policy, pois a tabela não integra a Data API.
Os avisos informativos de foreign keys sem índice e índices ainda não usados
permanecem registrados para avaliação separada; esta correção de grants não
altera índices. As policies permissivas duplicadas da base de login foram
consolidadas sem alterar a regra self-or-manager.

Os grants são normalizados explicitamente para que projetos anteriores e novos
convirjam. `PUBLIC`/`anon` não acessam objetos da aplicação; `authenticated`
recebe apenas os `SELECT` e RPCs usados pelo SDK SSR; `service_role` recebe
somente as RPCs server-only versionadas de ingestão Salesforce, Qlik e v3.
Default privileges de tabelas, sequências e funções futuras também permanecem
fechados até um `GRANT` versionado. A matriz completa está em
`docs/AUTHORIZATION_MATRIX.md`.

## D1 para PostgreSQL

Modelos e queries do CRM original não serão copiados literalmente. Cada tabela D1 será mapeada para tipo PostgreSQL, constraints, índices, grants e policies; o acesso ocorrerá pelo Supabase SDK/server-side. Drizzle/D1, bindings `env.DB` e imports `cloudflare:` não entram na aplicação final.

O antigo `collaborator_dashboards.payload_json` e a dependência não versionada `sf_relatorio_resumo` foram substituídos no dashboard por quatro tabelas normalizadas. A ingestão ainda não está exposta: navegadores recebem somente `SELECT` limitado por `crm.dashboard.view`.

A dependência não versionada `crm_funnel_goals` do CRM original foi substituída por uma tabela mensal tipada. O legado continua somente leitura na interface. Novas edições passam por preview e rascunho privado; não atualizam a tabela ativa e não podem ser ativadas sem política, owner, caso de ouro, aprovação, gate, coorte, grant, vigência e rollback.

Os JSONs da tabela D1 `point_goals` foram substituídos por `crm_point_settings` e `crm_point_metrics`. O legado continua somente leitura. Novas edições usam o mesmo contrato de rascunho privado; a interface não chama `replace_crm_point_settings` e o ranking comercial permanece fail-closed sem política oficial aprovada.

O ranking legado preserva snapshots e contagens por participante/período para reconciliação, mas seus pesos e fórmula não são autoridade comercial. A rota não calcula nem exibe pontos enquanto o runtime oficial, seus gates e casos de ouro estiverem ausentes.

No schema local proposto, `crm_imob_ranking_runs`,
`crm_imob_ranking_entries` e `crm_imob_ranking_developments` preservam o
histórico externo. `anon`, `authenticated` e `service_role` ficam sem grants
diretos; escrita ocorre somente por `ingest_crm_imob_ranking_snapshot`.
Leitura humana passa por `list_scoped_crm_imob_ranking_entries`, que exige
permissão dedicada, identidade Qlik mapeada e organização dentro do reporting
scope. O remoto ainda mantém RPC legada e grants/policies abertos. O estado
efetivo e a baseline proposta estão no
[pacote de prova](supabase-proof/README.md), não devem ser inferidos apenas das
migrations locais. `20260809144143` agora preserva o caminho legado como ponte
aditiva; `20260810165927` cria somente a fundação inerte. Aplicação remota ainda
exige restore, drift, owners, credenciais privadas e autorizações próprias.
