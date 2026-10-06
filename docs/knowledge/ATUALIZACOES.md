# Aprendizados e atualizacoes

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-10-06: build incremental pode ocultar CSS integrado entre worktrees

- Status: pendente_validacao na CI; fonte: integracao de `a89a93c` na branch de
  acessos e artefatos compilados em `.next/static`.
- Depois do merge, o fonte continha o novo brilho continuo do Associativo, mas
  o chunk CSS incremental ainda continha a regra antiga com `animation-delay:
4.5s`. Mover o `.next` gerado e reconstruir do zero produziu o chunk correto;
  o contrato de pixels focado e as dez larguras da navegacao passaram.
- Capturas locais extensas nao devem ser avaliadas sob contencao extrema. Um
  ensaio paralelo elevou a carga acima de 200 e causou timeout de teclado sem
  mudanca no produto. Nessa situacao, preservar os gates, registrar a uniao de
  promocoes limpas disjuntas e exigir o candidato integral da CI isolada.
- O manifesto combinado identifica `e0e0ce9` para o Associativo e `f1df3d6`
  para Usuarios. Seus hashes e 27 contratos de referencia passaram; a CI final
  ainda deve comprovar todas as 242 comparacoes antes do merge.

## 2026-10-06: baseline de tela longa deve preservar legibilidade interna

- Status: validado; fonte: candidato visual da CI `37507333920` e
  `scripts/qa/authenticated-visual.mjs`.
- Uma mudanca intencional de altura nao torna toda diferenca aceitavel. Revisar
  as capturas completas revelou que a grade somente leitura usava a primeira
  coluna para o texto e deixava largura insuficiente ao selo na segunda.
- A correcao explicita o modo editavel na linha: consulta usa texto + selo no
  desktop e empilha o selo no celular. O limite global de densidade permanece
  1.125 px; apenas `/admin/usuarios` admite 2.500 px para a matriz de 23
  permissoes, medida em 2.486 px no candidato anterior.
- A captura limpa no commit `f1df3d6` aprovou 154 cenarios responsivos, 88 de
  tema, 242 auditorias Axe/comparacoes e 110 checks de zoom. O promotor mudou
  somente as onze referencias de `/admin/usuarios` e preservou as outras 231.
  Axe, overflow, temas, teclado e zoom permaneceram obrigatorios.

## 2026-10-06: gates de release também são consumidores da matriz de papéis

- Status: validado localmente; fonte: CI `37501848220`,
  `scripts/qa/local-rls-api.mjs`, `e2e/release-candidate.spec.ts` e ensaio de
  restore.
- Alterar RBAC exige atualizar fixtures, escopos, conjuntos de rotas, menus e
  contagens do QA de release. Manter papéis aposentados no harness pode bloquear
  a CI corretamente, mesmo quando migrations e testes unitários passam.
- A contagem consolidada do pgTAP é um contrato fail-closed do restore. Ela
  deve acompanhar novos planos deliberados; o valor atual é 1.099 em 27
  arquivos, sem alterar evidências históricas já versionadas.
- Com `output: standalone`, gates locais devem iniciar `.next/standalone/server.js`
  e preparar `public` e `.next/static`, reproduzindo a imagem Docker. Isso evita
  depender do comportamento de compatibilidade de `next start`.
- Evidência: 19 Playwright aprovados e um skip previsto, oito perfis em 23 rotas,
  nove identidades sintéticas removidas, zero papel legado aprovado, oito
  acessos anônimos negados e zero linha exposta. CI final e publicação seguem
  pendentes.

## 2026-10-06: autorização de escopo precisa ser repetida depois do lock

- Status: validado localmente; fonte: revisão de segurança da RPC
  `set_user_permission_overrides_bulk` e branch
  `codex/roles-permissions-bulk-layout`.
- Um precheck antes de `FOR UPDATE` evita oráculos de metadados, mas não prova
  que o alvo continua gerenciável quando a transação retoma. Repetir a mesma
  decisão depois do lock fecha a janela antes de qualquer leitura sensível,
  override ou auditoria.
- Triggers de linha são defesa adicional, não substituem o guard da RPC:
  operações sem linha afetada, como `inherit` sem override, ainda podem chegar
  ao retorno e à auditoria se a autorização não for revalidada no boundary.
- Evidência focada: três Vitest e 57 pgTAP aprovados; prova local com duas
  sessões retornou SQLSTATE `42501` após mudança concorrente de escopo e deixou
  zero override e zero auditoria. O schema legado continua no ramo sem helper.
  Fechamento: formato, lint, tipos, inventário, segredos, build, 1.980 Vitest,
  oito testes Node e 1.099 pgTAP aprovados; lint e advisors do banco sem achados.
- A CI pode passar localmente e receber advisories novos antes da publicação.
  O audit do PR bloqueou `source-map-js` 1.2.1 e `sharp` 0.35.4; a consulta
  local seguinte também encontrou o SDK MCP 1.30.1. Atualizar somente para as
  versões corrigidas mínimas e repetir todos os gates, sem criar ignores.
  `pnpm audit --audit-level high` passou sem vulnerabilidades conhecidas nas
  versões 1.2.2, 0.35.5 e 1.31.0; suites obrigatórias foram repetidas.

## 2026-10-05: papéis por canal exigem permissão também no read model

- Status: validado localmente; fonte: matriz aprovada de papéis e branch
  `codex/roles-permissions-bulk-layout`.
- Ocultar uma guia de dashboard não separa os dados. Geral, Com Canal Imob e
  Sem Canal Imob precisam de chaves próprias, consulta server-side limitada e
  policy RLS por `view_key` nas tabelas de resumo, métricas e destaques.
- Papéis genéricos não provam o canal. Ao substituir Gerente/Corretor por House
  e Imob, manter chaves antigas sem grants e exigir reclassificação explícita é
  mais seguro que conceder ranking ou parcerias por inferência.
- Exceções múltiplas devem chegar ao banco em uma RPC atômica. Validar todas as
  permissões e a hierarquia antes da primeira escrita evita salvar apenas parte
  da seleção e mantém uma trilha de auditoria coerente.
- Produção pode estar atrás da árvore local de migrations. Uma convergência
  nova precisa ser ensaiada tanto no reset completo quanto sobre o schema
  remoto restaurado; `db push --include-all` e `migration repair` não resolvem
  essa diferença.
- Evidências: 1.980 testes Vitest, oito Node, 1.099 pgTAP, lint, tipos, build e
  jornada autenticada sem violações Axe. Autorização da migration,
  reclassificação das três contas legadas e publicação continuam pendentes.

## 2026-10-06: revalidar advisories antes da publicacao

- Status: pendente_validacao integral; fonte: CI `37506185905` e advisories
  oficiais registrados no audit de anuais e ajudas do Associativo.
- Um lockfile validado no dia anterior pode receber alertas novos. Corrigidos
  Sharp 0.35.5, source-map-js 1.2.2 e SDK MCP transitivo do Next 1.31.0;
  auditoria voltou a zero, sem ignorar alertas nem reduzir gates.
- Protocolo dos MCPs e docs locais aprovados; 34 testes focados aprovados.
  Repetir CI Linux, imagem e QA integrado antes da publicacao.
- CI `37507557118` aprovou Linux, banco, restore, autorizacao e contratos
  funcionais. 11 capturas do Associativo revistas na combinacao atual e
  promovidas, mantendo 231 por hash. CI final e publicacao ainda obrigatorias.

## 2026-10-05: saldo nominal e base financeira do Associativo

- Status: pendente_validacao; fonte: audit de anuais e ajudas de 05/10/2026,
  codigo archive e pedido do usuario na branch `codex/associativo-saldo-anuais`.
- `balanceBeforeCorrection` e Pro-Soluto, nao saldo exclusivo das mensais.
  Ledger nominal usa valores digitados em centavos; motor archive subtrai
  anuais corrigidas antes de calcular mensais. Nao substituir uma base pela
  outra nem descontar anuais duas vezes para corrigir um rotulo de interface.
- Archive e WF13 oficial possuem contratos diferentes; preservar ambos e os
  oraculos existentes. Esta correcao expositiva nao autoriza mudar politica.
- 33 testes iniciais e 364 testes da auditoria financeira aprovados; gates
  globais, QA visual e publicacao ainda pendentes.
- Validacao local concluida: lint/tipos/build, 81 regressoes finais, 13 testes
  de brilho, nove etapas React e oito Node aprovados. Windows exige CI Linux
  para seis testes POSIX; timeout de conhecimento passou isolado (22/22).
- Keyframes alinhados ainda podem ter pausa invisivel. Medir pixels entre
  cards detectou quase quatro segundos na versao antiga e 0 ms na correcao.
- Ao medir um efeito isolado, pausar e restaurar as animacoes vizinhas evita
  falsos pixels positivos. Prova React em 1440px e 375px passou, sem relaxar
  tolerancia. Matriz definida: 7285 casos, 250197 comparacoes, zero divergencias.
- CI detectou ruido subpixel nos cantos. Manter a camada sozinho nao bastou:
  CSS compilado e Geist reproduziram pixels fora do pseudo-elemento. A mascara
  deve respeitar border-box, insets e raio reais; fixture inclui essas bases,
  posicoes fracionarias e prova negativa da pausa antiga, sem relaxar tolerancia.
- Integra `dcb88c9` preservando canvas e temas mobile aprovados; o Associativo
  fica somente com o titulo no cabecalho. Revalidacao combinada obrigatoria.
- Integracao local aprovada (lint/tipos/build, 83 testes focados, roteiro mobile,
  oito Node); seis testes POSIX dependem da CI Linux. Timeout DevTools passou
  isolado (24/24). CI `37364639266` nao obteve runner hospedado durante incidente
  GitHub Actions `3q1yb5m7ltvb`, em 05/10/2026. PR #156 sem deploy; gates mantidos.
- Na retomada, CI Linux passou em validate, banco, restauracao e autorizacao.
  Geometria do cabecalho ainda exigia o selo que o usuario retirou; contrato
  atualizado exige ausencia dos tres rotulos e do aside vazio, sem reduzir
  verificacoes de titulo, estoque ou navegacao. Publicacao ainda pendente.
- Em 06/10, CI `37383133528` tentativa 2 aprovou todos os contratos funcionais.
  11 capturas do Associativo revisadas por retirada do cabecalho; 231 referencias
  preservadas. Promocao canonica com hashes e tolerancias originais. Repeticao
  financeira: 7285 casos, 250197 comparacoes, zero erros; publicacao pendente.
- Integracao posterior de `a22f4dc`: preserva temas e sua baseline integral.
  Capturas anteriores do Associativo sao historico, nao prova da combinacao;
  nova CI e revisao visual obrigatorias antes da publicacao.

## 2026-10-05: temas precisam compartilhar tokens, nao paletas locais completas

- Status: validado; fonte: auditoria das capturas autenticadas e branch
  `codex/theme-color-calibration`.
- Claro e Medio podem existir formalmente e ainda parecer o mesmo tema quando a
  diferenca de luminosidade e pequena. Usar fundos `#f3f6fa` e `#d9e1eb`
  produz separacao perceptivel mantendo a mesma hierarquia azul.
- Um canvas que redefine todos os tokens semanticos interrompe a preferencia
  global. Ranking, Canal e Configuracoes devem herdar a paleta da raiz; variaveis
  locais ficam reservadas a identidades deliberadas, como o dourado do
  Associativo, e precisam de contrato proprio.
- Contraste calculado apenas sobre o token de texto nao basta quando o mesmo
  azul tambem e fundo de CTA ou filtro. Axe em navegador encontrou essa
  composicao e exigiu um azul de preenchimento mais claro, sem voltar ao verde.
- Evidencias: `tests/theme-color-calibration.test.ts`, matriz autenticada em
  `docs/qa/reference-parity/authenticated-results.json` e auditoria
  `docs/audits/theme-color-calibration-2026-10-05.md`.

## 2026-10-04: Recurso MKT em Configuracoes

- Status: validado; fonte: print do usuario, PR #152 e auditoria de publicacao.
- Rota `/app/configuracoes/recurso-mkt` reutiliza o canvas e os tokens da Tabela
  Associativo, com um unico shell protegido. Navegacao suplementar exige pai
  Configuracoes autorizado, permissao de gestao e gate de release habilitado.
- Fundo e custo ajustaveis somente no estado local, com rateio 40/30/20/10 e
  expectativa de vendas inteiras arredondada para baixo. Sem gravacao de
  politica, recurso ou configuracao ativa; sem migration ou workflow n8n.
