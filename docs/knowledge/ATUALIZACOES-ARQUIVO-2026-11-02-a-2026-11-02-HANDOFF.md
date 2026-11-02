# Handoff integrado — 02/11/2026

Registro canônico desta execução. Fonte: handoff solicitado pelo usuário em
02/11/2026, base auditada `d4bb4d91b8a553ae2edf0eaeb876d21e2b59b361`.
Meta Ads está integralmente fora do escopo; contratos compartilhados existentes
continuam obrigatórios. Não há autorização para inventar políticas comerciais.

## Identidade e preparação

- Git comum confirmado: `Documents/ChatGPT/DESCOMPLICA-CRM/.git`.
- Checkout inicialmente limpo, HEAD e origin/main em `d4bb4d91` após fetch.
- Branch: `codex/handoff-desempenho-integrado`.
- Health público em 02/11/2026, 09:04 -03: HTTP 200, status ok,
  version `0dab1578063eece6b9b5c86fa184c722388578fb`.
- Conector GitHub confirmou repositório e main. Consulta de runs do merge
  limitada a eventos PR retornou vazia; não valida CI do main.
- Node global 25.7.0 não é o runtime exigido. Comandos de validação usam
  Node 24.19.0 instalado e pnpm 11.20.0; lockfile preservado.
- Next/Chrome MCP declarados, mas seus métodos não estão expostos neste chat.
  Dependências ausentes no início; instalação frozen iniciada.
- Knowledge context e busca temática executados. Sync confirmou este worktree
  (`synced`, seis documentos), mas o processo encerrou com código 1 por documento
  acima do limite de exportação. Sincronização global não declarada concluída.

## Matriz e fronteiras

| Frente   | Responsável                                   | Arquivos e dependências                                      | Verificação                                            | Estado                                                                            |
| -------- | --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| A        | Implementador CI; integração pelo coordenador | scripts/ci, escopo visual QA, workflows, release policy, E2E | Contrato executor/agregador e negações; CI ampla final | Implementado; cadência E2E preservada até prova de capacidade                     |
| B        | Coordenador                                   | Instrumentação agregada e medição sintética local            | Privacidade, falhas, identidade e fases                | Implementado em etapas; RUM sem destino/consentimento aprovado                    |
| C1/C2    | Dados                                         | stages/data, novas migrations e testes                       | Snapshot, histórico H=0/H=11, pgTAP                    | C2 implementado com rollout desabilitado; C1 sem ambiente SQL isolado             |
| C3/H     | Coordenador                                   | Dashboard Agendamentos e página de etapas                    | Volume, gráficos, teclado e estados                    | Perfil SSR e metas zero corrigidos; paginação depende contrato SQL completo       |
| D        | Implementador Leads                           | lead-plus cliente/servidor e testes                          | Escopos, SQL e fixtures                                | Divisão cliente, escopo e agregados implementados; paginação operacional pendente |
| E        | Implementador simuladores                     | Recursos e títulos por variante                              | Compilação e fórmulas existentes                       | Manual diferido e título corrigido; fórmulas/CSS preservados                      |
| F        | Coordenador                                   | Repasse                                                      | Pedido posterior do usuário                            | Retirado pelo usuário; nenhum diff funcional ou instrumentação                    |
| G        | Dados e coordenador UI                        | Fonte de metas, snapshot/exportador, etapa                   | Vigência, ausência/zero, escopos                       | Fonte inválida e zero corrigidos; integração comercial sem autoridade suficiente  |
| Advisors | Coordenador/dados                             | Somente consultas afetadas                                   | Evidência de plano antes de índice                     | Nenhum índice autorizado por estatística histórica isolada                        |

## Critérios de evidência

Medições de laboratório usam fixtures sintéticas e identificam revisão, inputs,
volume, cache e método. Duração de automação, fonte CSS e estatísticas históricas
não serão apresentadas como tempo de página, bytes transferidos ou percentis.
Gates completos serão executados uma vez para o candidato coordenado, salvo
invalidação concreta. Migrations remotas e dados operacionais não serão alterados
sem a autorização específica exigida pelo projeto.

