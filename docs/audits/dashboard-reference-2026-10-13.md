# Replica informacional do dashboard

Atualizacao posterior: [relatorios publicados e refresh automatico](dashboard-atualizacao-2026-10-14.md).
O registro abaixo preserva a sequencia historica da replica e dos funis.

## Correcao dos funis em 14/10/2026

Pedido adicional: incluir graficos no Comparativo mensal conforme o print,
permitindo melhorar a apresentacao e sem modificar a origem. A referencia foi
consultada em navegador somente leitura, apos falha do fetch web. Ela contem
cinco etapas; o print traz tambem Pastas aprovadas. A implementacao conserva
os seis blocos e desenha seis etapas em cada um, com geometria ordinal fixa.
As larguras indicam a ordem das etapas, nao uma escala quantitativa nem coortes.

`dashboard/data.ts`, `catalog.ts` e `presentation.ts` fornecem cinco series.
`ops/salesforce/transform.mjs` usa aprovadas no ranking e no diagnostico de
qualidade, mas nao fornece serie mensal equivalente em todas as visoes,
historicos e metas. Por isso, Pastas aprovadas fica indisponivel, sem repetir
Pastas, extrapolar ranking ou importar o numero historico do print. Rever
quando existir contrato mensal autorizado e validado para essa metrica.

Markup SSR sem nova dependencia; nomes acessiveis por bloco, valores completos,
contraste e diferenciacao entre ausencia e zero preservados. Numeros longos
usam tipografia compacta sem abreviar os dados. Conversoes existentes continuam
calculadas nas cinco series reais. Testes passaram a exigir seis figuras e 36
etapas no E2E e na captura autenticada, alem da verificacao de trapezios no QA
sintetico. Os limiares de pixels e altura permanecem inalterados.

Validacao inicial da correcao: 18 testes de componente e typecheck aprovados.
QA sintetico com 74 verificacoes aprovadas e 28 capturas, tres temas e larguras
390/768/1440, estados completo, indisponivel, zero, sem meta e numeros longos.
Sem overflow, violacoes Axe, erros de console ou acesso externo. Desktop
completo mede 4.704 px; indisponivel 4.572 px, abaixo do limite existente de
4.800 px. Funis claro/desktop e escuro/celular inspecionados. Fonte local:
`test-results/dashboard-report/report.json` e capturas ignoradas correspondentes.
Lint e build locais aprovados. A suite global Windows teve 2.746 aprovados,
63 skips, a falha preexistente de symlink e dois timeouts em devtools/status.
Reexecucao isolada confirmou timeouts, inclusive inicializacao Next MCP; o
coletor tambem encontrou falhas de ACL Windows. Nenhum timeout ou assercao foi
relaxado. Release local: 113 passaram, 11 skips POSIX. Estes resultados nao
equivalem a uma suite Windows verde; nao houve mudanca nesses modulos.

Depois de integrar main/faae8e9 (Rotina), a CI38515347098 de aa5c835 aprovou
validate: 2.807 testes de aplicacao, 79 skips, 241 testes do coletor e 124 de
release, sem falhas. Lint, tipos, fontes documentais, audit e build tambem
aprovados no Linux. Fonte: job115692777558, consulta14/10/2026 05:17Z. Captura
autenticada ainda estava em execucao nessa consulta.

CI concluida: restore, 1.323 pgTAP e 19 E2E passaram. Matriz autenticada passou
154 responsivos, 88 temas, 242 Axe, 110 zoom, 22 canvases e demais checks do
predicado funcional original. Desktop do dashboard mediu 4.744 px. Falha do
gate limitada as 11 imagens do dashboard; outras 231 passaram.

Captura20aed961 tem arvore identica a aa5c835. Artefato11873042399 teve hashes
e baseline usada conferidos; funis inspecionados no desktop claro e celular
escuro. Promocao transacional somente dessas11 imagens, preservando231 e sua
proveniencia. Detalhes em docs/qa/reference-parity/README.md e reviewedUpdates.
Flag dirty mantido: fingerprint1289963a foi reproduzido com diff rastreado vazio
e19 arquivos QA gerados. Excecao limitada a esse artefato; nao dispensa prova
em capturas futuras. Nova CI verify, merge e publicacao permanecem pendentes.

## Fonte e escopo

