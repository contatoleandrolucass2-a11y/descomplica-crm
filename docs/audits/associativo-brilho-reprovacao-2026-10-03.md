# Associativo: brilho e reprovacao metalica

## Integracao e Gate de Impressao em 04/10/2026

- PR #141 integrado em `7337b97c08f8faf26684ae2abd9f9ae138ed3e67` apos CI
  `37168835931` verde no HEAD `f62cad0`. Arvores Git identicas.
- Artefato autenticado `11291385531`, captura limpa `eb58d17`, ZIP SHA-256
  `8cf5334c3ad6f22c3452febfbc37951cf733011bd320192ba476e99780fa0924`.
  Passaram 193 comparacoes, 193 auditorias de acessibilidade, 40 combinacoes
  de navegacao e seis jornadas do contrato v5. Nenhuma baseline alterada.
- Repeticao final local: lint, tipos, build, oito Node e seis jornadas com
  CSS minificado aprovados. Suite Windows: 1478 aprovados, um ignorado e
  seis falhas POSIX conhecidas; sem timeouts. Suite Linux aprovada na CI.
- Main CI `37173712179`, primeira tentativa: validate, restore e imagem
  aprovados. Release-gates falhou somente em `tabelaoValidation.responsiveGrid`,
  especificamente `printLayout`; outros 19 criterios de layout/recursos,
  Associativo e todas as 193 comparacoes visuais passaram.
- Evidencia da tentativa: artefato `11292638877`, ZIP SHA-256
  `5784f6d3d244bb527fa358c933a20873edbb0b09dac2a164fd44bba8dde84db5`.
  Uma reexecucao do job falho foi solicitada no mesmo SHA, sem dispensar gate.
- Reproducao isolada identificou leitura antecipada de `min-width` durante
  a transicao para impressao: cinco de seis leituras imediatas falharam;
  todas passaram entre 13 e 48ms aguardando o predicado completo. Inclui
  `tabelao-layout.css`; rede bloqueada e nenhum JavaScript de aplicacao.
  O log da CI nao identifica o subpredicado, portanto a atribuicao daquela
  falha especifica a essa corrida e uma inferencia apoiada pela reproducao.
- Correcao separada somente de QA: espera finita de cinco segundos pelo
  mesmo predicado, preservando largura, visibilidade, linhas e cabecalhos.
  Sem alteracao de pagina, CSS, calculos, snapshots ou limiares. O Tabelao
  de referencia permanece intacto. Publicacao ainda depende dos gates finais.
- Revisao independente confirmou por AST que o predicado foi preservado.
  Nova prova: nove de dez leituras imediatas falharam; dez de dez passaram
  com o bloco corrigido em 21-75ms. Defeitos persistentes de largura 1100px
  e cabecalho deslocado falharam por timeout (500ms apenas nesses probes,
  em memoria; codigo final permanece com 5000ms). Remover cada defeito
  restaurou a aprovacao. Oitenta e nove testes focados aprovados.

## Retomada com a Base Corrigida

- Em novo pedido, usuario determinou incorporar a correcao e publicar.
- Integra main `db1b62597987591d205deea796364c331fe2b3b5`, que inclui a
  remocao de fast-glob/micromatch/braces via patch do plugin Next no PR #139.
- CI da base `37144378453` integralmente aprovada. Isso nao dispensa a CI
  da arvore combinada deste PR. Conflitos apenas documentais, ambos preservados.
- A CI anterior deste PR (`37136181590`) confirmou testes Linux, lint e tipos;
  falhou exclusivamente na auditoria. Registro de bloqueio abaixo e historico.
- Instalacao congelada aprovada; `pnpm audit --audit-level high` retornou
  nenhuma vulnerabilidade conhecida. Quarenta testes focados aprovados,
  incluindo os dez do plugin Next real. Demais gates combinados em andamento.

## Validacao da Arvore Combinada

- SHA `30d1bf4`: lint, tipos, build, audit e oito testes Node aprovados.
  Suite Windows: 1476 aprovados, um ignorado e oito falhas. Seis dependem de
  modos POSIX/symlinks; os dois timeouts de knowledge passaram na repeticao
  serial dos 22 casos, sem mudar os limites. CI Linux aprovou a suite completa.
- Seis jornadas locais aprovadas novamente, incluindo desktop e mobile nos
  tres temas. Capturas `59128-1440-dark-complete.png` e
  `59128-375-light-complete.png` revisadas; artefatos sinteticos nao versionados.
- CI `37167561944`: validate e isolated-restore aprovados; release-gates
  parou no contrato de guidance, antes das comparacoes visuais. Artefato
  `11290058414`, ZIP SHA-256
  `8398e3ba6c4bc976d4da62302b36e00cd3d337be4fe8cac94f7de8a444dcc224`.
  Captura `0e669f1d87f8838170d8c6ba1f5a7036158bd443`, arvore identica ao SHA acima.