- Evidencias: 62 testes focados e lint/tipos/build locais aprovados; 12 capturas
  do componente real em preview isolado, com Axe, controles e teclado aprovados.
  Testes: `tests/marketing-resources.test.tsx`, navegacao e Proxy; jornada
  autenticada: `scripts/qa/marketing-resources.mjs`. CI Linux e publicacao no
  PR #152 pendentes; o preview nao substitui a prova de autenticacao.
- CI `37255127701` aprovou validate e restore; E2E exigiu atualizar a lista
  esperada de links. Nova rota agora participa da matriz de autorizacao dos
  nove perfis, com acesso administrativo existente e negacao dos demais.
- CI `37255825356` aprovou os nove perfis; seletores semanticos identificaram
  que links envolvendo `article` nao recebiam nome acessivel do conteudo.
  Usar rotulo explicito do titulo. Correcao coberta por renderizacao do card.
- CI `37257361148`: falha residual curta exige prova adicional no helper,
  sem alterar produto ou reduzir gates. Aguardar URL do router e registrar
  somente etapas e classes estaticas de erro, nunca a mensagem bruta do browser.
- A lista de links autorizados tambem aparece em `archive-navigation.mjs`.
  Ao adicionar uma guia, atualizar esse contrato junto da matriz E2E; manter
  contagem exata e provas de alcance de cada link, sem relaxar os limites.
- CI `37258678938` comprovou os 12 cenarios autenticados MKT, teclado e
  controles. Contrato antigo do menu impediu o restante; corrigido na branch.
  Integracao de `e1ab14a` preserva as referencias e resultados do PR #150;
  validacao combinada e publicacao continuam pendentes.
- CI `37260367645`, captura limpa `c81abd2` com arvore identica a `1b68614`:
  validate, restore, nove perfis E2E e todos os criterios funcionais aprovados.
  154 responsivos, 88 temas, 209 Axe, 110 zooms, 40 menus e 12 cenarios MKT.
  Somente oito diferencas esperadas da visao geral de Configuracoes; revisadas
  em 05/10 e promovidas transacionalmente apos conferencia de arvore e hashes.
  Preservadas outras 201 imagens e a proveniencia anterior, sem reduzir gates.
  Pendencias: CI integral depois da promocao e verificacao pos-publicacao.