Consulta da pagina publica em 13/10/2026 (14/10 em UTC):
<https://descomplicapro.com.br/?synced=2026-08-07T04%3A04%3A27.433%2B00%3A00>.
Destino: `/app`. O usuario confirmou usar dados atuais do CRM, preservando
informacoes e secoes da referencia. O objetivo nao e congelar o retrato de
agosto nem substituir a arquitetura Next.js/Supabase por codigo legado.

## Correspondencia

| Secao da referencia            | Implementacao e fonte atual                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| Cabecalho, fonte e atualizacao | Metadados do snapshot autorizado; atualizacao Salesforce existente       |
| Navegacao por etapa            | Rotas existentes com permissao de etapas                                 |
| Geral e periodos               | Visoes autorizadas e Mes/Semana/Hoje                                     |
| Pulso do funil                 | Cinco etapas; realizado, conversao, meta e percentual realizado          |
| Comparativo mensal             | Medias de meses encerrados, mes anterior, meta, esperado e mes atual     |
| Conversoes intermediarias      | Expansao nativa por bloco mensal                                         |
| Ritmo de vendas                | Realizado mensal; esperado e parecer indisponiveis sem criterio aprovado |
| Diagnostico                    | Relacao total, diferenca para meta, menor relacao entre volumes e VGV    |
| Realizado Funil                | Agendamentos, visitas, pastas e vendas nos cinco intervalos existentes   |
| Corretores por gerente         | Contagem distinta de participantes mensais, percentual e total           |

As relacoes entre volumes agregados nao comprovam trajetorias individuais nem
perda de pessoas entre etapas. Nao se introduz um diagnostico causal ou uma
politica comercial nova. Mes anterior corresponde ao corte de data existente
no coletor; as medias usam meses encerrados. Valores ausentes nao viram zero.

## Limites explicitos

- Canal de vendas, gerente, responsavel e empresa nao sao dimensoes disponiveis
  no read model agregado. A interface informa indisponibilidade, sem controles
  que aparentem filtrar dados que nao possuem essas dimensoes.
- Meta esperada proporcional e plano de acao nao possuem autoridade comercial
  versionada aplicavel. Mantidos indisponiveis; nao se copia a regra historica.
- A equipe exige `crm.ranking.view`, `crm.dashboard.all.view` e visao `all`,
  alem das policies existentes. O vinculo com gerente e o informado no snapshot,
  nao um cadastro corporativo inferido. Sem mudanca de grants, RLS ou pontuacao.
- Metadados de ranking e dashboard devem coincidir; releitura detecta troca de
  geracao. Contagem exata, limite de linhas e validacao evitam totais parciais.
- O destino online exige login. Nenhum login foi contornado, nenhuma credencial
  inserida e nenhum dado privado foi exportado para as evidencias.

## Validacao

Node 24.19.0 / pnpm 11.20.0, Windows. Testes e capturas usam somente fixtures
sinteticas. Checagem de tipos e build passaram na primeira integracao. Os 92
testes focados de acesso, apresentacao, equipe e completude passaram.

`pnpm test` executou 138 arquivos: 137 passaram; 2.722 testes passaram, 63 foram
ignorados e um falhou no teste de symlink do estoque. Reproducao isolada confirmou
11 aprovados e a mesma falha. O modulo nao foi alterado: diff dos arquivos de
estoque, contratos e configuracao contra `origin/main` 0fdbb80 foi vazio; blame
aponta b53dff37 (PR210). No Windows, `constants.O_NOFOLLOW` e indefinido; a
abertura segue o link e `handle.stat()` examina o destino, retornando HTTP200
onde o teste espera 502. Nenhum teste foi suprimido ou limiar reduzido.

Limite: isso nao comprova falha no runtime Linux nem bypass de autenticacao.
Reavaliar em correcao especifica multiplataforma que considere concorrencia
entre inspecao e abertura; `lstat` isolado nao elimina essa corrida. A CI Linux
integral do candidato continua obrigatoria, e esta nota nao dispensa gates.

Suites posteriores executadas separadamente porque o encadeamento parou na
falha: coletor 226 aprovados/15 skips de plataforma; release 113 aprovados/11
skips exclusivos de Linux. CI, merge e publicacao permanecem pendentes.

