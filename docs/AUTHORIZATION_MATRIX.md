# Matriz de autorização e páginas

> Esta matriz descreve o contrato local pretendido. A captura remota de 9 de
> agosto de 2026 encontrou exposição Qlik a `anon` e read models globais sem
> escopo de organização/equipe/carteira. Além disso, cadastro público pode criar
> perfil ativo `user` com leitura comercial global. O estado e a proposta
> deny-by-default estão em
> [`docs/supabase-proof/`](supabase-proof/README.md).
> Nenhuma correção foi aplicada remotamente neste gate.

## Regras efetivas

A autorização combina papel, estado aprovado, grants temporais de escopo e
exceções individuais. Uma exceção `deny` vence `allow` e a permissão herdada.
Somente perfil `approved` e ativo recebe contexto; `pending`, `suspended` e
`legacy_review` falham fechados nas policies RLS.

| Grupo de papéis                                                             | Páginas padrão                                                        | Administração                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `master`                                                                    | todas as páginas; único papel com fatos comerciais v2                 | usuários, papéis, exceções e catálogo               |
| `admin`                                                                     | seis páginas visuais de simulação bloqueada; nenhum fato comercial v2 | escopada; intake somente com `crm_people` confiável |
| `coordinator`, `supervisor`, `real_estate`, `broker_lead`, `broker`, `user` | seis páginas visuais de simulação bloqueada; nenhum fato comercial v2 | nenhuma                                             |
| `manager`, `house`, `partnership_channel`, `pending`                        | nenhuma permissão comercial automática                                | nenhuma                                             |

As permissões administrativas respeitam hierarquia estrita: o ator somente
modifica usuários e papéis abaixo do próprio nível. O próprio usuário não pode
alterar seu papel, status ou exceções. Admin não recebe fila global de signup:
o intake de alvo ainda sem grant exige linha ativa e confiável em `crm_people`,
com `auth_user_id` estável e pessoa dentro do escopo delegável do Admin. Nome,
e-mail ou texto de gerente nunca resolve essa associação.

Somente Master/Admin pode aprovar ou reativar contas; permissões individuais
não transformam Coordenador/Gerente em aprovador. Gerente, Corretor,
Imobiliária e House exigem exatamente um reporting scope ativo, inclusive em
trocas de papel posteriores. Toda afiliação de pessoa não expirada — atual,
futura ou ligada a equipe/organização inativa — participa da contenção para
impedir expansão latente.

Dashboard, cinco etapas, ranking, configurações, metas e pontos usam read models
v2 globais. Enquanto esses modelos não carregarem `reporting_scope_id`, somente
Master herda suas permissões. Override `allow` comercial para não-Master é
rejeitado; papel ou UI não substituem o gate v3.

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
de integração pendente. A rota exige a permissão dedicada
`crm.partnerships.view` e ainda não consulta as tabelas Qlik. O contrato local
de leitura é deliberadamente mais
estrito: a RPC só retorna entries mapeadas por ID Qlik a uma organização dentro
do escopo aprovado. Runs globais, developments e linhas sem mapeamento
permanecem indisponíveis. Neste gate, a permissão é herdada automaticamente
somente por Master. Um não-Master só pode
recebê-la por override `allow` auditado e, mesmo assim, a RPC exige grant ativo,
escopo organizacional e identidade Qlik oficial mapeada; sem qualquer desses
vínculos, retorna zero linhas.

As seis rotas de simulação exigem `crm.simulators.view`. A permissão permanece
nos oito papéis legados porque essas superfícies são somente visuais; ela não
abre dashboard, ranking, metas, pontos ou qualquer motor comercial. Os motores
continuam sem submit, fórmula ou persistência. Um administrador pode remover o
acesso por override `deny` e desativar cada página no catálogo, sem substituir o
guard server-side.

Falta de permissão autenticada usa o interruptor `forbidden()` do Next.js e
retorna a superfície `AUTH-403`; caminhos realmente inexistentes usam
`ROUTE-404`, e falhas inesperadas permanecem 500 com mensagem distinta.

O menu consulta somente páginas ativas, marcadas para navegação e permitidas pela RLS. Ocultar um item não concede nem revoga acesso: cada rota mantém sua guarda server-side e cada operação de dados mantém grants, RLS ou RPC próprios.

## Operações administrativas

- `assign_user_role`: atribui papel e audita.
- `set_user_permission_override`: cria/atualiza exceção `allow` ou `deny` e audita.
- `remove_user_permission_override`: remove exceção e audita.
- `set_user_active`: desativa conta de nível inferior dentro do escopo;
  reativação é exclusiva de Master/Admin, revalida a fronteira após locks e
  audita.
- `approve_user_access`: aprova atomicamente uma conta pendente com papel,
  escopos compatíveis, motivo e auditoria; Admin só inicia intake de identidade
  previamente vinculada a `crm_people` confiável e visível no próprio escopo.
- `list_app_pages_for_management`: lista o catálogo completo apenas para gestores de páginas.
- `set_app_page_active`: ativa/desativa página do catálogo e audita.
- `upsert_crm_funnel_goals`: calcula e grava as metas mensais de um canal e audita.
- `replace_crm_point_settings`: substitui pesos/objetivos do ranking e audita.
- `get_crm_sync_status`: retorna somente timestamps/estados seguros para leitores do dashboard.
- `begin_crm_salesforce_refresh` e `finish_crm_salesforce_refresh`: exigem sessão ativa e `crm.salesforce.refresh`, aplicam lock/cooldown e auditam.
- `ingest_crm_salesforce_snapshot`: disponível somente ao `service_role` do Route Handler M2M; nunca a `authenticated` ou `anon`.
- `ingest_crm_imob_ranking_snapshot`: contrato interno de ingestão Qlik. n8n
  externo nunca recebe `service_role`; deve usar relay server-side com M2M ou
  papel DB estritamente limitado à RPC, após gate formal.
