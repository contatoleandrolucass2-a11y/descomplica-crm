# Replica informacional do dashboard

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

## Publicacao verificada em 14/10/2026

PR213 integrado em `792320ba037ea48655739aaeefe5295b95c33631`; arvore igual a
`f2f6f2b0c87d24738ef882adf1559673a172ee41`. CI de PR38503071023 aprovada.
CI push/main38506931120 concluida com success as04:08:53Z, nos quatro jobs.
Fontes: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/213 e
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38506931120.

Linux:139 arquivos/2747 testes aprovados e63 skips;19 E2E;154 responsivos,
88 temas,242 auditorias Axe,242 comparacoes visuais e110 zoom aprovados.
Restore, lint, tipos, build, audit e provas de imagem aprovados. Reexecucao
Windows apos o ultimo fix:2746 aprovados,63 skips e a unica falha de symlink
preexistente descrita acima. Tipos/build/lint passaram; lint local encontrou
tambem um aviso no modulo temporario gerado para promover a baseline, removido
apos uso, sem arquivo rastreado ou warning adicional na CI.

Artefato imutavel11868216878 `promotable-image-792320ba037ea48655739aaeefe5295b95c33631`:

- SHA-256 de image.tar.gz: `34926bf22d07b96214e4bf149f73eaa834c7581f946e0398dc4c7b5aabd878ba`.
- Config digest CI: `sha256:1b96b65a79033d498248c082f17869d1d8edda21d4b2cc815dfaa245e2a1e5d4`.
- Manifest digest VPS: `sha256:3a8307ca51fecbfc895c1d1b306e67972d09f5abb19a4bbca4923fe3426f5458`.

Conforme PROMOTABLE_IMAGE_RUNTIME, checksum e revision conferidos; index OCI,
manifesto/configuracao e seus tamanhos/hashes ligam os dois digests. Manifesto
legado,11 camadas tar, rootfs.diff_ids e RootFS.Layers coincidem; linux/amd64 e
label da release confirmados. Prova somente leitura do artefato em
`/srv/descomplica-crm-artifacts/792320ba037ea48655739aaeefe5295b95c33631/verify-image.py`.
image:prove confirmou os dois perfis no destino com fixtures isoladas. Sem
rebuild VPS; dependencias do checkout vieram do lockfile/cache existente.

Backup root-only do ambiente/ledger, comparado byte a byte, em
`/var/backups/descomplica-crm/releases/792320ba037ea48655739aaeefe5295b95c33631.QLwsJp`.
Imagem anterior0fdbb80 preservada, ID
`sha256:ea9c7df02c09cbe84c96b47ead5ae5ddf33d0080405034a8ed395c65a26b3740`.
Recuperacao prevista exclusivamente pelo coordenador para a tentativa exata;
depois de concluida, reversao exige novo PR/CI/promocao, sem editar ledger.

release:production deploy confirmou `deployed` em2026-10-14T04:15:43.522Z
(01:15:43 BRT), deployment `8fff7f32-9d09-4a61-8241-c4cf35acf120`, sem pendencia.
Versao/data anteriores conferidas dentro das travas e janela de frescor pelo
coordenador; CAS partiu de61a88f4d-45c1-44ed-b080-2e87e275c0e9/0fdbb80.
Status posterior confirmou o recibo, novo SHA e image ID.

Smoke observacional externo as04:16:16-17Z, sem cookies:
health HTTP200/status ok/version792320ba037ea48655739aaeefe5295b95c33631;
/app307 para/login; /api/dashboard/status e /api/inventory/snapshot401.
Jornada autenticada testada na CI isolada, nao em conta pessoal produtiva.
Nao houve migration, mudanca de dados, DNS, contas, cobrancas ou workflow n8n.
Registro final apenas documental; nao causa nova publicacao de runtime.
