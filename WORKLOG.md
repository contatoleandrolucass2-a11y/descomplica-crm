# Worklog

## 2026-08-14 — hotfix do acesso Master à página WF13

- O smoke produtivo mostrou `AUTH-403` antes da renderização. A inspeção
  somente leitura comprovou flag `active/simulator.wf13`, papel Master ativo e
  `crm.simulators.execute` efetiva, mas ausência de `crm.simulators.view`, do
  vínculo Master e das entradas de simulação em `app_pages`.
- A migration remota `20260813192928` foi confirmada no histórico e contém
  somente o gate de execução; não contém a permissão de página nem o catálogo.
  A migration visual antiga permanece fora do histórico remoto e não será
  aplicada em lote.
- A correção forward cria somente o pré-requisito de página do WF13, remove
  herança/overrides não Master dessa chave e mantém o gate de execução
  independente. Outros motores, integrações e runtime comercial não mudam.

## 2026-08-13 — Hotfix WF13: gate visual do canário

- Reproduzida localmente a falha do CI em `simulator-validation`: a página já
  estava carregada, mas `waitForLoadState("networkidle")` expirava por atividade
  assíncrona do runtime. A validação agora aguarda diretamente o campo obrigatório.
- O runner visual isolado passou a propagar apenas as duas variáveis oficiais de
  feature flag ao app e ao harness. Isso permite validar o baseline WF13 ativo de
  forma explícita, mantendo o modo desligado como padrão e os demais motores fora
  da allowlist.
- A execução completa também mostrou que o GET de status devolvia `503` para cada
  motor bloqueado, gerando erro de console apesar do estado visual correto. O GET
  agora exige `crm.simulators.view` e responde `executionEnabled: false`; somente
  o POST preserva `503` para runtime desligado e continua exigindo
  `crm.simulators.execute` + papel Master.
- A matriz ativa detectou corretamente o novo estado do hub. As oito capturas do
  hub com apenas `simulator.wf13` foram separadas no conjunto canário; a baseline
  padrão bloqueada não foi alterada. Múltiplas chaves não recebem fallback de
  baseline e continuam falhando fechadas.

## 2026-08-13 — hotfix do canário Master WF13

- A reprovação humana encontrou o CTA ainda bloqueado após ativação das flags.
  O diagnóstico comprovou no runtime `active/simulator.wf13`, vínculo Master,
  permissão efetiva e sessão produtiva atualizada. O Route Handler oficial não
  depende do runtime genérico de políticas comerciais.
- A interface recebia a decisão somente pelo payload renderizado da página; uma
  página aberta antes da troca de flags podia manter o estado bloqueado. Hub e
  rota agora forçam renderização por requisição e o workspace reconcilia o gate
  por um status autenticado e `no-store` antes de habilitar o CTA.
- O status não executa fórmula nem retorna dados comerciais. O POST continua
  revalidando flag, implementação, permissão, papel Master, origem e payload;
  decisão de interface não substitui autorização server-side.

## 2026-08-13 — baseline visual do canário WF13

- O segundo ensaio passou 147/147 checks responsivos, 84/84 checks de tema,
  192/192 auditorias Axe, 105/105 checks de zoom e E2E 9/9. A única reprovação
  foram 11 comparações da rota WF13 habilitada contra sua baseline canônica
  bloqueada, todas por mudança esperada de altura.
- Homologação foi novamente revertida e comprovada no SHA, configuração e banco
  anteriores; produção permaneceu saudável e inalterada.
- As 11 capturas sanitizadas do canário passaram a formar um conjunto separado
  e rastreado. A seleção depende da mesma chave oficial do runtime; baseline
  ausente, chave desconhecida e qualquer drift continuam reprovando o gate.

## 2026-08-13 — gate visual do canário WF13

- O primeiro ensaio remoto passou nos nove fluxos E2E, mas o verificador visual
  rejeitou a rota WF13 por exigir CTA bloqueado em todos os simuladores,
  inclusive no único canário explicitamente habilitado.
- Homologação foi revertida imediatamente para o SHA, configuração e estado de
  banco anteriores; produção permaneceu inalterada e saudável.
- O gate agora deriva a expectativa das flags oficiais, aceita CTA habilitado
  apenas na rota conhecida correspondente e mantém chaves desconhecidas e todas
  as rotas não liberadas em falha fechada.

## 2026-08-13 — atualização transitiva de segurança

- O CI pós-merge do WF13 bloqueou no audit por advisory novo contra
  `nanoid <3.3.18`, dependência transitiva do PostCSS.
- O override anterior 3.3.17 foi elevado para a versão corrigida 3.3.18; não
  houve mudança de dependência direta, regra comercial, migration ou flag.
- `pnpm why` confirmou uma única versão 3.3.18 e o audit voltou a zero
  vulnerabilidades conhecidas.

## 2026-08-13 — motor oficial WF13

- A função real do Associativo · Fluxo Linear foi inspecionada somente em
  leitura na referência viva. O asset e seu SHA-256 foram registrados sem
  versionar o bundle.
- A implementação tipada reproduz as operações, datas, limites, mensagens,
  arredondamentos e memória. Doze casos representativos comparam as saídas da
  referência e do CRM sem tolerância; todas as diferenças são zero.
- Runtime e endpoint nascem desligados, sem banco ou integração. Quando
  habilitados para `simulator.wf13`, ainda exigem sessão, permissão de execução,
  papel Master e same-origin. Inputs/resultados não são persistidos ou logados.
- Migration própria concede a execução somente ao Master e remove qualquer
  vínculo/override residual; a flag permanece off após migration e deploy.

## 2026-08-13 — sincronização do catálogo RBAC de parcerias

- A revisão pré-aplicação detectou que a migration Master-only usava nível 100,
  mas o espelho TypeScript ainda declarava nível 10. O catálogo local agora
  reflete o mesmo gate, com teste explícito; banco, usuários e produção não
  foram alterados por esta correção.

## 2026-08-13 — convergência RBAC do Canal de Parcerias

- O diagnóstico remoto somente leitura comprovou a divergência: a permissão
  `crm.partnerships.view` não existia, enquanto `crm.partnerships` ainda usava
  `crm.ranking.view`. O menu herdava a chave antiga e a rota exigia a nova,
  explicando o `AUTH-403` para Master.
- A migration exclusiva cria/atualiza somente essa permissão com nível 100,
  remove vínculos não Master e overrides diretos dessa chave, vincula Master e
  atualiza exatamente uma linha do catálogo. Ausência/duplicidade falha a
  transação fechada.
- O teste pgTAP prova catálogo, nível, vínculo Master-only, zero override e
  convergência entre menu e guard. Código da rota, demais permissões, Qlik,
  integrações, dados comerciais e aplicação permanecem inalterados.

## 2026-08-13 — contenção emergencial da leitura pública Qlik

- Diagnóstico somente leitura comprovou `SELECT` de `anon`, `authenticated` e
  `service_role` e policies públicas nas três tabelas `crm_imob_ranking_*`.
  Logs sanitizados preservam ao menos 51 GETs bem-sucedidos não atribuídos;
  origem externa e exfiltração não foram comprovadas.
- Backup lógico root-only incluiu roles, schema, dados e histórico. Restore
  isolado PostgreSQL 17.6 reproduziu exatamente 97 runs, 29.779 entries e 4.031
  developments, com hashes canônicos idênticos e sem rede externa.
- Migration emergencial exclusiva força RLS, remove todas as policies de
  leitura e revoga privilégios diretos dos papéis da Data API e
  `service_role`. Não altera dados, RBAC, app, usuários ou integrações.
- Comparação canônica externa confirmou hashes de dados inalterados. pgTAP do
  restore aprovou 15/15 casos de ACL, policies, RLS e preservação estrutural do
  writer. Leitores diretos ficam indisponíveis; leitura pública não é rollback.
- Publisher confirmado continua no workflow `r4DyPyOTDtoROXq0`, usando RPC
  `SECURITY DEFINER` por transporte `anon`. Revogar leitura não quebra a RPC,
  mas identidade dedicada e menor privilégio ainda exigem gate separado; relay
  e workflow não foram alterados.

## 2026-08-10 — release candidate, E2E e gates

- A primeira execução do CI remoto revelou que o Supabase CLI pode escrever
  mensagens informativas junto do JSON de status. Os gates E2E e visual agora
  extraem exatamente um objeto JSON balanceado e rejeitam saída ausente,
  truncada ou múltipla; casos sintéticos, E2E/RLS e a matriz visual autenticada
  passaram localmente após a correção.
- Branch criada do SHA exato
  `d00118fe62296fa3e23e266585899e3ee3a78478`; feature flags permaneceram off.
- Playwright passou a executar login inválido/anônimo, logout, nove perfis,
  catálogo e permissões exatas nas 21 rotas, Dashboard, cinco etapas, Ranking,
  Canal, filtros, v3 desligado, relay/motores indisponíveis e simuladores visuais
  bloqueados.
- A execução inicial revelou ciclo de redirect para conta autenticada ainda não
  aprovada. A distinção sessão válida/sem autorização agora termina em 403
  uniforme sem revelar estado do perfil; o próprio 403 permite logout e troca
  de conta, cobertos no navegador com o perfil pending.
- Quatro versions remotas ganharam markers locais no-op. Nenhum verifier, grant,
  fórmula ou DDL inseguro foi copiado. A matriz registra o bloqueio de ordem das
  três migrations locais antigas; nenhum push remoto é hoje autorizado.
- Dois projetos/containers PostgreSQL 17 efêmeros e independentes refizeram 26
  migrations; origem e alvo restaurado passaram 863 pgTAP, lint e advisors. O
  backup/restore preservou owners e privilégios efetivos e obteve fingerprint
  canônico idêntico sem mutar ACL no alvo. Roles relay/engine ficaram `NOLOGIN`;
  credenciais, gates, mappings, políticas e execuções permaneceram zerados.
- Os dois casts implícitos de arrays UUID no read model v3 foram tornados
  explícitos; o lint SQL local passou sem warnings depois de reset completo.
- O Compose agora injeta a tag imutável também no runtime do container, para o
  healthcheck identificar o SHA em vez de depender apenas do build ARG.
- As 12 divergências do `format:check` foram corrigidas mecanicamente. CI ganhou
  jobs de formato, Supabase/pgTAP, Playwright/matriz visual e restore isolado.
- A matriz visual passou a falhar por baseline ausente/drift acima de 1%, roda
  Axe WCAG A/AA em 87 combinações e publica somente candidatos sanitizados no
  CI, inclusive em falha. O modo normal mantém o baseline igual ao `HEAD`; uma
  atualização exige flag explícita e promoção transacional após todos os checks.
- A primeira execução objetiva encontrou contraste insuficiente no aviso de
  indisponibilidade dos simuladores e no rótulo de capacidade das metas; ambos
  passaram a preservar contraste integral sem mudar comportamento.
- Pacote único documenta aprovações, merge train empilhado, bloqueio de ordem de
  migrations, app-first, canário, rollback floor e deploy futuro.
- Nenhum Supabase remoto, dado, grant aplicado, n8n, Salesforce, Qlik, VPS,
  container externo, DNS ou Nginx foi alterado. Não houve merge, cutover ou
  deploy.

## 2026-08-10 — runtime versionado de políticas comerciais

