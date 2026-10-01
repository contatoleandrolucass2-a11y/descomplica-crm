# Alinhamento do rodape do Associativo

## Escopo

- Rota: `/app/simulacao/associativo-fluxo-linear`.
- Pedido: subir o texto da direita e alinhar sua primeira linha ao aviso da esquerda.
- Fora do escopo: textos, temas, estoque, calculos e outros simuladores.

## Implementacao

- Aviso preliminar e contato agora compartilham `.investor-page-closing`.
- A grade usa duas colunas no desktop e uma coluna abaixo de 760px.
- O QA autenticado passa a medir alinhamento no desktop e empilhamento no celular.

## Evidencias locais

- Node 24.19.0 e pnpm 11.20.0.
- Teste focado: 3/3 aprovados.
- Navegador sintetico: diferenca vertical de 0px em 1600px; textos empilhados
  sem sobreposicao e sem overflow horizontal no breakpoint estreito.
- Console: nenhum erro ou aviso.
- Matriz de navegacao: 40/40, quatro simuladores, dez larguras e tres temas;
  todos os cenarios sem erro de runtime.
- `pnpm lint`, `pnpm typecheck` e `pnpm build`: aprovados.
- `pnpm test`: 994 aprovados, um ignorado e sete falhas locais sem relacao com
  o diff: permissoes POSIX, symlink no Windows e timeout do parser Chrome.
- CI 36862800456: validacao Linux, banco, E2E e restore isolado aprovados.
- A matriz funcional autenticada concluiu; o comparador sinalizou somente tres
  capturas do Associativo em 768, 1024 e 1280px, com razoes entre 1,13% e 1,36%.
- As tres imagens foram revisadas e promovidas pela rotina canonica transacional
  com rollback. As demais 190 referencias e os limiares 1%/16 foram preservados.
- Testes de integridade da referencia e do layout: 9/9 aprovados.

## Pendencias

- Reexecutar a CI no SHA candidato com as referencias promovidas.
- Publicar somente com os gates verdes, imagem imutavel, backup, CAS e rollback.
