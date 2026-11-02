# Handoff integrado — 02/11/2026

Registro canônico desta execução. Fonte: handoff solicitado pelo usuário em
02/11/2026, base auditada `d4bb4d91b8a553ae2edf0eaeb876d21e2b59b361`.
Meta Ads está integralmente fora do escopo; contratos compartilhados existentes
continuam obrigatórios. Não há autorização para inventar políticas comerciais.

## Estado integrado

PR [467](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/467)
integrado em `aa28d38e99ec5bf835e5fbde3da3520874c002ec`. Candidato de origem
`46fc3735a499d389531e50528ed80fbdf2d53d56`. Os quatro jobs da CI
[41469001307](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41469001307)
passaram; duração total 60m14s. A CI push/main
[41479050792](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41479050792)
aprovou os quatro jobs no SHA exato; duração 45m23s. Lint, tipos, build e 4850
testes Vitest passaram; 112 condicionais permaneceram não executados. Restore
validou 100 migrations e 2391 asserções pgTAP na origem e no banco restaurado,
com owners, privilégios e fingerprints preservados. Não se atribui CI de PR a main.

Publicação confirmada em 02/11/2026, 17:03:30.921Z / 14:03:30.921 -03:
`aa28d38e99ec5bf835e5fbde3da3520874c002ec`, deployment
`fd394210-9300-46be-aab9-b71ba59906d2`, sem pendência. Exclusivamente pelo
`pnpm release:production`, com consulta ao vivo, travas e CAS. Checkout isolado
`/srv/descomplica-crm-releases/handoff-aa28d38e`, Node24.19.0/pnpm11.20.0;
checkout administrativo preservado. Nenhum build ou suíte ampla executados na VPS.

Artefato da CI41479050792: SHA256 comprimido
`b8c0275afa4a9be537bf632255eee874da3905fd6bdcdf5411f231b4f8d5f8df`.
Config digest da CI `sha256:f9ab54c8cc131ff3e91c056c1f5a57376ad82c30bbbe55fb19c64352f4e96bfa`;
manifest digest local e imagem ativa
`sha256:aa7a104ee4f76bbb75db8d80219e98a49027df42cc6e3ffc0d1019c27049a004`.
Diferença de armazenamento comprovada sobre o mesmo arquivo: index/manifest/config,
30 blobs, 14 camadas, hashes, tamanhos, linux/amd64 e RootFS legado/OCI iguais.
`image:prove` validou dois perfis sobre a mesma imagem, sem rebuild nem retag.
Prova sanitizada em `/srv/descomplica-crm-release-artifacts/handoff-aa28d38e/image-identity-proof.json`.

Smoke pós-publicação: health público 200/ok no SHA exato; Agendamentos, Leads,
quatro etapas e Investidor negam anônimo com 307 para login. O primeiro verificador
usou caminho inexistente do simulador e recebeu 404; corrigido somente o caminho
para o catálogo `/app/simulacao/tabela-investidor`, confirmado 307. Não houve
correção de runtime nem baseline para esse erro do verificador. Nova RPC retorna
401/42501 a anônimo. Processo ativo mantém range=false; conexão operacional de
Leads no projeto aprovado passou em SELECT 1, sem ler registros de clientes.
Fluxos positivos autenticados foram validados com fixtures na CI; dados privados
de produção não foram exportados.

O usuário autorizou expressamente as duas migrations em 02/11/2026, mantendo a
flag de intervalo desligada. Aplicadas somente `20261102120809` e `20261102131119`
no CRM `hnncxuerlcsaahdxoswb`, PostgreSQL17.6, após a CI main completa. Ambas foram
relidas e seus corpos SHA256 conferidos com os arquivos aprovados. Projeção:
security invoker, owner postgres, ACL somente postgres. Range: security invoker,
stable, search_path vazio e execução somente postgres/authenticated; anon e
service_role não recebem execução. Os 82 registros anteriores permaneceram
intactos; histórico final 84. API MCP gerou inicialmente versões 20261102165943 e
20261102170024; somente esses registros novos foram alinhados por CAS aos IDs
aprovados, exigindo nome, hash exato do SQL armazenado, corpo ativo e ausência do
ID de destino. Nenhuma outra migration foi aplicada ou reparada.

