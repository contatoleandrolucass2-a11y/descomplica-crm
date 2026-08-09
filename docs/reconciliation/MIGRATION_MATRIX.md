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

## Inventário completo

| Ordem | Versão e nome                                                  | Local | Remota | SHA local                                                          | SHA remoto                                                         | Objetos e dependências                                                                                | Classificação                                              | Evidência e ação proposta                                                                                      |
| ----: | -------------------------------------------------------------- | :---: | :----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
|     1 | `20260519190726_access_control_foundation`                     |  Sim  |  Sim   | `2ba2d793fe1e4a1b5dc2ef4ff33e041da0c73c7b59463d2d6983618b6ac23081` | `46b19fa8e0391c4d249cfdcb99de0ecb5e42774e17cff16d18a9174107b0f7e9` | Perfis, papéis, permissões, auditoria, helpers e RLS; raiz da cadeia.                                 | Local e remota conciliada                                  | Versão/nome e objetos comuns auditados; manter.                                                                |
|     2 | `20260522010552_access_control_admin_functions`                |  Sim  |  Sim   | `546a0a7c867a56cee1276cbb14d0fc5149eb874b860306feab4bbf8f6eacab20` | `5158b37c83bda94ca6cd2104720839a06734f8fbbdffc5b033556a8e5cbbc9be` | RPCs administrativas; depende do catálogo de acesso.                                                  | Local e remota conciliada                                  | Manter; futuras mudanças de escopo devem substituir funções por migration.                                     |
|     3 | `20260527120000_authorization_context_rpc`                     |  Sim  |  Sim   | `24b4b6624646c94f2f02a885f1aded071e9c3e853d454c3b1b38bc798cf6208d` | `93bd0cf54014e8eeb61216e1becb98463da6242c2f86b444fd2982e447bcbcf2` | Contexto de autorização; depende de perfis, papéis e permissões.                                      | Local e remota conciliada                                  | Manter; hoje retorna capacidade, não escopo comercial.                                                         |
|     4 | `20260721120000_fix_remove_user_permission_override_ambiguity` |  Sim  |  Sim   | `4da629e4fc12e172ffb6caac761ca6dcfac4805e762238af4e2221dfa8617d14` | `7892baf5872d7d70d4666fa4769878937b177315f78c75d8474719f93d0e2f81` | Substitui RPC de remoção de override; depende das RPCs administrativas.                               | Local e remota conciliada                                  | Manter.                                                                                                        |
|     5 | `20260804041218_page_catalog_and_crm_permissions`              |  Sim  |  Sim   | `2320ed64ffc9d2832a4c4ef22d817773a993ce264304c326f6c9af3bb77fba1b` | `6b48833d231d73cfef885d8748a846012999d51fa4ccadf299c082fe43afbe7f` | Catálogo de páginas, permissões CRM e provisionamento de usuário.                                     | Local e remota conciliada                                  | Manter histórico; provisionamento precisa ser substituído por deny-by-default.                                 |
|     6 | `20260804043416_dashboard_read_model`                          |  Sim  |  Sim   | `6642c2ef85c1147e1aef3d97a385a92ffd43ff18b33f01492d77e223d1219a74` | `9b31ca16b2f405f74bba05d1b84a9f509e627a846a78f20fe61f0852833ee24c` | Quatro tabelas de snapshot global; depende de `crm.dashboard.view`.                                   | Local e remota conciliada                                  | Preservar até read model v3 escopado; não criar filtro cliente sobre snapshot global.                          |
|     7 | `20260804044701_funnel_goals`                                  |  Sim  |  Sim   | `e278502d4a7e792ca280d9ef6cbfc8f6d84aa391cf67c6d3e0fe452b827710c8` | `86d6ed5d1b24715a4e77f96c27e731b489dccf5ee688fc274323e95ce3b416d1` | Metas e RPC de cálculo; depende de auditoria e `crm.settings.manage`.                                 | Local e remota conciliada                                  | Manter histórico; regra e versionamento comercial exigem decisão oficial.                                      |
|     8 | `20260804045945_point_settings`                                |  Sim  |  Sim   | `3f1378dbf263d8ec810abe5f4a69b75931c0d149fd85aac4cefa39ea30696352` | `c4ade9304fcf1f6a4fba76ce367fde490dbbbc51337672460c018b79b5273dae` | Pesos/objetivos e RPC de substituição; depende de auditoria.                                          | Local e remota conciliada                                  | Manter histórico; não considerar pesos sugeridos política oficial.                                             |
|     9 | `20260804050720_ranking_read_model`                            |  Sim  |  Sim   | `014beb74c174a4433e9364333225f59dc1b6a962ca2d14062d4b1d4cc6c74ead` | `fef7a0e668442ee55e79f8398a62bc57007c4569afb2177eef179ae7f6430d54` | Snapshots/participantes globais; depende de `crm.ranking.view`.                                       | Local e remota conciliada                                  | Preservar até modelo com IDs de organização, equipe e pessoa.                                                  |
|    10 | `20260804052500_secure_salesforce_ingestion`                   |  Sim  |  Sim   | `84cbf1522f7041076b5df5d53769346e5be04b63eafc4b4cff86b267dd6a77ea` | `ffd4b36c614d3e7379e7ecafe2f05a3f58f8f839854b09af1f302c03e2e643f4` | Runs, ingestão/refresh e RPC M2M; depende dos read models.                                            | Local e remota conciliada                                  | Manter; contrato v3 escopado deve substituir o snapshot global.                                                |
|    11 | `20260804191713_normalize_new_project_grants`                  |  Sim  |  Sim   | `9b772e61a7a7bc927d98d0df47bec5c8514ab08dac715e8ee8ae0ef8f7405c0a` | `7248b3e52f5c0e1b30f0998380034ce8e5f5851245656cfe3428d2c14ed777da` | Default ACL e allowlist; depende de todos os objetos anteriores.                                      | Local e remota conciliada                                  | Manter; estado remoto posterior divergiu por migrations Qlik.                                                  |
|    12 | `20260806222732_salesforce_source_availability`                |  Sim  |  Sim   | `242da09afdb884787339a2c9b26e68ed984f3098cdda2f6c74f7ff32eea6b1a0` | `29417c09b97d3a838300336c8c6a51e601326611b1d99e072349707951d63d8a` | Flags de metas/roleta e wrapper v2; depende da ingestão Salesforce.                                   | Local e remota conciliada                                  | Manter fail-closed.                                                                                            |
|    13 | `20260807001159_reconcile_remote_imob_schema_and_grants`       |  Sim  |  Sim   | `62fe2e3debdf016cbe33cde9934ad6e62fa08b431d3c36362b27b1abc5dc1001` | `7dec69dd772b68ea94941c64b62c1ff1d0b95697cda12557a6049a548d3adc9a` | Runs/entries Qlik, catálogo e hardening; depende da allowlist.                                        | Local e remota conciliada; depois substituída parcialmente | Migrations remotas 14–17 reabriram ACL e ampliaram schema; manter como histórico.                              |
|    14 | `20260807185611_secure_qlik_ingestion_contract`                |  Sim  |  Não   | `30b375f7199574a4a897dc231e7a3b24522487cbc5027107586522b4a2d58355` | —                                                                  | Fecha runs/entries e cria `ingest_crm_imob_ranking_snapshot`; depende da 13.                          | Somente local; necessária, mas insuficiente                | Segura para duas tabelas. Não aplicar isoladamente: não cobre developments nem a RPC legada criada depois.     |
|    15 | `20260808174817_require_sensitive_access_change_reasons`       |  Sim  |  Não   | `0d7f29e4fb40397906f0af6e7bb2b13b82ddd0370400da441b81ae69ca694217` | —                                                                  | Função privada e trigger em `audit_logs`; depende das RPCs administrativas.                           | Somente local; necessária                                  | Trigger/função ausentes no remoto. Fazer preflight e aplicar pelo fluxo oficial após backup.                   |
|    16 | `20260808235856_grant_imob_ranking_service_role`               |  Não  |  Sim   | —                                                                  | `11070628523162b3dca78628a26d060ceda092afbcfcf18a3a1b420357673d0b` | CRUD direto de `service_role` em runs/entries.                                                        | Somente remota; obsoleta e proibida                        | Original recuperada no histórico remoto. Não reproduzir; registrar marker seguro e revogar no hardening final. |
|    17 | `20260809004414_add_atomic_imob_ranking_publish_rpc`           |  Não  |  Sim   | —                                                                  | `dbb139eedb24d2527e92d8dd6e4d326047237f845945bfe81b297ba643042af7` | RPC `SECURITY DEFINER`, verificador embutido e execução para `anon`, `authenticated`, `service_role`. | Somente remota; insegura e substituída                     | Original recuperada. Não versionar o verificador; revogar e remover a RPC após confirmar caller/rotação.       |
|    18 | `20260809010942_restrict_imob_ranking_rpc_roles`               |  Não  |  Sim   | —                                                                  | `27fc899b0f784238ab9812052270c905cdbdbd20e754eeaea9cd569a2e0b23c5` | Remove `authenticated`, mas mantém execução para `anon` e `service_role`.                             | Somente remota; hardening incompleto                       | Original recuperada. Marker histórico seguro; superseder com `REVOKE ALL`.                                     |
|    19 | `20260809024000_simulator_visual_catalog`                      |  Sim  |  Não   | `361aa17cbc3015dc0b1019d80db9ac7143316d9e1e14b54c7c99fb45c8658696` | —                                                                  | Permissão, oito papéis e seis páginas; depende do catálogo.                                           | Somente local; necessária e aditiva                        | Remoto confirmou permissão e páginas ausentes. Aplicar somente após reconciliação/backup.                      |
|    20 | `20260809031936_qlik_ranking_developments`                     |  Não  |  Sim   | —                                                                  | `c01b7dd375839d776fd8d7cf09b24d6e32c603ec7bca78f7636c51222143e4d0` | Coluna de contagem, tabela/índices/policy developments e RPC legada ampliada.                         | Somente remota; estrutura preservável, ACL/RPC obsoletas   | Preservar tabela/dados por convergência fail-closed; não adotar fórmula, verifier ou grants como autoridade.   |

