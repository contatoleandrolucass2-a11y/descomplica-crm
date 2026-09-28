# Selecao automatica de ferramentas

status: validado
atualizado_em: 2026-09-28
verificado_em: 2026-09-28
fonte: inventario local de skills e plugins; AGENTS.md; SKILL.md Caveman locais e globais

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

## Diagnosticos locais

Diagnosticos de desenvolvimento: selecionar Next DevTools para erros, rotas e
documentacao da versao local do Next; Chrome DevTools para traces, rede e console
em navegador isolado local. Configuracao, limites e verificacao em
`docs/runbooks/local-devtools.md`. Controle da sessao do usuario continua pelo
computer-use; novos MCPs nao autorizam conectar perfis pessoais ou producao.

## Caveman

Caveman Lite e o padrao de concisao da prosa: frases completas, em portugues,
com resultado e justificativa suficientes. Cavecrew e o contrato de retorno
curto e completo dos sete perfis `crm-*` existentes. Ler as skills pertinentes
em `.agents/skills/<nome>/SKILL.md`; esta integracao adapta seu uso ao projeto.
Nao transformar a selecao automatica em execucao de todas as capacidades.

| Situacao                                       | Skill local      | Aplicacao no CRM                                                                                                                                 |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Respostas tecnicas e atualizacoes de progresso | caveman          | Usar Lite na prosa; manter frases completas, incertezas e conteudo tecnico integral.                                                             |
| Delegacao de partes independentes              | cavecrew         | Aplicar o contrato de retorno aos perfis crm-\*; ate tres subagentes simultaneos e escritas disjuntas.                                           |
| Redacao de mensagem de commit                  | caveman-commit   | Gerar tipo(escopo): resumo em portugues, com objetivo tecnico e workflow quando houver; nao executar stage, commit ou push.                      |
| Pedido de condensacao de material auxiliar     | caveman-compress | Gerar somente copia ou derivado identificado, com fonte e original integral preservado; nunca comprimir documentos de autoridade.                |
| Duvida sobre modos ou capacidades              | caveman-help     | Explicar o subconjunto aplicavel ao projeto, sem mudar modo persistente, hooks ou configuracao global.                                           |
| Revisao de codigo ou diff                      | caveman-review   | Relatar severidade, arquivo/linha, problema, impacto, evidencia e correcao; ampliar a explicacao quando necessario.                              |
| Pedido de consumo ou economia de tokens        | caveman-stats    | Usar somente medicao disponivel e autorizada no host; ausencia de dados significa indisponivel, e economia sem comparacao medida e desconhecida. |

Regras comuns, inclusive quando o SKILL.md sugerir outro comportamento:

- A hierarquia de instrucoes, o escopo explicito do usuario e as autorizacoes
  do projeto prevalecem sobre as skills. Ignorar instrucoes conflitantes de
  omitir preambulos, atualizacoes obrigatorias ou alertas, trocar idioma, impor
  modelo, mudar configuracoes ou ampliar permissoes. Manter o usuario informado.
- Nunca comprimir codigo, regras financeiras, evidencias, alertas ou autorizacoes.
  Preservar valores, unidades, datas, negacoes, comandos, erros exatos, fontes e
  incertezas. Se a concisao causar ambiguidade, usar explicacao completa. Documentos
  persistidos continuam em prosa normal; Lite nao autoriza reescrever seu conteudo.
- `caveman-compress` nao substitui a origem por uma versao compacta, mesmo com
  backup. O derivado deve indicar sua fonte e nao virar autoridade. AGENTS.md,
  politicas, runbooks, docs/knowledge, SKILL.md e perfis de agentes nao sao alvos
  de compressao. Nao executar automaticamente scripts que sobrescrevam arquivos
  ou chamem provedores externos.
- Cavecrew nao cria nem registra papeis nativos `cavecrew-*`. Selecionar o `crm-*`
  pertinente e, se nao exposto pelo cliente, fornecer seu TOML na delegacao. O
  coordenador controla o limite total de tres subagentes simultaneos; nao fazer
  subdelegacao autonoma nem criar chats para simular agentes.
