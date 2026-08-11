# Changelog

## Unreleased

- Fecha lacunas determinísticas da especificação com rastreabilidade das 21
  rotas, breadcrumbs autorizados, aprovação Master-only por escopos oficiais,
  drafts privados de metas/pontos, ranking fail-closed, estados v3 estritos e
  estrutura completa dos cinco simuladores sem incorporar regra comercial.
- Completa estruturas seguras de Dashboard e Canal de Parcerias — ritmo,
  comparativos, roster indisponível, quatro visões, período, resumos, rankings e
  conciliação — e adiciona abas, repeaters, cenários, inventário e controles
  locais aos simuladores sem motor, persistência ou exportação comercial.
- Mantém compatibilidade app-first com o schema produtivo anterior: somente a
  ausência exata das foundations novas cai para leitura legada fail-closed;
  falhas de permissão, rede e validação continuam interrompendo a operação.
- Amplia o contrato de QA visual para sete viewports, zoom de 80% a 200%, mobile
  dark e três temas nas páginas administrativas; a nova baseline só pode ser
  promovida por execução limpa e transacional, sem reutilizar dados, contas ou
  credenciais de produção.
- Distingue controles estruturais locais dos botões de cálculo bloqueados no
  gate dos simuladores e corrige contraste dos estados ativos no tema escuro.
- Comprova backup produtivo criptografado e root-only por leitura, restore
  representativo sem rede, aplicação isolada das dez migrations futuras e
  rollback limpo; nenhuma migration, flag, grant ou dado remoto foi alterado.
- Consolida os riscos P0 das migrations, o merge train #26–#33, os bloqueios de
  caller/mappings/políticas e o pacote de decisões necessário para canário,
  cutover e produção.
- Atualiza o ensaio isolado para o manifesto atual de 27 migrations e 885 casos
  pgTAP distribuídos em 18 arquivos.
- Atualiza o contrato unitário da baseline promovida para preservar e validar o
  diagnóstico do baseline anterior sem tratar mudanças intencionais como drift
  do baseline novo.
- Alinha o E2E de permissões ao título oficial restaurado do dashboard.
- Publica a homologação visual isolada em HTTPS com DNS/TLS exclusivos, Basic
  Auth antes do login, `noindex`, nove perfis e fixtures somente sintéticas;
  E2E remoto, 21 rotas, 87 checks visuais/Axe, quatro viewports, três temas,
  zoom, teclado, RLS e isolamento passam sem ativar relay ou motores.
- Estabiliza os harnesses Playwright contra a coexistência transitória do
  loading boundary e contra execução do init script antes do DOM, sem reduzir
  testes nem alterar comportamento da aplicação.
- Torna os dois gates locais que consomem `supabase status --output json`
  tolerantes às mensagens informativas do CLI ao redor do único objeto JSON,
  mantendo rejeição fail-closed para saída ausente, truncada ou ambígua.
- Adiciona E2E Playwright local com nove perfis, autenticação e matriz exata das
  21 rotas/permissões,
  superfícies comerciais, filtros, flags off, endpoints e simuladores
  bloqueados, usando apenas contas/fixtures efêmeras removidas no encerramento.
- Corrige o ciclo de redirect de identidades autenticadas sem contexto aprovado,
  retornando 403 genérico com logout seguro sem expor o estado do onboarding.
- Versiona quatro markers históricos no-op para migrations remotas sem copiar
  verifier, grants, fórmula ou DDL inseguro e atualiza a matriz com relay e
  runtime comercial.
- Adiciona ensaio reproduzível em dois projetos PostgreSQL 17 locais e
  independentes, com reset de 27 migrations, 885 pgTAP/lint/advisors em ambos,
  backup/restore lógico e fingerprint fail-closed de owners, privilégios, RLS,
  DDL, ledger e dados, sem mutar ACL no alvo.
- Remove dois warnings do lint SQL com inicialização tipada explícita dos arrays
  UUID internos do read model v3, sem alterar a regra de negócio.
