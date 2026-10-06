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
depois, contratos antigos de restore/E2E; nenhum gate foi ignorado. CI final,
aplicação da migration e publicação permanecem separados; a migration remota
exige autorização específica.