SHA256 dos arquivos: range
`110e88dfc3bedcf1f16c0c74ada39d98ea5d6591ade32a3fd20f803a1dbca57f`;
projeção `28e82dc966c4aca64a172c786eb4dbdde8842b4177e762083725df0ee9f07508`.
Corpos ativos: range `6feee2fd9f8b1c8d017531db5b722c52a56d3261765f72b15bb31cb42bbdb139`;
projeção `6ea9776079d45e906e40dc62acf7b1719f1b26d94bd0542fbfb46b70d6467d72`.
Conferência final SQL em 17:01:06.785911Z validou histórico e privilégios. Nenhum
registro comercial, policy, tabela ou índice de negócio foi alterado.

Backup anterior salvo privadamente na VPS em
`/etc/descomplica-crm/migration-backups/handoff-aa28d38e-20261102-preapply.json`,
SHA256 `018b68be09598b2981e21259b11427cee3491e3b32e79a704d50e039a5ff293b`.
Recuperação SQL: reverter projeção por nova migration com
somente a definição histórica; desativar o range antes de eventual remoção da RPC
aditiva. Nenhuma tabela de negócio é alterada por essas duas migrations. A flag
`CRM_APPOINTMENTS_GOALS_RANGE_ENABLED` permanece false, com caminho legado ativo.

Imagem anterior `sha256:455ec44d89d6c2094bb126a4c251cf07a4d5f66b4d0c8fcf9c78316608be1d42`
foi conservada e conferida antes da troca. Não houve recuperação pendente. Após
release concluída, reversão de aplicação exige PR, CI e nova promoção protegida;
`recover` fica restrito à tentativa pendente exata, conforme o runbook.

Fechamento documental em branch própria, somente Markdown, depois da publicação
funcional. Não promover o SHA documental como aplicação nem reiniciar runtime
para registrar a própria entrega. Resultado do PR documental e sync constam da
entrega coordenada; não iniciar ciclo recursivo para registrar seu próprio commit.

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

| Frente   | Responsável                                   | Arquivos e dependências                                      | Verificação                                            | Estado                                                                           |
| -------- | --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| A        | Implementador CI; integração pelo coordenador | scripts/ci, escopo visual QA, workflows, release policy, E2E | Contrato executor/agregador e negações; CI ampla final | Implementado; cadência E2E preservada até prova de capacidade                    |
| B        | Coordenador                                   | Instrumentação agregada e medição sintética local            | Privacidade, falhas, identidade e fases                | Implementado em etapas; RUM sem destino/consentimento aprovado                   |
| C1/C2    | Dados                                         | stages/data, novas migrations e testes                       | Snapshot, histórico H=0/H=11, pgTAP                    | C1 aplicado; C2 aplicado/validado, flag desligada conforme autorização           |
| C3/H     | Coordenador                                   | Dashboard Agendamentos e página de etapas                    | Volume, gráficos, teclado e estados                    | Implementado, validado na CI main e publicado                                    |
| D        | Implementador Leads                           | lead-plus cliente/servidor e testes                          | Escopos, SQL e fixtures                                | Cursor, filtros e analytics validados; contrato operacional conferido em leitura |
| E        | Implementador simuladores                     | Recursos e títulos por variante                              | Compilação e fórmulas existentes                       | Manual diferido e título corrigido; fórmulas/CSS preservados                     |
| F        | Coordenador                                   | Repasse                                                      | Pedido posterior do usuário                            | Retirado pelo usuário; nenhum diff funcional ou instrumentação                   |
| G        | Dados e coordenador UI                        | Fonte de metas, snapshot/exportador, etapa                   | Vigência, ausência/zero, escopos                       | Fonte inválida e zero corrigidos; integração comercial sem autoridade suficiente |
| Advisors | Coordenador/dados                             | Somente consultas afetadas                                   | Evidência de plano antes de índice                     | Nenhum índice autorizado por estatística histórica isolada                       |

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
Manifesto integrado: 100 migrations; restore: 46 arquivos/2391 assertions.

`CRM_APPOINTMENTS_GOALS_RANGE_ENABLED=false` é o default: mantém orçamento legado
sem probe adicional. Só habilitar depois da aplicação autorizada e pgTAP aprovados.
RPC ausente permite fallback; permissão negada e intervalo parcial falham fechado.
Reverter a flag retorna ao caminho legado; remover apenas a função aditiva, após
desativar a flag, é o rollback de banco. As duas migrations foram aplicadas após autorização, mantendo a flag desligada.

A ausência de Docker/psql no desktop e de branch Supabase remota isolada não
foi tratada como impedimento definitivo: a CI existente oferece PostgreSQL
isolado. Não se criou conta/ambiente pago nem fez EXPLAIN ANALYZE em produção.
C1 comparou projeção por conjuntos e retirada dos sorts intermediários, mantendo
ordenação final, somas, fallback e mascaramento. O benchmark da CI rejeitou ganho
consistente da alternativa por conjuntos; a menor mudança, retirada de sorts,
foi mais rápida nos quatro recortes e foi selecionada para o candidato final.
Dezoito assertions comparam o JSON inteiro com a função histórica. Rollback exige
nova migration restaurando somente a definição histórica, mantendo owner/grants,
sem reaplicar o arquivo antigo.

