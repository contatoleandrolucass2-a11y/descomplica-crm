# Análise do projeto após o handoff — 02/11/2026

## Escopo e abertura

Pedido posterior ao handoff: analisar o projeto, a persistência das instruções,
gráficos, plugins/skills e eficiência da entrega. Somente leitura de aplicação,
configurações e dados; sem novas implementações, instalações ou mudanças remotas.
Mantidas as exclusões funcionais de Meta Ads e Repasse. O registro curado é a
única escrita necessária a esta análise, com sincronização do conhecimento.

Git comum confirmado, checkout inicialmente limpo, HEAD/main remoto
`b93d3904de9c636bbf03db8e11504bdfe0b7dbce`. Fetch e GitHub confirmaram PR468
integrado. Em 02/11/2026, 16:34:56 -03, health público HTTP200/status ok,
versão `aa28d38e99ec5bf835e5fbde3da3520874c002ec`. A diferença integrada após a
publicação é documental. Evidências do handoff serão reutilizadas quando suas
dependências permanecerem iguais; não executar nova CI ampla por análise.

Fontes iniciais: AGENTS.md, task-efficiency.md, knowledge:context/search,
registro canônico do handoff, GitHub PR468 e /api/health. Conhecimento de outros
worktrees é referência com proveniência, não código integrado nem autorização.

## Estado final consultado e mudança externa

Durante a leitura, outro trabalho integrou o PR469, `2556898d911f3c5d5a806b70c0ec0c800a820bd2`.
CI main41511483505 ainda em andamento em 02/11/2026, 16:45:08 -03; health
200/ok continua em aa28d38e. Local b93, integrado255 e publicadoaa28 são estados
distintos. O delta foi lido por git show/diff, sem modificar a aplicação.

PR469 acrescenta rankings por PDV/empreendimento, vencidos, leitura de recência,
tooltips/dias e migration20261102175113. Essas adições invalidam a prova visual
anterior dos elementos novos; não se atribui CI41479050792 ao candidato255.
Arquivos de CI, skills, agentes, AGENTS e configuração examinados não mudaram
nesse delta. Achados Lead+ e dashboard/presentation permanecem independentes dele.

## Respostas diretas

| Pergunta                              | Conclusão                                                                                                                                                                                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vale para os próximos chats?          | Sim como orientação persistida deste Git comum/worktrees, desde que o chat leia as fontes vigentes. Não é treinamento do modelo, alteração global de outros projetos nem recarga garantida de sessões antigas. Código/pipeline/skills dependem da versão contida em cada branch. |
| Tarefas ficarão mais rápidas?         | Existem mecanismos concretos para reduzir trabalho desnecessário, especialmente documentação e mudanças localizadas reconhecidas. Não há garantia de duração ou percentual: CI, filas, escopo compartilhado, dados e mudanças posteriores continuam influenciando.               |
| A qualidade melhorou?                 | Os contratos de evidência, autorização, snapshot, exportação, CI e identidade de publicação ficaram mais explícitos e testados. Isso reduz riscos; não prova ausência de bugs em todas as telas.                                                                                 |
| Está sem redundância?                 | Não. O bloco de QAs especializados e builds ainda contém oportunidades. Também há repetição obrigatória por candidato/main, segurança ou invalidação concreta que não deve ser eliminada por aparência.                                                                          |
| Precisa instalar mais plugins/skills? | Nenhuma necessidade demonstrada de instalação. Prioridade é aplicar e alinhar os recursos existentes, com contratos de dados e gráficos consistentes.                                                                                                                            |

## Cobertura arquitetural

Inventário versionado: 11 áreas, 11 skills locais e sete perfis. Os 91 registros
em recursos.json são arquivos de entrada, incluindo APIs; não 91 páginas distintas.

