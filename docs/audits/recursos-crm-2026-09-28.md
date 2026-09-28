# Auditoria de recursos do CRM

status: validado (inventario e mecanismo local, nao certificacao integral do site)
atualizado_em: 2026-09-28
verificado_em: 2026-09-28
fonte: checkout baseado em 9800281; navegador Chrome autenticado Master;
package.json; .github/workflows/ci.yml; catalogo de plugins; documentacao oficial

## Escopo e limites

Analise do projeto inteiro por areas, com inventario dos 40 arquivos de paginas
e handlers em nove dominios. Isso nao significa auditoria exaustiva de todas as
combinacoes de papeis, slugs, estados financeiros ou integracoes remotas.
Nenhuma regra comercial, dado remoto, permissao ou publicacao foi alterada.

No navegador foram abertas 19 rotas de producao em leitura: dashboard, cinco
etapas, ranking, parcerias, quatro configuracoes, tres paginas administrativas,
hub de simulacao, Associativo, Direta e Investidor. Nao houve envio de formularios,
refresh, calculo remoto, alteracao de usuario ou extracao de estoque/clientes.
Registros tecnicos nao incluem nomes, emails, propostas ou dados comerciais.

O dashboard foi inspecionado em 375x812, 768x1024, 1024x768 e 1440x900, sem
overflow horizontal global observado. Screenshot inspecionado no mobile;
outras larguras conferidas por geometria DOM. Isso nao certifica contraste,
teclado, todas as sobreposicoes ou todos os papeis. Console consultado no painel
sem erros capturados; nao equivale a monitoramento historico.

Autenticacao, documentos legais, read-model-v3, APIs e simuladores nao expostos
foram inventariados pelo codigo e referencias de testes. Nao foram exercitados
integralmente em producao. Sem nota numerica de UX: falta evidencia por perfil
para uma pontuacao representativa. Corretor e imobiliaria exigem contas sinteticas
e matriz de autorizacao; a sessao real observada era Master.

## Achados e prioridades

| Prioridade                    | Evidencia                                                                                                                              | Impacto e proximo passo                                                                                                                                  | Criterio de aceite                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Alta, configuracao de negocio | Dashboard/etapas: "Fonte nao configurada" explica que realizados sao reais, mas metas/atingimento/arcos aguardam fonte oficial segura. | Gestor e imobiliaria nao devem interpretar ausencia de meta como zero. Confirmar fonte e politica antes de configurar. Nao e prova de falha no snapshot. | Metas aprovadas, proveniencia e periodo conferidos; estado ausente continua explicito. |
| Alta, configuracao de negocio | Ranking: "Ranking bloqueado por politica"; parcerias: "Aguardando conciliacao das fontes".                                             | Comparacao por corretor/imobiliaria nao pode ser liberada por simples ajuste visual. Usar agente de dados e testes de conciliacao/RLS.                   | Fonte conciliada e politica autorizada; divergencias e papeis negados testados.        |
| Media, resolvida nesta etapa  | context anterior nao pesquisava aprendizados de outros worktrees.                                                                      | Novos chats tinham instrucoes de leitura, mas recuperacao dependia de busca manual. Adicionado knowledge:search limitado e com proveniencia.             | Testes de worktrees, deduplicacao, limites e recusa de adulteracao aprovados.          |
| Media, resolvida nesta etapa  | Skills locais eram genericas; nao havia perfis de agentes neste checkout.                                                              | Criados quatro procedimentos de dominio e sete perfis, sem duplicar frameworks ou forcar plugins externos.                                               | Arquivos validos, referencias existentes e orientacao automatica no AGENTS.            |
| Media, resolvida nesta etapa  | Nao havia verificacao de cobertura do mapa de ferramentas por rota.                                                                    | Manifesto recursos.json e teste impedem rota nova sem area/agente/skill/evidencia.                                                                       | resources:check passa; fixture com rota desconhecida falha.                            |
| Media, investigacao futura    | Estoque tem benchmark de facetas e Server-Timing; nao foi estabelecido nesta etapa um SLO ponta a ponta por jornada.                   | Cronometrar frio/quente, TTFB, resposta, payload e interatividade antes de novas otimizacoes.                                                            | Baseline reproduzivel, percentis e orcamentos acordados, sem carga na VPS de producao. |
| Baixa, UX a validar           | No mobile, cabecalho e apresentacao do painel ocupam grande parte do primeiro viewport.                                                | Hipotese de excesso de area introdutoria para uso operacional repetido; avaliar compactacao com corretor/gestor sem ocultar fonte/periodo.               | Tarefa principal localizavel e controles acessiveis em 375px, sem perda de contexto.   |