## Checkpoints

1. Preparação e baseline dirigidos, sem reauditoria geral.
2. Implementações independentes e testes focados.
3. Integração do diff completo, revisão independente do contrato CI e gates.
4. PR/CI/main e publicação protegida quando todos os gates permitirem.
5. Verificação final, documentação e sync; sem release de runtime para registrar
   a própria publicação.

## Implementação e limites por frente

### A — contrato da entrega

Classificador, executor e agregador usam plano comum com dependências e motivos.
Os resultados distinguem `passed`, `failed` e `not_applicable`; ausência obrigatória
reprova. O runner local também encaminha o plano e as rotas. Componentes exclusivos
de Agendamentos selecionam uma rota; canvas compartilhado, CI, migrations e
desconhecidos exigem cobertura completa. O pacote atual exige a matriz completa.

Geração de referências tornou-se dispatch intencional por SHA completo. Não há
promoção automática de baseline. Faixa documental conservadora chega ao main,
mas esse SHA não gera imagem e continua recusado pelo publicador. Gates ignorados
não aprovam aplicação. Verificação de fontes considera o intervalo inteiro.
Caches de dependências/Chromium usam SO, runtime e lockfile. O pin de actions/cache
foi conferido com `git ls-remote` no repositório oficial. Builds não foram
compartilhados sem equivalência de configuração. Main deixa de cancelar seu
candidato em validação; nenhuma execução alheia foi cancelada.

Todas as combinações de autorização, pausa e retry permanecem. Há medição
sanitizada por perfil, separando requisição de espera. Docker/DB isolado ausentes
impedem comprovar capacidade para reduzir a cadência; nenhuma economia foi alegada.

### B/H — fases e perfil inicial

`CRM_PERFORMANCE_LOGS=true` habilita somente logs agregados no destino existente:
rota, fase, duração, resultado, revisão sanitizada e correlação aleatória. Não
recebe filtros, payloads, erro privado ou IDs do CRM. Default desligado, sem
serviço novo. Etapas medem autorização/loader; Agendamentos separa snapshot,
análise, roster e metas. Não se infere fila/conexão separada sem evidência do driver.
Sem destino e consentimento aprovados para coleta contínua, não se criou RUM.

O perfil inicial de House é lido pela RPC canônica após o guard, em paralelo ao
loader. A primeira renderização recebe o layout autorizado para page/scope exatos.
Falha mantém recuperação/cache existentes. Ao sair do escopo inicial, o snapshot
SSR é consumido; voltar relê a versão atual. Revisão independente encontrou e
reproduziu esse risco antes da correção. Prova Chromium posterior confirmou GET
de Parcerias e House e PATCH com `version: 2`, sem erros.

Títulos das etapas são específicos. Meta zero configurada fica visível, com gap
matemático; percentual segue indisponível por denominador zero. Fonte ausente
não vira zero. Os gráficos já possuem referências, rótulos, filtros e separação
de leitura/edição das entregas recentes; não houve reescrita visual opcional.

### C — leitura histórica e detalhe

Análise e roster compartilham contexto validado e iniciam em paralelo. A checagem
final do snapshot ocorre depois das metas. RPC aditiva
`read_crm_appointments_goals_range(date,date)` reutiliza leitores canônicos, com
`security invoker`, grants mínimos e limite do contrato. Migration nova
`20261102120809_appointments_goal_range.sql`; treze assertions pgTAP preparadas.
Manifesto: 99 migrations; restore: 45 arquivos/2373 assertions.

`CRM_APPOINTMENTS_GOALS_RANGE_ENABLED=false` é o default: mantém orçamento legado
sem probe adicional. Só habilitar depois da aplicação autorizada e pgTAP aprovados.
RPC ausente permite fallback; permissão negada e intervalo parcial falham fechado.
Reverter a flag retorna ao caminho legado; remover apenas a função aditiva, após
desativar a flag, é o rollback de banco. Nenhuma migration remota foi aplicada.