- `list_scoped_crm_imob_ranking_entries`: leitura humana autenticada com
  `crm.partnerships.view`, identidade externa estável e escopo organizacional.

Elevação de papel, desativação de conta e criação/remoção de exceções exigem um
motivo não vazio. A validação roda em trigger `BEFORE INSERT` do log de auditoria
dentro da mesma transação das RPCs: uma tentativa sem motivo reverte papel,
status ou exceção integralmente. Toda troca de papel exige motivo; reativação
mantém motivo opcional. As regras de sessão ativa, anti-autoelevação,
hierarquia e `can_grant_permission` não mudaram.

Identidade de reporting scope e organização da equipe são imutáveis. Mudanças
de pessoa/Auth, memberships e carteira/organização exigem suspender os perfis
afetados, executar manutenção controlada e reativar pela RPC. Locks
transacionais por pessoa/carteira e `FOR UPDATE` determinístico de perfis
serializam manutenção, aprovação e reativação; as decisões de gestão e
delegação são repetidas após o lock. Não existe endpoint de navegador para
editar essa topologia ou `crm_source_identities` neste incremento.

Nenhuma dessas tabelas aceita escrita direta do papel `authenticated`. A RLS de `app_pages` nunca concede o bypass administrativo usado pela tela de gestão; o catálogo completo sai exclusivamente pela RPC protegida. O navegador chama somente RPCs `security definer` que revalidam sessão, perfil ativo, permissão e hierarquia no banco.

As páginas de metas exigem `crm.settings.manage` na rota e na Server Action. A
tabela `crm_funnel_goals` repete a verificação na RLS, e a RPC de escrita
revalida sessão, conta ativa, permissão e limites antes de alterar qualquer
linha. No v2 global, somente Master possui essa permissão.

As tabelas de pontos aceitam leitura com `crm.ranking.view` ou
`crm.settings.manage`. A rota de configuração e a RPC de substituição exigem
`crm.settings.manage`. Ambas são Master-only enquanto o modelo permanecer v2
global.

O read model do ranking exige `crm.ranking.view` na rota e nas duas policies RLS.
A permissão é Master-only neste gate. A tabela não expõe escrita a
`authenticated` nem a `service_role`; a ingestão server-side altera o read model
somente pela RPC transacional, sem credencial privilegiada no bundle.

Cada detalhe de etapa exige `crm.stages.view` e reutiliza as tabelas do dashboard,
cuja RLS exige `crm.dashboard.view`. Somente Master recebe ambas enquanto os
snapshots forem globais. Um override `deny` continua prevalecendo; `allow` para
não-Master não pode contornar a ausência de escopo v3.

`crm_ingestion_runs` não concede acesso direto a navegador algum. O controle Salesforce só é renderizado com `crm.salesforce.refresh`; quando a capacidade está desativada ou incompleta, ele permanece desabilitado e não chama o endpoint. O status exige `crm.dashboard.view`. A ingestão usa credencial de máquina separada da sessão humana e sua função possui grant exclusivo.

## Matriz de grants da Data API

No schema local pretendido, `PUBLIC` e `anon` não possuem privilégio em tabela,
sequência ou função da aplicação. `authenticated` recebe somente `SELECT` nas tabelas consultadas pelo
SDK SSR: catálogo de páginas, auditoria, perfis/papéis/overrides, metadados de
organização/equipe/carteira/pessoa e read models do CRM. Identidades externas,
matriz papel-escopo e `crm_ingestion_runs` permanecem sem grant direto.

O papel `authenticated` não recebe escrita, `TRUNCATE`, `REFERENCES`, `TRIGGER`
ou `MAINTAIN`. As mutações passam exclusivamente pelas RPCs listadas acima.
`has_permission` também conserva `EXECUTE` porque é chamada pelas policies RLS;
os helpers `get_role_level`, `can_assign_role` e `can_grant_permission` não são
RPCs públicas da aplicação.

Localmente, `service_role` não recebe acesso direto a tabelas ou sequências. Os
grants técnicos de `EXECUTE` nas RPCs Salesforce/Qlik são estado intermediário
server-only, não autorização para distribuir a chave global. Salesforce fica no
Route Handler confiável. n8n/Qlik externo usa relay autenticado por M2M; como
alternativa formal, papel DB dedicado sem `BYPASSRLS`, sem tabela/sequência e
com `EXECUTE` apenas na assinatura necessária. Ambas executam as escritas como
transações `SECURITY DEFINER` validadas.
`bootstrap_master_user` permanece exclusiva do proprietário
`postgres`, conforme o runbook operacional.

As tabelas externas `crm_imob_ranking_runs`, `crm_imob_ranking_entries` e
`crm_imob_ranking_developments` não
fazem parte da allowlist local do navegador nem do `service_role`. A integração
Qlik deve usar exclusivamente a RPC mínima versionada; conceder acesso direto
para contornar uma falha operacional é proibido. O remoto ainda diverge dessa
regra e não deve receber novo caller antes da reconciliação.
