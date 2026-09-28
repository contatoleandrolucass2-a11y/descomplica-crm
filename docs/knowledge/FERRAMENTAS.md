# Selecao automatica de ferramentas

status: validado
atualizado_em: 2026-09-28
verificado_em: 2026-09-28
fonte: inventario local de skills e plugins; AGENTS.md

Estas regras valem para qualquer chat deste projeto. O usuario nao precisa
repetir o nome das ferramentas. Selecionar as pertinentes ao trabalho, ler o
SKILL.md correspondente e executar verificacoes proporcionais ao risco.
Nao acionar todas em toda mensagem nem consumir servicos sem necessidade.

## Roteamento

| Situacao                                      | Ferramenta ou skill                         | Motivo                                                                                                    |
| --------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Inicio e fim de tarefa tecnica                | knowledge:context e knowledge:sync          | Consultar contexto e registrar atualizacoes locais no Obsidian.                                           |
| Lentidao, erro ou causa desconhecida          | investigate-first                           | Medir e localizar a causa antes de editar.                                                                |
| React, Next.js e desempenho                   | vercel-react-best-practices                 | Revisar consultas, estado, efeitos e renderizacao.                                                        |
| UX, fluxo ou interface confusa                | descomplica-ux-audit                        | Avaliar a jornada e a ergonomia do CRM.                                                                   |
| Layout e acessibilidade                       | web-design-guidelines                       | Conferir hierarquia, foco, legibilidade e responsividade.                                                 |
| Testes de interface                           | playwright ou computer-use                  | Validar o fluxo real e inspecionar desktop e celular. Respeitar as regras de controle do navegador ativo. |
| Correcao pontual                              | surgical-patch                              | Resolver no menor escopo responsavel.                                                                     |
| Nova funcionalidade                           | lean-build                                  | Entregar um fluxo completo sem complexidade desnecessaria.                                                |
| Refatoracao                                   | safe-refactor                               | Preservar comportamento e limites entre modulos.                                                          |
| Compatibilidade ou schema                     | migration                                   | Planejar transicao reversivel e validacao.                                                                |
| Banco, SQL, RPC ou RLS                        | Supabase e supabase-postgres-best-practices | Investigar desempenho e autorizacao no servidor/banco.                                                    |
| Design visual maior ou arquivo Figma          | Figma e sua skill especifica                | Reutilizar componentes e referencias de design.                                                           |
| Latencia ou erros com telemetria disponivel   | Datadog                                     | Usar evidencias operacionais reais.                                                                       |
| Jornadas ou funis com coleta disponivel       | PostHog                                     | Analisar comportamento agregado do produto.                                                               |
| Codigo, PR e CI                               | GitHub ou gh                                | Versionar, revisar e verificar gates.                                                                     |
| Auditoria de seguranca de diff ou repositorio | Codex Security e crm-seguranca              | Escolher security-diff-scan ou security-scan conforme o alvo; respeitar preflight e aprovacoes.           |
| Segredos ou dependencias                      | Gitleaks, OSV-Scanner e pnpm audit          | Detectar credenciais e vulnerabilidades; triar achados sem ignorar para obter verde.                      |
| Host novo ou ferramenta indisponivel          | resources:doctor                            | Verificar runtime, pacotes, navegador e CLIs antes de depender deles.                                     |
| Backlog solicitado                            | Linear                                      | Organizar trabalho; nao criar tickets sem necessidade ou autorizacao.                                     |
| Documentacao do Codex                         | openai-docs                                 | Consultar comportamento atual e oficial.                                                                  |
| Validacao final                               | verify-and-stop                             | Comprovar o resultado e encerrar sem ampliar o escopo.                                                    |
| Workflow existente no n8n                     | MCP n8n                                     | Aplicar o fluxo de validacao, alteracao e releitura exigido.                                              |

## Recursos proprios do projeto

Consulta inicial: `knowledge:context`, `knowledge:search "assunto"` e
`knowledge:sync`. Busca nao le conversas: recupera aprendizados curados com
branch, SHA, data de sincronizacao e caminho. Confirmar conclusoes no codigo.

| Demanda                              | Agente especializado | Skill local                      | Por que usar                                                  |
| ------------------------------------ | -------------------- | -------------------------------- | ------------------------------------------------------------- |
| Telas, navegacao, temas, formularios | crm-interface        | descomplica-interface            | Preservar componentes e validar a jornada real.               |
| Backend, banco e integracoes         | crm-dados            | descomplica-dados-integracoes    | Manter contratos, origem e autorizacao dos dados.             |
| Calculos e simuladores               | crm-simuladores      | descomplica-simuladores          | Conferir politica, datas, limites e casos golden.             |
| Lentidao                             | crm-performance      | investigate-first, se disponivel | Separar gargalo de servidor, rede e renderizacao.             |
| Auth, RLS, grants e privacidade      | crm-seguranca        | descomplica-dados-integracoes    | Revisar acesso permitido e negado sem mudar dados.            |
| Testes e evidencias de PR/release    | crm-qa               | descomplica-validacao            | Impedir aprovacao baseada em etapas nao executadas.           |
| Historico de decisoes por assunto    | crm-memoria          | knowledge:search, comando local  | Reutilizar evidencias relevantes sem carregar chats inteiros. |