C3 não necessita inventar outra regra de resumo: o codec compacto preserva datas
exatas e campos analíticos em dicionários/tuplas, mantendo a engine canônica local.
Conta e horários operacionais ficam no servidor; o HTML inicial recebe somente
cinquenta detalhes reais. Filtros/KPIs/comparativo continuam locais; o loader não
é chamado a cada filtro. Server Actions revalidam página, view e fingerprint
canônico do modelo completo. Cursor vincula filtro e snapshot; saída de fonte
antiga bloqueia mistura. CSV exporta o recorte completo com proteção contra
fórmulas; tabela/PDF identificam a página visível.

Um controller limitado por instância do Dashboard conserva páginas e promessas
em voo durante drag/resize/cópia. Não é cache global nem guarda permissões. Hash
recursivamente canônico preserva arrays e ordena chaves de objetos, evitando
identidades diferentes pela conclusão assíncrona das RPCs de metas. A revisão
independente encontrou e confirmou a correção desses dois problemas. Browser
validou corridas entre filtros, CSV integral, snapshot alterado e zero RPC extra
por mudanças puramente visuais. Equivalência dos resumos completo/compacto inclui
histórico, máscaras, conversões, recência e comparativo de linhas.

### D/E — Leads e simuladores

Leads carrega famílias sob demanda. O servidor aplica owners autorizados em SQL
parametrizado, agrega dashboard sem objetos de contato completos, seleciona campos
analíticos usados, mantém primeiro contato de todo histórico e reutiliza lookups
somente na requisição. Lista preserva união com Bolsão autorizado e ordenação.
Não altera pool, região, índice, sessão, revogação nem Shadow DOM.

A lista `/leads?limit=50` usa cursor com microssegundos e desempate UUID,
busca literal, responsável, situação, categorias e contagens completas em uma
consulta/snapshot SQL. Cursor vincula ator, escopo e filtros. GET sem limit
continua retrocompatível, Kanban mantém leitura completa e exportação nunca
recebe o limit visual. Analytics restringe coortes atual/anterior e histórico
necessário, mantendo eventos anteriores e opções completas. Respostas antigas
não sobrepõem novo ator; erros de autorização apagam linhas anteriores.

O projeto operacional `xwtasgjnkctyxokxjykk` não aparece no conector; o CRM
`hnncxuerlcsaahdxoswb` não o substitui. Correção da evidência inicial: o primeiro
probe não comprovava o ambiente efetivo do Next. A leitura de `/proc` do processo
Next filho confirmou URL operacional e projeto aprovado, sem imprimir valores.
Pelo backend existente, em 02/11/2026, as três consultas novas (página, dashboard
e resumo analítico) passaram em PostgreSQL 17.11, transação `READ ONLY`, timeout
de 5 s e `EXPLAIN (FORMAT JSON)` sem ANALYZE. Zero registros de clientes foram
exportados; nada foi alterado no banco. Isso valida o contrato real do schema,
não mede latência nem substitui testes de escopo com fixtures.

Código e contratos independentes foram preparados e testados em fixtures. O
harness PostgreSQL isolado cria somente um c2s_app sintético inexistente, em
transação revertida, verifica 80 recortes e mede 5000 leads. Não é migration CRM
nem comprovação de aplicação operacional. Teste browser real cobriu 50→100→121,
contagens, filtros, refresh, UserViewSelector com resposta atrasada e revogação.

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

Resumo/detalhe C3, usando o helper canônico e cursor real de 222 bytes:
20 mil operações, JSON de 6664210 para 839980 bytes, cinquenta detalhes iniciais
e nenhuma operação completa inicial. Artefato local
`test-results/appointments-detail/payload.json` identifica hashes dos seis
arquivos, HEAD de base e working tree. Reprodução:
`APPOINTMENTS_DETAIL_EVIDENCE=1 pnpm exec vitest run tests/appointments-summary-detail.test.tsx -t 20000-record`.
Não são bytes transferidos pelo Next nem tempo de página.

