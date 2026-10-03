# Associativo: brilho e reprovacao metalica

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