Os sete perfis estao em `.codex/agents`. Skills proprias ficam em
`.agents/skills`; descoberta automatica permanece no padrao do Codex. Os perfis
herdam modelo e esforco do coordenador; nenhum custo/modelo fixo e imposto.
Em tarefa ampla, delegar somente partes independentes (ate tres simultaneas),
com objetivo, arquivos permitidos e verificacao esperada. O coordenador evita
escritas concorrentes, revisa a entrega e registra a conclusao final. Tarefa
simples nao precisa de subagente. Se a ferramenta nao expuser selecao de papel,
fornecer o arquivo do perfil na delegacao; nao afirmar selecao nativa inexistente.

Arquivos de configuracao sao carregados conforme a versao e confianca do cliente.
Nao liberar confianca automaticamente. Chats existentes podem precisar de nova
sessao; branches antigas usam o runtime/referencias locais, mas so recebem os
perfis versionados quando a mudanca estiver integrada nelas.

## Inventario e cobertura

- `docs/knowledge/recursos.json`: mapa exaustivo dos arquivos de pagina/API,
  nao de todas as combinacoes de dados, papeis e slugs dinamicos.
- `pnpm resources:check`: falha com rota nova sem mapa, rota removida,
  proprietario duplicado ou arquivo de verificacao/agente/skill ausente.
- `tests/project-resources.test.ts` integra essa conferencia ao `pnpm test` e
  a CI existente. Ao mudar catalogos dinamicos, ampliar os testes do dominio.
- `pnpm resources:doctor`: confere Node, pnpm, pacotes, Chromium, execucao do
  Supabase CLI e scanners compativeis (Gitleaks 8.19+ da serie 8, OSV serie 2).
  Nao altera o projeto nem acessa dados do CRM; o CLI pode consultar atualizacoes.
  Docker e opcional no desktop porque os gates de banco/restore rodam na CI.
  Nao comprova autenticacao de plugins, funcionamento do daemon nem testes.
- Auditoria e lacunas: `docs/audits/recursos-crm-2026-09-28.md`.

## Disponibilidade confirmada

- Verificar a disponibilidade real em cada host e chat; instalacao nao implica
  conta conectada, permissao, projeto selecionado ou telemetria configurada.
- PostHog nao estava autenticado na verificacao de 27/09/2026. E opcional;
  ausencia dele nao impede otimizar ou testar o CRM.
- Catalogo consultado em 27/09/2026 confirmou GitHub, Supabase, Figma, Datadog,
  PostHog e OpenAI Developers instalados. Isso nao confirma autenticacao,
  projeto selecionado ou coleta do CRM. Conferir no momento do uso.
- Em 28/09/2026, o catalogo confirmou Codex Security instalado e habilitado.
  O plugin exige a skill e seu preflight antes de qualquer scan; deep-security-scan
  apenas quando explicitamente solicitado. Nao rodar scan total a cada chat nem
  conceder confianca automaticamente. Os gates locais/CI nao dependem dele.
- Playwright, axe, Vitest, pgTAP, pnpm audit e restore isolado ja fazem parte
  do projeto. Gitleaks 8.30.1 e OSV-Scanner 2.6.0 foram instalados neste Windows
  em `~/.local/bin`, ja presente no PATH, com SHA-256 dos releases oficiais.
  `pnpm security:secrets` passou; `pnpm security:osv` detectou somente o advisory
  moderado GHSA-82fw-gwwq-j7x9 em Vitest e @vitest/mocker 4.1.10, tratado no
  PR Dependabot #65. Saida 1 de achados nao significa falha de instalacao.
  Verificar novamente em outro host; nao declarar varredura sem executa-la.
- Fontes de instalacao: [Gitleaks](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
  e [OSV-Scanner](https://github.com/google/osv-scanner/releases/tag/v2.6.0).
  Nao baixar binarios de espelhos nem executar instaladores sem verificar origem.
- Os sete perfis foram expostos pela ferramenta de subagentes nesta sessao.
  Uma delegacao real crm-qa confirmou aplicacao das instrucoes. Isso nao prova
  execucao dos outros seis perfis; selecionar somente quando a tarefa precisar.
- Em falta de conector, usar uma alternativa local verificavel quando existir.
  Nao instalar SDK de rastreamento, enviar dados ou abrir contas automaticamente.
- Nao alterar configuracoes de seguranca, confianca de hooks ou permissoes para
  forcar uma ferramenta. Comunicar bloqueios reais com precisao.
- Em 28/09/2026, o diagnostico CLI reportou timeout na verificacao opcional do
  MCP n8n. Isso nao prova indisponibilidade permanente, mas exige confirmar o
  MCP antes de qualquer tarefa n8n. Nao usar REST nem alterar credenciais para
  contornar. O aviso de ambiente node_repl no CLI isolado nao prova falha do
  navegador no app, que foi utilizado nesta auditoria.
- As regras de autorizacao e seguranca de AGENTS.md permanecem prioritarias.