- CI `37263297496` integral aprovada em `393457d`. Resultado anterior nao
  substitui a validacao depois da integracao de `afdb1c9` (PR #154), que alterou
  composicoes e referencias. Preservar a baseline da main, validar a combinacao
  e revisar somente as oito referencias afetadas pelo link solicitado.
- CI `37309490617`: validate, restore, nove perfis e todos os criterios
  funcionais passaram na base combinada. Captura limpa `7818dcf`, arvore identica
  a `af85930`; 12 cenarios MKT sem overflow ou violacoes Axe. Nova revisao das
  oito diferencas de Configuracoes promovida transacionalmente, com hashes e
  predicado original conferidos. Preservadas as outras 201 referencias da main
  e os contratos de canvas. Pendencias: CI final e publicacao.
- Fechamento em 05/10: CI do PR `37314518298` e da main `37322433490`
  integralmente aprovadas. Runtime `edbfcd13` publicado as 11:47 BRT por imagem
  imutavel comprovada, backup privado, CAS e rollback. Cinco healthchecks 200
  no SHA exato; container healthy sem reinicios/OOM/padroes criticos. Rota sem
  sessao retorna 307 para login; jornada MKT comprovada pela CI sintetica.
  Fonte: `docs/audits/recurso-mkt-2026-10-05.md`. Sem migration, n8n, politica
  ativa ou dados remotos alterados. Este fechamento documental nao reinicia o app.

## 2026-10-05: baseline autorreferente nao comprova paridade com canvas

- Status: validado localmente; fonte: auditoria visual do usuario, branch
  `codex/canvas-layout-parity-hotfix` e 11 canvases em
  `docs/qa/canvas-parity/reference`.
- Uma captura gerada pela propria aplicacao detecta regressao em relacao ao
  ultimo build, mas nao prova aderencia a uma referencia externa. O contrato
  precisa mapear rota para canvas e verificar tambem a densidade estrutural.
- Limite uniforme de altura e incorreto quando as referencias tem composicoes
  distintas. O limite deve ser explicito por rota, sem usar `overflow: hidden`
  e sem reduzir alvos de toque para fazer a tela caber.
- Componentes analiticos extensos podem continuar implementados sem fazer parte
  da composicao publicada. Sua reintroducao exige novo canvas e novo gate.
- Dados, RBAC e layout sao contratos separados: aproximar a tela nao autoriza
  copiar valores do mockup, remover guards nem liberar motores bloqueados.
- Evidencia: `docs/audits/canvas-layout-correction-2026-10-05.md`.
- Validacao local combinada concluida em `2026-10-05T18:32:51Z`, no source SHA
  `8a15aa4` sobre a base `de57b6a`: 154 cenarios
  responsivos, 88 de tema, 242 auditorias Axe, 242 comparacoes de regressao,
  22/22 comparacoes com os canvases, 110 verificacoes de zoom e 40 navegacoes,
  sem falhas. CAIXA continua fail-closed e o Tabelao oculta os controles no
  modo de impressao. Conta e fixtures efemeras foram removidas; nenhum remoto
  mudou nesta validacao.
- Recurso MKT permanece uma 23a pagina protegida com contrato proprio; passou
  12 combinacoes de viewport/tema, teclado e Axe. Sua chegada altera somente as
  referencias de Configuracoes que exibem o card, nao o conjunto dos 22 canvases.
- O E2E de release aprovou 20 cenarios com um skip remoto previsto e removeu
  dez identidades sinteticas. Expectativas antigas devem acompanhar a
  composicao aprovada: o Associativo nao possui guia no cabecalho e o desktop
  conta somente os tres botoes dentro de `data-theme-options-desktop`, sem
  confundir o ciclo de tema mobile oculto.

## 2026-10-04: cadencia visual e nome cadastrado

- Status: validado e publicado em 05/10/2026; fonte: PR #150, runtime
  `e1ab14a8739153c56081e4f36a76e99f80fed8b2`, pedido de doze ajustes e branch
  `codex/associativo-animacao-sequencial`, base `a4a9ef5`.
- Animacoes CSS montadas em momentos distintos nao compartilham necessariamente
  a fase. Alinhar somente novas animacoes a um relogio, sem timer de renderizacao,
  preserva sincronia; grupos sequenciais iniciam juntos em sua propria montagem.
- Movimento reduzido desliga decoracoes, nao a indicacao de foco. Botoes
  desabilitados nao devem continuar chamando a acao por brilho automatico.
- Pseudo-elementos exigem getAnimations com subtree e filtro por effect.target;
  hover nao pode substituir o loop continuo, pois isso reinicia seu relogio.
- O primeiro nome vem de `user_metadata.name`, preenchido no cadastro; email
  permanece identidade da sessao, nao e usado para inventar o nome. Sem nome
  valido, usar Conta. Essa apresentacao nao altera autorizacao.
- A CI `37245218837` detectou recorte do menu em 320px: nomes longos ampliam
  o cabecalho. O limite dos paineis absolutos deve usar a altura real do pai
  (`100%`), nao os 58px do caso compacto. Regressao inclui o ultimo item visivel.
- CI `37247029738`: contratos funcionais, acessibilidade e zoom passaram;
  somente comparacoes com a referencia anterior divergiram. Revisao visual
  ajustou a largura do nome no desktop; 44 testes focados aprovados.
- CI seguinte `37249431505` repetiu timeout de navegacao entre simuladores.
  A limpeza do contexto ocultava a operacao original; diagnostico preserva
  esse erro e limita acoes, sem ampliar timeout ou enfraquecer gates.
- CI `37251923554` identificou Configuracoes interceptando Claro. O menu e os
  temas precisam de tracks intrinsecos; nomes flexiveis ocupam somente o restante.
  Fixtures sem filhos nao reproduzem a largura dos chevrons de grupos reais.
  Incluir grupos completos e testar hit-testing com fontes distintas.
- CI `37253579651` confirmou a correcao: E2E, validacao Linux e todos os
  contratos funcionais passaram. As 173 diferencas visuais foram revisadas e
  promovidas; 36 capturas ja aprovadas conservaram seus bytes de referencia.
- Evidencias e pendencias: `docs/audits/associativo-sequencias-2026-10-04.md`.
  Preview 6/6, 47 testes de efeitos, 76 do cabecalho e 126 cenarios geometricos;
  CI do PR `37257462975` e do main `37259237555` integralmente aprovadas,
  incluindo modo verify. Nenhuma formula financeira alterada.
- Publicacao imutavel com hashes/OCI, dois perfis, backup, CAS e rollback.
  Health, guards anonimos e jornada autenticada aprovados. Registro final
  documental nao exige novo restart da aplicacao.
- A sessao real usada no postcheck nao forneceu nome valido, apesar de as
  fixtures exercitarem nomes completos. Nao inventar nome pelo email nem alterar
  contas pela autorizacao de deploy. Solicitados dado e autorizacao especifica.

## 2026-10-04: origem incompleta, recuperacao e prova numerica do Associativo

- Status: validado e publicado; fonte: PR #147, runtime
  `f4dec82249c2b3e56beaaea518ec194ced81b480` e audit
  `docs/audits/associativo-origem-brilho-2026-10-04.md`.
- Consulta observacional encontrou 84 unidades visiveis sem andamento e 594
  sem avaliacao positiva no snapshot. Ausencia real nao e defeito aritmetico e
  nao autoriza inferir zero ou copiar dado de outra unidade.
- Complemento tardio exige identidade unica e entrega igual, preenche somente
  fatos nulos e preserva a proposta iniciada. API alternativa e mais antiga;
  54 avaliacoes tem correspondencia compativel, quatro andamentos foram recusados
  por divergencia de entrega. Unidades apontadas continuam exigindo fonte oficial.
- Entrada manual de fatos oficiais fica isolada por unidade. Comprometimento
  funciona sem andamento; maximo e aprovacao ficam pendentes sem esse dado.
- Os dois motores rejeitam datas que JavaScript normalizaria para outro mes.
  Matriz numerica usa oraculos independentes e publica somente agregados.
- Capturas de elementos maiores que a viewport podem remover a emulacao de
  toque no Chromium. Preview captura a viewport e verifica o ponteiro novamente,
  sem alterar regras da aplicacao para fazer testes passarem.
- Evidencias locais: 14.014 casos numericos sem divergencias, seis jornadas
  visuais e seis jornadas de continuidade aprovadas, build/lint/tipos/audit
  aprovados. Windows conserva seis falhas POSIX; timeouts passaram isoladamente.
- CI Linux `37220843131` (PR) e `37222464725` (main) integralmente aprovadas:
  banco, restore, E2E, imagem e QA visual, sem promover baseline. Publicacao
  imutavel com backup/CAS; health, negacao anonima e jornada autenticada aprovados.
- Queda do transporte SSH apos mensagem de sucesso nao prova rollback nem
  autoriza repetir deploy: conferir versao, ID da imagem e health separadamente.
  Neste caso, as tres verificacoes confirmaram a promocao concluida.
- Pendencia: obter fonte oficial atual das duas unidades apontadas. O postcheck
  usou a API alternativa, mais antiga, e nao atesta completude do snapshot.
- Nenhuma migration, politica comercial, fonte externa ou workflow foi alterado.

## 2026-10-04: canvases aprovados cobrem 22 rotas protegidas

- Status: validado e publicado; fonte: PR #148, runtime
  `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`,
  `docs/qa/canvas-parity` e
  `docs/audits/canvas-layout-parity-2026-10-04.md`.
- Uma unica navbar global serve Dashboard, cinco etapas, Ranking, Canal,
  Configuracoes/metas, Simulacao e Administracao. Subrotas nao devem recriar
  navegacao de aplicacao dentro do conteudo.
- Canvases sao autoridade apenas de composicao. A tela mostra dados de fonte
  validada ou indisponibilidade explicita; nomes, numeros e estados ilustrados
  nao podem virar dados reais, formulas nem politica comercial.
- CAIXA e uma rota protegida somente visual. O acesso exige permissao, enquanto
  motor, endpoint, submissao, analise e aprovacao bancaria permanecem
  fail-closed; o QA recusa habilitar `simulator.caixa` mesmo por flag.
- A captura limpa do SHA `a4c1717a1ac159804a1cda7b02ec3a3f48379b4a`
  aprovou 154 checks responsivos, 88 de tema, 209 de acessibilidade/comparacao,
  110 de zoom e 40 combinacoes da navegacao. Baseline transacional com 209
  imagens promovida; nenhuma conta ou fixture QA permaneceu no banco local.
- O roteiro de continuidade aguarda campos habilitados e valores persistidos e
  interpreta vazio como ausencia, sem mudar valores do cenario, formulas ou
  regras financeiras.
- O smoke de release deve tratar pagina e motor CAIXA como gates distintos. A
  matriz local aprovou Master 22, Admin 14, tres papeis analiticos com sete e os
  quatro papeis sem acesso comercial com zero; 20 cenarios E2E passaram, um foi
  ignorado conforme o contrato e dez contas sinteticas foram removidas.
- CI Linux do PR `37241474990` e do `main` `37243547805` aprovadas. Imagem da
  CI foi verificada por checksum, manifesto, configuracao, revisao, 11 camadas
  e dois perfis antes do CAS. Health, protecao anonima, headers e smoke HTTP
  passaram; rollback preserva a imagem anterior sem tocar no banco.
- Nenhuma migration, alteracao de dados, Nginx, DNS, integracao ou motor foi
  ativada. A conferencia autenticada produtiva permanece com o usuario; os
  gates de CI usaram identidades sinteticas isoladas e removidas.

## 2026-10-04: separar ausencia de dados de resultado zero no Associativo

- Status: validado e publicado; fonte: codigo do forecast, handlers de selecao e
  testes sinteticos da branch `codex/associativo-calculo-e-continuidade`.
- Comprometimento precisa de renda e cronograma valido; maximo mensal tambem
  precisa da evolucao de obra. Ausencia deve permanecer `null`, com pendencia
  explicita e aprovacao bloqueada, sem assumir andamento zero.
- Trocar unidade atualiza apenas informacoes do imovel; respostas e recursos
  permanecem. Revalidacao automatica nao significa reconfirmar ou apagar respostas.
- Avaliacao so vem da origem ou referencia inequivoca da mesma unidade. Preco
  de venda nao e substituto de avaliacao bancaria. Resposta tardia nao pode
  sobrescrever uma proposta que o usuario ja iniciou.
- Testes focados, build e cinco cenarios de continuidade no navegador aprovados.
  Windows teve falhas POSIX e timeouts em ferramentas; CI Linux 37203612944
  aprovou integralmente o PR #145. Consultar o audit de 04/10/2026.
- CI 37202986207 aprovou Linux, banco e restore; E2E ainda exigia apagar ranking
  apos editar renda. Atualizado para continuidade com prova proporcional dos dois
  comprometimentos, mantendo a barreira de isolamento entre usuarios.
- Main 106d626 aprovado na CI 37205634578 e publicado com imagem imutavel,
  backup privado e CAS. Health, negacao anonima e conferencia autenticada sem
  salvar dados aprovados. Ausencia genuina de informacao ainda bloqueia aprovacao.
- Matriz: 147 responsivos, 84 temas, 201 Axe/capturas, 105 zooms e 40 jornadas
  arquivadas; baseline intacta. Sem migration, mutacao de dados remotos ou n8n.

## 2026-10-04: shell unico validado em toda a matriz autenticada

- Status: validado localmente, pendente CI/publicacao; fonte: branch
  `codex/unified-protected-navigation`, resultado autenticado versionado e audit
  `docs/audits/unified-protected-navigation-2026-10-03.md`.
- Navegacao comercial vem do catalogo autorizado no servidor; quatro paginas
  liberadas fora das 17 do banco exigem pai, permissao efetiva e gate convergentes.
  CAIXA permanece sem caminho no item bloqueado e com guard direto fail-closed.
- A matriz limpa aprovou 147 responsivos, 84 temas, 201 Axe/comparacoes e 105
  zooms, alem de 40 combinacoes das jornadas arquivadas. Documentacao agora faz
  parte das 21 paginas visuais liberadas e conserva a suite funcional dedicada.
- A baseline fisica passou a ter exatamente as 201 imagens manifestadas; oito
  evidencias antigas da CAIXA foram removidas. O teste falha se uma captura
  orfa reaparecer e cada viewport comprova o truncamento da identidade longa.
- CSS legado reduzia `2.75rem` para 38,5px; controles de cookies passaram a usar
  minimo explicito de 44px. Nenhuma regra comercial, migration ou dado mudou.

## 2026-10-04: Associativo publicado com gates completos

- Status: validado; fonte: PR #141, CI 37173712179 tentativa 2 e audit
  `docs/audits/associativo-brilho-reprovacao-2026-10-03.md`.
- Runtime publicado 7337b97; 193 comparacoes visuais, 193 auditorias,
  40 navegacoes e seis jornadas v5 aprovadas. Sem promover baseline.
- Braces removido na base ja validada; preservar o patch, nao ignorar audit.
  Verificados hashes do artefato, equivalencia OCI/config/11 camadas e dois
  perfis no destino. Backup, CAS e pos-check aprovados; rollback desnecessario.
- Checkout principal da VPS sujo: usar checkout de release limpo, sem
  alterar trabalho alheio. Pressao de memoria adiou a troca ate estabilizar.
- Health e 12 GETs aprovados; jornada autenticada com dados ficticios sem
  salvar confirmou UI. Nao prova capacidade nem autoriza alteracoes de dados.
- PR #143 trata apenas QA/documentacao, sem necessidade de novo restart;
  CI do SHA final desse registro ainda obrigatoria antes da integracao.

## 2026-10-04: Aguardar o layout de impressao no QA

- Status: pendente_validacao; fonte: CI 37173712179 e reproducao sintetica
  com CSS completo do Tabelao, em Node 24.19/Chromium 151.
- `emulateMedia` pode devolver o controle antes de uma transicao de min-width
  terminar, mesmo com reduced motion (duracao 0.01ms). Cinco de seis leituras
  imediatas falharam; seis de seis passaram apos 13-48ms com o mesmo predicado.
- Usar polling limitado do contrato integral, nao espera fixa nem remocao de
  assercoes. A correcao e exclusivamente de ferramenta; pagina de referencia,
  CSS, limites visuais e regras financeiras permanecem iguais.
- Predicado preservado por AST; bloco final passou 10/10 vezes, enquanto
  largura e transform incorretos persistentes falharam por timeout nos probes.
  Oitenta e nove testes focados aprovados; CI do ajuste de QA ainda pendente.
- PR #141 ja integrado; CI do PR aprovou 193 capturas, 40 navegacoes e seis
  jornadas v5. Publicacao depende da revalidacao final da main, registrada no audit.

## 2026-10-03: shell protegido único e navegação fail-closed

- Status: pendente_validacao; fonte: código no SHA-base `8e158cc`, inventário de
  22 gates protegidos e pedido visual aprovado pelo usuário.
- Cinco simuladores renderizavam um cabeçalho local com links estáticos, enquanto
  as demais páginas usavam o catálogo autorizado. A convergência deve remover o
  shell interno, sem transformar visibilidade do menu em autorização.
- Quatro simuladores liberados fora do catálogo de 17 páginas podem ser anexados
  somente no servidor quando pai, permissão efetiva e `releaseEnabled` convergem.
  CAIXA permanece visível apenas como bloqueada e seu modelo de apresentação não
  contém `path`; banco, proxy, guards e RLS não mudam.
- Baseline: lint, tipos, 1.478 Vitest (1 ignorado), oito Node e build aprovados.
  Pendências: testes integrados, matriz visual/a11y, CI e publicação pelo runbook.

## 2026-10-03: Integracao da base corrigida no Associativo

- CI combinada 37167561944 aprovou validate e restore, mas o guidance detectou
  comparacao textual incorreta: CSS de producao serializa 0% como 0px. O QA
  normaliza apenas esse zero equivalente, preservando topo/rodape exatos e
  rejeitando 1px ou posicoes intermediarias. Quinze testes aprovados;
  publicacao ainda exige nova CI completa. Fonte: audit do Associativo.

- Status: pendente_validacao; fonte: pedido do usuario, PR #141 e main db1b625.
- O bloqueio de braces foi removido na base pelo PR #139, com patch versionado
  do plugin Next e tinyglobby. Incorporar essa solucao, sem aguardar 3.0.4,
  ignorar advisory ou refazer o patch. Validar novamente a arvore combinada.
- Preservados o Tabelao publicado e os ajustes exclusivos do Associativo.
  CI anterior 37136181590 parou apenas no audit; novos gates ainda obrigatorios.

## 2026-10-03: Brilho sem contorno e reprovacao metalica

- Status: pendente_validacao; branch codex/associativo-brilho-reprovacao.
- Fonte: seis capturas posteriores, CSS/JSX do Associativo e QA de guidance.
- Pedido mais recente remove o contorno fixo somente do ledger: verificar
  input, wrapper e composicao ancestral em vazio/preenchido/foco. Uma sombra
  herdada de focus-within pode restaurar o contorno mesmo com input limpo.
- Manter foco de teclado identificavel pelo nome sublinhado. Brilho de 3s
  percorre duas faixas de 2px no topo e rodape da linha inteira; reduced
  motion desativa animacao. Nunca alterar calculos para atender estilo.
- Dolar precisa ser irmao externo do resumo, nao filho da celula de data.
  Validar alvo 24/44px, icone 17px, distancia, alinhamento e hover no mobile.
- Reprovacao usa gradiente #650c17/#9d1828/#74101c/#48080f, texto branco,
  brilho vermelho e CTA escuro local, sem depender do fundo claro do tema.
- 30 testes focados e oito Node aprovados. Cinco timeouts da suite integral
  passaram na repeticao serial (46 testes); seis falhas POSIX exigem CI Linux.
- Lint, tipos, build e 6/6 jornadas finais aprovados, incluindo contraste,
  animacao/reduced motion, ausencia de contornos e dolar externo alinhado.
- Publicacao bloqueada: audit braces GHSA-vfj7-8cjw-p6xm; 3.0.4 indisponivel
  no registro consultado. Nao ignorar advisory nem alegar correcao aplicada.
- Detalhes e pendencias: docs/audits/associativo-brilho-reprovacao-2026-10-03.md.

## 2026-10-03: Tabelao publicado com evidencia de producao

- Status: validado; fonte: PR #139, CI 37136895575, CI main 37144378453 e
  verificacao HTTP/DOM autenticado em crm.descomplicapro.com.br.
- Runtime publicado: 8e158cc9d13beeff0087064df6d9b58d87790379. Todos os gates
  verdes; imagem imutavel comprovada por hashes/camadas e dois perfis no destino.
- Backup privado e rollback preservados; CAS concluido. Health confirmou SHA,
  acesso anonimo negado e pagina autenticada exibiu layout, ordem, dourado,
  Maps e recursos. Politica comercial continua disabled, sem destino.
- Endereco ausente na origem oficial continua sem link; nao inventar logradouro.
  Alteracao nao muda origem do estoque, regra financeira, dados ou migrations.
- Evidencias: docs/audits/tabelao-layout-maps-2026-10-02.md. Sem pendencia de
  publicacao do runtime. Registro documental posterior nao exige restart.

## 2026-10-03: Tabelao validado funcionalmente e referencias revisadas

- Status: pendente_validacao final; fonte: CI 37134880142 e artefato 11278718828.
- Build, lint, tipos, 1475 Vitest, oito Node, audit, banco, restore e E2E aprovados.
- Matriz funcional integral aprovada. Somente 11 capturas do Tabelao divergiram;
  revisao visual confirmou cabecalho compacto, Maps, ordem, dourado e rodape.
- Promocao transacional conferiu arvore limpa, hashes e predicado funcional
  original; 182 imagens preservadas, sem mudar tolerancias. Politica continua
  desabilitada e sem destino. Pendencias: nova CI, imagem e verificacao de producao.
- Evidencia: docs/audits/tabelao-layout-maps-2026-10-02.md; PR #139.

## 2026-10-03: Substituicao do glob no lint Next

- Status: pendente_validacao; fonte: codigo Next 16.3.6 e guia oficial tinyglobby.
- getRootDirs e o unico consumidor do fast-glob no plugin. Patch pnpm troca por
  tinyglobby 0.2.17 ja presente, com packageExtensions e remocao da cadeia antiga.
- Desabilitar expandDirectories e preservar saidas relativas/absolutas e aliases
  Windows 8.3. Testar a regra Next real, nao somente a ausencia no lockfile.
- Docker precisa copiar patches antes do install. Auditar normalmente, sem ignore.
- Dez testes focados passaram; primeira auditoria limpa. Lint local interrompido
  sob baixa memoria. Conclusao depende da CI e demais gates.
  Evidencias: docs/audits/next-eslint-glob-2026-10-03.md; PR #139.

## 2026-10-03: Politica desabilitada e bloqueio de auditoria do Tabelao

- Status: pendente_validacao; branch codex/tabelao-layout-maps, runtime 562465b.
- Fonte: confirmacao direta do usuario e rechecagem do PR #139/CI 37086793201.
- Politica comercial desabilitada e sem destino e o estado solicitado, nao uma
  pendencia de documento. Componente e QA existentes ja preservam esse contrato.
- CI aprovou formatacao, lint, tipos e testes; pnpm audit local tambem confirmou
  GHSA-vfj7-8cjw-p6xm alto. npm latest de braces permanece 3.0.3, sem correcao
  segundo GitHub Advisory. As ultimas versoes dos consumidores mantem a cadeia.
- Sem mudanca de runtime ou dependencia, bypass, merge ou deploy. Evidencias:
  docs/audits/tabelao-layout-maps-2026-10-02.md. Release segue pendente do gate.

## 2026-10-02: Layout e Maps no Tabelao

- Status: pendente_validacao; branch codex/tabelao-layout-maps, base 3960724.
- Fonte: sete prints, rota explicitada pelo usuario e confirmacao de manter
  a origem oficial atual para os enderecos.
- O endpoint protegido de estoque repassa uma API externa; o complemento de
  endereco vem do snapshot ESTOQUE SPC. Nao afirmar consulta direta ao banco.
- URL Maps usa somente componentes presentes e URLSearchParams. Sem logradouro,
  manter ausencia explicita sem link; rowspan deve comparar texto e destino.
- Nova ordem exige colgroup, cabecalho, corpo e oraculos de QA consistentes.
- CSS legado de impressao oculta investor-stock-panel. Restaurar somente no
  Tabelao e verificar presenca de todas as linhas antes de aprovar Imprimir.
  Conferir tambem textos descendentes e variaveis de tema: somente restaurar a
  tabela deixa Empresa/Empreendimento claros sobre branco. QA exige 4,5:1;
  capturas devem esperar o fim das transicoes antes de inspecionar o papel.
- Enriquecimento compara cidade/UF/CEP conhecidos antes de completar endereco;
  referencias ambiguas nao podem escolher arbitrariamente uma localizacao.
- Lint, tipos e build iniciais aprovados; 283 testes de dados e 18 de interface
  aprovados. Seis larguras, tres temas, Maps e impressao conferidos localmente.
  Duas suites Windows interrompidas por timeouts/baixa memoria e falhas POSIX.
  Gates completos pendentes. Politica depende de documento/destino do usuario.
- CI 37086002430/PR #139: 1465 Vitest e oito Node aprovados; audit bloqueia
  braces@3.0.3, GHSA-vfj7-8cjw-p6xm. Em 02/10, npm retornou E404 para 3.0.4
  e GitHub Advisory informou nenhuma versao corrigida. Nao ignorar esse gate.
  Publicacao, imagem e matriz visual autenticada continuam pendentes.
- Evidencias: docs/audits/tabelao-layout-maps-2026-10-02.md. Sem migration ou n8n.

## 2026-10-02: Contorno dourado sem preenchimento nos editaveis

- Status: pendente_validacao; branch codex/associativo-contorno-dourado.
- Fonte: duas capturas e pedido posterior do usuario, CSS e QA de guidance.
- A direcao nova substitui o preenchimento dourado das etapas por contorno;
  apenas a selecao do estoque preserva preenchimento metalico, mais escuro.
- Campos preenchidos precisam continuar transparentes. O seletor global de
  formularios tem alta especificidade: aplicar a excecao local tambem ao
  Ranking, sem mudar tokens compartilhados ou outras tabelas.
- Brilho limitado a 2px junto a borda, ciclo de 3s, sem cobrir texto. Mantem
  reduced motion e destaque somente na etapa pendente, sem pular modalidade.
- Contratos de QA atualizados para a solicitacao: rejeitam fundos dourados,
  caixas escuras, brilho branco/azul, faixa larga ou estatica. Contraste >=4.5
  para texto e >=3 para contorno nos tres temas; nenhuma tolerancia relaxada.
- 28 testes focados, lint, tipos, build, 8 Node e 6/6 jornadas aprovados.
  Windows com 6 falhas POSIX conhecidas; CI Linux e publicacao pendentes.

## 2026-10-02: Paleta do Tabelao como referencia do Associativo

- Status: validado; PR #136, runtime 150b771.
- Fonte: novo pedido do usuario e leitura da pagina /app/simulacao/tabelao.
- Referencia escura confirmada no DOM: fundo #061f35, painel #0a2b47,
  cabecalho de secao #0e4163 e campos #071a31. Tabelao somente leitura.
- A nova direcao substitui o azul quase preto anterior. Remover overrides
  exclusivos para herdar os tokens comuns evita duplicar a paleta; nao alterar
  tokens compartilhados nem seletores do Tabelao para atender o Associativo.
- Dourado e brilho de 3s continuam exclusivos das selecoes/proximas acoes.
- 28 testes focados, lint, tipos, build e 8 testes Node aprovados. Navegador:
  6/6 jornadas, 3/3 comparacoes de paleta e revisao desktop/celular aprovadas.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas POSIX conhecidas.
  CI Linux 37063588639 aprovou suite, build, restore e gate funcional.
- Duas capturas escuras do Associativo revisadas/promovidas; demais 191
  preservadas, inclusive Tabelao. CI PR 37067036288 e main 37069870083 verdes.
- Publicacao por imagem imutavel comprovada, backup e CAS; health correto,
  acesso anonimo negado e paleta/dourado de 3s confirmados no DOM publicado.
- Limite: verificacoes de producao observacionais, sem prova de capacidade.
  Fechamento documental nao demanda reinicio. Auditoria vinculada no WORKLOG.

## 2026-10-02: Tipografia e caixa de frase no Tabelao

- Status: pendente_validacao; branch codex/tabelao-tipografia-ptbr, base d7c06b6.
- Fonte: sete capturas e confirmacao do usuario para preservar nomes proprios
  e siglas; TabelaoClient, TabelaoFilters, CSS local e tabelao-presentation.
- Fonte unica de 11px para corpo/cabecalho; titulos nao quebram palavras nem
  dependem da caixa alta herdada. A coluna Planta libera espaco para os titulos
  Regiao, Metragem, Vagas e Estoque, mantendo o total das larguras em 100%.
- Formatar somente o rotulo exibido; manter valores dos selects, identificadores
  de estoque e comparadores comerciais originais. Isso evita regressao de filtros
  ao corrigir acentos ou a grafia de Terreo/Tipo/Adaptavel.
- Trocar Incorporadora por Empresa apenas na pagina solicitada. Outras tabelas
  usam seus contratos existentes e nao pertencem a esta mudanca.
- Nove cenarios Playwright locais, 42 testes do formatador, 17 contratos focados,
  lint do codigo, tipos e build aprovados. Suite Windows: 1405 aprovados e seis
  falhas POSIX; oito testes Node aprovados. Auditoria: tabelao-tipografia-2026-10-02.
- CI Linux 37028915320: 1411 Vitest e oito Node aprovados, banco/restore/E2E
  e matriz funcional verdes. Sete capturas revistas e promovidas; 186 imagens
  preservadas por hash. Reexecucao final/publicacao pendentes no PR #133,
  que recebera a evidencia de fechamento apos validacao da release real.
- A revisao detectou siglas compostas e filtros C/AP versus C/ AP. Normalizar
  somente vocabulario comum na apresentacao; preservar palavras desconhecidas
  e separadores evita descaracterizar nomes ou tornar opcoes indistinguiveis.
- CI 37033511673 aprovada antes da atualizacao paralela de main d79bf8c.
  Ao integrar manifestos visuais concorrentes, reconciliar registros por caminho
  com JSON, manter proveniencias e validar todos os hashes instalados. Preservadas
  sete imagens Tabelao, duas Associativo e 184 comuns; CI combinada pendente.

## 2026-10-02: Azul noturno e retorno ao dourado no Associativo

- Status: validado e publicado; PR #134, runtime d79bf8c.
- Fonte: pedido posterior do usuario, investor-archive.css e testes de temas.
- A solicitacao mais recente substitui o prata por dourado metalico e pede
  azul quase preto; nao reaplicar #001c54/#002774 por referencia anterior.
- Tokens restritos ao Associativo preservam as outras tabelas. O brilho de 3s
  continua somente na acao pendente e respeita prefers-reduced-motion.
- Testes focados: 28 aprovados, incluindo contraste >=4.5:1 nos fundos escuros
  e em todas as paradas do gradiente dourado. CI 37030093010 aprovou 1369 Vitest,
  oito Node, banco, restore, E2E e matriz funcional completa. Apenas duas
  capturas escuras diferiram, revisadas e promovidas sem alterar tolerancias;
  191 referencias preservadas. CIs 37034089884 e 37037035430 verdes.
- Publicacao por imagem imutavel, onze camadas/dois perfis comprovados,
  backup/CAS/rollback verificados e doze leituras publicas sem erro.
- Navegador autenticado confirmou cores computadas e brilho 3s; selecao local
  descartada ao final, sem salvar proposta. Registro posterior nao muda runtime.

## 2026-10-02: Ordem territorial e falhas transitorias do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-layout, base 727c858.
- CI 37003636668 aprovou 1367 Vitest, oito Node, validacoes de banco/restore,
  E2E e todos os criterios funcionais da matriz autenticada. Sete diferencas
  visuais restritas ao Tabelao foram revisadas e promovidas com proveniencia;
  186 referencias preservadas. CI das referencias/publicacao ainda pendentes.
- Fonte: pedido e capturas do usuario, tabelao-inventory.mjs, tabelao-region.mjs
  e testes de inventario/regiao. A consulta real foi somente observacional.
- Prioridade comercial das regioes: Leste, Sul, Norte, Oeste e Centro. Agrupar
  por regiao antes do nome evita misturar zonas; a chave de apresentacao inclui
  regiao para nao reunir projetos homonimos de localizacoes distintas.
- O rótulo de carga depende de consulta realmente pendente. Timeout/falha nao
  podem continuar indefinidamente como carga nem virar regiao presumida.
- Retry de transporte limitado a uma tentativa depois dos demais lotes, com
  os mesmos tres CEPs por lote; 401/403/400 e contrato contraditorio nao repetem.
- Divergencias atuais eram tipo/titulo do logradouro. CODLOG na camada municipal
  segmento_logradouro por HTTPS comprova identidade, sem remover tokens como
  prova ou criar mapa projeto/zona. Backend local confirmou 22/22 CEPs atuais em
  02/10/2026 08:37 BRT; Itaim Bibi pertence a Oeste mesmo com bairro Brooklin.
- Retry respeita Retry-After com espera abortavel ate dez segundos. Acima do
  orcamento, nao chamar antes do prazo. CEPs excedentes ao limite nao ficam pendentes.
- 405 testes focados, lint do codigo, tipos, build e oito testes Node aprovados.
  Suite Windows: 1361 aprovados, quatro skips e seis falhas POSIX preexistentes.
  Chromium local: nove cenarios aprovados para letras verticais, ordem, filtros,
  colunas compactas e cabecalho rolando, com capturas revisadas. CI autenticada
  e publicacao pendentes; nao usar esta nota como prova de release.

## 2026-10-02: Replica de Calcular documentacao

- Status: pendente_validacao; branch codex/calcular-documentacao.
- Fonte: pedido do usuario e pagina publica /simulacao/calcular-documentacao,
  bundles DocumentationCalculator-BjH7PIsT.js e documentation-calculator-rules-DI3ss1MX.js.
- O modulo lib/archive-investor/documentation-calculator-rules.mjs ja corresponde
  a referencia em 2.048 entradas comparadas, incluindo limites e erros; reutilizar
  sem criar outro motor. Esta evidencia nao homologa a politica como regra oficial.
- A nova replica usa a rota protegida existente e o item antes Em breve no SiteMenu.
  Nao requer habilitar runtime WF16, n8n, migrations ou novas permissoes.
- Conteudo integral inclui ajudas Em construcao, impressao, auditoria e alertas.
- Lint, typecheck, build, 32 testes focados e oito testes Node aprovados. Matriz local
  final: 12 combinacoes sem overflow ou violacoes Axe, impressao e layout de zoom 200%.
- Decoracao com overflow hidden podia gerar scroll interno ao focar e redimensionar;
  overflow clip localizado preserva a geometria. Testar limites internos, nao so o body.
- Suite Windows: 1.271 aprovados, quatro skips e 20 falhas POSIX/timeouts sob carga.
  CI Linux e publicacao pendentes no PR #130; gates nao foram reduzidos.
- CI 36968955807: 1.293 testes Vitest e oito Node aprovados, restore aprovado;
  E2E conservava a expectativa antiga de 403. Ao liberar pagina de arquivo, atualizar
  tambem protectedSurfaces, hub e smoke, preservando perfis negados e APIs oficiais.
- CI 36970005859: validate, restore, 20 E2E (um skip) e matriz dedicada autenticada
  aprovados. Atualizar tambem assertDisabledItems de archive-navigation ao ativar
  um link; simulationLinks sozinho nao remove a expectativa antiga de bloqueio.
  Artefato 11211986933 conferido por SHA-256; nenhum baseline promovido com gate falho.
- CI 36971939367: todos os criterios funcionais aprovados, incluindo 140 responsivos,
  80 de tema, 193 auditorias Axe, 100 de zoom e navegacao 4 rotas x 10 larguras.
  Sete diferencas visuais intencionais do hub foram revisadas e promovidas pelo
  promotor transacional existente; outras 186 imagens preservadas por hash.
  Captura 47318329 tem arvore identica a 5ec9311; artefato 11213300733 validado.
  Nova CI e publicacao pendentes, sem reduzir limite de diferenca ou tolerancia.
- Integracao com main 29a487b: manifestos concorrentes devem ser unidos por caminho,
  preservando imagens e hashes aprovados de cada escopo. Os 186 registros da main
  e sete do hub tem proveniencia separada; isso nao substitui nova CI integrada.

## 2026-10-02: Prata e confirmacao explicita no Associativo

- Status: validado e publicado. PR #129; CIs 36971256999, 36973571026 e 36998281910. Runtime 727c8583ab46a51f81fddb7e0c0ec01b4803a531 inclui o
  Associativo e a integracao paralela, sem reverter trabalho de outro escopo.
- Gate de origem recusou preparar revisao anterior quando a main avancou.
  Reconciliar tip, CI e versao viva antes de CAS; nao contornar a verificacao.
- Imagem imutavel comprovada, backup validado e 12 leituras publicas sem erro.
  Jornada autenticada confirmou etapas sequenciais. Fechamento sem novo runtime.
- Fonte: dezoito prints do usuario, InvestorCalculator.tsx, investor-archive.css
  e ArchiveHeader. Nova direcao visual substitui o dourado da etapa anterior.
- Enquadramento automatico nao equivale a confirmacao do usuario. Renda libera
  modalidade; somente sua confirmacao libera primeiro imovel, sem mudar regras.
- Usar um unico espacamento para padding do formulario e gap das duas colunas;
  recalcular a posicao da orientacao e sua seta com o mesmo token.
- Brilho recorrente de 3s deve depender do estado pendente, ter contorno interno
  e desligar em prefers-reduced-motion. Nao animar o painel inteiro.
- D de marca e cabecalho compartilhados afetam capturas de outras tabelas;
  revisar o escopo completo antes de promover referencias visuais.
- Alterar renda invalida confirmacoes dependentes, inclusive Ranking. QA de
  edicao precisa confirmar novamente, exigindo proposta bloqueada antes disso.
- Tabela de aprovacao conserva alturas fixas legadas com !important: layout
  mobile por regra precisa liberar alturas de tr/th/td, nao apenas quebrar texto.
- Evidencias completas da implementacao e publicacao:
  docs/audits/associativo-prata-2026-10-02.md.
- CI 36968663861: funcional completo aprovado; 44 referencias alteradas
  somente nas quatro tabelas, revisadas por viewport e tema. Promocao canonica
  preserva 149 imagens fora do escopo, mesmo quando ha drift abaixo de 1%.

## 2026-10-02: Capacidade por CEP, nao apenas por lote

- Status: validado (regressao e CI); publicacao pendente; branch codex/tabelao-regioes-fila.
- Fonte: smoke real de 598e117, lib/archive-investor/tabelao-region.mjs,
  tests/inventory-regions.test.ts e docs/runbooks/tabelao-regions.md.
- Tres requests de oito CEPs equivalem a 24 consultas, nao tres. Com mapa frio,
  a fila de cinco segundos descartava CEPs antes dos tres slots serem liberados.
- Cliente usa um lote de tres CEPs, ordenado e progressivo; paginas simultaneas
  compartilham consultas por CEP no servidor. API preserva contrato de oito CEPs.
- Duas regressoes integradas falharam antes e passaram depois; 235 testes focados
  aprovados. CI 36961528199 totalmente aprovada em 825d8a3. Tipos, build, lint
  do codigo e oito testes Node locais aprovados; seis falhas POSIX no Windows.
- Main documental 0ef7b2f integrada, sem mudar runtime; CI conjunta obrigatoria.
  Evidencia final da publicacao e da carga real de regioes sera registrada no PR #128.
- Nao confundir region_lookup_busy com ambiguidade geografica. Contagem de
  requests HTTP reduzida nao basta para provar o comportamento com cache frio.

## 2026-10-01: Regioes e vagas do Tabelao

- Status: pendente_validacao; branch codex/tabelao-regioes-vagas.
- Fonte: pedido do usuario, origem de estoque configurada, ViaCEP, Localiza Sampa,
  GeoSampa WFS; lib/inventory/region-lookup.ts e docs/runbooks/tabelao-regions.md.
- postalCode e parkingSpaces ja chegam da origem HTTP. A consulta atual nao prova
  atualizacao do estoque nem vinculo com uma coluna SQL; preservar generatedAt.
- CEP pode abranger distritos de zonas diferentes. Nao usar primeiro resultado,
  faixas aproximadas de CEP, bairro como distrito ou codigos entre sistemas.
- Localiza Sampa e GeoSampa usam codigos de distrito diferentes. Cruzar os nomes
  oficiais e nm_regiao_05; nao interpretar o codigo de regiao isoladamente.
- Fonte HTML sem API/SLA e apenas HTTP verificado: parse estrutural, contagem de
  linhas, CEP e logradouro cruzados; qualquer conflito fica nao confirmado.
- Cache territorial nao leva sessao; autorizar cada request antes dele. Consultas
  opcionais nao podem sobrescrever endereco, selecoes ou impedir uso do estoque.
- Vagas entram na chave da opcao, no estoque e nas facetas. null nao vira zero.
- 335 testes focados aprovados; sete cenarios Chromium com componente/CSS reais
  passam. Fonte atual: 20/22 CEPs confirmados, dois conflitos mantidos nao confirmados.
- Lint do codigo, tipos, build e oito testes Node aprovados. Windows registra seis
  falhas POSIX e timeouts na suite de conhecimento, sem alterar gates.
- CI Linux 36952238409: 1.279 Vitest e oito Node aprovados, quatro skips;
  formato, lint, tipos, build, banco, restore isolado e E2E aprovados.
- Matriz funcional passou (140 rotas, 80 temas, 193 axe, 100 zoom). Sete capturas
  do Tabelao revisadas e promovidas; outras 186 preservadas. PR #125, captura
  dd373aa e codigo 02074e7. CI final e publicacao pendentes; fechamento no PR.
- CI 36954481187 passou integralmente em 805e0ca. Integrada main ef0a2fb
  (guia do Associativo, PR #126), preservando seus arquivos e as referencias
  visuais. Nova CI conjunta e publicacao pendentes; nenhum deploy desta etapa.

## 2026-10-01: Cabecalhos e alinhamento do Tabelao

- Status: pendente_validacao; branch codex/tabelao-cabecalhos-centralizados.
- Fonte: pedido e captura do usuario, TabelaoClient.tsx, investor-archive.css,
  scripts/qa/authenticated-visual.mjs e auditoria tabelao-cabecalhos-2026-10-01.
- Titulo e corpo devem compartilhar o tamanho de fonte. Remover regras de
  4/6px, permitir altura automatica e manter limites de largura para quebra.
- Mover uma coluna exige atualizar colgroup, thead e tbody juntos. Com rowspan,
  td:first-child nao identifica a primeira coluna logica; conferir padding e
  geometria das celulas pelos headers depois de filtros e ordenacao.
- Centralizacao inclui th de rowgroup, td, titulos e wrappers de texto.
- Sete cenarios locais aprovados, com componente/CSS reais e fixtures; colunas
  compactas mantidas em 115/145/73px externos, sem corte de texto ou overflow.
  Typecheck e 55 testes focados aprovados; 992 testes Windows aprovados,
  quatro skips e seis falhas POSIX conhecidas. Build e lint do codigo aprovados.
  CI 36916047513 aprovou Linux, banco, restore, E2E e toda a matriz funcional.
- Sete capturas revisadas com fontes reais e tres temas, apenas do Tabelao;
  promocao canonica preservou as outras 186 referencias e os limiares 1%/16.
  CI final 36919972124 aprovada; main f1d71da integrada posteriormente sem
  sobrescrever o Associativo. Catalogo conciliado por rota com proveniencia;
  capturas preservadas. Nova CI conjunta/publicacao pendentes, fechamento no PR #123.

## 2026-10-01: Proxima acao dourada no Associativo

- Status: publicado_verificado_2026-10-02; runtime 598e1171; PR #126.
- Fonte: nove capturas e pedido do usuario; referencias publicas somente leitura,
  InvestorCalculator.tsx, investor-archive.css e auditoria guia-dourado.
- Dourado indica etapa atual, sem mudar as paletas azuis. Nao destacar a linha
  Financiamento enquanto o Perfil estiver incompleto: usar estagio qualification.
- Borda pulsante com scale ultrapassava o ledger. Usar pseudo-elemento interno
  inset 0, border-box, sem transform; manter popovers e foco acessiveis.
- Quantidade precisa reservar a mesma coluna de 26px do prefixo R$; igualar
  apenas wrappers nao igualava a largura das caixas de edicao.
- % Maximo da renda mensal e mudanca de rotulo, nao de regra. Manter indicadores
  de maior mensal e maior mensal + Evolucao de Obra distintos e atualizar ajudas.
- Estilos legados de background-clip/text-fill podem manter o $ azul mesmo com
  color dourado; verificar a pintura efetiva, nao apenas computed color.
- Inputs iguais no desktop nao devem diminuir alvos mobile: manter 44px.
- `hasTouch` isolado nao comprovou ponteiro coarse neste host. Usar contexto
  mobile real e conferir media query; neutralizar transform legado fora do hover.
- Jornada visual 6/6, mesma pagina 3/3 e coarse real/desktop 2/2. Suite Windows
  com limites POSIX registrados; CI Linux do PR 36954146586, main 36956549122 e
  integrada 36958962302 aprovadas. Nenhum gate enfraquecido.
- Main avancou com PR #125 do Tabelao; publicar descendente validado em vez
  de sobrescrever o trabalho concorrente. Imagem/backup/CAS/rollback verificados,
  12 GETs sem erro e pagina autenticada carregada. Referencias permaneceram intactas.
- Fonte final: docs/audits/associativo-guia-dourado-2026-10-01.md. Encerramento
  documental nao requer outro deploy nem prova de capacidade em producao.

## 2026-10-01: Layout inicial e FAQ do Associativo

- Status: validado; runtime f1d71da81a21cf139acc26b95a6cacc218b79325.
- Publicacao: PR #122, CI final do PR 36919448507 e CI main 36923454213 verdes.
  Imagem imutavel verificada em onze camadas e dois perfis, com backup/CAS/rollback.
- Fonte: quatro capturas e material de FAQ fornecidos pelo usuario;
  investor-archive.css, AssociativeLearningManual.module.css e QA compacto.
- Compactacao reduz margens e remove contorno duplicado dos filtros, sem
  overflow:hidden global, sem truncar estoque e sem alterar altura virtual.
- Guia usa largura intrinseca; ouro metalizado aplica-se a hover, foco e selecao.
- Paineis usam contornos de 6/8px, sem sombras amplas ou brilho continuo do guia.
- Anexo educacional nao e politica comercial: preservar exemplos e ressalvas,
  verificar fontes oficiais e explicitar divergencias com o runtime vigente.
- Previa em 1280x580 coube sem rolagem global; CI verifica esse tamanho e os
  tres temas antes de qualquer selecao. Nao misturar essa verificacao com o
  estado de proposta aberta, que deve conservar rolagem normal.
- CI 36915441302 aprova Linux (1.006 testes, quatro skips condicionais e oito
  Node), banco, restore, E2E, 40 navegacoes, 193 axe, zoom/teclado e manual
  em 30 capturas. Onze diferencas exclusivas do Associativo foram revisadas
  e promovidas pela rotina canonica; demais 182 referencias preservadas.
- Lint, tipos e build locais aprovados; seis falhas Windows de POSIX/symlink
  nao reproduziram na CI Linux. Publicacao e verificacao pos-deploy concluidas.
- Health local/publico confirma a release; doze GETs anonimos sem erros, com
  estoque e snapshot protegidos por 401. Esse smoke nao comprova capacidade.
- UI autenticada em 1280x580: zero rolagem global nos tres temas, dez linhas,
  guia 32px com 25,33px de folga total e card 8px. Ouro metalizado confirmado
  por foco, sem selecionar unidade real. Guia/Escape/retorno de foco aprovados.
- Em viewport muito baixo, preservar acesso ao conteudo: 1280x529 exigiu 16px
  de rolagem. Nunca esconder overflow global para simular uma tela que cabe.
- Console sem erros/avisos; nenhuma proposta alterada. Evidencia completa em
  docs/audits/layout-manual-associativo-2026-10-01.md. Registro documental sem restart.

## 2026-10-01: Alinhamento do fechamento do Associativo

- Status: validado; runtime 5878c3bce83990496d886c3311527724beb7d9f9.
- Fonte: captura e pedido do usuario; AssociativeTableArchive.tsx,
  investor-archive.css, PR #120, CI main 36881065033, health, navegador
  autenticado e docs/audits/rodape-associativo-2026-10-01.md.
- O aviso preliminar e o contato pertencem a uma grade comum alinhada pelo topo;
  abaixo de 760px passam para uma coluna, sem sobreposicao ou overflow horizontal.
- Navegador local com dados sinteticos mediu 0px de diferenca no desktop e
  empilhamento correto no celular, sem erros ou avisos no console.
- Matriz de navegacao 40/40 aprovada nos quatro simuladores, tres temas e dez
  larguras por rota, sem erros de runtime.
- CI 36862800456 aprovou validacao Linux, banco, E2E e restore isolado. Tres
  diferencas visuais esperadas em 768, 1024 e 1280px foram inspecionadas e
  promovidas pela rotina canonica; outras 190 referencias foram preservadas.
- Lint, tipos, teste focado e build aprovados. Suite Windows: 994 aprovados,
  um skip e sete falhas de POSIX/symlink ou timeout Chrome; CI Linux aprovada.
- Imagem imutavel com onze camadas e dois perfis, backup/CAS/rollback verificados.
  Doze GETs anonimos sem erro nao provam capacidade. UI publicada confirmou 0px
  no desktop e empilhamento correto no celular, sem console ou selecao de unidade.
- Preservar textos, tres temas, estoque, simulacao e demais rotas.
- Este registro documental deve ser integrado e sincronizado sem novo deploy.

## 2026-10-01: Filtros compactos publicados e conferidos

- Status: validado; runtime de72d1bb37b29cae7a61ac3ebd28f745b0e0bc2c.
- Fonte: PR #118, CI main 36807945046, health e navegador autenticado;
  docs/audits/filtros-associativo-2026-09-30.md.
- CI integral verde; imagem imutavel, onze camadas/dois perfis, backup e CAS.
- UI real confirma titulo a 8px do menu, guia de 32px, ajudas alinhadas,
  metadados a esquerda de Limpar filtros e dez linhas, sem overflow da pagina.
- Guia/ajuda/Escape/foco passaram; nenhum erro de console. Sem selecionar
  unidades reais ou alterar propostas. Doze GETs anonimos passaram; nao prova carga.
- Preservar navy/azuis e selecao dourada. Para layouts compactos, conferir
  tambem fonte real e proposta aberta em tablet, nao somente estado inicial.
- Resultado apenas documental: publicar no Git e sincronizar sem novo deploy.

## 2026-09-30: Estoque Associativo compacto e selecao dourada

- CI 36800158280: gates funcionais, banco, restore, E2E, 40 navegacoes,
  193 axe e zoom aprovados. Onze capturas revisadas/promovidas, exclusivas
  do Associativo; demais 182 e thresholds preservados. CI final/deploy pendentes.

- Proposta selecionada: regra antiga movia a ajuda para segunda linha em
  561-1100px com cabecalho fixo de 40px. Mantem a ajuda na terceira coluna;
  QA exige botao contido e sem colidir com titulo/conteudo seguinte.

- CI 36798139339 aprova E2E; falha visual em 768px mostrou o guia em duas linhas.
  Largura em vw encolhia o texto junto da ajuda. Usa 260px limitado ao conteiner;
  conferir fontes reais, nao apenas fallback Arial, antes de homologar geometria.

- CI 36797025028: validacao Linux, banco, restore e concorrencia sintetica passam.
  E2E exigia Filtros do estoque; contrato atualizado para ajuda/acao no cabecalho.
  Matriz local completa passou em 40 navegacoes/tres temas. CI integral pendente.

- Status: pendente_validacao; branch codex/associativo-filtros-compactos.
- Fonte: nove capturas do usuario, InvestorCalculator.tsx, CSS com escopo
  Associativo e docs/audits/filtros-associativo-2026-09-30.md.
- Selecao persistente usa o mesmo dourado do hover/foco, com texto escuro.
- Limpar filtros fica no cabecalho, metadados a esquerda; ajuda ao lado de
  Escolha a unidade. Sem Guia completo ou Filtros do estoque redundantes.
- CSS compartilhado tem sobrescritas tardias: conferir geometria renderizada,
  altura dos campos no celular e alinhamento dos icones; nao alterar outras rotas.
- Preservar propostas ao limpar filtros, dez linhas e estoque virtual completo.
- Local: lint/tipos/build, 30 combinacoes de geometria e dois contextos de toque
  aprovados. Obsidian 22/22 na reexecucao; seis limitacoes POSIX exigem CI Linux.
- CI, revisao visual e publicacao pendentes. Nao confundir codigo com release.

## 2026-09-30: Topo compacto publicado e conferido

- Status: validado; runtime 843fd113a3a1f6b6fd3b6b12b6de58de180256ce.
- Fonte: PR #116, CI main 36780351488, health e navegador autenticado;
  docs/audits/topo-associativo-2026-09-30.md.
- Titulo e Guia completo ficam a 8px da linha do menu; botao 36px em ponteiro
  preciso e 44px em toque. Mantem tres paletas e tamanho do titulo.
- CI integral aprovada; imagem imutavel com onze camadas e dois perfis comprovados,
  backup/CAS/rollback preservados. Doze GETs anonimos sem erro; nao prova carga.
- UI publicada confirmou geometria, guia, Escape, retorno de foco e nenhum erro
  de console. Usa nova aba sem recarregar a aba de trabalho; nao altera propostas.
- Registro documental: publicar no Git e sincronizar sem reiniciar a aplicacao.

## 2026-09-30: Alinhamento superior do titulo e guia

- CI 36774530982 aprovou testes Linux, banco, restore, E2E, navegacao e axe.
  Onze capturas revisadas e promovidas; demais 182 preservadas. Comparador
  continua em 1%/16 por canal. CI final e publicacao ainda pendentes.
- Status: pendente_validacao; branch codex/topo-associativo-compacto.
- Fonte: pedido e duas capturas do usuario; investor-archive.css e contrato
  scripts/qa/associative-compact-layout.mjs.
- Escopo somente Associativo: titulo e guia alinhados pelo topo, margem de 8px
  apos o menu e entre linhas no celular; botao 36px, com 44px para ponteiro coarse.
- Preservar as tres paletas, altura do menu e regras financeiras. Validacao
  deve conferir geometria real, toque, guia funcional, temas e zoom.
- Geometria: 30 combinacoes largura/tema e dois contextos de toque aprovados.
  Guia/Escape/foco/axe passaram em desktop/celular. Lint/tipos/build aprovados;
  Windows 994 testes aprovados, um skip, seis falhas POSIX. Oito testes Node passaram.
- CI Linux, referencias visuais e publicacao pendentes; nao interpretar
  implementado como publicado. Evidencia: docs/audits/topo-associativo-2026-09-30.md.

## 2026-09-30: Compactacao publicada e verificada

- Status: validado; runtime d9c2bee07fd6304006e28e357bf8e918a2031bf4.
- Fonte: PR #114, CI main 36764731943, health e navegador autenticado;
  docs/audits/compactacao-associativo-2026-09-30.md.
- Estoque Associativo mostra dez unidades por vez sem limitar resultados.
  Hover/foco dourado; passo virtual alinhado a 26px/48px no breakpoint 760px.
- Cabecalho compartilhado 56px em desktop/tablet; temas sem caixas, com texto,
  icones e sublinhado ativo. Titulo Associativo 2rem desktop e 1.475rem mobile.
- Mantem azul-marinho e tres paletas. Next 16.3.6 atende advisory critico; gates
  completos aprovados. Foco do menu preservado mesmo quando CSS oculta o controle.
- Publicacao com imagem imutavel, backup/CAS/rollback e dois perfis comprovados.
  Doze GETs anonimos sem erro, sem prova de carga. Confirmacao UI sem propostas
  ou dados alterados; nova aba evita descartar trabalho na aba do usuario.
- Registro apenas documental: publicar no Git e sincronizar sem reiniciar runtime.

## 2026-09-30: Dez linhas e cabecalho compacto

- Evidencia: CI 36758571149 aprovou gates funcionais, 40 navegacoes, 193 axe e
  100 zoom. Revisa/promove 44 capturas e preserva as demais 149/thresholds.
  Preview final 40/40; Next 16.3.6 com lint/tipos/build/audit aprovados.
  CI das referencias e publicacao ainda pendentes.
- CI 36757589260 bloqueou Next 16.3.3 por advisory critico atualizado em 30/09;
  patch oficial 16.3.6. Revalidar deps mesmo quando o commit anterior passou.
- matchMedia pode receber change apos o browser desfocar o controle oculto.
  Menu preserva ultimo foco interno, limpando referencia ao interagir fora.
- Status: pendente_validacao; branch codex/compactacao-associativo.
- Fonte: quatro capturas e pedido direto do usuario; auditoria de compactacao.
- Dez unidades visiveis significa viewport limitado, sem truncar estoque.
  Alinhar alturas CSS e passo virtual: 26px desktop, 48px ate 760px.
- Dourado reservado ao hover/foco da linha selecionavel; preservar temas azuis
  e fundo Escuro original. Temas sem caixas e com indicador textual de selecao.
- Cabecalho compartilhado compacto; titulo reduzido apenas no Associativo.
- Lint/tipos/build passaram; Windows com seis falhas POSIX e um timeout DevTools.
  Reteste isolado DevTools passou. QA integrado e publicacao pendentes.
  Sem alteracao financeira; aguardar transicoes CSS antes de conferir cores.

## 2026-09-30: Correcao azul publicada e confirmada

- Status: validado; runtime b55fa6fc95eb26087c70736d618bf019818c5876.
- Fonte: PR #112, CI main 36734239866 aprovada, health publico e navegador
  autenticado; docs/audits/cores-azuis-2026-09-30.md.
- Nos tres temas, marca, destaques e positivos sao azuis. Escuro preserva a
  pagina #061f35 e o cabecalho #071a31. Nao redesenhar essa base sem novo pedido.
- Imagem imutavel comprovada, dois perfis aprovados, backup/CAS/rollback
  preservados. Nenhuma mudanca de formulas, dados, banco, contas ou n8n.
- Navegador confirmou os tres temas e estoque carregado; zero erros de console
  observados. Smoke de doze GETs e quatro concorrentes passou, sem prova de carga.
- Conhecimento final documental; nao reiniciar o runtime ao integrar esse registro.

## 2026-09-30: Preservar o azul-marinho; retirar verdes

- Status: pendente_validacao; branch codex/temas-azul-original.
- Fonte: correcao direta do usuario e paleta anterior no commit 96410f9.
- Preferencia explicita: nao substituir a base azul-marinho do modo escuro.
  Nos tres temas, destaques e estados antes verdes devem ser azuis.
- Correcao restrita aos tokens dos quatro simuladores e cabecalho compartilhado,
  sem novo redesign nem alteracao financeira. Erros e avisos seguem distinguiveis.
- Testes de contrato protegem fundos originais, paleta azul e contraste.
- Evidencia: docs/audits/cores-azuis-2026-09-30.md; lint/tipos/build locais e
  preview 40/40 aprovados. Timeouts DevTools passaram no reteste isolado.
  Seis testes POSIX exigem Linux; validate e restore da CI 36726351781 passaram.
  Matriz: 40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
  Revisa e promove 44 referencias afetadas; preserva as demais 149 e limites.
  CI integrada das referencias e publicacao pendentes.
- A promocao canonica pode gerar JSON fora do estilo Prettier: formatar o
  manifesto e executar seus contratos antes do push. CI 36730344413 mostrou
  essa diferenca de formatacao; nao alterar evidencias para corrigi-la.

## 2026-09-30: Identidade publicada na web

- Status: validado; runtime 2c002df10fa2777165fec5b96f707ed971422e74.
- Fonte: PRs #109/#110, CI main 36667629540 aprovada, health publico e navegador
  autenticado em crm.descomplicapro.com.br; auditoria de identidade versionada.
- Imagem imutavel conferida por checksum, config, manifesto e onze camadas;
  dois perfis de runtime aprovados. Backup privado, CAS e rollback preservados.
- Marca sem Inteligencia comercial; Claro/Medio/Escuro, menu/Escape e estoque
  confirmados no Associativo publicado, sem erros de console observados.
- Smoke anonimo somente leitura: doze GETs com concorrencia quatro, health 200
  na nova versao, inventory/snapshot 401 e no-store, zero falhas.
- Limites: nao houve benchmark de capacidade nem mutacao de propostas/dados.
  Navegacao nas quatro rotas, temas, acessibilidade e zoom validados na CI.
- Atualizacoes deste registro sao documentais; nao reiniciar a aplicacao por elas.

## 2026-09-30: Auditoria pode mudar entre PR e main

- Status: pendente_validacao; branch codex/correcao-auditoria-identidade.
- Fonte: CI PR 36662908716 aprovada; merge 83f1b2f; CI main 36664719186 bloqueada
  por brace-expansion. Advisories GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p e
  GHSA-q2hr-2g5m-vwhr consultados na base oficial GitHub em 2026-09-30.
- Atualiza somente as duas resolucoes para 1.1.21 e 5.0.12. Instalacao frozen
  e politica supply-chain aprovadas; audit passou sem vulnerabilidades conhecidas.
- A CI do PR nao dispensa a CI do SHA final. Nao ignorar auditoria nem publicar
  imagem antiga quando um novo advisory aparecer. Producao permanece inalterada.
- Reteste local: lint, tipos e build aprovados; 987 testes passaram, um skip
  e seis falhas POSIX preexistentes no Windows. Nao alterar essas assercoes.
- Pendente: CI Linux integrada, imagem imutavel e publicacao.

## 2026-09-30: Validacao da identidade e referencias

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: CI 36660701681, captura e985f6791de4dfd5681cc47429a6d5f06bc61d25,
  docs/audits/identidade-navegacao-2026-09-29.md e authenticated-results.json.
- Linux, banco, advisors, restore e E2E aprovados. Navegacao 40/40,
  acessibilidade 193 e zoom 100 aprovados; somente 44 diffs visuais previstos.
- Capturas inspecionadas apos corrigir temas/tablet e filtros/mobile;
  44 referencias promovidas, outras 149 preservadas, sem afrouxar thresholds.
- Reteste local: 63 testes focados e preview 40/40 com cookies reais;
  revisao estatica independente sem novos achados. Preview usa dados sinteticos.
- Pendente: CI integrada das referencias, merge e publicacao com imagem imutavel.

## 2026-09-29: Identidade e navegacao dos simuladores

- Status: pendente_validacao; branch codex/identidade-navegacao-temas.
- Fonte: ArchiveHeader.tsx, SiteMenu.tsx, ThemeSwitch.tsx e auditoria de identidade.
- Cabecalho compartilhado substitui quatro copias de marca; remove subtitulo.
- Navegacao compacta usa estado independente dos popovers para que abrir
  um submenu nao feche o pai. Escape fecha um nivel por vez e restaura foco.
- Em accordion, fechar no pointerdown pode deslocar o proximo acionador antes
  do click. Fronteira de dismiss compartilhada preserva o gesto e a exclusao
  mutua; nao alterar globalmente todos os popovers por esse caso.
- Temas permanecem visiveis e so persistem com consentimento funcional.
- CSS legado fixava cores escuras nos simuladores; trocar apenas data-theme
  nao comprova aplicacao visual do tema. Validar tambem conteudo e controles.
- Primeira rodada: tipos/build aprovados, 57 contratos das tabelas aprovados;
  22 testes Obsidian passaram isolados apos dois timeouts por concorrencia.
- Preview: 40 combinacoes de rota/largura e tres temas do cabecalho aprovados.
  CI Linux 36650605575 passou validacao, banco, restore e E2E autenticado;
  matriz parou em sete checks de navegacao (seis cores durante transicao e
  um timeout de clique). Gate agora espera a cor final e guarda diagnostico
  incremental. Nova matriz/publicacao pendentes; nenhuma baseline promovida.
  Preview completo posterior: 40/40, tres temas e zero erros de navegador,
  incluindo Direta/320. Fonte: test-results/identity-full-preview.json local.
  Sem alteracao financeira.
- CI 36653241052: navegacao 39/40; atalho global de cookies interceptava clique
  na Direta/320. Camadas corrigidas para atalho < navegacao < painel de cookies.
  Seis testes do gate aprovados; CUA confirmou troca de submenu e abertura/
  fechamento de preferencias com o componente real no preview. CI final pendente.
- CI 36655323860 aprovou 40 navegacoes, 193 auditorias de acessibilidade e 100
  cenarios de zoom; diferencas visuais limitadas a 44 capturas dos simuladores.
  Inspecao manual identificou largura legada de 44 px nos temas/tablet e colisao
  de Limpar filtros na Direta/mobile. Correcoes e checks geometricos adicionados;
  nao promover capturas anteriores com esses defeitos. Nova CI obrigatoria.

## 2026-09-29: Colunas compactas e celulas repetidas do Tabelao

- Status: validacao local concluida; CI/publicacao pendentes; branch codex/tabelao-colunas-compactas.
- Fonte: TabelaoClient.tsx, investor-archive.css e tabelao-inventory.mjs.
- Textos de empreendimento, endereco e limitador passam a quebrar em larguras
  delimitadas. O min-width da tabela nao deve redistribuir espaco excedente.
- Mesclar rotulos consecutivos somente depois de agrupar por empreendimento e
  incorporadora. Nao excluir plantas nem unir A/B/A atraves de um valor distinto.
- Testes focados iniciais: 62 aprovados. Lint, tipos, build e Gitleaks aprovados.
  Suite Windows: 978 aprovados, quatro skips e seis falhas POSIX preexistentes;
  oito testes Node aprovados. Navegador sintetico local passou em sete cenarios,
  revisao independente sem achados; 75 testes focados finais aprovados.
  CI 36526268323: 984 testes Linux, matriz funcional/acessibilidade e restore
  aprovados. Sete referencias do Tabelao inspecionadas e atualizadas, com
  proveniencia por imagem; outras 186 preservadas. Nova CI e publicacao pendentes.
  Evidencias: docs/audits/tabelao-colunas-2026-09-29.md.

## 2026-09-29: Cabecalho compacto do Associativo

- Status: validacao local e inspecao visual concluidas; nova CI integrada e publicacao pendentes.
- Fonte: AssociativeTableArchive.tsx e investor-archive.css.
- Remove somente a trilha e o rotulo redundantes do topo; preserva H1, ajuda e guia.
- Espacamento reduzido fica limitado a investor-associative-table-page.
- Captura autenticada da CI 36520154289 validou navegacao, acessibilidade,
  teclado, zoom e responsividade; onze referencias exclusivas do Associativo
  foram inspecionadas e promovidas.
- O teste do catalogo passa a reconhecer as vinte verificacoes do Tabelao que
  o capturador atual ja executava; nenhuma referencia visual do Tabelao mudou.
- Teste especifico, lint, tipos, inventario e build aprovados. Suite Windows:
  972 aprovados, um skip e seis falhas POSIX preexistentes; nova CI Linux exigida.

## 2026-09-28: Tabelao e indisponibilidade concorrente

- Status: validacao local concluida com limitacao POSIX; branch codex/tabelao-concorrencia.
- Fonte: app/api/inventory e snapshot; TabelaoClient; tabelao-payload.ts;
  docs/audits/tabelao-concorrencia-2026-09-28.md.
- Deduplicar somente promessas em andamento nao contem consultas sucessivas
  quando a origem falha rapidamente. O intervalo de cinco segundos deve comecar
  na falha compartilhada, sem ser prolongado por cada novo acesso.
- Cada acesso continua autorizado antes do cache ou erro compartilhado; nunca
  reutilizar sessao nem devolver estoque vencido como recuperacao.
- Deadline da pagina inclui leitura do corpo; cancelamento de uma pagina nao
  pode cancelar a consulta compartilhada de outros usuarios no servidor.
- Lint, tipos, build e formatacao aprovados. Windows: 967 testes aprovados,
  quatro skips condicionais e seis falhas POSIX preexistentes. Endpoints:
  92 testes aprovados; payload exercita trinta consultas isoladas. Gitleaks
  passou. Gates Linux, navegador e publicacao pendentes; consultar auditoria/PR.

## 2026-09-28: Conteudo e ajudas do Associativo

- Status: pendente_validacao integrada/publicacao. Base publicada: b297614.
- Fonte: associative-learning-content.ts, InvestorCalculator e auditoria
  docs/audits/associativo-manual-conteudo-2026-09-28.md; referencias oficiais nela.
- Perfil e manual compartilham tres ajudas. Guia possui 27 topicos e seus locais.
- Indicador "Maximo da renda por anual" exclui a anual mesmo quando o total
  da mesma linha mensal a inclui. Descrever exatamente o indicador, nao como
  comprometimento global de todas as despesas da familia.
- Motor local e WF13 versionado nao sao equivalentes. Perfil/documentacao usam
  bases diferentes e podem divergir de modalidade perto dos limites. Explicar
  essas limitacoes; nao alterar calculos em pedido exclusivamente editorial.
- ITBI e registro sao estimativas locais; primeiro imovel declarado nao e prova
  de primeira aquisicao nem garantia de isencao. Exigir conferencia oficial.
- Testes: 145 de dominio e cinco do manual aprovados. Suite Windows: 950 pass,
  um skip, seis falhas POSIX preexistentes. CI Linux e QA final ainda exigidos.
- Lint, tipos, build, oito testes Node e QA isolado (30 capturas/axe) aprovados.
  Matriz integrada deve confirmar o mesmo comportamento no build autenticado.
- Evidencias finais de CI e release devem ficar no PR da branch
  codex/associativo-manual-conteudo, sem inferir publicacao deste checkpoint.

## 2026-09-28: Manual Associativo com abas acessiveis

- Atualizar uma imagem revisada exige atualizar seu tamanho/hash no catalogo
  authenticated-results.json. Registrar origem por baselineRevision e manter
  delta anterior real; o teste de integridade nao deve ser enfraquecido.

- Status: comportamento validado na CI 36486887891; referencia visual atualizada
  para o menu corrigido. Evidencias finais de CI/publicacao: PR #104.
- Fonte: AssociativeLearningManual.tsx/module.css; InvestorCalculator;
  docs/audits/associativo-manual-2026-09-28.md.
- Isolar a moldura interativa do manual preserva textos e os outros simuladores.
  Manter abas e fechar fora da area rolavel evita perder a navegacao em celular.
- Ancoras policy/faq sao preservadas quando o componente esta montado; a
  selecao da unidade continua sendo previa aos recursos finais da simulacao.
- Testes: tres unitarios novos aprovados; lint, tipos e build locais aprovados.
  Windows: 948 pass, um skip e seis falhas POSIX preexistentes. CI Linux exigida.
- Matriz acrescentada: cinco viewports, tres temas, ambos os paineis,
  teclado, foco, ancoras, axe, geometria e capturas. Evidencias em test-results.
  Rodada local isolada do componente passou com 30 capturas e zero violacoes
  axe; oito testes Node tambem passaram. Sem dados ou credenciais de producao.
- Sem alteracao de calculos, politica comercial, backend, migrations ou n8n.
- QA deve aguardar o evento nativo close para validar efeitos posteriores ao
  fechamento; hidden/foco podem ocorrer antes da limpeza da ancora.
- O manifesto Next carrega CSS legado apos o modulo: regras de titulo/foco
  precisam de especificidade suficiente, nao apenas da ordem dos imports.
- Tema intermediario no SiteMenu do arquivo chama-se Medio; no shell geral,
  Equilibrado. A matriz do manual usa o controle local, preservando a proposta.
- CI 36483450994 identificou corte preexistente do menu em 1024px; reproduzido
  no navegador publicado. Cabecalho Associativo passa a duas linhas entre
  821 e 1100px, sem alterar os demais simuladores. QA mede o seletor de tema;
  referencia de 1024px requer atualizacao visual justificada, sem relaxar gates.
- CI 36486887891: 30 capturas/axe do manual aprovadas; matriz funcional inteira
  aprovada. Unica divergencia foi a imagem 1024x768 do cabecalho corrigido,
  inspecionada e atualizada com hashes/proveniencia no relatorio. Demais 192
  comparacoes preservadas; nova CI confirma a referencia. Consultar evidencias
  do PR #104 para o estado final, nao inferir deploy deste checkpoint.

## 2026-09-28: Associativo, estoque e publicacao automatica

- Status: validado; PR #102 integrado e release 3d92b7a publicada em 15:01 UTC.
- Fonte: docs/audits/associativo-concorrencia-2026-09-28.md; rotas inventory;
  calculator-rules, approval-rules, installment-memory e testes de concorrencia.
- HTTP 200 nao comprova corpo recebido: duas aberturas falharam com transferencias
  parciais e timeout de 25 segundos. Compressao so nas duas rotas autorizadas.
- Identidade ausente/duplicada nao deve enriquecer valores financeiros.
  Validar payload antes do cache e cada usuario antes de compartilhar resposta.
- Validar parcelas antes de alocacao; calendario estrito, indices anuais reais
  e comparacao monetaria em centavos, inclusive painel e sugestoes.
- CI integrada detectou clamp assincrono de parcelas: invalidade precisa
  permanecer visivel, nao ser aceita em um estado transitorio de um frame.
- Usuario reiterou autorizacao permanente de publicar alteracoes concluidas
  apos validacao em qualquer chat deste Git comum. Persistida nas instrucoes
  globais delimitadas ao projeto e automatic-publication.md. Sem ampliar
  permissoes para DNS, contas, cobrancas, migrations ou dados remotos.
- Concorrencia usa identidades/dados sinteticos locais; nao prova capacidade
  de producao. Build da imagem ocorre no runner CI, nao no VPS.
- CI 36437130674: 948 Vitest, oito Node, 1.042 pgTAP e 20 E2E aprovados;
  restore, lint, tipos e build passaram. Quatro sessoes, 20 chamadas simultaneas
  e zero erros em ambiente sintetico; nao equivale a 20 usuarios distintos.
- Producao: estoque autenticado carregou, duas respostas comprimidas completas,
  12 sondagens de leitura sem erro e acesso anonimo negado. Quantidade extrema,
  anual acima do limite e preservacao de proposta conferidas na pagina publicada.
- Docker classic identifica config; containerd identifica manifesto. Nao
  comparar digests de tipos distintos nem ignorar diferenca: provar checksum,
  ligacao manifesto/config, plataforma, label e camadas; revalidar dois perfis
  e registrar ID do host antes do CAS. Prova e hashes no relatorio de auditoria.
- Pendencias: fonte live informa 07/08/2026; transporte funcionando nao comprova
  atualidade comercial. Divergencia preexistente de autoridade entre WF13
  oficial e arquivo nao autoriza substituir formulas.

## 2026-09-28: Caveman automatico e regressao do estoque

- Status: validado (local; gates Linux vinculados ao PR, sem publicacao).
- Fonte: PR #101; docs/audits/caveman-ferramentas-2026-09-28.md; FERRAMENTAS.md;
  InvestorCalculator.tsx; rota inventory/snapshot; testes e QA sintetico.
- Caveman Lite rege concisao, nao exatidao financeira; Cavecrew complementa os
  sete agentes crm-\* existentes. Onze skills locais constam no inventario.
- Next DevTools/Chrome DevTools sao diagnosticos locais, sem contas novas,
  telemetria, CrUX ou conexao a navegador pessoal. MCP configurado nao implica
  ferramenta carregada no chat atual; conferir em nova sessao e usar runbook.
- Filtrar nao inicia proposta: somente selecao da unidade bloqueia substituicao
  pela fonte viva. Filtrar/limpar deve preservar unidade e valores preenchidos.
- Snapshot frio precisa compartilhar leitura em andamento e limpar falhas para
  retry, sempre apos autorizacao individual; no-store e integridade preservados.
- Vitest 4.1.11 aprovado no PR #65 e integrado; nao migrar major sem necessidade.
- Testes Windows: 806 aprovados, seis falhas POSIX preexistentes e um skip;
  oito testes Salesforce passaram separadamente. Lint/tipos, inventario, MCPs,
  Gitleaks, pnpm audit e OSV passaram; scanners sem achados conhecidos apos
  corrigir o SDK transitivo do Next MCP para 1.30.1. Sem ignores de seguranca.
- Pendencias: gates finais desta branch, fontes/politicas de negocio e eventual
  publicacao explicitamente autorizada. Nenhum ganho percentual foi medido.

## 2026-09-28: prontidao e selecao das ferramentas

- Status: validado (instalacoes e verificacoes locais; gates Linux vinculados ao PR).
- Fonte: scripts/knowledge/doctor.mjs; tests/project-resource-doctor.test.ts;
  catalogo de plugins; releases oficiais Gitleaks v8.30.1 e OSV-Scanner v2.6.0.
- Codex Security agora consta instalado/habilitado, atualizando a observacao
  historica anterior. Selecionar skill por alvo, cumprir preflight e preservar
  aprovacoes; nao acionar scans completos em tarefas sem demanda de seguranca.
- Gitleaks/OSV instalados em ~/.local/bin no Windows, com hashes verificados.
  secrets passou; OSV encontrou somente o advisory moderado GHSA-82fw-gwwq-j7x9
  em Vitest/@vitest/mocker 4.1.10, rastreado no PR #65; achado nao foi suprimido.
- resources:doctor distingue disponibilidade local de autenticacao e testes.
  Docker nao instalado neste desktop; gates isolados continuam na CI Linux.
- Doctor real, 16 testes novos, 26 de conhecimento/inventario, lint, tipos,
  build e formatacao passaram. Suite geral Windows tem seis falhas POSIX
  preexistentes; um timeout inicial nao repetiu com dois workers. Oito testes
  Node Salesforce passaram separadamente; CI Linux valida o candidato integral.
- Revisao independente corrigiu falsos positivos de Supabase sem binario e
  scanner antigo. O diagnostico exige CLI Supabase na versao do pacote e
  Gitleaks 8.19+ serie 8 / OSV serie 2; novos majors precisam ser validados.
- Perfil crm-qa aplicado em delegacao real e inventario validado: 40 arquivos,
  nove areas, sete perfis e quatro skills. Nao foram executados todos os perfis.
- Pendencias: conferir conexoes quando forem usadas; MCP n8n nao exposto nesta
  sessao, sem alteracao de workflow nem fallback REST. PostHog/Datadog opcionais
  nao equivalem a telemetria do CRM configurada. Sem SDK, conta nova ou deploy.

## 2026-09-28: recursos e busca entre chats

- Status: validado (mecanismo e instalacao local; gates Linux vinculados ao PR).
- Fonte: PR #99 (recursos-memoria-crm); docs/audits/recursos-crm-2026-09-28.md; scripts/knowledge;
  tests/obsidian-knowledge.test.ts; tests/project-resources.test.ts.
- Conhecimento compartilhado e documental: agentes registram aprendizados,
  nao conversas completas. knowledge:search recupera trechos do checkout e
  aprendizados de outros worktrees sincronizados; nao treina o modelo.
- Sete agentes locais e quatro skills de dominio. Novas sessoes carregam os
  arquivos; nao ha injecao retroativa em chats nem autorizacao adicional.
- Manifesto cobre 40 arquivos de rotas/APIs em nove areas, com teste que detecta
  rotas novas sem mapeamento. Nao certifica todos os slugs ou papeis dinamicos.
- Navegador em 27/09: 19 rotas inspecionadas em leitura com Master. Dashboard
  sem overflow global nas quatro larguras, mas metas ainda sem fonte segura;
  ranking bloqueado por politica e parcerias aguardando conciliacao. Confirmar
  estado atual antes de agir; nao remover bloqueios por suposicao.
- Catalogo confirmou plugins principais instalados; autenticacao e telemetria
  sao verificacoes separadas. Codex Security apenas sugerido, nao confirmado.
- Validacao: 26 testes especificos, lint, tipos, build e formatacao passam.
  Suite geral Windows: 744 passam, seis falhas POSIX conhecidas e um skip;
  oito testes Node Salesforce passam em execucao separada. CI Linux e o gate
  integral, nao suprimir as falhas locais para obter resultado verde.
- Revisao independente corrigiu isolamento entre repositorios, proveniencia de
  fallback, geracoes intercaladas e tamanho dos titulos; regressao automatizada.
- Instalacao compartilhada atualizada e conferida nos tres checkouts, inclusive
  busca a partir da branch antiga e leitura pelo CLI do Obsidian. Backup de
  100 arquivos restaurado com hashes equivalentes em 28/09/2026.
- Audit: dois moderados em Vitest/@vitest/mocker, sem altos/criticos. Atualizacao
  ja proposta no PR Dependabot #65; nao foi misturada a esta entrega.
- Diagnostico CLI: configuracao carregada, mas verificacao opcional do MCP n8n
  sofreu timeout. Revalidar o conector quando necessario; nenhuma alteracao de
  workflow ou credenciais foi tentada e nao existe fallback REST autorizado.
- Nenhuma publicacao em producao ou alteracao de dados remotos.

## 2026-09-27: desempenho do estoque

- Status: validado.
- Fonte: PRs #94 e #95; docs/runbooks/inventory-performance.md;
  CI 36349004691; conferencias de producao neste chat.
- Fontes de estoque em paralelo, cache de 30 segundos com autorizacao antes do
  cache, deduplicacao e reducao de calculos repetidos dos filtros.
- Benchmark de facetas por regiao: mediana de 57,023 ms para 12,449 ms em 3.301
  unidades. Nao representa reducao equivalente no tempo total de abertura.
- Regra compacta herdada com !important impediu inicialmente o alvo de 44 px.
  Corrigida a prioridade CSS e acrescentada medicao geometrica no teste visual.
- Validacao: lint, tipos, testes, build e matriz visual aprovados na CI Linux.
  Conferencia real confirmou filtros utilizaveis, botao de 44 px e console limpo.
- Limite operacional: a VPS sofreu pressao de memoria com testes visuais
  extensivos. Preferir a CI para a matriz pesada; nao interromper servicos alheios.
- Nao houve alteracao de regras financeiras, schema ou workflows n8n.

## 2026-09-27: memoria local e ferramentas automaticas

- Status: validado (instalacao e testes locais especificos).
- Fonte: scripts/knowledge/obsidian.mjs e docs/runbooks/obsidian-project-memory.md.
- Documentos tecnicos selecionados sao exportados para o vault local. Cada
  checkout tem estado separado; historico deduplicado por conteudo e revisao.
- Hooks Git locais sincronizam commits, merges, checkouts e rewrites. AGENTS.md
  define consulta inicial, roteamento automatico de skills e registro final.
- Notas editadas manualmente, links simbolicos e possiveis credenciais bloqueiam
  a exportacao. Nenhum plugin comunitario, SDK ou servico pago e necessario.
- Validacao: 14 testes especificos aprovados, incluindo hook post-commit real,
  worktrees, concorrencia, idempotencia e preservacao de notas manuais.
- Instalacao conferida nos tres checkouts locais; o CLI do Obsidian leu o indice
  gerado. Backup anterior com 77 arquivos e restauracao por hash aprovada.
- Lint, tipos e build das 41 rotas passaram no Windows. A suite geral encontrou
  as seis falhas preexistentes ligadas a permissoes POSIX; consultar a CI Linux
  do PR para a validacao integral antes do merge.
- Nenhuma alteracao de producao, conta, plugin comunitario ou regra financeira.

## 2026-10-05: paridade visual exige referencia externa

- Status: em validacao antes da publicacao.
- Fonte: `docs/qa/canvas-parity/README.md`,
  `docs/audits/canvas-layout-correction-2026-10-05.md` e
  `scripts/qa/authenticated-visual.mjs`.
- Uma baseline gerada pela propria aplicacao detecta regressao entre commits,
  mas nao comprova que a tela corresponde a um canvas externo aprovado. O gate
  anterior era autorreferente e permitiu promover uma composicao divergente.
- A matriz autenticada passou a recortar a metade correta das 11 pranchas e
  comparar as 22 rotas por distribuicao cromatica e estrutura de bordas, alem
  de manter capturas internas, Axe, overflow, console, zoom, teclado,
  reduced-motion, sete larguras e tres temas.
- O contrato continua estrutural: canvases nao autorizam numeros, politicas,
  rotas, grants ou motores. Dados e navegacao permanecem derivados dos loaders
  e guards existentes; ausencia de fonte continua fail-closed.