- Consolida pacote de aprovações, auditoria #26–#31 e runbook de merge train,
  canário, rollback floor e deploy; toda mudança remota continua bloqueada.
- Identifica o SHA de release sanitizado no healthcheck e amplia CI com formato,
  banco, E2E, matriz visual e restore isolado.
- Propaga `IMAGE_TAG` como identidade de runtime do container para tornar a
  conferência de canário e rollback verificável pelo healthcheck.
- Torna a QA visual objetiva com 87 comparações de baseline e auditorias WCAG
  A/AA, mantendo candidatos separados, baseline imutável no modo de verificação
  e screenshots sanitizados sem credenciais.
- Corrige contraste do aviso de indisponibilidade dos simuladores e do rótulo
  de capacidade das metas nos três temas.
- Adiciona runtime determinístico e versionado para 14 motores comerciais, com
  DSL fechada, decimal exato, datas civis, casos de ouro obrigatórios e hashes
  canônicos, sem incorporar fórmula, meta, ponto, prêmio ou valor real.
- Cria catálogo/ledgers privados com `FORCE RLS`, versões estritamente
  monotônicas e imutáveis, preview/apply Master-only, owners/backup oficiais,
  gates shadow/active e evidência de execução somente por hashes.
- Isola lookup/auditoria em conexão PostgreSQL server-only e papel dedicado
  `NOLOGIN`, vinculada ao project ref da aplicação, sem acesso de Data
  API/tabela e com flags, allowlist e URL vazias; nenhuma policy, grant de
  execução ou gate é seedado.
- Adiciona endpoint autenticado e same-origin para os cinco simuladores, ainda
  desconectado dos formulários, com 256 KB, output somente após ledger, shadow
  sem resultado e indisponibilidade fail-closed.
- Adiciona verifier local sem rede, manifesto atômico `0600`, fixture de hash
  compartilhada TS/pgTAP e cobertura de RLS, ACL, replay, monotonicidade,
  rollback, concorrência de ator/owner e isolamento do papel.
- Adiciona relay Qlik autenticado por HMAC, desligado por padrão, com conexão
  PostgreSQL dedicada, papel/RPC de menor privilégio, replay distribuído, rate
  limit, duas janelas shadow, duas canary, saúde agregada e rollback lógico.
- Identifica por evidência somente leitura o publisher n8n ativo e seu owner
  técnico; owner operacional/backup e leitores residuais continuam bloqueando
  ativação. Nenhum valor de credencial foi copiado ou versionado.
- Adiciona importação de mappings com manifesto canônico, preview, conflitos,
  hash de plano, confirmação dupla e apply atômico Master-only, sem criar
  owners, targets ou associações presumidas.
- Fecha a primitiva elementar de mapping para Data API; mutações autenticadas
  passam pelo lote com autoridade e hashes, inclusive em replay histórico.
- Converte a migration Qlik anterior em ponte aditiva que preserva o caller
  legado; revogação/removal destrutiva permanece fora desta branch.
- Adiciona read model v3 local com runs/fatos imutáveis, hash semântico,
  publicação atômica, competências fechadas explícitas e estados separados de
  fonte, qualidade e publicação; nenhum número fictício é persistido.
- Exige manifesto imutável de cobertura por run/escopo, inclusive para escopos
  vazios; período ou escopo não certificado fica indisponível em vez de produzir
  totais parciais ou falso zero.
- Versiona IDs externos com vigência, owner, evidência, histórico e fila
  privada de reconciliação; IDs pendentes ou desconhecidos rejeitam o lote
  inteiro e nunca usam nome como associação.
- Registra lineage pai/raiz dos grants de reporting scope e exige cadeia
  efetiva nas leituras v3; grants históricos sem ancestry comprovável ficam
  marcados para reconciliação.
- Adiciona autoridade privada e única por dataset/fonte/workflow/produtor;
  owner, aprovação, evidência e cobertura são obrigatórios antes da ingestão.