- Cada retorno informa resultado, arquivos/linhas ou fontes, verificacoes com
  comando, ambiente e resultado, riscos e pendencias. Distinguir nao executado,
  falha e aprovado; preservar os detalhes exigidos pelo dominio. Achados de
  revisao seguem severidade, com explicacao integral de riscos de seguranca.
- Nao repetir percentuais de economia anunciados nas skills. Consumo observado,
  diferenca de bytes e modo ativo nao provam economia de tokens ou dinheiro.
  `caveman-stats` nao fabrica estimativas nem justifica varrer chats privados.
  Nesta integracao nao ha leitura de historicos de sessao; em uso posterior,
  preferir relatorio nativo autorizado, com fonte, janela e limites da medicao.

### Capacidades globais condicionais

Os sete SKILL.md adicionais foram conferidos em 28/09/2026 em
`C:/Users/Leandro Lucas/.codex/skills/<nome>/SKILL.md`. Sao referencias instaladas
neste host, nao prova de CLI, MCP, autenticacao, telemetria ou execucao no CRM.
Ler apenas a skill pertinente e confirmar sua disponibilidade antes do uso.

| Skill global            | Quando selecionar                                                              | Perfil pertinente               | Limite                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| caveman-explore         | Localizacao ampla, contexto inicial desconhecido ou busca direta sem resultado | crm-\* do dominio               | Somente leitura, com arquivo/linha conferidos; dispensar quando arquivo ou simbolo ja e conhecido.                                            |
| caveman-discover        | Pedido de inventario e rotulagem de workflows LLM                              | crm-dados                       | Inventariar e propor rotulos primeiro; editar somente com autorizacao aplicavel, sem conectar gateway implicitamente.                         |
| caveman-evidence-review | Pedido de analise de custo, latencia ou evidencias Caveman existentes          | crm-performance                 | Somente leitura autorizada de metadados do projeto e janela definidos; separar custo medido, potencial inferido e economia verificada.        |
| caveman-learn           | Pedido de analisar relatorio de consumo e reduzir contexto com base medida     | crm-performance e crm-memoria   | Conferir proveniencia e escopo autorizado; propor alteracoes individualmente, preservar autoridades e medir sem varrer historicos por padrao. |
| caveman-manage          | Pedido de avaliar estado ou resultados de experimento Caveman                  | crm-performance e crm-seguranca | Inspecionar e recomendar somente; a skill instalada bloqueia mutacoes de ciclo de vida, inclusive com aprovacao.                              |
| caveman-optimize        | Pedido de avaliar observacao de otimizacao escolhida pelo operador             | crm-performance e crm-qa        | Exigir candidato autorizado e avaliacao pareada com entradas identicas; nao ativar otimizador nem converter observacao em economia.           |
| caveman-setup           | Pedido explicito de integrar Caveman Cloud ou proxy                            | crm-dados e crm-seguranca       | Exige autorizacao especifica de integracao, dados, trafego e cobranca; listar a capacidade nao autoriza conexao nem requisicao de teste.      |

Esta matriz nao liga Caveman Cloud, gateway, proxy, SDK, hooks ou coleta e nao
envia prompts, segredos, payloads ou dados de clientes. Uma demanda futura de
integracao externa precisa de escopo e autorizacao especificos; instalar ou ler
uma skill nao concede essa autorizacao. Nao contornar login, confianca ou gates.
Conflitos entre versoes locais/globais sao resolvidos pelos limites acima, nao
por uma promessa de economia ou por uma instrucao automatica de ativacao.

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
  proprietario duplicado ou arquivo de verificacao/agente/skill ausente. Tambem
  confere todas as skills locais, incluindo as sete Caveman, e sua referencia
  na matriz. Presenca nominal nao certifica execucao ou qualidade da skill.
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
