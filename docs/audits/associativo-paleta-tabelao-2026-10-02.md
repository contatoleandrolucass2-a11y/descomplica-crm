# Associativo com paleta do Tabelao

## Escopo

- Pedido posterior do usuario: usar /app/simulacao/tabelao apenas como
  conhecimento, aplicar as mesmas cores no Associativo e manter o dourado.
- Branch codex/associativo-paleta-tabelao; base 9f45f58.
- Referencia consultada no navegador autenticado, sem alterar filtros, tema,
  dados ou configuracoes. Tema escuro efetivo conferido apos hidratacao.
- Fundo #061f35, painel #0a2b47, cabecalho #0e4163, campos #071a31,
  bordas #3d7898 e destaque azul #7dd3fc.
- Remove doze overrides locais; herda investor-theme-tokens.css sem edita-lo.
- Dourado metalico e brilho de tres segundos preservados integralmente.
- Sem alteracao em Tabelao, layout, calculos, dados ou workflows n8n.

## Validacao

- 28 testes focados aprovados, incluindo heranca da paleta e contraste dourado.
- Lint, typecheck, build e 8 testes Node aprovados.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas conhecidas de
  permissoes/symlinks POSIX. CI Linux integral continua obrigatoria.
- Navegador com dados sinteticos: 6/6 jornadas, tres temas em desktop e
  celular, incluindo etapas, contraste, shimmer e reduced motion.
- Comparacao de estilos computados entre os componentes reais de Associativo
  e Tabelao em preview isolado: 3/3 temas com igualdade exata. Aguarda o fim
  das transicoes finitas antes de medir; nenhuma tolerancia adicionada.
- Capturas desktop/celular revisadas: fundo e paineis da referencia, dourado
  na acao corrente, textos legiveis e sem sobreposicao.
- CI e revisao das referencias autenticadas: pendentes.
- Promover apenas diferencas visuais revisadas do Associativo, sem reduzir
  gates ou alterar referencias do Tabelao e das demais rotas.

## Publicacao

Pendente. Exigir CI integral, imagem imutavel, backup, CAS, rollback e
verificacao observacional da versao/saude e jornada publicada.