- Disponibiliza Dashboard, cinco etapas, Canal de Parcerias e Ranking em rotas
  shadow `/app/read-model-v3/*`, ocultas por flag server-side e fora do catálogo,
  com filtros de período, origem, organização/House, equipe, carteira,
  coordenador, gestor, corretor, empreendimento e região/stand. As rotas de
  produção e seus leitores v2 permanecem inalterados.
- Limita cada catálogo dimensional a 100 opções com truncamento explícito e
  preserva toda seleção autorizada dentro do cap.
- Cataloga permissões v3 separadas para funil, ranking, parcerias e estoque sem
  concedê-las automaticamente a papel algum. Os testes ativam grants sintéticos
  locais para provar Master, Admin, gestor e corretor sem reabrir os read models
  v2 globais; o rollout real exige migration posterior e compatível com rollback.
- Preserva moeda em strings decimais exatas na ingestão/leitura v3 e na leitura
  Qlik escopada, inclusive acima da precisão segura do JavaScript.
- Atualiza os teardowns de QA local para remover o lineage privado antes dos
  grants efêmeros, mantendo contas e fixtures sintéticas autocontidas.
- Inventaria caller Qlik e consumidores de `service_role`; o publisher e owner
  técnico foram identificados, sem promover owner formal ou leitor residual por
  inferência. Não houve cutover, migration remota, alteração n8n/Salesforce/Qlik,
  deploy ou merge.
- Comprova por leitura o projeto Supabase remoto, versiona DDL/inventário
  sanitizados e valida backup oficial em restore isolado com contagens,
  checksums, Auth, Storage, grants, policies e pgTAP, sem mutação remota.
- Prepara onboarding `pending` deny-by-default, papéis técnicos, organizações,
  equipes, carteiras, pessoas e reporting scopes com aprovação atômica,
  auditoria e matriz RLS sintética.
- Endurece a topologia de autorização contra TOCTOU: locks por pessoa/carteira,
  perfis bloqueados em ordem determinística, revalidação pós-lock, fronteiras
  imutáveis, manutenção somente com usuário suspenso, aprovação/reativação
  Master ou Admin e cardinalidade central dos papéis de escopo único.
- Converge localmente o schema Qlik das três tabelas, remove ACL/policies
  diretas no estado proposto e limita ingestão/leitura a RPCs específicas;
  aplicação remota continua bloqueada até o cutover do caller legado.
- Documenta plano de `service_role`, conta QA, rollback, riscos e pacote
  completo das decisões comerciais ainda sem autoridade; simuladores, roleta
  e prêmios permanecem bloqueados.
- Adiciona gate de reconciliação local/remoto com matriz das 20 versões,
  evidência sanitizada do schema, plano de baseline/backup/restore/domínio,
  contratos tipados Salesforce/n8n/Qlik e estoque fail-closed, inventário de
  políticas e proposta deny-by-default de escopos/RLS; sem mutation remota.
- Consolida a paridade visual das 18 páginas: ranking, Canal de Parcerias,
  configurações, metas e cinco jornadas de simulação passam a compartilhar a
  mesma linguagem analítica navy/cyan/lime.
- Adiciona ao catálogo protegido o hub e as rotas WF13, WF16, CAIXA, WF14 e
  WF15 com `crm.simulators.view`, guard server-side e matriz de papéis
  versionada.
- Entrega formulários e painéis completos dos simuladores com motores
  fail-closed: validação acessível fica somente no navegador, sem submit,
  persistência, fórmula ou valor fictício; todo resultado permanece
  explicitamente indisponível.
- Restaura diagnóstico, gargalo e plano de ação do dashboard e ícones
  semânticos na navegação autorizada, sem ampliar acesso ou inferir regra
  comercial.
- Adiciona runner autenticado estritamente local que cria conta/fixtures
  efêmeras, valida marcador e contagens via RLS, captura as 18 rotas e remove
  tudo no encerramento, sem persistir credenciais.
