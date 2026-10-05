# Correcao da paridade dos canvases protegidos — 2026-10-05

## Resultado

A implementacao anterior versionava e catalogava os 11 canvases aprovados, mas
o gate visual comparava a aplicacao somente com capturas produzidas pela propria
aplicacao. Isso permitiu que composicoes extensas fossem promovidas como
baseline mesmo sem corresponder aos canvases do usuario.

Este incremento corrige a composicao das 22 rotas protegidas e associa cada
rota, de forma executavel, a metade correspondente do canvas aprovado. A
validacao tambem rejeita novamente paginas desktop que retornem a densidade
extensa anterior. Os limites variam apenas quando a referencia aprovada contem
mais etapas verticais, como Agendamentos, Visitas, Pastas, Vendas,
Documentacao e CAIXA.

## Mudancas visuais

- Dashboard: remove do fluxo publicado os paineis analiticos posteriores ao
  canvas aprovado; preserva filtros, indicadores, funil, ranking e atividades.
- Etapas: preserva o hero das referencias de Agendamentos e Visitas, usa
  cabecalho compacto nas demais e omite o funil completo somente em
  Oportunidades, conforme o canvas aprovado.
- Ranking, Canal, Configuracoes e metas: reduz densidade no desktop sem reduzir
  alvos de toque no mobile. O Canal termina nos totais conciliados; paineis que
  nao fazem parte do canvas aprovado nao sao publicados.
- Simulacao: compacta hub e jornadas; CAIXA conserva CTA bloqueado e explicacao
  fail-closed. Documentacao usa tres etapas visuais sem alterar calculos.
- Administracao: home direta, seis usuarios e oito paginas por pagina, conforme
  as composicoes aprovadas. Guards e acoes continuam server-side.

## Seguranca e dados

- Uma unica navbar global e preservada; nenhuma subrota introduz outro shell.
- Guards, RBAC, APIs, RLS, autenticacao e rotas protegidas nao foram removidos.
- Dados continuam vindo dos loaders existentes. Ausencia de fonte continua
  explicita; nenhum numero do canvas foi usado como dado comercial.
- Nenhuma migration, grant, flag, motor, integracao ou dado remoto foi alterado.
- CAIXA continua apenas visual: motor, endpoint e CTA permanecem bloqueados.

## Validacao

- A matriz autenticada cobre 22 rotas, sete viewports, tres temas, zoom,
  teclado, foco, reduced-motion, Axe e ausencia de overflow/erros de console.
- A baseline autenticada foi promovida localmente em `2026-10-05T07:40:51Z`:
  154 cenarios responsivos, 88 de tema, 209 auditorias Axe, 209 comparacoes e
  110 verificacoes de zoom, sem falhas. A promocao atomica preservou o
  manifesto e o resultado anteriores para rollback.
- A navegacao dos quatro simuladores cobre 320, 375, 390, 600, 601, 768, 1024,
  1180, 1181 e 1440 px: 40/40 cenarios passaram. O Tabelao tambem oculta no
  modo de impressao os controles do novo cabecalho, preservando somente o
  conteudo expansivo e legivel.
- Formatacao, lint, tipos, testes, build e release E2E permanecem gates de
  publicacao. Os resultados finais e o SHA publicado sao registrados no
  `WORKLOG.md` apos CI e deploy.
