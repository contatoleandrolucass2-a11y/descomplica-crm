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
- Corrige guia da proposta selecionada em tablet: mantem a terceira coluna
  entre 561px e 1100px, evitando transbordar do cabecalho fixo para o bloco seguinte.

## Validacao

- CI 36800158280, captura b414e8b864db96abdc48be5dec35b0791eed908b:
  validacao Linux, banco, restore, E2E e gates funcionais aprovados. Matriz
  completou 40 navegacoes, 140 rotas, 80 temas, 193 axe e zoom sem falhas.
  Onze diferencas visuais esperadas somente Associativo foram inspecionadas
  e promovidas pelo mecanismo canonico, com hashes e transacao/rollback.
  Demais 182 capturas preservadas; thresholds permanecem 1%/16 por canal.
  A CI final com referencias atualizadas e publicacao ainda estao pendentes.
- Reexecucao local com Geist real: 30 combinacoes de largura/tema aprovadas;
  390px/toque, 768px/ponteiro e 1440px/toque aprovados com metadados de data,
  guia/Escape/foco, ajuda, limpeza preservando proposta e axe sem violacoes.

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

Concluida em 01/10/2026, apos PR #118 com CI 36806006230 verde e CI main
36807945046 aprovada. Nao houve alteracao de banco, n8n ou dependencias.

- Runtime: `de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c`.
- Anterior: `843fd113a3a1f6b6fd3b6b12b6de58de180256ce`.
- Manifesto carregado: `sha256:388da80de9c6c262061f16974654d457e9c6f9993c5ccce4218e06870192331f`.
- Config da CI: `sha256:8d2059368c37808fd37e523a0a6009cbc492e659fafa13b5924e5fc5c65c0a56`.
- Checksum do arquivo: `060316191553dbf7df97022dc99fc77f862c0226a6bc2c0bd91254f1adeb5260`.
- Onze camadas verificadas e dois perfis comprovados, sem rebuild na VPS.
- Backup protegido: `/var/backups/descomplica-crm/releases/de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c.yXebYX`.
- CAS confirmou a versao anterior; health local/publico validou a nova.
  Nginx preservado; rollback preparado, nao necessario.
- Doze GETs anonimos, quatro concorrentes, sem erro: health 200 com SHA correto
  e estoque/snapshot 401 no-store. Nao representa teste de capacidade.
- Navegador autenticado em nova aba, sem recarregar trabalho existente:
  titulo a 8px do menu, guia 32px, icones centralizados, filtros a 10,67px da
  divisoria, metadados a esquerda da limpeza e dez linhas visiveis. Sem overflow.
- Guia e ajuda funcionais, Escape/retorno do foco aprovados, zero erros de
  console observados. Nenhuma unidade real selecionada ou proposta alterada.
- Observacao operacional: preflight encontrou 7,7GB livres/93% de uso na VPS.
  Nao executou limpeza destrutiva nem alterou recursos de outros trabalhos.
- Este registro documental nao requer reiniciar a aplicacao.