- Versiona o inventário das 18 páginas da referência viva, matriz de paridade,
  catálogo de componentes/fontes e baseline visual com máscara opaca antes da
  captura.
- Adiciona design system analítico navy/cyan/lime, topbar hierárquica autorizada
  e componentes reutilizáveis de cards, filtros, roscas, funis, gauges,
  tabelas, rankings, skeletons e estados.
- Restaura dashboard e cinco etapas sobre o read model existente, preservando
  campos ausentes como “Indisponível” e sem copiar projeções, filtros ou regras
  comerciais sem fonte oficial.
- Adiciona Playwright apenas como dependência de desenvolvimento, com harness
  versionado para baseline sanitizada e verificação de acesso anônimo. O
  harness exige origem explícita, isola contextos, valida rota/headers/DOM antes
  e depois da captura e só persiste o conjunto após aprovação integral.
- Ajusta somente o proxy HTTPS de `crm.descomplicapro.com.br` para aceitar os
  headers de resposta da sessão Supabase, com buffers Nginx mínimos medidos e
  runbook de validação, reload e rollback.
- Integra visualmente o cadastro à experiência aprovada do login, reutilizando
  o cérebro mecânico, responsividade, temas, touch e redução de movimento sem
  alterar o fluxo de criação de conta ou qualquer contrato de segurança.
- Corrige o advisory `GHSA-2v37-7h3g-55p8` fixando `nanoid` transitivo em
  `3.3.17`, sem atualizar outras dependências.
- Reformula visualmente o login com layout responsivo em duas áreas e cérebro
  mecânico interativo, validado em desktop, tablet, celular, zoom, touch e
  redução de movimento, sem alterar o formulário ou o fluxo de autenticação.
- Adiciona implantação Docker Compose do build Next.js standalone, limitada a
  loopback, com healthcheck, limites de recursos, logs rotacionados e rollback
  por tag imutável.
- Adiciona endpoint de liveness e configurações Nginx separadas para a fase HTTP
  segura e para a ativação posterior de HTTPS.
- Adiciona assistente interativo para gravar o ambiente de produção
  atomicamente, sem eco de segredos, com validação das chaves atuais do Supabase
  e geração criptográfica dos Bearers Salesforce.
- Adiciona flags server-side independentes para ingestão e refresh Salesforce,
  desativadas por padrão, com endpoints e interface em estado fail-closed.
- Normaliza grants de tabelas, sequências e RPCs para os defaults fail-closed
  dos novos projetos Supabase, com matriz pgTAP de privilégio mínimo.
- Adiciona exportador candidato de sete relatórios Salesforce com projeção
  mínima sem PII, identidades estáveis, transformação para o contrato v2 e
  workflow n8n inativo/fail-closed para validação antes da primeira ingestão.
- Distingue metas e roleta sem fonte oficial de resultados comerciais iguais a
  zero, persiste flags fail-closed e mostra estados neutros na interface.
- Versiona o schema remoto do ranking Qlik de imobiliárias sem seed ou perda de
  dados e remove seus grants diretos não auditados de Data API/service role.
- Atualiza a baseline Salesforce após reconciliação somente leitura comprovar
  385 oportunidades criadas depois do snapshot e uma alteração legítima no
  status da base de corretores, sem escrita no Supabase ou ativação do n8n.
- Corrige o drift Qlik sem acesso direto à Data API e adiciona uma RPC
  transacional, idempotente e exclusiva do `service_role` para o workflow n8n.
- Localiza papéis, permissões e estados 403/404/500; compacta a gestão de
  usuários, exige motivo transacional para alterações sensíveis e adiciona a
  rota protegida do Canal de Parcerias sem leitura Qlik ou mudança de grants.

Todas as alterações relevantes deste projeto serão registradas aqui.

## [Não publicado]

### Adicionado

