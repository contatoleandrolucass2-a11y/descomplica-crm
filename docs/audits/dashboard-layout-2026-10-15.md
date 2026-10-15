# Auditoria de layout do dashboard em 15/10/2026

Status: implementacao visual em PR, sem publicacao. Filtros pendentes.

## 2026-10-15: Filtros e organizacao visual do dashboard

- Abertura13:56Z: Git comum confirmado; checkout inicial15bbfaa limpo,
  PR228 documental aberto. Nova branch codex/dashboard-filtros-layout parte
  de mainad496340cf57871c8fa80015aaaf0e0bd1da983c; CI38640654844 aprovada.
  GET publico /api/health HTTP200, statusok, version6843ef1 em13:56:19Z.
  Main e publicado diferem; nao atribuir o novo pedido a nenhuma dessas versoes.
  Fontes: git fetch, GitHub branches/main, PR228, Actions e health sem sessao.
- Pedido: remover tres textos indicados, incluir quatro filtros reais e rever
  roscas, diagnostico e comparativos nos tres temas. Referencia externa somente
  leitura; acesso via ferramenta web indisponivel, conferir pelo navegador.
  Context/search executados. Limite anterior de dimensoes exige confronto com
  contrato atual antes de oferecer filtros; nenhuma migration ou coleta
  remota autorizada implicitamente pelo pedido visual.
- Referencia acessivel posteriormente pelo navegador, somente leitura. Os
  quatro controles sao multisselecao pesquisavel. Usuario esclareceu que a
  base e geral e o recorte atende a gestao; isso nao confirma equivalencia
  semantica entre responsavel/corretor ou empresa/imobiliaria.
- Investigacao do contrato vigente: dashboard legado v2 contem tres visoes
  agregadas e nao permite os quatro recortes solicitados. V3 possui parte da
  infraestrutura, mas nao entrega todos os comparativos e vinculos deste painel.
  Nao simular filtragem de totais, inferir identidades por nome ou ativar fonte
  sem cobertura, autorizacao e validacao de servidor. Rever ao disponibilizar
  contrato dimensional completo; base geral continua sujeita aos acessos.
- resources:doctor confirmou Node, pnpm, Chromium e CLIs; Docker indisponivel.
  Banco/RLS e matriz autenticada isolada dependem da CI, nao de producao.
- Implementacao visual local: textos removidos, DashboardPulse e
  DashboardComparisons integrados e ritmo/diagnostico reorganizados. Fonte
  sintetica permanece em atributo tecnico para QA, sem texto visivel.
  QA 124/124 nos tres temas e larguras320/390/768/1440/1920; dados sinteticos,
  nao comprova leitura autenticada ou publicacao. Inspecionados screenshots
  de roscas, diagnostico e tabelas, desktop claro/escuro e celular medio.
- Lint (aviso previo), typecheck e build aprovados. Suite Windows:
  2897 aprovados/85 ignorados/2 falhas, symlink no estoque e timeout DevTools.
  Symlink reproduzivel pela ausencia de O_NOFOLLOW no Windows, fora do escopo;
  nao reduzir assercoes. Etapas Node posteriores nao rodaram. Reavaliar em
  CI Linux completa; falhas de gate bloqueiam publicacao.
- Contrato e limites dos filtros: docs/dashboard-dimensional-filters.md.
  Nenhum endpoint, schema, permissao, coletor ou workflow alterado.

## Verificacao posterior

- PR230 draft: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/230
  HEAD bbcca1b9e741222810fadad404a99f92d8c166f7.
- CI38751246231 em andamento na consulta14:26Z; nao valida um candidato
  antes de concluir. Main ad496340, publicado6843ef1 conforme health publico
  HTTP200/ok em2026-10-15T14:26:01.1485863Z. Sem merge ou deploy.
- 49 testes focados aprovados. Revisao estatica independente sem achados
  acionaveis: conteudo, semantica de tabelas, nulos/zeros e escopo preservados.
- DevTools isolado24/24 em10,55s. Timeout anterior nao reproduzido;
  contencao e hipotese, nao causa comprovada. Falha symlink estoque reproduzida.
- Capturas e report.json locais em test-results/dashboard-report, sinteticos.
  Preview local127.0.0.1:58782 usa somente fixtures e nao comprova dados reais.
- Sync automatico do commit bbcca1b falhou: Documento excede o limite de
  exportacao. ATUALIZACOES tinha256306 bytes e limite256000. Esta entrada
  integral foi preservada aqui; sintese vinculada na nota principal.
  Nenhuma autoridade, limite ou historia anterior foi alterada. Confirmar
  sync antes de encerrar; arquivo de auditoria nao e exportado integralmente
  pelo runtime, mas sua referencia e a sintese constam do documento exportado.
