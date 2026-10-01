# Associativo: estoque e cabecalho compactos

## Escopo

Fonte: nove capturas e pedido direto do usuario em 30/09/2026.
Branch: `codex/associativo-filtros-compactos`.

- Restaura dourado solido na unidade selecionada, hover e foco; texto escuro.
- Retira Guia completo e Filtros do estoque sem remover suas ajudas.
- Alinha icones aos titulos, aproxima guia/titulo do menu e usa botao de 32px
  em ponteiro preciso, 44px em toque.
- Move Limpar filtros para o cabecalho, mantendo contagem/atualizacao a esquerda.
- Elimina a linha vazia dos filtros, reduz margens do estoque e preserva
  dez unidades visiveis com acesso ao estoque completo por rolagem.
- Preserva outras rotas, tres paletas, regras financeiras e propostas ao limpar.

## Validacao

- CI 36798139339 aprovou E2E, banco, restore e validacao Linux. A matriz parou
  na altura do guia em 768px: com Geist, a largura em vw quebrava o texto.
  Corrige para largura estavel limitada ao conteiner, preservando a assercao.
  Nao promoveu referencias nem publicou esta rodada incompleta.

- Lint, tipos e build aprovados localmente; geometria aprovada em dez larguras
  e tres temas, incluindo selecao dourada persistente.
- Dois contextos de toque: botao 44px, guia/Escape/foco, ajuda dos filtros,
  limpeza preservando proposta e axe das superficies alteradas aprovados.
- `pnpm test`: 992 aprovados, um skip, seis falhas POSIX no Windows e dois
  timeouts de fixtures Obsidian. Reexecucao isolada aprovou todos os 22 testes
  Obsidian, incluindo os dois timeouts; restam somente as seis limitacoes POSIX.
  Oito testes Node aprovados. CI Linux obrigatoria, sem ignorar os gates.
- Matriz local completa: 40 navegacoes nos quatro arquivos/tres temas aprovadas,
  sem erros de runtime. Metadados com contagem/data tambem testados em toque.
- CI 36797025028: validacao Linux, banco e restore aprovados; concorrencia
  sintetica com quatro usuarios e pico de 20 requisicoes sem erros. Nao prova
  capacidade de producao. E2E parou em assercao do rotulo removido, atualizada
  para exigir ajuda, metadados e acao no cabecalho. CI integral/visual pendentes.

Contratos verificam alinhamento real, contencao, dez linhas, virtualizacao,
dourado persistente, filtros funcionais e preservacao da proposta selecionada.
Preview local usa estoque sintetico; nao comprova autenticacao nem producao.

## Publicacao

Pendente. Exige PR/CI verde, imagem imutavel, backup, CAS, rollback e
verificacao pos-publicacao. Nao houve alteracao de banco, n8n ou dependencias.