- Branch criada do SHA exato `1f570d0a7b3ce64571019b121b0b4aff132e1676`.
  O baseline aprovou instalação congelada, lint, typecheck, 193 Vitest + 8 Node,
  build de 37 rotas e 770 pgTAP antes das alterações.
- O inventário confirmou zero policy oficial e zero caso de ouro oficial para
  WF13/WF14/WF15/WF16/CAIXA, metas, pontos, ranking, SLA, roleta, campanhas ou
  premiações. Legado, configuração v2 e fixtures não foram promovidos a regra.
- Foram catalogadas 14 chaves estruturais. A DSL v1 é fechada, determinística e
  sem rede/SQL/relógio/aleatoriedade; usa decimal `BigInt`, datas civis UTC,
  limites de complexidade, dispatch versionado e atestação privada após executar
  todos os casos de ouro.
- A migration local cria catálogo, versões/imports/executions imutáveis, gate,
  owners/backup, preview/apply e permissões separadas. Nenhuma policy, caso real,
  grant de execução, gate ou valor comercial é seedado.
- Lookup e ledger saíram da Data API: somente o papel PostgreSQL
  `crm_commercial_engine` recebe os dois entrypoints. Ele nasce `NOLOGIN`, sem
  senha/tabela/sequence/membership utilizável; flags, allowlist e URL ficam
  vazias. O baseline `PUBLIC` mantém o checker de isolamento falso até hardening
  remoto separado e explicitamente autorizado.
- Revisões adversariais fecharam RPC runtime pública, TOCTOU de ator/owner,
  downgrade concorrente, SQLSTATE ambíguo, escala intermediária, concat/AST DoS,
  canonical JSON não finito, objeto verificado forjável, manifesto parcial e
  confiança em `X-Forwarded-Host`. A revisão final também vinculou a conexão ao
  project ref da aplicação, limitou outputs a 30 dígitos, preservou replay
  histórico após owner inativo e passou a expandir ACL default no checker.
- Reset Supabase estritamente local aplicou a migration limpa; pgTAP aprovou
  863/863, incluindo 93/93 do runtime. O lint SQL não apontou achado novo; reteve
  apenas alertas da extensão pgTAP e dois warnings preexistentes do read model v3.
- Os gates finais aprovaram lint, typecheck, 226 Vitest + 8 Node (um ignorado),
  build de 37 páginas, schema diff vazio, advisors sem issues, audit/OSV sem
  vulnerabilidade e Gitleaks sem achado na árvore ou em 210 commits. Actionlint,
  ShellCheck, `bash -n` e Compose com configuração sintética também passaram.
- Nenhum Supabase remoto, dado, grant, migration aplicada, workflow n8n,
  Salesforce, Qlik, VPS, container, DNS ou Nginx foi alterado. Não houve merge,
  deploy, cutover nem provisionamento de segredo.

## 2026-08-10 — relay Qlik, mappings e cutover local

- Branch criada do SHA exato `96d48b0e64ad85c5020d4ec69b6f1dd0bf408e08`.
  Baseline aprovou lint, typecheck, 125 Vitest + 8 Node (um ignorado), build de
  37 rotas e 684 pgTAP antes das alterações.
- Inspeções remotas somente leitura identificaram o único publisher entre 484
  workflows: n8n `r4DyPyOTDtoROXq0` (`ranking imobs`), agenda de 30 minutos,
  papel efetivo `anon` e owner técnico Leandro Lucas (`global:owner`). A amostra
  correlacionou 27/27 execuções bem-sucedidas; owner operacional/backup e
  leitores `GET` residuais permanecem gates.
- O relay server-only exige HMAC do request canônico, digest do body, timestamp,
  nonce, 1 MB máximo e schema estrito. Flags ficam off; a conexão dedicada
  rejeita usuários administrativos e recebe somente a RPC `qlik_relay`.
- A migration local cria papel `NOLOGIN`, registry/gate/ledger vazios, RLS
  forçada, shadow sem fatos, duas janelas shadow, duas canary e saúde agregada.
  Nenhuma credential, owner, mapping, target ou dado real foi seedado.
- A CLI de mappings faz preview por padrão e exige flag, hash do manifesto e
  hash do plano para apply. O banco revalida autoridade, conflitos e estado em
  transação atômica; owners/targets nunca são criados pelo importador.
- Revisões adversariais fecharam TLS sem verificação integral, reutilização de
  HMAC, drift de atributos/ACL/session user do papel, replay histórico com body
  não validado, aliases whitespace e bypass da autoridade pela primitiva antiga.
  O papel continua `NOLOGIN`: grants `PUBLIC` de `pg_net` e banco fazem o helper
  retornar `false` até remediação futura pelos owners autorizados.
- Reset integral passou; pgTAP aprovou 770/770, incluindo 86/86 casos do
  relay/mappings. Lint, typecheck, 193 Vitest + 8 Node, build de 37 páginas,
  advisors, auditorias de dependência/segredos, Actionlint e ShellCheck passaram.
  O lint SQL reteve somente duas advertências preexistentes do read model v3.
- A ponte Qlik anterior foi tornada aditiva: preserva a RPC legada até cutover;
  o hardening destrutivo permanece em incremento separado.
- Nenhum Supabase remoto, dado, grant, migration aplicada, workflow n8n,
  Salesforce, Qlik, VPS, container, DNS ou Nginx foi alterado. Não houve
  cutover, merge ou deploy.

## 2026-08-09 — prova remota, restore isolado e hardening RLS local

- Esta entrada conclui o gate que antes estava bloqueado por autenticação da
  CLI. O projeto remoto foi observado somente por leitura: PostgreSQL 17.6,
  21 tabelas públicas, 26 funções públicas, 20 policies, 8 triggers públicos,
  3 usuários Auth e zero objetos Storage/Vault. Nenhum dado, grant, policy,
  migration, Auth, n8n ou deploy remoto foi alterado.
- A união contém 20 migrations no SHA-base: 13 comuns, quatro somente remotas
  e três somente locais. Statements e hashes das quatro remotas foram
  recuperados do histórico, mas não são apresentados como arquivos históricos
  originais. DDL e inventário canônico sanitizados foram versionados.
- O backup oficial root-only foi restaurado em stack isolada PostgreSQL 17.6:
  48/48 contagens e checksums de multiconjunto coincidiram; inventário de
  aplicação não teve diff; Auth/Storage/PostgREST responderam 200; pgTAP de
  restore passou 28/28. Limites de configuração Auth e binários Storage estão
  documentados. Stack e dumps brutos sensíveis foram removidos ao final.
- `20260809144137` prepara cadastro `pending` inativo, quatro papéis técnicos,
  organizações, pessoas, equipes, carteiras, identidades externas, reporting
  scopes, grants temporais e aprovação atômica. Contas antigas não-Master ficam
  `legacy_review`; read models v2 continuam globais e não recebem filtros
  dimensionais fictícios.
- A fundação escopada bloqueia mudanças silenciosas de fronteira: identidade de
  scope e organização da equipe são imutáveis; pessoa/Auth, memberships e
  carteira/organização exigem suspender todos os usuários afetados antes da
  manutenção. Locks transacionais por entidade e `FOR UPDATE` determinístico
  serializam aprovação, reativação e topologia; a decisão é revalidada depois
  do lock. Somente Master/Admin aprova ou reativa, papéis de escopo unitário
  exigem exatamente um grant e afiliações não expiradas, inclusive futuras ou
  inativas, entram na contenção direcional.
- `20260809144143` preserva runs/entries/developments Qlik, força RLS, fecha
  grants/policies diretos, mantém ingestão service-role-only e cria leitura
  autenticada somente com `crm.partnerships.view`, identidade Qlik mapeada e
  organização no escopo. O caller `anon` remoto segue ativo e desconhecido;
  por isso a migration não pode ser aplicada antes do cutover comprovado.
- A matriz local passou 518 pgTAP, cobrindo signup, grants, FORCE RLS,
  isolamento horizontal/vertical, papéis, Qlik, ingestão, metas e read models.
  A prova PostgREST sintética passou com nove perfis removidos ao final, oito
  negativas anônimas sem linhas e bloqueio uniforme do exploit de dupla
  afiliação. Nenhuma conta ou fixture remota foi criada.
  O pacote comercial registra conflitos e decisões faltantes sem promover
  legado, workflow ou fórmula a autoridade.

## 2026-08-09 — gate de reconciliação de fontes e migrations

- A branch `codex/source-migration-reconciliation` foi criada exatamente de
  `81968eb72371d5a1a794d48703de41a7feb58f70`, HEAD do PR #26. O PR original,
  produção, Supabase remoto, n8n, VPS, DNS e Nginx não sofreram mutação.
- A união do histórico contém 20 versões: 13 conciliadas, quatro somente
  remotas e três somente locais. O SQL exato das quatro remotas foi localizado
  no histórico interno do banco; verifier e grants inseguros não foram copiados
  ao Git. A matriz registra hashes, dependências, objetos e plano de markers +
  hardening posterior.
- O inventário remoto somente leitura confirmou 21 tabelas, 20 policies e 26
  funções públicas. As três tabelas Qlik aceitam leitura `anon`, escrita direta
  de `service_role` e a RPC legada `SECURITY DEFINER` aceita `anon`. Cadastro
  público + provisionamento ativo `user` também pode expor snapshots globais
  quando signup estiver habilitado. Nenhuma correção remota foi executada.
- Salesforce/n8n, Qlik, dois escritores legados de estoque e SLA foram
  mapeados. Contratos Zod cobrem as sete projeções Salesforce, envelope v2,
  Qlik v1 e estoque fail-closed; testes rejeitam PII/campos extras, identidades,
  datas e relógio inválidos, duplicidade e disponibilidade inventada.
- A auditoria dos workflows históricos classificou WF13, WF14, WF15 e WF16
  como implementados sem autoridade e divergentes; CAIXA está ausente. Metas,
  scoring, bônus, arredondamento, desempate, SLA, produtividade, campanhas,
  roleta e prêmios não possuem política oficial ratificada. Todos continuam
  bloqueados.
- A proposta de escopos usa IDs oficiais, organizações, equipes, carteiras,
  pessoas e read models v3 deny-by-default. Nenhuma migration foi criada porque
  mapeamentos de Gerente/House/Canal/Admin, onboarding e identidades ainda
  exigem decisão.
- A CLI Supabase `2.111.0` restaurou schema/dados `public` do PostgreSQL local
  `17.6` em banco isolado: 20 tabelas, 27 funções public/private, 19 policies,
  checksums e contagens iguais. O alvo e os dumps foram removidos. O teste
  também provou que Auth/Storage integral exige alvo Supabase provisionado; não
  substitui backup remoto.
- O acesso read-only do conector funciona, mas a CLI vinculada não tem sessão de
  plataforma. `supabase migration list --linked` falhou com
  `LegacyPlatformAuthRequiredError`; dump DDL remoto e restore integral ficam
  bloqueados até login privado e alvo/custo aprovados.
- Gates finais: instalação congelada, formatação dos arquivos alterados, ESLint,
  TypeScript, Vitest/Node, build, 283 pgTAP, lint/advisors locais, auditoria pnpm,
  Gitleaks árvore/histórico e OSV aprovados. O `format:check` global continua
  falhando somente em 12 arquivos preexistentes fora do diff; nenhum foi
  reformatado neste gate.

