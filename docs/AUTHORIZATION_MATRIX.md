# Matriz de autorização e páginas

## Regras efetivas

A autorização combina o papel do usuário com exceções individuais. Uma exceção `deny` vence tanto `allow` quanto a permissão herdada do papel. Usuários sem perfil ativo não recebem contexto de autorização e falham fechados nas policies RLS.

| Grupo de papéis                                                             | Páginas padrão                                                                                     | Administração                                               |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `master`                                                                    | todas as páginas CRM                                                                               | usuários, papéis, exceções e catálogo                       |
| `admin`                                                                     | todas as páginas CRM                                                                               | usuários, papéis, exceções e catálogo, sujeito à hierarquia |
| `coordinator`, `supervisor`, `real_estate`, `broker_lead`, `broker`, `user` | dashboard, cinco etapas, ranking, Canal de Parcerias e seis páginas visuais de simulação bloqueada | nenhuma                                                     |

As permissões administrativas respeitam hierarquia estrita: o ator somente modifica usuários e papéis abaixo do próprio nível. O próprio usuário não pode alterar seu papel, status ou exceções.

Na interface, as chaves acima continuam técnicas e são enviadas sem tradução às
RPCs. O usuário vê nomes e descrições em português. O papel `master` nunca
aparece entre as opções atribuíveis, mesmo para o próprio Master.

## Catálogo

`public.app_pages` contém 21 registros versionados:

- dashboard, cinco etapas e ranking;
- identidade externa do Canal de Parcerias em `/app/canal-de-parcerias`;
- configurações, metas do funil, parcerias e pontos;
- hub de simulação e cinco jornadas visuais WF13, WF16, CAIXA, WF14 e WF15;
- início administrativo, usuários e catálogo de páginas.

O Canal de Parcerias possui composição visual protegida com estados explícitos
de integração pendente. Ela reutiliza `crm.ranking.view` e não consulta as
tabelas Qlik. O contrato de leitura dos dados continua exigindo incremento
separado antes de qualquer grant.

As seis rotas de simulação exigem `crm.simulators.view`. A permissão integra o
conjunto padrão de leitura CRM dos oito papéis; seus motores continuam sem
submit, fórmula ou persistência. Um administrador pode remover o acesso de um
usuário por override `deny` e pode desativar cada página no catálogo, sem
substituir o guard server-side.

Falta de permissão autenticada usa o interruptor `forbidden()` do Next.js e
retorna a superfície `AUTH-403`; caminhos realmente inexistentes usam
`ROUTE-404`, e falhas inesperadas permanecem 500 com mensagem distinta.

O menu consulta somente páginas ativas, marcadas para navegação e permitidas pela RLS. Ocultar um item não concede nem revoga acesso: cada rota mantém sua guarda server-side e cada operação de dados mantém grants, RLS ou RPC próprios.

## Operações administrativas

- `assign_user_role`: atribui papel e audita.
- `set_user_permission_override`: cria/atualiza exceção `allow` ou `deny` e audita.
- `remove_user_permission_override`: remove exceção e audita.
- `set_user_active`: ativa/desativa conta de nível inferior e audita.
- `list_app_pages_for_management`: lista o catálogo completo apenas para gestores de páginas.
- `set_app_page_active`: ativa/desativa página do catálogo e audita.
- `upsert_crm_funnel_goals`: calcula e grava as metas mensais de um canal e audita.
- `replace_crm_point_settings`: substitui pesos/objetivos do ranking e audita.
- `get_crm_sync_status`: retorna somente timestamps/estados seguros para leitores do dashboard.
- `begin_crm_salesforce_refresh` e `finish_crm_salesforce_refresh`: exigem sessão ativa e `crm.salesforce.refresh`, aplicam lock/cooldown e auditam.
- `ingest_crm_salesforce_snapshot`: disponível somente ao `service_role` do Route Handler M2M; nunca a `authenticated` ou `anon`.
- `ingest_crm_imob_ranking_snapshot`: disponível somente ao `service_role` do workflow Qlik; nunca concede acesso direto às tabelas.

