# Compactacao do Associativo

Data: 2026-09-30. Branch: codex/compactacao-associativo.
Fonte: quatro capturas e pedido direto do usuario.
Status: implementado, validacao integrada e publicacao pendentes.

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
- Nenhuma alteracao de banco, contas, dependencias ou n8n.