- Causa confirmada no CSS compilado: o minificador converte a coordenada
  vertical `0%` em `0`, serializada pelo navegador como `0px`. O contrato
  comparava strings, embora ambas representem exatamente o topo.
- Correcao exclusiva do QA normaliza apenas `0px` para `0%`; exige novamente
  topo `0%` e rodape `100%`. Testes rejeitam 1px, meio da linha e bordas
  sobrepostas. Quinze testes de guidance aprovados. Nenhum limiar visual,
  duracao, requisito de movimento ou regra de runtime foi alterado.
- Publicacao permanece condicionada a nova CI integral aprovada.

## Escopo

- Branch `codex/associativo-brilho-reprovacao`, base `506b9e3`.
- Seis capturas do pedido posterior substituem a moldura dourada do ledger.
- Inputs, wrappers e composicao sem contorno/sombra, mantendo superficie do
  tema e foco de teclado pelo nome sublinhado. Sem preencher a linha de ouro.
- Duas faixas douradas de 2px percorrem topo e rodape da linha ativa, ciclo
  exato de 3s; cessam ao concluir a acao ou solicitar movimento reduzido.
- Dolar de 17px fora da secao/tabela/celula, a direita da ultima data,
  alvos de 24px para ponteiro fino e 44px para toque, sem caixa ou borda.
- Reprovacao com gradiente vermelho-sangue, numeros e status correspondentes,
  texto branco e brilho vermelho de 3s no rodape enquanto reprovado.
- Tabelao, tokens compartilhados, etapas, limites comerciais e calculos intactos.

## Validacao

- Node 24.19.0 e pnpm 11.20.0. `pnpm lint`, `pnpm typecheck` e `pnpm build`
  aprovados, assim como formatacao dos arquivos verificaveis e diff check.
- `pnpm exec vitest run tests/associative-guidance.test.tsx tests/archive-theme-colors.test.ts --maxWorkers=1`:
  30 aprovados. Contratos rejeitam molduras residuais, brilho estatico,
  intervalo incorreto, dolar interno e contraste insuficiente.
- `pnpm test`: 1411 aprovados, 11 falhas e um ignorado em 1423 testes.
  Seis falhas de modo POSIX/symlink conhecidas no Windows; cinco timeouts
  em knowledge/devtools durante concorrencia local. Nenhum teste de UI falhou.
- `pnpm exec vitest run tests/obsidian-knowledge.test.ts tests/project-devtools.test.ts --maxWorkers=1`:
  46 aprovados, sem alterar timeout, comportamento ou ignorar casos.
- `node --test ops/salesforce/*.node-test.mjs`: oito aprovados.
- Matriz sintetica local: **6/6 jornadas aprovadas**, 1440x900 e 375x812,
  claro/medio/escuro. Sem dados
  reais; escritas e requisicoes externas bloqueadas. Evidencia nao substitui
  o gate autenticado/restore da CI nem valida capacidade de producao.
- QA detectou contorno no wrapper de quantidade, foco na composicao, CTA
  branco sobre tema claro e distancia adicional no mobile; corrigidos antes
  de fechar a matriz. Nenhuma tolerancia ou referencia visual foi afrouxada.
- Artefatos locais em `test-results/guidance`, nao versionados.
- Capturas finais `60660-1440-dark-complete.png` e
  `60660-375-light-complete.png` revisadas visualmente. Contrato
  `associative-guidance-row-edges-rejection-v5`: duracao/movimento reais,
  contraste, cessacao ao concluir/reduced motion, geometria e abertura do
  dialogo de remuneracao aprovados. Revisao independente do diff sem achados.

## Dependencia e Publicacao

- Usuario autorizou corrigir/validar a dependencia. Resultado: **bloqueado**,
  sem patch de dependencia aplicado ou alegacao de vulnerabilidade corrigida.
- Caminho no lockfile: `eslint-config-next@16.3.6` ->
  `@next/eslint-plugin-next@16.3.6` -> `fast-glob@3.3.1` ->
  `micromatch@4.0.8` -> `braces@3.0.3` (ferramenta de lint).
- `pnpm audit --audit-level high` acusa GHSA-vfj7-8cjw-p6xm. A consulta
  `pnpm view braces@3.0.4 version dist.integrity dist.tarball repository dependencies engines --json`
  retornou E404. Sem pacote verificavel para atualizacao minima nesta tentativa.
- [Advisory oficial](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  consultado em 03/10/2026, informa versoes afetadas <=3.0.3 e nenhuma versao
  corrigida. Nao considerar a sugestao >=3.0.4 do audit como prova de publicacao.
- Investigacao independente nao concluiu por bloqueio da ferramenta.
  Reproducao/nao-reproducao e compatibilidade de eventual substituto nao foram
  provadas; nenhum ignore, excecao de audit ou versao ficticia foi introduzido.
- Merge/deploy continuam condicionados a audit e CI integral verdes, revisao
  das capturas afetadas, imagem imutavel, backup, CAS, rollback e pos-check.
  Nao houve alteracao no runtime de producao nesta tarefa.