| Medida e método                                   |      Antes |               Depois | Limite                                                       |
| ------------------------------------------------- | ---------: | -------------------: | ------------------------------------------------------------ |
| Loader Agendamentos H=0, mocks com roster íntegro |  8 viagens |  8 default / 7 range | Range depende migration e flag                               |
| Loader Agendamentos H=11, mesmos contratos        | 30 viagens | 30 default / 7 range | Não mede latência SQL/página                                 |
| Leads, grafo JS inicial Vite/Rolldown produção    |   643460 B |             196976 B | Não são bytes servidos pelo Next                             |
| Leads, gzip do grafo inicial                      |   191890 B |              66857 B | JS total aumenta 1135580 para 1143895 B                      |
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

Complemento por wrapper real, com os mesmos parâmetros de compilação e sem
execução remota: `node test-results/handoff-simulator-variants.mjs`, derivado
do script versionado com as quatro entradas abaixo. Relatório local
`test-results/handoff-simulator-variants.json`. O total inclui CSS comum e da
variante e não equivale à transferência/segmentação do Next.

| Wrapper      | JS inicial antes/depois | Gzip JS inicial antes/depois | CSS compilado antes/depois |
| ------------ | ----------------------- | ---------------------------- | -------------------------- |
| Associativo  | 458430 / 385495 B       | 127216 / 107359 B            | 1209837 / 1209904 B        |
| Direta       | 458135 / 385199 B       | 127122 / 107266 B            | 1209837 / 1209904 B        |
| Investidor   | 458117 / 385181 B       | 127112 / 107254 B            | 1209837 / 1209904 B        |
| Documentação | 119237 / 119237 B       | 36091 / 36091 B              | 1208629 / 1208629 B        |

O CSS não reduziu: há 67 bytes adicionais de saída de bundling nas três
calculadoras; Documentação não mudou. As linhas desta tabela usam wrappers,
enquanto a comparação anterior usa diretamente InvestorCalculator. Não misturar
essas duas entradas nem alegar uma redução de CSS, TTFB, INP ou p75.

## Validações e revisão

- Incrementos finais: 43 testes C3 e 28 testes D2 aprovados; tipos e lint focados
  aprovados. Browser C3 confirmou paginação, CSV integral, corridas, fonte alterada
  e zero RPC extra em drag/resize/cópia. Browser D2 confirmou 50→100→121, contagens,
  filtros, refresh, troca de ator com resposta atrasada e revogação.
- Revisão independente confirmou baseline SQL idêntico ao histórico, hash
  d5c3200493ce815f3ae8218562733f1323dee4c4aa31ca10c142ca803858d463.
- Dois riscos C3 corrigidos antes do push: cache por instância para remount e
  fingerprint determinístico apesar da ordem assíncrona das metas. Fonte fora
  de cobertura não vira exportação zero nem erro SSR. Não foram alteradas fórmulas.
- Classificadores SQL reaproveitam o diff inteiro já lido. Os 37 testes focados
  passaram, incluindo desconhecidos, erros de identidade/histórico e ausência
  de repetição dos harnesses SQL em mudanças conhecidas de shell/CSS sem relação.

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
- SQL/restore/matriz autenticada/build completos passaram na CI Linux do main
  coordenado. Não se adulteraram testes POSIX por diferenças do Windows.

## Identidade de entrega e documentação

### Checkpoint SQL medido

CI final do main AA28 / 41479050792, PostgreSQL17.6: medianas aquecidas pareadas
baseline→candidato, ms: 5000 fatos/ranking 102,335→85,594; 5000/mascarado
104,884→95,253; 20000/ranking 435,622→406,103; 20000/mascarado
431,289→422,560. JSON integral equivalente em todos os recortes; candidato menor
nos quatro. Primeiras execuções 97,080→84,789; 107,702→90,302; 510,724→463,953;
441,569→467,412: não há ganho universal em chamada inicial.

Leads/main: 80 recortes, 5000 registros, 5→1 consultas, 2936263→31317 bytes e
5000→50 linhas iniciais. Primeira execução 98,740→26,502 ms; repetições
92,847/93,733→22,443/22,808 ms. São fixtures isoladas; não latência operacional.
Histórico de CI #463: PR58m54s/main51m14s. Atual: PR60m14s/main45m23s; pacotes e
runners diferentes impedem atribuir a diferença a uma otimização específica.
Rodadas de correção anteriores não entram nesses tempos do par final aprovado.

Rodada final do PR em `46fc3735` / CI41469001307 confirmou a seleção instalada,
JSON integral equivalente e mediana menor nos quatro recortes. Medianas pareadas
baseline→candidato, ms: 5000 fatos/ranking 172,060→153,888; 5000/mascarado
184,658→168,963; 20000/ranking 729,932→666,845; 20000/mascarado
769,598→700,277. Primeiras execuções: 175,093→150,204; 169,164→156,028;
754,658→711,673; 764,325→733,286. Comparar dentro da mesma rodada; tempos absolutos
variaram entre runners. Não são medidas de produção nem percentis de usuários.

