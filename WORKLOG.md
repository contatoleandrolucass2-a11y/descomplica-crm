# Worklog

## 2026-10-08: Sessao verificada e coleta Salesforce protegida

- Layout de Conectar Sistemas alinhado ao canvas compacto da Tabela Associativo,
  mantendo permissoes, temas, links oficiais e os sete reports da fonte atual.
- Status autenticado do coletor com prova de API, expiracao em 120 segundos,
  contagens e publicacao confirmada separadas do login. Sem senhas/cookies no CRM.
- Coleta com lock entre processos, prazo total, retries limitados de GET e
  rejeicao de resultados truncados ou estruturalmente invalidos antes do envio.
- Sem migration ou alteracao de dados remotos. n8n MCP indisponivel neste chat;
  workflow nao alterado por REST nem ativado. Sessao dedicada, host permanente,
  pareamento do monitor e primeira carga reconciliada continuam pendentes.
- Lint, typecheck, build (45 rotas), inventario e Gitleaks aprovados. QA
  sintetico: nove combinacoes de tema/largura, zoom 200%, seis estados,
  polling/timeout/cleanup e Axe aprovados; 21 testes Vitest focados e 13 Node
  de monitor/agenda aprovados. Revisao independente encontrou corrida de I/O
  no cancelamento, corrigida aguardando escrita/limpeza antes de liberar o lock.
  Os 36 testes de extracao/retry/lock passaram em serie, incluindo regressao A/B.
- Suite Windows: 2.259 aprovados, nove falhas e nove skips; seis falhas POSIX
  preexistentes e tres timeouts. Reteste isolado Obsidian/DevTools passou 46/46.
  Node integral manteve oito falhas Windows em testes preexistentes; CI Linux
  deve validar o SHA final integral antes da publicacao da aplicacao.
- Nao confundir entrega do codigo com ativacao operacional da integracao.

## 2026-10-08: Validação visual de Conectar Sistemas

- CI 37720363346 aprovou validate, restore (1.104 pgTAP antes/depois), E2E
  dos oito perfis e todos os critérios funcionais do QA visual. Restaram somente
  onze diferenças intencionais da nova entrada em Configurações.
- Artefato 11526388631 e captura limpa f3a209d, com árvore igual a 4a21e26:
  154 checks responsivos, 88 de tema, 242 Axe/comparações e 110 de zoom.
  Nove cenários específicos da nova guia sem overflow ou violações Axe.
- Inspeção das imagens e promoção transacional das onze referências; 231
  imagens e limiares 1%/16 preservados. Verificação final da CI ainda exigida.
- Reexecução local: lint, tipos e build aprovados; 66 testes focados aprovados.
  Suíte Windows: 2.247 aprovados, seis falhas POSIX em arquivos intactos e nove
  skips. A suíte Linux da CI passou, sem relaxar os testes POSIX.
- Comparação com produção aad1536 confirmou ausência de novas migrations.
  Publicação usa imagem imutável da CI, backup, CAS/lock e rollback, sem rebuild
  na VPS. Evidência final de versão e health será registrada no PR #172.
- Primeira carga Salesforce, MFA dedicado e ativação da agenda continuam
  pendentes; nenhum workflow n8n ou dado remoto foi alterado.

## 2026-10-08: Correções dos gates do PR #172

- CI 37718756017 aprovou validate, restore isolado, banco e build. O E2E
  encontrou o menu esperado sem a nova guia; matriz atualizada para 25 rotas,
  com acesso de Master/Admin e bloqueio dos demais perfis.
- Revisão independente confirmou contraste insuficiente nas mensagens do
  refresh em temas claro/médio. A nova página usa o token analytics-muted;
  demais consumidores preservam a aparência anterior. Testes cobrem mensagem
  indisponível e região de feedback dinâmico.
- Revalidação e publicação pendentes dos gates completos. Nenhum dado remoto
  ou workflow n8n foi alterado.

## 2026-10-08: Conectar Sistemas preparado para PR

- Portada a guia Salesforce sobre a main 089daa1, preservando a integração do
  PR #169 e excluindo os commits antigos de bootstrap Windows.
- Menu Configurações e rota protegidos por crm.settings.manage; refresh mantém
  crm.salesforce.refresh. Navegação suplementar segue Recurso MKT, sem migration.
- Estados da tela identificam configuração, não sessão ou agenda comprovadas.
- Lint, tipos e build aprovados; 60 testes focados em seis arquivos aprovados.
- Suíte integral Windows: 2.242 aprovados, 11 falhos e nove skips. O contrato
  visual da nova rota foi corrigido e revalidado nos testes focados; restaram
  seis falhas POSIX e quatro timeouts em arquivos intactos da main. Os timeouts
  não repetiram com dois workers: 61 aprovados e um skip em três arquivos. A suite
  Node Salesforce também registrou oito falhas de arquivos/permissões/execução
  no Windows; o código do coletor permanece idêntico ao PR #169.
- PR #172 aberto como rascunho. CI Linux 37718470536 aprovou o job validate
  no SHA 38946ef: formato, lint, tipos, testes, audit, compressão e build.
  Banco, restore e navegador ainda pendentes. Matriz autenticada ganhou
  nove capturas previstas (três larguras, três temas), overflow e axe.
- Primeira coleta, validação autenticada e ativação remota permanecem pendentes.

## 2026-10-07 - Teste portátil do Chrome dedicado

- O teste de descoberta do executável passou a controlar a inspeção de arquivos,
  eliminando a dependência acidental do Chrome instalado no runner da CI.
- Escopo restrito a injeção de dependência para teste; descoberta e validação em
  runtime permanecem fail-closed.

## 2026-10-07 - Publisher Salesforce para n8n preparado

- Autoridade preservada: os sete reports Salesforce continuam sendo a fonte; o
  Route Handler server-side valida flag, contrato e Bearer n8n→CRM antes de a
  RPC transacional persistir o snapshot. Interface e n8n nao autorizam o banco.
- O publisher local nasce desligado e envia somente `.payload` por HTTPS. O
  Bearer origem→n8n vem de arquivo regular privado (`0600` no POSIX ou ACL
  owner-only no Windows), separado do Bearer n8n→CRM. So aceita confirmacao CRM
  `200/201`, `ok=true` e `requestId` igual.
- MFA permanece manual e intencional em Chrome/CDP dedicado.
  `pnpm salesforce:chrome` agora prepara perfil exclusivo, janela visivel e
  CDP loopback na estacao grafica, recusando root, host sem tela e porta ocupada.
  Uma aba do Codex nao pode ser reutilizada como CDP. A verificacao nesta VPS
  root/sem sessao grafica falhou fechado antes de abrir processo, como previsto;
  a coleta real ainda nao ocorreu.
- Os quatro comandos Salesforce carregam o mesmo `ops/salesforce/.env`, ignorado
  pelo Git. Caminhos absolutos nativos funcionam em Windows/macOS/Linux, a porta
  da URL e do launcher nao pode divergir e o candidato recebe protecao atomica
  owner-only adequada ao sistema. Chromium Snap foi excluido da descoberta
  porque resolver seu launcher simbolico quebra a selecao do aplicativo.
- O MCP n8n nao esta disponivel. Nenhum workflow remoto foi validado, atualizado,
  relido ou ativado, e REST nao foi usado como fallback. Refresh, primeira carga
  e agenda seguem desligados ate n8n completo, CDP dedicado e reconciliacao.
- Os gates documentais antigos de 229 e 1.099 pgTAP foram marcados como
  historicos; o sentinela do HEAD atual exige 1.104. A allowlist versionada da
  `service_role` contem tres RPCs de ingestao auditadas, nao somente Salesforce.
  Nenhum pgTAP remoto foi executado aqui.
- Escopo documental: runbook, inventario de integracoes, contratos de
  reconciliacao, conhecimento, changelog e worklog. Sem migration remota,
  ingestao, refresh, deploy, segredo ou commit.
- Verificacao: lint, tipos, 2.239 testes Vitest, 41/41 testes Node Salesforce,
  build de 44 rotas e inventario aprovados. A cobertura Node inclui launcher,
  sessao CDP, caminhos Windows, ACL, transformacao, scheduler e publisher; o
  comando real na VPS recusou root antes de iniciar Chrome.

## 2026-10-07 - Diagnóstico de cadastro e recuperação por e-mail

- A leitura agregada do Supabase produtivo encontrou 15 respostas `429` por
  limite de e-mail: cinco em `/signup` e dez em `/recover`. No recorte havia
  três cadastros e uma recuperação com resposta `200`, além de dois usos de
  link inválido/expirado. O mailer padrão ativo limita o projeto a dois e-mails
  por hora e não é adequado à entrega de produção.
- As 19 chamadas observadas a cadastro/recuperação chegaram ao Auth com um único
  IP remoto porque as Server Actions saem pela VPS. Isso não causou os `429`:
  `/signup` e `/recover` que enviam e-mail compartilham
  `rate_limit_email_sent` no projeto, sem divisão por IP.
- O candidato mantém Server Actions, callback canônico, sessão temporária e
  metadata dos aceites. Após a validação do formulário, signup e recovery dão o
  mesmo aceite público para sucesso, conta ofuscada, erro retornado ou exceção
  do provedor, fechando o oráculo de enumeração.
- `Sb-Forwarded-For` foi descartado: não resolve o limite combinado de envio e
  exigiria uma `sb_secret_` privilegiada sem benefício proporcional.
- A solução operacional escolhida é Resend SMTP em subdomínio de Auth com
  tracking desligado. Follow-up ficará em `relacionamento.*`, com domínio e
  chave separados, consentimento e descadastro próprios.
- Site URL e redirect de recovery foram corrigidos na documentação. O template
  remoto deve permanecer em `ConfirmationURL`/PKCE; promover `TokenHash` antes
  de provar scanners/prefetch pode consumir o link de uso único.
- A primeira CI do PR encontrou o advisory alto `GHSA-cjq9-62q9-8jv4` no
  Next.js 16.3.6. O runtime subiu para o patch oficial 16.3.8; o
  `eslint-config-next` 16.3.6 e seu patch de glob permanecem isolados porque não
  fazem parte da cadeia vulnerável.
- A migration `20260824230058_auth_mfa_legal_foundation` já está aplicada no
  projeto produtivo. Esta correção não adiciona migration nem altera grants,
  RLS ou dados. Lint, tipos, 2.248 testes Vitest, 41 testes Node, formatação e
  build de 44 rotas foram aprovados após o rebase. DNS, SMTP,
  `rate_limit_email_sent` e deploy ainda aguardam evidência e não são declarados
  concluídos. O limite só deve subir depois do domínio verificado, com cooldown
  individual de 60 segundos e proteção contra abuso preservados.
## 2026-10-07 - Correção do falso bloqueio no restore isolado

- A CI da `main` aprovou validação, E2E, matriz visual e imagem promovível da
  correção de cookies, mas o restore isolado parou antes de iniciar o Supabase
  com `Supabase config port 54327 must occur exactly once`.
- O `config.toml` continha uma única porta `54327`. O sorteio do bloco efêmero
  podia, porém, escolher esse mesmo número para uma porta processada antes; a
  substituição sequencial voltava a contar o valor gerado como se fosse fonte.
- A configuração agora valida as ocorrências no texto original e substitui as
  oito portas em uma única passagem. Assim um valor gerado nunca é processado
  novamente. O mesmo helper atende os dois ensaios de restauração.
- Um teste determinístico fixa `shadow_port` em `54327`, comprova que analytics
  recebe sua própria porta e preserva as validações de porta ausente ou
  duplicada. A publicação permanece bloqueada até a nova CI aprovar o restore.

## 2026-10-07 - Exceção de permissão delegável por Master

- A leitura agregada do Supabase produtivo confirmou 23 permissões e mostrou
  que o Master podia delegar 21; `crm.simulators.view` e
  `crm.simulators.execute`, ambas com `min_level = 100`, eram rejeitadas pelo
  teste de nível estritamente menor.
- O helper da aplicação e `public.can_grant_permission` passam a aceitar a
  igualdade de nível somente para papel `master`, desde que ele possua
  `permissions.manage` e a própria permissão solicitada. O alvo continua sendo
  validado separadamente e precisa estar estritamente abaixo do ator.
- A tela explica que `Herdada: negada` é o padrão do papel e que `Permitir`
  cria uma exceção individual sem promover o usuário. O Administrador não pode
  propagar uma permissão de nível Master recebida por override.
- Testes focados iniciais: 27 Vitest aprovados. O ensaio isolado em dois
  projetos PostgreSQL 17 aprovou reset das 45 migrations, 1.104 pgTAP na
  origem, backup/restore lógico, mais 1.104 pgTAP no destino, lint, advisors,
  owners, ACLs e fingerprint canônico equivalente. O fechamento local aprovou
  formato, lint, tipos, 2.049 Vitest, 15 testes Node, audit sem vulnerabilidades
  altas e build das 44 páginas. A matriz visual longa percorreu as jornadas de
  arquivo e gerou a captura de Usuários sem quebra, mas terminou por timeout de
  tema no Associativo 375 px; a CI limpa permanece como gate visual oficial.
  PR e publicação permanecem como etapas de fechamento.

## 2026-10-07 - Publicacao e prova final do Associativo

- PR #165 integrado; runtime publicado `4d7341218e02ad59cd89bfa2cf2c188d1188b7c8`.
- CI `37594420463` integral aprovada, incluindo banco, restore, imagem e QA
  autenticado. 2.235 Vitest e 15 Node aprovados; nove skips existentes.
- Imagem unica conferida por toda a cadeia de hashes e dois perfis isolados.
  Promocao com backup, lock, CAS e rollback preparado; sem rebuild na VPS.
- Health, versao, protecao anonima e exemplo historico na pagina publicada
  conferidos. Termino da obra veio do estoque e permaneceu somente leitura.
  Nenhuma proposta enviada/salva; screenshot local nao versionado.
- Registro documental posterior nao requer outro deploy nem reinicio da app.
  Fontes, digests, backup e limites da amostra constam no audit financeiro.
- Registro conferido localmente: formatacao, lint, tipos e build aprovados;
  2.232 testes Windows aprovados, seis skips e as mesmas seis falhas POSIX
  documentadas. A versao publicada foi validada integralmente na CI Linux.

## 2026-10-07 - Implementacao das formulas e data de termino da obra

- Fonte confirmada: `estoque_spc.data_termino_obra` corresponde a `completionDate`
  no proxy atual. Conferidos 2.243 pares identificador/data por checksum agregado,
  sem exportar estoque. Associativo exige fonte viva; demais telas preservadas.
- Mensais usam principal nominal, correcao inicial pelo calendario e VP pre/pos.
  Decrescente corrige blocos 3/4 e restos; cronograma usa as mesmas quantidades.
- Datas financeiras opcionais permitem conferir propostas historicas. Datas
  invalidas bloqueiam o resultado. Indicador/sugestoes usam `correctedProSoluto`.
- Adaptador TS reutiliza motor MJS; ajudas removem a deducao de anuais reajustadas.
- Novos oraculos sinteticos independentes; verificacoes e limites completos em
  `docs/audits/associativo-formulas-salesforce-2026-10-07.md`.
- Validacao e publicacao em andamento; nenhum dado remoto ou workflow alterado.
- Tipos/build aprovados, lint sem erros. Suite geral Windows: 2.168 aprovados,
  seis ignorados e seis falhas POSIX conhecidas; CI Linux exigida. Mais 243
  testes focados e 15 node:test aprovados; QA browser ampliado, pendente CI.
- CI `37577305243`: validate integral Linux, E2E, banco e restore aprovados.
  A continuidade parou em seletor ambiguo entre summary e ajuda; seletor foi
  delimitado ao expansor, assim como o botao de parcelas ao dialogo financeiro.
  Nenhuma assercao removida; repeticao integral obrigatoria antes da publicacao.
- Revisao independente detectou dois casos de datas historicas: entrada presa
  ao dia atual e busca sem opcao de aumentar somente a entrada. Data do calculo
  e da entrada agora sao independentes; sugestoes usam o calendario canonico
  para limitar novos sinais antes da mensal, sem apagar pagamentos existentes.
- Mais 25 regressoes de sugestoes e 13 de calendario; 416 testes de integracao
  e motores, 105 de sugestoes/aprovacao e 76 de paridade sintetica aprovados.
- CI `37581613136`: 2.224 testes Linux e 15 Node aprovados; banco, E2E e restore
  verdes. QA historico exigiu corrigir escopo relativo do seletor da entrada.
  Falha anterior e seletor corrigido reproduzidos em Chromium local sintetico.
- CI `37584281089`: as 12 etapas de continuidade passaram em 375 e 1440px.
  O erro de rede 503 injetado pelo teste foi contado como inesperado pelo
  harness externo. Classificacao agora exige mensagem/URL exatas, uma unica
  resposta sintetica e continuidade aprovada; outros erros nao sao excluidos.
- CI `37587316857`: continuidade e 40 navegacoes aprovadas. Outra verificacao
  antiga tentava iniciar proposta pelo snapshot antes do estoque vivo; ajustada
  ao contrato atual e com espera da resposta pendente no cleanup. Restore teve
  colisao de porta no runner, sem mutacao de producao. Nova CI integral exigida.

## 2026-10-07 - Auditoria das formulas Salesforce

- Investigacao sem alterar motores ou dados remotos. Inventariadas 1.120
  oportunidades em 24 empreendimentos; isso nao significa recalculo integral.
- Reconstrucao confrontada com 20 mensais lineares e 52 valores decrescentes;
  maior diferenca de bloco R$ 0,01. Datas individuais explicaram divergencias
  que nao eram resolvidas pela data geral do empreendimento.
- Documenta valor presente, carencia, particao equilibrada e capitalizacao
  de todos os blocos. Registra discrepancia entre periodos usados nos valores
  e segmentos visuais da fonte, sem escolher silenciosamente um total.
- Validacao matematica independente: 130.662 casos sinteticos, sem dados
  de clientes. Fonte e limites no audit de formulas Salesforce de 07/10/2026.
- Gates locais: lint (um aviso local), tipos e build aprovados. Testes:
  2.008 aprovados, seis falhos e seis ignorados; falhas POSIX/caminhos no
  Windows registradas no audit. Etapa node:test encadeada nao executada.
- Nenhuma proposta, workflow, politica ou aplicacao publicada nesta etapa.

## 2026-10-07 - Preferências de cookies sem sobreposição permanente

- O ensaio no navegador confirmou que a gravação existente fechava o painel,
  mas sempre a substituía por um botão global fixo. Falhas da Server Action não
  tinham estado pendente nem orientação visível, parecendo cliques sem efeito.
- Depois da primeira escolha, o componente global agora permanece sem saída
  visual. O gerenciamento foi movido para o menu da conta e para a Política de
  Cookies, preservando acesso posterior sem cobrir simuladores ou ações.
- A Server Action retorna sucesso ou falha recuperável; os formulários evitam
  envio duplicado, fecham no sucesso e mantêm o erro anunciado por tecnologia
  assistiva. A abertura foca o título e o fechamento restaura o acionador.
- Categorias essenciais e de segurança continuam obrigatórias. Nome, duração,
  `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS e separação dos consentimentos
  não mudaram.
- A prova no Chromium passou em `375x812`, `768x1024`, `1024x768` e
  `1440x900`: painel contido, zero overflow ou erro de console, ausência do
  atalho global, gravação, reabertura, fechamento e retorno de foco aprovados.
- Validação local: formatação, ESLint, TypeScript, 2.051 testes Vitest com seis
  skips condicionais, 15 testes Node Salesforce, build das 44 páginas,
  inventário de recursos, Gitleaks e `git diff --check` aprovados.
- A primeira CI preservava no E2E a expectativa antiga de um botão flutuante e
  falhou corretamente antes da matriz visual. O contrato passou a abrir o
  painel pelo controle contextual da Política de Cookies e a exigir contagem
  zero para o atalho antigo, sem relaxar a gravação ou a leitura do cookie.

## 2026-10-07 - Preparação da sessão manual Salesforce

- O modelo operacional foi fixado em Chrome dedicado com login e MFA manuais;
  não existe Connected App nem credencial de API própria da plataforma terceira.
- O exportador agora aceita CDP somente em loopback, recarrega exclusivamente a
  aba do workspace Direcional e lê o `sid` apenas da origem Salesforce exata.
  Redirecionamento para login ou ausência do cookie falha fechado sem persistir
  ou registrar seu valor.
- `pnpm salesforce:export:watch` executa uma coleta imediatamente e agenda as
  seguintes nos limites de cada meia hora, sempre aguardando o ciclo anterior.
  Falha de sessão permanece recuperável após nova MFA manual.
- O n8n remoto não foi alterado: o MCP correspondente não está disponível nesta
  sessão e a candidata continua sem credencial, agenda ou node HTTP externo. O
  observador gera somente arquivo local `0600`; ingestão e flags remotas seguem
  desligadas.
- Validação final: ESLint, TypeScript, 2.048 testes Vitest com seis skips
  condicionais, 15 testes Node Salesforce, build de 44 páginas, inventário de
  recursos, Gitleaks e `git diff --check` aprovados.

## 2026-10-07 - Matriz de acessos publicada

- O PR #159 foi integrado em `main` no merge
  `3bcc3c4a4ad892df4e127bb53a4a5696c9d6dbed`. A CI `37556958745`
  aprovou validacao, restore isolado, imagem promovivel e gates de release.
- Antes da mudanca remota, foi criado o backup logico privado
  `20261007T021140Z-rbac-prechange`, com papeis, schema, dados publicos e
  historico de migrations protegidos por modo `0600` e manifestos SHA-256
  aprovados. O backup fisico/PITR gerenciado nao estava habilitado.
- Com autorizacao especifica do responsavel, a migration de convergencia foi
  aplicada ao projeto `descomplica-crm-production`. O MCP registrou a entrada
  remota `20261007021254_reconcile_roles_dashboard_views_and_bulk_overrides`;
  o SQL aplicado corresponde ao arquivo versionado
  `20261005234936_reconcile_roles_dashboard_views_and_bulk_overrides.sql`,
  SHA-256 `9254cbc3d7ede37b38c90f5fc90c437fe542e95b8575863dd765fb94e2208c20`.
- A verificacao agregada confirmou a matriz dos sete papeis, zero grant herdado
  nos papeis aposentados, RLS por `view_key`, RPC em lote executavel somente por
  `authenticated` e ausencia de acesso direto de `anon`, `authenticated` ou
  `service_role` as tabelas Qlik brutas. As contas legadas permaneceram uma em
  `broker` e duas em `user`, sem leitura de identidade nem reclassificacao.
- A imagem imutavel foi promovida por compare-and-swap de `73b20d0` para
  `3bcc3c4`. O container ficou `healthy`, com zero reinicios e image ID
  `sha256:f6e968640a724c3a4b5a28e170b77812c9d8f645ba8018e5f900bbbee85871e4`.
  Health publico retornou o SHA novo; `/admin/usuarios`, `/app` e
  `/app/repasse` redirecionaram anonimos ao login, e Data API/RPC em lote
  negaram anonimos com HTTP 401. O rollback permaneceu preparado e nao foi
  necessario.

## 2026-10-07 - Integracao da matriz de acessos com Repasse

- A branch integrou a `main` `73b20d0`, que acrescentou a rota protegida
  `/app/repasse` e elevou o inventario E2E de 23 para 24 rotas.
- Repasse reutilizava `crm.partnerships.view` supondo que a chave fosse
  exclusiva de Master. Na nova matriz, Administrador, Coordenador e perfis
  Imob tambem recebem Parcerias; a integracao passou a exigir explicitamente o
  papel `master` junto da permissao no Proxy, navegacao, pagina e Server Action.
- O contrato dos oito perfis preserva Repasse com `200` somente para Master e
  `403` para todos os demais, sem retirar Canal de Parcerias dos perfis Imob.
  Os testes focados de pagina, acao, Proxy, navegacao e release aprovaram 79
  casos; a matriz dedicada de Repasse continua separada da baseline global.

## 2026-10-06 - Estabilizacao final da evidencia de acessos

- A CI `37532674180` aprovou validacao, restore isolado, migrations, 1.099
  pgTAP, advisors, build, 19 cenarios E2E e todos os contratos funcionais da
  matriz visual. A unica divergencia era a altura de `/admin/usuarios` em
  375 px: um e-mail sintetico ocupava duas linhas na CI e tres na referencia,
  deslocando a captura em 21 px.
- O cabecalho do usuario agora reserva exatamente duas linhas no mobile e
  limita o excesso sem alterar o texto acessivel. O teste de layout fixa esse
  contrato. Somente as referencias de Usuarios em 320 e 375 px mudaram; a
  captura de 375 px passou de 5.193 para 5.172 px.
- O ensaio local encontrou ainda uma corrida do Playwright ao responder uma
  requisicao que a navegacao ja havia encerrado. A interceptacao agora ignora
  somente `Route is already handled` e continua propagando qualquer outro
  erro. A espera de habilitacao dos campos do Associativo passou a explicitar
  60 s por etapa, cobrindo a latencia observada no host sem remover assercoes.
- A recaptura integral, executada sem processo concorrente no host, aprovou
  154 checks responsivos, 88 de tema, 242 de acessibilidade, 242 comparacoes
  visuais e 110 checks de zoom. A promocao foi transacional e as fixtures e a
  conta efemera foram removidas. O resultado identifica o commit de captura
  `2fbb35b`, confirma `worktreeDirtyAtCapture: false` e registra `passed: true`.

## 2026-10-06 - Integracao da baseline com a main

- A `main` avancou para `a89a93c` com a correcao anual e visual do Associativo.
  A branch integrou esse commit sem descartar a matriz de acessos; os conflitos
  ficaram restritos a historicos, lockfile e manifesto visual.
- O primeiro build incremental ainda continha o CSS anterior do Associativo,
  com atraso de 4,5 s entre os cards. Um build integral sem `.next` confirmou o
  CSS atual, sem o atraso, e a navegacao passou nas dez larguras de cada um dos
  quatro simuladores, inclusive 375, 1180 e 1440 px.
- A captura completa posterior sofreu timeout de teclado enquanto outro ensaio
  elevava a carga do host acima de 200. Nenhuma referencia foi promovida nessa
  tentativa. O manifesto combina explicitamente as duas promocoes limpas e
  disjuntas: 11 imagens do Associativo em `e0e0ce9` e 11 de Usuarios em
  `f1df3d6`; os hashes foram recalculados e 27 contratos passaram.
- A uniao registra sua proveniencia no proprio resultado. A CI limpa precisa
  recapturar todas as 242 comparacoes e permanece obrigatoria antes do merge.

## 2026-10-06 - Revisao visual da matriz de acessos

- A CI `37507333920` aprovou validacao, restore, migrations, 1.099 pgTAP,
  advisors, build e os 19 cenarios E2E. O unico bloqueio ficou na matriz
  visual de `/admin/usuarios`: as referencias anteriores terminavam antes da
  nova matriz completa de 23 permissoes.
- As onze capturas afetadas foram revisadas antes de qualquer promocao. A
  revisao encontrou os selos de acesso herdado comprimidos no modo somente
  leitura; a grade agora reserva a largura do selo no desktop e o move para
  uma linha propria no celular.
- O limite de densidade continua globalmente em 1.125 px e recebe uma excecao
  estreita de 2.500 px somente para a tela de usuarios, cuja altura medida foi
  2.486 px em 1440 px. Nenhum predicado funcional, de Axe, overflow, tema,
  teclado ou zoom foi removido.
- A recaptura limpa no commit `f1df3d6` aprovou 154 cenarios responsivos, 88 de
  tema, 242 auditorias Axe/comparacoes e 110 verificacoes de zoom. Somente as
  onze referencias de `/admin/usuarios` mudaram; as outras 231 imagens foram
  preservadas pelo promotor transacional.

## 2026-10-06 - Gates de release sincronizados com a nova matriz

- A segunda CI do PR (`37501848220`) aprovou validate, banco, build e advisors,
  mas bloqueou a publicação porque o ensaio de restore ainda esperava 1.042
  pgTAP e o QA RLS/E2E ainda provisionava os nove papéis antigos.
- O restore agora exige os 1.099 testes atuais. Os fixtures, escopos, páginas,
  menus, rotas diretas e negações foram atualizados para Master, Administrador,
  Coordenador, Gerente House, Gerente Imob, Corretor House, Corretor Imob e o
  estado interno `pending`.
- Os dois gates que sobem o build local passaram a usar o runtime standalone
  gerado pelo Next, com os mesmos diretórios `public` e `.next/static` copiados
  pela imagem produtiva.
- A jornada real local concluiu 19 cenários Playwright e um skip previsto. Os
  oito perfis atravessaram 23 rotas protegidas; recuperação, MFA, navegação,
  RLS, Canal de Parcerias, Ranking e simuladores mantiveram as fronteiras. O
  relatório final registrou nove identidades removidas, zero papel legado
  aprovado, oito negações anônimas e zero linha anônima.

## 2026-10-06 - Hardening da RPC em lote

- A revisão de segurança do diff confirmou uma janela concorrente entre a
  checagem inicial de `private.can_manage_user` e o lock do perfil alvo. No
  schema completo, o trigger já protegia escritas com linha; o ramo `inherit`
  sem override ainda podia registrar auditoria e sucesso fora do escopo atual.
- A RPC agora mantém o precheck e repete a mesma decisão imediatamente após o
  `FOR UPDATE`, antes de atividade, aprovação, hierarquia, overrides ou
  auditoria. O helper continua opcional para suportar o schema produtivo
  legado sem a foundation de escopos.
- Contratos focados aprovados: três Vitest e 57 pgTAP. Uma prova real com duas
  sessões no Supabase local moveu o alvo para fora do escopo enquanto o lote
  aguardava o lock; a chamada terminou em SQLSTATE `42501` e persistiu zero
  override e zero auditoria. O reset posterior removeu todas as fixtures.
- Fechamento local aprovado: formato, lint, tipos, inventário, segredos, build,
  1.980 Vitest, oito testes Node e 1.099 pgTAP; lint e advisors de segurança e
  desempenho do banco não encontraram problemas.
- A primeira CI do PR foi bloqueada no audit por advisories publicados para
  `source-map-js` 1.2.1 e `sharp` 0.35.4. A auditoria local atualizada também
  expôs o SDK MCP 1.30.1. O candidato sobe apenas para as primeiras versões
  corrigidas: 1.2.2, 0.35.5 e 1.31.0, respectivamente.
- `pnpm audit --audit-level high` passou sem vulnerabilidades conhecidas após a
  atualização. Formato, lint, tipos, 1.980 Vitest, oito testes Node, build,
  1.099 pgTAP, inventário e varredura de segredos foram repetidos e aprovados.

## 2026-10-05 - Papéis por canal e permissões em lote

- Pedido consolidado em sete papéis de negócio: Master, Administrador,
  Coordenador, Gerente House, Gerente Imob, Corretor House e Corretor Imob.
  `pending` permanece interno; oito papéis genéricos/descontinuados deixam de
  ser atribuíveis e perdem grants herdados.
- A matriz separa Geral, Com Canal Imob e Sem Canal Imob. Coordenador e perfis
  Imob veem Com Canal Imob e Parcerias; perfis House veem Sem Canal Imob e
  Ranking. Apenas Master/Admin veem Geral e administram acessos.
- A proteção de pares continua estrita: Administrador não cria, desativa nem
  altera outro Administrador e não modifica o próprio acesso. Ações exclusivas
  de Master e motores comerciais permanecem fechados.
- A tela de usuários passa a usar lista + detalhe e edição múltipla de exceções,
  com estados herdado/exceção explícitos e um único motivo por lote. A RPC
  correspondente valida todas as chaves e confirma ou reverte o lote inteiro.
- Preflight remoto somente leitura confirmou três contas em papéis legados
  (`broker` 1, `user` 2), sem ler identidades. Elas não serão convertidas por
  suposição; exigem reclassificação explícita para House ou Imob.
- Produção ainda não possui a foundation local de onboarding/escopos. A
  migration foi desenhada para o schema remoto atual e para o reset completo;
  nenhuma mutação remota foi executada.
- Gates locais aprovados: lint, tipos, formato, inventário, build, 1.980 testes
  Vitest + oito Node e 1.099 pgTAP. Jornada autenticada 1440×1000 no tema
  Escuro, com Corretor Imob selecionado, passou sem violações Axe. Cinco contas
  e escopos sintéticos foram removidos e a limpeza foi comprovada por contagem
  zero.

## 2026-10-06 - Consulta de repasse por FID

- Branch `codex/repasse-map`, base `a22f4dc`. A imagem fornecida pelo usuário foi
  tratada como referência visual, e a planilha como fonte de dados somente leitura.
- Contrato confirmado na aba `Table 1`: atualização em `A1` e colunas `A:F` para
  FID, empreendimento, etapa, status, nome do cliente e motivo. Nenhum dado real
  foi persistido em fixture, documentação ou artefato versionado.
- A guia fica sob o Dashboard autorizado e exige papel `master` junto de
  `crm.partnerships.view` no Proxy, na página, na navegação e na Server Action.
  O gate de release também é revalidado na ação. Assim o FID segue no corpo POST,
  não em URL ou referrer.
- O DAL consulta no servidor o datasource CSV público do Google, com documento,
  `gid`, `headers=0` e intervalos fixos, `no-store`, timeout de 8 segundos, leitura
  limitada a 200 KB, bloqueio de redirects, validação dos seis cabeçalhos e DTO
  mínimo. A primeira consulta traz apenas FIDs; B:F só é lido para uma
  correspondência exata, com releitura da coluna e revalidação do FID antes de
  associar os dados. O intervalo de FIDs é aberto até a última linha preenchida;
  excesso de bytes, linhas, colunas ou CSV inválido falha fechado. Duplicidade
  falha antes dos dados pessoais.
- A tela reutiliza tokens globais e troca tabela por blocos rotulados no celular.
  Claro, Médio e Escuro herdam superfícies, textos, bordas, foco e estados
  semânticos; cor nunca substitui o texto do status.
- Sem migration, dependência, escrita remota, alteração de conta ou mudança de
  compartilhamento. Em 06/10/2026, o responsável decidiu manter a planilha
  publicamente legível. O RBAC Master-only protege a jornada do CRM, mas não
  privatiza a origem externa; esse risco residual fica explícito no runbook.
- A jornada Repasse autenticada usou somente fixture loopback e aprovou `ready`,
  vazio, conflito, indisponível, teclado, ausência de overflow e Axe sem violações
  em 375/768/1024/1440 px nos três temas (12 combinações). Capturas inspecionadas
  sem dado real. A matriz global avançou aos simuladores e encontrou seleções de
  tema intermitentes fora desta rota no banco local adiantado; nenhuma baseline
  foi promovida e esse ensaio não autoriza publicação.
- Integração com `main` em `a89a93c` concluída no merge `c88ba5a`. Node 24.19.0
  e pnpm 11.20.0; lint, typecheck, 2027 testes Vitest, oito testes Node e build
  das 44 rotas passaram. Uma tentativa paralela de lint/tipos excedeu a memória
  do host (`137`); a repetição sequencial de ambos passou sem alteração de código.
- Diagnóstico de publicação confirmou a fonte acessível anonimamente. Como o
  responsável determinou que esse compartilhamento seja preservado, o adapter
  passou a usar o endpoint público e as variáveis `REPASSE_GOOGLE_*` foram
  removidas de Compose, validador, configurador e prova de imagem. Nenhuma
  permissão, conta, segredo ou dado remoto foi alterado.
- A revisão de segurança completa do diff público cobriu autorização, destino de
  rede, parser CSV, limites de recursos e retirada das credenciais, sem achado
  reportável. Três hipóteses foram validadas e descartadas como vulnerabilidade:
  consistência entre snapshots, amplificação finita de leituras e segredo legado
  inexistente no host. A suíte focada aprovou 39 testes.
- CI `37521773216`: `validate` e `isolated-restore` passaram; `release-gates`
  encontrou o inventário E2E global ainda em 23 rotas, embora o link Repasse já
  estivesse corretamente visível ao Master. O contrato foi atualizado para 24
  rotas, link Master 21, acesso direto Master `200` e negação `403` para os outros
  oito perfis, sem incluir Repasse na baseline visual global que possui contrato
  dedicado. Nova CI pendente.
- CI `37524840387`: `validate`, restore, banco, build e E2E das 24 rotas/nove
  perfis passaram. O QA dedicado chegou ao resultado sintético e falhou 12 ms
  depois de reduzir 1440 para 375 px, na primeira medição de overflow. Como a
  mesma matriz havia aprovado as 12 combinações e nenhum CSS mudou, o harness
  agora aguarda fontes e geometria estável por frames consecutivos antes de
  executar as mesmas asserts; não altera CSS, baseline ou tolerância. Falhas
  futuras registram apenas viewport, tema, dimensões e geometria sanitizada.
- CI `37532954767` aprovou `validate`, `isolated-restore` e `release-gates`,
  incluindo a matriz visual completa, no SHA `a06ebad4`. A mudança posterior
  para a origem pública aprovou localmente lint, tipos, 2.030 testes Vitest,
  oito testes Node, inventário de recursos e build das 44 rotas. Uma nova CI
  ainda é exigida antes do merge.

## 2026-10-06 - Publicacao do saldo e ajudas do Associativo

- PR #156 publicado no runtime `a89a93c07127b2ff1c5cdd4730a709fb1f973424`.
  CI final do PR `37511669464` e da main `37515245924` aprovadas integralmente.
- Mesma imagem comprovada por checksum, cadeia OCI/11 camadas e dois perfis
  de runtime. Sharp 0.35.5/librsvg 2.63.2 aprovados no container sem rede.
- Sobrecarga previa da VPS atrasou a preparacao; acesso e health recuperaram
  antes da troca. Nenhum processo ou arquivo de outro trabalho foi removido.
- Backup privado verificado, CAS da versao anterior e rollback preparados.
  Health novo e guards aprovados; 12 requisicoes observacionais sem erros.
- QA autenticado sintetico aprovado com 242 capturas; conferencia real no
  Chrome aprovada apos login normal. Incluir/retirar anuais desconta/restaura
  R$ 7.350,00, preservando Pro-Soluto e recalculando mensais/indicadores.
  Brilho documental usa o mesmo ciclo de 9 s, sem atraso. Nenhuma proposta
  gravada; teste removido ao recarregar. Registro documental posterior, sem
  nova alteracao ou reinicio de runtime.

## 2026-10-06 - Correcao do gate de seguranca

- CI `37506185905` aprovou lint/tipos/testes e bloqueou a auditoria com tres
  alertas altos novos. Publicacao interrompida antes de qualquer deploy.
- Sharp 0.35.5, source-map-js 1.2.2 e SDK MCP 1.31.0 instalados pelas versoes
  corrigidas dos advisories oficiais; lockfile gerado por pnpm 11.20.0.
- Auditoria sem vulnerabilidades conhecidas; protocolo dos dois DevTools e
  docs locais aprovados. 34 testes focados aprovados; nova CI completa pendente.

## 2026-10-06 - Validacao integrada do Associativo

- CI `37507557118`: todos os contratos funcionais aprovados com temas atuais e
  dependencias corrigidas. Captura `e0e0ce9a`, artefato `11435466969`: 11 imagens
  do cabecalho revisadas e promovidas; 231 preservadas por hash. Limiares intactos.
- Revalidacao local: lint/tipos/build, 2008 testes, oito Node e 34 focados passaram;
  seis limitacoes POSIX e seis condicionais no Windows, suite Linux aprovada.

- CI `37383133528` tentativa 2: validate/restore e gates funcionais aprovados.
- Artefato `11379134553`: 11 capturas revisadas da retirada dos tres rotulos;
  231 referencias preservadas por hash, sem alterar tolerancias.
- Revalidacao financeira: 7285 casos e 250197 comparacoes, zero divergencias.
- Lint/tipos/build, 15 testes focados, oito Node aprovados. Suite Windows com
  seis limitacoes POSIX e dois timeouts resolvidos isoladamente (22/22).
- Evidencias no audit de anuais e ajudas; CI final, merge e deploy pendentes.
- Integra `a22f4dc` (temas) sem mudar motores. Mantem integralmente a baseline
  dessa main para uma nova captura combinada; nao reutiliza imagens antigas
  para aprovar cores novas. Documentacao das duas entregas preservada.

## 2026-10-05 - Saldo das anuais e ajudas do Associativo

- Retomada da publicacao: CI Linux passou validate, banco, restore e E2E.
  Ajustado contrato de geometria para a retirada dos tres rotulos solicitados.
  Aside vazio nao e renderizado; regressao real preserva selos/acoes em outras
  tabelas e rejeita reintroducao dos elementos removidos. CI completa pendente.

- Fonte: cinco capturas do usuario; branch `codex/associativo-saldo-anuais`.
- Corrige o saldo exibido para descontar anuais nominais em centavos, sem
  deducao dupla nas mensais nem alteracao do Pro-Soluto e politicas vigentes.
- Remove os tres textos indicados, simplifica ajudas e ajusta a continuidade
  visual do brilho dos cards de documentacao.
- Audit: `docs/audits/associativo-anuais-e-ajudas-2026-10-05.md`.
- 33 testes iniciais e auditoria financeira de 364 testes aprovados. Gates
  globais, navegador, CI e publicacao pendentes.
- Lint, typecheck, build, oito testes Node e nove etapas do preview React
  aprovados. Suite Windows: 1997 aprovados, seis falhas POSIX e um timeout de
  conhecimento resolvido na repeticao isolada (22/22). CI Linux segue obrigatoria antes de publicar.
- Matriz sintetica: 7285 casos e 250197 comparacoes sem divergencias. Medicao
  do brilho no React real passou em 1440px e 375px; QA congela/restaura outras
  animacoes e conserva os limiares e a prova negativa dos keyframes antigos.
- As duas primeiras CIs passaram testes/banco/restore/autorizacao, mas bloquearam
  a metrica visual. Corrigida captura sem alterar rasterizacao da referencia;
  nove testes de efeitos, roteiro mobile real, lint e tipos passaram novamente.
- Terceira CI isolou ruido restante nos cantos mobile. Reproduzido localmente
  com CSS compilado/Geist; mascara passa a respeitar o pseudo-elemento arredondado.
  Nove testes, roteiro mobile com fonte real, lint e tipos aprovados.
- Integra a entrega concorrente `dcb88c9`, preservando o canvas e a troca de
  tema mobile; resolve cabecalho com apenas o titulo. Regressao integrada:
  83 testes aprovados e tres condicionais ignorados.
- Lint/tipos/build e roteiro React integrado aprovados. Suite Windows: 1998
  aprovados, seis falhas POSIX e timeout DevTools resolvido isoladamente (24/24).
  Oito testes Node aprovados. CI `37364639266` cancelada antes de iniciar por
  indisponibilidade de runner GitHub; PR #156 permanece sem merge/deploy.

## 2026-10-05 - Calibracao integral dos tres temas

- Branch `codex/theme-color-calibration`, base
  `dcb88c9eeaed7879ef364a1c7ef83a762e30f709`. Escopo exclusivamente visual:
  tokens globais, topbar e heranca dos canvases de Ranking, Canal e Configuracoes.
- Diagnostico: Claro e Medio tinham luminosidade quase identica; tres canvases
  redefiniam todos os tokens e permaneciam escuros independentemente da escolha.
  A causa foi removida sem trocar componentes, estrutura, loaders ou autorizacao.
- Paletas finais: Claro `#f3f6fa`, Medio `#d9e1eb` e Escuro `#061f35`; topbar
  escura `#071a31` e simuladores arquivados preservados. Destaques gerais usam
  azul/ciano; aviso e erro continuam semanticamente distintos.