Os bloqueios de dados acima foram observados na interface, nao diagnosticados
como bugs de servidor. O trabalho atual nao removeu bloqueios nem inventou fonte.

## Cobertura por dominio

| Area                                                          | Caminhos centrais                                   | Verificacao existente                                     | Recurso principal  |
| ------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| Login, cadastro, recuperacao, MFA, conta                      | app/(auth), app/(account), lib/auth                 | schemas, sessao, callback, MFA, legal, pgTAP              | crm-seguranca      |
| Privacidade e documentos legais                               | app/(legal), lib/legal, lib/privacy                 | consentimento/cadastro e documentos versionados           | crm-interface      |
| Administracao e acessos                                       | app/(protected)/admin, lib/authorization            | gates, matriz de papeis e grants/RLS                      | crm-seguranca      |
| Dashboard e etapas                                            | lib/crm/dashboard, stages, source-availability      | contratos, fontes ausentes, E2E e visual                  | crm-dados          |
| Ranking e parcerias                                           | lib/crm/ranking e read models                       | pontuacao, conciliacao, RBAC e pgTAP                      | crm-dados          |
| Read-model-v3                                                 | lib/crm/read-model-v3                               | contrato, filtro, config e SQL                            | crm-dados          |
| Metas e pontos                                                | lib/crm/goals, points                               | politica, fuso/data, autorizacao e pgTAP                  | crm-dados          |
| Associativo, Direta, Investidor, Tabelao, CAIXA, documentacao | lib/archive-investor, simulators, commercial-engine | golden, datas, limites, fonte oficial, matriz visual      | crm-simuladores    |
| Estoque                                                       | app/api/inventory, load-inventory                   | autorizacao/cache, concorrencia, loading, facetas         | crm-performance    |
| Ingestao e operacao                                           | app/api/ingest, ops, scripts/release                | idempotencia, contratos Qlik/Salesforce, restore e imagem | crm-dados e crm-qa |

O manifesto agrupa ranking/parcerias com dashboard e estoque separado; a tabela
acima detalha responsabilidades, nao adiciona um decimo dominio ao manifesto.
Rotas dinamicas dependem dos catalogos de simuladores/etapas e testes especificos.

## Ferramentas: usar quando e por que

- Obsidian local + Git: memoria tecnica entre chats, com fontes e versoes. Ja configurado.
- Skills proprias + AGENTS: selecao automatica por dominio; nao exigem conta externa.
- Agentes especializados: decomposicao e revisao independente quando a demanda justificar.
- Playwright + axe: navegacao, estados, acessibilidade e responsividade; ja sao dependencias.
- Vitest + pgTAP: comportamento, contratos e isolamento de dados; ja integrados aos gates.
- GitHub/gh: PR, revisao e CI vinculada ao SHA; plugin instalado, permissoes por operacao.
- Supabase: SQL, Auth, RPC e RLS; plugin instalado, confirmar projeto/ambiente antes do acesso.
- Figma: referencia visual e componentes quando existir design relevante; plugin instalado.
- Datadog: logs/traces/RUM se houver projeto e coleta do CRM; instalado, coleta nao comprovada.
- PostHog: funis e uso agregado se houver autenticacao/coleta; instalado, login pendente na verificacao anterior.
- OpenAI Developers: documentacao atual de skills/agentes; instalado e documentacao consultada.
- Codex Security: analise adicional opcional; sugerido, instalacao/conexao nao confirmada.
- Gitleaks/OSV: scripts existentes para segredos/dependencias; executaveis e execucao nao comprovados nesta etapa.
- pnpm audit: gate existente de dependencias; nao substituir por quantidade de plugins.
- MCP n8n: unico caminho permitido para editar workflow existente; falta/falha e bloqueio dessa operacao.
- Linear: backlog quando solicitado; nao necessario para editar/testar. Nao criar tickets automaticamente.
- Canva/Adobe/Drive/Notion: materiais de campanha ou documentos quando a demanda pedir, nao dependencias do CRM.

