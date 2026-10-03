# Remocao da dependencia vulneravel do lint Next

## Motivo e escopo

GHSA-vfj7-8cjw-p6xm bloqueava o PR #139. O usuario solicitou resolver os
impedimentos e publicar. Nao foi concedida excecao de seguranca: a correcao
remove a cadeia fast-glob/micromatch/braces do grafo instalado.

`@next/eslint-plugin-next@16.3.6` usa fast-glob exclusivamente em getRootDirs,
para localizar diretorios configurados no lint. A aplicacao, regras financeiras,
autenticacao e configuracao de regras ESLint nao mudam.

## Implementacao

- Patch pnpm vinculado exatamente a 16.3.6, substituindo o import por tinyglobby
  0.2.17, ja presente no lockfile. Nao utiliza fork remoto nem pacote novo sem uso.
- packageExtensions declara a dependencia real; override remove apenas o
  fast-glob daquele consumidor. Nenhum audit ignore, skip ou tolerancia alterada.
- `onlyDirectories: true` preservado; `expandDirectories: false` evita incluir
  descendentes em caminhos literais, conforme o guia de migracao da biblioteca.
- Padroes absolutos usam raiz de sistema como cwd e saida absoluta. Isso preserva
  caminhos Windows, inclusive aliases curtos 8.3 usados por TEMP. Padroes relativos
  continuam relativos ao cwd do processo; barras finais sao normalizadas.
- Docker copia patches antes do install congelado. O lock registra hash do patch.
  Mudanca de versao do plugin exige revisao/remocao deste patch; instalacao falha
  quando o patch nao se aplica. Nao habilitar allowUnusedPatches.

## Verificacao

- A primeira auditoria apos a substituicao retornou nenhuma vulnerabilidade conhecida.
- O primeiro teste detectou incompatibilidade Windows e foi mantido para guiar
  a correcao. Nao foi convertido em skip nem teve expectativa reduzida.
- Cobertura: fallback cwd, diretorio literal, separadores Windows, padrao relativo,
  curingas, exclusao de arquivos/ocultos, chaves, arrays e destinos inexistentes.
- Prova funcional carrega o plugin real: link HTML interno continua gerando erro
  na regra Next, e next/link continua aceito. Prova de grafo exige ausencia dos
  tres pacotes retirados e resolucao efetiva do tinyglobby pelo plugin.
- Dez testes de regressao aprovados no Windows. Lint integral local interrompido
  sob memoria livre inferior a 500 MB; nao declarar aprovacao. CI Linux obrigatoria.
- Validacao completa, CI Linux, matriz visual, restore e imagem permanecem
  obrigatorios antes da publicacao. Resultados finais constam no PR #139.

## Fontes

- [Codigo oficial Next 16.3.6](https://raw.githubusercontent.com/vercel/next.js/v16.3.6/packages/eslint-plugin-next/src/utils/get-root-dirs.ts).
- [Migracao oficial tinyglobby](https://superchupu.dev/tinyglobby/migration).
- [Patches pnpm](https://pnpm.io/cli/patch) e [resolucao de dependencias](https://pnpm.io/settings/dependency-resolution).
- [Advisory original](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