- O primeiro ensaio detectou contraste insuficiente no texto secundario de
  Documentacao e depois nos preenchimentos azuis do Claro/Medio. Ambos foram
  corrigidos nos tokens de origem; nenhum waiver ou reducao de gate foi usado.
- Contrato novo confere luminosidade crescente, contraste minimo 4,5:1,
  identidade azul e ausencia de paleta escura local nos tres canvases.
- Matriz final validada pelo gate autenticado: 154 cenarios responsivos, 88 de
  tema, 242 auditorias Axe, 242 comparacoes de baseline, 22 comparacoes com os
  canvases aprovados, 110 verificacoes de zoom e 40 cenarios de navegacao dos
  simuladores. O resultado versionado e a fonte da contagem; nenhum predicado
  funcional ou de acessibilidade foi flexibilizado.
- Nenhuma migration, dependencia, segredo, conta remota ou dado comercial foi
  criado ou alterado. Integracoes e motores preservam o estado anterior.

## 2026-10-04 - Recurso MKT em Configuracoes

- Fonte: print fornecido pelo usuario; branch `codex/recurso-mkt`, base `2b713fa`.
- Nova guia no menu autorizado de Configuracoes e na visao geral, com guard de
  servidor e Proxy usando `crm.settings.manage`, sem migration ou ACL nova.
- Preserva fundo de R$ 2.500,00, custo de R$ 1.000,00, expectativa de duas vendas,
  percentuais 40/30/20/10, destinos e cinco conversoes do anuncio campeao.
- Reutiliza cabecalho, tokens e temas da Tabela Associativo. Ajustes de fundo e
  custo sao locais; expectativa conta vendas inteiras. Rateio em centavos mantem
  a soma exata; entradas ausentes ou invalidas ficam explicitamente pendentes.
- Lint, tipos, build e 62 testes focados aprovados. Suite Windows: seis falhas
  POSIX e tres timeouts existentes, alem da contagem de rotas corrigida e retestada.
- Preview isolado do componente real: 12 cenarios (1440/1024/390/320px, tres
  temas), Axe sem violacoes, recalculo, erros, restauracao e teclado aprovados.
  Ajustado nome acessivel do icone de expectativa. CI Linux e jornada autenticada
  em andamento no PR #152; publicacao ainda pendente.
- CI `37255127701`: validate e restauracao aprovados; matriz E2E antiga recusou
  o novo link. Incluida rota MKT nas provas diretas dos nove perfis e nas listas
  de navegacao de Master/Admin, sem ampliar permissao de outros perfis.
- CI `37255825356`: E2E dos nove perfis aprovado; QA MKT encontrou atalho sem
  nome acessivel no card de Configuracoes. Rotulo explicito corrigido e coberto
  por teste de renderizacao; capturas MKT tambem mascaram campos de identidade.
- CI `37257361148`: navegacao geral segue aprovada; falha curta no helper MKT.
  Diagnostico por etapas sem payload privado, seletor restrito ao card e espera
  explicita da URL para distinguir seletor ambiguo de transicao do router.
- Varredura adicional encontrou contrato de quatro itens em
  `archive-navigation.mjs`; incluido o quinto link MKT com as mesmas provas de
  nome, destino, clique e visibilidade em todas as larguras da matriz existente.
- CI `37258678938`: MKT autenticado passou nos 12 cenarios, valores, recalculo,
  erros, reset e teclado; restante bloqueado pelo contrato antigo de quatro
  links. `main` atualizado para `e1ab14a` e integrado preservando ambas as notas
  e as referencias revisadas do PR #150. Nova validacao combinada pendente.
- CI `37260367645` na arvore limpa `c81abd2` (identica a `1b68614`) aprovou
  lint, tipos, suite Linux, build, restore e E2E dos nove perfis. QA funcional:
  154 responsivos, 88 temas, 209 Axe, 110 zooms, 40 menus e 12 cenarios MKT.
  Somente oito referencias de Configuracoes divergiram com o novo card.
- Em 05/10, as oito capturas foram inspecionadas e promovidas pelo helper
  transacional existente, apos verificar arvore, predicado funcional e hashes.
  Outras 201 imagens e evidencias anteriores preservadas; limiares intactos.
  CI completa com as referencias atualizadas e publicacao ainda pendentes.
- CI `37263297496` aprovou todos os gates no head `393457d`.
  Enquanto se aguardava a CI, PR #154 alterou o layout e as referencias na main.
  Integracao de `afdb1c9` preserva o novo produto e os resultados desse PR;
  Configuracoes precisa de nova revisao visual na base combinada.
- CI `37309490617` em `af85930`: validate, restore, E2E e todos os criterios
  funcionais aprovados; 12 cenarios MKT sem overflow ou violacoes Axe. Somente
  oito referencias de Configuracoes divergiram. Captura limpa `7818dcf`, arvore
  identica ao head; oito imagens revisadas e promovidas preservando as outras
  201 referencias da main e todos os novos contratos de canvas. CI final pendente.