C1 e C3 exigem ambiente SQL isolado representativo. DB local recusou conexão em
127.0.0.1:54322; Docker/psql não disponíveis e Supabase `list_branches` retornou
lista vazia. Não se criou ambiente pago nem fez EXPLAIN ANALYZE em produção.
Não há RPC de resumo equivalente sem operações: até 20 mil registros alimentam
vínculos regionais, ranking, produtividade, recência anterior ao período e filtros.
Paginar o array atual alteraria KPIs. A preparação necessária é uma RPC de resumo
completo e uma de detalhe/exportação com filtro e versão de snapshot iguais,
cursor por createdAt/ordinal estável, schema próprio e pgTAP de equivalência,
mascaramento sem ranking e concorrência. Essa substituição não foi ativada sem
essa prova. Não se declarou redução de SQL ou payload inexistente.

### D/E — Leads e simuladores

Leads carrega famílias sob demanda. O servidor aplica owners autorizados em SQL
parametrizado, agrega dashboard sem objetos de contato completos, seleciona campos
analíticos usados, mantém primeiro contato de todo histórico e reutiliza lookups
somente na requisição. Lista preserva união com Bolsão autorizado e ordenação.
Não altera pool, região, índice, sessão, revogação nem Shadow DOM.

O projeto operacional `xwtasgjnkctyxokxjykk` não aparece no conector. Os projetos
descobertos incluem CRM `hnncxuerlcsaahdxoswb`, que não o substitui. Cursor/filtros
completos na consulta operacional e analytics integral em SQL não foram ativados:
faltam schema/EXPLAIN/equivalência/rollout no banco correto. As mudanças preparadas
usam os contratos SQL existentes e fixtures; não são validação operacional remota.

Manual dos simuladores foi extraído sem alterar conteúdo ou fórmulas e carrega
ao abrir, com deep link, recuperação de erro, Escape/Enter e foco. Investidor tem
título específico. CSS não foi dividido por contagem de linhas: apenas 1191 bytes
de duplicatas exatas foram encontrados, sem prova para remoção segura da cascata.
Tabelão/fonte/exclusão de inválidos e regras financeiras permanecem nos contratos.

### G e advisors — autoridade preservada

O builder deixa de habilitar metas quando a fonte é parcial/inválida, mantendo
zero explicitamente configurado como válido. `crm_funnel_goals` é mensal por
perfil; faltam agregação por equipe/corretor/view, coortes históricas e distribuição
semana/dia das quatro etapas. `goals/planning.ts` identifica essa distribuição como
preview; `REMAINING_DECISIONS.md` registra competência/retroatividade/snapshot.
Não se promoveu preview a regra oficial.

Ranking House mantém `rankingPolicyAuthorityAvailable() === false`: faltam política,
pesos/desempate/agregação e governança aprovados. No CRM, RPC Qlik v2 e tabela de
publicações existem, mas EXISTS de publicação retornou false. Reader/rota já estão
ligados; faltam duas coletas conciliadas e publicação aprovada. Estados honestos
preservados. Nenhum índice foi criado/removido com base em advisors históricos.

## Comparação antes/depois

| Medida e método                                   |      Antes |               Depois | Limite                                                       |
| ------------------------------------------------- | ---------: | -------------------: | ------------------------------------------------------------ |
| Loader Agendamentos H=0, mocks com roster íntegro |  8 viagens |  8 default / 7 range | Range depende migration e flag                               |
| Loader Agendamentos H=11, mesmos contratos        | 30 viagens | 30 default / 7 range | Não mede latência SQL/página                                 |
| Leads, grafo JS inicial Vite/Rolldown produção    |   643460 B |             196945 B | Não são bytes servidos pelo Next                             |
| Leads, gzip do grafo inicial                      |   191890 B |              66850 B | JS total aumenta 1135580 para 1141540 B                      |
| Investidor, grafo JS inicial                      |   458649 B |             385721 B | JS total aumenta 458649 para 461993 B                        |
| Investidor, gzip inicial                          |   127231 B |             107382 B | Manual diferido; mesmas fórmulas                             |
| Canvas, requisições de perfil no navegador        |          1 |                    0 | Fixture local, read inicial movido ao servidor               |
| Canvas, CLS de laboratório                        |  0,0120988 |                    0 | Seis navegações por revisão, perfil sintético com API 200 ms |

