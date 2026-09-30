# Compactacao do Associativo

Data: 2026-09-30. Branch: codex/compactacao-associativo.
Fonte: quatro capturas e pedido direto do usuario.
Status: funcional e visual revisados; CI das referencias e publicacao pendentes.

## Escopo

- Estoque do Associativo: dez unidades visiveis por vez, com rolagem pelo
  estoque completo. Preserva filtros, ordenacao, selecao e virtualizacao.
- Altura real e passo virtual alinhados: 26px em tabela, 48px ate 760px.
  O limite inclui o cabecalho fixo e bordas; nao limita o resultado a dez itens.
- Linha selecionavel em dourado no hover e no foco por teclado, com texto
  escuro contrastante. Unidades indisponiveis nao recebem estado de acao.
- Cabecalho compartilhado dos quatro simuladores: 56px em desktop/tablet;
  duas linhas compactas no celular. Mantem controles de pelo menos 44px.
- Temas somente com texto e icones. Sublinhado identifica o tema ativo,
  preservando aria-pressed, foco visivel e persistencia condicionada ao consentimento.
- Titulo do Associativo reduzido de 4rem para 2rem no desktop amplo,
  com 1.475rem no celular e espacamento de letras zero. Sem tipo baseado em vw.
- Preserva azul-marinho original, paleta azul, regras financeiras e dados.

## Verificacao

- Novo contrato de navegador integrado a matriz archive-navigation: altura,
  controles sem caixas, dez linhas, ultima unidade acessivel, hover/foco dourado
  e tamanho do titulo. Executa nos tres temas e dez larguras.
- Lint, typecheck e build locais passaram. Testes Windows: 993 passaram, um skip,
  seis falhas de modo POSIX e um timeout DevTools. Reteste isolado: 24 testes
  DevTools, 13 de cores/navegacao e oito testes Node passaram.
- Inspecao de desktop/mobile sinteticos confirma os quatro ajustes. O contrato
  aguarda a transicao CSS antes de conferir cores, sem reduzir assercoes.
- Matriz completa pendente. Referencias visuais somente serao
  atualizadas depois de inspecao das capturas e aprovacao dos gates funcionais.
- Nenhuma alteracao de banco, contas ou n8n.

## Bloqueios Encontrados

- CI 36757589260 aprovou lint, tipos e testes Linux, mas interrompeu no audit:
  Next 16.3.3 atingido pelo alerta critico GHSA-vcvr-r3jv-pc5j, publicado na
  base em 30/09. Atualiza Next e eslint-config-next para o patch 16.3.6.
  Fonte: [release oficial](https://github.com/vercel/next.js/releases/tag/v16.3.6).
  Nao ha import de next/og ou ImageResponse em app/lib; isso nao dispensa patch.
- QA local confirmou Associativo, Direta e Investidor, mas revelou perda de
  foco no Tabelao ao cruzar o breakpoint do menu. O navegador pode retirar o
  foco do elemento ocultado pelo CSS antes do evento matchMedia.
- Menu agora conserva a referencia do ultimo foco interno somente para esse
  caso; foco ou clique fora do menu limpam a referencia. Mantem o contrato de
  retorno ao controle visivel, sem roubar foco de campos externos.
- Revalidacao completa obrigatoria apos as duas correcoes; gates preservados.
- Audit apos patch: nenhuma vulnerabilidade conhecida. Teste isolado: 20
  ciclos de redimensionamento passaram; foco externo preservado. O contrato
  de navegador tambem verifica que o menu nao toma o foco do estoque.

## Evidencia Integrada

- Next 16.3.6: lint, tipos e build locais passaram. Suite Windows: 994 passaram,
  um skip e seis falhas POSIX; oito testes Node passaram. Nenhum timeout no reteste.
- Preview final: 40/40 combinacoes de quatro rotas e dez larguras, nos tres temas,
  sem erros de navegador. Dez unidades, acesso ao fim e hover/foco aprovados.
- CI 36758571149: validate, banco, advisors, restore e E2E aprovados. Matriz:
  40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
- As 44 divergencias visuais correspondem somente aos quatro simuladores.
  Revisa todas em onze grupos de tema/largura; sem novas colisoes identificadas.
- Promocao canonica do merge be1c82b4cbe03773953f1f5bdb7c38224d282755:
  proveniencia, hashes, gates funcionais e checkout de captura limpo conferidos.
  Preserva as demais 149 imagens e thresholds de 1%/16 por canal.
- Formata o manifesto gerado antes do commit. CI integrada final e deploy pendentes.