## 2026-08-09 — consolidação visual das 18 páginas

- Esta entrada supersede o recorte inicial da fundação registrado logo abaixo:
  as 18 páginas da referência viva agora têm composição visual no catálogo
  protegido, sem ampliar o escopo funcional ou copiar autoridade comercial do
  sistema legado.
- Dashboard, cinco etapas, ranking, Canal de Parcerias, configurações, metas e
  cinco jornadas de simulação compartilham topbar hierárquica, ícones e o
  design system navy/cyan/lime. Estados sem fonte mantêm toda a composição e
  exibem “indisponível” em vez de converter ausência em zero.
- O hub e as rotas WF13, WF16, CAIXA, WF14 e WF15 foram adicionados ao catálogo
  com a permissão `crm.simulators.view`, guard server-side e grants de catálogo
  mínimos. Os formulários são apenas visuais: não têm submit, persistência,
  fórmula ou resultado ativo.
- A migration `20260809024000_simulator_visual_catalog.sql` altera somente o
  catálogo de páginas, a permissão e sua matriz de papéis. Tabelas Qlik, grants
  de dados, policies, funções comerciais e contratos dos simuladores não foram
  alterados.
- O Canal de Parcerias permanece sem leitura direta das tabelas protegidas e
  sinaliza a integração pendente. Ranking avançado, roleta, prêmios e motores
  WF13/WF14/WF15/WF16/CAIXA seguem bloqueados para incrementos com fonte oficial.
- QA autenticado complementar passou em Supabase local isolado com conta QA
  efêmera e fixtures sintéticas removidas ao final: 72/72 checks responsivos,
  54/54 checks de tema, 18/18 rotas em zoom de 200%, teclado, reduced-motion e
  87 capturas sem overflow ou erro de aplicação. A barreira anônima passou nas
  18 rotas do build local nos quatro viewports.
- A comparação autenticada em homologação continua bloqueada por ausência de
  URL e credencial QA dedicadas. Produção, conta Master/Admin pessoal, deploy,
  merge e criação de usuário remoto não foram usados.

## 2026-08-09 — fundação de paridade da referência

- A referência viva foi recatalogada em 18 rotas. O checkpoint antigo permanece
  apenas como proveniência; não autoriza dados, fórmulas ou regras comerciais.
- A matriz de paridade separa seis páginas desta fundação, rotas seguras já
  existentes e simuladores/ranking avançado/Canal de Parcerias adiados.
- O shell protegido ganhou topbar navy/cyan/lime e navegação pai/filho montada
  somente depois do filtro efetivo de permissões. Supabase SSR, guards, RLS,
  grants, CSP e logout não mudaram.
- Dashboard e cinco etapas passaram a reutilizar cards, filtros, roscas, funis,
  gauge, tabela, ranking, skeleton e estados. Nenhum campo nulo vira zero;
  últimos 7/14 dias não recebem fallback; meta ausente ou zero não desenha arco.
- A projeção proporcional, filtros dimensionais, thresholds editoriais,
  simuladores, roleta, prêmios e cálculos comerciais ficaram fora do código por
  ausência de fonte oficial aprovada.
- O harness Playwright cobre as 18 páginas da referência com máscara opaca
  irreversível aplicada no DOM. PNG bruto fica só em memória; o Git recebe WebP
  sem metadados, manifest e hashes SHA-256. A execução final respondeu `200` em
  18/18 rotas, aplicou 2.969 máscaras e não registrou erro de aplicação no
  console, erro de página, mudança de URL ou mutação durante a captura. Bloqueios
  de rede impostos pelo próprio harness são contabilizados separadamente.
- A barreira anônima passou antes e depois: doze rotas CRM retornaram `307` para
  `/login`; os quatro viewports terminaram no formulário vazio com `200`, CSP,
  X-Frame-Options e nosniff, sem marcador comercial ou erro. Os WebP de antes e
  depois têm SHA-256 idêntico por viewport. Os 26 arquivos passaram em dimensão,
  checksum e ausência de EXIF, ICC, IPTC e XMP.
- A comparação autenticada foi interrompida apenas nessa etapa: URL de
  homologação e credencial QA dedicada não foram disponibilizadas nem
  localizadas nos canais seguros inspecionados. Produção foi consultada somente
  de forma anônima para o limite “antes”; contas pessoais e criação de usuário
  foram descartadas. Temas, teclado, zoom de 200% e perfis no conteúdo protegido
  permanecem pendentes.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passaram. Foram 81
  testes Vitest aprovados, um teste condicional omitido por ausência do artefato
  opcional Salesforce, oito testes Node aprovados e 282 asserções pgTAP.
  Playwright/Chromium foi provisionado; `pnpm audit` não encontrou
  vulnerabilidade e o Gitleaks não encontrou segredo.
- Nenhuma migration, banco remoto, DNS, deploy, workflow ou regra de simulador
  foi alterado.

## 2026-08-08 — buffer de resposta do Nginx

- Doze falhas de login desde 04/08 foram correlacionadas ao erro Nginx
  `upstream sent too big header while reading response header from upstream`.
  Aplicação, container, `/login` e `/api/health` permaneceram saudáveis.
- Auditor Chromium reproduziu o protocolo hidratado da Server Action da imagem
  implantada, criou sessão e mediu somente o tamanho total dos headers: 4.260
  bytes. Nenhum valor de cookie, token, senha ou header foi registrado.
- O template HTTPS agora define `proxy_buffer_size 8k`, `proxy_buffers 8 8k` e
  `proxy_busy_buffers_size 16k` somente no `location /` do CRM. Configurações
  globais, `large_client_header_buffers`, aplicação e Supabase não mudaram.
- Runbook documenta backup root-only com checksum, `nginx -t`, reload sem
  restart, gates de login/saúde/logs e rollback imediato.

## 2026-08-08 — experiência visual do cadastro

- O cadastro reutiliza diretamente o cérebro mecânico e os estilos-base do
  login, com composição responsiva própria para os quatro campos e rolagem
  vertical confortável em telas ou zoom que não comportem todo o formulário.
- `signupAction`, schema Zod, payload, nomes, IDs, tipos, autocomplete, estado
  pendente, mensagens e resultado do cadastro foram preservados. O teste
  funcional local confirmou o mesmo payload e resposta usando um mock isolado,
  sem chamada ao Supabase remoto ou criação de usuário real.
- Chromium aprovou 70/70 checks em 1440×900, 1280×720, 768×1024, 390×844,
  zoom de 200%, três temas, redução de movimento, touch, teclado, erros,
  carregamento, contraste, retorno do parallax e imagem atrasada com CLS zero.
- O login permaneceu byte a byte inalterado e passou pelo teste de regressão.
  Nenhuma dependência, lockfile, backend, autenticação, middleware, banco,
  infraestrutura, produção ou deploy foi alterado.

## 2026-08-08 — correção isolada do nanoid

- O override transitivo fixa `nanoid` em `3.3.17`, versão corrigida para o
  advisory `GHSA-2v37-7h3g-55p8` que bloqueou a CI do PR visual do login.
- Nenhuma outra dependência, arquivo de aplicação, autenticação, Supabase,
  middleware, banco, produção ou deploy foi alterado.

## 2026-08-07 — experiência visual do login

- A tela existente foi mantida como único ponto de autenticação, preservando
  `loginAction`, nomes dos campos, payload, validações, erros e redirecionamentos.
- O login ganhou layout responsivo em duas áreas e um componente visual isolado
  com cabeça mecânica, engrenagens SVG alternadas, parallax limitado e retorno
  suave controlado por `requestAnimationFrame`.
- O asset local recebeu recorte transparente real; não há fundo quadriculado,
  dependência nova, listener global ou captura de eventos do formulário.
- Ponteiros sem hover recebem imagem estática e `prefers-reduced-motion` desliga
  parallax, rotação e transições decorativas.
- A candidata isolada passou por 56 checks em Chromium nos quatro tamanhos
  pedidos, zoom de 200%, redução de movimento, touch, teclado, autofill, erro,
  três temas, contraste e imagem atrasada. As capturas sem credenciais e o
  resultado estruturado estão em `docs/qa/login-visual/`.
- O QA identificou e corrigiu somente no CSS do login a borda reta inferior do
  recorte e o contraste do placeholder/input no tema escuro. Nenhuma conexão
  remota ou alteração de autenticação foi realizada.

## 2026-08-07 — causa raiz e contrato seguro da integração Qlik

- Logs PostgreSQL registraram às `04:00:30Z` os dois `GRANT SELECT` e os dois
  `ALTER POLICY` por `POST /mcp`, usando a identidade OAuth do conector
  Supabase/Codex. A alteração ocorreu depois de tentativas anônimas negadas e
  não veio do proprietário `postgres` de forma autônoma.
- O exportador `qlik-ranking-api.service` e seu script foram auditados na VPS
  de origem: eles apenas autenticam no Qlik, produzem JSON e não possuem cliente
  PostgreSQL/Supabase, DDL, cron ou job de grants.
- O workflow n8n `ranking imobs` está ativo, porém sem execução registrada. Ele
  não contém DDL, grava diretamente por nodes Supabase e sua credencial aponta
  ao projeto antigo, não a `descomplica-crm-production`.
- A migration `20260807185611_secure_qlik_ingestion_contract.sql` revoga todos
  os privilégios diretos nas duas tabelas, remove `anon` das policies, mantém
  RLS/default privileges fechados e cria uma RPC transacional exclusiva do
  `service_role` para substituir as escritas diretas.
- Testes regressivos cobrem a matriz completa, roles das policies, preservação
  por contagem/hash, atomicidade, conflito de replay e idempotência. Nenhuma
  migration remota, workflow, Salesforce ou produção foi alterado nesta etapa.

## 2026-08-07 — reconciliação da baseline Salesforce

- A coleta validada de 06/08 foi confrontada com nova execução do mesmo
  exportador, relatório, filtro e usuário. A comparação ocorreu na VPS da fonte;
  somente contagens e HMACs saíram do ambiente legado.
- As 385 oportunidades adicionais foram criadas e modificadas depois de
  `2026-08-06T21:38:49.821Z`. Não houve oportunidade removida, renomeada ou
  duplicada. A baseline passou de 11.914 para 12.299 oportunidades.
- Doze criações registradas em 07/08 UTC pertencem a 06/08 em
  `America/Sao_Paulo`; o filtro Salesforce usa o fuso do executor e está
  correto. Escopo organizacional e definição do relatório não mudaram.
- Um contato ainda existente teve o status alterado na fonte e deixou o
  relatório de corretores. A base passou de 27 para 26 e o ranking de 108 para
  104 participantes, removendo os quatro períodos do mesmo corretor.
- Nenhuma correção de código foi necessária. Supabase, n8n ativo e produção
  permaneceram sem escrita; as flags Salesforce continuam desativadas.

## 2026-08-07 — reconciliação do drift Supabase/Qlik

