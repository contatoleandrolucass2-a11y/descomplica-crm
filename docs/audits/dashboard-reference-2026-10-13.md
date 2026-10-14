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

Reavaliar filtros e criterios indisponiveis somente quando a fonte e a
autoridade aplicaveis forem implementadas e verificadas em tarefa especifica.
