# Associativo: dourado fechado e contorno na edicao

## Escopo

- Pedido posterior em duas capturas, branch codex/associativo-contorno-dourado,
  base 3960724. Restrito ao Associativo; Tabelao e tokens comuns intocados.
- Estoque: gradiente metalico antigo #c4a255 / #b99545 / #a98032 / #d5b96f,
  com texto #171209. Tom mais fechado sem amarelo claro/branco no reflexo.
- Etapas, ledger e Ranking: superficie normal, contorno #9f7628, linha
  dourada de 2px junto a borda a cada 3s enquanto a acao estiver pendente.
- Inputs transparentes em vazio, foco e preenchidos. Preserva erros, sequencia
  1-2-3, alvos mobile, geometria e reduced motion. Sem alteracao financeira.

## Validacao Local

- Node 24.19.x e pnpm 11.20.x; lint, typecheck e build aprovados.
- 28 testes focados aprovados; 8 testes Node aprovados.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas de permissao/symlink
  POSIX conhecidas. CI Linux continua obrigatoria, sem skips adicionais.
- Matriz navegador: 6/6 jornadas, temas claro/medio/escuro em 1440x900 e
  375x812. Dados sinteticos, requisicoes externas e escritas bloqueadas.
- Conferidos: fundo transparente antes/depois de preencher, contraste >=4.5,
  borda contida, faixa dourada de 2px, duracao exata de 3s e deslocamento,
  interrupcao ao concluir/reduced motion, sequencia e geometria existentes.
- Capturas locais revisadas: estoque selecionado, perfil desktop/celular,
  financiamento pendente e fluxo preenchido. Sem caixa escura nos valores.
- QA inicial detectou fundo global no Ranking em temas medio/escuro; corrigida
  a precedencia local e repetida a matriz completa com sucesso.

## Publicacao

Pendente. Exigir CI integral, imagem imutavel, backup conferido, CAS, rollback
e verificacao observacional da versao/saude e jornada publicada. Nao alterar
referencias visuais sem revisao nem ampliar tolerancias para obter aprovacao.
