# Topo compacto do Associativo

Fonte: pedido direto e duas capturas do usuario em 30/09/2026.
Branch: codex/topo-associativo-compacto. Base: 610d461.

## Escopo

- Margem superior do conteudo passa a 8px. Titulo e guia alinhados pelo topo,
  sem centralizacao vertical que empurrava o titulo para baixo.
- Espaco inferior e intervalo entre titulo/guia no celular passam a 8px.
- Botao Iniciar passo a passo reduz de 44px para 36px em ponteiro preciso;
  preserva 44px em ponteiro coarse para acesso por toque.
- Somente CSS do Associativo; preserva tamanho do titulo, menu, cores,
  virtualizacao, estoque integral, politica financeira e outros simuladores.
- Contrato de navegador verifica distancias, altura e contencao do botao.

## Validacao Local

- pnpm lint, pnpm typecheck e pnpm build: aprovados, Node 24.19/pnpm 11.20.
- pnpm test: 994 aprovados, um skip e seis falhas de modo POSIX em Windows;
  nenhuma assercao alterada para oculta-las. CI Linux permanece obrigatoria.
- node --test ops/salesforce/\*.node-test.mjs: oito aprovados.
- Preview isolado dos componentes reais com estoque sintetico: dez larguras,
  tres temas, 30 geometrias aprovadas. Dois contextos de toque adicionais
  confirmam 44px. Dez linhas visiveis e dourado continuam aprovados.
- Desktop 1440px e celular 390px: guia abre, recebe foco, fecha por Escape e
  devolve foco ao botao. Axe no topo: nenhuma violacao. Capturas inspecionadas.
- Preview e somente apoio local; nao substitui build autenticado/CI.
- Publicacao e nova referencia visual aguardam a CI e inspecao das capturas.

## Revisao Integrada

- CI 36774530982 no merge 622598a25a39a7da7f719089e4122234a65629e9: validacao
  Linux, banco, restore e E2E aprovados. Matriz funcional aprovada: 40 navegacoes,
  193 auditorias axe, zoom, teclado, manual e proposta. Apenas comparacao visual
  diferiu, em onze capturas exclusivas da rota Associativo.
- Inspecao das onze capturas confirma alinhamento, botao menor, texto legivel e
  ausencia de novas sobreposicoes. As demais 182 imagens permanecem intactas.
- Promocao canonica valida SHA, checkout limpo, hashes, proveniencia e gates
  funcionais. Thresholds de 1% e 16 por canal preservados; manifesto formatado.
- Nova CI com referencias atualizadas e publicacao permanecem pendentes.
