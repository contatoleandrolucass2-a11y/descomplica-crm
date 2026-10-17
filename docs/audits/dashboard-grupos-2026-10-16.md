# Dashboard: grupos comparativos em 16/10/2026

## Escopo

- Funis em grupos3/5/5: metas, periodos do mes vigente e historico.
- Semana anterior e ontem recortados no inicio do mes vigente.
- Media venda calculada com a media anual precisa dividida pela media anual
  de vendas. Denominador zero ou ausente continua indisponivel.
- Filtros fecham por clique externo, Escape, foco externo e abertura de outro.
- Diagnostico, tabelas operacionais, equipe e ranking removidos deste dashboard.
- Sem mudanca no banco, coletor, n8n ou regras comerciais de metas.

## Evidencias locais

- `node scripts/qa/dashboard-report.mjs`:200 verificacoes aprovadas, zero
  falhas; captura entre21:29:45Z e21:36:34Z. Tres temas, larguras320/390/768/1440/1920,
  dados sinteticos, indisponibilidade, valores grandes, historico, filtros,
  normalizacao por venda e atualizacao automatica.
- Relatorio local ignorado:`test-results/dashboard-report/report.json`.
  Captura iniciou antes do commit8ec9da73, com HEAD1c91e0c; hashes de fontes
  comprovados inalterados durante a matriz. Nao usar HEAD inicial como versao publicada.
- Capturas desktop e mobile examinadas nos tres temas. Sem cortes ou
  sobreposicao nos trechos inspecionados; medicoes de overflow aprovadas.
- Build local aprovado; lint e typecheck aprovados na retomada.
- Vitest:3670 aprovados e91 skips. Dois timeouts ambientais anteriores em
  DevTools passaram isoladamente e na repeticao completa de Vitest.
- `pnpm test` local nao concluiu: a etapa Node falhou na preparacao de ACLs
  privadas Windows em `ops/salesforce/publish-candidate.node-test.mjs`.
  Nenhuma ACL ou teste foi relaxado. A etapa validate da CI Linux38970011556
  passou, incluindo o comando completo e os testes de release/flock.
- Revisao independente somente leitura do diff1c91e0c..8ec9da73:zero achados
  comprovados. Limite:teste de refresh exercita pulso semanal, nao atualizacao
  automatica dos novos periodReadings; filtros e calculos possuem testes separados.

## Estado da entrega

CI38972729758 aprovou validate, restore e E2E apos a correcao da jornada.
Matriz autenticada parou em dashboard-auto-refresh, sem produzir comparacao
visual completa. O teste exigia filtro aberto apos clique externo; expectativa
alinhada ao fechamento solicitado, preservando verificacao de selecao e RSC.
Leitura dos titulos passa a ignorar dialogs fechados. Artefato12077459977,
SHA256a30a62f9f6f6b0283170e4d5997be89a38d7eedf13085e2f72a5ca54c08708ab,
nao elegivel para promover baseline. Nova CI obrigatoria.

PR245 e CI38970011556. Validacao principal e restauracao aprovadas. E2E falhou
por ainda exigir diagnostico e tabelas removidos; jornada ajustada para13 funis,
78 etapas, ordem3/5/5 e ausencia das secoes retiradas. Nova CI, referencias visuais
e publicacao ainda pendentes neste registro.
Main34517ba2 integrada localmente emc20d0dc7, sem conflitos. Arvore local e
merge de teste refs/pull/245/merge coincidem emd75318ac599d8dd0660a65d4ad2eab268376b77b.
Nao publicado. A matriz local nao prova rota autenticada, RLS nem deploy.
Reavaliar pendencias com os resultados finais da CI e versao publicada.