| Área                                | Situação observada e limite                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação, conta e administração | Guards/catálogo, MFA e autoridade no banco são os pontos centrais. A amostra não encontrou fallback que libere página ausente/inativa; não é auditoria completa de vulnerabilidades.                                                        |
| Privacidade/documentos              | Superfície inventariada, sem alteração ou nova certificação jurídica.                                                                                                                                                                       |
| Dashboard, etapas, ranking e metas  | Maior diversidade de gráficos próprios e regras de cobertura. Persistem dependências comerciais e inconsistência condicional de zero no dashboard.                                                                                          |
| Leads                               | Banco operacional separado, projeto explícito; schema real PG17.11 e conexão já comprovados no handoff. Não repetir o antigo diagnóstico incorreto de acesso ausente. Há problema estrutural de atualização de recorte na camada analítica. |
| Read models e integrações           | Snapshot, RPCs e projeções versionadas são a fronteira de consistência. Controles de ingestão/fonte devem continuar independentes de apresentação. Não executar novas coletas para preencher estados pendentes.                             |
| Simuladores e estoque               | Regras oficiais e golden tests são a autoridade. A extração de manuais não autoriza recalcular fórmulas; tamanho de arquivo não prova gargalo.                                                                                              |
| Links úteis e navegação             | Canvas/organograma e catálogo centralizado são reaproveitáveis. Não representam outra biblioteca de gráficos quantitativos.                                                                                                                 |
| Operação e entrega                  | Artefato imutável, backup, restore, rollback, locks, CAS e consulta ao vivo preservados. Main documental não equivale à versão runtime.                                                                                                     |

Amostra aprofundada: dashboard geral, etapas/Agendamentos, operação e relatório
Lead+, rankings/parcerias, canvas compartilhado, navegação de simuladores,
contratos de autorização e pipeline. Meta Ads e Repasse fora da revisão funcional.
Nenhuma caminhada manual nova em todas as telas ou perfis foi realizada.

## Gráficos e experiência

Implementações atuais: SVG/CSS próprios em dashboard e etapas; Recharts3.10.1
no Lead+; tabelas e barras CSS; canvases próprios compartilhados; workspaces dos
simuladores. Tailwind4, CSS Modules e tokens globais atendem temas existentes.
Não há achado que justifique substituir a biblioteca ou comprar um template.

### Achados priorizados

Gravidade UX segue a skill local: 3 alto, 2 médio. Problemas estruturais foram
confirmados no código; ocorrência e frequência em produção não foram medidas.

| ID      | Prioridade/confiança                           | Evidência                                                                              | Impacto e critério de aceite                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX01    | 3, código; reprodução interativa não executada | lib/crm/lead-plus/client/api.ts:129–176; analytics.tsx:165; OperationDashboard.tsx:119 | useApi mantém dados e loading=false ao trocar consulta, enquanto controles já refletem o novo filtro. Sob atraso/falha, recorte anterior pode ser interpretado como atual. Aceite: teste A→B com resposta atrasada mantém carregamento ou identifica expressamente A; falha não rotula A como B.                  |
| DATA01  | 2, condicional                                 | lib/crm/dashboard/presentation.ts:122,158,182,190                                      | Meta0 válida com goalsAvailable=true vira ausência no dashboard. Agendamentos distingue zero. Não se afirmou ocorrência produtiva. Aceite: mesma fixture válida apresenta0 nas duas superfícies; percentual com denominador0 permanece indisponível.                                                              |
| A11Y01  | 2, código                                      | lib/crm/lead-plus/client/OperationDashboard.tsx:98                                     | Navegação por rolagem anuncia tablist/tab sem painéis/teclado completos. Aceite: navegação por âncoras adequada ou padrão de abas integral. SimulatorWorkspace.tsx:1003 oferece referência interna.                                                                                                               |
| A11Y02  | 2, código                                      | lib/crm/lead-plus/client/analytics.tsx:104                                             | InfoTip depende de title; falta abertura visual explícita por foco/toque. Aceite: explicação legível ao focar/acionar, Escape para dispensar, sem bloquear a ação.                                                                                                                                                |
| CI01    | Oportunidade confirmada; ganho não medido      | .github/workflows/ci.yml:193–235,299–311                                               | QAs especializados anteriores à matriz não seguem integralmente o plano focado. Aceite futuro: cada check declara dependências/motivo; não aplicável explícito; compartilhados/desconhecidos continuam amplos; jamais omitir check obrigatório.                                                                   |
| KNOW01  | Risco operacional confirmado                   | scripts/knowledge/obsidian.mjs:131–145,450                                             | context carrega/valida toda a coleção antes de filtrar históricos. Arquivo acima256000bytes pode bloquear até contexto inicial. Índice upstream consultado255052bytes. Aceite: particionar históricos íntegros e manter índice; eventual separação do loader não pode fingir sync válido nem dispensar validação. |
| SKILL01 | Pendência de roteamento/portabilidade          | FERRAMENTAS.md:94–158; skill UX global                                                 | Há aliases globais homônimos com contratos diferentes e referência a descomplica-design-system não localizada no catálogo/caminhos conferidos. Aceite: selecionar adaptações locais explicitamente e resolver referências no contrato do CRM, sem modificar plugins globais de outros projetos.                   |