Não foram encontradas migrations divergentes por mesma versão, nem versões
classificadas como “não identificada”. As versões 16–18 são obsoletas ou
substituídas do ponto de vista da política atual, mas continuam sendo fatos
históricos do banco remoto.

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

## Estado atual e lacuna de convergência

Aplicar apenas as três migrations locais ausentes não converge o banco:

- `20260807185611` fecha somente `crm_imob_ranking_runs` e
  `crm_imob_ranking_entries`;
- `crm_imob_ranking_developments` continuaria legível por `anon`;
- `publish_crm_imob_ranking(jsonb,text)` continuaria executável por `anon` como
  `SECURITY DEFINER`;
- o histórico local continuaria sem as quatro versões remotas.

O plano seguro para o próximo gate é:

1. criar markers históricos explicitamente não autoritativos para as quatro
   versões remotas, sem copiar verifier, grants ou fórmula;
2. criar migration de convergência posterior a `20260809031936` que preserve a
   estrutura/dados, feche as três tabelas, revogue/remova a RPC legada e deixe o
   contrato de developments bloqueado;
3. executar reset completo, pgTAP de ACL/RLS e comparação do schema local;
4. obter backup remoto e restauração isolada comprovados;
5. revisar o dry-run completo, incluindo as três versões somente locais e a
   convergência;
6. somente em autorização posterior, aplicar pelo mecanismo oficial e validar
   histórico, objetos, contagens e ausência de exposição.

Não usar `migration repair`, `db push --include-all` ou SQL ad hoc antes dessas
provas. `migration repair` altera apenas o histórico e não corrige o schema.
