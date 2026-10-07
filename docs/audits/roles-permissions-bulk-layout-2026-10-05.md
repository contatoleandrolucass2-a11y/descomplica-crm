# Papéis, permissões por canal e edição em lote

Data: 2026-10-05

Branch: `codex/roles-permissions-bulk-layout`

Estado: implementação, hardening, matriz de release local e baseline visual
concluídos; nenhuma migration remota aplicada.

## Decisão funcional

O catálogo atribuível passa a expor somente:

- Master;
- Administrador;
- Coordenador;
- Gerente House;
- Gerente Imob;
- Corretor House;
- Corretor Imob.

`pending` continua interno e sem acesso herdado. Os papéis genéricos ou
descontinuados permanecem apenas como chaves históricas não atribuíveis e sem
grants: `manager`, `supervisor`, `house`, `real_estate`,
`partnership_channel`, `broker_lead`, `broker` e `user`. Eles não são
convertidos automaticamente para House ou Imob, pois o nome legado não prova o
canal correto.

| Papel          | Geral | Com Canal Imob | Sem Canal Imob | Ranking | Canal de Parcerias | Configurar metas/páginas |            Dar permissões            |
| -------------- | :---: | :------------: | :------------: | :-----: | :----------------: | :----------------------: | :----------------------------------: |
| Master         |  Sim  |      Sim       |      Sim       |   Sim   |        Sim         |           Sim            |                 Sim                  |
| Administrador  |  Sim  |      Sim       |      Sim       |   Sim   |        Sim         |           Sim            | Sim, somente abaixo do próprio nível |
| Coordenador    |  Não  |      Sim       |      Não       |   Não   |        Sim         |           Não            |                 Não                  |
| Gerente House  |  Não  |      Não       |      Sim       |   Sim   |        Não         |           Não            |                 Não                  |
| Gerente Imob   |  Não  |      Sim       |      Não       |   Não   |        Sim         |           Não            |                 Não                  |
| Corretor House |  Não  |      Não       |      Sim       |   Sim   |        Não         |           Não            |                 Não                  |
| Corretor Imob  |  Não  |      Sim       |      Não       |   Não   |        Sim         |           Não            |                 Não                  |

As capacidades exclusivas de Master, inclusive execução/configuração dos
motores comerciais protegidos, não são liberadas por esta matriz. O
Administrador não pode alterar a si mesmo nem criar, desativar ou alterar o
papel e as exceções de outro Administrador. A hierarquia estrita é repetida na
Server Action e nas RPCs; esconder controles na interface não é a fronteira de
segurança.

## Contrato de dados e interface

As três visões do dashboard recebem permissões separadas. As policies de
`crm_dashboard_views`, `crm_dashboard_metrics` e
`crm_dashboard_top_developments` filtram cada linha pela permissão da
respectiva `view_key`. O servidor consulta somente as visões autorizadas; uma
query explícita para outra visão falha fechada. O bloco derivado de ranking não
é consultado nem renderizado sem `crm.ranking.view`.

A administração de usuários usa uma lista de contas e um painel de edição. A
matriz permite buscar e marcar várias permissões, escolher `allow`, `deny` ou
`inherit`, informar um único motivo e salvar o lote atomicamente. Cada linha
continua distinguindo acesso herdado de exceção individual. Papel, status e
aprovação permanecem separados para evitar que uma seleção visual misture
operações com contratos de segurança diferentes.

A RPC de lote revalida sessão ativa, hierarquia, alvo, capacidade de gestão e
todas as permissões antes de gravar. A decisão de escopo ocorre antes do lock,
para evitar oráculos de metadados, e novamente depois do `FOR UPDATE`, para não
usar autorização obsoleta após uma transição concorrente. O lote inteiro
confirma ou reverte junto, usa ordem determinística de locks, registra auditoria
e recebe `EXECUTE` somente para `authenticated`. `PUBLIC`, `anon` e
`service_role` não ganham essa capacidade.

## Preflight remoto somente leitura

O projeto confirmado foi `descomplica-crm-production`
(`hnncxuerlcsaahdxoswb`). A consulta agregada encontrou dois Masters, um
Administrador e três contas em papéis agora legados: uma em `broker` e duas em
`user`. Nenhuma identidade, e-mail ou outro dado pessoal foi lido.