Para corretor: prioridade é reconhecer a própria informação, pendências e próxima
ação no celular. Para imobiliária: comparar equipe com filtro/estado inequívocos.
Para gestor: reconciliar fonte, período, realizado/meta e gargalos. Não foram
atribuídas notas de usabilidade sem observação desses perfis.

Hipóteses, sem classificação de falha: textos de0.6–0.7rem, densidade de rankings
e séries no celular; compreensão do denominador de Conversão média; contraste
renderizado, zoom e conforto nos quatro viewports. Exigem observação com fixtures
compatíveis, não troca automática de paleta ou fórmula.

O contrato recomendado para os gráficos existentes deve explicitar pergunta,
unidade, período, fonte/atualização, filtro efetivamente aplicado, denominador,
zero/ausência/erro/carregamento, tabela alternativa e teclado/toque. Consolidar
isso nas skills/componentes atuais precede criar uma nova família de componentes.

## Eficiência da entrega

### Já persistido e comprovado

- documentation-scope.mjs:9 classifica diff inteiro de PR/push, com lista
  conservadora e fallback. PR468/main demonstraram validate aprovado e três jobs
  pesados explicitamente ignorados, sem imagem ou nova promoção.
- production-release-policy.mjs:179 exige main exato e quatro jobs de aplicação
  aprovados. Não se reaproveita um SHA documental como se fosse aplicação.
- visual-route-scope.mjs:91 compartilha plano de dependências entre executor e
  agregador; ausências obrigatórias falham. Testes cobrem adulteração/fallback,
  remoções/renomeações e execução seletiva.
- Baselines são intencionais por SHA; caches pnpm/Chromium presentes. Alteração
  exclusiva conhecida de Agendamentos pode selecionar uma rota; componentes
  compartilhados e desconhecidos continuam amplos.

### O que ainda limita a velocidade

- CI01 acima: escopo focado não governa todo o bloco especializado.
- Cadência E2E: 392 combinações ×1000ms =392000ms. Rodada registrada:59942ms de
  requisições, zero retries. Estabilidade serial não prova capacidade para bursts;
  reduzir exige experimento isolado com mesma cobertura, retries e tempos por fase.
- Builds em ci.yml:146,293,404: validação, QA e imagem. Compartilhar exige provar
  equivalência de configuração/proveniência; somar processamento paralelo não
  mede caminho crítico. Não declarar ganho antes de medir.
- Arquivos visuais ainda não mapeados, como OperationDashboard, selecionam full.
  ChartBoard genérico seleciona cinco etapas; analytics/Charts e dashboard-canvas
  compartilhados selecionam full. Mudar um gráfico não garante CI curta.
- O handoff teve correções e seleção posterior do SQL que exigiram novos SHAs.
  Consolidar o candidato, conferir formatação/inventário e obter a decisão de
  benchmark antes do congelamento evita parte desse retrabalho. Revalidar um SHA
  alterado e a main exata é requisito atual, não resultado descartável.
- Integrações concorrentes precisam de sequência: main avançar por documentação
  enquanto um candidato de aplicação aguarda promoção pode bloquear o CAS. Não
  cancelar outra entrega nem contornar o guard para acelerar esta análise.

Tempos do último par aprovado do handoff: PR60m14s/main45m23s; histórico #463
PR58m54s/main51m14s. Pacotes/runners distintos impedem atribuição causal; esses
tempos não incluem toda a edição, rodadas anteriores ou consumo do modelo.

## Skills, plugins e persistência

AGENTS global8240bytes + repo16306bytes somam24546bytes; não foi encontrada
sobreposição por AGENTS.override global, nem override de project_doc_max_bytes
na chave global consultada. Não demonstrado truncamento pelo limite padrão32KiB
nesta cadeia. Isso não garante leitura retroativa nem cobre toda outra sessão.

A documentação oficial confirma descoberta hierárquica de AGENTS no início da
execução e divulgação progressiva de skills. Instruções versionadas e sync
facilitam reutilização; não treinam o modelo nem instalam configurações globais.