Elevação de papel, desativação de conta e criação/remoção de exceções exigem um
motivo não vazio. A validação roda em trigger `BEFORE INSERT` do log de auditoria
dentro da mesma transação das RPCs: uma tentativa sem motivo reverte papel,
status ou exceção integralmente. Rebaixamento de papel e reativação continuam
aceitando motivo opcional. As regras de sessão ativa, anti-autoelevação,
hierarquia e `can_grant_permission` não mudaram.

Nenhuma dessas tabelas aceita escrita direta do papel `authenticated`. A RLS de `app_pages` nunca concede o bypass administrativo usado pela tela de gestão; o catálogo completo sai exclusivamente pela RPC protegida. O navegador chama somente RPCs `security definer` que revalidam sessão, perfil ativo, permissão e hierarquia no banco.

As páginas de metas exigem `crm.settings.manage` na rota e na Server Action. A tabela `crm_funnel_goals` repete a verificação na RLS, e a RPC de escrita revalida sessão, conta ativa, permissão e limites antes de alterar qualquer linha.

As tabelas de pontos aceitam leitura com `crm.ranking.view` ou `crm.settings.manage`. A rota de configuração e a RPC de substituição exigem `crm.settings.manage`; negar `crm.ranking.view` remove a leitura para papéis comerciais sem permissão administrativa.

O read model do ranking exige `crm.ranking.view` na rota e nas duas policies RLS. A tabela não expõe escrita a `authenticated` nem a `service_role`; a ingestão server-side altera o read model somente pela RPC transacional, sem credencial privilegiada no bundle da aplicação.

Cada detalhe de etapa exige `crm.stages.view` e reutiliza as tabelas do dashboard, cuja RLS exige `crm.dashboard.view`. Os papéis comerciais recebem ambas por padrão; um override `deny` em qualquer camada faz a leitura falhar fechada.

`crm_ingestion_runs` não concede acesso direto a navegador algum. O controle Salesforce só é renderizado com `crm.salesforce.refresh`; quando a capacidade está desativada ou incompleta, ele permanece desabilitado e não chama o endpoint. O status exige `crm.dashboard.view`. A ingestão usa credencial de máquina separada da sessão humana e sua função possui grant exclusivo.

## Matriz de grants da Data API

`PUBLIC` e `anon` não possuem privilégio em tabela, sequência ou função da
aplicação. `authenticated` recebe somente `SELECT` nas tabelas consultadas pelo
SDK SSR: catálogo de páginas, auditoria, perfis/papéis/overrides de usuários e
os read models do CRM. As tabelas `roles`, `permissions`, `role_permissions` e
`crm_ingestion_runs` não são consultadas diretamente pelo cliente e permanecem
sem grant.

O papel `authenticated` não recebe escrita, `TRUNCATE`, `REFERENCES`, `TRIGGER`
ou `MAINTAIN`. As mutações passam exclusivamente pelas RPCs listadas acima.
`has_permission` também conserva `EXECUTE` porque é chamada pelas policies RLS;
os helpers `get_role_level`, `can_assign_role` e `can_grant_permission` não são
RPCs públicas da aplicação.

`service_role` não recebe acesso direto a tabelas ou sequências. Os únicos grants
comprovados são `EXECUTE` em `ingest_crm_salesforce_snapshot`, chamada pelo Route
Handler server-only, e `ingest_crm_imob_ranking_snapshot`, chamada pelo workflow
Qlik protegido; ambas executam as escritas como transações `SECURITY DEFINER`.
`bootstrap_master_user` permanece exclusiva do proprietário
`postgres`, conforme o runbook operacional.

As tabelas externas `crm_imob_ranking_runs` e `crm_imob_ranking_entries` não fazem parte da allowlist do navegador nem do `service_role`. A integração Qlik usa exclusivamente a RPC mínima versionada; conceder acesso direto para contornar uma falha operacional é proibido.
