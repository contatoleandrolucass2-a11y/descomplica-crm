## 2026-11-01: abertura da página Equipe Produtiva

- Escopo: nova página com filtros comerciais existentes e quatro indicadores de
  corretores com agendamentos, visitas, pastas e vendas; acesso no menu lateral
  das etapas do Dashboard. Fontes: prints fornecidos e contratos atuais.
- Git comum confirmado; checkout inicialmente destacado e limpo em
  `0dab1578063eece6b9b5c86fa184c722388578fb`, igual a `origin/main` após fetch.
  Trabalho na branch `codex/equipe-produtiva`.
- Consulta em 01/11/2026, 23:02 (America/Sao_Paulo): health público HTTP 200,
  status `ok`, versão `332a37c375665480076fe9c167033677845207ec`, diferente do
  checkout. Fonte: https://crm.descomplicapro.com.br/api/health.
- GitHub: conector consultou runs de PR do SHA local e retornou lista vazia;
  isso não comprova CI aprovada nem reprovação. CLI `gh` ausente do PATH.
  Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm.
- Conhecimento pertinente recuperado no repositório e Obsidian: o denominador
  existente usa o cadastro vigente filtrado; período recorta fatos comerciais.
  Confirmar esse contrato no código antes de reutilizar. Nenhuma ingestão ou
  alteração remota autorizada por essa consulta.

## Implementação e validação local

- Página e sidebar implementadas no escopo pedido. Reuso do card e calendário
  existentes preserva o comportamento anterior de Agendamentos. Cadastro e
  presenças seguem a autoridade dos relatórios comerciais já coletados.
- Permissão `crm.productive_team.view` e RPC `read_crm_productive_team(text)`
  independentes: sessão, página ativa, permissão e visão autorizada. Retorno
  sanitizado remove conta, ranking, empreendimento, loja e valores financeiros.
  A leitura STABLE usa uma geração consistente para fatos e cadastro.
- Cálculos: 11 testes aprovados; loader: 11; apresentação: 3; navegação, recursos
  e regressão de Agendamentos: 36 testes aprovados em Node 24.19.0.
- Preview Chromium sintético: seis cenários, três temas em 390/1440 px, nove
  interações, axe sem violações e sem overflow; inclui calendário por teclado,
  limpar, zoom 200%, zero real e indisponibilidade. Evidência local ignorada:
  `test-results/productive-team-preview/evidence.json`. CSS Vite não comprova
  runtime Next autenticado nem banco remoto.
- pgTAP preparado com 23 asserções; execução local indisponível sem Docker.
  CI do candidato deve validar banco/restore e demais gates antes de integrar.
- Migrations locais: `20261102020840_productive_team_read.sql` e
  `20261102020921_sync_page_catalog.sql`; `pages:check` aprovou 50 páginas.
  Ativação remota exige autorização específica, backup e verificação; autorização
  permanente de deploy não inclui migrations remotas.
- Sync inicial falhou ao acrescentar a nota ao documento próximo de 256.000
  bytes. Somente a nota desta demanda foi movida integralmente para este arquivo,
  com referência no índice. Novo sync aprovou sete documentos. Nenhum histórico
  anterior foi resumido ou apagado; reavaliar particionamento em demanda própria.
- ESLint local inicialmente encontrou patch versionado ausente na instalação
  concorrente de dependências. Reaplicado somente o patch já aprovado ao pacote
  local ignorado, preservando lockfile e dependências; lint e tipos aprovados.
- GitHub confirmou PR463 integrado em `0dab1578`; CI main41375044989 ainda em
  andamento na consulta. Fonte: API pública do GitHub e PR463. A diferença com
  produção `332a37c3` corresponde a esse PR; não prova publicação desta demanda.

- Regressão real da sidebar Chromium aprovada: navegação, hover, foco, toque,
  zoom e geometria; destinos autorizados aparecem nas páginas do Dashboard.
  Teste atualizado somente para o novo item e para o alcance pedido do menu.
  Revalidação de navegação e apresentação: 25 testes aprovados após ajustes.
- Revisão independente de SQL, loader e integração não encontrou achados
  acionáveis. Build Next local aprovado, com dois avisos preexistentes de tracing
  Lead+ fora do diff; nenhuma correção incidental realizada.

## Dependências comprovadas pela primeira CI

- PR465, candidato `bef128a4`: CI41376879945 falhou em 15 asserções de inventários
  diretamente afetados pela nova página/permissão/migrations; 4.766 testes
  passaram e 112 foram ignorados. Gate bloqueado, sem merge nem publicação.
  Captura41376879955 parou no catálogo REST divergente pelo mesmo novo acesso.
- Ajustes preservam asserções estritas: 50 páginas, nova permissão somente nos
  conjuntos de Admin/Master, 100 migrations e 2.383 asserções pgTAP em 45 arquivos.
  As duas versões novas foram acrescentadas somente à lista não implantável
  pelo fluxo histórico Auth/MFA, sem mudar hashes, candidatos ou resultados
  antigos. Não há mudança de política de acesso de outra página.
- Revalidação focada das seis suítes que falharam: 130 testes aprovados em
  Node24.19.0. Os testes SQL do catálogo preservam planos e conjuntos dos demais
  papéis; execução real ainda depende da CI.
- Nova página recebeu contrato dedicado em `docs/qa/equipe-produtiva/README.md`,
  integrado como gate na matriz autenticada: CSS Next, sessão sintética, temas,
  desktop/celular, axe, teclado e zoom. Os 22 canvases históricos e suas baselines
  permanecem preservados. Verificação sintática e lint aprovados; execução remota
  isolada da nova CI ainda pendente.
