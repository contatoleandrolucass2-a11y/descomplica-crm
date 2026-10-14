# Rotina: seletor e contorno da coluna

Data: 2026-10-14. Branch: codex/rotina-seletor-coluna.

## Escopo

- Filtro nativo de escolha unica substitui seis abas; as seis funcoes continuam
  disponiveis, com rascunhos separados e salvamento compartilhado existente.
- Contorno branco animado unico na coluna atual. A geometria acompanha o
  cabecalho durante a rolagem sem alterar altura das celulas ou foco.
- Cabecalhos com o token do antigo seletor ativo; nenhum brilho individual.
- Modos segmentados, insercao secundaria e salvamento destacado, com foco
  visivel e movimento reduzido. Conclusoes e tipografia preservadas.
- Sem alteracao de hook, endpoint, schema, RLS, conteudo ou workflow n8n.

## Abertura e PR documental

- Git comum confirmado. Em15:54Z, main e health200/ok apontavam para
  5c4d95ee1e1b95d40d3ac283fb47d32d139494d7, versao anterior publicada.
- PR225 documental, head5d7631cd5957dfb86f6e57c204e414596217dd45, possui
  somente CHANGELOG, WORKLOG e duas notas. CI38588434885 aprovou validate e
  restore, mas falhou no estagio daily-layout-320-balanced do QA autenticado.
- Artifact autenticado baixado e inspecionado: relatorio sanitizado indica
  somente estagio routine-settings, sem causa detalhada. Runtime identico ao
  main aprovado na CI38581434699. Reexecucao do job falho solicitada como
  reproducao; nao equivale a diagnostico confirmado nem autoriza bypass.
- PR documental nao exige republicacao/reinicio. Novas mudancas visuais possuem
  autorizacao explicita de publicacao apos validacao.

## Validacao

- Lint aprovado, com warning preexistente em scripts/qa/connected-systems.mjs:18.
- Typecheck e build aprovados. API/fixture da Rotina: 88 testes aprovados.
- `pnpm test -- --maxWorkers=2` iniciado e interrompido apos falha externa ao
  escopo; o argumento atingiu o ultimo script encadeado, nao o Vitest.
  Reproducao focal de salesforce-inventory-api no Windows: caso symlink retorna
  200 onde o teste espera 502 (linha164). Nao equivale a aprovacao integral;
  exigir CI Linux completa, sem alterar esse teste para acomodar o host.
- Revisao independente: sem achados; contorno alinhado (0px) em scroll
  vertical/horizontal, resize1440/390, troca de funcao/modo/dia. Domingo remove
  o contorno; teclado e foco2px aprovados. Zoom via escala do Chromium, nao
  zoom nativo; nao substitui a matriz autenticada da CI.
- QA Chromium focal confirmou sincronizacao bidirecional, seletor e rascunhos,
  contorno unico, sticky e rolagem. Doze scans axe sem violacoes; capturas
  desktop/mobile revisadas. Ajuste final: texto branco puro nos titulos dark.
- Rodada final: 16 testes aprovados, zero falhas, 60 fora do filtro; mais quatro
  testes source aprovados em rodada propria (19 distintos no conjunto).
  Falhas iniciais de seletores/assercoes foram corrigidas sem retirar gates.
- Previa loopback reconstruida e inspecionada no Chrome pelo coordenador:
  checkbox sintetico confirmado apos resposta assincrona e refletido em Hoje.
  A acao check do driver reportou falha imediata, mas a leitura posterior
  confirmou checked=true sem segunda escrita. Nenhum dado real utilizado.
- ESLint focal, Prettier e typecheck repetidos apos os novos testes: aprovados.
- Nao alterar dados reais para validar layout; usar fixtures sinteticas locais.
- PR, CI completa, merge e publicacao ainda nao comprovados para este ajuste.
