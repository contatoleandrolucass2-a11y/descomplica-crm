# Historico de conhecimento da replica do dashboard

Texto integral movido de docs/knowledge/ATUALIZACOES.md em14/10/2026 para manter
seu limite de sincronizacao. Datas e estados abaixo sao historicos, nao evidencia
atual. Nenhuma autorizacao ou regra foi ampliada.

## 2026-10-13: Replica informacional do dashboard legado

- P2 do PR213 confirmado: ingestao sem ranking pode reutilizar generatedAt.
  Leitor da equipe agora exige updated_at coincidente entre os dois headers,
  alem da releitura/original. Duas regressoes reproduziram o erro antes do fix.
  Fontes: comentario4265923448, secure_salesforce_ingestion.sql e set_updated_at
  (now() transacional). Sem alteracao da RPC, schema ou ingestao remota.
- Consulta14/10 02:44Z: CI38498361779 do candidato d67a855 aprovou validate,
  restore e E2E. Predicado funcional original:154 responsivos,88 temas,242 Axe,
  110 zoom e22 canvases aprovados. Gate visual falhou somente em11 imagens /app.
  Fonte: artefato11865597980, hash e captura registrados em reference-parity/README.
  Revisao visual e promocao transacional preservaram231 imagens e limiares1%/16.
  Excecao: captura dirty, mas fingerprint reproduzido exatamente com diff vazio
  e19 arquivos QA gerados. Registro preserva o valor original; validade limitada
  a esse artefato, reavaliar toda futura captura. Nova CI verify/merge/deploy
  pendentes; baseline promovida nao equivale a CI candidata aprovada.
- PR213, candidato4484d72, CI38497027352: validate e isolated-restore passaram.
  QA dedicado tambem aprovado em Linux; E2E falhou ao procurar o titulo antigo
  Dashboard comercial. Tres expectativas atualizadas para o titulo solicitado,
  mais verificacao de secoes/tabelas, sem mudar permissoes. Matriz visual nao
  executou nessa tentativa. Fonte: logs do job115635936612, consulta14/10 01:53Z.
  Publicacao segue bloqueada ate nova CI completa e revisao de baseline.
- Pedido confirmado: manter em /app as informacoes e secoes de
  https://descomplicapro.com.br/?synced=2026-08-07T04%3A04%3A27.433%2B00%3A00,
  usando dados atuais do CRM. Origem inspecionada pelo navegador; sua data de
  agosto nao sera copiada como dado atual. Destino anonimo redirecionou a login.
- Branch codex/dashboard-referencia-completa criada de main0fdbb80; nota de
  abertura preservada. Fonte: DOM da origem, dashboard/data.ts, presentation.ts,
  transform.mjs e migrations versionadas. Sem leitura de dados privados remotos.
- Seis blocos do comparativo mensal, pulso das cinco etapas, diagnostico,
  quatro tabelas operacionais e estrutura comercial compoem a referencia.
  SHOW_EXTENDED_DASHBOARD ocultava parte do conteudo existente no destino.
- Limite confirmado: agregados v2 nao conservam gerente, responsavel ou empresa
  para filtrar o funil. Visoes autorizadas por canal e periodo continuam validas;
  nenhuma promocao do shadow v3 ou alteracao de grants/ingestao esta implicita.
- Contagem por gerente pode usar participantes do ranking sob sessao/RLS e
  crm.ranking.view, somente na visao global e com geracoes coincidentes.
  O vinculo deriva do snapshot legado, nao de cadastro oficial de equipes.
  Pontuacao e politica comercial permanecem bloqueadas conforme contrato atual.
- Relatorio implementado com read models atuais, sem numeros da referencia.
  QA sintetico aprovou 65 verificacoes e 21 capturas nos tres temas e larguras
  390/768/1440. Tipos e build passaram; revisao encontrou e corrigiu reingestao
  com mesmo generatedAt, comparando tambem updatedAt original do dashboard.
- Limite Windows comprovado: pnpm test falha no teste preexistente de symlink
  do estoque. O_NOFOLLOW e indefinido neste host; arquivos envolvidos iguais a
  origin/main 0fdbb80, origem PR210. Coletor e release rodados separadamente
  passaram, com skips de plataforma. Nao houve supressao; CI Linux obrigatoria.
  Causa, evidencia e criterio de revisao: auditoria dashboard-reference-2026-10-13.
- Docker local indisponivel; resources:doctor confirmou runtimes, Chromium e
  CLIs requeridos. Matriz autenticada depende da CI isolada. GitHub main
  reconferido em 14/10 as01:38Z continua0fdbb80; nenhuma integracao/publicacao
  desta demanda ocorreu. Preview local contem somente fixtures sinteticas.
- CI, revisao da baseline, merge e publicacao pendentes. Metas, ritmo esperado e plano
  de acao sem autoridade disponivel permanecem identificados como indisponiveis.
  Reavaliar dimensoes quando a fonte escopada e identidades estiverem aprovadas;
  esta nota nao concede autorizacao para migrations ou operacoes remotas.