- Auditoria somente leitura comparou o projeto `descomplica-crm-production` com um reset local das doze migrations então versionadas. Histórico de migrations, 18 tabelas comuns, funções, sequências, schemas e default ACLs coincidiram por nome e hash.
- O drift da aplicação ficou restrito a duas tabelas Qlik com RLS, duas policies, 339 registros associados a dois runs concluídos e a página `crm.partnerships`. `rls_auto_enable`/`ensure_rls` foram classificados como objetos opcionais gerenciados pela plataforma e já permaneciam sem execução por Data API roles.
- Nenhum caller, view, função, trigger ou rota para o ranking de imobiliárias existe no repositório. Os grants remotos diretos de leitura para `anon`/`authenticated` e escrita/leitura para `service_role` não possuíam contrato versionado.
- A migration corretiva preserva tabelas, linhas e RLS; versiona o DDL e a identidade do catálogo; remove `anon` das policies; recompõe as allowlists de grants; mantém default privileges do papel de migration fechados.
- A migration não foi aplicada remotamente. Salesforce, segredos, produção e automações permaneceram inalterados.

## 2026-08-06 — disponibilidade explícita de metas e roleta

- A primeira carga real foi autorizada sem fonte oficial para metas ou roleta,
  desde que zero não fosse apresentado como resultado comercial.
- O contrato candidato avançou para `schemaVersion: 2`, com
  `goalsAvailable` e `rouletteAvailable` obrigatórios. Fonte indisponível exige
  zeros técnicos e falha se transportar valor comercial diferente de zero.
- A migration `20260806222732_salesforce_source_availability.sql` adiciona flags
  fail-closed aos snapshots. A função v1 foi movida para schema privado, sem
  execução externa, e o wrapper v2 persiste as flags atomicamente sem permitir
  que replay idempotente as altere.
- Dashboard e detalhes mostram “Fonte não configurada”/“Dados indisponíveis” e
  ocultam progresso, atingimento e gap. O ranking exclui roleta da pontuação e
  não apresenta seus pesos como disponíveis.
- Validação parcial: TypeScript, 45 Vitest, 8 testes Node e 190 pgTAP locais
  aprovados. A migration ainda não foi aplicada remotamente e nenhuma carga ou
  automação foi ativada.

## 2026-08-04 — lançamento sem Salesforce

- Branch `feat/salesforce-capability-flags` criada a partir de
  `c1d6af7b80d9ee33b694bdb8907e0a05183c9691` para separar o lançamento inicial
  da ativação futura das integrações.
- Ingestão M2M e refresh humano foram confirmados como capacidades
  independentes. Flags server-side exigem o valor literal `true`; qualquer
  ausência, valor diferente ou configuração incompleta falha fechada com
  `503`, sem cliente privilegiado ou chamada externa.
- A interface recebe somente o booleano de disponibilidade calculado no
  servidor. URL e segredos não atravessam a fronteira de Server Components.
- A configuração Supabase Auth de produção exige somente Site URL
  `https://crm.descomplicapro.com.br`. O código atual não possui callback OAuth,
  magic link ou recuperação de senha e, portanto, não requer redirects
  adicionais de produção.
- Validação local: 40 Vitest, 162 pgTAP, formatação, ESLint, TypeScript, build
  Next.js de 19 rotas, pnpm audit, OSV-Scanner, Gitleaks, actionlint,
  ShellCheck e validadores operacionais aprovados. Nenhuma migration foi criada
  ou aplicada; o Supabase local foi encerrado após os testes.

## 2026-08-04 — preparação da VPS de produção

- Commit-base inspecionado: `e14e9cf24966b86f835c2b717e1af4a42b32f568`.
- Validação da main: Prettier, ESLint, TypeScript, 30 Vitest, build de 18
  rotas, auditoria pnpm, Gitleaks, OSV-Scanner e actionlint aprovados.
- Supabase estritamente local: 162 testes pgTAP aprovados; lint e advisors de
  segurança/performance sem achados. Nenhuma migration remota foi aplicada.
- A implantação Docker/Nginx foi preparada na branch
  `ops/production-vps-docker`; o app permanece em loopback e HTTP público não
  encaminha tráfego antes do TLS.
- Smoke test da imagem standalone: container sem privilégios, filesystem
  somente leitura, limite de 2 GiB/1,5 CPU, healthcheck `healthy`, `/api/health`
  e `/login` respondendo `200` exclusivamente em `127.0.0.1:3000`.
- Hardening do host: usuário `deploy` com chave, senhas SSH desativadas, root
  mantido somente por chave, Fail2ban, atualizações automáticas, sysctl e UFW
  com entrada limitada a 22/80/443. O Nginx retorna `503` em HTTP até o TLS.
- DNS confirmado por Cloudflare, Google, Quad9 e pelos autoritativos
  `pixel.dns-parking.com`/`byte.dns-parking.com`: A `187.127.249.50` e AAAA
  `2a02:4780:75:cad3::1`, ambos com TTL de 300 segundos.
- `Generating static pages` reportou 23 unidades internas do build, não rotas.
  A `main` exibe 18 rotas; esta branch exibe 19 porque acrescenta somente
  `/api/health`. Os manifests confirmam 20 caminhos de aplicação na `main` e 21
  nesta branch, sem remoção. A única mudança no `next.config.ts` é o
  `deploymentId` opcional; não há filtro, rewrite ou alteração de descoberta de
  rotas.
- Node 24.19.0 e pnpm 11.20.0 foram confirmados, sem divergência, no host,
  `package.json`, `.nvmrc`, Dockerfile e GitHub Actions.
- Assistente seguro de ambiente adicionado para uso no Terminal. Ele preserva
  valores válidos, valida as novas chaves Supabase, gera os dois Bearers
  Salesforce e grava o arquivo com troca atômica e permissões restritas.
- Validação final da branch: formatação, ESLint, TypeScript, 30 Vitest, 162
  pgTAP, auditorias pnpm/OSV, Gitleaks de árvore/histórico, actionlint e build
  Next.js com 19 rotas aprovados. O assistente passou por Bash syntax,
  ShellCheck, `visudo`, teste de entrada sem eco e reexecução com preservação
  byte a byte. O Supabase local foi encerrado após os testes.

## 2026-08-03 — preparação obrigatória do ambiente

### Fontes preservadas

| Fonte                        | SHA-256                                                            | Git original             |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `descomplica-crm.zip`        | `1b80ed5f548216fb82452cde93e88b352b3114a9d8fd191b15a24f7950730bbd` | `6783f68`, branch `main` |
| `sistema login completo.zip` | `0ff10c588dede98572f434d0fc58cd64860302d686ef203a595472a6d2c317bb` | `09ae627`, branch `main` |

Os arquivos foram extraídos em cópias isoladas, excluindo `node_modules`, `.next`, metadados Apple e artefatos gerados. Os históricos originais foram preservados em tags e bundles. O repositório final nasceu de clone limpo dos arquivos rastreados do sistema de login.

### Higiene e segredos

- O ZIP do login continha `.env.local` ignorado pelo Git, com credencial pública legada e identificadores reais.
- O arquivo foi movido para quarentena local com permissão restrita; nenhum valor foi copiado para a entrega, logs ou Git.
- Gitleaks do histórico Git: zero achado em 35 commits do login e 126 commits do CRM.
- Gitleaks da árvore: um achado no arquivo local do ZIP do login; zero no CRM.
- Decisão: usar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e solicitar rotação da chave legada ao proprietário antes de qualquer uso remoto.
- O scan bruto da árvore final sinalizou 13 valores aleatórios exclusivamente em manifests/cache `.next`. A configuração Gitleaks passou a excluir somente artefatos gerados/ignorados; código atual e histórico continuam verificados separadamente.

### Baseline — sistema de login original

Ambiente: Node 24.19.0 e pnpm 11.1.2 conforme lockfile original.

| Comando                                | Resultado                                           |
| -------------------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | aprovado                                            |
| `pnpm lint`                            | aprovado                                            |
| `pnpm typecheck`                       | aprovado                                            |
| `pnpm test`                            | inexistente                                         |
| `pnpm build`                           | aprovado com Next.js 16.2.6                         |
| `pnpm audit`                           | 23 vulnerabilidades: 14 altas, 8 moderadas, 1 baixa |
| smoke local `/`, `/login`, `/register` | 307, 200, 200                                       |

### Baseline — CRM original

Ambiente: Node 24.19.0 e npm/package-lock original.

| Comando            | Resultado                                                        |
| ------------------ | ---------------------------------------------------------------- |
| `npm ci`           | instalou 708 pacotes; aviso de pacote depreciado                 |
| `npm run lint`     | exit 0, um warning de variável não usada                         |
| `npx tsc --noEmit` | falhou com 16 erros de tipos Cloudflare/D1 e componentes         |
| `npm run build`    | gerou build Vinext com warnings de imports Node/compatibilidade  |
| `npm test` isolado | falhou: URL ESM `cloudflare:` e arquivo SkeletonPreview ausente  |
| `npm run dev`      | falhou: data de compatibilidade nova demais para o binário local |
| `npm audit`        | 18 vulnerabilidades: 13 altas, 4 moderadas, 1 baixa              |

Uma falha `EEXIST` observada ao executar teste e build simultaneamente foi descartada como corrida artificial; o teste isolado acima é o baseline canônico.

### Dependências e incompatibilidades

- Inventários completos diretos estão em `docs/DEPENDENCIES.md`; `pnpm-lock.yaml` registra a árvore transitiva final.
- Removidos do alvo: Cloudflare plugin, Wrangler, Vinext, Vite/RSC, Drizzle/D1, React Server DOM direto e package-lock.
- Consolidados: Next, React, React DOM, Tailwind, TypeScript, ESLint e tipos.
- Adicionados com uso comprovado: Vitest, Supabase CLI e Sharp.
- Atualizados seletivamente para correções compatíveis: Next 16.3.0, React 19.2.8, Supabase SDK 2.112.0 e SSR 0.12.4.
- Mantidos em versões estáveis compatíveis: TypeScript 5.9.3, ESLint 9.39.5 e Tailwind 4.3.0; não houve atualização indiscriminada.
- Nenhum `--force` ou `--legacy-peer-deps` foi usado.

### Ferramentas instaladas/validadas

| Ferramenta              |   Versão final |
| ----------------------- | -------------: |
| Node.js via NVM         |        24.19.0 |
| NVM                     |         0.40.6 |
| pnpm via Corepack       |        11.20.0 |
| Git                     |         2.50.1 |
| GitHub CLI              |         2.97.0 |
| Docker Engine / Compose | 29.4.3 / 5.1.4 |
| Supabase CLI            |        2.111.0 |
| PostgreSQL client       |           18.4 |
| Gitleaks                |         8.30.1 |
| OSV-Scanner             |          2.4.0 |
| actionlint              |         1.7.12 |
| ShellCheck              |         0.11.0 |

O Homebrew instalou Node 26 como dependência transitiva de uma CLI, mas o shell do projeto foi corrigido para sempre selecionar Node 24 pelo NVM. `.zprofile` e `.zshrc` foram validados em nova sessão.

### Segurança da base final

- Overrides mínimos corrigem faixas vulneráveis de `@babel/core`, `brace-expansion` e `postcss`.
- Uma primeira auditoria final encontrou `@babel/core` 7.29.0 com severidade baixa. OSV indicou correção em 7.29.6; a versão foi confirmada no registro e aplicada por override compatível da mesma linha principal.
- Resultado após correção: 0 crítica, 0 alta, 0 moderada e 0 baixa.
- Política pnpm permite scripts de instalação somente para `esbuild`, `sharp`, `supabase` e `unrs-resolver`.
- CI preparada com permissões somente de leitura, instalação congelada, lint, typecheck, testes, auditoria de severidade alta/crítica e build.