Fontes oficiais lidas:

- https://learn.chatgpt.com/docs/agent-configuration/agents-md#how-codex-discovers-guidance
- https://learn.chatgpt.com/docs/customization/overview#skills

| Recurso                          | Uso proporcional                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11 skills e sete perfis CRM      | Já suficientes para interface, dados, simuladores, QA e revisão. Revisores crm-performance/crm-simuladores são somente leitura; implementar com perfil de escrita apropriado evita reencaminhamento.                                                                 |
| Interface + UX audit + validação | Conjunto prioritário para gráficos. Usar fontes e componentes atuais; workflow UX global não é automaticamente portável a todo host.                                                                                                                                 |
| GitHub/Supabase                  | Código, CI e contratos de banco. Disponibilidade não autoriza dados de outros projetos ou migrations novas. Não houve nova leitura de clientes nesta análise.                                                                                                        |
| Chrome DevTools                  | list_pages respondeu com about:blank isolado; ferramenta funcional, não uma página do CRM já validada.                                                                                                                                                               |
| Next DevTools                    | nextjs_index respondeu, mas não encontrou servidor de desenvolvimento ativo. Não é evidência de plugin ausente; não iniciar/atualizar framework só para o diagnóstico.                                                                                               |
| Playwright/axe e QA do projeto   | Fixtures e fluxos existentes; reaproveitar prova compatível e reexecutar apenas o impacto real.                                                                                                                                                                      |
| Figma                            | Condicional a referência/design ou redesenho concreto. Nenhuma necessidade de instalar/conectar identificada.                                                                                                                                                        |
| PostHog/Datadog                  | Capacidades disponíveis no ambiente não equivalem a coleta instalada no CRM. Não foi encontrada instrumentação contínua de Web Vitals nas fontes app/lib consultadas; há observação de laboratório. Destino/consentimento precisam estar aprovados antes de coletar. |

Não foi instalado, removido ou alterado plugin, skill, modelo, permissão ou conta.
Não se mede economia de tokens pelo tamanho de texto ou tempo esperando GitHub.

## Pendências oficiais e sequência recomendada

1. Corrigir confiabilidade do recorte Lead+ e tratamento consistente de zero,
   com respostas adiadas/erros e fixtures reconciliadas.
2. Completar teclado/toque/explicações, aproveitando componentes internos.
3. Padronizar os contratos gráficos por tarefa/persona antes de redesenhar páginas.
4. Em demanda própria de CI, estender dependências aos QAs especializados e medir
   fila/setup/build/testes. Capacidade E2E e reúso de build requerem prova separada.
5. Manter conhecimento íntegro/particionado e roteamento local das skills. Criar
   skill nova só se um fluxo recorrente não estiver coberto pelas existentes.

Metas: faltam agregação/vigência/coortes/distribuição oficiais. Ranking: política,
pesos/desempate/governança. Parcerias: coletas conciliadas e publicação aprovada.
Não inventar esses contratos. Range está aplicado, mas false por autorização
recebida; seus ganhos de consolidação não estão ativos em produção.

## Validação e limites desta análise

Executadas leituras git/rg, arquivos segmentados, inventário, metadata GitHub,
health público e duas chamadas diagnósticas locais de MCP. Revisão independente
em três frentes, com escopos disjuntos e sem escrita dos agentes. Reutilizada a
CI do handoff apenas no runtime/contratos não invalidados; CI469 é outra evidência.

Não executados: nova CI de aplicação, suíte ampla, benchmark, trace, auditoria
completa de segurança, operação de n8n, migração, coleta externa, dados/clientes
privados ou testes de gravação. Não há aprovação visual nova, nota global de UX,
promessa de prazo, redução percentual de custos ou garantia de ausência de bugs.

Registro documental preparado em branch separada e reaplicado sobre255, preservando
as adições do outro trabalho. Diff restrito a quatro Markdown; sync de nove
documentos conferido. Índice final255329bytes, abaixo do limite256000. A integração
não deve avançar main antes de terminar a promoção concorrente de255. Se essa
entrega permanecer pendente, deixar o PR documental preparado e informar causa,
evidência, limite e critério de revisão: integrar após publicação comprovada do
candidato concorrente ou coordenação explícita do publicador. Não é nova política
nem autorização para ignorar locks/CAS. Nenhum deploy decorre desta análise.
