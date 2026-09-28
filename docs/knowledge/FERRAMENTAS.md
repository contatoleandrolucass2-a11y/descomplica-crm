# Selecao automatica de ferramentas

status: validado
atualizado_em: 2026-09-27
verificado_em: 2026-09-27
fonte: inventario local de skills e plugins; AGENTS.md

Estas regras valem para qualquer chat deste projeto. O usuario nao precisa
repetir o nome das ferramentas. Selecionar as pertinentes ao trabalho, ler o
SKILL.md correspondente e executar verificacoes proporcionais ao risco.
Nao acionar todas em toda mensagem nem consumir servicos sem necessidade.

## Roteamento

| Situacao                                    | Ferramenta ou skill                         | Motivo                                                                                                    |
| ------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Inicio e fim de tarefa tecnica              | knowledge:context e knowledge:sync          | Consultar contexto e registrar atualizacoes locais no Obsidian.                                           |
| Lentidao, erro ou causa desconhecida        | investigate-first                           | Medir e localizar a causa antes de editar.                                                                |
| React, Next.js e desempenho                 | vercel-react-best-practices                 | Revisar consultas, estado, efeitos e renderizacao.                                                        |
| UX, fluxo ou interface confusa              | descomplica-ux-audit                        | Avaliar a jornada e a ergonomia do CRM.                                                                   |
| Layout e acessibilidade                     | web-design-guidelines                       | Conferir hierarquia, foco, legibilidade e responsividade.                                                 |
| Testes de interface                         | playwright ou computer-use                  | Validar o fluxo real e inspecionar desktop e celular. Respeitar as regras de controle do navegador ativo. |
| Correcao pontual                            | surgical-patch                              | Resolver no menor escopo responsavel.                                                                     |
| Nova funcionalidade                         | lean-build                                  | Entregar um fluxo completo sem complexidade desnecessaria.                                                |
| Refatoracao                                 | safe-refactor                               | Preservar comportamento e limites entre modulos.                                                          |
| Compatibilidade ou schema                   | migration                                   | Planejar transicao reversivel e validacao.                                                                |
| Banco, SQL, RPC ou RLS                      | Supabase e supabase-postgres-best-practices | Investigar desempenho e autorizacao no servidor/banco.                                                    |
| Design visual maior ou arquivo Figma        | Figma e sua skill especifica                | Reutilizar componentes e referencias de design.                                                           |
| Latencia ou erros com telemetria disponivel | Datadog                                     | Usar evidencias operacionais reais.                                                                       |
| Jornadas ou funis com coleta disponivel     | PostHog                                     | Analisar comportamento agregado do produto.                                                               |
| Codigo, PR e CI                             | GitHub ou gh                                | Versionar, revisar e verificar gates.                                                                     |
| Backlog solicitado                          | Linear                                      | Organizar trabalho; nao criar tickets sem necessidade ou autorizacao.                                     |
| Documentacao do Codex                       | openai-docs                                 | Consultar comportamento atual e oficial.                                                                  |
| Validacao final                             | verify-and-stop                             | Comprovar o resultado e encerrar sem ampliar o escopo.                                                    |
| Workflow existente no n8n                   | MCP n8n                                     | Aplicar o fluxo de validacao, alteracao e releitura exigido.                                              |

## Disponibilidade e limites

- Verificar a disponibilidade real em cada host e chat; instalacao nao implica
  conta conectada, permissao, projeto selecionado ou telemetria configurada.
- PostHog nao estava autenticado na verificacao de 27/09/2026. E opcional;
  ausencia dele nao impede otimizar ou testar o CRM.
- Em falta de conector, usar uma alternativa local verificavel quando existir.
  Nao instalar SDK de rastreamento, enviar dados ou abrir contas automaticamente.
- Nao alterar configuracoes de seguranca, confianca de hooks ou permissoes para
  forcar uma ferramenta. Comunicar bloqueios reais com precisao.
- As regras de autorizacao e seguranca de AGENTS.md permanecem prioritarias.
