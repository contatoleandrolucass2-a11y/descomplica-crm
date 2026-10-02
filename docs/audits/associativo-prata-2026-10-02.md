# Associativo: prata e perfil sequencial

## Escopo

Pedido de 02/10/2026, dezoito capturas. Branch
`codex/associativo-prata-sequencial`, base `0ef7b2f`.

- Cabecalho compartilhado compacto, D vermelho/branco integrado ao nome,
  sem badge quadrado nem ponto final; navegacao e alvos de toque preservados.
- Associativo escuro: pagina `#001C54`, paineis `#002774`.
- Proxima acao em prata metalizado, faixa de brilho com ciclo de tres segundos
  ate a conclusao. Movimento reduzido mantem o destaque sem animacao.
- Perfil com confirmacao explicita de modalidade entre renda e primeiro imovel.
- Vao central igual ao padding lateral do fluxo; resumo Linear separado dos
  quatro blocos Decrescentes por duas linhas e intervalo vazio.
- Simbolo de remuneracao com 18px, sem borda, junto da ultima data decrescente.

## Marca

Asset: `public/descomplica-symbol.png`. Ferramenta integrada de imagem,
usada apenas para retirar o fundo azul da referencia fornecida, incluindo
o interior do D. Prompt: preservar geometria, proporcoes, vermelho e branco;
nao redesenhar nem adicionar objetos, texto, sombra ou contorno; fundo transparente.
Nao foi versionado o screenshot original do usuario.

## Limites

Sem alteracao de formulas, politica comercial, autenticacao, banco ou n8n.
As paginas externas indicadas anteriormente sao referencias somente leitura.
Dados de QA sinteticos, sem clientes, propostas reais ou estoque bruto nos artefatos.

## Validacao

- Node 24.19.0 / pnpm 11.20.0. Build e typecheck completos aprovados.
- Lint aprovado excluindo apenas `test-results/**`, artefatos locais nao versionados.
  Primeira tentativa coincidiu com remocao de um arquivo temporario de QA e
  terminou com ENOENT; repeticao sem essa corrida aprovada.
- 26 testes focados de marca, geometria/brilho e sequencia do perfil aprovados.
- `pnpm test` e repeticao Vitest com um worker foram interrompidos apos falhas
  POSIX conhecidas e timeouts de DevTools/infraestrutura neste Windows. Nao sao
  prova da suite completa; a CI Linux integral permanece obrigatoria.
- Primeira previsualizacao validou 1 -> 2 -> 3, shimmer e movimento reduzido,
  gap central/laterais de 28px e separacao 8px/0px dos grupos de parcelas.
  Identificou contraste insuficiente do $ no Claro, corrigido com dourado
  escuro nesse tema e no Medio; Escuro conserva o dourado luminoso.
- Pendente: repeticao visual final desktop/mobile, CI Linux integral e revisao
  das capturas afetadas. Publicacao bloqueada ate todos os gates passarem.