- Integra `89ac797` (registro documental do PR #153), sem nova alteracao de
  produto ou referencias. A validacao funcional anterior permanece identificada
  pelo seu SHA; os gates da CI serao repetidos no head combinado.
- Publicado em 05/10/2026 11:47 BRT: `edbfcd13`, depois dos gates completos
  do PR `37314518298` e da main `37322433490`. Imagem aprovada pela CI,
  identidade OCI/config/camadas comprovada, dois perfis validados, backup
  privado verificado, CAS e rollback preparados. Cinco healthchecks HTTP 200
  no SHA exato; container healthy, zero reinicios/OOM/padroes criticos.
- Nova rota anonima responde 307 para login. Prova autenticada permanece na
  CI sintetica; nenhuma conta pessoal usada para QA dessa guia em producao.
  Evidencias em `docs/audits/recurso-mkt-2026-10-05.md`. Registro posterior
  somente documental, sem novo restart; nenhuma migration, workflow ou dado remoto.

## 2026-10-05 - Publicacao das sequencias do Associativo

- Runtime `e1ab14a8739153c56081e4f36a76e99f80fed8b2` publicado apos PR #150,
  CI do PR `37257462975` e CI do main `37259237555` integralmente verdes.
- Imagem imutavel conferida por hashes, OCI e dois perfis; backup privado, CAS
  a partir de `77a07a7`, rollback preparado e health/negacao anonima aprovados.
  Smoke HTTP: 12 requisicoes observacionais, zero erros, sem prova de capacidade.
- Postcheck autenticado confirmou percentuais, documentacao, ciclos CSS,
  alinhamento do dolar e preservacao do perfil/recursos ao trocar unidade.
  Nenhuma proposta salva ou enviada. Evidencia completa no audit de 04/10.
- Pendencia do print 12 nesta conta: sessao nao forneceu nome valido; fallback
  Conta esta correto. Solicitados nome e autorizacao especifica para cadastro;
  nenhuma mutacao de conta nem inferencia pelo email.
- Este registro e apenas documental, sem outro restart ou mudanca de runtime.

## 2026-10-05 - Correcao da paridade visual dos canvases

- Diagnostico comprovado: as referencias estavam catalogadas, mas o QA visual
  comparava a aplicacao com baselines geradas por ela mesma. Dashboard chegava
  a 4.408px e Canal a 1.731px em 1440px, embora os canvases definissem uma
  composicao compacta.
- Branch `codex/canvas-layout-parity-hotfix`, base inicial `afdb1c9` e base final
  integrada `de57b6a`. Foram corrigidas as 22 rotas dos canvases sem alterar
  loaders, autorizacao, RLS, APIs, motores ou fontes. A 23a pagina protegida,
  Recurso MKT, foi preservada da `main` com sua matriz visual propria.
- Dashboard conserva somente filtros, indicadores, funil, ranking e atividades
  na composicao publicada. Canal termina nos totais. Etapas seguem as variacoes
  de cada canvas. CAIXA permanece fail-closed com CTA bloqueado visivel.
- O harness agora associa cada rota a um canvas e rejeita retorno a densidade
  extensa. Limites por rota representam as referencias verticais, sem reduzir
  requisitos de toque ou ocultar overflow.
- Gate visual local aprovado em `2026-10-05T17:33:34Z`: 154 responsivos, 88
  temas, 242 auditorias Axe, 242 comparacoes de baseline, 22 comparacoes com os
  canvases aprovados, 110 verificacoes de zoom e 40 cenarios da navegacao dos
  simuladores. A conta e as fixtures efemeras foram removidas pelo runner.
- CAIXA passou com contraste AA e mensagem explicita junto ao CTA bloqueado.
  O Tabelao passou responsividade, estados, teclado e impressao sem controles
  interativos. Nenhum motor foi habilitado.
- O E2E de release aprovou 20 cenarios e manteve um skip exclusivo de
  homologacao remota. Foram validados nove perfis, 22 rotas, APIs, filtros,
  logout, recuperacao, revogacao de sessoes e MFA AAL2; dez identidades
  sinteticas foram removidas e nenhuma persistencia permaneceu. Duas
  expectativas antigas foram alinhadas ao contrato vigente: ausencia do guia
  superior no Associativo e contagem apenas dos tres temas desktop.
- A captura combinada final em `8a15aa4`, `2026-10-05T18:32:51Z`, repetiu e
  aprovou 154 cenarios responsivos, 88 de tema, 242 auditorias Axe, 242
  comparacoes de baseline, 22/22 comparacoes externas, 110 verificacoes de
  zoom e 40 navegacoes. Recurso MKT passou separadamente em 12 combinacoes de
  largura/tema. Onze referencias de Configuracoes foram revistas e promovidas
  transacionalmente; as demais 231 permaneceram inalteradas.
- Evidencia: `docs/audits/canvas-layout-correction-2026-10-05.md`. Resultados de
  CI, SHA e deploy serao anexados ao fim da publicacao automatica.

## 2026-10-04 - Associativo: cadencia e sequencias visuais

- CI `37253579651`: validacao Linux, restore, E2E e contratos funcionais do QA
  aprovados. Candidato limpo `f8ea013c`: 154 responsivos, 88 temas, 209 auditorias,
  110 zooms e 40 navegacoes; 173 comparacoes visuais divergentes, 36 aprovadas.
  Revisao visual concluida: 173 referencias promovidas e 36 preservadas byte
  a byte, sem reduzir tolerancias. Nova CI em verify e publicacao pendentes.
- Diagnostico CI `37251923554`: Configuracoes interceptava o clique no tema
  Claro ao retornar ao Dashboard. A grade agora reserva o tamanho intrinseco
  da navegacao e dos temas; o nome respeita o espaco restante. A fixture local
  inclui os tres grupos expansiveis e verifica ponteiros com fontes diferentes,
  incluindo prova negativa do layout antigo.
- CI `37249431505` excedeu 360s no mesmo E2E de navegacao entre simuladores
  em duas tentativas. Sem assumir flakiness: preservar a falha original na
  limpeza do contexto e limitar acoes a 15s/navegacoes a 45s para diagnostico.
  Nenhum timeout ampliado, assert removido ou publicacao liberada.
- A CI `37245218837` aprovou validacao Linux, banco e restauracao, mas revelou
  menu cortado em 320px com nome longo. Menus agora descontam a altura real
  do pai posicionado, sem altura fixa ou observador JavaScript. Regressao
  verifica o ultimo item em 320/375/600/1180px; 28 testes focados passaram.
- CI seguinte `37247029738`: todos os gates funcionais visuais passaram
  (154 rotas responsivas, 88 temas, 209 auditorias, 110 zooms e navegacao).
  Revisao das capturas motivou ampliar o nome no desktop conforme o espaco
  disponivel; fixture de 34 caracteres usa no maximo duas linhas desde 1280px.
  Os 44 testes focados passaram, incluindo 126 geometrias e menus completos.
- Integracao posterior: PR #150 incorpora `77a07a7` (canvas do PR #148),
  mantendo ambas as mudancas. Preview combinado 6/6; 78 testes do cabecalho e
  126 geometrias. Nome longo pode ampliar apenas o espaco necessario do cabecalho.
- Badges do fluxo e do estoque mobile respeitam suas colunas de 30/28px;
  o novo QA rejeita sobreposicao entre badge e titulo.

- Fonte: doze capturas do usuario; branch `codex/associativo-animacao-sequencial`,
  base `a4a9ef5`. Escopo visual; nenhum motor, taxa ou origem financeira alterado.
- Brilho branco/dourado mais fino e ciclo de 4,5s. Relogio comum preserva a
  sincronia das selecoes e CTAs quando novos elementos sao montados.
- Bordas sequenciais: contorno externo e nove informacoes do imovel; Linear e
  quatro blocos Decrescentes. Plano sugerido e composicao recebem brilho em
  sequencia. Filtros nativos recebem reflexo no hover/foco; guias e pagamentos
  opcionais habilitados mantem loop continuo. Movimento reduzido e respeitado.
- Dolar movido para fora da borda do resumo, no espaco interno do painel de fluxo,
  alinhado a ultima data; resumo e aprovacao conservam as mesmas bordas.
- Breadcrumb removido somente no Associativo. Menu da conta usa o primeiro nome
  cadastrado integralmente, com fallback Conta quando nao houver nome valido.
- Validacao local: 6/6 jornadas visuais, 47 testes focados dos efeitos e 76 do
  cabecalho; 126 cenarios de geometria/nome. Suite geral: 1926 aprovados,
  quatro skips condicionais e seis falhas POSIX no Windows, aguardando Linux.
  Lint, tipos, build e audit aprovados; evidencia e limites em
  `docs/audits/associativo-sequencias-2026-10-04.md`.

## 2026-10-04 - Associativo: cobertura da origem e brilho integral

- Fonte: nova conferencia solicitada pelo usuario, branch
  `codex/associativo-origem-e-brilho-integral`, base `3e0f5d1`.
- Leitura observacional do snapshot: 3301 registros, 3179 unidades visiveis,
  84 sem andamento e 594 sem avaliacao positiva; entre as 2865 selecionaveis,
  280 sem avaliacao positiva. As duas unidades apontadas ja chegam sem ambos.
- Percentual oficial ausente pode ser informado explicitamente nesta simulacao;
  zero e valido, vazio e invalido permanecem indisponiveis. O dado nao altera
  estoque e nao e transferido ao trocar unidade. Avaliacao manual usa o mesmo
  estado ja compartilhado pela documentacao e proposta final.
- Oito etapas de continuidade/recuperacao passaram em 375 e 1440px nos tres
  temas, incluindo complemento tardio sem alterar preco, unidade ou recursos.
- Complemento automatico exige identidade unica e entrega igual; observacao
  encontrou 54 avaliacoes compativeis, recusando quatro andamentos cuja entrega
  diverge. Ausencias restantes dependem de fonte oficial, sem inferencia.
- Corrige normalizacao silenciosa de datas inexistentes nos dois motores.
  Matriz de 14.014 casos: zero divergencias, fontes e dominio delimitados.
- Seis jornadas visuais com ponteiro preservado, 41 testes de efeitos/temas,
  build, lint, tipos, formatacao e audit aprovados. Suite Windows: 1.888
  aprovados, seis falhas POSIX e tres timeouts; repeticao isolada de ferramentas,
  concorrencia e matriz aprovou 278 testes. CI Linux do PR #147 (`37220843131`)
  e do main (`37222464725`) aprovadas, incluindo banco, restore, imagem e QA.
- Runtime `f4dec82249c2b3e56beaaea518ec194ced81b480` publicado com artefato
  imutavel, backup privado, CAS e rollback preparado. Health e negacao anonima
  aprovados; conferencia autenticada calculou os dois percentuais e preservou
  entradas ao trocar unidade. Nenhuma proposta salva ou enviada.
- Registro final apenas documental, sem novo restart. A fonte oficial das
  unidades incompletas continua pendente; nenhuma ausencia foi presumida.
- Sem alteracao de politica comercial, fontes externas, banco ou n8n.
  Limites e evidencia: `docs/audits/associativo-origem-brilho-2026-10-04.md`.

## 2026-10-04 - Paridade dos 22 canvases protegidos

- Fonte: 15 referencias versionadas em `docs/qa/canvas-parity`, contrato das
  22 rotas protegidas e implementacao corrente da branch
  `codex/canvas-layout-parity`. Os canvases orientam composicao, nao dados,
  autorizacao, formulas ou politica comercial.
- O shell protegido continua sendo a unica navbar global. Foram alinhados os
  layouts de Dashboard, cinco etapas, Ranking, Canal de Parcerias,
  Configuracoes/metas, hub e jornadas de Simulacao, alem de Administracao,
  Usuarios e Catalogo de paginas.
- As superficies usam dados de fontes validadas ou deixam a indisponibilidade
  explicita. Textos, nomes, metricas e estados ilustrados nas referencias nao
  foram promovidos a dados reais nem a fixtures produtivas.
- `/app/simulacao/caixa` integra a navegacao protegida para revisao visual por
  perfil autorizado. `simulator.caixa` e recusado pelo QA e o motor, endpoint,
  submissao e aprovacao bancaria permanecem fail-closed; o layout nao substitui
  Proxy, guard, grants ou RLS.
- Os contratos cobrem os temas Claro, Medio e Escuro, sete viewports, zoom,
  teclado, foco, reduced motion, overflow, contraste e Axe. A captura limpa do
  SHA `a4c1717a1ac159804a1cda7b02ec3a3f48379b4a` aprovou 154 combinacoes
  responsivas (`22 rotas × 7 viewports`), 88 checks de tema, 209 auditorias de
  acessibilidade, 209 capturas/comparacoes, 110 checks de zoom e 40 combinacoes
  da navegacao dos simuladores. A baseline de 209 imagens foi promovida pelo
  helper transacional; conta e fixtures locais efemeras foram removidas.
- O roteiro `associative-calculation-continuity` agora diferencia campo vazio
  de zero e sincroniza a sequencia pelo estado habilitado/persistido. Conserva
  Financiamento R$ 190.000, Subsidio/FGTS/Cheque Moradia em R$ 0, Entrada de
  R$ 1.000 e 84 parcelas; nenhuma formula ou regra financeira foi alterada.
- A matriz autenticada, contraste, hierarquia semantica, overflow mobile e
  navegacao passaram. PR #148 foi atualizado sobre a `main`, aprovado pela CI
  `37241474990` e integrado em
  `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`.
- O E2E de release foi reconciliado com o contrato vigente: Master acessa as 22
  paginas protegidas, Admin conserva 14, Broker/Coordinator/Real Estate
  conservam sete e Manager/House/Partnership Channel/Pending ficam sem paginas
  comerciais. A pagina CAIXA e autorizada somente ao Master; CTA e motor
  continuam bloqueados. Vinte cenarios passaram, um permaneceu ignorado pelo
  proprio contrato e as dez identidades sinteticas foram removidas.
- CI do `main` `37243547805` aprovou validacao, restore isolado, E2E, matriz
  visual e imagem promovivel. O runtime foi publicado diretamente em producao
  por imagem imutavel e CAS, com backup root-only, cinco healthchecks internos e
  publicos, 22 redirects protegidos, cinco APIs 401, seis paginas publicas 200,
  headers 7/7 e 12 leituras concorrentes sem 5xx. Container permaneceu healthy,
  sem reinicios ou erros criticos. Evidencia completa em
  `docs/audits/canvas-layout-parity-2026-10-04.md`.

## 2026-10-04 - Associativo: calculo, origem e continuidade

- Fonte: pedido de correcao dos percentuais, avaliacao e continuidade, com
  dez referencias visuais. Branch `codex/associativo-calculo-e-continuidade`
  iniciada em `c73d155`, preservando a nova navegacao protegida da base.
- Corrige bloqueio indevido do comprometimento quando falta andamento da obra;
  mantem maximo mensal e aprovacao pendentes enquanto a evolucao for desconhecida.
- Mantem respostas e recursos em mudancas de renda, modalidade ou unidade.
  Avaliacao manual e dados especificos do imovel nao sao transferidos entre unidades.
- Enriquecimento do estoque exige identidade comercial unica. Sem substituir
  ausencia por preco de venda, nem liberar proposta com calculo incompleto.
- Validacao: 80 testes financeiros, 13 de perfil/renderizacao e 11 de
  enriquecimento real aprovados. Lint, tipos, build e audit aprovados.
- Seis jornadas desktop/mobile nos tres temas e cinco cenarios de continuidade
  passaram. Acrescentada prova de pixels do brilho integral, em validacao final.
- Suite Windows: 1596 aprovados, seis falhas POSIX e dois timeouts. Repeticao
  serial de ferramentas: 43 aprovados e tres timeouts de conhecimento. Gates
  nao foram reduzidos; CI Linux completa obrigatoria antes da publicacao.
- Nenhuma alteracao em politica comercial, schema, dados remotos ou n8n.
  Evidencias e limites em `docs/audits/associativo-calculo-continuidade-2026-10-04.md`.
- CI 37202986207: Linux, banco e restore aprovados; E2E reteve contrato antigo
  de apagar ranking na edicao de renda. Atualizado para preservar respostas e
  verificar os dois percentuais pela nova renda, mantendo isolamento concorrente.
- PR #145 integrado apos CI 37203612944 verde. Main 106d626 validado pela CI
  37205634578 e publicado com imagem imutavel, backup e compare-and-swap.
  Health, acesso anonimo negado e conferencia autenticada aprovados; aba de teste
  encerrada sem salvar dados. Evidencia completa no audit, sem reinicio documental.

## 2026-10-04 - Navegacao protegida unificada validada

- A topbar unica passa a atender todas as paginas protegidas; cinco simuladores
  deixaram de montar navbar interna. Simulacao concentra as jornadas em submenu
  autorizado no servidor e CAIXA permanece bloqueada, sem `href`.
- Gate local limpo no SHA `54e09b`: 147 checks responsivos, 84 de tema, 201
  auditorias Axe/comparacoes, 105 checks de zoom e 40 combinacoes da navegacao
  arquivada. Documentacao foi incorporada a matriz principal de 21 paginas.
- O contrato agora comprova truncamento da identidade em cada viewport e exige
  correspondencia exata entre as 201 imagens e o manifesto. Oito capturas
  antigas da CAIXA foram removidas; nenhuma evidencia orfa permanece.
- O smoke E2E distingue o aviso bloqueado da CAIXA no card e no submenu, ambos
  sem `href`; o acesso direto continua validado separadamente como negado.
- Perfis sem paginas comerciais passam a provar explicitamente que a tela de
  seguranca exibe a identidade, mas nao monta a navegacao principal protegida.
- O smoke do Tabelao valida a regiao rolavel pelo nome acessivel e a tabela
  semantica contida nela, refletindo a estrutura real do componente.
- Teclado, foco, identidade longa, cookies, tres temas, reduced motion e estados
  dos simuladores passaram. O alvo de cookies permanece em 44px mesmo sob o CSS
  legado de 14px. Conta e fixtures QA efemeras foram removidas.
- Nenhuma migration, permissao, dado, integracao ou regra comercial foi alterada.
  CI, PR e publicacao automatica ainda dependem dos gates finais deste SHA.

## 2026-10-04 - Associativo publicado e conferido

- Publicada a imagem imutavel 7337b97 apos CI 37173712179 integralmente verde.
  Remocao de braces incorporada da base, audit aprovado e Tabelao preservado.
- Backup verificado, equivalencia OCI/11 camadas e dois perfis comprovados,
  CAS oficial e health interno/publico aprovados; rollback nao necessario.
- Checkout sujo da VPS preservado; release em checkout destacado limpo.
  Troca aguardou recuperacao da memoria. Nenhuma migration ou mudanca de dados.
- Smoke anonimo: 12 GETs sem erros. Jornada autenticada com valores ficticios,
  sem salvar proposta, confirmou etapas, brilho 3s, campos, reprovacao e dolar.
- PR #143 publica somente QA e registros; sem novo restart. Lint, tipos,
  build, 89 focados e oito Node aprovados; Windows 1479 aprovados, seis falhas
  POSIX e um ignorado. Suite Linux aprovada no validate. Fonte: audit da release.

## 2026-10-04 - Estabilizacao do QA de impressao

- PR #141 integrado em 7337b97 apos CI verde: 193 comparacoes e seis jornadas
  de guidance v5 passaram sem promover imagens de referencia.
- Primeira CI da main falhou somente na leitura imediata do layout de impressao
  do Tabelao. Reproducao sintetica mostrou a transicao de min-width ainda ativa.
- QA passa a aguardar o predicado integral por ate cinco segundos, sem remover
  condicoes ou alterar Tabelao, estilos e runtime. Regressao cobre espera
  limitada e conservacao dos criterios. Fonte: audit do Associativo.
- Prova do bloco corrigido: 10/10 aprovadas; largura e transform persistentes
  falharam por timeout. Predicado identico confirmado por AST; 89 testes focados
  aprovados. Gates locais completos em andamento.
- Uma repeticao do job da main foi solicitada no mesmo SHA; deploy ainda pendente.

## 2026-10-03 - Shell protegido único

- Branch `codex/unified-protected-navigation`, base `8e158cc`. O diagnóstico
  confirmou que cinco simuladores contornavam o shell protegido e montavam um
  `ArchiveHeader` com menu estático, criando duas arquiteturas de navegação.
- A correção mantém um único layout autenticado. O catálogo filtrado por RLS e
  permissão continua sendo a base; quatro simuladores fora das 17 páginas do
  catálogo entram apenas quando o pai, a permissão efetiva e o gate liberado
  convergem. CAIXA é apresentada sem `path`, como estado bloqueado.
- Os cabeçalhos locais e a navegação redundante entre simuladores foram
  removidos. Tabs contextuais, cálculos, estoque, formulários, URLs, proxy,
  guards e políticas de banco permanecem inalterados.
- Baseline no SHA-base aprovado: ESLint, TypeScript, 1.478 Vitest (1 ignorado),
  oito testes Node e build Next. Validação integrada e evidências visuais serão
  registradas após a consolidação dos arquivos concorrentes.

## 2026-10-03 - Contrato de brilho compativel com CSS de producao

- CI 37167561944 aprovou validacao e restore; QA autenticado detectou a
  serializacao 0px do topo no CSS minificado, equivalente ao 0% da fonte.
- Ajuste somente no teste: normaliza esse zero exato e preserva a exigencia
  de duas faixas nas extremidades. Regressao rejeita deslocamento de 1px,
  bordas sobrepostas e posicao intermediaria. Quinze casos aprovados.
- Arvore integrada: lint, tipos, build, audit, oito Node e seis jornadas locais
  aprovados. Suite Windows com seis falhas POSIX e dois timeouts; estes passaram
  em repeticao serial de 22 casos. Suite completa aprovada na CI Linux.
- Evidencia detalhada no audit do Associativo; nova CI obrigatoria antes do deploy.

## 2026-10-03 - Retomada da publicacao do Associativo

- Usuario solicitou incorporar a correcao e publicar. Integra origin/main
  db1b625 ao PR #141, preservando a entrega do Tabelao e o patch de lint do PR #139.
- Somente registros documentais conflitaram; mantidos os dois historicos.
- A CI anterior 37136181590 aprovou lint, tipos e testes, mas parou no audit.
  Instalacao congelada, audit sem vulnerabilidades e 40 testes focados aprovados.
  CI completa e gates combinados em andamento.

## 2026-10-03 - Brilho nas linhas e reprovacao metalica

- Branch codex/associativo-brilho-reprovacao, base 506b9e3. Pedido posterior
  em seis capturas: campos sem contorno, brilho nas duas extremidades da linha,
  dolar externo de 17px e reprovacao vermelho-sangue metalico com brilho de 3s.
- Remove bordas/sombras de inputs e controles do ledger, inclusive o foco
  herdado da composicao. Mantem indicacao de teclado no nome do campo.
- Brilho dourado somente em duas faixas de 2px, sem moldura fixa; reprovacao
  com contraste branco validado e efeito interrompido em reduced motion.
- Dolar fora da secao/tabela, alvos de 24/44px, sem caixa; calculos,
  sequencia, paleta-base, estoque e Tabelao preservados.
- Lint, tipos e build aprovados. 30 testes focados, 46 testes de ferramentas
  em repeticao serial e oito testes Node aprovados. Navegador: 6/6 jornadas
  nos tres temas/desktop/celular, com contraste e geometria aprovados.
  Suite integral Windows executada: seis falhas POSIX
  e cinco timeouts; os timeouts passaram na repeticao sem relaxar limites.
- CI/publicacao pendentes; braces segue bloqueando o audit. Atualizacao para
  3.0.4 retornou E404 na consulta ao registro, sem alteracao de dependencias.
- Evidencias: docs/audits/associativo-brilho-reprovacao-2026-10-03.md.

## 2026-10-03 - Publicacao concluida do Tabelao

- PR #139 integrado apos CI 37136895575 verde. Arvore de f618ba6 identica ao
  merge 8e158cc9d13beeff0087064df6d9b58d87790379.
- CI main 37144378453 aprovou validate, release-gates, isolated-restore e
  promotable-image. Imagem transferida somente depois dos quatro gates verdes.
- ZIP, arquivo comprimido, manifest/config OCI e 11 camadas conferidos.
  Perfis de homologacao/producao aprovados novamente no destino, sem rebuild.
- Backup privado, imagem anterior preservada, Nginx valido, CAS e troca pelo
  wrapper oficial. Health interno/publico confirmou a versao exata; APIs de
  estoque retornaram 401 anonimo, Tabelao 307 para login. Sem rollback necessario.
- Pagina autenticada de producao inspecionada: titulo, ordem, dourado, Maps e
  rodape corretos. Politica comercial disabled confirmado no DOM. Sem exportar
  estoque ou credenciais para o repositorio. Aba publicada deixada aberta.
- Evidencias completas: docs/audits/tabelao-layout-maps-2026-10-02.md.
  Este registro nao altera runtime nem requer nova troca de imagem.

## 2026-10-03 - Revisao visual autenticada do Tabelao

- CI 37134880142 em c6432d3: formatacao, lint, tipos, 1475 testes Vitest,
  oito Node, audit sem vulnerabilidades e build aprovados. Quatro skips existentes.
- Banco, advisors, E2E de autorizacao e restore isolado aprovados.
- Matriz funcional completa aprovada: 140 rotas, 80 temas, 193 auditorias de
  acessibilidade, 100 zooms, teclado e simuladores. Tabelao passou tambem nos
  20 criterios novos de layout/recursos/print e quatro criterios de destinos Maps.
- Comparacao visual divergiu somente em 11 capturas intencionais do Tabelao.
  Todas inspecionadas, hash/arvore conferidos e promovidas pelo helper transacional
  existente. Preservadas 182 imagens e limiares 1%/16. CI final e deploy pendentes.
- Evidencia: artefato 11278718828, docs/audits/tabelao-layout-maps-2026-10-02.md.

## 2026-10-03 - Remocao de braces da cadeia do lint

- Patch versionado do plugin Next 16.3.6 usa tinyglobby existente, removendo
  fast-glob/micromatch/braces sem desativar regras ou ignorar auditoria.
- Testes reais do plugin cobrem caminhos, Windows e deteccao de links invalidos.
  Docker recebe patches antes de instalar; lockfile registra a correcao.
- Dez testes de regressao aprovados; audit limpo. Lint local interrompido por
  pressao de memoria; demais comprovacoes integrais exigidas na CI Linux.
- Corrige tipos estritos dos resultados do ESLint nos testes sem aceitar ausencia.
- Evidencias: docs/audits/next-eslint-glob-2026-10-03.md. Gates completos exigidos.

## 2026-10-03 - Politica desabilitada e revalidacao do release

- Usuario confirmou Politica comercial visivel, desabilitada e sem destino.
  TabelaoResources ja implementa esse estado; nenhuma alteracao de runtime.
- PR #139 segue aberto e bloqueado. CI 37086793201 no SHA 562465b aprovou
  formatacao, lint, tipos e testes, mas falhou no audit de braces@3.0.3.
- Nova auditoria local confirmou uma vulnerabilidade alta GHSA-vfj7-8cjw-p6xm.
  npm informa braces 3.0.3 como latest; fast-glob 3.3.3 e micromatch 4.0.8
  continuam nessa cadeia, inclusive no plugin Next mais recente, 16.3.8.
- GitHub Advisory ainda informa nenhuma versao corrigida. Sem supressao,
  alteracao de dependencias, merge ou publicacao em producao.

## 2026-10-02 - Cabecalho, colunas e recursos do Tabelao

- Escopo exclusivo de /app/simulacao/tabelao, conforme sete capturas do usuario.
- Cabecalho compacto, somente titulo e informacao alinhada, com guia existente.
- Apos Estoque: % obra, Limitador, Volta ao Caixa, Avaliacao e Valor do Imovel.
  Preco em dourado com contraste por tema; regras de calculo preservadas.
- Enderecos viram links Maps codificados, com contexto geografico disponivel.
  Usuario confirmou manter a origem oficial atual. Ausencia nao cria local ficticio.
- Rodape: Aprenda +, Politica comercial, Imprimir, Bora Vender e Salesforce,
  com icones. Politica permanece desabilitada ate receber documento/destino.
- Impressao restaura a tabela ocultada pelo CSS legado; sem alterar outras guias.
  Revisao visual corrigiu texto branco e dourado claro sobre papel branco.
  QA mede contraste minimo 4,5:1 em todos os textos impressos, nos tres temas.
- Lint, tipos e build iniciais aprovados. Suite Windows interrompida apos falhas
  POSIX e timeouts sob baixa memoria, inclusive com dois workers.
- Dados: 283 testes aprovados e timeout de snapshot aprovado isoladamente.
  Interface: 18/18; oito testes Node aprovados. Provas locais de seis larguras,
  tres temas, Maps, guia e impressao passaram; preview teve tres assets 404.
- Evidencias e limites em docs/audits/tabelao-layout-maps-2026-10-02.md.
- PR #139; CI 37086002430 aprovou 1465 testes Vitest (4 ignorados), oito Node,
  lint e tipos. Audit bloqueou braces@3.0.3 (GHSA-vfj7-8cjw-p6xm).
  Registry retornou E404 para 3.0.4; advisory informa nenhuma versao corrigida.
  Sem supressao do gate, imagem promovida ou alteracao em producao.
- Apos revisao de print: lint, tipos, build, 73 testes focados e 20 verificacoes
  de navegador por largura (1440/390px) aprovados.

## 2026-10-02 - Dourado fechado e edicao sem preenchimento

- Branch codex/associativo-contorno-dourado, base 3960724. Novo pedido em duas
  capturas: selecao mais escura, campos sem caixa escura/dourada e linha de 3s.
- Estoque com dourado antigo #b99545; etapas, linhas e Ranking mantem o fundo
  do tema, contorno #9f7628 e varredura dourada restrita a uma faixa de 2px.
- Campos monetarios, quantidade e renda transparentes antes/depois de editar.
  Etapas, erros, calculos, paleta-base e Tabelao preservados.
- 28 testes focados, lint, tipos, build, 8 testes Node e 6/6 jornadas aprovados.
- Suite Windows: 1410 aprovados, 1 ignorado, 6 falhas POSIX conhecidas. Exigir
  CI Linux completa; publicacao pendente.
- Evidencias: docs/audits/associativo-contorno-dourado-2026-10-02.md.

## 2026-10-02 - Paleta do Tabelao no Associativo

- Pedido posterior: Associativo com as cores do Tabelao, consultado somente
  como referencia. Nenhuma mudanca no Tabelao ou nos tokens compartilhados.
- Remove apenas doze substituicoes de cor exclusivas do Associativo. Herda
  fundo #061f35, paineis #0a2b47, campos #071a31 e demais cores da referencia.
- Preserva dourado metalico, brilho de tres segundos, etapas e calculos.
- 28 testes focados, lint, typecheck, build e 8 testes Node aprovados.
- Navegador: 6/6 jornadas e 3/3 comparacoes exatas da paleta aprovadas.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas POSIX conhecidas;
  suite integral confirmada na CI Linux 37063588639.
- Gate funcional autenticado e restore aprovados. Duas capturas escuras
  revisadas/promovidas; outras 191 preservadas.
- PR #136 integrado com CI 37067036288 verde. Main 150b771 com CI
  37069870083 integralmente verde, incluindo imagem imutavel.
- Publicado com backup conferido, CAS e rollback preparado. Health/versao,
  12 verificacoes anonimas e cores/dourado no navegador autenticado aprovados.
- Fechamento documental sem alteracao de runtime ou novo restart.
- Evidencias: docs/audits/associativo-paleta-tabelao-2026-10-02.md.

## 2026-10-02 - Tipografia e titulos do Tabelao

- Fonte de 12 para 11px, titulos inteiros em uma linha e caixa de frase,
  Incorporadora substituida por Empresa no Tabelao e seu filtro.
- Planta com quebra apos o tipo de pavimento, largura de 8,5% para 6,5%;
  espaco redistribuido para Regiao, Metragem, Vagas e Estoque.
- Formatacao de descricoes somente na apresentacao, com acentos e siglas
  preservados. Nomes proprios, valores dos filtros e chaves comerciais intactos.
- Nove cenarios Playwright, 42 testes do formatador, 17 contratos focados,
  lint do codigo, tipos e build aprovados. Suite Windows: 1405 aprovados,
  quatro skips e seis falhas POSIX; oito testes Node aprovados.
- CI Linux 37028915320: 1411 Vitest e oito Node aprovados, banco/restore/E2E
  e matriz funcional verdes. Sete capturas do Tabelao revisadas e promovidas,
  186 preservadas; reexecucao e publicacao pendentes no PR #133.
  Evidencias em docs/audits/tabelao-tipografia-2026-10-02.md.
- CI 37033511673 integralmente aprovada. Integra main d79bf8c (PR #134) sem
  reverter Associativo; concilia sete referencias Tabelao e duas Associativo,
  verificando todos os 193 hashes. CI combinada/publicacao pendentes.

## 2026-10-02 - Azul noturno e dourado no Associativo

- Pedido posterior substitui a paleta azul saturada/prata: fundo #040d19,
  paineis #091a2c e dourado metalico nas selecoes e proximas acoes.
- Escopo somente visual no Associativo; preserva claro/medio, cabecalho,
  calculos, confirmacao sequencial e brilho de tres segundos com reduced-motion.
- Testes focados: 28 aprovados; navegador 6/6 (tres temas, desktop/celular),
  contraste, brilho, sequencia, geometria inicial e estoque aprovados.
- Lint, tipos e build aprovados. Windows: 1366 testes aprovados, um skip e
  seis falhas POSIX/symlink ja conhecidas. CI Linux 37030093010: 1369 Vitest,
  oito Node, banco, restore e E2E aprovados. Matriz funcional completa aprovada.
- Duas capturas escuras do Associativo revisadas; 191 referencias preservadas,
  sem alterar tolerancias. CIs 37034089884 e 37037035430 totalmente aprovadas.
- PR #134 integrado e runtime d79bf8c publicado. Imagem imutavel comprovada
  (onze camadas, dois perfis), backup/CAS/rollback e checksums verificados.
- Doze leituras publicas sem erro e navegador autenticado confirmaram fundo
  quase preto, selecao/card dourados e brilho de 3s. Nenhuma proposta salva.
- Fechamento documental: sem novo deploy ou reinicio da aplicacao.
- Evidencias e acompanhamento: docs/audits/associativo-dourado-2026-10-02.md.

## 2026-10-02 - Regioes e leitura continua do Tabelao

- CI 37003636668: 1367 testes Vitest e oito Node aprovados, lint/tipos/build,
  banco, restore e E2E verdes. Matriz funcional completa aprovada: 140 rotas,
  80 temas, 193 acessibilidades, 100 zooms e 40 navegacoes. Sete capturas do
  Tabelao revisadas e promovidas; outras 186 preservadas. Nova CI pendente.
- Branch codex/tabelao-regioes-layout, base 727c858; preserva as entregas paralelas
  do Associativo e da calculadora de documentacao. Escopo restrito ao Tabelao.
- Ordenacao por Leste, Sul, Norte, Oeste e Centro, empreendimento alfabetico e
  preco crescente por padrao; a selecao manual decrescente preserva os grupos.
- Distingue consulta territorial em andamento de falha efetiva, sem atribuir uma
  regiao inventada. Falhas transitorias de transporte recebem uma nova tentativa
  limitada apos os demais lotes, sem elevar a concorrencia nem repetir negacoes.
- CODLOG municipal por HTTPS comprova as divergencias de tipo/titulo dos dois
  logradouros. Backend local confirmou 22/22 CEPs atuais nas fontes publicas,
  em 02/10 as 08:37 BRT. Sem estoque bruto persistido nem zonas fixas.
- 405 testes focados, typecheck, build e oito testes Node aprovados com Node
  24.19.0. Suite final Windows: 1361 aprovados, quatro skips condicionais e seis
  falhas POSIX preexistentes. Lint bruto encontrou apenas erros em
  artefatos locais ignorados; lint do codigo passou. CI limpa obrigatoria.
- Chromium local aprovou nove cenarios, incluindo geometria compacta, rotulos
  verticais, ordenacao, filtros e cabecalho rolando. Capturas desktop/mobile
  revisadas; transicao herdada do cabecalho removida. CI/publicacao pendentes.

## 2026-10-02 - Validacao da guia de documentacao

- Integracao da main 29a487b preserva identidade prata, fluxo do Associativo,
  cabecalho e 44 referencias aprovadas nesse trabalho paralelo. O manifesto combina
  os 186 registros da main com os sete do hub, com proveniencia explicita e hashes
  verificados; a validacao do runtime combinado permanece pendente da nova CI.

- CI 36971939367 aprovou todos os criterios funcionais: 140 responsivos, 80 de tema,
  193 de acessibilidade, 100 de zoom, 40 combinacoes de navegacao e a matriz dedicada
  de documentacao. Sete diferencas esperadas do hub revisadas e promovidas com hashes
  e arvore Git conferidos; 186 baselines preservados. Nova verificacao da CI pendente.

- CI 36970005859 aprovou validate, restore, 20 E2E (um skip) e a matriz dedicada
  da calculadora autenticada: 12 combinacoes, calculos, limites, ajudas, auditoria,
  impressao e zoom. A matriz de navegacao conservava uma segunda expectativa
  obsoleta de item desabilitado; corrigida para exigir zero itens bloqueados nesse
  menu, preservando a assercao do link e os gates das demais paginas.

- CI 36968955807 aprovou validate (1.293 Vitest, oito Node, lint/tipos/build) e restore.
  E2E detectou expectativa antiga de 403 para a guia liberada; matriz atualizada para
  Master e negacao dos outros perfis, mantendo CAIXA bloqueada e APIs oficiais inalteradas.
  Banner generico segue o mesmo tratamento das demais paginas de arquivo nesta guia.

- PR #130. Matriz local final aprovada: 12 combinacoes, sem overflow ou violacoes Axe,
  fluxo completo, impressao e layout equivalente a 200%. Oito testes Node aprovados.
  CI Linux e publicacao ainda pendentes; evidencia final sera registrada no PR.

- Lint, typecheck, build e 32 testes focados aprovados; motor igual a referencia em
  2.048 casos. Suite Windows: 1.271 aprovados, 4 ignorados e 20 falhas POSIX/timeouts
  de infraestrutura sob carga; CI Linux obrigatoria antes da publicacao.
- Revisao independente corrigiu classes de estado; capturas identificaram recorte
  ao redimensionar. CSS localizado impede scroll interno oculto e melhora contraste.
- Matriz de QA inclui geometria do perfil, tres temas, quatro larguras e layout
  equivalente a zoom 200% (720x450 CSS em tela 1440x900), sem CSS zoom artificial.

## 2026-10-02 - Replica da guia Calcular documentacao

- Branch codex/calcular-documentacao; checkout isolado da branch originalmente aberta.
- Referencia consultada somente por leitura: https://descomplicapro.com.br/simulacao/calcular-documentacao.
- Conteudo completo do formulario e resultado reconstruido em React/Next; estilos
  originais ja presentes em investor-archive.css reutilizados. Menu e cabecalho do CRM mantidos.
- Nenhuma formula modificada: 2.048 combinacoes de construtora, modalidade, primeiro
  imovel, renda e fronteiras financeiras comparadas com o bundle publico da referencia.
- Testes focados: 32 aprovados. Typecheck inicial aprovado. Validacao integral,
  navegador, CI e publicacao pendentes nesta etapa.
- A pagina mantem crm.simulators.view; nenhum grant, migration ou workflow alterado.
- Evidencias e limites: docs/audits/documentacao-replica-2026-10-02.md.

## 2026-10-02 - Identidade prata e sequencia do Associativo

- Publicacao: PR #129 validado nas CIs 36971256999/36973571026. Main
  reconciliada; promovida 727c8583ab46a51f81fddb7e0c0ec01b4803a531 apos os
  gates de 36998281910, substituindo 6f2c2aa com CAS/backup/rollback.
- Imagem da CI, 11 camadas e dois perfis conferidos, sem rebuild. Backup
  validado; Nginx intacto; smoke publico 12/12, acesso anonimo negado.
- Jornada autenticada confirmou marca, paleta e sequencia 1 -> 2 -> 3 com
  brilho de 3s apenas na etapa atual. Nenhuma proposta real enviada.
  Fechamento documental nao demanda reinicio da aplicacao.

- Branch codex/associativo-prata-sequencial, base 0ef7b2f. Fonte: pedido e
  dezoito prints do usuario. As referencias anteriores nao foram alteradas.
- Escopo: perfil, orientacao visual, espacos do fluxo e cabecalho compartilhado.
  Sem alteracoes em formulas, autorizacao, banco ou workflows n8n.
- Paleta escura restrita ao Associativo; Claro e Medio preservados. Prata
  indica proxima acao, shimmer de 3s; movimento reduzido conserva estado estatico.
- D derivado do simbolo fornecido com a ferramenta integrada de imagem, somente
  extracao do fundo azul; asset de marca em public/descomplica-symbol.png.
- Build, typecheck, lint do codigo e 26 testes focados aprovados. Suite Windows
  interrompida por limites POSIX/timeouts, sem reduzir gates; CI Linux obrigatoria.
- Repeticao visual final, CI, revisao das referencias e publicacao pendentes.
- QA encontrou contraste do simbolo no Medio e resumo cortado no celular.
  Dourado escuro refinado; consultas de largura agora usam o container real
  de resultados, com rotulos completos, datas e acao dentro do resumo.
  Evidencias consolidadas em docs/audits/associativo-prata-2026-10-02.md.
- CI 36967153629 aprovou validate e restore. Ajustado o roteiro concorrente
  para exigir nova confirmacao de Ranking apos editar a renda, preservando
  isolamento entre usuarios. Tabela de aprovacao mobile ganha rotulos completos
  por regra; seis cenarios de orientacao passaram na preview anterior.
- Revalidacao final: cabecalho 24/24, jornadas 6/6, tres jornadas coarse e
  aprovacao mobile sem extravasamento. Edicao de renda exige reconfirmar Ranking;
  proposta reaparece habilitada. Regressao focada 26/26; CI 36968663861 em curso.
- CI 36968663861 aprovou gates funcionais completos, banco, restore e E2E;
  44 referencias das quatro rotas compartilhadas revisadas e promovidas pelo
  mecanismo canonico. Outras 149 preservadas; limiar/tolerancia inalterados.

## 2026-10-02 - Fila fria das regioes do Tabelao

- Na verificacao real de 598e117 (PR #125), 51 das 57 opcoes apareceram sem
  regiao, incluindo motivo region_lookup_busy. A pagina enviava ate 24 CEPs,
  enquanto o servidor aceita tres consultas e cinco segundos de fila.
- Regressao integrada cliente/rota/backend reproduziu a falha com uma e quatro
  paginas, mapa frio de oito segundos e consultas de seis segundos.
- Cliente passa a um lote de tres CEPs por vez, com atualizacao progressiva.
  Preserva autorizacao, prazos, cache/coalescencia e limite de oito CEPs da API.
  Nao aumenta concorrencia externa nem altera fontes, vagas ou classificacao.
- Testes antes: dois cenarios integrados falharam. Depois: 235 testes de regioes
  passaram, incluindo os dois cenarios. Tipos, build, lint sem bundles locais
  e oito testes Node aprovados. Windows: 1.281 testes aprovados, quatro skips e
  seis falhas POSIX conhecidas, sem flexibilizar os gates.
- CI 36961528199 aprovada integralmente em 825d8a3. Main documental 0ef7b2f
  (PR #127) integrada sem alterar runtime. Nova CI conjunta obrigatoria.
  Publicacao da correcao pendente; evidencia final de release no PR #128.
- Release 598e117 encontrada ja publicada; imagem conferida com a CI 36958962302
  (checksum, manifesto/config/camadas), dois perfis de runtime e backup validos.
  Nao houve novo restart nesta verificacao; nenhum dado remoto alterado.

## 2026-10-01 - Regiao automatica e possibilidades de vagas no Tabelao

- Branch codex/tabelao-regioes-vagas. Campos canonicos postalCode e parkingSpaces
  ja preservados pela API viva; nao e necessario consultar outro banco ou migrar schema.
- Agrupamento acrescenta vagas, com minimo liquido e quantidade por combinacao.
  Zero nao equivale a ausente; formula financeira e outras tabelas preservadas.
- Regiao ocupa a primeira coluna. Consulta por CEP cruza municipio/IBGE do ViaCEP,
  todos os distritos do Localiza Sampa e nomes de regiao do GeoSampa. CEP ambiguo,
  conflito de fontes, resposta incompleta ou indisponibilidade falham sem inferencia.
- Consulta protegida, no-store, cache limitado e coalescencia por CEP. Tres consultas
  simultaneas, fila limitada, prazos e cooldown; nenhum enriquecimento bloqueia estoque.
- Fonte territorial oficial HTTP e sem SLA permanece uma limitacao documentada;
  nao se promete precisao absoluta, nem se converte bairro em distrito por suposicao.
- Typecheck, build, lint do codigo e oito testes Node aprovados. Testes de cliente,
  inventario e UI: 200 aprovados; backend: 135 aprovados. Sete cenarios Chromium
  locais passam com filtros, textos, centralizacao, lotes, mobile e zoom.
- Auditoria agregada da fonte atual: 20 dos 22 CEPs confirmados; dois conflitos
  de endereco permanecem nao confirmados. Smoke publico cobre CEP ambiguo e outra cidade.
- pnpm lint inicial encontrou bundles locais nao versionados; lint sem test-results
  passou. Suite Windows: 1.205 aprovados, quatro skips, seis falhas POSIX e dois
  timeouts de conhecimento; repeticao isolada: 21/22, um timeout. Nenhum gate
  reduzido; CI Linux, comparacao visual e publicacao permanecem pendentes.
- CI Linux 36952238409 aprovou 1.279 testes Vitest (quatro skips), oito Node,
  formato, lint, tipos, build, banco, restore isolado e E2E de autorizacao.
- Matriz funcional aprovada: 140 rotas, 80 temas, 193 axe, 100 checks de zoom;
  regioes assincronas e vagas passaram. Somente sete capturas do Tabelao com
  pixel drift intencional, revisadas individualmente e promovidas pela rotina
  canonica; outras 186 preservadas byte a byte, sem reduzir limiares.
- PR #125; captura dd373aa, codigo 02074e7. Nova CI com referencias revisadas e
  publicacao pendentes. Evidencia final de release sera registrada no PR.
- CI 36954481187 totalmente aprovada em 805e0ca. Main ef0a2fb (PR #126)
  integrada sem conflito e sem modificar o guia do Associativo; repetir CI
  conjunta antes do merge. Nenhum deploy do Tabelao realizado ate esta etapa.
- Runbook: docs/runbooks/tabelao-regions.md. Sem n8n, migration ou escrita remota.

## 2026-10-01 - Cabecalhos legiveis e colunas centralizadas no Tabelao

- Remove as fontes de 4/6px dos cabecalhos: titulos e conteudo compartilham 10px
  no desktop e 12px abaixo de 1240px, com altura automatica e quebra de linha.
- Move Endereco no colgroup, cabecalho e corpo; preserva rowspans e associacoes.
- Centraliza horizontal e verticalmente todas as celulas, incluindo grupos.
- Corrige padding do endereco quando ele e a primeira celula fisica da linha.
- Sete cenarios locais com componente/CSS reais e dados sinteticos aprovados;
  55 testes focados e typecheck aprovados. Suite Windows: 992 aprovados,
  quatro skips e seis falhas POSIX conhecidas; CI Linux obrigatoria.
- Evidencias e limites: docs/audits/tabelao-cabecalhos-2026-10-01.md.
- Lint do codigo (sem bundles locais de test-results) e build aprovados.
- CI 36916047513 aprovou validacao Linux, banco, restore e E2E; matriz funcional
  passou com 140 rotas, 80 temas, 193 axe e 100 verificacoes de zoom.
- Sete capturas alteradas somente do Tabelao revisadas e promovidas pela rotina
  canonica; 186 referencias preservadas byte a byte, sem alterar limiares.
- CI final 36919972124 aprovada antes da integracao da main f1d71da (PR #122).
- Preserva o Associativo e suas onze capturas; concilia apenas metadados de
  referencia por rota, mantendo proveniencia. Nova CI conjunta obrigatoria.
- Publicacao pendente; fechamento e identidade da release no PR #123.

## 2026-10-01 - Jornada dourada do Associativo

- Destaque metalizado somente na pergunta atual e na proxima linha financeira.
- Corrige borda animada que ultrapassava a linha: contorno interno sem escala.
- Padroniza largura/altura dos campos, com folga para o valor da renda.
- Separa Linear do bloco decrescente, destaca remuneracao com simbolo dourado
  e adiciona hover sem alterar a geometria do layout; respeita movimento reduzido.
- Renomeia o indicador e suas ajudas para % Maximo da renda mensal, sem
  modificar formulas, limites, fontes ou regras de enquadramento automatico.
- Referencias ranking e calcular-documentacao consultadas somente para leitura.
- Lint, tipos, build e jornada visual 6/6 aprovados. Suite Windows: 1008 pass,
  1 skip, seis falhas POSIX e um timeout aprovado em repeticao isolada.
- Publicado em 02/10 no runtime integrado 598e1171, preservando PR #125.
  PR #126 e CIs 36954146586, 36956549122 e 36958962302 verdes.
- Imagem imutavel verificada, backup/CAS/rollback e 12 GETs sem erro;
  navegador autenticado confirmou pagina, estoque e estilos dourados.
- Evidencia: docs/audits/associativo-guia-dourado-2026-10-01.md.
- Revisao coarse remove a translacao legada do botao de remuneracao; a escala
  continua restrita a dispositivos com hover e sem movimento reduzido.
- Encerramento documental sem novo deploy; prova coarse real/desktop 2/2.

## 2026-10-01 - Layout e manual do Associativo

- Escopo: altura inicial, selecao dourada metalizada, guia intrinseco,
  contornos uniformes e FAQ completo do anexo, sem alterar motor financeiro.
- Tela inicial observada em 1280x580 sem rolagem global ou recorte de conteudo.
  Mobile e zoom restrito conservam rolagem para manter a leitura e os alvos.
- Skills interface, simuladores e validacao selecionadas; implementacao do FAQ
  delegada em escopo disjunto. Nenhuma dependencia ou servico novo instalado.
- Lint, tipos, formatacao e build locais aprovados; Windows: 1.003 testes
  aprovados, um skip e seis falhas de semantica POSIX/symlink. CI Linux
  36915441302: 1.006 aprovados, quatro skips condicionais e oito testes Node.
- CI aprova banco, restore, E2E e matriz funcional: 40 navegacoes, 193 axe,
  zoom/teclado e 30 capturas do manual. Onze diferencas visuais exclusivas do
  Associativo revisadas e promovidas; demais 182 referencias preservadas.
- PR #122 integrado; CI final do PR 36919448507 e da main 36923454213 verdes.
  Thresholds visuais nao foram relaxados.
- Publica f1d71da81a21cf139acc26b95a6cacc218b79325 pela imagem imutavel da CI,
  com onze camadas, dois perfis, checksum, backup, CAS e rollback preparados.
- Health local/publico e Nginx aprovados; doze GETs anonimos, concorrencia quatro,
  sem erros, com estoque e snapshot negados por 401. Nao e prova de capacidade.
- UI autenticada em 1280x580: overflow global zero nos tres temas, dez linhas,
  guia 32px e largura intrinseca, contorno 8px e foco dourado metalizado.
- Guia abre/fecha por Escape e devolve foco; zero erros/avisos de console.
  Nenhuma unidade real foi selecionada; nenhuma proposta foi criada ou alterada.
- Em janelas muito baixas, mobile e zoom restrito, a rolagem continua acessivel.
  Na observacao 1280x529 houve 16px de rolagem, sem recortar o rodape.
- Registro final publicado no Git e sincronizado com Obsidian, sem novo deploy
  por esta atualizacao exclusivamente documental. Registro mantido nesta secao
  do Associativo, preservando o trabalho simultaneo do Tabelao no PR #123.

## 2026-10-01 - Rodape alinhado publicado

- PR #120 integrado; CI final da main 36881065033 totalmente verde.
- Publica 5878c3bce83990496d886c3311527724beb7d9f9 pela imagem imutavel
  provada na CI, com onze camadas, dois perfis, backup, CAS e rollback.
- Health local/publico, Nginx e doze GETs anonimos concorrentes aprovados;
  estoque e snapshot permaneceram protegidos por 401.
- Navegador autenticado confirma alinhamento de 0px no desktop e empilhamento
  sem sobreposicao/overflow no celular, com zero erros de console e selecoes.
- Registro documental sincronizado sem novo restart da aplicacao.

## 2026-10-01 - Rodape do Associativo alinhado

- Coloca aviso preliminar e contato do suporte na mesma faixa, alinhados pelo topo.
- Em telas estreitas, mantem os textos empilhados sem sobreposicao ou overflow.
- Regressao estatica e matriz local 40/40 aprovadas: tres temas, dez larguras
  por simulador e diferenca de 0px no desktop observado.
- CI 36862800456 aprovou Linux, banco, E2E e restore; a matriz funcional passou
  e sinalizou tres capturas esperadas do Associativo. Revisadas e promovidas
  transacionalmente, preservando as outras 190 referencias e os limiares.
- Lint, tipos e build aprovados; 994 testes passaram, um skip e sete falhas
  locais de POSIX/symlink ou timeout do parser Chrome. CI Linux final aprovada.
- Evidencia: docs/audits/rodape-associativo-2026-10-01.md.

## 2026-10-01 - Filtros compactos publicados

- PR #118 integrado com CI 36806006230 verde; CI main 36807945046 aprovada.
- Publica de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c com imagem imutavel,
  checksum, onze camadas e dois perfis comprovados; backup/CAS/rollback preservados.
- Health confirma a release; doze GETs anonimos sem erros e estoque protegido.
- Navegador autenticado: titulo a 8px, guia 32px, icones alinhados, filtros
  proximos da divisoria e dez linhas. Guia/ajuda/Escape/foco passaram, sem erros
  de console ou selecao de unidade. Aba de trabalho existente preservada.
- Registro documental e sincronizacao do Obsidian, sem novo restart da aplicacao.

## 2026-09-30 - Estoque Associativo e filtros compactos

- CI 36800158280: gates funcionais, banco, restore, E2E, 40 navegacoes,
  193 axe e zoom aprovados. Revisa/promove onze capturas somente Associativo,
  preservando outras 182 e thresholds 1%/16. Nova CI final/publicacao pendentes.

- Corrige o guia da proposta entre 561px e 1100px: permanece na linha do
  cabecalho, sem transbordar sobre o bloqueio. QA passa a exigir contencao.

- CI 36798139339 aprova E2E, mas identifica quebra do botao em 768px com Geist.
  Corrige largura estavel de 260px limitada ao conteiner; nao relaxa altura/testes.

- CI 36797025028 aprova validacao Linux/banco/restore e concorrencia sintetica;
  E2E ainda exigia o rotulo removido. Atualiza o contrato para o novo cabecalho.
- Matriz local completa aprovada: 40 navegacoes/tres temas, sem erros de runtime.

- Dourado persistente na selecao; icones alinhados e guia sem rotulo redundante.
- Limpar filtros no cabecalho com metadados a esquerda; filtros sem linha vazia.
- Compacta margens mantendo dez linhas, estoque completo e alvos de toque.
- Regras financeiras, temas e outros simuladores preservados.
- Amplia QA de geometria, selecao, limpeza e preservacao da proposta.
- Lint/tipos/build aprovados, 30 combinacoes visuais e dois contextos de toque.
- Seis falhas POSIX no Windows; dois timeouts Obsidian passaram na reexecucao
  isolada (22 testes). Oito testes Node aprovados. CI Linux exigida.
- Validacao e publicacao pendentes: docs/audits/filtros-associativo-2026-09-30.md.

## 2026-09-30 - Topo compacto publicado

- PR #116 integrado apos CI 36777405809 verde. CI main 36780351488 aprovada
  no SHA 843fd113a3a1f6b6fd3b6b12b6de58de180256ce, publicado sem rebuild.
- Checksum, manifesto, onze camadas, dois perfis, backup/CAS/rollback conferidos.
- Health confirma a release; doze GETs anonimos sem erro, estoque protegido.
- Navegador confirma titulo/guia a 8px do menu e botao 36px; guia, Escape e
  retorno de foco funcionais, zero erros de console. Nenhuma unidade selecionada.
- Documenta e sincroniza o resultado; este registro nao exige novo deploy.

## 2026-09-30 - Titulo e guia proximos ao menu

- CI 36774530982: validacao Linux, banco, restore, E2E, 40 navegacoes e 193
  auditorias axe aprovados. Revisa/promove onze imagens exclusivas do Associativo;
  preserva as outras 182 e thresholds. Nova CI integrada e publicacao pendentes.
- Associativo: aproxima titulo e Guia completo da divisoria com 8px de margem.
- Alinha o bloco pelo topo, reduz o intervalo no celular e o botao para 36px;
  preserva alvo de 44px em dispositivos de toque.
- Amplia contrato de navegador para conferir distancias, altura e contencao.
- Sem mudanca em temas, calculos, estoque ou outros simuladores.
- Lint, tipos e build aprovados; 994 testes passaram, um skip e seis falhas de
  permissoes POSIX no Windows. Oito testes Node aprovados. CI Linux exigida.
- Geometria passou em dez larguras/tres temas e dois contextos de toque.
  Guia, Escape, retorno de foco e axe do topo aprovados em desktop/celular.
- CI visual e publicacao pendentes. Evidencia: docs/audits/topo-associativo-2026-09-30.md.

## 2026-09-30 - Compactacao publicada

- PR #114 e CI main 36764731943 aprovados. Publica d9c2bee07fd6304006e28e357bf8e918a2031bf4.
- Imagem imutavel, onze camadas, dois perfis, backup, CAS e rollback comprovados.
- Health e doze GETs anonimos passaram; estoque protegido. Navegador confirma
  dez linhas, dourado, cabecalho compacto, temas sem caixas e titulo menor.
- Tres temas preservados, zero erros de console observados. Nova aba atualizada
  mantida aberta; aba de trabalho do usuario nao recarregada.
- Registra conhecimento e evidencia final; nenhuma nova mudanca de runtime.

## 2026-09-30 - Compactacao do Associativo

- Revalidacao Next 16.3.6: lint/tipos/build e audit passaram; Windows 994 passaram,
  um skip e seis falhas POSIX. Oito testes Node passaram; preview 40/40 aprovado.
- CI 36758571149 aprovou gates funcionais, 193 axe e 100 zoom. Revisa e promove
  44 capturas dos simuladores; preserva 149 imagens e limites do comparador.
  CI final das referencias e publicacao pendentes.
- Gate 36757589260 bloqueou Next 16.3.3 por GHSA-vcvr-r3jv-pc5j. Atualiza Next
  e eslint-config-next para 16.3.6, sem desabilitar auditoria.
- Corrige perda de foco no breakpoint do menu observada no Tabelao durante QA.
  Revalidacao completa pendente apos patch de runtime e navegacao.
- Dez unidades visiveis por vez, rolagem integral e hover/foco dourado.
- Alinha altura visual e passo da virtualizacao; preserva filtros e selecao.
- Compacta cabecalho, remove caixas dos temas e reduz titulo do Associativo.
- Contrato de navegador adicionado; azul-marinho e regras financeiras preservados.
- Lint/tipos/build passaram. Suite Windows: 993 passaram, um skip, seis falhas
  POSIX e um timeout DevTools. Reteste: 24 DevTools, 13 cores/navegacao e oito
  testes Node passaram. Matriz integrada e deploy pendentes.
- Evidencia: docs/audits/compactacao-associativo-2026-09-30.md.

## 2026-09-30 - Temas azuis publicados

- PR #112 e CI main 36734239866 aprovados. Publica a imagem imutavel da release
  b55fa6fc95eb26087c70736d618bf019818c5876, sem rebuild no servidor.
- Checksum, manifesto, configuracao, onze camadas e dois perfis comprovados.
  Backup privado, CAS da versao anterior e rollback preservados.
- Health confirma a versao; smoke somente leitura de doze GETs, concorrencia
  quatro, sem falhas. Estoque anonimo negado; nao comprova capacidade.
- Confirma os tres temas em producao e encerra no Escuro azul-marinho original.
  Estoque carregado e nenhum erro de console observado.
- Preferencia de cores documentada e sincronizada. Este registro nao exige deploy.

## 2026-09-30 - Azul original nos temas

- Corrige a paleta a pedido do usuario: restaura o azul-marinho original do
  modo escuro e substitui verdes por azul nos tres temas dos simuladores.
- Mantem geometria, navegacao e regras financeiras; tokens limitados ao shell.
- Adiciona regressao para fundos originais, destaques azuis e contraste textual.
- Evidencia: docs/audits/cores-azuis-2026-09-30.md. Validacao e deploy pendentes.
- Lint, tipos e build locais aprovados; preview 40/40 nos tres temas.
- Suite Windows: 992 passaram, um skip, seis falhas POSIX e dois timeouts.
  Reteste isolado DevTools/cores/navegacao: 37 passaram; oito testes Node passaram.
  CI 36726351781 aprovou validate, banco, restore e E2E.
- Matriz: 40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
  Revisa 44 capturas afetadas e promove referencias via contrato canonico;
  preserva outras 149 e thresholds. Nova CI integrada e deploy pendentes.
- Normaliza manifesto gerado com Prettier apos falha de formatacao na CI
  36730344413; conteudo semantico e imagens preservados.

## 2026-09-30 - Identidade publicada e verificada

- Publica 2c002df10fa2777165fec5b96f707ed971422e74 apos PRs #109/#110 e CI main
  36667629540 inteiramente aprovada, incluindo imagem, banco, restore e navegador.
- Imagem da CI carregada sem rebuild; checksum, configuracao, manifesto OCI e
  onze camadas equivalentes. Dois perfis de runtime aprovados no destino.
- Backup privado e CAS da versao 96410f9; Nginx preservado e rollback preparado.
- Health publico confirma a release; smoke de doze GETs, quatro concorrentes,
  sem erro. Estoque e snapshot anonimos continuam 401/no-store.
- Navegador autenticado confirma marca sem subtitulo, tres temas, submenu/Escape,
  estoque carregado e nenhum erro de console observado. Nao prova capacidade.
- Este registro e documental; nao exige nova reinicializacao da aplicacao.

## 2026-09-30 - Auditoria bloqueante antes da publicacao

- PR #109 integrado em 83f1b2f apos CI 36662908716 inteiramente aprovada.
- CI da main 36664719186 bloqueou a imagem por seis alertas de brace-expansion
  recem-incorporados ao resultado da auditoria; nenhuma publicacao ocorreu.
- Atualiza somente os overrides e resolucoes 1.1.18 -> 1.1.21 e 5.0.9 -> 5.0.12.
  Preserva as demais dependencias, requisitos Node/pnpm e todos os gates.
- Instalacao frozen e supply-chain aprovadas; pnpm audit sem vulnerabilidades
  conhecidas no reteste. Lint, tipos e build aprovados. Suite Windows: 987
  aprovados, um skip e seis falhas POSIX preexistentes; nova CI Linux obrigatoria.

## 2026-09-30 - Referencias da nova identidade

- CI 36660701681 aprovou validacao Linux, banco, advisors, restore e E2E.
- Matriz autenticada: 40 navegacoes, 193 auditorias de acessibilidade e 100
  cenarios de zoom aprovados; somente 44 diferencas visuais previstas no escopo.
- Inspecao das capturas confirmou as correcoes de temas/tablet e filtros/mobile.
  Promove 44 referencias do merge e985f6791de4dfd5681cc47429a6d5f06bc61d25;
  preserva outras 149, hashes/proveniencia e limites de regressao.
- Reteste local: 63 testes focados e 40/40 cenarios do preview com cookies reais.
  Revisao independente estatica sem novos achados; nao substitui CI integrada.
- Nova CI das referencias, merge e publicacao permanecem pendentes.

## 2026-09-29 - Identidade e navegacao dos simuladores

- Unifica marca e cabecalho dos quatro simuladores, sem "Inteligencia comercial".
- Navegacao recolhivel com submenus, fechamento externo, Escape e retorno de foco.
- Mantem Claro, Medio e Escuro visiveis; respeita consentimento funcional para
  persistir a escolha e corrige aplicacao inicial do tema e color-scheme.
- Preserva rotas, dados, formulas e politicas comerciais.
- Evidencias: docs/audits/identidade-navegacao-2026-09-29.md.
- QA mede cores estabilizadas e persiste falhas de navegacao por caso. Mantem
  bloqueio da publicacao e baselines antigas enquanto a matriz nao passar.
- Corrige sobreposicao do atalho de cookies no menu da Direta em 320 px;
  painel de consentimento continua acima da navegacao. Teste protege as camadas.
- Inspecao da CI detectou regra legada de 44 px nos temas em tablets e colisao
  entre Limpar filtros e o primeiro campo da Direta mobile. Corrige os escopos
  e amplia QA para medir conteudo dos botoes e separacao dos filtros.
- Validacao em andamento; merge e publicacao pendentes.

## 2026-09-29 - Colunas e repeticoes do Tabelao

- Limita as tres colunas indicadas nos prints, permitindo texto em varias linhas.
- Mescla por rowspan somente rotulos consecutivos iguais de Endereco e Limitador
  no mesmo empreendimento/incorporadora, sem excluir linhas ou dados de origem.
- Recalcula a mesclagem apos filtros e ordenacao; mantem precos e plantas intactos.
- Acrescenta testes de valores distintos, repeticoes separadas e limites de grupo.
- Desconta margens laterais na largura maxima da grade; harness final aprova
  os sete cenarios tambem com a borda inteiramente contida no painel.
- CI 36526268323 aprovou os contratos funcionais, acessibilidade, temas e zoom.
  Inspeciona e atualiza somente sete referencias visuais do Tabelao, preservando
  as demais 186 e registrando hashes/proveniencia. Nova CI integrada exigida.
- Validacao e evidencia: docs/audits/tabelao-colunas-2026-09-29.md.

## 2026-09-29 - Cabecalho compacto do Associativo

- Remove a trilha redundante e o rotulo "Simulacao comercial" do topo.
- Preserva o titulo principal, a ajuda contextual e o guia da pagina.
- Reduz somente os espacamentos do cabecalho Associativo em desktop e celular.
- Acrescenta teste de escopo para impedir retorno dos textos ou impacto em outros simuladores.
- Inspeciona as capturas da CI em 1440, 375 e 320 px e promove somente as onze
  referencias do Associativo, incluindo temas, tablet e celular.
- Alinha o catalogo com as vinte verificacoes do Tabelao ja executadas pelo QA,
  corrigindo a contagem antiga de dezesseis sem mudar o comportamento da tela.
- Lint, tipos, inventario e build aprovados. Suite Windows: 972 testes aprovados,
  um skip e seis falhas POSIX preexistentes; nova CI Linux exigida.

## 2026-09-28 - Carregamento concorrente do Tabelao

- Corrige repeticao de consultas apos falha com intervalo de cinco segundos
  por processo, autorizacao em cada acesso e recuperacao compartilhada.
- Limita leitura do snapshot no servidor a vinte segundos e consultas do
  Tabelao no cliente a vinte e cinco segundos, incluindo o corpo da resposta.
- Valida o payload antes da renderizacao; evita buscar complemento quando os
  enderecos vivos ja estao completos. Preserva valores, filtros e formulas.
- Acrescenta testes de falha, recuperacao, cancelamento e acessos concorrentes.
  Evidencias e limites: docs/audits/tabelao-concorrencia-2026-09-28.md.
- Lint, typecheck, build e formatacao aprovados. Windows: 967 testes aprovados,
  quatro skips condicionais e seis falhas POSIX preexistentes; CI Linux exigida.
  Gitleaks passou. Matriz autenticada ampliada aguarda execucao na CI.

## 2026-09-28 - Conteudo do Aprenda Associativo

- Amplia Politica com renda, indicadores, MCMV/SBPE, primeiro imovel e custos.
  Acrescenta 27 topicos de ajuda com local de aplicacao em Perguntas.
- Compartilha as explicacoes do perfil com o manual; corrige pro-soluto/anuais
  no texto, delimita estimativas locais e preserva todos os calculos.
- Revisao independente: 145 testes de dominio aprovados; cinco testes do manual.
  Suite Windows: 950 pass, um skip e seis falhas POSIX conhecidas, sem relaxar gates.
- Lint, tipos, build, oito testes Node e QA isolado do manual (30 capturas/axe)
  aprovados. CI Linux e verificacao publicada permanecem gates obrigatorios.
- Fontes, limites e publicacao: docs/audits/associativo-manual-conteudo-2026-09-28.md.

## 2026-09-28 - Navegacao do manual Associativo

- Sincroniza tamanho/hash da unica imagem revisada no catalogo de QA; preserva
  origem da captura nova e delta real contra a anterior. Sem alterar assercoes.

- CI 36486887891 aprovou funcionalidade do manual (30 capturas/axe), 140 rotas,
  80 temas, 193 axe e 100 verificacoes de zoom. Apenas a referencia Associativo
  1024x768 diferiu pelo menu corrigido. Inspeciona e atualiza somente essa imagem,
  com hashes/proveniencia no relatorio. Demais referencias e gates intactos.

- Destaca Politica e Perguntas como abas acessiveis com icones, selecao visivel,
  cabecalho fixo e rolagem por assunto. Preserva todo conteudo comercial.
- Isola a interface em componente/CSS proprio; outros simuladores e calculos
  permanecem iguais. Lucide 1.48.0 fixado e usado nos quatro icones do manual.
- Acrescenta tres testes unitarios e matriz Playwright com cinco viewports,
  tres temas, teclado, foco, ancoras, axe e capturas de ambos os paineis.
- Lint, tipos e build locais aprovados; suite Windows: 948 pass, um skip e
  seis falhas POSIX ja existentes. Oito Node passaram. Matriz local do manual:
  30 capturas/axe e interacoes aprovadas. CI Linux integrada ainda pendente.
- Detalhes: docs/audits/associativo-manual-2026-09-28.md.
- QA aguarda o evento nativo close antes de conferir a limpeza da ancora;
  fechamento e retorno do foco podem anteceder esse evento do navegador.
- Isola cores dos titulos e foco contra CSS legado carregado depois do modulo,
  conforme a ordem observada no manifesto do build Next.
- QA usa o seletor de tema real do simulador (Medio), distinto do shell geral
  (Equilibrado), sem navegar para fora da proposta sintetica selecionada.
- CI 36483450994: manual passou em 375/768, mas o menu legado cortou os temas
  em 1024px. Reproduzido na web; corrige somente o cabecalho Associativo entre
  821 e 1100px, usando o padrao existente nos outros simuladores. QA verifica
  a geometria do seletor e informa a etapa sem dados sensiveis. Referencia
  visual de 1024px deve ser inspecionada e atualizada; demais baselines intactas.

## 2026-09-28 - Publicacao e evidencias finais do Associativo

- PR #102 e CI main 36437130674 aprovados; release 3d92b7a publicada em 15:01 UTC,
  com backup, CAS, imagem anterior preservada e verificacao autenticada.
- Esclarece ID config versus manifesto entre Docker classic/containerd com
  prova criptografica e onze camadas equivalentes; sem rebuild ou retag no VPS.
- Registra testes Linux, quatro sessoes/20 chamadas, smoke real limitado e
  rejeicao de anual/parcelas invalidas no navegador publicado.
- Documenta limites: atualidade da fonte e autoridade WF13/arquivo pendentes.
  Esta etapa altera somente documentacao; publicar no Git e sincronizar
  conhecimento, sem novo restart ou deploy da aplicacao.

## 2026-09-28 - Auditoria Associativo e concorrencia

- Segunda CI confirmou isolamento de propostas e bloqueio de anual acima de
  50%; revelou clamp silencioso de parcelas no Associativo. Remove somente esse
  clamp, mantendo valor invalido visivel e calculo bloqueado. QA confere estado
  estavel apos frames e usa reduced motion, como a suite E2E existente.

- CI inicial: 947 testes Linux e transferencia concorrente Nginx passaram;
  ensaio HTTP integrado passou, mas segunda sessao UI falhou. Acrescenta
  codigos de etapa sem logs de credenciais para diagnosticar, sem reduzir gates.

- Reproduz estoque indisponivel em duas aberturas autenticadas; correlaciona
  transferencia JSON parcial com timeout de leitura, antes de qualquer carga.
- Corrige contrato do inventario, identidade ambigua entre fontes, parcelas
  extremas, datas invalidas e incoerencias da aprovacao monetaria.
- Preserva indice anual elegivel, datas de sinais do core e evolucao em meses
  com sinais/anuais, sem criar taxas ou politicas comerciais.
- Adiciona testes concorrentes isolados e compressao Nginx com dados sinteticos.
  Imagens construidas/provadas na CI, fora do VPS.
- Persiste autorizacao permanente de publicacao apos validacao, delimitada a
  este repositorio, nas regras compartilhadas e no runbook automatic-publication.
- Evidencia inicial: docs/audits/associativo-concorrencia-2026-09-28.md. Resultado
  final de CI, release e verificacao operacional vinculado ao PR.

## 2026-09-28 - Caveman e revisao de recursos/estoque

- Pesquisa fontes oficiais Caveman, Vercel/Next, Chrome DevTools, Codex e advisory
  Vitest; catalogo confirmou Context7 disponivel, sem necessidade de instalar.
- Matriz integra sete skills Caveman locais e sete globais condicionais; sete
  perfis crm-\* recebem retorno Cavecrew sem perder evidencias ou autorizacoes.
- Inventario confere onze skills locais e presenca na matriz, alem de 40 rotas.
- Instala/configura MCPs de desenvolvimento local; sem gateway de prompts,
  SDK de rastreamento, conta adicional, trust ou permissao ampliada.
- Corrige perda da selecao/proposta por filtros e bloqueio indevido da resposta
  viva; adiciona regressao de navegador com fontes inteiramente sinteticas.
- Compartilha leitura validada do snapshot entre chamadas concorrentes, mantendo
  autorizacao individual e no-store; falhas liberam nova tentativa.
- Revalida Associativo em quatro larguras e estados de dashboard/ranking/parcerias
  em producao somente leitura. Sem benchmark de melhora ou certificado integral.
- PR #65 (Vitest 4.1.11) revisado no SHA 4985705 e integrado com os tres gates
  aprovados; merge b563460. Nenhum workflow n8n ou dado remoto alterado.
- Validacao final e evidencias vinculadas ao PR desta branch; sem deploy.
- Local: lint, tipos, build, inventario e protocolo MCP passaram; 806 testes
  Vitest aprovados, seis falhas POSIX preexistentes e um skip. Oito testes Node
  Salesforce passaram separadamente. Gitleaks, audit e OSV passaram sem achados;
  SDK transitivo do Next corrigido para 1.30.1 e protocolo retestado.

## 2026-09-28 - disponibilidade e selecao de ferramentas

- Confirma Codex Security instalado/habilitado no catalogo e acrescenta rotas
  para auditoria de diff/repositorio sem rodar todos os scans automaticamente.
- Instala Gitleaks 8.30.1 e OSV-Scanner 2.6.0 de releases oficiais, conferindo
  SHA-256 antes de executar; PATH existente e scripts anteriores preservados.
- Gitleaks passou. OSV executou e encontrou o advisory moderado conhecido do
  Vitest 4.1.10, cuja correcao esta proposta no PR Dependabot #65; nao criou ignore.
- Adiciona resources:doctor e 16 testes de runtime incorreto, pacotes ausentes,
  exports privados, resposta invalida de CLI e Docker opcional no desktop.
- Revisao independente encontrou e corrigiu dois falsos positivos: Supabase
  sem binario de plataforma e scanners de versoes incompativeis com os scripts.
- Delegacao real crm-qa confirmou perfil recebido e inventario de 40 rotas/
  APIs, nove areas, sete perfis e quatro skills proprias sem lacuna impeditiva.
- Doctor real passou; lint, tipos, build e formatacao aprovados localmente.
  Os 16 testes novos e os 26 de conhecimento/inventario passaram. Suite geral
  Windows mantem seis falhas POSIX conhecidas; timeout inicial de conhecimento
  nao se repetiu com dois workers. Oito testes Salesforce passaram separadamente.
- Gates Linux vinculados ao PR desta branch; sem deploy nem dados remotos alterados.

## 2026-09-28 - recursos e recuperacao de conhecimento

- Entrega e checks: PR #99, branch codex/recursos-memoria-crm.
- Diagnostico do CLI carregou configuracao; sondagem opcional n8n teve timeout,
  registrado sem alterar credenciais, permissoes ou usar REST.

- Audita 40 arquivos de paginas/APIs em nove areas e inspeciona 19 rotas em
  producao somente em leitura. Bloqueios de metas, ranking e conciliacao ficam
  documentados, sem alterar politicas ou dados para remove-los.
- Adiciona busca local de aprendizados entre worktrees, com proveniencia,
  deduplicacao, limites, protecao de integridade e sem ler chats/notas privadas.
- Versiona sete perfis de agentes e quatro skills de dominio, com escolha
  automatica e delegacao proporcional no AGENTS, sem ampliar permissoes.
- Inventario verificavel associa cada rota a area, agente, skill e referencias;
  testes falham quando uma nova rota nao estiver mapeada.
- Validacao local: 26 testes especificos, lint, tipos, build e formatacao passam;
  suite geral: 744 passam, seis falham por pressupostos POSIX no Windows e um
  skip existente. Os oito testes Node Salesforce passaram separadamente.
- Sete TOMLs e quatro skills validados. Revisao independente da busca levou a
  quatro endurecimentos, cobertos por testes; nova revisao sem achado restante.
- Runtime atualizado nos tres checkouts locais, busca pela branch antiga e
  leitura no Obsidian verificadas. Backup de 100 arquivos restaurado por hash.
- Audit nao encontrou altas/criticas; dois alertas moderados do mesmo advisory
  Vitest permanecem rastreados no PR Dependabot #65. CI Linux valida o candidato.
- Sem deploy, migration, alteracao de n8n, SDK novo ou conexao de conta.

## 2026-09-27 — promoção final das referências do Tabelão

- O QA hospedado do candidato aprovou o Tabelão nos quatro viewports exigidos,
  incluindo todas as colunas, agrupamentos, filtros, última linha, estados de
  carga/vazio/erro/recuperação, foco e Escape. Oito comparações restantes eram
  apenas referências antigas do hub, ainda anteriores às três jornadas ativas.
- A primeira promoção local foi recusada ao detectar no Associativo uma colisão
  móvel entre os metadados do estoque e os filtros, além do alvo de toque
  insuficiente de Limpar filtros. A transação não gravou referências parciais.
- O cabeçalho e a ação dos filtros agora usam duas linhas explícitas somente em
  `.investor-associative-table-page` até 760 px. O seletor não alcança Tabelão,
  Direta, Investidor nem desktop e não modifica dados ou regras comerciais.
- A matriz autenticada final aprovou 140 checks responsivos, 80 de tema, 193 de
  acessibilidade, 193 comparações e 100 de zoom. Foram promovidas oito imagens
  canário do hub e três imagens mobile do Associativo; as outras 182 referências
  permaneceram inalteradas.

## 2026-09-27 — conhecimento local no Obsidian

- Adiciona contexto, aprendizados e matriz de selecao automatica de ferramentas
  para todos os chats do projeto, sem exigir mencoes repetidas do usuario.
- Sincronizador local de documentos selecionados, separado por checkout, com
  historico idempotente, verificacao de integridade e recusa de links/credenciais.
- Hooks Git compartilhados entre worktrees; nao altera hooks de confianca do
  Codex, contas externas, telemetria, workflows n8n nem runtime do CRM.
- Instalacao local conferida nos tres checkouts e pelo CLI do Obsidian; backup
  anterior com 77 arquivos restaurados e hashes equivalentes.
- Passaram 14 testes especificos, lint, tipos e build das 41 rotas no Windows.
  A suite geral encontrou as seis falhas preexistentes de permissoes POSIX;
  a CI Linux do PR e a referencia para a validacao integral.

## 2026-09-27 — alvo de toque do Associativo

- A conferencia na pagina publicada confirmou estoque real carregado e ausencia
  de sobreposicao. A altura de Limpar filtros ainda era 25 px devido a um
  `min-height` herdado com `!important`; a regra mobile agora tem a mesma prioridade.
- A matriz autenticada passa a medir tambem a altura real minima de 44 px do
  botao em viewports ate 760 px, sem alterar outros simuladores ou calculos.

## 2026-09-27 — desempenho do estoque Associativo

- A origem publica levou 3,43 s para responder 1.268.041 bytes na medicao inicial
  desta maquina. O cliente aguardava o snapshot antes de iniciar a consulta viva.
- As fontes agora sao consultadas em paralelo, preservando o enriquecimento do
  snapshot antes da selecao e o estoque de propostas ja iniciadas. Consultas sao
  canceladas ao sair da pagina; a Tabela Direta permanece exclusiva do snapshot.
- O servidor reutiliza JSON validado por 30 segundos e deduplica requisicoes
  simultaneas, com autorizacao em todas as chamadas e HTTP `no-store`.
- Adicionados tempos de autorizacao/estoque e estado do cache nos cabecalhos.
  Facetas usam uma passagem; ordenacao e opcoes dos selects sao reutilizadas.
  Filtros ficam desabilitados durante carga/erro e a tabela informa `aria-busy`.
- Instalados Node 24.19.0 portatil e dependencias do lockfile no checkout.
  Figma, Datadog, PostHog, Linear e Supabase ja estavam instalados. PostHog exige
  autenticacao; nao foi adicionado SDK nem criada conta externa.
- Lint, TypeScript e build com 41 rotas aprovados no Windows. A suite integral
  passou no Linux: 724 testes Vitest e 8 testes Node, com um caso opcional
  ignorado. As seis falhas locais de permissoes POSIX nao ocorrem no Linux.
- A revisao visual encontrou sobreposicao preexistente entre Limpar filtros e o
  primeiro campo no celular. Cabecalhos do Associativo passam a crescer com o
  conteudo; o botao tem alvo minimo de 44 px. A matriz visual mede colisoes entre
  titulo, botao, campos e metadados do estoque, alem da comparacao de imagens.
- `pnpm verify` completo aprovado no Linux no commit `7068a1c`, incluindo build
  das 41 rotas. A matriz autenticada aprovou 140 checks responsivos, 80 de tema,
  193 de acessibilidade e 100 de zoom, sem colisoes no estoque Associativo.
  Foram promovidas somente tres referencias mobile; as outras 190 permaneceram.
- Benchmark com 3.301 unidades e 100 amostras: a mediana das facetas por regiao
  caiu de 57,023 ms para 12,449 ms, com resultados equivalentes. Esse ganho nao
  representa o tempo total de abertura, que continua dependente da origem fria.

## 2026-09-26 — rótulos e tipografia dos cabeçalhos do Tabelão

- Medições no Chromium confirmaram 8 px em Incorporadora e 10 px nos outros
  onze cabeçalhos, nos quatro viewports obrigatórios. A redução literal pedida
  definiu os novos valores em 4 px e 6 px, sem alterar o texto do corpo.
- Os oito rótulos longos foram substituídos apenas na apresentação visual e nos
  `data-label` responsivos. Os nomes completos permanecem nos `aria-label` dos
  cabeçalhos para preservar o contexto exposto a tecnologias assistivas.
- A semântica foi reconciliada com os campos oficiais: Estoque usa
  `availableUnits`; Valor Imóvel usa `minimumPrice`; Volta ao Caixa usa
  `cashBackSlack`; Avaliação usa `appraisal`; Endereço usa a composição
  protegida; % Obra usa `progress`; e Limitador usa `classification`.
- A matriz autenticada validou os quatro viewports exigidos, agrupamento,
  filtros, carga, vazio, erro, recuperação, foco, Escape, largura automática e
  overflow. Passaram 140 checks responsivos, 80 de tema, 193 de acessibilidade,
  193 comparações visuais e 100 de zoom.
- Sete referências visuais do Tabelão foram promovidas transacionalmente a
  partir da árvore limpa no commit
  `51c95928f09e75dad570066f0038fb6ababadcd0`; as outras 186 foram preservadas.

## 2026-09-26 — colunas automáticas e densidade horizontal do Tabelão

- Confirmado que as doze larguras fixas somavam 2.080 px e ampliavam inclusive
  colunas cujo conteúdo exigia menos espaço. O Tabelão passou a usar
  `table-layout: auto`, largura intrínseca e mínimo de 100% do painel.
- Removido o truncamento local por reticências. Textos completos determinam a
  largura natural e continuam contidos pela rolagem horizontal do painel, sem
  criar overflow na raiz da página.
- O rótulo de cabeçalho Incorporadora foi reduzido de 10 px para 8 px. Valores
  comerciais e demais textos mantêm seus tamanhos anteriores.
- Nenhum helper, agrupamento, filtro, valor, API, autorização ou fonte de dados
  foi alterado. Auditoria independente reconciliou novamente 2.243 IDs, 53
  opções, 23 empreendimentos, 2.503 combinações de filtros, quantidades,
  `rowSpan`, mínimos, ordem e detalhes da unidade vencedora.
- A primeira matriz autenticada aprovou os quatro viewports do Tabelão, incluindo
  largura automática, diferença exata de 2 px, conteúdo integral, rolagem até a
  última coluna, 130 linhas agrupadas e zero overflow na página. Também passaram
  140 checks responsivos, 80 de tema, 193 auditorias Axe e 100 de zoom; somente
  as sete imagens esperadas do Tabelão diferiram da referência fixa anterior.
- As sete imagens revisadas foram promovidas por troca transacional a partir da
  árvore limpa no commit `2032282713c781b4e46536f93f26d3d022a016fd`. A execução
  final aprovou 140 checks responsivos, 80 de tema, 193 de acessibilidade, 193
  comparações visuais e 100 de zoom; as outras 186 referências foram preservadas.
- Lint, tipos, build de 41 rotas, 642 testes Vitest e oito testes Node passaram.
  Duas revisões independentes não encontraram bloqueios; uma registrou apenas que
  a captura móvel geral termina antes da tabela, coberta funcionalmente em 375 px.

## 2026-09-26 — novas colunas e endereço completo no Tabelão

- Continuada a implementação agrupada da PR #87. Unidades saiu da primeira
  posição e ficou imediatamente antes de Menor valor; a tabela agora possui
  doze colunas e mantém as células mescladas por empreendimento.
- Mapeados os campos oficiais: `cashBackSlack`, `appraisal`, `street` +
  `streetNumber` + `neighborhood`, `progress` e `classification`. Todos os
  detalhes comerciais pertencem à unidade vencedora do menor valor; quantidade
  continua sendo `COUNT DISTINCT id` no grupo.
- A fonte viva de 2.243 IDs contém folga, avaliação, bairro e andamento nos 53
  representantes e `classification` bruto em 52; após remover o sentinela `0`,
  Outras descrições possui conteúdo exibível em 50. A fonte não contém logradouro
  nem número.
  O snapshot protegido complementa somente os campos de endereço ausentes por
  correspondência da unidade ou por endereço completo e único do empreendimento.
  Referências ambíguas ou conflitantes com componentes vivos não são combinadas.
  A interface informa a referência do complemento, sem bloquear a exibição da
  fonte viva, e qualifica sua data como estoque publicado, não atualização atual.
- Cobertura adicionada para zero monetário, preservação dos detalhes da unidade
  vencedora, escala de andamento 0–1, enriquecimento coerente sem mutação, doze
  cabeçalhos, ordem Unidades/Menor valor, estados com `colSpan` completo e QA
  responsivo.
- Auditoria real reconciliou 2.243 IDs, 53 opções, 23 empreendimentos, zero
  exclusões e 2.503 combinações de filtros. Entre as 53 linhas vencedoras, 28
  receberam endereço por unidade compatível, sete por endereço completo e único
  do empreendimento e 18 permaneceram explicitamente sem complemento.
- QA autenticado aprovou quatro larguras do Tabelão, carga viva antes da
  referência, três linhas de metadados sem sobreposição, endereço posterior,
  vazio, erro, recuperação, guia e expansão acima de 60 linhas. A matriz completa
  aprovou 140 checks responsivos, 80 de tema, 193 de acessibilidade, 193
  comparações visuais e 100 de zoom antes da revisão final.

## 2026-09-26 — Tabelão expansivo, quantidades e células mescladas

- Removidos janela de 60 linhas, espaçadores e limite vertical somente no Tabelão.
  Todas as plantas filtradas são renderizadas; a página cresce com o estoque.
- Primeira coluna passa a informar IDs distintos do estoque por incorporadora,
  empreendimento e planta. Quantidade independe dos filtros e da elegibilidade
  financeira; `pricedUnits` mantém o aviso de dados incompletos separado.
- Cada empreendimento usa um `tbody` e duas células `rowSpan`, preservando todas
  as opções, filtros, ordenação, fórmula e detalhes da unidade de menor valor.
  Cabeçalhos de grupo associados às células e nomes completos com quebra de linha.
- Adicionada regressão sintética de 130 plantas, três empreendimentos e unidade
  sem preço, em quatro viewports: expansão, quantidades, mesclagem, ordenação,
  filtro, limpeza e alcance da última linha. Auditoria independente confere
  quantidades e extensão de todos os grupos sem persistir unidades comerciais.
- Instaladas as 20 skills do pacote JuliusBrussee/caveman no diretório pessoal
  `.codex/skills`, fixadas em `2fd153c67988e980fb0b2455c90832159a6a5a25`.
  Sem instalar proxy, alterar preferências ou comprimir conteúdo desta entrega.
- Verificados por hash os 48 arquivos das 20 skills instaladas.
- Auditoria da fonte em 26/09/2026: 2.243 IDs distintos, 53 opções e 23 grupos;
  soma das quantidades igual a 2.243, todos os mínimos e `rowSpan` reconciliados,
  2.503 combinações de filtros verificadas. Fonte gerada em 07/08/2026, sem
  campos obrigatórios ausentes; não representa atualização comercial em setembro.
- Typecheck e build locais passaram. Suíte Windows: 632 testes passaram, quatro
  ignorados e duas falhas preexistentes de modo POSIX `0600` retornando `0666`.
  A validação Linux completa e as evidências visuais acompanham a publicação.
- `pnpm verify` aprovado na VPS: lint, typecheck, 634 testes Vitest e oito testes
  Node, quatro ignorados e build concluído. Imagem
  `sha256:cd252b6cc0551eed44a09da32f5a09b3b677d46f38e3ebeae72ba72b731d116c`
  comprovada sem rebuild nos dois perfis de runtime.
- Publicado `809a048c8fed52d4cb4a2cdda731b2a07abdbce8` com backup e rollback.
  Health público confirmou a revisão; `GET /api/inventory` anônimo retornou 401.
  Revisão autenticada em 1440, 1024, 768 e 375 px confirmou 53 linhas, 23 grupos,
  2.243 unidades, filtros, ordenação, ausência de overflow horizontal da página,
  tabela sem rolagem vertical interna e última opção acessível. Nenhum erro JS.
- CI `36220767591`: todos os critérios funcionais, 140 checks de rota, 80 de
  tema, 193 de acessibilidade e 100 de zoom aprovados. Diferenças restritas a sete
  imagens do Tabelão. Inspecionadas e promovidas da captura limpa
  `d28120044ccac5aaf6eea239336a0b4a5101150f`, com árvore igual à versão publicada,
  hashes e baseline conferidos; 186 imagens existentes e limiares preservados.

## 2026-09-24 — restauração dos filtros solicitados

- Reaproveitado o visual do painel da Tabela Associativo para os seis controles
  do print, com ajuda contextual e Limpar filtros. Sem alteração nas sete colunas.
- Seleção por incorporadora, empreendimento, região, planta e valor líquido ocorre
  após a escolha da unidade mínima. Contadores representam opções exclusivas,
  considerando as demais dimensões ativas; valores são comparados em centavos.
- Ordenação atua dentro de cada empreendimento; limpeza restaura ordem crescente
  e todas as opções. Filtros e ordenação reposicionam a rolagem; exclusões por dados
  inválidos permanecem separadas das linhas ocultas por seleção.
- Skills Data aplicadas ao grão, denominadores e reconciliação; UX e React ao
  reaproveitamento visual, controles nativos rotulados e cálculos memorizados.
  Sem mudanças de fonte, autenticação, banco, ACL ou workflows n8n.
- Validação local: lint, tipos, build e 31 testes focados aprovados. Suíte Windows
  com 629 testes aprovados e somente as duas falhas conhecidas de modo POSIX 0600.
  Auditoria independente: 2.243 unidades, 53 opções, 23 empreendimentos, nenhuma
  exclusão e 2.503 combinações de filtros reconciliadas. Data da fonte preservada.
- Suíte Linux completa aprovada: 639 testes (631 Vitest e oito Node), quatro skips.
  Imagem comprovada nos dois perfis e publicada; health público e proteção 401
  confirmados. Conferência autenticada motivou ajuste de singular nos contadores
  e nomes acessíveis explícitos nos seletores.
- Corrigida sobreposição mobile de Limpar filtros com o primeiro seletor: cabeçalho
  em duas linhas de 44 px e altura automática apenas no Tabelão. QA passa a medir
  a separação entre botão e primeiro campo nos quatro viewports.
- `pnpm verify` completo aprovado no Linux após a correção. Publicada imagem
  `b9a9379d1a6111f099a57b39a0010efe8658baaa`, comprovada em dois perfis de runtime.
  Health público confirmado; navegador autenticado validou combinações dos cinco
  filtros, limpeza, singular, ordenação dentro dos grupos, quatro larguras sem
  sobreposição/overflow e console sem erros. API anônima permanece 401.
- CI `36081141236` aprovou código, restauração, autorização, E2E e todos os
  critérios funcionais da matriz: 140 responsivos, 80 temas, 193 acessibilidade,
  100 zoom e 13 critérios do Tabelão. Apenas dez diferenças visuais desta rota.
  Capturas revisadas e promovidas com hashes/árvore conferidos; outras 183 imagens
  e limiares preservados. Proveniência em docs/qa/reference-parity.

## 2026-09-24 — correção da exclusividade pela coluna Planta

- Aplicada a correção dos dois prints: coluna Empreendimento sem produto/unidade e
  apenas uma opção por empreendimento e planta, escolhida pelo menor líquido em centavos.
  Incorporadora continua separando empreendimentos homônimos. Área não define o grupo.
- Mantidas as sete colunas, as plantas distintas, os dados da unidade vencedora,
  a ordenação por empreendimento e a fórmula solicitada. Área inválida aparece
  como traço, sem excluir o menor preço nem alterar a fonte.
- Skills Data aplicadas ao contrato da métrica, qualidade da fonte e reconciliação
  independente; UX, acessibilidade e React aplicados ao componente existente.
- Regressões cobrem áreas diferentes da mesma planta, menor líquido versus bruto,
  empate, ausência de área, preservação de todas as plantas e nome exibido.
  Sem alteração de API, autorização, banco ou workflows n8n.
- Auditoria independente da fonte SPC: 2.243 unidades e IDs únicos, 53 opções
  em 23 empreendimentos; todos os mínimos e grupos reconciliados, nenhuma linha
  excluída. Fonte gerada em 07/08/2026, sem afirmar atualização comercial posterior.
- Tipos e build local aprovados. Suíte Windows: somente as duas falhas já
  conhecidas de permissões POSIX; confirmação completa será feita no Linux.
- Suíte Linux aprovada: 635 testes (627 Vitest e oito Node), quatro skips.
  Lint local/Linux, tipos, build e validação geral do CI aprovados.
- Publicada `8ae74956a3fa5c5ec831273e789da32767cdb25c` após prova de imagem.
  Health público confirmado e API anônima responde 401. Conferência autenticada:
  53 plantas exclusivas em 23 empreendimentos, nomes e fórmulas corretos, quatro
  larguras sem sobreposição ou overflow da página, console sem erros.
- Matriz CI interrompida duas vezes na etapa do Tabelão. O teste enviava Escape
  sem aguardar o foco transferido por requestAnimationFrame; o acionador tem
  aria-haspopup e Escape nele não fecha o painel. QA passa a aguardar foco no
  painel e retorno ao acionador; logs registram subetapas sem dados comerciais.
- CI `36059484259` confirmou todos os critérios funcionais, incluindo os 13 do
  Tabelão; o bloqueio do guia deixou de ocorrer após sincronização de foco.
  Restaram somente nove diferenças visuais da mudança solicitada. Referências
  revisadas e promovidas com hashes e árvore Git conferidos, preservando outras
  184 imagens e todos os limiares. Proveniência em docs/qa/reference-parity.

## 2026-09-24 — agrupamento das opções por empreendimento

- Alterada apenas a ordem do Tabelão: empreendimento alfabético, incorporadora
  para separar homônimos e menor valor líquido dentro de cada grupo. Nomes usam
  a mesma normalização da seleção exclusiva, sem modificar os dados exibidos.
- Mantidas todas as plantas e metragens, a fórmula em centavos, os contadores,
  a janela de 60 linhas e os dados completos da unidade. Sem alteração de API,
  autorização, banco ou workflows de simulação.
- Acrescentadas regressões para agrupamento, nomes normalizados, homônimos,
  valores líquidos, empate e preservação integral das opções; QA visual passa a
  conferir os grupos e preços internos em vez de ordenação global por preço.
- Corrigida a altura virtual no desktop para 25 px: o alvo de 24 px mais a borda
  da célula produzia linhas maiores que os 24 px estimados. Falha observada no
  QA anterior e confirmada por medição do navegador; mantidos os alvos de toque.
- Auditoria da fonte confirmou 2.243 unidades, 120 opções em 23 empreendimentos,
  sem perda de tipologias, grupos intercalados ou preços fora de ordem interna.
- Validação: formatação, lint, tipos e build aprovados; 22 testes focados e 630
  testes completos no Linux (622 Vitest, quatro skips existentes, oito Node).
  No Windows persistem somente os dois asserts POSIX 0600 já documentados.
- Publicada a imagem `1492a18e7fef89afce79731aa072a78150744d07`, após prova dos
  dois perfis de runtime. Health local e público confirmados; backup do ambiente
  anterior preservado para rollback.
- Conferência autenticada de todas as 120 opções: IDs únicos, 23 grupos
  contíguos, preços crescentes dentro de cada grupo e 120 fórmulas corretas em
  centavos. Telas de 1440, 1024, 768 e 375 px sem overflow da página ou sobreposição
  do cabeçalho; console sem erros.
- A captura completa na VPS parou na leitura das fixtures do Supabase local de
  QA. Conta e dados efêmeros foram limpos; nenhuma migration, policy ou dado de
  produção foi alterado. A matriz limpa do CI continua sendo a evidência de
  regressão visual, separada da conferência autenticada em produção.
- CI `36015516477`: todos os critérios funcionais aprovados, inclusive os 13 do
  Tabelão; falha restrita a dez imagens antigas desta rota. Capturas sintéticas
  revisadas em todos os tamanhos/temas afetados e promovidas pelo mecanismo
  transacional existente, com validação dos hashes, igualdade da árvore Git do
  código capturado e integridade da baseline anterior. Evidência registra a
  origem do artefato CI; nenhum limiar ou teste foi relaxado e nenhuma captura
  de outra rota foi alterada.

## 2026-09-24 — menor valor líquido por empreendimento, planta e área

- Aplicadas as skills solicitadas de definição da métrica, qualidade e validação
  de dados, UX, interfaces e React ao recorte do Tabelão.
- Conectado o helper exclusivo à página, com chave de incorporadora,
  empreendimento, planta e área sem arredondamento. Mantidos dados completos da
  unidade vencedora, vagas, lojas, fonte e data, sete colunas e janela virtual.
- Conta em centavos: `finalWithKit - unitBonus - tableSlack`; sem fallback para
  `finalPrice` ou zero em campo ausente. Desempate por identificador/produto/ID.
- Auditoria independente da origem em 24/09/2026: 2.243 linhas e IDs únicos,
  zero ausências nos campos exigidos, zero exclusões, 120 opções em 23
  empreendimentos; todos os mínimos e grupos conferidos, incluindo inversão da
  ordem da fonte. A origem informa geração em 07/08/2026, não em 24/09.
- Node 24.19.0 / pnpm 11.20.0: `pnpm lint`, `pnpm typecheck` e `pnpm build`
  aprovados; 19 testes focados aprovados. `pnpm test` no Linux aprovou 619 testes
  Vitest (quatro skips existentes) e oito testes operacionais. No Windows, apenas
  os dois asserts preexistentes de modo POSIX 0600 falham, recebendo 0666.
- QA visual versionado atualizado para os grupos exclusivos, preços líquidos,
  ausência dos filtros e guia de três passos. A sessão autenticada do navegador
  está disponível para a conferência responsiva após a promoção da imagem.
- PR #87 aberto. Corrigida a formatação do cliente e do changelog apontada pelo
  primeiro CI; a imagem passou na prova dos perfis de homologação e produção.
- Publicação inicial confirmada em sessão autenticada: 120 IDs únicos acessíveis
  nas janelas inicial/final, índices 2 a 121 e conta completa nos valores. A revisão
  em 1440, 1024, 768 e 375 px detectou cabeçalho móvel fixo em 40 px sobrepondo
  contador/data à tabela; aplicado ajuste escopado e incluído critério de não
  sobreposição no QA responsivo.

## 2026-09-24 — remoção dos filtros do Tabelão

- Removida a faixa visual “Filtros do estoque” de `/app/simulacao/tabelao`,
  incluindo os selects de incorporadora, empreendimento, região, planta, valor,
  ordenação e o botão de limpar filtros.
- O Tabelão continua buscando exclusivamente `GET /api/inventory` com
  `no-store`, exibindo o estoque completo em sete colunas, janela virtual de 60
  linhas e atalho para a Tabela Direta.
- A ordenação fica fixa em valor crescente e o guia deixou de mencionar passos
  de filtro ou ordenação.
- Validação do recorte: `pnpm vitest run tests/tabelao-archive.test.ts`,
  `pnpm lint`, `pnpm typecheck` e `pnpm build` passaram com Node 24.19.0 e pnpm
  11.20.0.
- `pnpm test` completo ainda falha em Windows apenas nos asserts existentes de
  modo `0600` em `tests/mapping-import.test.ts` e
  `tests/commercial-engine.test.ts`, que recebem `0666`; o teste do Tabelão
  passou.

## 2026-09-24 — cópia visual do Associativo no Tabelão

- A estrutura ativa de `/app/simulacao/associativo-fluxo-linear` foi usada como
  referência direta: shell, cabeçalho, breadcrumb, hero, ajuda, guia, painel 01,
  filtros, tabela, disclaimer e rodapé agora compõem o Tabelão.
- O Tabelão continua somente leitura e usa exclusivamente `GET /api/inventory`
  com `no-store`; não incorporou o motor, os cálculos, o snapshot nem a exclusão
  de vagas da modalidade Associativo.
- A fonte viva respondeu com 2.243 itens declarados e recebidos, 2.243 IDs
  únicos e nenhuma ausência ou invalidade nas sete colunas. O campo bruto de
  região não existe, mas o resolver compartilhado derivou região para 100% das
  unidades. A origem informa atualização em `2026-08-07T04:04:47.972Z`, ponto
  de atenção de frescor por não existir SLA conhecido.
- Os filtros encadeados usam os helpers já consolidados da Tabela Associativo;
  a janela continua limitada a 60 linhas e conserva todas as 2.243 unidades.
- Em até 1.239 px, o Tabelão mantém tabela linear com rolagem interna e linha de
  44 px, evitando a incompatibilidade entre cards de altura variável e os
  espaçadores do virtualizador. Controles também mantêm 44 px e selects de
  16 px nos viewports estreitos.
- O guia possui cinco passos funcionais, destaque do alvo, Escape, progresso,
  navegação anterior/próximo e devolução de foco ao botão inicial.
- Validação focada aprovou TypeScript, 31 testes e build Next.js com 41 rotas.
  A matriz autenticada final aprovou 140 checks responsivos, 80 checks de tema,
  193 auditorias Axe e comparações visuais e 100 checks de zoom; os 13 checks
  funcionais exclusivos do Tabelão também passaram.

## 2026-09-23 — Tabelão unitário e compacto

- Removidos do Tabelão o painel “Consulta exclusiva”, sete filtros e os quatro
  KPIs, conforme a referência visual indicada.
- A tabela deixou de agrupar empreendimento + planta e passou a mostrar uma
  linha por unidade, ordenada pelo valor, com as mesmas sete colunas e medidas
  visuais da Tabela Direta.
- A primeira coluna abre a rota existente da Tabela Direta sem alterar seu
  código ou pré-selecionar dados; o Tabelão continua somente leitura.
- A lista usa janela de 60 linhas, cabeçalho fixo e estados de carregamento,
  vazio e erro dentro da própria tabela.
- A fonte viva respondeu com 2.243 linhas declaradas e recebidas, 2.243 IDs
  únicos, zero duplicidade, ausência ou valor/formato inválido nas sete colunas;
  a atualização informada pela origem permanece em `2026-08-07T04:04:47.972Z`.
- O navegador validou `375x812`, `768x1024`, `1024x768` e `1440x900`: sete
  cabeçalhos, 60 linhas na janela, alcance da última unidade, foco visível,
  nenhum overflow de documento, erro de console/request ou violação Axe.

## 2026-09-23 — Tabelão protegido

- Criada a rota estática `/app/simulacao/tabelao` fora do segmento dinâmico dos
  cinco motores, com `crm.simulators.view` repetido no Proxy, layout, página e
  endpoint `GET /api/inventory` já existente.
- A composição replica integralmente `/simulacao/tabela`: cabeçalho, breadcrumb,
  hero, aviso, sete controles, quatro indicadores, tabela, cartões mobile e
  disclaimer. CSS e regras arquivados foram reutilizados sem nova biblioteca.
- O item Tabelão deixou de retornar ao hub e agora aponta para a rota dedicada,
  com `aria-current` correto.
- O shell protegido e o breadcrumb autorizado reconhecem o Tabelão como réplica
  arquivada; assim, somente o cabeçalho próprio da referência é renderizado.
- A revisão Axe encontrou contraste insuficiente herdado no breadcrumb e no
  texto dos cartões, sobretudo no tema escuro; seletores escopados ao Tabelão
  passaram a usar seus tokens semânticos. O título do banner de cookies recebeu
  cor explícita. O `html` agora suprime somente a diferença esperada do tema
  aplicado pelo script antes da hidratação.
- A inspeção em navegador corrigiu o overflow do menu e da tabela no tablet. A
  matriz final em `375x812`, `768x1024`, `1024x768` e `1440x900` passou sem
  overflow de documento e sem violações Axe WCAG A/AA nos temas claro, médio e
  escuro; vazio, limpar, ordenar, erro e nova tentativa também foram exercitados.
- A validação somente leitura da fonte viva confirmou payload coerente: 2.243
  itens declarados e recebidos, zero empreendimento/planta ausente, zero preço
  inválido, 53 combinações exclusivas, 23 empreendimentos e 19 plantas em
  `2026-08-07T04:04:47.972Z`. Cada menor preço foi recalculado contra as linhas
  do respectivo grupo.
- Testes cobrem rota/menu, ausência de fallback, estados, temas, responsividade,
  grão exclusivo, desempate, filtros, ordenação, resumo e autorização pre-stream.
- Site público de referência, banco, migrations, dados, APIs, integrações e
  produção permaneceram intactos.

## 2026-09-22 — acabamento visual da Tabela Investidor

- As bordas verticais contínuas dos cartões foram substituídas por divisores de
  1 px com 12 px de respiro nas duas extremidades, sem unir cabeçalho e rodapé.
- O fluxo editável foi alinhado ao livro-caixa compacto da Tabela Direta: faixa
  de ações com 36 px, botões com 25 px e linhas de 25 px em desktop.
- O cabeçalho da opção selecionada caiu de 64 px para 50 px de altura mínima;
  título, identificação, explicação e botão receberam tipografia proporcional.
- Em 375 px, o botão “Iniciar passo a passo” permanece em uma única linha e os
  controles editáveis conservam alvos de toque de 44 px ou mais.
- A QA visual validou 375×812, 768×1024, 1024×768 e 1440×900, sem overflow da
  página, sem erros de navegador e sem violações Axe graves ou críticas.
- A mudança está escopada por `investor-standard-table-page`; dados, fórmulas,
  estoque e a rota `/app/simulacao/tabela-direta` não foram modificados.
- O gate local aprovou lint, TypeScript, 54 arquivos e 599 testes Vitest com
  quatro skips preexistentes, oito testes Node e o build Next.js com 41 rotas.

## 2026-09-22 — composição compacta e completa na Tabela Investidor

- Os cartões das oito propostas prontas passaram a ter 88 px de altura e menor
  espaçamento interno, sem retirar título, ato, sinais, intermediárias,
  indisponibilidade ou indicação de seleção.
- O cabeçalho “Proposta calculada” passou a 78 px em tablet e desktop; as duas
  linhas de opções usam divisórias contínuas e faixa superior de seleção.
- A seleção de uma unidade agora desloca e posiciona o foco na etapa “Proposta
  calculada”. A seleção de uma proposta desloca e posiciona o foco no detalhe
  correspondente, respeitando a preferência de movimento reduzido.
- O detalhe selecionado reutiliza o livro-caixa visual da Tabela Direta, fica
  centralizado com 50% do painel em desktop e mantém uma linha por pagamento,
  incluindo todos os sinais, todas as intermediárias válidas e a quantidade de
  parcelas no rótulo principal.
- O fluxo editável agora usa o mesmo padrão compacto: ações opcionais no topo,
  uma linha por entrada, sinal, intermediária, saldo, quantidade, parcela e
  resultado. Os handlers, limites, datas, valores e auditoria existentes foram
  preservados.
- O painel grande de composição foi removido. A barra final reúne Aprenda,
  documentos PF/PJ, impressão, Bora Vendas e Salesforce, seguida imediatamente
  pela auditoria do cálculo; o manual foi movido do rodapé para evitar IDs
  duplicados.
- As mudanças estão escopadas por `investor-standard-table-page`; a rota
  `/app/simulacao/tabela-direta`, suas regras e seu fluxo não foram modificados.
- A QA isolada renderizou o componente real com 3.301 unidades sintéticas em
  375×812, 768×1024, 1024×768 e 1440×900. Confirmou oito opções de 88 px,
  detalhe e fluxo centralizados, seis ações finais, auditoria na sequência,
  inserção de sinal e intermediária, ausência de overflow horizontal, zero erro
  de navegador e zero violação Axe grave ou crítica.
- A rota e o script usados somente na QA foram removidos antes do build final;
  nenhuma fixture sintética ou endpoint público integra a entrega.
- O gate local aprovou lint sem avisos, TypeScript, 54 arquivos e 599 testes
  Vitest com quatro skips preexistentes, oito testes Node e o build Next.js com
  41 rotas.

## 2026-09-21 — opções horizontais da Tabela Investidor

- A etapa “Proposta calculada” da rota `/app/simulacao/tabela-investidor`
  deixou de esconder as opções em acordeões: as quatro propostas de 18 parcelas
  aparecem juntas na primeira linha e as quatro de 24 parcelas, juntas na linha
  seguinte.
- Os cartões seguem a leitura rápida da Tabela Direta, com numeração de 01 a 04,
  título, ato, sinais, intermediárias, seleção textual, foco visível e estado
  desabilitado sem depender somente de cor.
- A ordem visual prioriza pagamento simples, entrada distribuída, parcela
  reduzida e maior flexibilidade, sem alterar os códigos C1–C8, cálculos,
  percentuais, datas, estoque, autenticação ou permissões.
- O CSS novo está limitado por `investor-standard-table-page`; a rota
  `/app/simulacao/tabela-direta` e seu componente continuam intactos.
- Em telas estreitas, cada prazo permanece em uma única linha horizontal com
  rolagem interna deliberada, preservando os oito cartões e alvos de toque.
- A QA no navegador renderizou o componente real com estoque sintético em
  375×812, 768×1024, 1024×768 e 1440×900: duas linhas, quatro botões alinhados
  por linha, sem overflow da página, seleção por teclado, zero erro de console e
  zero violação Axe no seletor alterado. Em 375 e 768 px, a rolagem fica contida
  em cada linha; em 1024 e 1440 px, as quatro opções ficam integralmente visíveis.
- O harness autenticado completo não pôde reutilizar o banco Supabase local já
  ocupado por um Master de outra QA (`SQLSTATE P0001`). Nenhum dado local foi
  apagado ou reconfigurado; a validação visual usou rota efêmera removida antes
  do build final, e o limite de autenticação será conferido novamente no deploy.

## 2026-09-16 — rolagem integral e composição individual da Tabela Direta

- A paginação de 100 linhas foi removida. O estoque integral de 3.301 unidades
  permanece acessível por uma única barra interna; a janela móvel de 60 linhas
  reduz custo de DOM sem criar páginas, botões ou ocultar opções da rolagem.
- Seleção, filtro, ordenação e “Limpar filtros” reposicionam corretamente a janela.
  Quando uma linha focada sai da janela virtual, o foco retorna à região de
  estoque em vez de cair no documento.
- As opções 2 e 4 renderizam Sinal 1, 2 e 3. As opções 3 e 4 renderizam
  Intermediária 1, 2 e 3 separadamente, inclusive estado inválido, data e ajuda
  contextual; linhas agregadas ficam somente para grupos sem pagamento.
- Para Vaga de R$ 55.000,00, a validação de dados confirmou ato de R$ 3.300,00,
  sinais de R$ 737,00, R$ 731,50 e R$ 731,50, intermediárias de R$ 2.750,00 cada,
  saldo financiado de R$ 27.500,00 e 66 parcelas pós-chaves de R$ 570,28. A
  política geral de 60%/120 parcelas do XLSX continua aplicada a plantas comuns.
- O ledger editável da Tabela Direta ganhou avanço por Enter no mesmo padrão de
  uso do Associativo. O handler foi escopado à conta editável; guia e rota
  Associativo não foram alterados.
- Os ícones de ajuda do comparativo passaram a ter alvo de 24 px sem perder o
  desenho compacto. A QA com Axe encontrou zero violações nos quatro tamanhos.
- A QA isolada no navegador validou 375×812, 768×1024, 1024×768 e 1440×900:
  3.301 unidades na mesma rolagem, chegada à última linha, ausência de paginação,
  opções 2/3/4, política Vaga, reconciliação monetária, ausência de overflow,
  zero erros de página e zero violações Axe.
- `pnpm verify` passou: lint, TypeScript, 53 arquivos e 581 testes Vitest
  aprovados com 1 skip preexistente, 8 testes Node aprovados e build Next.js
  16.3 com 41 rotas. O Associativo permaneceu fora do escopo funcional.
- Nenhum deploy, push, banco, dado real, API, permissão ou ambiente remoto foi
  alterado.

## 2026-09-10 — refinamento visual e funcional da Tabela Direta

- A planilha WF14_AG-SIM-DIRETA_v1_2.xlsx foi conferida como fonte de regras,
  não como instrução: opção 1 usa ato de 10%; opções 2 e 4 usam ato de 6% mais
  três sinais de 1,34%, 1,33% e 1,33%; intermediárias aceitam até 5% cada e
  somente datas válidas antes da entrega.
- O cartão calculado mostra somente “Opção 1” a “Opção 4”, abre o texto integral
  da composição no ícone information-at-mark.png, mantém a política de vaga
  condicional à unidade e elimina o rodapé duplicado.
- Os sinais deixaram de ser agregados no cartão: Sinal 1, 2 e 3 aparecem em
  linhas próprias. Para R$ 50.000,00, a regressão prova ato de R$ 3.000,00,
  sinais de R$ 670,00, R$ 665,00 e R$ 665,00 e entrada total de R$ 5.000,00.
- O fluxo editável passou a reutilizar o ledger compacto já homologado no
  Associativo. Os três botões ficam no topo; sinal para em três campos e
  intermediária para no limite calculado por prazo/5%. O Associativo conserva
  o texto “Inserir Anual”.
- O resumo de mensais pré-chaves mostra apenas a primeira parcela. Cronograma,
  resíduo da última parcela, datas e amortização continuam integrais nos
  detalhes, diálogos e impressão.
- Lint e TypeScript passaram sem erros. A suíte completa aprovou 53 arquivos,
  580 testes e manteve um skip preexistente; os oito testes Node adicionais
  também passaram.
- O build otimizado do Next.js 16.3 passou após a limpeza do cache efêmero da
  rota usada somente na QA; a rota temporária não faz parte da entrega.
- A QA isolada com inventário sintético de 3.301 unidades validou 375×812,
  768×1024, 1024×768 e 1440×900: política de vaga literal, três sinais nas
  opções 2/4, rótulos, botões, inserção de sinal, primeira mensal, ausência de
  overflow e zero violações Axe no fluxo. O tooltip móvel foi repetido após a
  correção e ficou inteiramente dentro da viewport.
- A matriz autenticada integral foi iniciada, mas parou em uma divergência
  visual preexistente de tema escuro no Ranking antes de alcançar a validação
  funcional da Tabela Direta. A falha não pertence aos arquivos alterados; a
  rota foi validada separadamente nos quatro tamanhos obrigatórios.
- Nenhum deploy, push, banco, dado real ou ambiente remoto foi alterado.

## 2026-09-10 — correção da comissão apartada

- A auditoria confirmou que a classificação escolhida no popup de remuneração
  ficava em estado local, enquanto a proposta pronta consultava o ranking de
  aprovação. Os estados foram separados corretamente: aprovação continua com
  sua regra e remuneração passa a alimentar a comissão apartada.
- A aba “Regras e auditoria” de `Pasta2.0.xlsx` declara que seus percentuais não
  validam elegibilidade comercial. O corte anterior de 6% foi removido; a regra
  explícita agora compara a Entrada com a própria comissão calculada e aceita a
  igualdade no centavo.
- A regressão do cenário informado valida VGV líquido de R$ 234.490,00, Ouro
  4,5%, comissão de R$ 10.552,05 e Entrada de R$ 15.000,00 como elegível.
- O popup usa 900 px sem comparação e 1.180 px com a coluna apartada. O QA
  autenticado aprovou 375×812, 768×1024, 1024×768 e 1440×900 sem overflow ou
  truncamento, além das matrizes responsiva, temática, acessível e de zoom.

## 2026-09-09 — popup associativo e comissão apartada

- A planilha `Pasta2.0.xlsx` foi tratada como fonte de dados e fórmulas, não
  como instrução. Foram conciliados 602 cenários e 23.548 verificações
  armazenadas nas abas de auditoria, sem conflito nas regras usadas pelo popup.
- A memória preserva o cálculo faturado existente e acrescenta o modelo
  apartado da planilha: Ouro 4,5%, Prata 4%, Bronze 3,5% e prêmio de 40% sobre a
  folga de volta ao caixa ainda disponível depois do desconto.
- A coluna apartada exige Entrada maior ou igual a 6% do VGV, usando igualdade
  inclusiva e arredondamento monetário em centavos. Ranking sem taxa definida
  na planilha não recebe valor inventado.
- O popup reutiliza a densidade do fluxo editável: 23 px por linha e fonte de
  10 px no desktop, área de rótulo tonalizada, divisor dourado, divisores ciano,
  valores tabulares e estados de destaque, total, foco e ajuda.
- Em 375 px, os dois modelos são empilhados dentro de cada lançamento e os
  alvos de ajuda continuam com 44 px; em telas maiores, permanecem em colunas
  alinhadas para comparação direta.
- Testes unitários cobrem a réplica exata da planilha, a igualdade de 6%, o
  centavo imediatamente inferior, a composição “Sinal COM / prêmio” e a
  rejeição de classificação ausente da fonte.
- O gate remoto identificou avisos publicados em 08/09/2026 no Next.js, Sharp e
  `js-yaml`. As versões foram elevadas aos primeiros releases corrigidos e o
  override transitivo permanece explícito para impedir regressão do lockfile.

## 2026-09-06 — Tabela Direta na rota protegida

- O código, o container e o proxy de produção foram reconciliados antes da
  alteração; o checkout vivo é `/srv/descomplica-crm-simulador-associativo` e
  o Nginx de `crm.descomplicapro.com.br` encaminha para essa aplicação.
- A composição integral do artefato anexado foi conectada ao slug
  `/app/simulacao/tabela-direta`, preservando o guard server-side
  `crm.simulators.view` e sem criar migration, grant, papel ou integração.
- O item “Tabela Direta” passou a usar a URL protegida exata do CRM. Estoque,
  filtros, seleção, quatro opções, proposta personalizada, memórias, guias,
  documentos, impressão e estados de interface permanecem disponíveis.
- O snapshot SPC privado contém 3.301 IDs únicos. Há 2.987 unidades com
  preço positivo e término da obra para cálculo; as 314 linhas sem preço
  válido continuam visíveis, mas indisponíveis para seleção. Nenhuma linha foi
  resumida ou substituída por mock.
- O arquivo saiu do HEAD do Git, de `public/` e da imagem: o runtime o monta de
  `/etc/descomplica-crm/data` em volume somente leitura, após validar ownership,
  modo, SHA-256, contagem e IDs. A réplica o recebe por endpoint server-only que
  repete `crm.simulators.view` e cabeçalhos `no-store`; o endpoint de fonte viva
  permanece protegido para outras jornadas, mas nunca substitui o snapshot da
  Tabela Direta.
- A remoção do HEAD não reescreve commits antigos do repositório público. A
  cópia histórica deve ser tratada como previamente exposta; privatização ou
  purge de histórico exigem uma operação separada e destrutiva do proprietário.
- O anexo informa a fonte `ESTOQUE SPC.xlsx` e a contagem, mas não traz
  `generatedAt` nem `reportId`. Por isso, WF14 prioriza o snapshot congelado
  para preservar seu conteúdo integral e não o apresenta como estoque oficial
  em tempo real; se o snapshot privado falhar, a interface falha fechado,
  informa a indisponibilidade e oferece nova tentativa sem fallback silencioso.
- A revisão das regras corrigiu centavos, sobrepagamento por entrada acima de
  10%, entrada máxima, zero mensal pré-chaves, sinal posterior à entrega, data
  ISO impossível e a separação dos quatro estados de resultado.
- A matriz completa avaliou 2.987 unidades por quatro opções: 11.948 fluxos,
  11.692 propostas prontas, 256 ajustes determinísticos por prazo e nenhum
  estado inesperado.
- Testes dedicados cobrem rota, menu, conteúdo integral, qualidade do snapshot,
  percentuais, datas, limites, arredondamento, amortização, crédito e todas as
  regressões corrigidas, inclusive a igualdade entre valor monetário exibido e
  decisão de crédito. A matriz visual autenticada inclui WF14 nos sete
  viewports, três temas, Axe e zoom de 80% a 200%.
- Para não recolocar dados comerciais no Git nem nas imagens de evidência, a
  matriz visual cria um estoque sintético determinístico e efêmero de 3.301
  linhas, removido ao final. Antes da captura local, o runner exige e valida a
  cópia real por SHA-256, contagem, IDs e qualidade; somente o GitHub Actions,
  por opt-in explícito e sem o arquivo privado, pode executar o mesmo visual
  sintético. A matriz completa do anexo também passa antes do deploy.
- A revisão pré-release eliminou uma divergência de um centavo no ato mínimo,
  passou impressão e cabeçalhos a usar exclusivamente o fluxo atual e incluiu
  no PDF desconto, ato, todos os sinais e todas as intermediárias com valores,
  datas, percentuais, validações e a auditoria integral. O botão fica desativado
  em propostas com pendência e uma impressão manual do navegador oculta os
  dados parciais, exibindo somente o aviso de bloqueio.
- Filtros preservam a proposta apenas na Tabela Direta; as jornadas Associativo
  e Investidor mantêm o comportamento anterior. Troca de unidade, saída por
  link, recarregamento e navegação Voltar/Avançar protegem alterações não
  salvas. Paginação anuncia a faixa, move o foco para a primeira nova unidade e
  os breakpoints de 375 a 1.050 px não truncam menus nem valores do comparativo.

## 2026-09-06 — Tabela Investidor na rota protegida

- O código e o container de produção foram reconciliados antes da alteração; o
  checkout vivo é `/srv/descomplica-crm-simulador-associativo` e o Nginx do
  domínio `crm.descomplicapro.com.br` encaminha para essa aplicação.
- A tela arquivada completa foi composta em `InvestorTableArchive`, sem resumir
  o conteúdo, e o slug `tabela-investidor` passou a renderizá-la após o guard
  server-side existente.
- O link legado `/simulacao/tabela-investidor?ficha=3` foi substituído por
  `/app/simulacao/tabela-investidor`; navegação interna também usa as rotas
  autenticadas reais do CRM.
- O snapshot SPC contém 3.301 IDs únicos: 3.179 unidades elegíveis e 122 vagas
  avulsas excluídas. As 314 unidades sem preço válido permanecem visíveis, mas
  indisponíveis para seleção; todas possuem término de obra.
- Testes dedicados cobrem o contrato da rota, conteúdo integral, oito cenários,
  reconciliação monetária e qualidade do estoque. A matriz visual inclui WF15
  nos sete viewports, três temas, Axe e zoom de 80% a 200%.
- A tabela renderiza uma janela móvel de 60 linhas sobre as 3.179 unidades,
  preservando filtros, seleção, ordenação e extensão total da rolagem sem
  sobrecarregar o navegador ou a auditoria de acessibilidade.
- O endpoint e o snapshot local do estoque exigem `crm.simulators.view`; o
  snapshot aparece primeiro e o endpoint ao vivo atualiza os dados sem bloquear
  a interface por até 20 segundos.
- Os controles compactos do estoque e da ajuda respeitam alvo mínimo de 24 px;
  em superfícies de toque, os controles principais usam 44 px. A exceção Axe
  legada de `target-size` do Associativo foi eliminada.
- A matriz autenticada aprovou 126 checks responsivos, 72 de tema, 171
  auditorias Axe/comparações de imagem e 90 checks de zoom.

## 2026-09-02 — Simulador Associativo

- A navegação persistida do WF13 passa a usar o nome “Simulador Associativo”.
- O catálogo visual usa o mesmo nome no hub e no título da página, sem alterar
  a rota, o motor `wf13-1.3.0`, os campos, os resultados ou a política
  Master-only.
- A migration é transacional e falha fechada quando a entrada protegida do
  catálogo não corresponde ao contrato esperado.
- O QA autenticado local aprovou 119 rotas responsivas, 68 combinações de tema,
  160 auditorias de acessibilidade, 160 comparações visuais e 85 verificações
  de zoom; a baseline canário foi promovida com a nova nomenclatura.
- O gate de dependências do CI encontrou dois avisos novos em `browserslist`;
  o override fixa a versão corrigida `4.28.7` sem alterar dependências de
  runtime da aplicação.
- O gate de restore isolado acompanha o novo teste de nomenclatura do WF13,
  elevando o plano esperado após integração de 1.041 para 1.042 testes pgTAP.
- A matriz autenticada canônica foi regenerada em árvore limpa: 119 checks
  responsivos, 68 de tema, 160 de acessibilidade/comparação e 85 de zoom. A
  promoção transacional atualizou somente as telas renomeadas; conta e fixtures
  efêmeras foram removidas.

## 2026-09-01 — múltiplos Masters source-controlled

- A cardinalidade única de Master foi substituída por índice não único de
  consulta. Dois usuários sintéticos conservaram simultaneamente papel Master,
  perfil aprovado e escopo global; reexecução permaneceu idempotente.
- O bootstrap continua owner-only, sem `EXECUTE` para Data API ou
  `service_role`; `can_assign_role` também exclui Master e escrita direta em
  `user_roles` permanece revogada.
- A autorização produtiva solicitada foi registrada somente como SHA-256 do
  e-mail normalizado. O runner exige checkout limpo, SHA exato, conexão em
  arquivo root-only, conta preexistente e aceite legal real antes de alterar o
  papel; nenhuma credencial ou identidade em claro foi versionada.
- Reset local e pgTAP aprovaram 1.041 testes em 26 arquivos. O rehearsal em
  duas instâncias PostgreSQL 17 independentes aprovou 42 migrations, backup,
  restore, owners, privilégios, fingerprints, lint e advisors sem rede remota.
- O histórico produtivo foi consultado somente em leitura: as duas migrations
  Auth/MFA já estão aplicadas e apenas `20260901204113` deste incremento está
  ausente. A identidade alvo ainda não existe e nenhum ambiente remoto recebeu
  migration ou promoção.
- `pnpm audit` e OSV detectaram duas CVEs altas novas no `browserslist 4.28.2`.
  Um override transitivo mínimo para `4.28.7` removeu o achado sem adicionar
  pacote ou mudar o runtime da aplicação; gitleaks permaneceu sem vazamentos.
- O primeiro CI aprovou aplicação, banco, E2E e restore, mas duas de 160
  comparações visuais mudaram 24 px em 375 px porque a competência virou de
  agosto para setembro. O fixture agora fixa sua data original somente quando
  `AUTH_LOCAL_INSECURE_LOOPBACK_QA` e origens loopback estão comprovados;
  produção não reconhece esse override. A repetição local passou com 119 checks
  responsivos, 68 de tema, 160 de acessibilidade, 160 comparações de imagem e
  85 checks de zoom, sem promover baseline.

## 2026-08-28 — recovery hospedado sem SMTP próprio

- O preflight produtivo comprovou que o Supabase hospedado usa o mailer padrão
  e recusa template customizado sem SMTP próprio. Nenhuma credencial SMTP foi
  inventada e nenhum serviço pago foi criado.
- O callback agora preserva o contrato `TokenHash` homologado e aceita também
  o auth code UUID v4 do `ConfirmationURL` padrão. Após a troca PKCE, claims de
  recovery recentes continuam obrigatórias; callbacks ambíguos, OAuth/login e
  formatos divergentes falham fechados.
- Nginx continua suprimindo access/error logs somente em `/auth/callback`, de
  modo que nem o token hash nem o code aparecem nos logs do proxy.

## 2026-08-27 — PR #49: navegação do canário WF13

- O smoke HTTPS mostrou que a navegação interna do WF13 ainda criava links para quatro páginas `releaseEnabled=false`; o prefetch recebia `403` e gerava ruído de console tardio.
- A navegação agora cria links apenas para jornadas liberadas pelo catálogo server-side e representa as demais como itens bloqueados, sem mudar grants, migrations, flags ou motores.
- Cobertura adicionada para provar um link autorizado, quatro itens bloqueados e ausência de `href` para as rotas futuras.
- A baseline canário foi promovida localmente a partir do HEAD limpo após 119/119 rotas responsivas, 68/68 temas, Axe 160/160, 160/160 comparações e 85/85 checks de zoom; somente 12 capturas em `target-authenticated-canary/simulator.wf13` mudaram.
- O primeiro CI do novo head revelou overflow causado pelo texto visualmente oculto dentro dos itens flex bloqueados; o motivo foi movido para `aria-label`, preservando a semântica sem alterar o min-content.
- A reprodução reduzida identificou `#calculation-blocked-reason` como origem real: o seletor genérico `.simulatorNav > span` também estilizou a explicação do CTA. O seletor agora exige `.simulatorNavBlocked` e mantém o texto do CTA intacto.

## 2026-08-27 — zero 5xx com capacidades desligadas

- O smoke HTTPS aprovou os 21 cenários, mas o pós-gate detectou 38 respostas
  `503` deliberadas de Salesforce, Qlik e motores com flags desligadas.
- O contrato fail-closed agora responde `404` somente quando a capacidade está
  explicitamente off ou não publicada; configuração ativa inválida, banco,
  política, auditoria e upstream indisponíveis continuam `503`.
- A mudança preserva corpo sanitizado, `no-store`, short-circuit antes de auth,
  payload e banco, e mantém todas as integrações e motores desligados.

## 2026-08-27 — verificação MFA com resposta atômica

- A repetição hospedada no SHA `a23c671` manteve 20 de 21 cenários verdes e
  isolou a falha real: o Supabase validava o TOTP e ativava o fator, mas o POST
  da Server Action permanecia aberto até o proxy devolver `502`.
- Enrollment e challenge agora usam um Route Handler dedicado. O cliente SSR
  mantém rotações de cookies em memória, valida usuário, sessão, AAL, fluxo,
  ownership do fator e claims AAL2 antes de gravá-las atomicamente na resposta
  `204`; qualquer pós-condição divergente descarta a nova sessão e falha fechado.
- Para esse POST exato, o Proxy espelha eventual refresh somente na requisição e
  posterga seus `Set-Cookie`; o handler consolida um único valor final por chunk,
  inclusive deleções `maxAge=0`, evitando pares AAL1/AAL2 duplicados.
- O POST aceita somente origem canônica, corpo URL-encoded de até 512 bytes e
  três campos exatos; a leitura do stream interrompe antes de alocar bytes
  excedentes. A interface preserva QR/chave e erro inline, faz navegação fixa
  somente após sucesso e nunca envia TOTP, fator ou token pela URL/log.
- Testes novos cobrem cross-origin, payload inválido, AAL incorreto, fator por
  status, claims divergentes, cookie chunks obsoletos e política HttpOnly.

## 2026-08-27 — janela TOTP estável no smoke hospedado

- O primeiro smoke do SHA `46c33e7` aprovou 20 de 21 cenários; o caso MFA
  atingiu o limite global durante o enrollment, sem falha do runtime ou HTTP
  5xx. A limpeza foi interrompida e as nove identidades sintéticas foram
  removidas antes da repetição.
- Enrollment e challenge agora aguardam uma janela TOTP com pelo menos 12
  segundos restantes, evitando submeter um código que expire durante a ida e
  volta HTTPS. O cenário complexo recebe o mesmo teto de 180 segundos usado na
  matriz hospedada e registra somente nomes de fases, nunca chave ou código.

## 2026-08-27 — sessão de revogação no smoke hospedado

- A primeira execução HTTPS aprovou 19 de 21 cenários e encontrou uma
  dependência de ordem no recovery: a matriz remota havia encerrado a sessão
  Master antes de o teste de revogação tentar reutilizá-la.
- O recovery agora autentica uma segunda sessão Master dedicada, que permanece
  aberta até a troca de senha comprovar sua revogação. A limpeza hospedada após
  a falha comprovou zero contas, sessões e fatores efêmeros e zero fator no
  Master visual persistente.

## 2026-08-27 — convergência do contrato visual no CI

- O primeiro CI do catálogo 17/21 encontrou uma expectativa residual de 21
  páginas na contagem de evidências autenticadas. O teste agora diferencia as
  21 URLs funcionais das 17 superfícies release-enabled, preservando os `403`
  dos quatro simuladores futuros.
- A baseline foi recapturada a partir do commit limpo `0449bab`: 119 capturas
  responsivas, 68 checks de tema, 160 auditorias/comparações e 85 checks de
  zoom, com promoção transacional e remoção das fixtures efêmeras.

## 2026-08-27 — gate visual RBAC e cabeçalho móvel

- A comparação detectou 19 divergências esperadas restritas ao hub de Simulação
  e ao Catálogo de páginas, decorrentes do conjunto 21 → 17 e dos quatro cards
  release-disabled.
- A revisão independente encontrou colisão adicional do cabeçalho em 390 px. O
  breakpoint móvel passou a separar marca, ações e navegação em três linhas; o
  detector cobre marca × ações, navegação × identidade e pares de ações.
- A promoção transacional aprovou 119 capturas responsivas, 68 checks de tema,
  160 auditorias Axe, 160 comparações e 85 checks de zoom. A verificação pós-
  commit é obrigatória antes de publicar a homologação.

## 2026-08-27 — contas efêmeras no smoke hospedado

- O runner passa a usar o arquivo privado somente para o Master visual. A matriz
  Playwright de nove papéis é criada em memória via Auth Admin com aceites legais
  vigentes e grants mínimos compatíveis; nenhuma senha efêmera é persistida.
- Durante o E2E, o Master visual é estacionado de forma reversível para preservar
  a unicidade do papel. O `finally` remove fatores, sessões, grants, auditoria,
  fixture Broker, mensagens e ledger legal antes do hard-delete das nove contas.
- A prova final consulta Auth, RBAC e ledger e exige ausência integral da matriz,
  além de restaurar o Master visual único antes das capturas. Evidências visuais
  hospedadas mascaram identidades e os logs de acesso/erro são verificados sem
  ecoar conteúdo sensível.
- Sintaxe Node e 20 testes direcionados passaram. Nenhum ambiente remoto foi
  consultado ou alterado por este incremento.

## 2026-08-26 — convergência RBAC por conjunto do PR #49

- A fonte produtiva somente leitura e o backup root-only concordaram em 17
  pares `page_key`/rota/permissão para Master. A diferença mecânica do restore
  de 21 páginas identificou somente WF16, CAIXA, WF14 e WF15.
- A migration candidata remove apenas essas quatro identidades quando presentes
  e exige o conjunto ativo exato. Não altera grants: Master/Admin/legados/futuros
  permanecem com 20/17/4/0 permissões e 17/14/7/0 páginas.
- Proxy e SSR agora negam as quatro rotas antes de renderizar; o E2E mantém as
  21 URLs para provar `403`, enquanto navegação, RLS e catálogo expõem somente
  as 17 páginas aprovadas.
- O clean install e o restore lógico independente aprovaram 41 migrations,
  1.018 pgTAP em 25 arquivos, lint/advisors e fingerprints. A réplica sanitizada
  do estado produtivo recebeu somente `20260824230058` e `20260824230100`,
  preservando 8/20/61/17 e o fail-closed Qlik.
- Foi adicionado executor exclusivo de homologação: exige checkout limpo,
  manifesto sintético, backup novo root-only com quatro tipos, checksums e
  restore isolado comprovado, histórico exato 29 + 2, hashes fixos, advisory
  lock, transações/histórico atômicos e pós-condições navegáveis `17/14/7/0`.
  Nenhum ambiente remoto foi alterado durante sua implementação.

## 2026-08-25 — gate de compatibilidade produtiva do PR #49

- A réplica sanitizada PostgreSQL 17 recebeu somente as migrations candidatas
  `20260824230058` e `20260824230100`: oito papéis, 20 permissões, 61 vínculos,
  17 páginas e as 14 páginas de Admin permaneceram idênticos.
- Clean install e restore lógico independente aprovaram 41 migrations e 1.004
  pgTAP em 24 arquivos, lint e advisors na fonte e no alvo, owners, privilégios
  efetivos e fingerprints. O backup de origem permaneceu sem rede.
- O E2E local aprovou 19 cenários e manteve um único skip reservado ao smoke
  hospedado: nove perfis, 21 rotas, APIs, recovery, MFA/AAL2, cookies, sessões e
  logout foram exercitados; nove identidades sintéticas foram removidas.
- A matriz visual local aprovou 147 checks responsivos, 84 de temas, 192 Axe,
  192 comparações candidato/baseline e 105 checks de zoom; conta e fixtures
  efêmeras foram removidas ao final.
- A apresentação de acesso agora espelha a baseline produtiva: Master 20 grants,
  Admin 17 e seis papéis legados quatro. As 21 rotas têm `403` pre-stream no
  Proxy e repetem o mesmo gate em SSR, API/RPC e RLS.
- Auditorias encerraram com zero vulnerabilidade de dependência, zero achado OSV
  em 521 pacotes e zero segredo na árvore ou em 278 commits.
- Produção e homologação permaneceram inalteradas; o smoke hospedado continua
  pendente por depender de uma promoção futura expressamente autorizada.

## 2026-08-25 — smoke fixa o daemon Docker local

- O runner hospedado deixou de herdar `HOME`, `DOCKER_HOST`, `DOCKER_CONTEXT` e
  `PATH` do chamador em comandos capturados; usa somente um `PATH` constante.
- Inspeções de imagem, mount, estado e logs passam `--host
unix:///var/run/docker.sock` explicitamente. O gate valida antes que esse alvo
  seja socket root-owned e sem permissões para outros usuários.
- Prettier, ESLint, sintaxe Node, testes direcionados e typecheck foram
  reexecutados localmente. Nenhum daemon, container ou ambiente remoto foi
  consultado ou alterado.

## 2026-08-25 — contrato de smoke Auth hospedado endurecido

- A configuração isolada de homologação habilita Mailpit, redirect único por
  `APP_ORIGIN` e frequência compatível com repetição controlada do gate; nenhuma
  mensagem é encaminhada para fora da VPS.
- O runner agora exige checkout limpo e vincula HEAD, env privado, imagem,
  container e `/api/health`. A inspeção de env, mount, logs e configuração
  Supabase ocorre somente em memória, sem imprimir credenciais ou tokens.
- Recuperação e MFA usam exclusivamente a identidade Master/QA sintética. O
  `finally` restaura primeiro a senha, remove somente fatores novos, revoga
  sessões no banco local isolado, comprova a credencial original e elimina
  mensagens Mailpit mesmo quando o Playwright falha.
- Nginx exige exatamente dois blocos sem log para `/auth/callback`; bytes novos
  do access log e logs do app reprovam query de callback, HTTP 5xx ou erro
  crítico. Image ID, horário de início, restart count e health devem permanecer
  estáveis até o pós-gate.
- Gates locais direcionados aprovaram Prettier, ESLint, sintaxe Node, 30 testes
  Vitest e descoberta dos 12 cenários Playwright. O smoke HTTPS não foi
  executado porque este incremento proíbe modificar ou substituir a
  homologação viva.

## 2026-08-25 — schema remoto e histórico reconciliado

- A inspeção produtiva ocorreu somente em transações de leitura: PostgreSQL
  17.6, 22 tabelas de aplicação, 28 funções, 17 policies, oito triggers e 26
  versões remotas. Nenhuma configuração, migration, grant, linha ou usuário foi
  alterado.
- As sete versões remotas ausentes foram localizadas no ledger e em backups
  root-only, classificadas por hash e reconciliadas com markers no-op. SQL
  inseguro ou contendo verificadores legados não foi copiado para o Git.
- Um backup corrente verificável alimentou dois projetos PostgreSQL 17 locais,
  efêmeros e sem rede. O alvo recebeu somente RBAC/catalogação sanitizados e as
  migrations `20260824230058` e `20260824230100`.
- O rehearsal preservou fingerprints de oito papéis, 20 permissões, 61 vínculos
  e 17 páginas; confirmou as 14 páginas de Admin, Qlik sem grant/policy de
  leitura permissiva e os objetos Auth/MFA/aceites completos. Recursos
  temporários foram removidos e nenhum ambiente remoto foi alterado.
- A revisão independente encontrou um preflight local ainda preso ao baseline
  Master-only anterior. O gate agora compara simetricamente a matriz comercial
  herdada exata e reprova tanto perda quanto ampliação de permissão.
- A mesma revisão encontrou a apresentação de herança ainda defasada. O mapa da
  UI agora espelha os 17 grants de Admin e os quatro grants de cada papel legado;
  os testes de troca de papel cobrem esse contrato sem tornar a UI autoridade.
- O E2E comprovou que Cache Components podia emitir `200` antes do interrupt de
  página. O Proxy agora antecipa a chave exata das 21 rotas, enquanto layouts,
  páginas, APIs, RPCs e RLS continuam repetindo o gate. Admin mantém as páginas
  de metas em modo legado somente leitura, sem RPC ou ação de política Master.
- O primeiro pgTAP integral revelou duas suposições antigas: contagem de policy
  que incluía o novo gate MFA restritivo e lookup nominal do schema opcional
  `net`. Os testes agora distinguem policy de leitura do gate MFA; a migration
  de portabilidade exige atributos e fingerprints exatos antes de corrigir o
  contrato conhecido; permanece sem efeito onde esses objetos não existem.

## 2026-08-25 — imagem promovível e segredos de runtime

- Eliminada a configuração de ambiente do estágio de build: Supabase público,
  `APP_ORIGIN`, modo de homologação e flags são validados e consumidos somente
  no runtime do servidor. O cliente browser não lê `process.env`.
- Os dois Compose apontam para `descomplica-crm:<SHA completo>`, sem `build:`.
  `image:build` exige HEAD limpo, grava label OCI da revisão e `image:prove`
  confirma mesma referência, image ID e revisão nos dois ambientes.
- `AUTH_SESSION_COOKIE_SECRET` foi ligado aos configuradores privados por
  arquivo separado. Diretório `root:root 0710`, segredo `root:root 0640` e
  arquivos de ambiente `root:root 0600` são validados sem imprimir conteúdo;
  symlinks e argumentos Compose fora da allowlist falham fechados.
- Docker Compose com fonte de arquivo não aplica `uid/gid/mode`, e o runtime
  disponível não materializa `secrets.environment`. O fallback comprovado usa
  bind read-only, `create_host_path: false`, processo `node` com grupo
  suplementar `0`, zero capabilities e `no-new-privileges`.
- O configurador de homologação lê sem eco e preserva
  `OFFICIAL_SIMULATOR_RUNTIME_MODE`/`OFFICIAL_SIMULATOR_ENABLED_KEYS`. Somente
  `off` com allowlist vazia ou `active` com chaves oficiais únicas são aceitos;
  ausência usa `off`/vazio e qualquer estado incoerente falha antes do replace.
- Prova Docker local executou a mesma imagem com os perfis de homologação e
  produção, mount real `0640` e processo não-root: `sameImage=true`, dois perfis
  válidos e `secretValuesPrinted=false`. A imagem WIP de prova teve ID
  `sha256:27124e3a44ef730d6aba381531b5e2e9736bc911b958855cbff058375ba26c5a`;
  o gate final deve reconstruir uma única vez no SHA limpo integrado.
- Gate isolado aprovou 80 testes direcionados, ESLint direcionado, typecheck,
  build sem variáveis de ambiente com 39 rotas, sintaxe Bash/Node, manifests
  Compose, `git diff --check` e a prova real do container. Nenhum ambiente
  remoto, serviço, credencial ou dado foi alterado.

## 2026-08-24 — fundação de recuperação, MFA e consentimentos

- Base, arquitetura Next.js/Supabase SSR e implementação anterior foram
  auditadas antes das mudanças. Trabalho isolado na branch
  `codex/auth-mfa-legal-foundation`, sem sobrescrever alterações existentes.
- Baseline local anterior ao incremento aprovou formato, lint, typecheck, 385
  testes Vitest, oito testes Node, build, Supabase local, 939 pgTAP em 22
  arquivos e release E2E com oito cenários executados e um skip remoto.
- Implementados recuperação de senha anti-enumeração, callback fixo por
  `APP_ORIGIN`, template `TokenHash` SHA-224 verificado via POST/body, senha de
  12–128 caracteres e revogação server-side de todas as sessões após uma
  autenticação Auth `otp`/`recovery` recente. Esses AMRs ficam em quarentena também
  no RLS; callback falso preserva sessão e marker existentes.
- Implementados enrollment, challenge e remoção TOTP, com QR Code/chave manual,
  transição AAL1/AAL2 e bloqueio fail-closed compartilhado por guards, Route
  Handlers, permissionamento, RPCs e policies RLS restritivas. A remoção revoga
  primeiro as demais sessões do mesmo usuário para impedir ressurgimento AAL1.
- “Lembrar neste navegador” permanece desmarcado por padrão. Marker HMAC limita
  a sessão persistente a 30 dias; entrada inválida regride para sessão
  temporária. Cookies de autenticação não dependem de `localStorage`.
- Banner de cookies, cinco categorias, personalização e três documentos legais
  foram adicionados. Termos e Privacidade exigem aceite versionado separado,
  registrado em tabelas privadas append-only e sem grants para papéis de API.
- Razão social, contatos, controlador, DPO, bases legais e retenção continuam
  pendentes de revisão jurídica; nenhum dado legal foi inventado.
- A matriz de smoke documenta nove perfis e 21 rotas. Após a reconciliação
  produtiva, Master acessa as 21; Admin preserva 14; `broker`, `coordinator` e
  `real_estate` preservam Dashboard, cinco etapas e Ranking; os quatro perfis
  sem herança comercial permanecem apenas na superfície auth-only. MFA e
  recuperação sobrepõem redirects antes do RBAC.
- Supabase CLI local foi atualizado de 2.111.0 para 2.115.0 para incorporar a
  correção oficial de resolução/reload do `content_path` de templates Auth.
  Auditoria do Auth 2.195.0 confirmou SHA-224 puro no fluxo implícito e prefixo
  oficial `pkce_` no PKCE; callback e E2E aceitam somente esses dois formatos.
- Um stack descartável sem a extensão opcional `pg_net` revelou lookup frágil
  em dois probes preexistentes. Migration separada preserva os predicados e usa
  OID nulo de forma segura; relay e motor continuam fail-closed e desligados.
- Todo trabalho permanece local. Nenhum Supabase remoto, produção, homologação,
  VPS, usuário, sessão, integração, motor, grant ou configuração externa foi
  alterado.
- Gate final aprovou `format:check`, lint, typecheck, 427 testes Vitest e oito
  testes Node, build de 39 rotas, reset do Supabase local e 1.002 pgTAP em 24
  arquivos. O release E2E aprovou 11 cenários e manteve um skip exclusivo da
  homologação remota: nove perfis, 21 URLs diretas, APIs, recuperação, MFA,
  sessões, cookies e aceite legal foram exercitados sem persistir usuários.
- A revisão independente de rotas confirmou a matriz 9×21, catálogo/menu, guards
  SSR, Route Handlers e RLS. O P3 de cobertura foi fechado repetindo, para cada
  perfil, dashboard, status/execução WF13 e os quatro handlers default-off; esses
  probes terminam antes de qualquer escrita ou chamada externa.
- Revisão de segurança independente encerrou sem achados P0, P1 ou P2. Evidência
  sanitizada registrou zero artefatos Playwright, mensagens residuais, parâmetros
  de token/código em URL, HTTP 5xx, panic ou fatal.
- `pnpm audit`, OSV sobre 521 pacotes, Gitleaks na árvore e em 266 commits, schema
  lint e advisors locais de segurança/performance terminaram sem achados.
- O CI revelou dois contratos desatualizados no rehearsal isolado: total antigo
  de 939 pgTAP e ausência da nova pasta de templates na cópia efêmera. A correção
  mantém o ensaio genérico; a repetição local aprovou 34 migrations, 1.002 pgTAP
  na fonte e no restore, backup lógico, owners, privilégios e fingerprint entre
  dois projetos PostgreSQL 17 independentes.
- A matriz visual revelou a suposição antiga de que tema sempre persistia. O
  harness agora registra consentimento opcional explícito na conta QA antes de
  alternar temas entre rotas; usuários reais continuam com opcionais desligados.
  O botão flutuante de preferências é ocultado somente durante screenshots da
  superfície comercial e permanece exercitado por teclado, Axe e E2E funcional.
- A repetição visual local aprovou 147 checks responsivos, 84 de tema, 192 Axe,
  192 comparações de baseline e 105 checks de zoom; conta e fixtures efêmeras
  foram removidas ao terminar.

## 2026-08-18 — Hotfix WF13: limite 84 e comprometimento

- Base e produção confirmadas em `3ddbf30362788ecaf1450377742ee162b3984a6c`.
  Trabalho isolado em `codex/wf13-84-pro-soluto-hotfix`.
- PDF oficial reproduzido: saldo R$ 17.000,00, mensal R$ 202,38, corrigida
  R$ 288,67, primeira mensal 15/09/2026, três anuais de R$ 2.000,00 e
  comprometimento do pró-soluto de 9,88%.
- Causa dos 0,20 p.p.: o numerador anterior somava R$ 6.506,19 das anuais
  corrigidas até cada vencimento. A referência usa R$ 6.030,00, anuais nominais
  submetidas uma vez à correção inicial de 0,5%. Numerador caiu de R$ 23.591,19
  para R$ 23.115,00; denominador permanece R$ 234.000,00.
- `WF13_MAX_INSTALLMENTS` centraliza 84. O payload envia somente quantidade
  solicitada; schema estrito rejeita limite livre e confirmação forjada.
  Validação compartilhada cobre vazio, negativo, zero, decimal, texto, excesso
  e todas as fronteiras permitidas sem arredondamento silencioso.
- Política conferida virou saída automática do cálculo integral. Campo 84 usa
  `readOnly`, `aria-readonly`, cadeado; erros de quantidade bloqueiam CTA,
  marcam campo, aparecem no resumo e recebem foco.
- Nenhuma migration, dependência, permissão, integração, motor adicional ou
  default de feature flag foi alterado.
- Gate local aprovou 385 testes unitários, 8 E2E executados, 147 checks
  responsivos, 84 de tema, 192 Axe/comparações e 105 de zoom. Onze capturas
  canônicas e onze do canário Master foram revisadas em desktop e celular.
- Promoção visual foi endurecida para preservar arquivos aprovados e escrever
  diferenças somente no root de baseline realmente usado, inclusive o canário.
  Isso evitou refresh binário de páginas e motores fora do WF13.

## 2026-08-18 — WF13: ranking, anuais fixas e paridade Looker

- O relatório Looker foi auditado anonimamente e somente em leitura. Campos
  calculados e 30 cenários sintéticos comprovaram pró-soluto corrigido, maior
  parcela pré/pós dividida pela renda, limites e regra individual das anuais.
- A política `wf13-ranking-2026-08-18` centraliza os cinco rankings em basis
  points, compara frações exatas no servidor e devolve todas as violações.
  `NÃO ELEGÍVEL` falha com motivo próprio.
- O Looker antigo usa limite estrito (`<`). A regra explícita aprovada usa
  inclusivo (`<=`); os dez casos exatos estão identificados na matriz, sem
  mascarar a divergência.
- Anuais agora surgem automaticamente em cada 15/12 dentro das obras, com data
  somente leitura e valor editável. Cada valor é limitado a 50% da renda. A
  correção continua separada do saldo nominal.
- Ato, sinais e anuais ganharam seções próprias; o quadro final apresenta os
  dois limites, apurados, excedentes, resultados individuais, status geral e
  motivos. Violações apontam e focam apenas os campos causadores.
- O caso PDF 2 permanece em R$ 17.000,00, R$ 202,38, R$ 288,67 e 15/09/2026.
  Nenhuma migration, integração, outro motor ou default de feature flag mudou.
- O gate isolado aprovou E2E com nove perfis, 147 checks responsivos, 84 de
  tema, 192 de acessibilidade/comparação e 105 de zoom. A conta QA efêmera e as
  fixtures foram removidas; nenhum ambiente remoto foi alterado nesta etapa.
- O primeiro gate HTTPS no SHA `a74215c` aprovou 9/9 fluxos funcionais e toda a
  acessibilidade; reprovou somente as 11 dimensões esperadas da rota WF13 ativa.
  A homologação foi revertida para `c299484` antes de promover exclusivamente
  essas 11 capturas sanitizadas ao conjunto canário versionado.

## 2026-08-18 — Hotfix WF13: paridade do PDF 2

- A reprodução no SHA-base `2bcf6630689989fe542129087acd7be4ee17ec89`
  confirmou `R$ 16.493,81`, `R$ 281,63` e `15/10/2026`.
- A diferença de `R$ 506,19` era a correção das anuais abatida do saldo nominal;
  a data-base 15/09 era avançada novamente para formar a primeira mensal.
- O asset oficial confirmou taxas e anuidade. Com saldo nominal de R$ 17.000,00,
  correção inicial para R$ 17.085,00 e divisão 29/55, a fórmula resulta em
  R$ 288,67, como no PDF 2.
- O motor agora usa centavos e frações inteiras, exige vencimento 05/10/15,
  datas explícitas para sinais e intervalo máximo de 30 dias. A memória fica
  visível e o ledger nominal reconcilia exatamente o saldo.
- O primeiro CI aprovou código, restore, pgTAP e E2E, mas rejeitou somente as 11
  dimensões visuais alteradas do WF13. A promoção transacional regenerou 147
  capturas responsivas, 84 checks de tema, 192 auditorias Axe/comparações e 105
  checks de zoom, todos aprovados sem persistir conta ou fixture QA.
- Na homologação isolada, o smoke HTTPS aprovou 9/9 cenários, incluindo o caso
  PDF 2 por Master e o bloqueio dos outros oito perfis e quatro motores. O gate
  visual repetido aprovou 147/147 rotas, 84/84 temas, 192/192 auditorias Axe e
  105/105 checks de zoom; as 11 diferenças eram exclusivamente a altura esperada
  dos novos campos do WF13 ativo e foram promovidas só ao conjunto canário.
- Nenhuma migration, permissão, flag, integração ou outro motor foi alterado.

## 2026-08-14 — Hotfix WF13: alinhamento do gate visual remoto

- O smoke funcional HTTPS aprovou 9/9 cenários, inclusive cálculo WF13 por
  Master e bloqueio para os demais papéis/motores.
- O primeiro gate visual remoto falhou fechado porque o runner não recebia as
  duas flags oficiais do runtime, embora a aplicação estivesse correta.
- Correção mínima: leitura seletiva do arquivo privado root-only, sem persistir
  ou imprimir segredos; produção permaneceu intocada.

## 2026-08-14 — hotfix do acesso Master à página WF13

- O smoke produtivo mostrou `AUTH-403` antes da renderização. A inspeção
  somente leitura comprovou flag `active/simulator.wf13`, papel Master ativo e
  `crm.simulators.execute` efetiva, mas ausência de `crm.simulators.view`, do
  vínculo Master e das entradas de simulação em `app_pages`.
- A migration remota `20260813192928` foi confirmada no histórico e contém
  somente o gate de execução; não contém a permissão de página nem o catálogo.
  A migration visual antiga permanece fora do histórico remoto e não será
  aplicada em lote.
- A correção forward cria somente o pré-requisito de página do WF13, remove
  herança/overrides não Master dessa chave e mantém o gate de execução
  independente. Outros motores, integrações e runtime comercial não mudam.
- O primeiro CI rejeitou expectativas antigas que ainda davam páginas de
  simulador a cinco papéis. A matriz REST/browser agora exige `403` e ausência
  de CTA para todo não Master; o fluxo Master continua validando cálculo WF13.

## 2026-08-13 — Hotfix WF13: gate visual do canário

- Reproduzida localmente a falha do CI em `simulator-validation`: a página já
  estava carregada, mas `waitForLoadState("networkidle")` expirava por atividade
  assíncrona do runtime. A validação agora aguarda diretamente o campo obrigatório.
- O runner visual isolado passou a propagar apenas as duas variáveis oficiais de
  feature flag ao app e ao harness. Isso permite validar o baseline WF13 ativo de
  forma explícita, mantendo o modo desligado como padrão e os demais motores fora
  da allowlist.
- A execução completa também mostrou que o GET de status devolvia `503` para cada
  motor bloqueado, gerando erro de console apesar do estado visual correto. O GET
  agora exige `crm.simulators.view` e responde `executionEnabled: false`; somente
  o POST preserva `503` para runtime desligado e continua exigindo
  `crm.simulators.execute` + papel Master.
- A matriz ativa detectou corretamente o novo estado do hub. As oito capturas do
  hub com apenas `simulator.wf13` foram separadas no conjunto canário; a baseline
  padrão bloqueada não foi alterada. Múltiplas chaves não recebem fallback de
  baseline e continuam falhando fechadas.

## 2026-08-13 — hotfix do canário Master WF13

- A reprovação humana encontrou o CTA ainda bloqueado após ativação das flags.
  O diagnóstico comprovou no runtime `active/simulator.wf13`, vínculo Master,
  permissão efetiva e sessão produtiva atualizada. O Route Handler oficial não
  depende do runtime genérico de políticas comerciais.
- A interface recebia a decisão somente pelo payload renderizado da página; uma
  página aberta antes da troca de flags podia manter o estado bloqueado. Hub e
  rota agora forçam renderização por requisição e o workspace reconcilia o gate
  por um status autenticado e `no-store` antes de habilitar o CTA.
- O status não executa fórmula nem retorna dados comerciais. O POST continua
  revalidando flag, implementação, permissão, papel Master, origem e payload;
  decisão de interface não substitui autorização server-side.

## 2026-08-13 — baseline visual do canário WF13

- O segundo ensaio passou 147/147 checks responsivos, 84/84 checks de tema,
  192/192 auditorias Axe, 105/105 checks de zoom e E2E 9/9. A única reprovação
  foram 11 comparações da rota WF13 habilitada contra sua baseline canônica
  bloqueada, todas por mudança esperada de altura.
- Homologação foi novamente revertida e comprovada no SHA, configuração e banco
  anteriores; produção permaneceu saudável e inalterada.
- As 11 capturas sanitizadas do canário passaram a formar um conjunto separado
  e rastreado. A seleção depende da mesma chave oficial do runtime; baseline
  ausente, chave desconhecida e qualquer drift continuam reprovando o gate.

## 2026-08-13 — gate visual do canário WF13

- O primeiro ensaio remoto passou nos nove fluxos E2E, mas o verificador visual
  rejeitou a rota WF13 por exigir CTA bloqueado em todos os simuladores,
  inclusive no único canário explicitamente habilitado.
- Homologação foi revertida imediatamente para o SHA, configuração e estado de
  banco anteriores; produção permaneceu inalterada e saudável.
- O gate agora deriva a expectativa das flags oficiais, aceita CTA habilitado
  apenas na rota conhecida correspondente e mantém chaves desconhecidas e todas
  as rotas não liberadas em falha fechada.

## 2026-08-13 — atualização transitiva de segurança

- O CI pós-merge do WF13 bloqueou no audit por advisory novo contra
  `nanoid <3.3.18`, dependência transitiva do PostCSS.
- O override anterior 3.3.17 foi elevado para a versão corrigida 3.3.18; não
  houve mudança de dependência direta, regra comercial, migration ou flag.
- `pnpm why` confirmou uma única versão 3.3.18 e o audit voltou a zero
  vulnerabilidades conhecidas.

## 2026-08-13 — motor oficial WF13

- A função real do Associativo · Fluxo Linear foi inspecionada somente em
  leitura na referência viva. O asset e seu SHA-256 foram registrados sem
  versionar o bundle.
- A implementação tipada reproduz as operações, datas, limites, mensagens,
  arredondamentos e memória. Doze casos representativos comparam as saídas da
  referência e do CRM sem tolerância; todas as diferenças são zero.
- Runtime e endpoint nascem desligados, sem banco ou integração. Quando
  habilitados para `simulator.wf13`, ainda exigem sessão, permissão de execução,
  papel Master e same-origin. Inputs/resultados não são persistidos ou logados.
- Migration própria concede a execução somente ao Master e remove qualquer
  vínculo/override residual; a flag permanece off após migration e deploy.

## 2026-08-13 — sincronização do catálogo RBAC de parcerias

- A revisão pré-aplicação detectou que a migration Master-only usava nível 100,
  mas o espelho TypeScript ainda declarava nível 10. O catálogo local agora
  reflete o mesmo gate, com teste explícito; banco, usuários e produção não
  foram alterados por esta correção.

## 2026-08-13 — convergência RBAC do Canal de Parcerias

- O diagnóstico remoto somente leitura comprovou a divergência: a permissão
  `crm.partnerships.view` não existia, enquanto `crm.partnerships` ainda usava
  `crm.ranking.view`. O menu herdava a chave antiga e a rota exigia a nova,
  explicando o `AUTH-403` para Master.
- A migration exclusiva cria/atualiza somente essa permissão com nível 100,
  remove vínculos não Master e overrides diretos dessa chave, vincula Master e
  atualiza exatamente uma linha do catálogo. Ausência/duplicidade falha a
  transação fechada.
- O teste pgTAP prova catálogo, nível, vínculo Master-only, zero override e
  convergência entre menu e guard. Código da rota, demais permissões, Qlik,
  integrações, dados comerciais e aplicação permanecem inalterados.

## 2026-08-13 — contenção emergencial da leitura pública Qlik

- Diagnóstico somente leitura comprovou `SELECT` de `anon`, `authenticated` e
  `service_role` e policies públicas nas três tabelas `crm_imob_ranking_*`.
  Logs sanitizados preservam ao menos 51 GETs bem-sucedidos não atribuídos;
  origem externa e exfiltração não foram comprovadas.
- Backup lógico root-only incluiu roles, schema, dados e histórico. Restore
  isolado PostgreSQL 17.6 reproduziu exatamente 97 runs, 29.779 entries e 4.031
  developments, com hashes canônicos idênticos e sem rede externa.
- Migration emergencial exclusiva força RLS, remove todas as policies de
  leitura e revoga privilégios diretos dos papéis da Data API e
  `service_role`. Não altera dados, RBAC, app, usuários ou integrações.
- Comparação canônica externa confirmou hashes de dados inalterados. pgTAP do
  restore aprovou 15/15 casos de ACL, policies, RLS e preservação estrutural do
  writer. Leitores diretos ficam indisponíveis; leitura pública não é rollback.
- Publisher confirmado continua no workflow `r4DyPyOTDtoROXq0`, usando RPC
  `SECURITY DEFINER` por transporte `anon`. Revogar leitura não quebra a RPC,
  mas identidade dedicada e menor privilégio ainda exigem gate separado; relay
  e workflow não foram alterados.

## 2026-08-10 — release candidate, E2E e gates

- A primeira execução do CI remoto revelou que o Supabase CLI pode escrever
  mensagens informativas junto do JSON de status. Os gates E2E e visual agora
  extraem exatamente um objeto JSON balanceado e rejeitam saída ausente,
  truncada ou múltipla; casos sintéticos, E2E/RLS e a matriz visual autenticada
  passaram localmente após a correção.
- Branch criada do SHA exato
  `d00118fe62296fa3e23e266585899e3ee3a78478`; feature flags permaneceram off.
- Playwright passou a executar login inválido/anônimo, logout, nove perfis,
  catálogo e permissões exatas nas 21 rotas, Dashboard, cinco etapas, Ranking,
  Canal, filtros, v3 desligado, relay/motores indisponíveis e simuladores visuais
  bloqueados.
- A execução inicial revelou ciclo de redirect para conta autenticada ainda não
  aprovada. A distinção sessão válida/sem autorização agora termina em 403
  uniforme sem revelar estado do perfil; o próprio 403 permite logout e troca
  de conta, cobertos no navegador com o perfil pending.
- Quatro versions remotas ganharam markers locais no-op. Nenhum verifier, grant,
  fórmula ou DDL inseguro foi copiado. A matriz registra o bloqueio de ordem das
  três migrations locais antigas; nenhum push remoto é hoje autorizado.
- Dois projetos/containers PostgreSQL 17 efêmeros e independentes refizeram 26
  migrations; origem e alvo restaurado passaram 863 pgTAP, lint e advisors. O
  backup/restore preservou owners e privilégios efetivos e obteve fingerprint
  canônico idêntico sem mutar ACL no alvo. Roles relay/engine ficaram `NOLOGIN`;
  credenciais, gates, mappings, políticas e execuções permaneceram zerados.
- Os dois casts implícitos de arrays UUID no read model v3 foram tornados
  explícitos; o lint SQL local passou sem warnings depois de reset completo.
- O Compose agora injeta a tag imutável também no runtime do container, para o
  healthcheck identificar o SHA em vez de depender apenas do build ARG.
- As 12 divergências do `format:check` foram corrigidas mecanicamente. CI ganhou
  jobs de formato, Supabase/pgTAP, Playwright/matriz visual e restore isolado.
- A matriz visual passou a falhar por baseline ausente/drift acima de 1%, roda
  Axe WCAG A/AA em 87 combinações e publica somente candidatos sanitizados no
  CI, inclusive em falha. O modo normal mantém o baseline igual ao `HEAD`; uma
  atualização exige flag explícita e promoção transacional após todos os checks.
- A primeira execução objetiva encontrou contraste insuficiente no aviso de
  indisponibilidade dos simuladores e no rótulo de capacidade das metas; ambos
  passaram a preservar contraste integral sem mudar comportamento.
- Pacote único documenta aprovações, merge train empilhado, bloqueio de ordem de
  migrations, app-first, canário, rollback floor e deploy futuro.
- Nenhum Supabase remoto, dado, grant aplicado, n8n, Salesforce, Qlik, VPS,
  container externo, DNS ou Nginx foi alterado. Não houve merge, cutover ou
  deploy.

## 2026-08-10 — runtime versionado de políticas comerciais

- Branch criada do SHA exato `1f570d0a7b3ce64571019b121b0b4aff132e1676`.
  O baseline aprovou instalação congelada, lint, typecheck, 193 Vitest + 8 Node,
  build de 37 rotas e 770 pgTAP antes das alterações.
- O inventário confirmou zero policy oficial e zero caso de ouro oficial para
  WF13/WF14/WF15/WF16/CAIXA, metas, pontos, ranking, SLA, roleta, campanhas ou
  premiações. Legado, configuração v2 e fixtures não foram promovidos a regra.
- Foram catalogadas 14 chaves estruturais. A DSL v1 é fechada, determinística e
  sem rede/SQL/relógio/aleatoriedade; usa decimal `BigInt`, datas civis UTC,
  limites de complexidade, dispatch versionado e atestação privada após executar
  todos os casos de ouro.
- A migration local cria catálogo, versões/imports/executions imutáveis, gate,
  owners/backup, preview/apply e permissões separadas. Nenhuma policy, caso real,
  grant de execução, gate ou valor comercial é seedado.
- Lookup e ledger saíram da Data API: somente o papel PostgreSQL
  `crm_commercial_engine` recebe os dois entrypoints. Ele nasce `NOLOGIN`, sem
  senha/tabela/sequence/membership utilizável; flags, allowlist e URL ficam
  vazias. O baseline `PUBLIC` mantém o checker de isolamento falso até hardening
  remoto separado e explicitamente autorizado.
- Revisões adversariais fecharam RPC runtime pública, TOCTOU de ator/owner,
  downgrade concorrente, SQLSTATE ambíguo, escala intermediária, concat/AST DoS,
  canonical JSON não finito, objeto verificado forjável, manifesto parcial e
  confiança em `X-Forwarded-Host`. A revisão final também vinculou a conexão ao
  project ref da aplicação, limitou outputs a 30 dígitos, preservou replay
  histórico após owner inativo e passou a expandir ACL default no checker.
- Reset Supabase estritamente local aplicou a migration limpa; pgTAP aprovou
  863/863, incluindo 93/93 do runtime. O lint SQL não apontou achado novo; reteve
  apenas alertas da extensão pgTAP e dois warnings preexistentes do read model v3.
- Os gates finais aprovaram lint, typecheck, 226 Vitest + 8 Node (um ignorado),
  build de 37 páginas, schema diff vazio, advisors sem issues, audit/OSV sem
  vulnerabilidade e Gitleaks sem achado na árvore ou em 210 commits. Actionlint,
  ShellCheck, `bash -n` e Compose com configuração sintética também passaram.
- Nenhum Supabase remoto, dado, grant, migration aplicada, workflow n8n,
  Salesforce, Qlik, VPS, container, DNS ou Nginx foi alterado. Não houve merge,
  deploy, cutover nem provisionamento de segredo.

## 2026-08-10 — relay Qlik, mappings e cutover local

- Branch criada do SHA exato `96d48b0e64ad85c5020d4ec69b6f1dd0bf408e08`.
  Baseline aprovou lint, typecheck, 125 Vitest + 8 Node (um ignorado), build de
  37 rotas e 684 pgTAP antes das alterações.
- Inspeções remotas somente leitura identificaram o único publisher entre 484
  workflows: n8n `r4DyPyOTDtoROXq0` (`ranking imobs`), agenda de 30 minutos,
  papel efetivo `anon` e owner técnico Leandro Lucas (`global:owner`). A amostra
  correlacionou 27/27 execuções bem-sucedidas; owner operacional/backup e
  leitores `GET` residuais permanecem gates.
- O relay server-only exige HMAC do request canônico, digest do body, timestamp,
  nonce, 1 MB máximo e schema estrito. Flags ficam off; a conexão dedicada
  rejeita usuários administrativos e recebe somente a RPC `qlik_relay`.
- A migration local cria papel `NOLOGIN`, registry/gate/ledger vazios, RLS
  forçada, shadow sem fatos, duas janelas shadow, duas canary e saúde agregada.
  Nenhuma credential, owner, mapping, target ou dado real foi seedado.
- A CLI de mappings faz preview por padrão e exige flag, hash do manifesto e
  hash do plano para apply. O banco revalida autoridade, conflitos e estado em
  transação atômica; owners/targets nunca são criados pelo importador.
- Revisões adversariais fecharam TLS sem verificação integral, reutilização de
  HMAC, drift de atributos/ACL/session user do papel, replay histórico com body
  não validado, aliases whitespace e bypass da autoridade pela primitiva antiga.
  O papel continua `NOLOGIN`: grants `PUBLIC` de `pg_net` e banco fazem o helper
  retornar `false` até remediação futura pelos owners autorizados.
- Reset integral passou; pgTAP aprovou 770/770, incluindo 86/86 casos do
  relay/mappings. Lint, typecheck, 193 Vitest + 8 Node, build de 37 páginas,
  advisors, auditorias de dependência/segredos, Actionlint e ShellCheck passaram.
  O lint SQL reteve somente duas advertências preexistentes do read model v3.
- A ponte Qlik anterior foi tornada aditiva: preserva a RPC legada até cutover;
  o hardening destrutivo permanece em incremento separado.
- Nenhum Supabase remoto, dado, grant, migration aplicada, workflow n8n,
  Salesforce, Qlik, VPS, container, DNS ou Nginx foi alterado. Não houve
  cutover, merge ou deploy.

## 2026-08-09 — prova remota, restore isolado e hardening RLS local

- Esta entrada conclui o gate que antes estava bloqueado por autenticação da
  CLI. O projeto remoto foi observado somente por leitura: PostgreSQL 17.6,
  21 tabelas públicas, 26 funções públicas, 20 policies, 8 triggers públicos,
  3 usuários Auth e zero objetos Storage/Vault. Nenhum dado, grant, policy,
  migration, Auth, n8n ou deploy remoto foi alterado.
- A união contém 20 migrations no SHA-base: 13 comuns, quatro somente remotas
  e três somente locais. Statements e hashes das quatro remotas foram
  recuperados do histórico, mas não são apresentados como arquivos históricos
  originais. DDL e inventário canônico sanitizados foram versionados.
- O backup oficial root-only foi restaurado em stack isolada PostgreSQL 17.6:
  48/48 contagens e checksums de multiconjunto coincidiram; inventário de
  aplicação não teve diff; Auth/Storage/PostgREST responderam 200; pgTAP de
  restore passou 28/28. Limites de configuração Auth e binários Storage estão
  documentados. Stack e dumps brutos sensíveis foram removidos ao final.
- `20260809144137` prepara cadastro `pending` inativo, quatro papéis técnicos,
  organizações, pessoas, equipes, carteiras, identidades externas, reporting
  scopes, grants temporais e aprovação atômica. Contas antigas não-Master ficam
  `legacy_review`; read models v2 continuam globais e não recebem filtros
  dimensionais fictícios.
- A fundação escopada bloqueia mudanças silenciosas de fronteira: identidade de
  scope e organização da equipe são imutáveis; pessoa/Auth, memberships e
  carteira/organização exigem suspender todos os usuários afetados antes da
  manutenção. Locks transacionais por entidade e `FOR UPDATE` determinístico
  serializam aprovação, reativação e topologia; a decisão é revalidada depois
  do lock. Somente Master/Admin aprova ou reativa, papéis de escopo unitário
  exigem exatamente um grant e afiliações não expiradas, inclusive futuras ou
  inativas, entram na contenção direcional.
- `20260809144143` preserva runs/entries/developments Qlik, força RLS, fecha
  grants/policies diretos, mantém ingestão service-role-only e cria leitura
  autenticada somente com `crm.partnerships.view`, identidade Qlik mapeada e
  organização no escopo. O caller `anon` remoto segue ativo e desconhecido;
  por isso a migration não pode ser aplicada antes do cutover comprovado.
- A matriz local passou 518 pgTAP, cobrindo signup, grants, FORCE RLS,
  isolamento horizontal/vertical, papéis, Qlik, ingestão, metas e read models.
  A prova PostgREST sintética passou com nove perfis removidos ao final, oito
  negativas anônimas sem linhas e bloqueio uniforme do exploit de dupla
  afiliação. Nenhuma conta ou fixture remota foi criada.
  O pacote comercial registra conflitos e decisões faltantes sem promover
  legado, workflow ou fórmula a autoridade.

## 2026-08-09 — gate de reconciliação de fontes e migrations

- A branch `codex/source-migration-reconciliation` foi criada exatamente de
  `81968eb72371d5a1a794d48703de41a7feb58f70`, HEAD do PR #26. O PR original,
  produção, Supabase remoto, n8n, VPS, DNS e Nginx não sofreram mutação.
- A união do histórico contém 20 versões: 13 conciliadas, quatro somente
  remotas e três somente locais. O SQL exato das quatro remotas foi localizado
  no histórico interno do banco; verifier e grants inseguros não foram copiados
  ao Git. A matriz registra hashes, dependências, objetos e plano de markers +
  hardening posterior.
- O inventário remoto somente leitura confirmou 21 tabelas, 20 policies e 26
  funções públicas. As três tabelas Qlik aceitam leitura `anon`, escrita direta
  de `service_role` e a RPC legada `SECURITY DEFINER` aceita `anon`. Cadastro
  público + provisionamento ativo `user` também pode expor snapshots globais
  quando signup estiver habilitado. Nenhuma correção remota foi executada.
- Salesforce/n8n, Qlik, dois escritores legados de estoque e SLA foram
  mapeados. Contratos Zod cobrem as sete projeções Salesforce, envelope v2,
  Qlik v1 e estoque fail-closed; testes rejeitam PII/campos extras, identidades,
  datas e relógio inválidos, duplicidade e disponibilidade inventada.
- A auditoria dos workflows históricos classificou WF13, WF14, WF15 e WF16
  como implementados sem autoridade e divergentes; CAIXA está ausente. Metas,
  scoring, bônus, arredondamento, desempate, SLA, produtividade, campanhas,
  roleta e prêmios não possuem política oficial ratificada. Todos continuam
  bloqueados.
- A proposta de escopos usa IDs oficiais, organizações, equipes, carteiras,
  pessoas e read models v3 deny-by-default. Nenhuma migration foi criada porque
  mapeamentos de Gerente/House/Canal/Admin, onboarding e identidades ainda
  exigem decisão.
- A CLI Supabase `2.111.0` restaurou schema/dados `public` do PostgreSQL local
  `17.6` em banco isolado: 20 tabelas, 27 funções public/private, 19 policies,
  checksums e contagens iguais. O alvo e os dumps foram removidos. O teste
  também provou que Auth/Storage integral exige alvo Supabase provisionado; não
  substitui backup remoto.
- O acesso read-only do conector funciona, mas a CLI vinculada não tem sessão de
  plataforma. `supabase migration list --linked` falhou com
  `LegacyPlatformAuthRequiredError`; dump DDL remoto e restore integral ficam
  bloqueados até login privado e alvo/custo aprovados.
- Gates finais: instalação congelada, formatação dos arquivos alterados, ESLint,
  TypeScript, Vitest/Node, build, 283 pgTAP, lint/advisors locais, auditoria pnpm,
  Gitleaks árvore/histórico e OSV aprovados. O `format:check` global continua
  falhando somente em 12 arquivos preexistentes fora do diff; nenhum foi
  reformatado neste gate.

## 2026-08-09 — consolidação visual das 18 páginas

- Esta entrada supersede o recorte inicial da fundação registrado logo abaixo:
  as 18 páginas da referência viva agora têm composição visual no catálogo
  protegido, sem ampliar o escopo funcional ou copiar autoridade comercial do
  sistema legado.
- Dashboard, cinco etapas, ranking, Canal de Parcerias, configurações, metas e
  cinco jornadas de simulação compartilham topbar hierárquica, ícones e o
  design system navy/cyan/lime. Estados sem fonte mantêm toda a composição e
  exibem “indisponível” em vez de converter ausência em zero.
- O hub e as rotas WF13, WF16, CAIXA, WF14 e WF15 foram adicionados ao catálogo
  com a permissão `crm.simulators.view`, guard server-side e grants de catálogo
  mínimos. Os formulários são apenas visuais: não têm submit, persistência,
  fórmula ou resultado ativo.
- A migration `20260809024000_simulator_visual_catalog.sql` altera somente o
  catálogo de páginas, a permissão e sua matriz de papéis. Tabelas Qlik, grants
  de dados, policies, funções comerciais e contratos dos simuladores não foram
  alterados.
- O Canal de Parcerias permanece sem leitura direta das tabelas protegidas e
  sinaliza a integração pendente. Ranking avançado, roleta, prêmios e motores
  WF13/WF14/WF15/WF16/CAIXA seguem bloqueados para incrementos com fonte oficial.
- QA autenticado complementar passou em Supabase local isolado com conta QA
  efêmera e fixtures sintéticas removidas ao final: 72/72 checks responsivos,
  54/54 checks de tema, 18/18 rotas em zoom de 200%, teclado, reduced-motion e
  87 capturas sem overflow ou erro de aplicação. A barreira anônima passou nas
  18 rotas do build local nos quatro viewports.
- A comparação autenticada em homologação continua bloqueada por ausência de
  URL e credencial QA dedicadas. Produção, conta Master/Admin pessoal, deploy,
  merge e criação de usuário remoto não foram usados.

## 2026-08-09 — fundação de paridade da referência

- A referência viva foi recatalogada em 18 rotas. O checkpoint antigo permanece
  apenas como proveniência; não autoriza dados, fórmulas ou regras comerciais.
- A matriz de paridade separa seis páginas desta fundação, rotas seguras já
  existentes e simuladores/ranking avançado/Canal de Parcerias adiados.
- O shell protegido ganhou topbar navy/cyan/lime e navegação pai/filho montada
  somente depois do filtro efetivo de permissões. Supabase SSR, guards, RLS,
  grants, CSP e logout não mudaram.
- Dashboard e cinco etapas passaram a reutilizar cards, filtros, roscas, funis,
  gauge, tabela, ranking, skeleton e estados. Nenhum campo nulo vira zero;
  últimos 7/14 dias não recebem fallback; meta ausente ou zero não desenha arco.
- A projeção proporcional, filtros dimensionais, thresholds editoriais,
  simuladores, roleta, prêmios e cálculos comerciais ficaram fora do código por
  ausência de fonte oficial aprovada.
- O harness Playwright cobre as 18 páginas da referência com máscara opaca
  irreversível aplicada no DOM. PNG bruto fica só em memória; o Git recebe WebP
  sem metadados, manifest e hashes SHA-256. A execução final respondeu `200` em
  18/18 rotas, aplicou 2.969 máscaras e não registrou erro de aplicação no
  console, erro de página, mudança de URL ou mutação durante a captura. Bloqueios
  de rede impostos pelo próprio harness são contabilizados separadamente.
- A barreira anônima passou antes e depois: doze rotas CRM retornaram `307` para
  `/login`; os quatro viewports terminaram no formulário vazio com `200`, CSP,
  X-Frame-Options e nosniff, sem marcador comercial ou erro. Os WebP de antes e
  depois têm SHA-256 idêntico por viewport. Os 26 arquivos passaram em dimensão,
  checksum e ausência de EXIF, ICC, IPTC e XMP.
- A comparação autenticada foi interrompida apenas nessa etapa: URL de
  homologação e credencial QA dedicada não foram disponibilizadas nem
  localizadas nos canais seguros inspecionados. Produção foi consultada somente
  de forma anônima para o limite “antes”; contas pessoais e criação de usuário
  foram descartadas. Temas, teclado, zoom de 200% e perfis no conteúdo protegido
  permanecem pendentes.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passaram. Foram 81
  testes Vitest aprovados, um teste condicional omitido por ausência do artefato
  opcional Salesforce, oito testes Node aprovados e 282 asserções pgTAP.
  Playwright/Chromium foi provisionado; `pnpm audit` não encontrou
  vulnerabilidade e o Gitleaks não encontrou segredo.
- Nenhuma migration, banco remoto, DNS, deploy, workflow ou regra de simulador
  foi alterado.

## 2026-08-08 — buffer de resposta do Nginx

- Doze falhas de login desde 04/08 foram correlacionadas ao erro Nginx
  `upstream sent too big header while reading response header from upstream`.
  Aplicação, container, `/login` e `/api/health` permaneceram saudáveis.
- Auditor Chromium reproduziu o protocolo hidratado da Server Action da imagem
  implantada, criou sessão e mediu somente o tamanho total dos headers: 4.260
  bytes. Nenhum valor de cookie, token, senha ou header foi registrado.
- O template HTTPS agora define `proxy_buffer_size 8k`, `proxy_buffers 8 8k` e
  `proxy_busy_buffers_size 16k` somente no `location /` do CRM. Configurações
  globais, `large_client_header_buffers`, aplicação e Supabase não mudaram.
- Runbook documenta backup root-only com checksum, `nginx -t`, reload sem
  restart, gates de login/saúde/logs e rollback imediato.

## 2026-08-08 — experiência visual do cadastro

- O cadastro reutiliza diretamente o cérebro mecânico e os estilos-base do
  login, com composição responsiva própria para os quatro campos e rolagem
  vertical confortável em telas ou zoom que não comportem todo o formulário.
- `signupAction`, schema Zod, payload, nomes, IDs, tipos, autocomplete, estado
  pendente, mensagens e resultado do cadastro foram preservados. O teste
  funcional local confirmou o mesmo payload e resposta usando um mock isolado,
  sem chamada ao Supabase remoto ou criação de usuário real.
- Chromium aprovou 70/70 checks em 1440×900, 1280×720, 768×1024, 390×844,
  zoom de 200%, três temas, redução de movimento, touch, teclado, erros,
  carregamento, contraste, retorno do parallax e imagem atrasada com CLS zero.
- O login permaneceu byte a byte inalterado e passou pelo teste de regressão.
  Nenhuma dependência, lockfile, backend, autenticação, middleware, banco,
  infraestrutura, produção ou deploy foi alterado.

## 2026-08-08 — correção isolada do nanoid

- O override transitivo fixa `nanoid` em `3.3.17`, versão corrigida para o
  advisory `GHSA-2v37-7h3g-55p8` que bloqueou a CI do PR visual do login.
- Nenhuma outra dependência, arquivo de aplicação, autenticação, Supabase,
  middleware, banco, produção ou deploy foi alterado.

## 2026-08-07 — experiência visual do login

- A tela existente foi mantida como único ponto de autenticação, preservando
  `loginAction`, nomes dos campos, payload, validações, erros e redirecionamentos.
- O login ganhou layout responsivo em duas áreas e um componente visual isolado
  com cabeça mecânica, engrenagens SVG alternadas, parallax limitado e retorno
  suave controlado por `requestAnimationFrame`.
- O asset local recebeu recorte transparente real; não há fundo quadriculado,
  dependência nova, listener global ou captura de eventos do formulário.
- Ponteiros sem hover recebem imagem estática e `prefers-reduced-motion` desliga
  parallax, rotação e transições decorativas.
- A candidata isolada passou por 56 checks em Chromium nos quatro tamanhos
  pedidos, zoom de 200%, redução de movimento, touch, teclado, autofill, erro,
  três temas, contraste e imagem atrasada. As capturas sem credenciais e o
  resultado estruturado estão em `docs/qa/login-visual/`.
- O QA identificou e corrigiu somente no CSS do login a borda reta inferior do
  recorte e o contraste do placeholder/input no tema escuro. Nenhuma conexão
  remota ou alteração de autenticação foi realizada.

## 2026-08-07 — causa raiz e contrato seguro da integração Qlik

- Logs PostgreSQL registraram às `04:00:30Z` os dois `GRANT SELECT` e os dois
  `ALTER POLICY` por `POST /mcp`, usando a identidade OAuth do conector
  Supabase/Codex. A alteração ocorreu depois de tentativas anônimas negadas e
  não veio do proprietário `postgres` de forma autônoma.
- O exportador `qlik-ranking-api.service` e seu script foram auditados na VPS
  de origem: eles apenas autenticam no Qlik, produzem JSON e não possuem cliente
  PostgreSQL/Supabase, DDL, cron ou job de grants.
- O workflow n8n `ranking imobs` está ativo, porém sem execução registrada. Ele
  não contém DDL, grava diretamente por nodes Supabase e sua credencial aponta
  ao projeto antigo, não a `descomplica-crm-production`.
- A migration `20260807185611_secure_qlik_ingestion_contract.sql` revoga todos
  os privilégios diretos nas duas tabelas, remove `anon` das policies, mantém
  RLS/default privileges fechados e cria uma RPC transacional exclusiva do
  `service_role` para substituir as escritas diretas.
- Testes regressivos cobrem a matriz completa, roles das policies, preservação
  por contagem/hash, atomicidade, conflito de replay e idempotência. Nenhuma
  migration remota, workflow, Salesforce ou produção foi alterado nesta etapa.

## 2026-08-07 — reconciliação da baseline Salesforce

- A coleta validada de 06/08 foi confrontada com nova execução do mesmo
  exportador, relatório, filtro e usuário. A comparação ocorreu na VPS da fonte;
  somente contagens e HMACs saíram do ambiente legado.
- As 385 oportunidades adicionais foram criadas e modificadas depois de
  `2026-08-06T21:38:49.821Z`. Não houve oportunidade removida, renomeada ou
  duplicada. A baseline passou de 11.914 para 12.299 oportunidades.
- Doze criações registradas em 07/08 UTC pertencem a 06/08 em
  `America/Sao_Paulo`; o filtro Salesforce usa o fuso do executor e está
  correto. Escopo organizacional e definição do relatório não mudaram.
- Um contato ainda existente teve o status alterado na fonte e deixou o
  relatório de corretores. A base passou de 27 para 26 e o ranking de 108 para
  104 participantes, removendo os quatro períodos do mesmo corretor.
- Nenhuma correção de código foi necessária. Supabase, n8n ativo e produção
  permaneceram sem escrita; as flags Salesforce continuam desativadas.

## 2026-08-07 — reconciliação do drift Supabase/Qlik

- Auditoria somente leitura comparou o projeto `descomplica-crm-production` com um reset local das doze migrations então versionadas. Histórico de migrations, 18 tabelas comuns, funções, sequências, schemas e default ACLs coincidiram por nome e hash.
- O drift da aplicação ficou restrito a duas tabelas Qlik com RLS, duas policies, 339 registros associados a dois runs concluídos e a página `crm.partnerships`. `rls_auto_enable`/`ensure_rls` foram classificados como objetos opcionais gerenciados pela plataforma e já permaneciam sem execução por Data API roles.
- Nenhum caller, view, função, trigger ou rota para o ranking de imobiliárias existe no repositório. Os grants remotos diretos de leitura para `anon`/`authenticated` e escrita/leitura para `service_role` não possuíam contrato versionado.
- A migration corretiva preserva tabelas, linhas e RLS; versiona o DDL e a identidade do catálogo; remove `anon` das policies; recompõe as allowlists de grants; mantém default privileges do papel de migration fechados.
- A migration não foi aplicada remotamente. Salesforce, segredos, produção e automações permaneceram inalterados.

## 2026-08-06 — disponibilidade explícita de metas e roleta

- A primeira carga real foi autorizada sem fonte oficial para metas ou roleta,
  desde que zero não fosse apresentado como resultado comercial.
- O contrato candidato avançou para `schemaVersion: 2`, com
  `goalsAvailable` e `rouletteAvailable` obrigatórios. Fonte indisponível exige
  zeros técnicos e falha se transportar valor comercial diferente de zero.
- A migration `20260806222732_salesforce_source_availability.sql` adiciona flags
  fail-closed aos snapshots. A função v1 foi movida para schema privado, sem
  execução externa, e o wrapper v2 persiste as flags atomicamente sem permitir
  que replay idempotente as altere.
- Dashboard e detalhes mostram “Fonte não configurada”/“Dados indisponíveis” e
  ocultam progresso, atingimento e gap. O ranking exclui roleta da pontuação e
  não apresenta seus pesos como disponíveis.
- Validação parcial: TypeScript, 45 Vitest, 8 testes Node e 190 pgTAP locais
  aprovados. A migration ainda não foi aplicada remotamente e nenhuma carga ou
  automação foi ativada.

## 2026-08-04 — lançamento sem Salesforce

- Branch `feat/salesforce-capability-flags` criada a partir de
  `c1d6af7b80d9ee33b694bdb8907e0a05183c9691` para separar o lançamento inicial
  da ativação futura das integrações.
- Ingestão M2M e refresh humano foram confirmados como capacidades
  independentes. Flags server-side exigem o valor literal `true`; qualquer
  ausência, valor diferente ou configuração incompleta falha fechada com
  `503`, sem cliente privilegiado ou chamada externa.
- A interface recebe somente o booleano de disponibilidade calculado no
  servidor. URL e segredos não atravessam a fronteira de Server Components.
- A configuração Supabase Auth de produção exige somente Site URL
  `https://crm.descomplicapro.com.br`. O código atual não possui callback OAuth,
  magic link ou recuperação de senha e, portanto, não requer redirects
  adicionais de produção.
- Validação local: 40 Vitest, 162 pgTAP, formatação, ESLint, TypeScript, build
  Next.js de 19 rotas, pnpm audit, OSV-Scanner, Gitleaks, actionlint,
  ShellCheck e validadores operacionais aprovados. Nenhuma migration foi criada
  ou aplicada; o Supabase local foi encerrado após os testes.

## 2026-08-04 — preparação da VPS de produção

- Commit-base inspecionado: `e14e9cf24966b86f835c2b717e1af4a42b32f568`.
- Validação da main: Prettier, ESLint, TypeScript, 30 Vitest, build de 18
  rotas, auditoria pnpm, Gitleaks, OSV-Scanner e actionlint aprovados.
- Supabase estritamente local: 162 testes pgTAP aprovados; lint e advisors de
  segurança/performance sem achados. Nenhuma migration remota foi aplicada.
- A implantação Docker/Nginx foi preparada na branch
  `ops/production-vps-docker`; o app permanece em loopback e HTTP público não
  encaminha tráfego antes do TLS.
- Smoke test da imagem standalone: container sem privilégios, filesystem
  somente leitura, limite de 2 GiB/1,5 CPU, healthcheck `healthy`, `/api/health`
  e `/login` respondendo `200` exclusivamente em `127.0.0.1:3000`.
- Hardening do host: usuário `deploy` com chave, senhas SSH desativadas, root
  mantido somente por chave, Fail2ban, atualizações automáticas, sysctl e UFW
  com entrada limitada a 22/80/443. O Nginx retorna `503` em HTTP até o TLS.
- DNS confirmado por Cloudflare, Google, Quad9 e pelos autoritativos
  `pixel.dns-parking.com`/`byte.dns-parking.com`: A `187.127.249.50` e AAAA
  `2a02:4780:75:cad3::1`, ambos com TTL de 300 segundos.
- `Generating static pages` reportou 23 unidades internas do build, não rotas.
  A `main` exibe 18 rotas; esta branch exibe 19 porque acrescenta somente
  `/api/health`. Os manifests confirmam 20 caminhos de aplicação na `main` e 21
  nesta branch, sem remoção. A única mudança no `next.config.ts` é o
  `deploymentId` opcional; não há filtro, rewrite ou alteração de descoberta de
  rotas.
- Node 24.19.0 e pnpm 11.20.0 foram confirmados, sem divergência, no host,
  `package.json`, `.nvmrc`, Dockerfile e GitHub Actions.
- Assistente seguro de ambiente adicionado para uso no Terminal. Ele preserva
  valores válidos, valida as novas chaves Supabase, gera os dois Bearers
  Salesforce e grava o arquivo com troca atômica e permissões restritas.
- Validação final da branch: formatação, ESLint, TypeScript, 30 Vitest, 162
  pgTAP, auditorias pnpm/OSV, Gitleaks de árvore/histórico, actionlint e build
  Next.js com 19 rotas aprovados. O assistente passou por Bash syntax,
  ShellCheck, `visudo`, teste de entrada sem eco e reexecução com preservação
  byte a byte. O Supabase local foi encerrado após os testes.

## 2026-08-03 — preparação obrigatória do ambiente

### Fontes preservadas

| Fonte                        | SHA-256                                                            | Git original             |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `descomplica-crm.zip`        | `1b80ed5f548216fb82452cde93e88b352b3114a9d8fd191b15a24f7950730bbd` | `6783f68`, branch `main` |
| `sistema login completo.zip` | `0ff10c588dede98572f434d0fc58cd64860302d686ef203a595472a6d2c317bb` | `09ae627`, branch `main` |

Os arquivos foram extraídos em cópias isoladas, excluindo `node_modules`, `.next`, metadados Apple e artefatos gerados. Os históricos originais foram preservados em tags e bundles. O repositório final nasceu de clone limpo dos arquivos rastreados do sistema de login.

### Higiene e segredos

- O ZIP do login continha `.env.local` ignorado pelo Git, com credencial pública legada e identificadores reais.
- O arquivo foi movido para quarentena local com permissão restrita; nenhum valor foi copiado para a entrega, logs ou Git.
- Gitleaks do histórico Git: zero achado em 35 commits do login e 126 commits do CRM.
- Gitleaks da árvore: um achado no arquivo local do ZIP do login; zero no CRM.
- Decisão: usar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e solicitar rotação da chave legada ao proprietário antes de qualquer uso remoto.
- O scan bruto da árvore final sinalizou 13 valores aleatórios exclusivamente em manifests/cache `.next`. A configuração Gitleaks passou a excluir somente artefatos gerados/ignorados; código atual e histórico continuam verificados separadamente.

### Baseline — sistema de login original

Ambiente: Node 24.19.0 e pnpm 11.1.2 conforme lockfile original.

| Comando                                | Resultado                                           |
| -------------------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | aprovado                                            |
| `pnpm lint`                            | aprovado                                            |
| `pnpm typecheck`                       | aprovado                                            |
| `pnpm test`                            | inexistente                                         |
| `pnpm build`                           | aprovado com Next.js 16.2.6                         |
| `pnpm audit`                           | 23 vulnerabilidades: 14 altas, 8 moderadas, 1 baixa |
| smoke local `/`, `/login`, `/register` | 307, 200, 200                                       |

### Baseline — CRM original

Ambiente: Node 24.19.0 e npm/package-lock original.

| Comando            | Resultado                                                        |
| ------------------ | ---------------------------------------------------------------- |
| `npm ci`           | instalou 708 pacotes; aviso de pacote depreciado                 |
| `npm run lint`     | exit 0, um warning de variável não usada                         |
| `npx tsc --noEmit` | falhou com 16 erros de tipos Cloudflare/D1 e componentes         |
| `npm run build`    | gerou build Vinext com warnings de imports Node/compatibilidade  |
| `npm test` isolado | falhou: URL ESM `cloudflare:` e arquivo SkeletonPreview ausente  |
| `npm run dev`      | falhou: data de compatibilidade nova demais para o binário local |
| `npm audit`        | 18 vulnerabilidades: 13 altas, 4 moderadas, 1 baixa              |

Uma falha `EEXIST` observada ao executar teste e build simultaneamente foi descartada como corrida artificial; o teste isolado acima é o baseline canônico.

### Dependências e incompatibilidades

- Inventários completos diretos estão em `docs/DEPENDENCIES.md`; `pnpm-lock.yaml` registra a árvore transitiva final.
- Removidos do alvo: Cloudflare plugin, Wrangler, Vinext, Vite/RSC, Drizzle/D1, React Server DOM direto e package-lock.
- Consolidados: Next, React, React DOM, Tailwind, TypeScript, ESLint e tipos.
- Adicionados com uso comprovado: Vitest, Supabase CLI e Sharp.
- Atualizados seletivamente para correções compatíveis: Next 16.3.0, React 19.2.8, Supabase SDK 2.112.0 e SSR 0.12.4.
- Mantidos em versões estáveis compatíveis: TypeScript 5.9.3, ESLint 9.39.5 e Tailwind 4.3.0; não houve atualização indiscriminada.
- Nenhum `--force` ou `--legacy-peer-deps` foi usado.

### Ferramentas instaladas/validadas

| Ferramenta              |   Versão final |
| ----------------------- | -------------: |
| Node.js via NVM         |        24.19.0 |
| NVM                     |         0.40.6 |
| pnpm via Corepack       |        11.20.0 |
| Git                     |         2.50.1 |
| GitHub CLI              |         2.97.0 |
| Docker Engine / Compose | 29.4.3 / 5.1.4 |
| Supabase CLI            |        2.111.0 |
| PostgreSQL client       |           18.4 |
| Gitleaks                |         8.30.1 |
| OSV-Scanner             |          2.4.0 |
| actionlint              |         1.7.12 |
| ShellCheck              |         0.11.0 |

O Homebrew instalou Node 26 como dependência transitiva de uma CLI, mas o shell do projeto foi corrigido para sempre selecionar Node 24 pelo NVM. `.zprofile` e `.zshrc` foram validados em nova sessão.

### Segurança da base final

- Overrides mínimos corrigem faixas vulneráveis de `@babel/core`, `brace-expansion` e `postcss`.
- Uma primeira auditoria final encontrou `@babel/core` 7.29.0 com severidade baixa. OSV indicou correção em 7.29.6; a versão foi confirmada no registro e aplicada por override compatível da mesma linha principal.
- Resultado após correção: 0 crítica, 0 alta, 0 moderada e 0 baixa.
- Política pnpm permite scripts de instalação somente para `esbuild`, `sharp`, `supabase` e `unrs-resolver`.
- CI preparada com permissões somente de leitura, instalação congelada, lint, typecheck, testes, auditoria de severidade alta/crítica e build.

### Supabase local

- PostgreSQL 17.6 validado.
- Quatro migrations aplicadas e sincronizadas localmente.
- Sete tabelas públicas, todas com RLS habilitada.
- Oito papéis e oito permissões estruturais.
- `supabase db lint --local`: nenhum erro de schema.
- `supabase test db`: harness pgTAP disponível; ainda não há arquivos de teste SQL (`NOTESTS`). Os testes atuais obrigatórios são executados pelo Vitest, e cada migration do CRM deverá incluir teste SQL.
- Security advisors: nenhum achado.
- Performance advisors: três warnings de múltiplas policies permissivas de `SELECT`, registrados em `docs/DATABASE.md`.
- Configuração atualizada de `inbucket` para `local_smtp`, redirects HTTP locais e senha mínima de oito caracteres.

### Validação da base final

| Comando                                                  | Resultado                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                         | aprovado                                                          |
| `pnpm lint`                                              | aprovado                                                          |
| `pnpm typecheck`                                         | aprovado                                                          |
| `pnpm test`                                              | aprovado: 1 arquivo, 4 testes                                     |
| `pnpm build`                                             | aprovado: Next.js 16.3.0, output standalone                       |
| `pnpm dedupe --check`                                    | aprovado após deduplicação controlada                             |
| `pnpm audit` e OSV-Scanner                               | aprovados: zero vulnerabilidade conhecida                         |
| smoke local `/`, `/login`, `/register`, `/app`, `/admin` | 307, 200, 200, 307, 307; áreas protegidas redirecionam sem sessão |
| smoke `node .next/standalone/server.js`                  | aprovado em `/`, `/login` e `/app`; artefato de produção inicia   |
| `actionlint .github/workflows/ci.yml`                    | aprovado                                                          |

Na primeira repetição dos gates com o stack local ativo, o ESLint varreu código minificado gerado pela CLI em `supabase/.temp`. O diretório já era gitignored; ele foi também excluído explicitamente do escopo do lint, junto dos demais artefatos de build, e a sequência foi reiniciada.

### Decisões técnicas

1. Sistema de login como base e CRM como fonte funcional.
2. Next.js nativo, sem Cloudflare/Vinext/Vite.
3. Supabase PostgreSQL/Auth/RLS no lugar de D1 e autenticação manual.
4. pnpm único e lockfile único.
5. Build standalone + PM2/Nginx para Hostinger; Docker apenas no desenvolvimento Supabase.
6. GitHub, CI e branch protegida antes da homologação.
7. Nenhuma publicação em produção sem autorização explícita.

### Checkpoint remoto e Gate 0

- Checkpoint local criado na branch `chore/environment-preparation`: `dcb4257` (toolchain/dependências) e `217da89` (CI).
- Todos os gates foram repetidos após documentação e formatação; Supabase reiniciou limpo e foi encerrado com backup local preservado.
- Autenticação `gh` validada em 2026-08-04. Repositório privado criado em `contatoleandrolucass2-a11y/descomplica-crm`, com `main` definida como branch padrão.
- Branch `chore/environment-preparation` e três tags de checkpoint enviadas. PR #1 aprovada pela CI e mesclada em `main` no commit `474e4b9`.
- GitHub Actions run `30875961593`: aprovado em 54 segundos. Instalação congelada, lint, typecheck, 4 testes, auditoria e build passaram.
- A segunda execução verde apontou runtime Node 20 depreciado nas actions v4. `actions/checkout` foi atualizado para v7.0.1 e `actions/setup-node` para v7.0.0, ambas fixadas por SHA completo para reduzir risco de alteração de tag.
- GitHub Actions run `30876134775`: aprovado em 50 segundos com actions v7 e sem a anotação de runtime depreciado.
- GitHub Actions run `30876287356` na `main`: aprovado em 56 segundos após o merge.
- Dependabot alerts e security updates habilitados; branches passam a ser apagadas automaticamente após merge.
- Após a atualização da `main`, Dependabot recalculou zero alerta aberto. A PR automática #2, baseada no lockfile antigo e conflitante com Next.js 16.3.0, foi fechada e sua branch removida.
- Proteção da `main` não foi habilitada: a API exige GitHub Pro para este repositório privado. O projeto permaneceu privado e nenhum plano/cobrança foi alterado. Pull request e CI continuam sendo o fluxo obrigatório documentado.
- Gate 0 encerrado. A migração funcional pode começar em nova etapa/branch a partir da `main` validada.

## 2026-08-04 — visibilidade pública do repositório

- Por solicitação explícita do proprietário, `contatoleandrolucass2-a11y/descomplica-crm` mudou de privado para público.
- Antes da exposição, Gitleaks verificou a árvore atual e 169 commits: zero segredo encontrado.
- GitHub confirmou `visibility: public`; código, histórico, tags, issues, pull requests e Actions passaram a ser acessíveis publicamente.
- Nenhuma configuração de produção, plano ou cobrança foi alterada.
- A proteção da `main`, antes indisponível no plano para repositório privado, tornou-se tecnicamente disponível; não foi alterada porque o pedido se limitou à visibilidade.

## 2026-08-04 — início do Gate 1

- Branch `feat/gate1-page-catalog` criada a partir da `main` pública e verde.
- CRM original inventariado: sete superfícies de página, cinco etapas dinâmicas, nove componentes reutilizáveis e oito endpoints.
- O login Supabase SSR permanece como autenticação única. As três APIs manuais de autenticação do CRM serão descartadas.
- Menu estático será substituído por catálogo PostgreSQL associado a permissões efetivas. Cloudflare, D1, Vinext, Vite, Wrangler e dados demo continuam proibidos.
- Inventário detalhado: `docs/CRM_INVENTORY.md`.

### Catálogo, autorização e painel administrativo

- Migration `20260804041218_page_catalog_and_crm_permissions.sql` criada com 9 novas permissões, catálogo de 14 páginas, grants explícitos, RLS e RPC auditada de visibilidade.
- Novas contas Auth recebem perfil e papel `user`; contas existentes são preenchidas de forma idempotente. Usuário inativo não obtém contexto nem permissões efetivas.
- Painel `/admin/usuarios` permite atribuição de papéis, exceções `allow`/`deny`, remoção de exceções e ativação/desativação dentro da hierarquia.
- Painel `/admin/paginas` controla visibilidade do catálogo. A navegação protegida consulta apenas páginas ativas autorizadas pela RLS.
- Todas as rotas CRM inventariadas existem sob `/app` e possuem guarda server-side específica; conteúdo funcional ainda será migrado por domínio.
- As três policies SELECT duplicadas preexistentes foram consolidadas. Advisors locais de segurança e performance passaram sem achados.
- Reset integral das cinco migrations aprovado. `supabase test db`: 26 testes aprovados; `supabase db lint`: sem erros.
- Build `standalone` gerou 21 páginas. Smoke sem sessão confirmou `/login` e `/register` com HTTP 200 e todas as rotas protegidas redirecionando para `/login`.
- O primeiro processo `standalone` foi iniciado sem as variáveis públicas do Supabase e respondeu 500; a repetição com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` locais passou. Nenhum segredo foi exibido ou persistido.
- Checkpoint funcional criado em `800ba10` e publicado na branch `feat/gate1-page-catalog`.
- PR draft #5 aberta contra `main`; GitHub Actions run `30877794127` aprovou o workflow `validate` em 39 segundos.

### Encerramento do Gate 1

- Autorização ampla recebida para promover e mesclar o trabalho validado.
- PR #5 mesclada na `main` em `33c134a`; GitHub Actions run `30877996373` passou após o merge.

## 2026-08-04 — Gate 2: dashboard somente leitura

- Branch `feat/gate2-dashboard-read-model` criada a partir da `main` atualizada.
- O contrato D1/JSON foi substituído por quatro tabelas normalizadas: snapshots, resumos por visão, métricas e empreendimentos.
- Grants explícitos concedem somente `SELECT` a `authenticated`; RLS exige `crm.dashboard.view`; `anon` e escrita direta permanecem bloqueados.
- `/app` passou a renderizar três visões e três períodos, progresso das cinco etapas, conversões, valor vendido por visão/período e destaques.
- Sem snapshot `global`, a interface exibe estado de espera. Dados demonstrativos e usuário hard-coded não foram migrados.
- Testes locais: 52 pgTAP e 7 Vitest aprovados; schema lint, advisors, ESLint, TypeScript e build também aprovados.
- Teste autenticado no navegador aprovado em 390×844 e 1440×900, sem overflow do corpo ou erros de console. Troca de visão e período atualizou métricas e URL corretamente.
- A fixture e a conta de QA foram criadas apenas no Supabase local e removidas por reset ao final.

### Encerramento do incremento do dashboard

- PR #6 mesclada na `main` no commit `66da130`; GitHub Actions run `30878565908` passou antes do merge e run `30878648010` passou na `main`.
- Branch `feat/gate2-funnel-goals` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: metas dos funis

- O contrato de `GoalsSettingsClient` e `/api/settings/goals` foi analisado no CRM original: dois perfis, seis etapas, cinco taxas e parâmetros operacionais de equipe.
- Migration `20260804044701_funnel_goals.sql` criada sem seed comercial. A tabela usa chave única por perfil/mês, colunas tipadas, constraints, grants mínimos e RLS.
- A RPC `upsert_crm_funnel_goals` exige sessão ativa e `crm.settings.manage`, normaliza o mês, calcula os volumes no servidor, força o escopo reduzido de parcerias, faz upsert e registra auditoria na mesma transação.
- `/app/configuracoes/metas` e `/app/configuracoes/metas/parcerias` substituíram os placeholders. Ambas usam sessão Supabase SSR; a antiga API pública e seus objetos JSON não foram copiados.
- `supabase db reset` aplicou as sete migrations do zero. Os 77 testes pgTAP passaram; Vitest passou com 3 arquivos e 11 testes.
- ESLint, TypeScript e build Next.js passaram. A primeira execução paralela de `typecheck` com `build` encontrou arquivos transitórios de `.next` removidos pelo build; a repetição sequencial passou, sem alteração de código necessária.
- QA autenticada criou metas DV e parcerias no Supabase local. O funil DV foi calculado como `90 → 45 → 30 → 15 → 12 → 10`; parcerias ocultou e zerou as etapas não aplicáveis.
- Usuário comum foi redirecionado para `/unauthorized`. Em 1280 px, largura do documento e `scrollWidth` permaneceram iguais, sem overflow horizontal.
- A conta administrativa, a conta comum e as metas de QA foram removidas por `supabase db reset` ao final.
- Gates finais: instalação congelada, formatação, ESLint, TypeScript, 11 testes Vitest, build de 21 páginas, 77 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: `pnpm audit` sem vulnerabilidades; Gitleaks sem achados na árvore ou em 174 commits; OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de metas

- PR #7 mesclada na `main` em `ca279fd`; GitHub Actions run `30879238469` aprovou a branch e run `30879283419` aprovou a `main`.
- Branch `feat/gate2-points-settings` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: configuração de pontos

- O contrato D1 foi extraído de `PointsSettingsClient`, `/api/settings/points` e `point_goals`: sete métricas, pesos e objetivos armazenados em JSON sem autorização.
- Migration `20260804045945_point_settings.sql` criou o singleton de configuração e sete linhas tipadas, sem seed. `crm.ranking.view` permite leitura; escrita direta permanece revogada.
- A RPC `replace_crm_point_settings` exige conta ativa e `crm.settings.manage`, rejeita payload incompleto/desconhecido/fracionário, substitui a configuração em uma transação e audita.
- `/app/configuracoes/metas/pontos` substituiu o placeholder por formulário server-rendered. Os pesos sugeridos originais aparecem apenas como proposta não persistida no estado vazio.
- Reset integral das oito migrations e 103 testes pgTAP passaram. ESLint, TypeScript, 14 testes Vitest e build de 21 páginas também passaram.
- QA autenticada salvou peso de venda `12` e objetivo de visitas `25`; a releitura confirmou ambos. Em 1280 px não houve overflow horizontal nem warning no servidor.
- Conta e configuração temporárias foram removidas por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 14 testes Vitest, build, 103 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 175 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de pontos

- PR #8 mesclada na `main` em `40982e7`; GitHub Actions run `30879627188` aprovou a branch e run `30879687370` aprovou a `main`.
- Branch `feat/gate2-ranking-read-model` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ranking

- O `RankingClient` original foi analisado: quatro períodos, corretores/gerentes, sete atividades ponderadas, bônus por conversão e critérios de desempate.
- Migration `20260804050720_ranking_read_model.sql` criou snapshots e atividades por corretor/período, sem seed, JSON ou pontuação final congelada.
- A aplicação combina as atividades com os pesos atuais, calcula bônus, ordena corretores e agrega gerentes antes da pontuação.
- `/app/ranking` substituiu o placeholder por Server Component com pódio, resumo, placar, quatro períodos, duas visões e estado vazio sem dados demo.
- Reset integral das nove migrations e 128 testes pgTAP passaram. ESLint, TypeScript, 18 testes Vitest e build de 21 páginas também passaram.
- QA autenticada confirmou três corretores, duas equipes, troca de mês para hoje, URL, placar e cálculo. Documento e `scrollWidth` ficaram em 1280 px, sem warning no servidor.
- Conta, pesos e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 18 testes Vitest, build, 128 testes pgTAP, schema lint e advisors aprovados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 176 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ranking

- PR #9 mesclada na `main` em `ced2e14`; GitHub Actions run `30880051063` aprovou a branch e run `30880105833` aprovou a `main` após o merge.
- Branch `feat/gate2-stage-details` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: detalhes das etapas

- `StageDetailClient` foi analisado e reduzido ao contrato persistido: cinco etapas, três visões, três períodos, metas, conversões e cinco janelas comparativas.
- As rotas reutilizam `crm_dashboard_metrics`; nenhuma tabela ou cópia JSON adicional foi criada.
- `/app/etapas/[stage]` substituiu o placeholder por Server Component com atingimento, gap, conversão, histórico, plano de ação e navegação sequencial.
- Slugs inválidos retornam 404; `crm.stages.view` protege a rota e a RLS do dashboard continua protegendo os dados.
- ESLint, TypeScript, 21 testes Vitest e build de 21 páginas passaram.
- QA autenticada confirmou `Visitas` com 45/60, conversão de 56,3%, filtros Canal Imob/semana e navegação até `Vendas`. Sem overflow ou warning no servidor.
- Conta e snapshot temporários foram removidos por `supabase db reset`.
- Gates finais repetidos: instalação congelada, formatação, lint, tipos, 21 testes Vitest, build e 128 testes pgTAP aprovados. O schema lint reportou apenas falsos positivos conhecidos da extensão pgTAP; advisors de segurança e performance não encontraram problemas.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 177 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de detalhes

- PR #10 mesclada na `main` em `c4c959a`; GitHub Actions run `30880417097` aprovou a branch e run `30880462632` aprovou a `main` após o merge.
- Branch `feat/gate2-secure-ingestion` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 2: ingestão e Salesforce

- Os três endpoints originais foram relidos. Cloudflare/D1, fallback n8n fixo, status público e refresh sem sessão não foram copiados.
- Migration `20260804052500_secure_salesforce_ingestion.sql` criou `crm_ingestion_runs`, quatro RPCs, grants explícitos, RLS, auditoria, idempotência, locks, cotas, cooldown e rejeição de snapshot antigo.
- `/api/ingest/salesforce` aceita somente contrato Zod v1 normalizado, Bearer M2M de no mínimo 32 caracteres e corpo de até 1 MB. A secret key Supabase está isolada em módulo server-only.
- `/api/refresh/salesforce` exige sessão, `crm.salesforce.refresh`, origem da aplicação e configuração explícita; usa timeout de 15 segundos e nunca devolve resposta ou segredo do provedor.
- `/api/dashboard/status` exige `crm.dashboard.view` e lê uma RPC que expõe somente timestamps e estados seguros.
- O dashboard mostra o botão de refresh somente para usuário autorizado e informa sucesso, concorrência, cooldown ou falha sem detalhes internos.
- Cópias não versionadas `arquivo 2.*` surgiram durante a validação: 16 eram idênticas e uma continha o placeholder antigo do ranking. Todas foram removidas após comparação, evitando compilação duplicada/obsoleta.
- Reset integral das dez migrations passou. `supabase test db` aprovou 161 testes; schema lint e advisors de segurança/performance não encontraram problema no schema da aplicação.
- QA local: status sem sessão `401`, ingestão com segredo inválido `401`, ingestão válida `201`, replay idempotente `200`, refresh autorizado `202` e repetição no cooldown `429`.
- A ingestão de QA atualizou atomicamente dashboard (3 visões/15 métricas) e ranking; o navegador exibiu os dados e não teve overflow em 1280 px. Runs e auditoria registraram somente metadados sanitizados.
- Foi usado apenas um webhook HTTP local descartável. Nenhuma credencial, URL, base ou chamada de produção foi utilizada.
- Gates finais repetidos em banco limpo: instalação congelada, formatação, ESLint, TypeScript, 28 testes Vitest, build de 23 páginas e 162 testes pgTAP aprovados. Schema lint, Actionlint e advisors de segurança/performance passaram sem achados.
- Segurança final: auditoria pnpm sem vulnerabilidades, Gitleaks sem achados na árvore e em 178 commits, OSV-Scanner sem achados em 514 pacotes.

### Encerramento do incremento de ingestão

- PR #11 mesclada na `main` em `9eba53b`; GitHub Actions run `30881418246` aprovou a branch e run `30881474209` aprovou a `main` após o merge.
- Branch `feat/gate3-interface-shell` criada a partir da `main` atualizada.

## 2026-08-04 — Gate 3: shell da interface

- O `SiteMenu` estático foi mantido fora da migração: `AuthorizedNavigation` recebe o catálogo já filtrado e marca a rota atual com `aria-current`.
- `ThemeSwitch` migrou os modos claro, equilibrado e escuro com catálogo fechado, persistência local não sensível e fallback claro quando storage/valor não é válido.
- Tokens globais cobrem superfícies, textos, bordas e campos; foco visível e `prefers-reduced-motion` foram adicionados sem dependência nova ou script inline.
- ESLint, TypeScript, 30 testes Vitest e build de 23 páginas passaram antes da QA.
- QA autenticada confirmou os três temas, persistência ao navegar para Ranking, item ativo e ausência de overflow em 1280 px.
- Conta e preferência de QA foram removidas do banco por reset integral; nenhum dado remoto foi alterado.
- Gates finais repetidos: instalação congelada, formatação, ESLint, TypeScript, 30 testes Vitest e build de 23 páginas aprovados. Auditoria pnpm, Gitleaks na árvore e em 179 commits e OSV-Scanner em 514 pacotes não encontraram problemas.

## 2026-08-04 — compatibilidade de grants do Supabase

- A mudança de defaults da Data API para projetos novos foi confrontada com
  todos os acessos `.from()` e `.rpc()` da aplicação, migrations e testes.
- Migration `20260804191713_normalize_new_project_grants.sql` normaliza ACLs
  atuais e futuras: navegador somente leitura/RPCs guardadas, ingestão somente
  pela RPC server-only e bootstrap exclusivamente por `postgres`.
- A correção não altera policies, RLS, dados, índices ou integração remota. Uma
  matriz pgTAP dedicada cobre tabelas, sequências, funções, `rls_auto_enable`,
  `ensure_rls` e o bootstrap administrativo.
- Reset integral das onze migrations e 177 testes pgTAP passaram. O cenário em
  que `rls_auto_enable`/`ensure_rls` já existem também foi reproduzido em
  transação local; a função perdeu execução pública e o trigger continuou ativo.
- Formatação, ESLint, TypeScript, 40 testes Vitest e build Next.js de 23 páginas
  passaram. Schema lint não encontrou erro; auditoria pnpm, Gitleaks da árvore e
  do histórico, OSV-Scanner e Actionlint não encontraram problema.
- Advisors mantiveram somente o `INFO` de segurança intencional da tabela de
  ingestão sem policy e os informativos preexistentes de performance, sem
  adicionar índices a este escopo.

## 2026-08-06 — candidata Salesforce/n8n de produção

- Os quatro workflows n8n relevantes e o exportador da VPS legada foram
  copiados para backups root-only com SHA-256 antes de qualquer criação.
- Uma alteração externa de estoque no workflow ativo foi identificada e
  preservada sem mistura com a migração do CRM novo.
- O `success` do coordenador foi classificado corretamente como aceite
  assíncrono, não sucesso fim a fim. O ramo externo de estoque passou a expirar
  antes do agendamento/webhook; o transformador ativo não recebe execução
  completa desde 16:04 UTC.
- A resposta bruta da Analytics Reports API confirmou `recordId` estável para
  Opportunity, avaliação de crédito, Contact e Account. O XLSX legado descartava
  essa informação; a candidata agora a usa somente em memória.
- O exportador candidato coleta os sete reports autorizados, remove PII antes da
  serialização, agrega dashboard/ranking e grava o arquivo de validação
  atomicamente com modo `0600`.
- A primeira coleta real produziu 3 views, 15 métricas e 108 participantes. O
  schema Zod aceitou o payload; buscas por IDs Salesforce, e-mail, números longos
  e chaves proibidas no payload final retornaram zero.
- A segunda coleta reproduziu exatamente os tamanhos das sete fontes e
  reconciliou por ID/nome: 63 visitas sem agendamento, 19 pastas e 18 vendas fora
  do recorte de oportunidades, 122 pastas aprovadas, 27 corretores ativos e
  cinco ainda sem gerente resolvido.
- O workflow `GnSUcxUhyPYq6d1l` foi criado inativo, sem credenciais nem chamadas
  externas. Nenhum snapshot, usuário, papel, grant ou policy do Supabase novo
  foi alterado.
- Metas seguem sem fonte M2M confirmada e roleta não existe nos sete relatórios;
  a ativação e a primeira persistência permanecem bloqueadas até decisão
  explícita sobre esses dois campos.

## 2026-08-08 — experiência de usuários e acessos

- Diagnóstico read-only identificou `/app/canal-de-parcerias` como a rota
  observada: nove respostas 404 e nenhum 403/500 no Nginx. O catálogo ativo
  publicava o link sem existir um `page.tsx`; a rota agora mostra somente um
  placeholder protegido por `crm.ranking.view`, sem consultar dados Qlik.
- A conta operacional já havia sido elevada de `user` para `admin` pela RPC
  auditada. `get_user_authorization_context` retornou nível 80 e o conjunto
  administrativo atual; a decisão não depende de claim de papel desatualizada.
- O texto “This page couldn’t load” veio do fallback global padrão do Next.js,
  enquanto o container também registrava tentativa de atualizar o HTML estático
  de `/unauthorized` em filesystem read-only.
- `forbidden()` e `app/forbidden.tsx` agora produzem 403 localizado. 404 e 500
  possuem superfícies próprias em português e códigos técnicos discretos.
- O painel de usuários passou a traduzir papéis/permissões, pesquisar usuários,
  separar herança de exceções, resumir mudanças e manter controles sensíveis em
  “Configurações avançadas”. Master não é atribuível e a própria conta não recebe
  controles de mutação.
- Migration `20260808174817_require_sensitive_access_change_reasons.sql` adiciona
  um trigger privado que reverte elevação, desativação e exceção sem motivo. Não
  altera grants, policies, RLS, assinaturas de RPC ou hierarquia.
- Validação final: ESLint, TypeScript, 57 Vitest + 8 Node, build e 280/280
  pgTAP passaram; lint local, advisors, auditoria de dependências, Gitleaks e
  OSV não encontraram erro novo. Oito checks Chromium confirmaram 403, 404 e
  500 reais, rota protegida, teclado, celular, zoom de 200% sem overflow, três
  temas e Master ausente das opções atribuíveis.

## 2026-08-09 — integrações e read model v3 local

- Gate 0 confirmou base `8ae8a42a7182e432657676e28b4ec29ef7eb354b`,
  worktree limpa, Node `24.19.0`, pnpm `11.20.0`, Supabase CLI `2.111.0` e
  dependências congeladas sem alteração de lockfile.
- Baseline antes da edição: lint/typecheck/build aprovados; 103 Vitest + 8 Node
  aprovados, 1 ignorado; 13 arquivos e 518 testes pgTAP aprovados.
- Investigação separada caracterizou o caller Qlik ativo como `anon` +
  verificador no argumento da RPC legada. Processo e owner nominal continuam
  não identificados; o hardening do PR #28 não pode ser aplicado antes do
  relay/cutover.
- Migrations locais `20260809181422` e `20260809181424` adicionam owners,
  mappings versionados, histórico, fila, lineage, autoridade privada por
  dataset/fonte/workflow/produtor, dimensões canônicas, runs, fatos,
  competências fechadas, ponteiro ativo e RPCs v3 com privilégio mínimo.
- IDs desconhecidos rejeitam o lote inteiro e entram em reconciliação; replay
  conflitante falha; snapshots antigos não substituem o ativo; nomes nunca são
  usados para autorização ou matching.
- Dashboard, cinco etapas, Ranking e Canal de Parcerias v3 usam um loader
  server-only nas rotas shadow `/app/read-model-v3/*`. A flag é desligada por
  padrão, essas rotas ficam fora do catálogo e as páginas de produção continuam
  byte a byte nos leitores v2. Filtros v3 funcionam por período, origem,
  organização, equipe, carteira, coordenador, gestor, corretor, empreendimento
  e localização.
- Quatro permissões v3 por dataset foram catalogadas sem herança automática por
  papel. Os testes criam grants sintéticos exclusivamente dentro da transação
  local para provar Master, Admin, gestor e corretor; permissões v2 globais
  continuam fechadas e o rollout real exige migration posterior.
- Revisão cruzada corrigiu cross-tenant com dimensões nulas, replay semântico,
  corrida de idempotência, lifecycle de mappings, reabertura da fila, precisão
  monetária, gate por dataset, qualidade visual e lineage do leitor Qlik.
- Validação do banco após reset de 20 migrations: 684/684 pgTAP aprovados em
  15 arquivos. O contrato v3 passou 143/143, a governança de identidades 20/20
  e o Qlik 54/54, incluindo ingestão/agregação real de 10.000 fatos dentro do
  timeout. Lint e typecheck passaram; 125 Vitest + 8 Node passaram, com um
  Vitest ignorado; o build gerou 37 páginas.
- Revisão independente adicional exigiu cobertura explícita por escopo/run,
  contenção temporal de todos os presets, limite de 100 caracteres nas chaves
  de provenance, timezone comum ao SQL/`Intl`, normalização consistente dos IDs
  e preservação da opção selecionada fora do cap. O manifesto imutável permite
  provar escopo vazio sem inferir completude a partir de um único fato.
- A revisão final também fechou lineage delegado após mudança temporal de
  topologia: cada aresta pai/filho revalida contenção no instante da consulta;
  membership expirado invalida imediatamente o grant descendente.
- Revisão independente encerrada em 0 P0 / 0 P1 depois das remediações.
- Prettier no diff, auditoria pnpm, Gitleaks da árvore e de 207 commits, OSV em
  518 pacotes, lint dos schemas `public/private`, sintaxe do configurador e
  `git diff --check` passaram. O check global de formato continua apontando
  somente 12 arquivos preexistentes fora do diff.
- QA autenticado exclusivamente local passou 72 checks responsivos, 54 de tema,
  18 rotas a 200%, teclado e reduced-motion. QA PostgREST/RLS provou 9 perfis,
  8 negações comerciais, 8 anônimas e bloqueio de dupla afiliação; todas as
  contas e fixtures efêmeras foram removidas. Os harnesses agora limpam também
  o lineage privado criado pelos novos grants.
- A migration Qlik destrutiva do PR base precede a ponte v3. A pilha atual não
  pode receber migration remota até ser separada em fase aditiva e hardening
  pós-relay; o bloqueio está documentado, não contornado.
- Nenhuma alteração foi feita em produção, Supabase remoto, n8n, Salesforce,
  Qlik, VPS, DNS ou Nginx. Não houve merge nem deploy.

## 2026-08-11 — fundação da homologação visual isolada

- Branch `codex/homologation-visual-release-gate` criada no SHA base exato
  `9f1ca6fca7c7ccd179568dc9f92cc19a0e7bce25`, sem reaproveitar banco, Auth,
  volume, rede, porta, cookie ou conta de produção.
- Compose dedicado limita o app a `127.0.0.1:3100`; o Supabase local usa o
  projeto `descomplica-homologation`, somente fixtures sintéticas e nove contas
  `@local.invalid`. Firewall exclusivo bloqueia externamente as portas do CLI.
- `HOMOLOGATION_MODE` adiciona banner visível, metadados e header `noindex`.
  Cadastro público fica ausente na UI, rota e Server Action. Produção preserva
  o comportamento anterior quando as flags não são definidas.
- Read model v3 fica habilitável somente no Compose isolado. Relay Qlik,
  Salesforce e os 14 motores comerciais continuam desligados; simuladores
  permanecem visuais e bloqueados, sem política ou valor comercial inventado.
- Harnesses RLS/Playwright/visual aceitam a URL remota somente quando o modo
  explícito aponta exatamente para `https://homolog.descomplicapro.com.br`.
  Basic Auth e nove credenciais QA ficam em arquivos root-only e nunca entram
  em argumentos, storage state, Git ou evidências.
- Gate local inicial: instalação congelada, lint, typecheck, 239 Vitest (um
  ignorado), 8 testes Node, build de 37 páginas e 863/863 pgTAP passaram.
  Prettier global, pnpm audit, Gitleaks da árvore/217 commits e OSV em 521
  pacotes também passaram.
- Inspeção somente leitura confirmou produção saudável, recursos suficientes e
  DNS de homologação ainda livre. Nenhum ambiente remoto, DNS ou Nginx havia
  sido alterado neste checkpoint; publicação e QA HTTPS seguem para o próximo
  gate da mesma branch.
- Primeiro ensaio isolado falhou fechado: o Auth havia desligado também o login
  por e-mail ao bloquear signup. As nove contas foram removidas automaticamente.
  O ajuste mantém o provider de login ativo sob `auth.enable_signup=false` e o
  segundo ensaio persistiu exatamente nove contas sintéticas. A fixture visual
  passou a reutilizar o Master isolado completando somente seu perfil QA; carga
  e reexecução idempotente foram verificadas.
- A matriz browser local confirmou login genérico, guards, nove perfis, oito
  superfícies Master, filtros server-rendered e simuladores bloqueados. O teste
  de filtros foi separado da travessia longa e valida os `href` selecionados na
  resposta HTTP autenticada, eliminando corrida de navegação do App Router sem
  reduzir a cobertura. Limites Auth sintéticos foram dimensionados para a
  própria matriz; o gate externo Basic continua obrigatório.
- Cliente DNS Hostinger fail-closed preparado: lê token somente de arquivo
  `0600`, recusa nome existente, valida o payload antes do `PUT` e confirma
  somente o novo `A` de homologação. A etapa permanece sem execução enquanto a
  autenticação privada não existir.
- Após provisionamento privado autorizado, o script criou exclusivamente
  `homolog.descomplicapro.com.br A 187.127.249.50`; DNS autoritativo e recursivo
  confirmaram o registro. Certbot emitiu certificado exclusivo válido até
  09/11/2026. `nginx -t`, reload seguro, Basic Auth, `401` pré-gate,
  `robots.txt`, `noindex`, cadastro `404` e HTTPS autenticado passaram.
- Produção respondeu `{"status":"ok"}` antes, durante e depois. O app isolado
  permaneceu em `127.0.0.1:3100`; banco/Auth/rede/cache têm nomes exclusivos e
  as portas Docker `55321`/`55322` continuam bloqueadas externamente pela chain
  dedicada. Backup Nginx root-only manteve checksum válido.
- QA HTTPS final aprovou 7/7 cenários E2E, nove perfis e a matriz de 21 rotas.
  A matriz visual aprovou 72/72 checks responsivos, 54/54 temas, 87/87 Axe,
  87/87 comparações de baseline e 18/18 rotas a 200%, além de teclado,
  reduced-motion, filtros, cookies e CSP. Maior diferença visual: `0,0885%`
  sob limite de `1%`.
- A primeira execução remota revelou dois races exclusivos do harness: dois
  `<main>` coexistiam durante streaming e o init script tocava o DOM antes de
  `documentElement`. Locators foram ancorados no heading terminal e os scripts
  aguardam DOM/hidratação; cobertura foi preservada e as reexecuções passaram.
- Evidências selecionadas e seus hashes foram versionados em
  `docs/qa/homologation/`. Relay, Salesforce e motores ficaram desligados;
  simuladores estão visualmente completos, mas cálculo e persistência seguem
  bloqueados. Supabase de produção, n8n, Qlik, Salesforce, dados, grants, flags
  e container de produção não foram alterados; não houve merge ou cutover.

## 2026-08-11 — fechamento funcional e preparação fail-closed

- Branch criada sobre o head exato do PR #33. A especificação completa e a
  pilha #26–#33 foram convertidas em matriz rastreável por página, componente,
  fonte, permissão, teste, evidência, estado e bloqueio.
- Breadcrumbs passam a usar somente o catálogo autorizado. As 21 rotas entram
  na matriz autenticada, incluindo Admin, Usuários e Páginas; reduced-motion,
  teclado, três temas, sete viewports, mobile dark, Axe e zoom de 80%, 100%,
  125%, 150% e 200% permanecem gates.
- Aprovação de onboarding exige Master, permissões server-side, papel
  aprovável, escopos oficiais explícitos, motivo e confirmação. Nenhum owner,
  vínculo ou escopo é presumido.
- Metas de funil e pontos foram movidos para draft privado, versionado e
  Master-only, com preview/hashes e sem apply. Ranking rejeita configuração
  legada como política oficial. Os cinco simuladores ganharam a estrutura da
  especificação e seguem sem motor, exportação, persistência ou resultado.
- Dashboard ganhou ritmo, comparativos operacionais, estrutura de corretores
  por gerente e rodapé; Canal ganhou quatro visões, período personalizado,
  resumo, pesquisa, dois rankings e gate de conciliação. Tudo que depende de
  fonte/semântica ausente permanece explicitamente indisponível.
- Simuladores ganharam abas acessíveis, repeaters locais, múltiplos proponentes,
  cenários, inventário/paginação neutros, limpar e impressão estrutural. Nenhum
  controle chama motor, persiste ou exporta cálculo comercial.
- A imagem mantém leitura compatível com o schema produtivo anterior: ausência
  exata das novas RPC/colunas/tabelas cai para legado em revisão e desabilita o
  fluxo novo; outros erros continuam fail-closed.
- O read model v3 valida dataset e escopo da resposta, exige as cinco etapas
  mensais exatas e diferencia stale, indisponibilidade e erro.
- Inspeção de produção foi somente leitura. Backup lógico criptografado,
  root-only e com checksums verificados foi restaurado em container descartável
  sem rede; as dez migrations futuras executaram e o rollback por restore limpo
  passou. Plaintext temporário e container foram removidos.
- O caller técnico Qlik permanece `r4DyPyOTDtoROXq0`; owner operacional,
  substituto, 40 leitores GET, manifesto real de mappings, credenciais privadas,
  políticas e casos de ouro continuam bloqueios externos. Nenhum conflito real
  foi inventado como “zero”.
- Três migrations com efeitos P0 foram marcadas para decomposição forward antes
  de qualquer execução remota. Não houve migration remota, importação real,
  alteração de n8n/Qlik/Salesforce, merge, cutover ou deploy de produção.
- A primeira captura ampliada encontrou contraste insuficiente em três estados
  ativos no tema escuro e um falso positivo que confundia limpar/imprimir com
  execução comercial. As cores foram corrigidas e o gate passou a exigir o
  botão de cálculo explicitamente desabilitado, mantendo controles locais
  estruturais disponíveis.
- A recaptura limpa aprovou 147 combinações responsivas, 84 checks de tema, 192
  auditorias Axe/comparações e 105 checks de zoom. A baseline foi promovida por
  rename transacional, sem persistir conta, senha ou storage state.
- O primeiro disparo do restore rehearsal fechou antes de criar containers ao
  detectar que seu sentinela ainda esperava 863 testes. O contrato foi alinhado
  ao inventário versionado atual: 27 migrations, 18 arquivos e 885 pgTAP.
- Duas execuções independentes do ensaio passaram. A evidência versionada prova
  57 tabelas, 62 relações, 88 funções, owners/ACL preservados, fingerprint
  canônico idêntico e todos os gates/credenciais/policies/mappings vazios.
- A suíte integral revelou duas asserções que ainda descreviam a baseline antiga:
  estado “preparado” e obrigatoriedade de igualdade com a imagem anterior. O
  teste agora exige a baseline promovida íntegra e mantém o diagnóstico anterior
  auditável, permitindo somente os motivos fechados produzidos pelo harness.
- Os primeiros E2E integrais pararam nos títulos legados “Dashboard do funil” e
  “Performance das parcerias”. A matriz foi alinhada aos H1 restaurados
  “Relatório completo da equipe” e “Ranking das Imob’s”; permissões, navegação e
  conteúdo permitido continuam sendo verificados sem relaxamento.
- A travessia Master avançou e encontrou o nome acessível legado do filtro do
  Canal. O seletor foi alinhado ao grupo ampliado “Visões e filtros do Canal de
  Parcerias”, preservando a exigência de visibilidade do controle seguro.
- O E2E chegou aos simuladores e repetiu o falso positivo já encontrado no gate
  visual: três controles locais estavam sendo contados como motor. A asserção
  agora prova ausência de submit/action e exige exatamente um botão comercial,
  identificado pelo motivo de bloqueio e desabilitado.
- O primeiro QA visual HTTPS aprovou E2E 7/7 e todos os gates funcionais/Axe,
  mas rejeitou 11 screenshots de Usuários: homologação possui nove contas QA e
  o baseline efêmero possui uma. A região dinâmica ganhou marcador explícito e
  é omitida somente do screenshot comparável, depois de passar funcional e Axe.
  Um erro de console isolado não foi reproduzido em duas travessias diagnósticas.
- A baseline local estabilizada foi recapturada em worktree limpa e aprovou
  novamente 147 responsivos, 84 temas, 192 Axe/comparações e 105 checks de zoom;
  conta e fixtures efêmeras foram removidas ao final.

## 2026-08-11 — correções do gate visual final

- Auditoria independente recebida no SHA `420af55093da7622cea194aab5b27f13d42c1eab`:
  zero P0, dois P1, quatro P2 e quatro P3. As 21 rotas estavam estruturalmente
  íntegras; responsividade, temas, teclado, zoom, reduced-motion e Axe já
  passavam.
- O shell passou a reservar e truncar toda a cadeia da identidade, além de
  empilhar a navegação a partir de `90rem`. O E2E injeta uma identidade longa em
  `1440×900` e prova ellipsis, ausência de sobreposição e zero overflow raiz.
- O workspace compartilhado dos cinco simuladores agora diferencia controles
  locais habilitados, motor bloqueado e estoque indisponível. O motor continua
  desabilitado, sem submit/action, com cadeado e explicação visível junto ao
  CTA; nenhuma regra comercial foi acrescentada.
- Canal, Ranking e Configurações receberam contraste e copy finais. O termo
  oficial é “imobiliárias”; “Metas de pontos” ficou uniforme; o funil de
  parcerias ganhou H1 contextual; política, ativação e permissões substituem
  jargões técnicos na visão comercial.
- Fontes sintéticas são apresentadas como “Dados sintéticos de homologação”.
  Identificadores de execução, plano e códigos de suporte permanecem fechados
  em `Detalhes técnicos`.
- O E2E local isolado ampliado passou com 8 cenários e um skip remoto, nove
  perfis, 21 rotas, RLS e remoção das nove contas efêmeras. Capturas atuais de
  login, logout, 403, 404, 500, loading, empty, stale e error foram geradas em
  `docs/qa/final-states/`; nenhuma credencial foi persistida.
- A baseline final foi promovida a partir de worktree limpa no SHA
  `a33ec1b0f2f1ff1222288d032d84db1a6a12c6d9`: 147 responsivos, 84 checks de
  tema, 192 Axe/comparações e 105 checks de zoom. Colisão do topbar e contratos
  dos três estados de CTA tiveram zero falhas; conta e fixtures foram removidas.
- Nenhum ambiente remoto, Supabase, n8n, Qlik, Salesforce, DNS ou Nginx foi
  alterado nesta correção. Flags comerciais, allowlists e motores continuam
  desligados.
- O gate visual independente read-only no HEAD `5271b2b` aprovou a entrega com
  P0/P1/P2/P3 iguais a zero. Foram conferidos 192/192 hashes e as superfícies de
  topbar, simuladores, Canal, Ranking, nomenclaturas, cópias e estados finais;
  homologação viva não foi acessada.
- O fechamento técnico aprovou formato, lint, tipos, 263 testes, build, E2E
  isolado, 885 pgTAP, RLS API, lint local do schema, auditorias pnpm/OSV/gitleaks,
  actionlint, shellcheck e validação dos manifests Compose. Nenhum segredo ou
  ambiente remoto foi alterado.

## 2026-08-13 — gate final da contenção P0 Qlik

- A RPC remota `publish_crm_imob_ranking(jsonb,text)` foi auditada sem expor
  corpo sensível: `SECURITY DEFINER`, owner `postgres`, verificador por digest,
  referências de tabela qualificadas, sem SQL dinâmico, sem logs do payload e
  sem retorno de linhas armazenadas.
- O gate encontrou dois excessos: `service_role` ainda executava a RPC e o
  `search_path` não fixava `pg_temp` por último. A migration emergencial agora
  revoga `PUBLIC`, `authenticated` e `service_role`, mantém temporariamente
  apenas `anon` e fixa `pg_catalog, extensions, pg_temp`.
- Verificador ausente e inválido falham fechados com SQLSTATE `42501`, antes de
  qualquer escrita. Testes específicos cresceram de 15 para 28 e passaram no
  restore exato; suíte completa aprovou 913 pgTAP em 19 arquivos.
- Ensaio em dois projetos PostgreSQL 17 independentes aprovou reset das 28
  migrations, backup/restore lógico, 913 pgTAP em origem e destino, lint,
  advisors, owners, ACL e fingerprint canônico idêntico. Formato, lint,
  typecheck, 263 testes e build também passaram.
- Nenhum dado, credencial, workflow, integração ou ambiente remoto foi alterado
  durante este ajuste pré-merge.

## 2026-08-13 — recontenção emergencial P0 Qlik

- O preflight do RBAC detectou duas migrations remotas não pertencentes ao
  fluxo aprovado, registradas às `14:27:23Z` e `14:28:35Z`. O gate do Canal foi
  suspenso antes de qualquer alteração.
- O estado regressivo tinha seis grants diretos de `SELECT` e três policies de
  leitura para `anon,authenticated`. Evidências e logs foram preservados sem
  linhas, identificadores pessoais, tokens ou segredos.
- O log PostgreSQL comprova aplicação via endpoint MCP por principal OAuth
  autenticado. A identidade foi redigida; nenhum CI, deploy da aplicação ou
  workflow Qlik aparece como autor dessas duas migrations.
- Backup contemporâneo root-only passou SHA-256 e restore isolado PostgreSQL
  17.6. As contagens 98/30.091/4.087 e as 20 versões remotas foram reproduzidas;
  o ensaio do roll-forward passou 28/28 pgTAP sem mudar dados.
- A migration exclusiva
  `20260813151446_emergency_qlik_public_read_recontainment.sql` foi aplicada
  isoladamente. Probes GET anônimos retornam 401; RLS/FORCE RLS estão ativos;
  policies de leitura e ACLs diretas estão zeradas. A RPC temporária continua
  somente para `anon`, como exceção já aprovada até identidade dedicada.
- A amostra limitada aos 100 eventos mais recentes registra 80 GETs HTTP 200
  entre `14:44:16Z` e `15:14:31Z`. A origem e o volume retornado não são
  confiáveis no log disponível; não há prova de exfiltração nem base para
  excluir acesso externo.
- Produção da aplicação permaneceu saudável e no SHA
  `b8483c5ddb335530ba8b84fa0f2e1a299c1036f7`. Nenhum workflow, dado,
  credencial, DNS, Nginx, Salesforce ou n8n foi alterado.

## 2026-08-13 — convergência RBAC do Canal de Parcerias

- Após o CI pós-merge da recontenção ficar 3/3 verde, o preflight confirmou
  Qlik fechado e o Canal ainda no estado divergente documentado.
- Aplicada somente a migration `partnerships_rbac_convergence`, registrada
  remotamente como `20260813160418`; nenhuma outra migration pendente entrou.
- Verificação agregada confirmou permissão/catalogo/vínculo Master 1/1/1,
  não-Master 0, overrides 0 e um Master ativo autorizado. Anônimo recebe
  redirecionamento ao login e `/api/health` permanece 200.
- As três tabelas Qlik continuaram com zero grant direto e zero policy de
  leitura. Integrações, motores, allowlists e flags não foram ativados.

# 2026-09-02 — paridade visual e funcional do Simulador Associativo

- Fonte comparada: `Descomplica-CRM-completo-20260901-210321.rar`, rota
  `app/simulacao/associativo-fluxo-linear`.
- A rota protegida agora usa a mesma hierarquia, textos, campos, resultado e
  regras WF13 lineares do arquivo; shell, permissão de visualização e execução
  Master-only do CRM foram preservados.
- Evidências aprovadas: lint, typecheck, 507 testes Vitest + 8 testes Node,
  build e matriz autenticada com 119 checks responsivos, 68 de tema, 160 de
  acessibilidade/comparação visual e 85 de zoom. A rota passou em 375×812,
  768×1024, 1024×768 e 1440×900, inclusive tema escuro e contraste AA.

# 2026-10-05 — correção integral da paridade com os canvases

- Causa confirmada: o gate anterior comparava a aplicação somente contra uma
  baseline gerada pela própria aplicação. Por isso, validou regressão interna,
  mas não comprovou correspondência com as imagens aprovadas pelo usuário.
- As 22 rotas protegidas foram recompostas a partir das 11 pranchas versionadas
  em `docs/qa/canvas-parity/reference/`, com uma única navbar global, densidade
  navy/cyan e estados sem dados fictícios.
- Autenticação, RBAC, guards, APIs, RLS, integrações, motores e banco não foram
  alterados. A tela CAIXA permanece acessível somente pelo guard existente e
  com cálculo bloqueado.
- O QA autenticado agora compara cada rota diretamente com a metade correta do
  canvas externo, além de manter sete larguras, três temas, zoom, teclado,
  reduced-motion, Axe, console e overflow.
- Resultado inicial: formato, lint e typecheck aprovados. A suíte funcional
  passou 1.951 testes e 4 skips; a única falha esperada exige a regeneração da
  evidência autenticada antiga (209 capturas) para a nova matriz (242
  capturas). Os resultados finais, CI, PR e publicação serão registrados após
  o gate visual real.
