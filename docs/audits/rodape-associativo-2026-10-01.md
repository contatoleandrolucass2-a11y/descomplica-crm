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

## Pendencias

- Validar a matriz Linux, referencias visuais e CI no SHA candidato.
- Publicar somente com os gates verdes, imagem imutavel, backup, CAS e rollback.