A produção ainda não possui a foundation local de onboarding/escopos:
`approve_user_access`, `crm_reporting_scopes` e `profiles.access_status` estão
ausentes. A migration de convergência precisa, portanto, funcionar tanto sobre
o schema produtivo atual quanto sobre um reset local completo. Novas contas no
schema produtivo recebem o papel interno `pending`, sem grants, e podem ser
reclassificadas explicitamente por um gestor autorizado; contas legadas já
existentes não são remapeadas por suposição.

Nenhum SQL de mutação, migration, conta, dado, grant ou policy remota foi
alterado neste preflight. Aplicar a migration em produção continua exigindo a
autorização específica e os gates do runbook de publicação.

## Evidências

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`,
  `pnpm resources:check` e `pnpm security:secrets`: aprovados.
- `pnpm audit --audit-level high`: nenhuma vulnerabilidade conhecida depois de
  atualizar `source-map-js` para 1.2.2, `sharp` para 0.35.5 e o SDK MCP
  transitivo para 1.31.0.
- `pnpm test`: 1.980 testes Vitest aprovados, sete skips previstos e oito
  testes Node aprovados.
- `pnpm db:test`: 1.099 testes pgTAP em 27 arquivos, todos aprovados. A nova
  matriz responde por 57 casos de papéis, ACL, RLS, lote atômico e ordem da
  revalidação de escopo.
- Testes focados do hardening: três Vitest e 57 pgTAP aprovados. A prova com
  duas sessões moveu o alvo para fora do escopo enquanto a RPC aguardava o
  lock; o lote retornou SQLSTATE `42501`, sem override e sem auditoria.
- `pnpm build`: aprovado no Next.js 16.3.6, com 43 páginas geradas.
- `pnpm qa:e2e:release`: 19 cenários Playwright aprovados e um skip previsto.
  Master, Administrador, Coordenador, Gerente House, Gerente Imob, Corretor
  House, Corretor Imob e `pending` foram verificados em 23 rotas protegidas,
  menus, APIs, recuperação de senha e MFA. O fechamento removeu as nove
  identidades sintéticas, aprovou zero papel legado e negou oito superfícies
  anônimas sem retornar linhas.
- O ensaio isolado foi sincronizado com 1.099 pgTAP e os gates autenticados
  passaram a executar o build standalone, no mesmo formato da imagem Docker.
- A CI `37507333920` aprovou todos esses gates e foi bloqueada somente pela
  referencia visual anterior de `/admin/usuarios`, menor que a nova matriz de
  23 permissoes. A revisao das capturas corrigiu os selos herdados comprimidos
  no modo somente leitura e adicionou limite de densidade de 2.500 px apenas
  para essa rota.
- A recaptura limpa no commit `f1df3d6` aprovou 154 cenarios responsivos, 88 de
  tema, 242 auditorias Axe/comparacoes e 110 verificacoes de zoom. A promocao
  transacional alterou somente as onze referencias de `/admin/usuarios` e
  preservou as outras 231 imagens; a altura desktop ficou em 2.486 px, sem
  overflow horizontal.
- Depois da integracao de `a89a93c`, o manifesto preserva as onze referencias
  de Usuarios dessa captura e as onze referencias do Associativo promovidas em
  `e0e0ce9`, com proveniencia explicita e hashes recalculados. Vinte e sete
  contratos de referencia passaram; a recaptura integral da CI segue
  obrigatoria antes do merge porque o host local sofreu contencao externa.
- A CI `37532674180` aprovou validate, restore, migrations, banco, advisors,
  build, E2E e todos os checks funcionais da matriz visual. A unica divergencia
  restante era a referencia de Usuarios em 375 px, 21 px mais alta porque o
  e-mail sintetico ocupava tres linhas localmente e duas no runner.
- O cabecalho movel passou a reservar duas linhas para o identificador. A
  recaptura integral posterior aprovou 154 checks responsivos, 88 de tema, 242
  auditorias Axe, 242 comparacoes e 110 checks de zoom, com zero falha. Somente
  as referencias de Usuarios em 320 e 375 px mudaram; 375 px ficou em 5.172
  px, igual ao candidato da CI.
- A recaptura tambem comprovou o tratamento idempotente de uma resposta tardia
  da fixture do Associativo: apenas `Route is already handled` e ignorado;
  qualquer outro erro continua bloqueando o gate. A conta efemera e as fixtures
  foram removidas ao final.
- O registro final foi recapturado a partir do commit `2fbb35b`, com
  `worktreeDirtyAtCapture: false` e `passed: true`. A habilitacao sequencial dos
  campos do Associativo recebeu espera explicita de ate 60 s para absorver a
  latencia medida no host, sem omitir campo, estado ou assercao de continuidade.
- A integracao posterior da `main` `73b20d0` adicionou Repasse ao inventario.
  Como `crm.partnerships.view` passa a ser legitima para Coordenador e perfis
  Imob nesta matriz, Repasse recebeu um segundo predicado explicito de papel
  `master` no Proxy, navegacao, pagina e Server Action. Os outros sete perfis
  permanecem em `403`, sem perder o acesso devido ao Canal de Parcerias.
- Reset completo, lint do schema e advisors de segurança/desempenho do banco:
  aprovados sem achados.
- Jornada autenticada local em 1440×1000, tema Escuro e Corretor Imob
  selecionado: zero violações Axe. Captura:
  `/root/.codex/visualizations/2026/10/05/01a10df4-50ee-7dd0-a8a9-7ae05f8149a0/permissions-layout-real.png`.
- As cinco identidades e os escopos sintéticos da captura foram removidos. A
  verificação posterior confirmou zero usuário, organização ou escopo com os
  marcadores temporários.

A revisão de segurança do diff encontrou uma janela concorrente de baixa
probabilidade e a correção foi revisada sem bypass ou regressão concretos. As
duas primeiras execuções de CI bloquearam corretamente advisories novos e,
depois, contratos antigos de restore/E2E; nenhum gate foi ignorado. A matriz
visual local final foi aprovada antes da publicação.

## Publicação em produção

O responsável autorizou explicitamente a migration e o deploy. O PR #159 foi
integrado no merge `3bcc3c4a4ad892df4e127bb53a4a5696c9d6dbed`; a CI
`37556958745` aprovou `validate`, `isolated-restore`, `promotable-image` e
`release-gates` no mesmo SHA.

O backup lógico privado `20261007T021140Z-rbac-prechange` preserva papéis,
schema, dados públicos e histórico de migrations em arquivos `root:root 0600`,
com o manifesto SHA-256 aprovado. O projeto informou backup físico vazio e PITR
desabilitado, por isso esse backup lógico foi criado antes da mudança. Seus
dados permanecem fora do Git e não foram impressos.

A migration remota foi aplicada com sucesso em
`descomplica-crm-production` (`hnncxuerlcsaahdxoswb`). O conector registrou a
versão remota `20261007021254` com o nome
`reconcile_roles_dashboard_views_and_bulk_overrides`; o SQL aplicado é o mesmo
arquivo versionado sob `20261005234936`, com SHA-256
`9254cbc3d7ede37b38c90f5fc90c437fe542e95b8575863dd765fb94e2208c20`. Nenhum
`migration repair` foi usado.

As verificações posteriores confirmaram:

- sete papéis de negócio na matriz e somente seis atribuíveis abaixo de Master;
- Administrador não atribui Administrador e pode atribuir Gerente Imob;
- papéis aposentados e `pending` com zero permissão herdada;
- uma conta `broker` e duas `user` preservadas para classificação manual;
- RLS habilitada e policies por `view_key` nas três tabelas de dashboard;
- RPC em lote com `search_path` vazio, limite de 10 segundos e `EXECUTE`
  somente para `authenticated`, com hierarquia e revalidação de escopo;
- nenhum grant direto de `anon`, `authenticated` ou `service_role` nas tabelas
  Qlik `crm_imob_ranking_runs` e `crm_imob_ranking_entries`.

Os advisors remotos mantiveram avisos globais anteriores: tabelas privadas com
RLS sem policy, RPCs `SECURITY DEFINER` publicadas deliberadamente para seus
papéis e proteção contra senhas vazadas desabilitada. O novo RPC aparece no
aviso de funções autenticadas porque esse é o contrato intencional; seus guards,
ACL e negações foram conferidos. Não houve alteração oportunista nesses itens.

A imagem promovível do SHA `3bcc3c4` foi validada pelo ID
`sha256:f6e968640a724c3a4b5a28e170b77812c9d8f645ba8018e5f900bbbee85871e4`
e promovida por CAS sobre `73b20d0`. O container ficou saudável, com zero
reinícios. O health externo retornou `status=ok` e o SHA novo; as três rotas
protegidas amostradas retornaram `307` para login, e a tabela de dashboard e a
RPC em lote retornaram `401` a chamadas anônimas. O rollback ficou preparado e
não foi executado.