### Supabase local

- PostgreSQL 17.6 validado.
- Quatro migrations aplicadas e sincronizadas localmente.
- Sete tabelas públicas, todas com RLS habilitada.
- Oito papéis e oito permissões estruturais.
- `supabase db lint --local`: nenhum erro de schema.
- `supabase test db`: harness pgTAP disponível; ainda não há arquivos de teste SQL (`NOTESTS`). Os testes atuais obrigatórios são executados pelo Vitest, e cada migration do CRM deverá incluir teste SQL.
- Security advisors: nenhum achado.
- Performance advisors: três warnings de múltiplas policies permissivas de `SELECT`, registrados em `docs/DATABASE.md`.
- Configuração atualizada de `inbucket` para `local_smtp`, redirects HTTP locais e senha mínima de oito caracteres.

### Validação da base final

| Comando                                                  | Resultado                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                         | aprovado                                                          |
| `pnpm lint`                                              | aprovado                                                          |
| `pnpm typecheck`                                         | aprovado                                                          |
| `pnpm test`                                              | aprovado: 1 arquivo, 4 testes                                     |
| `pnpm build`                                             | aprovado: Next.js 16.3.0, output standalone                       |
| `pnpm dedupe --check`                                    | aprovado após deduplicação controlada                             |
| `pnpm audit` e OSV-Scanner                               | aprovados: zero vulnerabilidade conhecida                         |
| smoke local `/`, `/login`, `/register`, `/app`, `/admin` | 307, 200, 200, 307, 307; áreas protegidas redirecionam sem sessão |
| smoke `node .next/standalone/server.js`                  | aprovado em `/`, `/login` e `/app`; artefato de produção inicia   |
| `actionlint .github/workflows/ci.yml`                    | aprovado                                                          |

Na primeira repetição dos gates com o stack local ativo, o ESLint varreu código minificado gerado pela CLI em `supabase/.temp`. O diretório já era gitignored; ele foi também excluído explicitamente do escopo do lint, junto dos demais artefatos de build, e a sequência foi reiniciada.

### Decisões técnicas

1. Sistema de login como base e CRM como fonte funcional.
2. Next.js nativo, sem Cloudflare/Vinext/Vite.
3. Supabase PostgreSQL/Auth/RLS no lugar de D1 e autenticação manual.
4. pnpm único e lockfile único.
5. Build standalone + PM2/Nginx para Hostinger; Docker apenas no desenvolvimento Supabase.
6. GitHub, CI e branch protegida antes da homologação.
7. Nenhuma publicação em produção sem autorização explícita.

### Checkpoint remoto e Gate 0

- Checkpoint local criado na branch `chore/environment-preparation`: `dcb4257` (toolchain/dependências) e `217da89` (CI).
- Todos os gates foram repetidos após documentação e formatação; Supabase reiniciou limpo e foi encerrado com backup local preservado.
- Autenticação `gh` validada em 2026-08-04. Repositório privado criado em `contatoleandrolucass2-a11y/descomplica-crm`, com `main` definida como branch padrão.
- Branch `chore/environment-preparation` e três tags de checkpoint enviadas. PR #1 aprovada pela CI e mesclada em `main` no commit `474e4b9`.
- GitHub Actions run `30875961593`: aprovado em 54 segundos. Instalação congelada, lint, typecheck, 4 testes, auditoria e build passaram.
- A segunda execução verde apontou runtime Node 20 depreciado nas actions v4. `actions/checkout` foi atualizado para v7.0.1 e `actions/setup-node` para v7.0.0, ambas fixadas por SHA completo para reduzir risco de alteração de tag.
- GitHub Actions run `30876134775`: aprovado em 50 segundos com actions v7 e sem a anotação de runtime depreciado.
- GitHub Actions run `30876287356` na `main`: aprovado em 56 segundos após o merge.
- Dependabot alerts e security updates habilitados; branches passam a ser apagadas automaticamente após merge.
- Após a atualização da `main`, Dependabot recalculou zero alerta aberto. A PR automática #2, baseada no lockfile antigo e conflitante com Next.js 16.3.0, foi fechada e sua branch removida.
- Proteção da `main` não foi habilitada: a API exige GitHub Pro para este repositório privado. O projeto permaneceu privado e nenhum plano/cobrança foi alterado. Pull request e CI continuam sendo o fluxo obrigatório documentado.
- Gate 0 encerrado. A migração funcional pode começar em nova etapa/branch a partir da `main` validada.

## 2026-08-04 — visibilidade pública do repositório

- Por solicitação explícita do proprietário, `contatoleandrolucass2-a11y/descomplica-crm` mudou de privado para público.
- Antes da exposição, Gitleaks verificou a árvore atual e 169 commits: zero segredo encontrado.
- GitHub confirmou `visibility: public`; código, histórico, tags, issues, pull requests e Actions passaram a ser acessíveis publicamente.
- Nenhuma configuração de produção, plano ou cobrança foi alterada.
- A proteção da `main`, antes indisponível no plano para repositório privado, tornou-se tecnicamente disponível; não foi alterada porque o pedido se limitou à visibilidade.

## 2026-08-04 — início do Gate 1

- Branch `feat/gate1-page-catalog` criada a partir da `main` pública e verde.
- CRM original inventariado: sete superfícies de página, cinco etapas dinâmicas, nove componentes reutilizáveis e oito endpoints.
- O login Supabase SSR permanece como autenticação única. As três APIs manuais de autenticação do CRM serão descartadas.
- Menu estático será substituído por catálogo PostgreSQL associado a permissões efetivas. Cloudflare, D1, Vinext, Vite, Wrangler e dados demo continuam proibidos.
- Inventário detalhado: `docs/CRM_INVENTORY.md`.

### Catálogo, autorização e painel administrativo