Nao adicionar outro framework frontend, plataforma de hospedagem, banco,
rastreamento de sessao ou gerenciador de testes por padrao. Instalar tudo nao
garante precisao e aumenta manutencao, superficie de acesso e ruido de contexto.

## Precisao e automacao

Diagnostico local `codex doctor` (28/09, CLI 0.157.1): configuracao carregada,
instalacao consistente e nenhuma falha fatal, com avisos opcionais. A sondagem
do MCP n8n sofreu timeout; nao permite certificar conexao utilizavel nem inferir
queda permanente. Revalidar pelo MCP antes de tarefas n8n, sem fallback REST.
O CLI isolado tambem nao recebeu CODEX_WINDOWS_REGISTERED_CORE; nao inventar
essa variavel nem alterar o ambiente global, pois o navegador no app funcionou.
Avisos genericos de Defender/Dev Drive nao justificam excluir antivirus, mover
repositorios ou apagar historicos. Nenhuma dessas alteracoes foi realizada.

O ciclo e: recuperar conhecimento pertinente, confirmar estado atual, localizar
o dominio, escolher skills/agentes, implementar no escopo, validar com evidencias,
registrar aprendizado e sincronizar. Autonomia nao substitui politica aprovada.

Ja existem na CI lint, tipos, testes, audit, build, replay de migrations, pgTAP,
advisors de seguranca/desempenho, browser E2E, matriz visual e restore isolado.
O novo teste de recursos entra nesse fluxo sem criar outra plataforma de CI.
Os agentes nao tem poder para ignorar um gate ou corrigir um teste apagando-o.

Sete arquivos TOML seguem a documentacao oficial; nao forcam modelo, esforco,
SDK, conta, producao ou permissao global. Perfis de revisao pedem somente leitura;
a sandbox efetiva tambem depende dos overrides da sessao do cliente.
Descoberta de novos perfis/skills exige uma sessao que carregue os arquivos e,
quando aplicavel, confianca configurada pelo usuario. Nao ha injecao retroativa.

## Validacao desta etapa

- 26 testes especificos aprovados: 22 de conhecimento e quatro de recursos.
- Lint, typecheck, build (41 entradas incluindo not-found) e formatacao passam.
- Suite geral Windows: 744 testes passam, seis falhas POSIX preexistentes,
  um skip; oito testes Node Salesforce passam separadamente. CI Linux e o gate.
- TOML analisado por parser e quatro skills pelo validador oficial local.
- Revisao independente encontrou quatro riscos na busca; corrigidos com
  regressao para isolamento, fallback, geracao e limite de titulos.
- Backup/restauracao do vault: 100 arquivos, hashes equivalentes; runtime
  compartilhado atualizado nos tres worktrees sem mudar suas branches.
- Busca executada a partir de checkout antigo e nota lida pelo CLI do Obsidian.

`pnpm audit --audit-level high` saiu com sucesso, mas apontou dois moderados no
mesmo [advisory de Vitest e @vitest/mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).
A versao instalada era 4.1.10; correcao 4.1.11 ja esta proposta no
[PR Dependabot #65](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/65).
Prioridade: revisar e validar esse PR separado. O advisory trata servidor de
desenvolvimento; esta auditoria nao demonstrou explorabilidade em producao.
Nao expor servidor de testes na rede como alternativa aos gates de CI.

Resultados finais, comandos e pendencias sao registrados em
docs/knowledge/ATUALIZACOES.md e WORKLOG.md. Inventario nao e prova de que todos
os plugins estao conectados nem de que o site foi certificado integralmente.
Nao foi instalado SDK de telemetria nem enviado conhecimento a servicos externos.

## Fontes externas

- [Agentes customizados e limites](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- [Instrucoes por projeto](https://developers.openai.com/codex/guides/agents-md).
- [Heuristicas tecnicas de interface](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
