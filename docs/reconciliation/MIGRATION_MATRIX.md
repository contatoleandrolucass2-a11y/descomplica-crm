# Matriz de reconciliação das migrations

## Método e limites

Captura remota: `2026-08-09T05:31:42Z`, projeto
`hnncxuerlcsaahdxoswb`, PostgreSQL `17.6`, por consultas somente leitura.

- `SHA local` é o SHA-256 dos bytes do arquivo versionado.
- `SHA remoto` é o SHA-256 de
  `array_to_string(supabase_migrations.schema_migrations.statements, E'\n')`.
- Os dois hashes não são comparáveis byte a byte: a CLI persiste o SQL remoto
  como array de statements e não como o arquivo original completo.
- “Conciliada” significa mesma versão/nome e equivalência semântica comprovada
  pela auditoria anterior de objetos. Alterações posteriores aparecem como
  migrations separadas, não como divergência retroativa da versão comum.
- Nenhum statement remoto foi executado ou gravado no repositório neste gate.
- As migrations locais posteriores à captura remota também aparecem no
  inventário. Elas não foram aplicadas remotamente e não comprovam cutover.

## Inventário completo

| Ordem | Versão e nome                                                  | Local | Remota | SHA local                                                          | SHA remoto                                                         | Objetos e dependências                                                                                        | Classificação                                               | Evidência e ação proposta                                                                                         |
| ----: | -------------------------------------------------------------- | :---: | :----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
|     1 | `20260519190726_access_control_foundation`                     |  Sim  |  Sim   | `2ba2d793fe1e4a1b5dc2ef4ff33e041da0c73c7b59463d2d6983618b6ac23081` | `46b19fa8e0391c4d249cfdcb99de0ecb5e42774e17cff16d18a9174107b0f7e9` | Perfis, papéis, permissões, auditoria, helpers e RLS; raiz da cadeia.                                         | Local e remota conciliada                                   | Versão/nome e objetos comuns auditados; manter.                                                                   |
|     2 | `20260522010552_access_control_admin_functions`                |  Sim  |  Sim   | `546a0a7c867a56cee1276cbb14d0fc5149eb874b860306feab4bbf8f6eacab20` | `5158b37c83bda94ca6cd2104720839a06734f8fbbdffc5b033556a8e5cbbc9be` | RPCs administrativas; depende do catálogo de acesso.                                                          | Local e remota conciliada                                   | Manter; futuras mudanças de escopo devem substituir funções por migration.                                        |
|     3 | `20260527120000_authorization_context_rpc`                     |  Sim  |  Sim   | `24b4b6624646c94f2f02a885f1aded071e9c3e853d454c3b1b38bc798cf6208d` | `93bd0cf54014e8eeb61216e1becb98463da6242c2f86b444fd2982e447bcbcf2` | Contexto de autorização; depende de perfis, papéis e permissões.                                              | Local e remota conciliada                                   | Manter; hoje retorna capacidade, não escopo comercial.                                                            |
|     4 | `20260721120000_fix_remove_user_permission_override_ambiguity` |  Sim  |  Sim   | `4da629e4fc12e172ffb6caac761ca6dcfac4805e762238af4e2221dfa8617d14` | `7892baf5872d7d70d4666fa4769878937b177315f78c75d8474719f93d0e2f81` | Substitui RPC de remoção de override; depende das RPCs administrativas.                                       | Local e remota conciliada                                   | Manter.                                                                                                           |
|     5 | `20260804041218_page_catalog_and_crm_permissions`              |  Sim  |  Sim   | `2320ed64ffc9d2832a4c4ef22d817773a993ce264304c326f6c9af3bb77fba1b` | `6b48833d231d73cfef885d8748a846012999d51fa4ccadf299c082fe43afbe7f` | Catálogo de páginas, permissões CRM e provisionamento de usuário.                                             | Local e remota conciliada                                   | Manter histórico; provisionamento precisa ser substituído por deny-by-default.                                    |
|     6 | `20260804043416_dashboard_read_model`                          |  Sim  |  Sim   | `6642c2ef85c1147e1aef3d97a385a92ffd43ff18b33f01492d77e223d1219a74` | `9b31ca16b2f405f74bba05d1b84a9f509e627a846a78f20fe61f0852833ee24c` | Quatro tabelas de snapshot global; depende de `crm.dashboard.view`.                                           | Local e remota conciliada                                   | Preservar até read model v3 escopado; não criar filtro cliente sobre snapshot global.                             |
|     7 | `20260804044701_funnel_goals`                                  |  Sim  |  Sim   | `e278502d4a7e792ca280d9ef6cbfc8f6d84aa391cf67c6d3e0fe452b827710c8` | `86d6ed5d1b24715a4e77f96c27e731b489dccf5ee688fc274323e95ce3b416d1` | Metas e RPC de cálculo; depende de auditoria e `crm.settings.manage`.                                         | Local e remota conciliada                                   | Manter histórico; regra e versionamento comercial exigem decisão oficial.                                         |
|     8 | `20260804045945_point_settings`                                |  Sim  |  Sim   | `3f1378dbf263d8ec810abe5f4a69b75931c0d149fd85aac4cefa39ea30696352` | `c4ade9304fcf1f6a4fba76ce367fde490dbbbc51337672460c018b79b5273dae` | Pesos/objetivos e RPC de substituição; depende de auditoria.                                                  | Local e remota conciliada                                   | Manter histórico; não considerar pesos sugeridos política oficial.                                                |
|     9 | `20260804050720_ranking_read_model`                            |  Sim  |  Sim   | `014beb74c174a4433e9364333225f59dc1b6a962ca2d14062d4b1d4cc6c74ead` | `fef7a0e668442ee55e79f8398a62bc57007c4569afb2177eef179ae7f6430d54` | Snapshots/participantes globais; depende de `crm.ranking.view`.                                               | Local e remota conciliada                                   | Preservar até modelo com IDs de organização, equipe e pessoa.                                                     |
|    10 | `20260804052500_secure_salesforce_ingestion`                   |  Sim  |  Sim   | `84cbf1522f7041076b5df5d53769346e5be04b63eafc4b4cff86b267dd6a77ea` | `ffd4b36c614d3e7379e7ecafe2f05a3f58f8f839854b09af1f302c03e2e643f4` | Runs, ingestão/refresh e RPC M2M; depende dos read models.                                                    | Local e remota conciliada                                   | Manter; contrato v3 escopado deve substituir o snapshot global.                                                   |
|    11 | `20260804191713_normalize_new_project_grants`                  |  Sim  |  Sim   | `9b772e61a7a7bc927d98d0df47bec5c8514ab08dac715e8ee8ae0ef8f7405c0a` | `7248b3e52f5c0e1b30f0998380034ce8e5f5851245656cfe3428d2c14ed777da` | Default ACL e allowlist; depende de todos os objetos anteriores.                                              | Local e remota conciliada                                   | Manter; estado remoto posterior divergiu por migrations Qlik.                                                     |
|    12 | `20260806222732_salesforce_source_availability`                |  Sim  |  Sim   | `242da09afdb884787339a2c9b26e68ed984f3098cdda2f6c74f7ff32eea6b1a0` | `29417c09b97d3a838300336c8c6a51e601326611b1d99e072349707951d63d8a` | Flags de metas/roleta e wrapper v2; depende da ingestão Salesforce.                                           | Local e remota conciliada                                   | Manter fail-closed.                                                                                               |
|    13 | `20260807001159_reconcile_remote_imob_schema_and_grants`       |  Sim  |  Sim   | `62fe2e3debdf016cbe33cde9934ad6e62fa08b431d3c36362b27b1abc5dc1001` | `7dec69dd772b68ea94941c64b62c1ff1d0b95697cda12557a6049a548d3adc9a` | Runs/entries Qlik, catálogo e hardening; depende da allowlist.                                                | Local e remota conciliada; depois substituída parcialmente  | Migrations remotas 14–17 reabriram ACL e ampliaram schema; manter como histórico.                                 |
|    14 | `20260807185611_secure_qlik_ingestion_contract`                |  Sim  |  Não   | `30b375f7199574a4a897dc231e7a3b24522487cbc5027107586522b4a2d58355` | —                                                                  | Fecha runs/entries e cria `ingest_crm_imob_ranking_snapshot`; depende da 13.                                  | Somente local; necessária, mas insuficiente                 | Segura para duas tabelas. Não aplicar isoladamente: não cobre developments nem a RPC legada criada depois.        |
|    15 | `20260808174817_require_sensitive_access_change_reasons`       |  Sim  |  Não   | `0d7f29e4fb40397906f0af6e7bb2b13b82ddd0370400da441b81ae69ca694217` | —                                                                  | Função privada e trigger em `audit_logs`; depende das RPCs administrativas.                                   | Somente local; necessária                                   | Trigger/função ausentes no remoto. Fazer preflight e aplicar pelo fluxo oficial após backup.                      |
|    16 | `20260808235856_grant_imob_ranking_service_role`               |  Sim  |  Sim   | `c13c845d2ba2705a07ff7d34407ee25d89f1ca72eac1e79e4060c5ff5a8fd970` | `11070628523162b3dca78628a26d060ceda092afbcfcf18a3a1b420357673d0b` | Marker local no-op; o remoto concedeu CRUD direto de `service_role` em runs/entries.                          | Marker histórico; efeito remoto obsoleto e proibido         | Preserva só versão/nome. Não copia grant; revogação permanece no hardening posterior.                             |
|    17 | `20260809004414_add_atomic_imob_ranking_publish_rpc`           |  Sim  |  Sim   | `596ec3d5642651d7829c74511aa1b42d17e5f352254a88ac73943d20892e82ce` | `dbb139eedb24d2527e92d8dd6e4d326047237f845945bfe81b297ba643042af7` | Marker local no-op; o remoto criou RPC com verificador e execução amplos.                                     | Marker histórico; contrato remoto inseguro e substituído    | Preserva só versão/nome. Não copia verificador, fórmula, função ou grants.                                        |
|    18 | `20260809010942_restrict_imob_ranking_rpc_roles`               |  Sim  |  Sim   | `453be031397dd4693e6c46e88c93b23ea7f21b3aceef148dd402fa89e4c568bd` | `27fc899b0f784238ab9812052270c905cdbdbd20e754eeaea9cd569a2e0b23c5` | Marker local no-op; o remoto removeu `authenticated`, mantendo `anon` e `service_role`.                       | Marker histórico; hardening remoto incompleto               | Preserva só versão/nome; o estado seguro é definido por migrations posteriores.                                   |
|    19 | `20260809024000_simulator_visual_catalog`                      |  Sim  |  Não   | `361aa17cbc3015dc0b1019d80db9ac7143316d9e1e14b54c7c99fb45c8658696` | —                                                                  | Permissão, oito papéis e seis páginas; depende do catálogo.                                                   | Somente local; necessária e aditiva                         | Remoto confirmou permissão e páginas ausentes. Aplicar somente após reconciliação/backup.                         |
|    20 | `20260809031936_qlik_ranking_developments`                     |  Sim  |  Sim   | `d4f2e3cc2d931a285bf05e652b631f2daf49c461cecd2cfedf68624bfe1dfe13` | `c01b7dd375839d776fd8d7cf09b24d6e32c603ec7bca78f7636c51222143e4d0` | Marker local no-op; forma segura de developments é convergida na migration posterior.                         | Marker histórico; estrutura remota preservável              | Preserva só versão/nome. Não copia fórmula, verificador, policy ou grants.                                        |
|    21 | `20260809144137_pending_onboarding_scope_foundation`           |  Sim  |  Não   | `b6f85bcdd389d2907112d9911113f189a1ddb53e512141328a503d9656d8476d` | —                                                                  | Onboarding pending, organizações, equipes, carteiras, pessoas, reporting scopes e grants com delegação/locks. | Somente local; aditiva, sem autorização remota              | Preservar como base do escopo v3; aplicar remotamente somente em gate posterior com backup, dry-run e aprovação.  |
|    22 | `20260809144143_qlik_rls_contract_hardening`                   |  Sim  |  Não   | `057d4fb8392e505e97b8da4e0f2a7e46add85bed408df3701a6980c0d68a2990` | —                                                                  | Preserva developments e a RPC legada; revoga ACL direta e cria ingestão interna/leitura escopada.             | Somente local; ponte aditiva, sem cutover                   | Ensaiar sobre restore: hardening destrutivo exige migration posterior ao relay/cutover.                           |
|    23 | `20260809181422_integration_identity_governance`               |  Sim  |  Não   | `6ba0e176701ee04b8d6c95d1959df0649d90e55f0ab8ad19d4f2fe5322c6987b` | —                                                                  | Owners, mappings versionados, auditoria, fila privada de reconciliação e lineage dos grants.                  | Somente local; aditiva, sem autorização remota              | Depende da foundation de scopes; manter inerte até owners/evidências oficiais e gate remoto separado.             |
|    24 | `20260809181424_crm_read_model_v3`                             |  Sim  |  Não   | `bdf0e05263b2d744b639d5879ed45874c3d79f533c6986d451c51013ab6534ef` | —                                                                  | Autoridades de fonte, dimensões canônicas, runs/fatos/manifesto de escopo imutáveis e RPCs v3 escopadas.      | Somente local; fundação shadow, sem produtor/cutover remoto | Exige tuple de fonte aprovada, mappings reconciliados, dual-write e validação antes de qualquer promoção.         |
|    25 | `20260810165927_qlik_relay_mapping_cutover`                    |  Sim  |  Não   | `d8b7788f4f5809cc5297919818bcd265a2d1259b952b7583bb239c0406e661d5` | —                                                                  | Papel/RPC relay mínimos, gate, ledger sanitizado, autoridades e importação de mappings.                       | Somente local; inerte e sem credenciais reais               | Manter flags off; exige owners, restore, provisioning privado, shadow/canário e autorizações separadas.           |
|    26 | `20260810201703_commercial_engines_policy_runtime`             |  Sim  |  Não   | `9a6e31d75acde57ea75f158fee7b4020eb8f589b5eff1c48ca22826d398a1531` | —                                                                  | Políticas/motores versionados, gates, grants e ledger privados; zero regra real seedada.                      | Somente local; runtime inerte e sem políticas               | Manter flags off; ativação exige políticas, owners, grants e casos de ouro oficialmente aprovados.                |
|    27 | `20260811120000_commercial_configuration_drafts`               |  Sim  |  Não   | `0c6014602ee64f2d6c638a4e7b67eb0a501b6e85657925e50946e04ab296ad3a` | —                                                                  | Rascunhos privados de metas/pontos, preview, revisão otimista e auditoria hashes-only; sem ativação.          | Somente local; intake inerte e Master-only                  | Aplicar apenas na sequência remota aprovada; não cria política, gate, grant ou valor oficial.                     |
|    28 | `20260813115335_emergency_qlik_public_read_hardening`          |  Sim  |  Não   | `111a5d20d09af97b77424d045a763983e86ae2decf9db4461c55ecf8de1c0de7` | —                                                                  | Força RLS, fecha ACL/policies das três tabelas e restringe a RPC legada ao caller `anon` temporário.          | P0 isolada; restore e gate aprovados                        | Aplicar isoladamente; preserva dados/corpo da RPC, não corrige RBAC e nunca reabre leitura pública como rollback. |
|    29 | `20260813140000_partnerships_rbac_convergence`                 |  Sim  |  Não   | `e58f0b0eec61c94958d566c2bc61945e5729172363f6dd6d8400bbfe2944ab9e` | —                                                                  | Cria gate Master-only e alinha catálogo/guard do Canal sem tocar em outras permissões.                        | RBAC isolado; requer restore e gate próprios                | Aplicar isoladamente; não executar migrations pendentes nem misturar com Qlik.                                    |
|    30 | `20260813143000_master_simulator_execution_gate`               |  Sim  |  Não   | `d4c38611f7baa8483187f1efe30aaafe6be28049d5636d9ef2372129d1da5424` | —                                                                  | Concede execução dos simuladores oficiais somente ao Master; flags continuam desligadas.                      | Gate aditivo; requer restore e aplicação isolada            | Aplicar isoladamente; ativar cada motor somente após deploy off, casos de ouro e canário Master.                  |