A replica integral substitui o antigo canvas resumido de uma tela: o limite
de altura desktop de `/app` passa de 1.125 para 4.800 px, com base na captura
sintetica em torno de 4.400 px e margem para o shell autenticado. As demais
rotas e os limiares de comparacao de pixels permanecem intactos. O teste
autenticado passa a exigir as cinco secoes, cinco graficos, seis expansoes
mensais e quatro tabelas; o harness dedicado entra na CI. A promocao das
referencias visuais exige revisao das diferencas intencionais e nova CI.

QA dedicado final: 65 verificacoes, 21 capturas, 18 combinacoes de tres temas,
tres larguras e estados completos/indisponiveis. Alturas em 1.440 px: 4.322 px
completo e 4.200 px indisponivel. Sem overflow horizontal, Axe serious/critical,
erros de console ou rede externa. Teclado, expansoes, ranking autorizado,
periodos, refresh sintetico, zero e ausencia tambem verificados. Capturas
inspecionadas em desktop claro e celular escuro; preview CUA conferido em
desktop e celular. Artefatos locais ignorados em `test-results/dashboard-report`.

Revisao independente identificou uma reingestao terminada entre a leitura
original do dashboard e a leitura da equipe, conservando generatedAt. Corrigido
com updatedAt no contrato SSR e comparacao do header original; regressao
reproduzida antes do fix e suite de equipe final com 64 testes aprovados.
Typecheck global aprovado apos a correcao. Nao e uma transacao unica no banco;
nao altera o contrato de escrita nem requer migration.

## Primeira CI

PR213 / candidato4484d72 / run38497027352. Validate, isolated-restore e QA
sintetico passaram em Linux. E2E falhou ao exigir o titulo antigo, antes da
matriz visual. Tres expectativas de titulo foram corrigidas para a referencia;
adicionada verificacao das cinco secoes e quatro tabelas no percurso Master.
Nenhuma permissao, perfil ou rota foi removida da matriz.

Reexecucao local final: 98 testes focados aprovados; suite global com 2.744
aprovados, 63 skips e a unica falha Windows de estoque ja documentada. Build,
tipos e lint passaram; lint conserva um warning preexistente em connected-systems.
Publicacao pendente dos gates e da revisao de referencias visuais.

## Revisao da baseline

Revisao P2 adicional do PR213: quando somente dashboard e regravado com mesmo
generatedAt, ranking antigo podia passar por sameMetadata. Duas regressoes
falharam antes do ajuste; agora ranking.updated_at deve coincidir com o
updatedAt original do dashboard, antes da consulta de participantes. A RPC
atual escreve ambos na mesma transacao com now(); fixture isolada tambem.
Nenhuma alteracao de schema, policy ou ingestao foi necessaria.

CI38498361779 do candidato d67a855 aprovou validate (incluindo pnpm test Linux),
restore, E2E e os checks funcionais originais:154 responsivos,88 temas,242 Axe,
110 zoom,22 canvases, teclado e simuladores. Falha limitada as11 comparacoes
de /app contra a pagina anterior. As outras231 imagens passaram sem promocao.

Captura771812cd350d124bcfe7af62e2298f7ac6b00178 tem arvore Git igual ao HEAD.
Artefato11865597980 teve ZIP/hash, hashes individuais e baseline usada conferidos.
Predicado funcional original foi executado novamente sem alteracao; helper
transacional original promoveu somente11 arquivos, apos inspecao desktop/celular.
Manifesto conserva proveniencia antiga das231 imagens e registra a nova captura
nas11 entradas e em reviewedUpdates. Limiares1%/16 permanecem identicos.

Excecao comprovada: worktreeDirtyAtCapture=true corresponde exclusivamente
a19 outputs de Conectar Sistemas. O algoritmo original foi reproduzido com
diff rastreado vazio e esses bytes do artefato, produzindo exatamente
aa7fa1906244e121501ede0fb6cdcefa9edcd954a825a1a419f92cac08b37c24.
Nao se afirma captura limpa; prova especifica, nao reutilizavel para outras
execucoes. Nova CI integral em verify, merge e publicacao continuam pendentes.

Reavaliar filtros e criterios indisponiveis somente quando a fonte e a
autoridade aplicaveis forem implementadas e verificadas em tarefa especifica.