Baseline compilada `d4bb4d91`; candidato medido por hashes do working tree, sem
atribuir evidência ao HEAD antigo. Método: Vite 8.2.4/Rolldown, configuração igual,
Windows/Node 24.19/Chromium local sem dados reais. Canvas: desktop 1440×900,
sem throttling, no-store, três pares abertura/repetição. LCP foi coletado, mas
a amostra e o fixture não sustentam conclusão de latência de produção. Não há
INP real, p75/p95 de usuários ou ganho temporal de CI/cache comprovado.

Scripts: `tests/lead-plus-simulator-bundles.mjs`,
`scripts/qa/appointments-profile-performance.mjs`,
`tests/investor-manual-loading.browser.mjs`,
`tests/appointments-profile-scope.browser.mjs`. JSONs e screenshots sintéticos
ficam em test-results; não são baselines aprovadas ou dados operacionais.

## Validações e revisão

- Instalação frozen e resources:doctor aprovados; Docker indisponível, não exigido
  no desktop. Node 24.19.0/pnpm 11.20.0 usados nos comandos.
- CI/plano/paridade: 55 testes focados aprovados; política de release Node 20/20.
- Dados: 25 aprovados/1 condicional privado ausente; transform Node 4/4.
- Leads/simuladores: 153 aprovados/3 condicionais privados ausentes; cobertura
  adicional de leitura/escopo 6/6; sete casos browser do manual aprovados.
- Coordenador: 31 testes focados de leitura/telemetria/etapas aprovados após
  integração; configuração do canvas e SSR também validados. Contagens se
  sobrepõem entre lotes e não devem ser somadas.
- QA independente revisou CI/release/RPC/logs, detectou manifesto e retorno de
  escopo, ambos corrigidos. Prova browser de edição com versão atual aprovada.
- SQL/restore/matriz autenticada/build completos ficam para CI Linux do candidato
  coordenado. Nenhum teste POSIX será adulterado por diferenças do Windows.

## Identidade de entrega e documentação

PR 467 aberto para o pacote coordenado. Run inicial 41447032115 parou somente
em Formatting do script appointments-profile-performance, antes de lint/tipos/
testes/build/banco. Formatação e dois finais de linha SQL normalizados num único
ajuste; nenhum sucesso desse run é atribuído aos gates não executados.

Preparado no working tree; commits/PR/CI/publicação ainda serão preenchidos após
os gates. CI da base foi conferida via API pública: run 41380947066, push/main
`d4bb4d91`, success. Isso não valida o código novo.

Checkpoint local de Leads/simuladores: `994c104d869a312d94836005aef4b69115e757c1`.
Nenhum push foi feito entre checkpoints, evitando CI/publicação por item. O
checkpoint de integração inclui CI, dados/metas, perfil inicial e instrumentação.
Lint focado final não tem erros; quatro avisos preexistentes de variáveis não
usadas no backend Leads foram preservados. Dois erros do React Compiler nas
dependências dos callbacks do canvas foram corrigidos no próprio escopo.
O manifesto/restore foi reconciliado, incluindo a segunda asserção de contagem;
26 testes release-candidate passaram. Typecheck local passou. Formatação e
whitespace conferidos; provas de perfil executadas novamente para os hashes
finais dos componentes.

SSH observacional confirmou acesso ao host e ledger: produção `0dab1578`,
deployment `694c8f77-0aa7-4e64-92c4-1a7aeed3117d`, publicação real
2026-11-02T02:50:35.132Z, sem pendência. Não é a consulta final de DEPLOY-001.
Nenhuma troca de runtime foi feita. O checkout administrativo do host tem outro
SHA e será preservado; promoção exige checkout/artefato próprios do candidato.

A nota inicial ultrapassou o limite de 256000 bytes do índice. Uma seção histórica
foi movida integralmente para o arquivo existente de Agendamentos, com referência,
sem compressão ou remoção de conteúdo. Sync posterior aprovou sete documentos.