Leads da rodada final: mesmos 80 recortes e bytes/consultas abaixo. Primeira
execução 188,697→42,006 ms; duas repetições 174,513/205,867→38,634/38,274 ms.
Node mede SQL e processamento no harness isolado; não mede o endpoint operacional.

Instrumentação da matriz no artefato da CI41461202422: oito perfis, 392/392
combinações, zero retries e zero espera por retry. Soma dos tempos por perfil:
452824 ms, sendo 392000 ms de cadência fixa e 59942 ms de requisições. Controles
originais de carga permanecem; ausência de falha serial não prova capacidade para
bursts ou pausa menor. Não houve economia medida nessa cadência. Os 20 testes E2E
da rodada concluíram em 9,1 min; esse tempo inclui outras jornadas.

Run [41461202422](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41461202422)
aprovou os quatro jobs. Head `ddde6bb980f2610f3cc31fe2e85835681a5d844b`, merge
de teste `4a08b9b1272e5af2aa2fa727df538705839bdb2e`; não é aprovação de main.
Release-gates durou 40m59s. Origem e restauração independentes validaram 100
migrations, 46 arquivos/2391 asserções pgTAP, owners, privilégios e fingerprints.
Não é restauração representativa da base remota nem autorização de cutover.

PostgreSQL 17.6, fixtures v4 sintéticas, três repetições aquecidas com ordem
alternada; clock do servidor exclui rede/serialização, sem flush de cache:

| Fatos / rótulos / operações | Ranking   | Baseline ms | Sem sorts ms | Conjuntos ms |
| --------------------------- | --------- | ----------- | ------------ | ------------ |
| 5000 / 30 / 1000            | permitido | 90,556      | 83,369       | 91,205       |
| 5000 / 30 / 1000            | mascarado | 100,452     | 93,488       | 99,797       |
| 20000 / 300 / 4000          | permitido | 405,556     | 381,930      | 412,888      |
| 20000 / 300 / 4000          | mascarado | 432,924     | 399,878      | 424,900      |

Todos os JSONs foram equivalentes. As primeiras execuções constam do artefato,
separadas das medianas; não houve ganho em toda primeira execução. Selecionada
a menor mudança comprovada: remover sorts intermediários. A CI precisa validar
o novo SHA instalado; a aprovação anterior não é transplantada.

Leads: 80 recortes por escopo/filtro/categoria, cursor em microssegundos, limite
de novos registros e exportação integral passaram. Fixture de 5000 leads:
legado 5 consultas, 2936263 bytes, 5000 linhas; página 1 consulta, 31317 bytes,
50 linhas. Primeira execução 90,709→23,931 ms; repetições 83,358/91,628→
20,700/20,625 ms. São medições SQL+Node isoladas, sem provar latência operacional.

PR 467 aberto para o pacote coordenado. Run inicial 41447032115 parou somente
em Formatting do script appointments-profile-performance, antes de lint/tipos/
testes/build/banco. Formatação e dois finais de linha SQL normalizados num único
ajuste; nenhum sucesso desse run é atribuído aos gates não executados.

Run 41447538767 em 76e255f5: formatação, lint e tipos passaram; Vitest registrou
4786 aprovados/112 condicionais e quatro falhas em duas dependências afetadas.
FAQ agora testa o componente de conteúdo real, conservando todas as asserções
de texto e fontes. A versão SQL nova entra apenas em
nonDeployableRepositoryVersions do allowlist histórico de homologação; os dois
candidatos e hashes Auth/MFA permanecem intactos. Nenhum gate foi ignorado.

Preparação encerrada; commits/PR/CI/publicação estão registrados no estado integrado acima. CI da base foi conferida via API pública: run 41380947066, push/main
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

Conferência SSH anterior à promoção: produção `0dab1578`,
deployment `694c8f77-0aa7-4e64-92c4-1a7aeed3117d`, publicação real
2026-11-02T02:50:35.132Z, sem pendência. Não é a consulta final de DEPLOY-001.
Naquele momento não havia troca de runtime. O checkout administrativo tinha outro
SHA e foi preservado; a promoção usou checkout/artefato próprios do candidato.

A nota inicial ultrapassou o limite de 256000 bytes do índice. Uma seção histórica
foi movida integralmente para o arquivo existente de Agendamentos, com referência,
sem compressão ou remoção de conteúdo. Sync posterior aprovou sete documentos.