As quatro versões antes somente remotas agora têm markers locais no-op. A
diferença de hashes é intencional: o SQL remoto sensível/inseguro não foi
copiado; forma e ACL seguras convergem por migrations posteriores. Não há versão
“não identificada”. As versões 14, 15, 19, 21–30 continuam somente locais;
nenhuma foi aplicada ao projeto remoto.

## Recuperação das quatro versões somente remotas

A busca seguiu esta ordem:

1. histórico Git completo, incluindo reflog e objetos não alcançáveis;
2. branches e tags;
3. PRs anteriores, code search e issues do GitHub;
4. artefatos e logs da CI/GitHub Actions;
5. backups acessíveis;
6. diretórios arquivados acessíveis;
7. registros de execução;
8. documentação técnica;
9. `supabase_migrations.schema_migrations` e catálogos do schema remoto atual.

As etapas 1–8 não continham o SQL. A etapa 9 recuperou nome, array de
statements, tamanho e hash exatos. Como o conteúdo inclui um verificador
sensível e grants que reabrem dados, este PR registra apenas hashes e semântica.
Isso comprova a migration histórica sem transformar SQL inseguro em migration
executável.

## Estado atual, lacuna de convergência e bloqueio de ordem Qlik

Os quatro markers fecham o inventário de versões, mas não tornam a aplicação
remota automática nem autorizada. As migrations locais `20260807185611`,
`20260808174817` e `20260809024000` têm versões anteriores ao último registro
remoto (`20260809031936`); portanto um push normal as ignora, enquanto
`--include-all` ampliaria o risco e continua proibido sem restore exato e
aprovação. Aplicar todas as migrations somente locais não constitui hoje uma
sequência remota segura:

- `20260807185611` fecha somente `crm_imob_ranking_runs` e
  `crm_imob_ranking_entries`;
- `crm_imob_ranking_developments` continuaria legível por `anon`;
- `publish_crm_imob_ranking(jsonb,text)` continuaria executável por `anon` como
  `SECURITY DEFINER`;
- os markers não reproduzem os efeitos remotos inseguros nem substituem a
  convergência de objetos;
- `20260809144143` vem antes das migrations v3 e agora preserva explicitamente
  a RPC legada, separando a ponte aditiva do hardening destrutivo;
- `20260810165927` cria o relay e os gates vazios, mas não provisiona login,
  credencial, owner, mapping ou cutover.

Existe agora uma ponte aditiva versionada que preserva o caller identificado,
mas isso não autoriza aplicação remota. Drift, restore, owner operacional,
backup, leitores residuais, provisionamento privado, duas janelas shadow,
canário e autorização explícita ainda são gates. O hardening final permanece
fora da pilha e exige cutover estável.

O plano seguro para o próximo gate é:

1. formalizar owner operacional e backup do caller técnico já identificado;
2. preservar os quatro markers históricos no-op, sem copiar verificador,
   grants, fórmula ou DDL remoto inseguro;
3. escolher formalmente entre reversionar/consolidar as três migrations antigas
   ainda locais ou autorizar `--include-all` somente após restore exato;
4. validar que a ponte aditiva preserva a RPC legada em restore representativo;
5. executar reset completo, pgTAP de ACL/RLS e comparação do schema local;
6. obter backup remoto e restauração isolada comprovados;
7. revisar o dry-run completo, incluindo as versões somente locais, os
   markers e a convergência;
8. validar relay shadow por duas janelas e canário controlado antes de agendar a revogação;
9. somente em autorização posterior, aplicar pelo mecanismo oficial e validar
   histórico, objetos, contagens e ausência de exposição.

Não usar `migration repair`, `db push --include-all` ou SQL ad hoc antes dessas
provas. `migration repair` altera apenas o histórico e não corrige o schema.