- Homologação visual isolada com Compose/volumes/rede/portas próprios, Supabase
  local sintético, nove perfis QA, Basic Auth, noindex, banner persistente,
  cadastro público bloqueado, firewall dedicado, E2E remoto e rollback sem
  cutover.
- Vitest e testes iniciais dos schemas de autenticação.
- Scripts de verificação, auditoria, scanners e Supabase local.
- Build Next.js `standalone` para a VPS.
- Documentação reproduzível de ambiente, arquitetura, banco, segurança, integrações, backup e migração.
- Workflow GitHub Actions com todos os gates obrigatórios da base.
- Catálogo PostgreSQL com 14 páginas e navegação filtrada por permissão efetiva.
- Painel administrativo inicial para papéis, exceções, status de usuários e visibilidade de páginas.
- Provisionamento automático de perfil e papel mínimo para novas contas Supabase Auth.
- Rotas protegidas para todas as superfícies inventariadas do CRM.
- Dashboard comercial server-rendered com três visões, três períodos, metas, conversões e destaques.
- Read model PostgreSQL normalizado do dashboard com quatro tabelas, constraints, grants e RLS.
- Metas mensais dos funis DV e parcerias com tabela tipada, cálculo server-side e histórico por mês.
- Server Action e RPC de metas protegidas por `crm.settings.manage`, RLS e auditoria atômica.
- Configuração normalizada de pesos e objetivos das sete atividades do ranking.
- Server Action e RPC de pontos com substituição integral, validação e auditoria atômica.
- Ranking server-rendered de corretores e gerentes, com quatro períodos, pódio e placar completo.
- Read model normalizado de atividades do ranking, recalculado com os pesos atuais.
- Detalhes server-rendered das cinco etapas com visões, períodos, conversão e comparações históricas.
- Route Handlers seguros para status, refresh e ingestão Salesforce, com contrato Zod versionado.
- Histórico de ingestão, RPC transacional, idempotência, rejeição de snapshot antigo e botão de refresh autorizado.
- Shell protegido com navegação ativa e temas claro, equilibrado e escuro persistidos localmente.

### Alterado

- Base fixada em Node 24.19.0, pnpm 11.20.0, Next.js 16.3.0, React 19.2.8 e Supabase SDK 2.112.0.
- Supabase SSR passou a usar a publishable key e validação de claims no middleware.
- Política de scripts de instalação e overrides transitivos de segurança centralizados no workspace pnpm.
- Policies SELECT duplicadas consolidadas sem ampliar acesso.
- Dependências D1/JSON e `sf_relatorio_resumo` removidas do caminho de leitura do dashboard.
- API pública `/api/settings/goals` substituída pelo SDK SSR e pela RPC auditada.
- API D1 `/api/settings/points` substituída pelo SDK SSR e pela RPC auditada.
- Endpoints Cloudflare/n8n de status, refresh e ingestão substituídos por Supabase, segredos server-side e respostas sanitizadas.

### Segurança

- Flags da homologação falham fechadas; read model v3 pode ser visualizado
  apenas no ambiente sintético, enquanto relay Qlik, integrações externas e
  motores comerciais permanecem desligados.
- Removidas vulnerabilidades críticas/altas/moderadas conhecidas da árvore final.
- Arquivo de ambiente presente no ZIP de origem removido da árvore de entrega e colocado em quarentena local.
- Usuários inativos bloqueados no contexto de autorização e na resolução de permissões usada pela RLS.
- Mutações administrativas protegidas por guarda server-side, RPC hierárquica e auditoria no banco.
- Escrita direta das metas revogada para o navegador; perfil inativo ou sem permissão falha fechado.
- Pesos do ranking expostos somente para leitores autorizados; escrita direta permanece revogada.
- Snapshots e participantes do ranking protegidos por `crm.ranking.view`, sem fallback demonstrativo.
- Ingestão limitada a 1 MB e 20 snapshots/minuto com secret key server-only; refresh protegido por mesma origem, permissão, lock, cooldown e timeout.
