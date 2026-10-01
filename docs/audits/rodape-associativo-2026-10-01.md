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

## Publicacao

Concluida em 01/10/2026 apos PR #120 e CI main 36881065033 integralmente verde.

- Runtime: `5878c3bce83990496d886c3311527724beb7d9f9`.
- Anterior: `de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c`.
- Manifesto carregado: `sha256:2bf5adb5018759622944369cab0b3775084628256fa66e605f23d812e12b2f2c`.
- Config da CI: `sha256:e224615b70d0d0ee00ecd0e87e0a5d8bd19d057b526b4579aa6b6b6cc977188e`.
- Checksum do arquivo: `0533191ca4918ddd738be2dfe35abb839fe93753e59fa45625dd3f8cd1d13243`.
- Onze camadas e dois perfis comprovados, sem rebuild na VPS.
- Backup: `/var/backups/descomplica-crm/releases/5878c3bce83990496d886c3311527724beb7d9f9.QK102m`.
- CAS confirmou a versao anterior; health local/publico, Nginx e checksums do
  backup passaram. Rollback ficou preparado e nao foi necessario.
- Doze GETs anonimos, quatro concorrentes, sem erro; health 200 com SHA correto
  e estoque/snapshot 401 `no-store`. Nao representa teste de capacidade.
- Navegador autenticado: 2.135 unidades carregadas, alinhamento de 0px no
  desktop e empilhamento sem sobreposicao/overflow no celular. Nenhum erro de
  console, unidade selecionada ou proposta alterada.
- O registro final e apenas documental e nao requer novo restart da aplicacao.
