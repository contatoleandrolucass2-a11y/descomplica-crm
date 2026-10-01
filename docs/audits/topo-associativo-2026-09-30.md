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

## Publicacao Confirmada

- PR #116 aprovado pela CI 36777405809 e integrado. CI main 36780351488
  aprovada integralmente no SHA 843fd113a3a1f6b6fd3b6b12b6de58de180256ce.
- Imagem da CI promovida sem rebuild. Checksum, configuracao, manifesto e onze
  camadas conferidos; dois perfis de runtime aprovados no destino.
  Digest local: sha256:a698987b17e035bb2a75088a270b33b760da24a99696bf4af81601d9c72e6bad.
- Backup privado e rollback preparados; CAS da versao d9c2bee confirmado.
  Nginx, banco, contas e regras financeiras permanecem intactos.
- Health local/publico confirma a versao. Doze GETs anonimos, quatro concorrentes:
  health 200, estoque/snapshot 401, todos no-store, zero erros. Nao prova capacidade.
- Navegador autenticado em nova aba: 1280px, titulo/guia a 8px do menu, botao
  36px, cabecalho 56px, modo Escuro preservado e estoque carregado.
- Guia abre e recebe foco; Escape fecha e devolve foco ao botao. Zero erros de
  console observados e nenhuma unidade selecionada. Aba de trabalho preservada.
- Este registro e documental; nao repetir deploy ao integra-lo.