- Migration `20260804041218_page_catalog_and_crm_permissions.sql` criada com 9 novas permissões, catálogo de 14 páginas, grants explícitos, RLS e RPC auditada de visibilidade.
- Novas contas Auth recebem perfil e papel `user`; contas existentes são preenchidas de forma idempotente. Usuário inativo não obtém contexto nem permissões efetivas.
- Painel `/admin/usuarios` permite atribuição de papéis, exceções `allow`/`deny`, remoção de exceções e ativação/desativação dentro da hierarquia.
- Painel `/admin/paginas` controla visibilidade do catálogo. A navegação protegida consulta apenas páginas ativas autorizadas pela RLS.
- Todas as rotas CRM inventariadas existem sob `/app` e possuem guarda server-side específica; conteúdo funcional ainda será migrado por domínio.
- As três policies SELECT duplicadas preexistentes foram consolidadas. Advisors locais de segurança e performance passaram sem achados.
- Reset integral das cinco migrations aprovado. `supabase test db`: 26 testes aprovados; `supabase db lint`: sem erros.
- Build `standalone` gerou 21 páginas. Smoke sem sessão confirmou `/login` e `/register` com HTTP 200 e todas as rotas protegidas redirecionando para `/login`.
- O primeiro processo `standalone` foi iniciado sem as variáveis públicas do Supabase e respondeu 500; a repetição com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` locais passou. Nenhum segredo foi exibido ou persistido.
- Checkpoint funcional criado em `800ba10` e publicado na branch `feat/gate1-page-catalog`.
- PR draft #5 aberta contra `main`; GitHub Actions run `30877794127` aprovou o workflow `validate` em 39 segundos.

### Encerramento do Gate 1

- Autorização ampla recebida para promover e mesclar o trabalho validado.
- PR #5 mesclada na `main` em `33c134a`; GitHub Actions run `30877996373` passou após o merge.

## 2026-08-04 — Gate 2: dashboard somente leitura

- Branch `feat/gate2-dashboard-read-model` criada a partir da `main` atualizada.
- O contrato D1/JSON foi substituído por quatro tabelas normalizadas: snapshots, resumos por visão, métricas e empreendimentos.
- Grants explícitos concedem somente `SELECT` a `authenticated`; RLS exige `crm.dashboard.view`; `anon` e escrita direta permanecem bloqueados.
- `/app` passou a renderizar três visões e três períodos, progresso das cinco etapas, conversões, valor vendido por visão/período e destaques.
- Sem snapshot `global`, a interface exibe estado de espera. Dados demonstrativos e usuário hard-coded não foram migrados.
- Testes locais: 52 pgTAP e 7 Vitest aprovados; schema lint, advisors, ESLint, TypeScript e build também aprovados.
- Teste autenticado no navegador aprovado em 390×844 e 1440×900, sem overflow do corpo ou erros de console. Troca de visão e período atualizou métricas e URL corretamente.
- A fixture e a conta de QA foram criadas apenas no Supabase local e removidas por reset ao final.

### Encerramento do incremento do dashboard

- PR #6 mesclada na `main` no commit `66da130`; GitHub Actions run `30878565908` passou antes do merge e run `30878648010` passou na `main`.
- Branch `feat/gate2-funnel-goals` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: metas dos funis

- O contrato de `GoalsSettingsClient` e `/api/settings/goals` foi analisado no CRM original: dois perfis, seis etapas, cinco taxas e parâmetros operacionais de equipe.
- Migration `20260804044701_funnel_goals.sql` criada sem seed comercial. A tabela usa chave única por perfil/mês, colunas tipadas, constraints, grants mínimos e RLS.
- A RPC `upsert_crm_funnel_goals` exige sessão ativa e `crm.settings.manage`, normaliza o mês, calcula os volumes no servidor, força o escopo reduzido de parcerias, faz upsert e registra auditoria na mesma transação.
- `/app/configuracoes/metas` e `/app/configuracoes/metas/parcerias` substituíram os placeholders. Ambas usam sessão Supabase SSR; a antiga API pública e seus objetos JSON não foram copiados.
- `supabase db reset` aplicou as sete migrations do zero. Os 77 testes pgTAP passaram; Vitest passou com 3 arquivos e 11 testes.
- ESLint, TypeScript e build Next.js passaram. A primeira execução paralela de `typecheck` com `build` encontrou arquivos transitórios de `.next` removidos pelo build; a repetição sequencial passou, sem alteração de código necessária.
- QA autenticada criou metas DV e parcerias no Supabase local. O funil DV foi calculado como `90 → 45 → 30 → 15 → 12 → 10`; parcerias ocultou e zerou as etapas não aplicáveis.
- Usuário comum foi redirecionado para `/unauthorized`. Em 1280 px, largura do documento e `scrollWidth` permaneceram iguais, sem overflow horizontal.
- A conta administrativa, a conta comum e as metas de QA foram removidas por `supabase db reset` ao final.
- Gates finais: instalação congelada, formatação, ESLint, TypeScript, 11 testes Vitest, build de 21 páginas, 77 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: `pnpm audit` sem vulnerabilidades; Gitleaks sem achados na árvore ou em 174 commits; OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de metas

- PR #7 mesclada na `main` em `ca279fd`; GitHub Actions run `30879238469` aprovou a branch e run `30879283419` aprovou a `main`.
- Branch `feat/gate2-points-settings` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: configuração de pontos

- O contrato D1 foi extraído de `PointsSettingsClient`, `/api/settings/points` e `point_goals`: sete métricas, pesos e objetivos armazenados em JSON sem autorização.
- Migration `20260804045945_point_settings.sql` criou o singleton de configuração e sete linhas tipadas, sem seed. `crm.ranking.view` permite leitura; escrita direta permanece revogada.
- A RPC `replace_crm_point_settings` exige conta ativa e `crm.settings.manage`, rejeita payload incompleto/desconhecido/fracionário, substitui a configuração em uma transação e audita.
- `/app/configuracoes/metas/pontos` substituiu o placeholder por formulário server-rendered. Os pesos sugeridos originais aparecem apenas como proposta não persistida no estado vazio.
- Reset integral das oito migrations e 103 testes pgTAP passaram. ESLint, TypeScript, 14 testes Vitest e build de 21 páginas também passaram.
- QA autenticada salvou peso de venda `12` e objetivo de visitas `25`; a releitura confirmou ambos. Em 1280 px não houve overflow horizontal nem warning no servidor.
- Conta e configuração temporárias foram removidas por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 14 testes Vitest, build, 103 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 175 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de pontos

- PR #8 mesclada na `main` em `40982e7`; GitHub Actions run `30879627188` aprovou a branch e run `30879687370` aprovou a `main`.
- Branch `feat/gate2-ranking-read-model` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ranking

- O `RankingClient` original foi analisado: quatro períodos, corretores/gerentes, sete atividades ponderadas, bônus por conversão e critérios de desempate.
- Migration `20260804050720_ranking_read_model.sql` criou snapshots e atividades por corretor/período, sem seed, JSON ou pontuação final congelada.
- A aplicação combina as atividades com os pesos atuais, calcula bônus, ordena corretores e agrega gerentes antes da pontuação.
- `/app/ranking` substituiu o placeholder por Server Component com pódio, resumo, placar, quatro períodos, duas visões e estado vazio sem dados demo.
- Reset integral das nove migrations e 128 testes pgTAP passaram. ESLint, TypeScript, 18 testes Vitest e build de 21 páginas também passaram.
- QA autenticada confirmou três corretores, duas equipes, troca de mês para hoje, URL, placar e cálculo. Documento e `scrollWidth` ficaram em 1280 px, sem warning no servidor.
- Conta, pesos e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 18 testes Vitest, build, 128 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 176 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ranking

- PR #9 mesclada na `main` em `ced2e14`; GitHub Actions run `30880051063` aprovou a branch e run `30880105833` aprovou a `main` após o merge.
- Branch `feat/gate2-stage-details` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: detalhes das etapas

- `StageDetailClient` foi analisado e reduzido ao contrato persistido: cinco etapas, três visões, três períodos, metas, conversões e cinco janelas comparativas.
- As rotas reutilizam `crm_dashboard_metrics`; nenhuma tabela ou cópia JSON adicional foi criada.
- `/app/etapas/[stage]` substituiu o placeholder por Server Component com atingimento, gap, conversão, histórico, plano de ação e navegação sequencial.
- Slugs inválidos retornam 404; `crm.stages.view` protege a rota e a RLS do dashboard continua protegendo os dados.
- ESLint, TypeScript, 21 testes Vitest e build de 21 páginas passaram.
- QA autenticada confirmou `Visitas` com 45/60, conversão de 56,3%, filtros Canal Imob/semana e navegação até `Vendas`. Sem overflow ou warning no servidor.
- Conta e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 21 testes Vitest, build e 128 testes pgTAP aprovados. O schema lint reportou apenas falsos positivos conhecidos da extensão pgTAP; advisors de segurança e performance não encontraram problemas.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 177 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de detalhes

- PR #10 mesclada na `main` em `c4c959a`; GitHub Actions run `30880417097` aprovou a branch e run `30880462632` aprovou a `main` após o merge.
- Branch `feat/gate2-secure-ingestion` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ingestão e Salesforce

- Os três endpoints originais foram relidos. Cloudflare/D1, fallback n8n fixo, status público e refresh sem sessão não foram copiados.
- Migration `20260804052500_secure_salesforce_ingestion.sql` criou `crm_ingestion_runs`, quatro RPCs, grants explícitos, RLS, auditoria, idempotência, locks, cotas, cooldown e rejeição de snapshot antigo.
- `/api/ingest/salesforce` aceita somente contrato Zod v1 normalizado, Bearer M2M de no mínimo 32 caracteres e corpo de até 1 MB. A secret key Supabase está isolada em módulo server-only.
- `/api/refresh/salesforce` exige sessão, `crm.salesforce.refresh`, origem da aplicação e configuração explícita; usa timeout de 15 segundos e nunca devolve resposta ou segredo do provedor.
- `/api/dashboard/status` exige `crm.dashboard.view` e lê uma RPC que expõe somente timestamps e estados seguros.
- O dashboard mostra o botão de refresh somente para usuário autorizado e informa sucesso, concorrência, cooldown ou falha sem detalhes internos.
- Cópias não versionadas `arquivo 2.*` surgiram durante a validação: 16 eram idênticas e uma continha o placeholder antigo do ranking. Todas foram removidas após comparação, evitando compilação duplicada/obsoleta.
- Reset integral das dez migrations passou. `supabase test db` aprovou 161 testes; schema lint e advisors de segurança/performance não encontraram problema no schema da aplicação.
- QA local: status sem sessão `401`, ingestão com segredo inválido `401`, ingestão válida `201`, replay idempotente `200`, refresh autorizado `202` e repetição no cooldown `429`.
- A ingestão de QA atualizou atomicamente dashboard (3 visões/15 métricas) e ranking; o navegador exibiu os dados e não teve overflow em 1280 px. Runs e auditoria registraram somente metadados sanitizados.
- Foi usado apenas um webhook HTTP local descartável. Nenhuma credencial, URL, base ou chamada de produção foi utilizada.
- Gates finais repetidos em banco limpo: instalação congelada, formatação, ESLint, TypeScript, 28 testes Vitest, build de 23 páginas e 162 testes pgTAP aprovados. Schema lint, Actionlint e advisors de segurança/performance passaram sem achados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 178 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ingestão

- PR #11 mesclada na `main` em `9eba53b`; GitHub Actions run `30881418246` aprovou a branch e run `30881474209` aprovou a `main` após o merge.
- Branch `feat/gate3-interface-shell` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 3: shell da interface

- O `SiteMenu` estático foi mantido fora da migração: `AuthorizedNavigation` recebe o catálogo já filtrado e marca a rota atual com `aria-current`.
- `ThemeSwitch` migrou os modos claro, equilibrado e escuro com catálogo fechado, persistência local não sensível e fallback claro quando storage/valor não é válido.
- Tokens globais cobrem superfícies, textos, bordas e campos; foco visível e `prefers-reduced-motion` foram adicionados sem dependência nova ou script inline.
- ESLint, TypeScript, 30 testes Vitest e build de 23 páginas passaram antes da QA.
- QA autenticada confirmou os três temas, persistência ao navegar para Ranking, item ativo e ausência de overflow em 1280 px.
- Conta e preferência de QA foram removidas do banco por reset integral; nenhum dado remoto foi alterado.
- Gates finais repetidos: instalação congelada, formatação, ESLint, TypeScript, 30 testes Vitest e build de 23 páginas aprovados. Auditoria pnpm, Gitleaks na árvore e em 179 commits e OSV-Scanner em 514 pacotes não encontraram problemas.

## 2026-08-04 — compatibilidade de grants do Supabase

- A mudança de defaults da Data API para projetos novos foi confrontada com
  todos os acessos `.from()` e `.rpc()` da aplicação, migrations e testes.
- Migration `20260804191713_normalize_new_project_grants.sql` normaliza ACLs
  atuais e futuras: navegador somente leitura/RPCs guardadas, ingestão somente
  pela RPC server-only e bootstrap exclusivamente por `postgres`.
- A correção não altera policies, RLS, dados, índices ou integração remota. Uma
  matriz pgTAP dedicada cobre tabelas, sequências, funções, `rls_auto_enable`,
  `ensure_rls` e o bootstrap administrativo.
- Reset integral das onze migrations e 177 testes pgTAP passaram. O cenário em
  que `rls_auto_enable`/`ensure_rls` já existem também foi reproduzido em
  transação local; a função perdeu execução pública e o trigger continuou ativo.
- Formatação, ESLint, TypeScript, 40 testes Vitest e build Next.js de 23 páginas
  passaram. Schema lint não encontrou erro; auditoria pnpm, Gitleaks da árvore e
  do histórico, OSV-Scanner e Actionlint não encontraram problema.
- Advisors mantiveram somente o `INFO` de segurança intencional da tabela de
  ingestão sem policy e os informativos preexistentes de performance, sem
  adicionar índices a este escopo.

## 2026-08-06 — candidata Salesforce/n8n de produção

- Os quatro workflows n8n relevantes e o exportador da VPS legada foram
  copiados para backups root-only com SHA-256 antes de qualquer criação.
- Uma alteração externa de estoque no workflow ativo foi identificada e
  preservada sem mistura com a migração do CRM novo.
- O `success` do coordenador foi classificado corretamente como aceite
  assíncrono, não sucesso fim a fim. O ramo externo de estoque passou a expirar
  antes do agendamento/webhook; o transformador ativo não recebe execução
  completa desde 16:04 UTC.
- A resposta bruta da Analytics Reports API confirmou `recordId` estável para
  Opportunity, avaliação de crédito, Contact e Account. O XLSX legado descartava
  essa informação; a candidata agora a usa somente em memória.
- O exportador candidato coleta os sete reports autorizados, remove PII antes da
  serialização, agrega dashboard/ranking e grava o arquivo de validação
  atomicamente com modo `0600`.
- A primeira coleta real produziu 3 views, 15 métricas e 108 participantes. O
  schema Zod aceitou o payload; buscas por IDs Salesforce, e-mail, números longos
  e chaves proibidas no payload final retornaram zero.
- A segunda coleta reproduziu exatamente os tamanhos das sete fontes e
  reconciliou por ID/nome: 63 visitas sem agendamento, 19 pastas e 18 vendas fora
  do recorte de oportunidades, 122 pastas aprovadas, 27 corretores ativos e
  cinco ainda sem gerente resolvido.
- O workflow `GnSUcxUhyPYq6d1l` foi criado inativo, sem credenciais nem chamadas
  externas. Nenhum snapshot, usuário, papel, grant ou policy do Supabase novo
  foi alterado.
- Metas seguem sem fonte M2M confirmada e roleta não existe nos sete relatórios;
  a ativação e a primeira persistência permanecem bloqueadas até decisão
  explícita sobre esses dois campos.

## 2026-08-08 — experiência de usuários e acessos

- Diagnóstico read-only identificou `/app/canal-de-parcerias` como a rota
  observada: nove respostas 404 e nenhum 403/500 no Nginx. O catálogo ativo
  publicava o link sem existir um `page.tsx`; a rota agora mostra somente um
  placeholder protegido por `crm.ranking.view`, sem consultar dados Qlik.
- A conta operacional já havia sido elevada de `user` para `admin` pela RPC
  auditada. `get_user_authorization_context` retornou nível 80 e o conjunto
  administrativo atual; a decisão não depende de claim de papel desatualizada.
- O texto “This page couldn’t load” veio do fallback global padrão do Next.js,
  enquanto o container também registrava tentativa de atualizar o HTML estático
  de `/unauthorized` em filesystem read-only.
- `forbidden()` e `app/forbidden.tsx` agora produzem 403 localizado. 404 e 500
  possuem superfícies próprias em português e códigos técnicos discretos.
- O painel de usuários passou a traduzir papéis/permissões, pesquisar usuários,
  separar herança de exceções, resumir mudanças e manter controles sensíveis em
  “Configurações avançadas”. Master não é atribuível e a própria conta não recebe
  controles de mutação.
- Migration `20260808174817_require_sensitive_access_change_reasons.sql` adiciona
  um trigger privado que reverte elevação, desativação e exceção sem motivo. Não
  altera grants, policies, RLS, assinaturas de RPC ou hierarquia.
- Validação final: ESLint, TypeScript, 57 Vitest + 8 Node, build e 280/280
  pgTAP passaram; lint local, advisors, auditoria de dependências, Gitleaks e
  OSV não encontraram erro novo. Oito checks Chromium confirmaram 403, 404 e
  500 reais, rota protegida, teclado, celular, zoom de 200% sem overflow, três
  temas e Master ausente das opções atribuíveis.

## 2026-08-09 — integrações e read model v3 local

- Gate 0 confirmou base `8ae8a42a7182e432657676e28b4ec29ef7eb354b`,
  worktree limpa, Node `24.19.0`, pnpm `11.20.0`, Supabase CLI `2.111.0` e
  dependências congeladas sem alteração de lockfile.
- Baseline antes da edição: lint/typecheck/build aprovados; 103 Vitest + 8 Node
  aprovados, 1 ignorado; 13 arquivos e 518 testes pgTAP aprovados.
- Investigação separada caracterizou o caller Qlik ativo como `anon` +
  verificador no argumento da RPC legada. Processo e owner nominal continuam
  não identificados; o hardening do PR #28 não pode ser aplicado antes do
  relay/cutover.
- Migrations locais `20260809181422` e `20260809181424` adicionam owners,
  mappings versionados, histórico, fila, lineage, autoridade privada por
  dataset/fonte/workflow/produtor, dimensões canônicas, runs, fatos,
  competências fechadas, ponteiro ativo e RPCs v3 com privilégio mínimo.
- IDs desconhecidos rejeitam o lote inteiro e entram em reconciliação; replay
  conflitante falha; snapshots antigos não substituem o ativo; nomes nunca são
  usados para autorização ou matching.
- Dashboard, cinco etapas, Ranking e Canal de Parcerias v3 usam um loader
  server-only nas rotas shadow `/app/read-model-v3/*`. A flag é desligada por
  padrão, essas rotas ficam fora do catálogo e as páginas de produção continuam
  byte a byte nos leitores v2. Filtros v3 funcionam por período, origem,
  organização, equipe, carteira, coordenador, gestor, corretor, empreendimento
  e localização.
- Quatro permissões v3 por dataset foram catalogadas sem herança automática por
  papel. Os testes criam grants sintéticos exclusivamente dentro da transação
  local para provar Master, Admin, gestor e corretor; permissões v2 globais
  continuam fechadas e o rollout real exige migration posterior.
- Revisão cruzada corrigiu cross-tenant com dimensões nulas, replay semântico,
  corrida de idempotência, lifecycle de mappings, reabertura da fila, precisão
  monetária, gate por dataset, qualidade visual e lineage do leitor Qlik.
- Validação do banco após reset de 20 migrations: 684/684 pgTAP aprovados em
  15 arquivos. O contrato v3 passou 143/143, a governança de identidades 20/20
  e o Qlik 54/54, incluindo ingestão/agregação real de 10.000 fatos dentro do
  timeout. Lint e typecheck passaram; 125 Vitest + 8 Node passaram, com um
  Vitest ignorado; o build gerou 37 páginas.
- Revisão independente adicional exigiu cobertura explícita por escopo/run,
  contenção temporal de todos os presets, limite de 100 caracteres nas chaves
  de provenance, timezone comum ao SQL/`Intl`, normalização consistente dos IDs
  e preservação da opção selecionada fora do cap. O manifesto imutável permite
  provar escopo vazio sem inferir completude a partir de um único fato.
- A revisão final também fechou lineage delegado após mudança temporal de
  topologia: cada aresta pai/filho revalida contenção no instante da consulta;
  membership expirado invalida imediatamente o grant descendente.
- Revisão independente encerrada em 0 P0 / 0 P1 depois das remediações.
- Prettier no diff, auditoria pnpm, Gitleaks da árvore e de 207 commits, OSV em
  518 pacotes, lint dos schemas `public/private`, sintaxe do configurador e
  `git diff --check` passaram. O check global de formato continua apontando
  somente 12 arquivos preexistentes fora do diff.
- QA autenticado exclusivamente local passou 72 checks responsivos, 54 de tema,
  18 rotas a 200%, teclado e reduced-motion. QA PostgREST/RLS provou 9 perfis,
  8 negações comerciais, 8 anônimas e bloqueio de dupla afiliação; todas as
  contas e fixtures efêmeras foram removidas. Os harnesses agora limpam também
  o lineage privado criado pelos novos grants.
- A migration Qlik destrutiva do PR base precede a ponte v3. A pilha atual não
  pode receber migration remota até ser separada em fase aditiva e hardening
  pós-relay; o bloqueio está documentado, não contornado.
- Nenhuma alteração foi feita em produção, Supabase remoto, n8n, Salesforce,
  Qlik, VPS, DNS ou Nginx. Não houve merge nem deploy.

## 2026-08-11 — fundação da homologação visual isolada

- Branch `codex/homologation-visual-release-gate` criada no SHA base exato
  `9f1ca6fca7c7ccd179568dc9f92cc19a0e7bce25`, sem reaproveitar banco, Auth,
  volume, rede, porta, cookie ou conta de produção.
- Compose dedicado limita o app a `127.0.0.1:3100`; o Supabase local usa o
  projeto `descomplica-homologation`, somente fixtures sintéticas e nove contas
  `@local.invalid`. Firewall exclusivo bloqueia externamente as portas do CLI.
- `HOMOLOGATION_MODE` adiciona banner visível, metadados e header `noindex`.
  Cadastro público fica ausente na UI, rota e Server Action. Produção preserva
  o comportamento anterior quando as flags não são definidas.
- Read model v3 fica habilitável somente no Compose isolado. Relay Qlik,
  Salesforce e os 14 motores comerciais continuam desligados; simuladores
  permanecem visuais e bloqueados, sem política ou valor comercial inventado.
- Harnesses RLS/Playwright/visual aceitam a URL remota somente quando o modo
  explícito aponta exatamente para `https://homolog.descomplicapro.com.br`.
  Basic Auth e nove credenciais QA ficam em arquivos root-only e nunca entram
  em argumentos, storage state, Git ou evidências.
- Gate local inicial: instalação congelada, lint, typecheck, 239 Vitest (um
  ignorado), 8 testes Node, build de 37 páginas e 863/863 pgTAP passaram.
  Prettier global, pnpm audit, Gitleaks da árvore/217 commits e OSV em 521
  pacotes também passaram.
- Inspeção somente leitura confirmou produção saudável, recursos suficientes e
  DNS de homologação ainda livre. Nenhum ambiente remoto, DNS ou Nginx havia
  sido alterado neste checkpoint; publicação e QA HTTPS seguem para o próximo
  gate da mesma branch.
- Primeiro ensaio isolado falhou fechado: o Auth havia desligado também o login
  por e-mail ao bloquear signup. As nove contas foram removidas automaticamente.
  O ajuste mantém o provider de login ativo sob `auth.enable_signup=false` e o
  segundo ensaio persistiu exatamente nove contas sintéticas. A fixture visual
  passou a reutilizar o Master isolado completando somente seu perfil QA; carga
  e reexecução idempotente foram verificadas.
- A matriz browser local confirmou login genérico, guards, nove perfis, oito
  superfícies Master, filtros server-rendered e simuladores bloqueados. O teste
  de filtros foi separado da travessia longa e valida os `href` selecionados na
  resposta HTTP autenticada, eliminando corrida de navegação do App Router sem
  reduzir a cobertura. Limites Auth sintéticos foram dimensionados para a
  própria matriz; o gate externo Basic continua obrigatório.
- Cliente DNS Hostinger fail-closed preparado: lê token somente de arquivo
  `0600`, recusa nome existente, valida o payload antes do `PUT` e confirma
  somente o novo `A` de homologação. A etapa permanece sem execução enquanto a
  autenticação privada não existir.
- Após provisionamento privado autorizado, o script criou exclusivamente
  `homolog.descomplicapro.com.br A 187.127.249.50`; DNS autoritativo e recursivo
  confirmaram o registro. Certbot emitiu certificado exclusivo válido até
  09/11/2026. `nginx -t`, reload seguro, Basic Auth, `401` pré-gate,
  `robots.txt`, `noindex`, cadastro `404` e HTTPS autenticado passaram.
- Produção respondeu `{"status":"ok"}` antes, durante e depois. O app isolado
  permaneceu em `127.0.0.1:3100`; banco/Auth/rede/cache têm nomes exclusivos e
  as portas Docker `55321`/`55322` continuam bloqueadas externamente pela chain
  dedicada. Backup Nginx root-only manteve checksum válido.
- QA HTTPS final aprovou 7/7 cenários E2E, nove perfis e a matriz de 21 rotas.
  A matriz visual aprovou 72/72 checks responsivos, 54/54 temas, 87/87 Axe,
  87/87 comparações de baseline e 18/18 rotas a 200%, além de teclado,
  reduced-motion, filtros, cookies e CSP. Maior diferença visual: `0,0885%`
  sob limite de `1%`.
- A primeira execução remota revelou dois races exclusivos do harness: dois
  `<main>` coexistiam durante streaming e o init script tocava o DOM antes de
  `documentElement`. Locators foram ancorados no heading terminal e os scripts
  aguardam DOM/hidratação; cobertura foi preservada e as reexecuções passaram.
- Evidências selecionadas e seus hashes foram versionados em
  `docs/qa/homologation/`. Relay, Salesforce e motores ficaram desligados;
  simuladores estão visualmente completos, mas cálculo e persistência seguem
  bloqueados. Supabase de produção, n8n, Qlik, Salesforce, dados, grants, flags
  e container de produção não foram alterados; não houve merge ou cutover.

## 2026-08-11 — fechamento funcional e preparação fail-closed

- Branch criada sobre o head exato do PR #33. A especificação completa e a
  pilha #26–#33 foram convertidas em matriz rastreável por página, componente,
  fonte, permissão, teste, evidência, estado e bloqueio.
- Breadcrumbs passam a usar somente o catálogo autorizado. As 21 rotas entram
  na matriz autenticada, incluindo Admin, Usuários e Páginas; reduced-motion,
  teclado, três temas, sete viewports, mobile dark, Axe e zoom de 80%, 100%,
  125%, 150% e 200% permanecem gates.
- Aprovação de onboarding exige Master, permissões server-side, papel
  aprovável, escopos oficiais explícitos, motivo e confirmação. Nenhum owner,
  vínculo ou escopo é presumido.
- Metas de funil e pontos foram movidos para draft privado, versionado e
  Master-only, com preview/hashes e sem apply. Ranking rejeita configuração
  legada como política oficial. Os cinco simuladores ganharam a estrutura da
  especificação e seguem sem motor, exportação, persistência ou resultado.
- Dashboard ganhou ritmo, comparativos operacionais, estrutura de corretores
  por gerente e rodapé; Canal ganhou quatro visões, período personalizado,
  resumo, pesquisa, dois rankings e gate de conciliação. Tudo que depende de
  fonte/semântica ausente permanece explicitamente indisponível.
- Simuladores ganharam abas acessíveis, repeaters locais, múltiplos proponentes,
  cenários, inventário/paginação neutros, limpar e impressão estrutural. Nenhum
  controle chama motor, persiste ou exporta cálculo comercial.
- A imagem mantém leitura compatível com o schema produtivo anterior: ausência
  exata das novas RPC/colunas/tabelas cai para legado em revisão e desabilita o
  fluxo novo; outros erros continuam fail-closed.
- O read model v3 valida dataset e escopo da resposta, exige as cinco etapas
  mensais exatas e diferencia stale, indisponibilidade e erro.
- Inspeção de produção foi somente leitura. Backup lógico criptografado,
  root-only e com checksums verificados foi restaurado em container descartável
  sem rede; as dez migrations futuras executaram e o rollback por restore limpo
  passou. Plaintext temporário e container foram removidos.
- O caller técnico Qlik permanece `r4DyPyOTDtoROXq0`; owner operacional,
  substituto, 40 leitores GET, manifesto real de mappings, credenciais privadas,
  políticas e casos de ouro continuam bloqueios externos. Nenhum conflito real
  foi inventado como “zero”.
- Três migrations com efeitos P0 foram marcadas para decomposição forward antes
  de qualquer execução remota. Não houve migration remota, importação real,
  alteração de n8n/Qlik/Salesforce, merge, cutover ou deploy de produção.
- A primeira captura ampliada encontrou contraste insuficiente em três estados
  ativos no tema escuro e um falso positivo que confundia limpar/imprimir com
  execução comercial. As cores foram corrigidas e o gate passou a exigir o
  botão de cálculo explicitamente desabilitado, mantendo controles locais
  estruturais disponíveis.
- A recaptura limpa aprovou 147 combinações responsivas, 84 checks de tema, 192
  auditorias Axe/comparações e 105 checks de zoom. A baseline foi promovida por
  rename transacional, sem persistir conta, senha ou storage state.
- O primeiro disparo do restore rehearsal fechou antes de criar containers ao
  detectar que seu sentinela ainda esperava 863 testes. O contrato foi alinhado
  ao inventário versionado atual: 27 migrations, 18 arquivos e 885 pgTAP.
- Duas execuções independentes do ensaio passaram. A evidência versionada prova
  57 tabelas, 62 relações, 88 funções, owners/ACL preservados, fingerprint
  canônico idêntico e todos os gates/credenciais/policies/mappings vazios.
- A suíte integral revelou duas asserções que ainda descreviam a baseline antiga:
  estado “preparado” e obrigatoriedade de igualdade com a imagem anterior. O
  teste agora exige a baseline promovida íntegra e mantém o diagnóstico anterior
  auditável, permitindo somente os motivos fechados produzidos pelo harness.
- Os primeiros E2E integrais pararam nos títulos legados “Dashboard do funil” e
  “Performance das parcerias”. A matriz foi alinhada aos H1 restaurados
  “Relatório completo da equipe” e “Ranking das Imob’s”; permissões, navegação e
  conteúdo permitido continuam sendo verificados sem relaxamento.
- A travessia Master avançou e encontrou o nome acessível legado do filtro do
  Canal. O seletor foi alinhado ao grupo ampliado “Visões e filtros do Canal de
  Parcerias”, preservando a exigência de visibilidade do controle seguro.
- O E2E chegou aos simuladores e repetiu o falso positivo já encontrado no gate
  visual: três controles locais estavam sendo contados como motor. A asserção
  agora prova ausência de submit/action e exige exatamente um botão comercial,
  identificado pelo motivo de bloqueio e desabilitado.
- O primeiro QA visual HTTPS aprovou E2E 7/7 e todos os gates funcionais/Axe,
  mas rejeitou 11 screenshots de Usuários: homologação possui nove contas QA e
  o baseline efêmero possui uma. A região dinâmica ganhou marcador explícito e
  é omitida somente do screenshot comparável, depois de passar funcional e Axe.
  Um erro de console isolado não foi reproduzido em duas travessias diagnósticas.
- A baseline local estabilizada foi recapturada em worktree limpa e aprovou
  novamente 147 responsivos, 84 temas, 192 Axe/comparações e 105 checks de zoom;
  conta e fixtures efêmeras foram removidas ao final.

## 2026-08-11 — correções do gate visual final

- Auditoria independente recebida no SHA `420af55093da7622cea194aab5b27f13d42c1eab`:
  zero P0, dois P1, quatro P2 e quatro P3. As 21 rotas estavam estruturalmente
  íntegras; responsividade, temas, teclado, zoom, reduced-motion e Axe já
  passavam.
- O shell passou a reservar e truncar toda a cadeia da identidade, além de
  empilhar a navegação a partir de `90rem`. O E2E injeta uma identidade longa em
  `1440×900` e prova ellipsis, ausência de sobreposição e zero overflow raiz.
- O workspace compartilhado dos cinco simuladores agora diferencia controles
  locais habilitados, motor bloqueado e estoque indisponível. O motor continua
  desabilitado, sem submit/action, com cadeado e explicação visível junto ao
  CTA; nenhuma regra comercial foi acrescentada.
- Canal, Ranking e Configurações receberam contraste e copy finais. O termo
  oficial é “imobiliárias”; “Metas de pontos” ficou uniforme; o funil de
  parcerias ganhou H1 contextual; política, ativação e permissões substituem
  jargões técnicos na visão comercial.
- Fontes sintéticas são apresentadas como “Dados sintéticos de homologação”.
  Identificadores de execução, plano e códigos de suporte permanecem fechados
  em `Detalhes técnicos`.
- O E2E local isolado ampliado passou com 8 cenários e um skip remoto, nove
  perfis, 21 rotas, RLS e remoção das nove contas efêmeras. Capturas atuais de
  login, logout, 403, 404, 500, loading, empty, stale e error foram geradas em
  `docs/qa/final-states/`; nenhuma credencial foi persistida.
- A baseline final foi promovida a partir de worktree limpa no SHA
  `a33ec1b0f2f1ff1222288d032d84db1a6a12c6d9`: 147 responsivos, 84 checks de
  tema, 192 Axe/comparações e 105 checks de zoom. Colisão do topbar e contratos
  dos três estados de CTA tiveram zero falhas; conta e fixtures foram removidas.
- Nenhum ambiente remoto, Supabase, n8n, Qlik, Salesforce, DNS ou Nginx foi
  alterado nesta correção. Flags comerciais, allowlists e motores continuam
  desligados.
- O gate visual independente read-only no HEAD `5271b2b` aprovou a entrega com
  P0/P1/P2/P3 iguais a zero. Foram conferidos 192/192 hashes e as superfícies de
  topbar, simuladores, Canal, Ranking, nomenclaturas, cópias e estados finais;
  homologação viva não foi acessada.
- O fechamento técnico aprovou formato, lint, tipos, 263 testes, build, E2E
  isolado, 885 pgTAP, RLS API, lint local do schema, auditorias pnpm/OSV/gitleaks,
  actionlint, shellcheck e validação dos manifests Compose. Nenhum segredo ou
  ambiente remoto foi alterado.

## 2026-08-13 — gate final da contenção P0 Qlik

- A RPC remota `publish_crm_imob_ranking(jsonb,text)` foi auditada sem expor
  corpo sensível: `SECURITY DEFINER`, owner `postgres`, verificador por digest,
  referências de tabela qualificadas, sem SQL dinâmico, sem logs do payload e
  sem retorno de linhas armazenadas.
- O gate encontrou dois excessos: `service_role` ainda executava a RPC e o
  `search_path` não fixava `pg_temp` por último. A migration emergencial agora
  revoga `PUBLIC`, `authenticated` e `service_role`, mantém temporariamente
  apenas `anon` e fixa `pg_catalog, extensions, pg_temp`.
- Verificador ausente e inválido falham fechados com SQLSTATE `42501`, antes de
  qualquer escrita. Testes específicos cresceram de 15 para 28 e passaram no
  restore exato; suíte completa aprovou 913 pgTAP em 19 arquivos.
- Ensaio em dois projetos PostgreSQL 17 independentes aprovou reset das 28
  migrations, backup/restore lógico, 913 pgTAP em origem e destino, lint,
  advisors, owners, ACL e fingerprint canônico idêntico. Formato, lint,
  typecheck, 263 testes e build também passaram.
- Nenhum dado, credencial, workflow, integração ou ambiente remoto foi alterado
  durante este ajuste pré-merge.

## 2026-08-13 — recontenção emergencial P0 Qlik

- O preflight do RBAC detectou duas migrations remotas não pertencentes ao
  fluxo aprovado, registradas às `14:27:23Z` e `14:28:35Z`. O gate do Canal foi
  suspenso antes de qualquer alteração.
- O estado regressivo tinha seis grants diretos de `SELECT` e três policies de
  leitura para `anon,authenticated`. Evidências e logs foram preservados sem
  linhas, identificadores pessoais, tokens ou segredos.
- O log PostgreSQL comprova aplicação via endpoint MCP por principal OAuth
  autenticado. A identidade foi redigida; nenhum CI, deploy da aplicação ou
  workflow Qlik aparece como autor dessas duas migrations.
- Backup contemporâneo root-only passou SHA-256 e restore isolado PostgreSQL
  17.6. As contagens 98/30.091/4.087 e as 20 versões remotas foram reproduzidas;
  o ensaio do roll-forward passou 28/28 pgTAP sem mudar dados.
- A migration exclusiva
  `20260813151446_emergency_qlik_public_read_recontainment.sql` foi aplicada
  isoladamente. Probes GET anônimos retornam 401; RLS/FORCE RLS estão ativos;
  policies de leitura e ACLs diretas estão zeradas. A RPC temporária continua
  somente para `anon`, como exceção já aprovada até identidade dedicada.
- A amostra limitada aos 100 eventos mais recentes registra 80 GETs HTTP 200
  entre `14:44:16Z` e `15:14:31Z`. A origem e o volume retornado não são
  confiáveis no log disponível; não há prova de exfiltração nem base para
  excluir acesso externo.
- Produção da aplicação permaneceu saudável e no SHA
  `b8483c5ddb335530ba8b84fa0f2e1a299c1036f7`. Nenhum workflow, dado,
  credencial, DNS, Nginx, Salesforce ou n8n foi alterado.

## 2026-08-13 — convergência RBAC do Canal de Parcerias

- Após o CI pós-merge da recontenção ficar 3/3 verde, o preflight confirmou
  Qlik fechado e o Canal ainda no estado divergente documentado.
- Aplicada somente a migration `partnerships_rbac_convergence`, registrada
  remotamente como `20260813160418`; nenhuma outra migration pendente entrou.
- Verificação agregada confirmou permissão/catalogo/vínculo Master 1/1/1,
  não-Master 0, overrides 0 e um Master ativo autorizado. Anônimo recebe
  redirecionamento ao login e `/api/health` permanece 200.
- As três tabelas Qlik continuaram com zero grant direto e zero policy de
  leitura. Integrações, motores, allowlists e flags não foram ativados.
