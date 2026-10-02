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
- CI 37063588639: validacao Linux e restore aprovados; gate funcional
  autenticado aprovado. Comparacao visual sinalizou somente duas capturas
  escuras do Associativo (desktop 1440x900 e celular 390x844).
- Captura limpa 6a1a80fee6f41c6231980ef1c07f2aec8b4ed338, artefato
  11251914554: duas capturas revisadas visualmente e promovidas pelo codigo
  canonico transacional. Outras 191 preservadas, incluindo todo o Tabelao.
- Nenhum gate, tolerancia ou mascara alterado. CI PR 37067036288 aprovada.
- PR #136 integrado em 150b77129723db56c09e896a42a4703f0df0fbfe. CI main
  37069870083 integralmente aprovada, incluindo imagem imutavel.
- Promover apenas diferencas visuais revisadas do Associativo, sem reduzir
  gates ou alterar referencias do Tabelao e das demais rotas.

## Publicacao

- Runtime publicado: 150b77129723db56c09e896a42a4703f0df0fbfe.
- Anterior: d77b2d8d0e680f742d298ea37288c5164efad471.
- SHA-256 do arquivo: 4cae9aa14937d925aba7bb2f8281bd88862bab79e5634eac6a0e534527464f28.
- Config CI: sha256:87327f015a34b5487fcb1f2c1ff0b8d6ac15f09d34397ba4e68c20d8b91d4cae.
- Manifesto carregado: sha256:9c498c84618cf0eca0daa24f87a3de051b7d6f4af385dda885084da56cad87e8.
- Equivalencia comprovada por cadeia de hashes e 11 camadas; dois perfis de
  runtime aprovados na mesma imagem. Sem rebuild no VPS.
- Backup privado: /var/backups/descomplica-crm/releases/150b77129723db56c09e896a42a4703f0df0fbfe.GiKy6m.
  Checksums de ambiente, Nginx e imagem anterior conferidos. CAS e rollback
  preparado; Nginx preservado e valido. Nenhum dado remoto alterado.
- Health local/publico com versao exata e status ok. Smoke observacional:
  12 requisicoes, concorrencia 4, zero erro; health 200, inventario e snapshot
  401 sem autenticacao. Nao representa prova de capacidade de producao.
- Navegador autenticado: fundo #061f35, painel #0a2b47, cabecalho #0e4163,
  campos #071a31 e bordas #3d7898 confirmados. Card corrente com gradiente
  dourado metalico, texto #2e230c e investor-guided-card-shine de 3s.
- Duas etapas seguintes bloqueadas durante a primeira; selecao visual local
  desfeita por reload ao terminar, sem salvar proposta ou dados de cliente.
- Tabelao somente consultado como referencia. Nenhuma mudanca em seu CSS,
  tokens compartilhados, dados ou configuracoes.
- Fechamento documental publicado pelo Git; nao requer novo deploy/restart.
