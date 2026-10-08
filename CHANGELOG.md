# Changelog

- Corrige a validação portátil do launcher Salesforce: o teste de ausência do
  Chrome agora injeta a inspeção do executável e não depende dos programas
  instalados no runner da CI.

## 2026-10-07 - Publisher Salesforce para n8n fail-closed

- Adiciona publisher local desligado por padrao que envia somente o payload
  agregado por HTTPS e le o Bearer origem→n8n de arquivo privado: `0600` no
  POSIX ou ACL exclusiva do usuario no Windows.
- Exige confirmacao final do CRM em HTTP `200/201`, com `ok=true` e o mesmo
  `requestId`; aceite intermediario do n8n nao conclui a publicacao.
- Mantem MFA manual intencional em Chrome/CDP dedicado, sem reutilizar aba do
  Codex, e conserva refresh, primeira carga e agenda desligados.
- Adiciona `pnpm salesforce:chrome` para abrir, na estação gráfica, Chrome
  visível com perfil exclusivo dedicado e CDP apenas em loopback; o launcher
  recusa root, ambiente sem tela, perfil pessoal e sandbox desativado.
- Compartilha `ops/salesforce/.env` entre launcher, coleta, publisher e agenda;
  aceita caminhos absolutos nativos de Windows/macOS/Linux, alinha a porta CDP e
  protege atomicamente o candidato com permissao/ACL adequada ao sistema.
- Registra que o MCP n8n estava indisponivel e nenhum workflow remoto foi
  alterado ou ativado. Marca 229 e 1.099 pgTAP como referencias historicas,
  aponta o sentinela atual de 1.104 e registra as tres RPCs auditadas de
  ingestao permitidas a `service_role` no schema versionado.

## 2026-10-07 - Entrega de e-mail Auth

- Prepara SMTP customizado do Resend para cadastro e recuperação, com domínio
  transacional separado de follow-up e tracking desligado.
- Mantém signup e recovery no servidor, captura falhas do provedor e preserva
  cookies, anti-enumeração, callback e aceites legais.
- Não introduz `Sb-Forwarded-For` nem chave `sb_secret_`: o limite de envio é
  combinado no projeto e não muda com o IP de origem.
- Corrige a documentação da Site URL, redirect de recovery e estado remoto da
  migration Auth/MFA. O template produtivo continua em `ConfirmationURL`/PKCE
  até prova contra scanners e prefetch.
- Atualiza apenas o runtime Next.js de 16.3.6 para 16.3.8, patch oficial do
  advisory alto de SSRF na otimização de imagens detectado pela CI; mantém o
  `eslint-config-next` 16.3.6 e seu patch versionado.
- Não cria migration. Lint, tipos, 2.248 testes Vitest, 41 testes Node e build
  de 44 rotas foram aprovados; DNS, SMTP, limite de envio, configuração remota
  e deploy permanecem pendentes de evidência operacional.

## 2026-10-07 - Delegação explícita pelo Master

- Permite que Master aplique uma exceção individual `Permitir` a Administrador
  ou qualquer usuário de nível inferior mesmo quando o papel mostra
  `Herdada: negada` e a permissão possui nível mínimo 100.
- Mantém a exigência de que o Master possua a permissão, a hierarquia estrita e
  os bloqueios contra autoalteração, outro Master e pares Administradores.
- Esclarece na matriz que a exceção não altera o papel e adiciona cobertura no
  servidor, no banco e no contrato de restore.

## 2026-10-07 - Associativo publicado e conferido

- Publica a correcao da data de termino da obra e dos calculos Linear/Decrescente
  na imagem imutavel `4d73412`, apos aprovacao integral dos gates.
- Registra backup, verificacao autenticada do exemplo e evidencias financeiras,
  mantendo os limites da amostra e sem alterar politicas ou propostas remotas.

## 2026-10-07 - Calculo Associativo pela data oficial da unidade

- Usa a Data de termino da obra do estoque vivo para separar pre e pos-obra,
  sem permitir que uma copia antiga libere a simulacao.
- Desconta anuais nominais uma vez, corrige capitalizacao dos quatro blocos
  e distribui as parcelas restantes de forma equilibrada.
- Expoe calculo, entrada, primeiro juro e primeira mensal para conferir historicos;
  painel de aprovacao passa a usar o Pro-Soluto com a correcao da carencia.
- Unifica motor legado e atualiza ajudas e oraculos sinteticos independentes.
- QA diferencia o expansor de datas da ajuda e as parcelas da documentacao;
  verifica a data historica dentro da propria linha da entrada.
- QA de indisponibilidade identifica somente o erro 503 sintetico esperado;
  outros erros de console e JavaScript continuam bloqueando a publicacao.
- QA de carregamento exige estoque vivo antes de selecionar unidade e mantem
  as verificacoes de filtros e preservacao da proposta apos o carregamento.
- Sugestoes preservam os pagamentos existentes e so acrescentam sinais antes
  de uma primeira mensal fixada; calendario automatico permanece disponivel.
- Sem alteracao de dados remotos, limites comerciais, n8n ou financiamento bancario.

## 2026-10-07 - Diagnostico das formulas do Associativo

- Documenta a reconstrucao linear e decrescente confrontada com Salesforce,
  incluindo datas da unidade, carencia, particao e capitalizacao dos blocos.
- Diferencia inventario de oportunidades, comparacoes reais e prova sintetica.
- Sem mudanca de runtime, dados, politicas ou implementacao financeira.

## 2026-10-07 - Preferências de cookies contextuais

- Remove o atalho flutuante permanente de cookies depois da primeira escolha.
- Mantém o gerenciamento acessível no menu da conta e na Política de Cookies,
  com retorno de foco ao controle que abriu o painel.
- Adiciona estado de gravação e erro visível aos botões de consentimento, sem
  alterar categorias obrigatórias, duração ou proteção do cookie.

## 2026-10-07 - Sessão manual Salesforce preparada

- Adiciona execução candidata Salesforce a cada 30 minutos sobre Chrome
  dedicado e MFA manual, sem Connected App ou credencial de API própria.
- Restringe CDP a loopback, recarrega somente o workspace Direcional e mantém o
  `sid` em memória, com falha fechada quando nova autenticação é exigida.
- Serializa as coletas para impedir sobreposição e mantém n8n, ingestão e flags
  remotas desligados até os gates de publicação.

## 2026-10-07 - Matriz de acessos publicada

- Aplica no Supabase produtivo os papeis Coordenador, Gerente House, Gerente
  Imob, Corretor House e Corretor Imob, com as visoes Geral, Com Canal Imob,
  Sem Canal Imob, Ranking e Parcerias separadas no banco.
- Ativa a edicao multipla e atomica de excecoes de permissao, mantendo
  Administrador abaixo de Master e bloqueando alteracoes em pares do mesmo
  nivel ou superior.
- Publica o novo layout de Usuarios na imagem imutavel `3bcc3c4`, com backup,
  CAS, rollback preparado, health, rotas protegidas e negacao anonima
  verificados.
- Mantem uma conta `broker` e duas `user` sem acesso herdado e sem conversao
  automatica; a classificacao House ou Imob continua sendo uma decisao manual.

## 2026-10-07 - Repasse compativel com os novos papeis

- Integra a rota Repasse da `main` sem ampliar seu publico quando Parcerias
  passa a ser herdada por Coordenador e perfis Imob.
- Exige papel `master` e `crm.partnerships.view` em conjunto no Proxy,
  navegacao, pagina e Server Action; permissao isolada continua insuficiente.
- Atualiza a matriz de smoke para os oito perfis atuais e 24 rotas protegidas.

## 2026-10-06 - Evidencia movel estabilizada

- Limita o e-mail do cabecalho de Usuarios a duas linhas no celular, evitando
  que o identificador sintetico altere a altura total entre ambientes.
- Torna idempotente a resposta tardia da fixture de estoque no QA do
  Associativo quando o navegador ja encerrou a requisicao durante uma
  navegacao, sem suprimir outros erros.
- Aguarda explicitamente por ate 60 s a habilitacao de cada campo do fluxo
  Associativo no gate visual, preservando todas as verificacoes funcionais.
- Atualiza somente as referencias de Usuarios em 320 e 375 px apos a matriz
  autenticada completa aprovar responsividade, temas, Axe, zoom e comparacoes.

## 2026-10-06 - Baseline combinada de Associativo e acessos

- Integra as onze referencias do Associativo publicadas na `main` com as onze
  referencias revisadas de `/admin/usuarios`, preservando as outras 220.
- Registra no manifesto os dois commits de captura e exige uma comparacao
  integral limpa na CI antes do merge, sem alterar tolerancias ou predicates.

## 2026-10-06 - Acabamento responsivo da matriz de acessos

- Impede que os selos de permissao herdada sejam cortados na consulta somente
  leitura: no desktop o texto cede espaco ao estado e, no celular, o estado
  ocupa uma linha propria.
- Reconhece a altura deliberada da matriz completa somente em
  `/admin/usuarios`, preservando o limite de densidade das demais rotas e todos
  os checks funcionais, visuais e de acessibilidade.

## 2026-10-06 - Gates da matriz de acessos

- Sincroniza o ensaio de restore com os 1.099 testes pgTAP atuais.
- Atualiza o QA RLS e a matriz Playwright para os seis papéis atribuíveis,
  Master e o estado interno pendente, cobrindo as diferenças entre House e
  Imob em Dashboard, Ranking e Canal de Parcerias.
- Inicia os gates autenticados pelo runtime standalone produzido pelo Next,
  igualando o caminho de execução local ao empacotamento da imagem Docker.
- Mantém fixtures sintéticas, limpeza comprovada e negação de papéis
  aposentados, sem reduzir testes ou criar exceções na CI.

## 2026-10-06 - Revalidação de escopo na edição em lote

- Revalida o escopo administrável depois de bloquear o perfil alvo, impedindo
  que uma mudança concorrente de escopo produza exceção ou auditoria com uma
  decisão de autorização anterior.
- Mantém a checagem anterior ao lock contra oráculos de metadados e preserva a
  compatibilidade do schema produtivo legado, onde o helper de escopo ainda
  não existe.
- Adiciona contratos Vitest e pgTAP para exigir as duas validações na ordem
  correta e uma prova concorrente local com resultado `42501`, zero override e
  zero auditoria.
- Atualiza `sharp`, `source-map-js` transitivo e o SDK MCP transitivo para as
  primeiras versões corrigidas depois que advisories novos bloquearam o gate
  de auditoria da CI; nenhuma dependência nova foi adicionada.

## 2026-10-05 - Papéis por canal e permissões em lote

- Substitui as opções genéricas por Coordenador, Gerente House, Gerente Imob,
  Corretor House e Corretor Imob; papéis removidos ficam históricos, não
  atribuíveis e sem acesso herdado.
- Separa no servidor e no banco as visões Geral, Com Canal Imob e Sem Canal
  Imob. Ranking permanece nos papéis House; Canal de Parcerias fica com
  Coordenador e papéis Imob.
- Mantém Administração abaixo de Master: um Administrador não altera a si nem
  outro Administrador e os perfis operacionais não concedem permissões.
- Reformula Usuários e acessos em duas colunas, com busca, seleção de conta,
  matriz agrupada, seleção múltipla e aplicação atômica de permitir, negar ou
  restaurar o padrão.
- Adiciona RPC auditada para exceções em lote e RLS por visão do dashboard, sem
  liberar simuladores, políticas comerciais ou tabelas Qlik.
- Preserva contas legadas para reclassificação manual, sem presumir se cada uma
  pertence ao canal House ou Imob.

## 2026-10-06 - Consulta de repasse da assessoria M.A.P

- Adiciona a guia protegida Repasse sob o Dashboard para consulta exata por FID.
- Identifica claramente a assessoria M.A.P DE CAMPOS SOLUÇÕES e exibe fonte e
  data de atualização sem inventar valores ausentes.
- Consulta o datasource CSV público da planilha somente no servidor, sem cache,
  credencial Google ou nova dependência, com timeout, limite de resposta em
  streaming, validação de cabeçalhos, projeção mínima e bloqueio de FID duplicado.
- Restringe navegação e consulta à combinação explícita de papel `master` com
  `crm.partnerships.view`, repete o gate na Server Action e mantém nomes e
  motivos fora da URL.
- Inclui Repasse na matriz global de 24 rotas: Master exige `200` e link no
  cabeçalho; os outros sete perfis exigem `403` na rota direta.
- Estabiliza fontes e geometria responsiva antes das medições de overflow e Axe,
  preservando os mesmos limites e registrando somente diagnósticos sanitizados.
- Entrega formulário, carregamento, inválido, não encontrado, conflito,
  indisponibilidade e resultado responsivo nos temas Claro, Médio e Escuro.
- Não inclui migration, pacote novo, escrita na planilha ou mudança de acesso.
  O compartilhamento público foi mantido por decisão expressa do responsável;
  o RBAC do CRM não substitui a política de acesso da origem externa.

## 2026-10-06 - Associativo publicado

- Publica o saldo com anuais, as ajudas simplificadas, a retirada dos rotulos
  solicitados e o brilho documental continuo no runtime `a89a93c0`.
- CI integral, imagem imutavel, backup/CAS/rollback e health/guards aprovados.
- Preserva motores financeiros, dados, autorizacao e trabalho paralelo na VPS.
- Registro posterior de evidencias, sem nova alteracao de runtime.

## 2026-10-06 - Dependencias corrigidas para a publicacao

- Atualiza Sharp para 0.35.5, source-map-js para 1.2.2 e o SDK MCP do Next
  DevTools para 1.31.0, corrigindo tres alertas altos sem excecoes de auditoria.
- Preserva Node 24.19.x, pnpm 11.20.x e os limites dos MCPs locais.

## 2026-10-05 - Saldo e comunicacao do Associativo

- Desconta as anuais digitadas no campo Saldo parcelado e explica a diferenca
  para a base de reajuste e o Pro-Soluto, preservando os motores financeiros.
- Remove os tres rotulos indicados do cabecalho do Associativo.
- Simplifica ajudas e corrige a passagem do brilho entre os cards documentais.
- Isola a medicao visual do brilho sem desativar efeitos na aplicacao.
- Mantem a camada de pintura e mede seu interior arredondado, sem ruido dos cantos.
- Preserva a atualizacao de canvas concorrente na integracao do Associativo.
- Remove o aside vazio e atualiza o QA de geometria para o cabecalho sem rotulos.
- Revisa e atualiza 11 capturas integradas do Associativo; preserva os temas da main.
- Validacao integrada e publicacao concluidas em 06/10/2026.

## 2026-10-05 - Calibracao dos temas Claro, Medio e Escuro

- Diferencia as tres aparencias por luminosidade: Claro branco e limpo, Medio
  cinza-azulado e Escuro navy, preservando a identidade azul/ciano aprovada.
- Centraliza superfícies, textos, bordas, foco, destaques e estados nos tokens
  semanticos, com contraste AA verificado para texto normal.
- Remove a paleta escura fixa de Ranking, Canal de Parcerias e Configuracoes;
  essas paginas agora respeitam de fato o tema selecionado.
- Mantem os tons locais aprovados dos simuladores, inclusive o dourado do
  Associativo, e corrige o texto secundario do cabecalho de Documentacao.
- Nao altera rotas, dados, motores, autenticacao, RBAC, APIs, RLS ou schema.
- Adiciona contrato automatizado das paletas e atualiza as referencias visuais
  somente depois da matriz autenticada completa e da revisao das capturas.

## 2026-10-04 - Recurso MKT

- Adiciona Recurso MKT em Configuracoes, no padrao visual da Tabela Associativo.
- Inclui fundo de Marketing, custo por venda, expectativa, distribuicao por
  Corretor/Gerente/Regional/Diretor e todos os destinos do print de referencia.
- Recalcula valores locais preservando centavos e percentuais; permite restaurar
  os valores iniciais e explicita entradas invalidas.
- Amplia a matriz E2E de autorizacao para a nova rota, mantendo os nove perfis.
- Explicita o nome acessivel dos atalhos de Configuracoes para navegacao assistiva.
- QA da guia verifica a transicao de rota antes de conferir valores e temas.
- Matriz visual do menu Configuracoes inclui o quinto link Recurso MKT.
- Atualiza somente oito referencias revisadas de Configuracoes apos os gates
  funcionais; preserva as outras 201 imagens e os limiares de comparacao.
- Integra os canvases publicados pelo PR #154 e revisa novamente as oito
  referencias afetadas, preservando a nova composicao e os gates de densidade.
- Publica a guia no runtime `edbfcd13` apos CI integral, backup, CAS e smoke;
  registra a prova de publicacao sem nova alteracao de runtime.

## 2026-10-05 - Sequencias do Associativo publicadas

- Publica os ajustes de brilho, sequencias, filtros, loops e posicionamento do
  dolar no runtime `e1ab14a8739153c56081e4f36a76e99f80fed8b2`, apos CI integral.
- Confere a jornada autenticada e a preservacao dos dados ao trocar unidade.
  Nome cadastrado aparece inteiro; conta sem nome valido continua com Conta,
  aguardando informacao e autorizacao do titular, sem deducao pelo email.
- Registro posterior de evidencias, sem nova alteracao de runtime.

## 2026-10-05 - Correcao integral da paridade dos canvases

- Corrige a causa da divergencia entre os canvases aprovados e a aplicacao: o
  gate agora relaciona as 22 rotas a referencias externas versionadas e limita
  a densidade desktop, em vez de aprovar apenas uma captura da propria tela.
- Ajusta Dashboard, cinco etapas, Ranking, Canal, Configuracoes/metas,
  Simulacao e Administracao as composicoes aprovadas, mantendo uma unica navbar.
- Preserva dados reais, estados indisponiveis, guards, RBAC, APIs e RLS. CAIXA
  conserva motor e CTA bloqueados; nenhuma regra comercial foi presumida.
- Mantem alvos de toque, teclado, foco, tres temas, reduced-motion e reflow
  responsivo. Nenhuma migration ou alteracao remota de dados faz parte do diff.
- Integra a pagina Recurso MKT ja publicada na `main`, preservando seu guard e
  sua matriz propria; atualiza somente as referencias de Configuracoes afetadas
  pelo novo card, sem ampliar o contrato original dos 22 canvases.

## 2026-10-04 - Sequencias visuais do Associativo

- Afina e desacelera o brilho sincronizado; adiciona sequencias no imovel,
  parcelas e resumo financeiro, com movimento reduzido respeitado.
- Guias e botoes de pagamentos opcionais habilitados recebem reflexo continuo;
  filtros recebem o mesmo reflexo no hover e no foco.
- Move o dolar para o espaco externo ao resumo, na altura da ultima data.
- Remove a faixa de breadcrumb apenas no Associativo e exibe o primeiro nome
  cadastrado no menu da conta, sem reticencias.
- Ajusta a altura dos menus mobile quando o nome completo amplia o cabecalho,
  mantendo o ultimo item acessivel dentro da tela.
- Aproveita o espaco disponivel no desktop para reduzir quebras de nomes longos.
- Preserva o erro original dos testes E2E quando a limpeza do navegador falha.
- Impede que nomes longos comprimam a navegacao sobre os botoes de tema.
- Atualiza 173 referencias visuais revisadas e preserva as 36 ja aprovadas,
  apos gates funcionais verdes; validacao integral e publicacao continuam
  obrigatorias, sem alterar os limiares de comparacao.

## 2026-10-04 - Dados oficiais e brilho integral no Associativo

- Explicita dados ausentes da unidade antes do perfil e permite informar o
  percentual oficial da obra para esta simulacao, sem presumir valores.
- Mantem calculos independentes e impede aprovacao quando falta base obrigatoria;
  dados manuais especificos do imovel nao sao transferidos ao trocar unidade.
- Amplia testes de recuperacao, isolamento por unidade e matriz de calculos.
- Completa fatos ausentes apos a chegada tardia da fonte compativel, sem trocar
  a proposta; exige identidade unica e entrega igual. Datas inexistentes sao
  rejeitadas nos motores Linear e Decrescente.
- Brilho integral de 3s, selecoes com gradiente horizontal, reflexo nos controles
  do Associativo e dolar junto da ultima data, com alvo de toque preservado.
- Publicado no runtime `f4dec82249c2b3e56beaaea518ec194ced81b480` (PR #147),
  com CI Linux e conferencia pos-publicacao aprovadas. Dados oficiais ausentes
  na origem continuam explicitamente pendentes, sem substituicao por estimativas.

## 2026-10-04 - Paridade visual dos canvases protegidos

- Aplica a composicao visual aprovada as 22 rotas protegidas, com uma unica
  navbar global em Dashboard, cinco etapas, Ranking, Canal de Parcerias,
  Configuracoes e metas, Simulacao e Administracao.
- Mantem dados reais quando existe fonte validada e apresenta estado
  indisponivel quando ela falta, sem transformar numeros ilustrativos dos
  canvases em registros, metas ou resultados comerciais.
- Libera a rota protegida da CAIXA somente para conferencia visual. Motor,
  endpoint de calculo, envio, analise de credito e aprovacao bancaria continuam
  bloqueados de forma independente e fail-closed.
- Uniformiza densidade, hierarquia, paineis e estados nos temas Claro, Medio e
  Escuro, com reflow responsivo, foco visivel, teclado, reduced motion e
  contratos de acessibilidade preservados.
- Corrige o roteiro QA de continuidade do Associativo para aguardar cada campo
  habilitado e persistido antes de avancar; campo vazio passa a ser ausencia,
  nao zero. Valores do cenario e regras financeiras permanecem inalterados.
- Promove a baseline revisada de 209 imagens a partir da arvore limpa em
  `a4c1717`, apos 154 checks responsivos, 88 de tema, 209 de acessibilidade,
  209 comparacoes, 110 de zoom e 40 combinacoes da navegacao aprovados. Gates
  finais, CI e publicacao deste incremento continuam separados desta promocao.
- Atualiza o smoke de release para distinguir acesso a pagina CAIXA de execucao
  do motor: Master abre a composicao visual pelo Hub e menu, enquanto o CTA e a
  API de calculo permanecem fail-closed. Demais perfis continuam negados.
- Publicado no runtime `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`
  apos PR #148 e CI integral do `main`. Imagem imutavel, backup, CAS, health,
  negacao anonima, headers e smoke HTTP foram aprovados; nenhuma migration,
  alteracao de dados, Nginx ou DNS foi executada.

## 2026-10-04 - Calculo e continuidade no Associativo

- Preserva perfil e composicao financeira ao trocar a unidade ou editar renda
  e modalidade; recalcula preco, entrega e enquadramento sem apagar respostas.
- Separa comprometimento da renda de evolucao de obra. Dados desconhecidos
  aparecem como indisponiveis, nunca como zero nem aprovacao conclusiva.
- Enriquece avaliacao, andamento e entrega a partir de referencia unica da
  unidade; preserva valores vivos e recusa correspondencias ambiguas.
- Amplia o brilho dourado para a area pendente em 4,5s, remove sublinhado,
  destaca escolhas do perfil em dourado e alinha resumo, valores e icone dolar.
- Inclui reflexo especular nos botoes do Associativo, com limites de foco,
  contraste, controles desabilitados e preferencia por movimento reduzido.
- Alinha o E2E concorrente ao perfil persistente, exigindo recalculo dos dois
  comprometimentos sem reconfirmar escolhas e preservando isolamento entre usuarios.
- Publicado no SHA `106d626` apos PR #145 e CI completa; verificacao de versao,
  protecao anonima e continuidade na pagina publicada aprovadas.

## 2026-10-04 - Navegacao protegida unificada

- Usa um unico cabecalho hierarquico em Dashboard, etapas, Ranking, Canal,
  Configuracoes, Administracao e todas as jornadas de Simulacao.
- Remove as barras internas dos simuladores e mantem links filtrados pelas
  permissoes efetivas; CAIXA continua visivel como bloqueada e sem rota clicavel.
- Preserva temas, conta, teclado, mobile e alvos de 44px. A matriz visual agora
  cobre as 21 paginas liberadas, inclusive Documentacao.
- Exige truncamento da identidade em todas as larguras e rejeita capturas fora
  do manifesto; baselines antigas da CAIXA bloqueada foram eliminadas.
- Mantém provas E2E contextuais e independentes para o card e o submenu
  bloqueados da CAIXA, sem transformar nenhum deles em link.
- O smoke exige ausencia da navegacao comercial para perfis sem paginas e usa
  a identidade propria de `/conta/seguranca` nesses casos.
- A prova hospedada do Tabelao agora verifica separadamente a regiao nomeada e
  a tabela interna, preservando a semantica acessivel do componente.

## 2026-10-04 - Ajustes do Associativo publicados

- Publica 7337b97 com campos sem contorno, brilho dourado de 3s nas duas
  extremidades da linha, dolar externo e reprovacao vermelho-sangue metalica.
- CI, imagem imutavel, backup, health e jornada autenticada conferidos.
  Tabelao e regras financeiras preservados; dependencia de lint corrigida
  pela base ja integrada. Registros posteriores nao reiniciam a aplicacao.

## 2026-10-04 - QA de impressao sem leitura antecipada

- Aguarda o layout de impressao estabilizar antes da verificacao, com limite
  de cinco segundos e todos os criterios preservados. Sem mudanca na pagina
  Tabelao ou necessidade de reinicio da aplicacao por este ajuste de ferramenta.

## 2026-10-03 - Navegação protegida unificada

- Substitui os cabeçalhos internos dos simuladores por um único cabeçalho
  hierárquico para todas as páginas autenticadas.
- Mantém os links derivados das permissões efetivas no servidor; simuladores
  liberados exigem o mesmo gate de rota e a CAIXA permanece bloqueada sem link.
- Reúne identidade, segurança, administração autorizada, temas e logout na área
  de conta, com navegação responsiva, teclado, foco e movimento reduzido.
- Preserva URLs, autenticação, guards, RLS, dados e regras comerciais existentes.

## 2026-10-03 - Validacao do brilho no CSS minificado

- Corrige o QA para reconhecer 0px e 0% como o mesmo topo da linha, mantendo
  duas faixas de 2px nas extremidades e ciclo de 3s. Sem alteracao de runtime.

## 2026-10-03 - Integracao da correcao de lint no Associativo

- Incorpora a base db1b625, incluindo a remocao de braces ja validada no PR #139.
- Preserva os ajustes visuais do Associativo e o Tabelao publicado; revalidacao
  combinada e publicacao do PR #141 em andamento, sem dispensar gates.

## 2026-10-03 - Brilho e alerta de reprovacao no Associativo

- Remove o contorno dos campos e a moldura dourada fixa da linha ativa.
- Mantem o fundo do tema e percorre o topo/rodape da linha com brilho de 3s.
- Posiciona o dolar de 17px fora do resumo, a direita da ultima data.
- Destaca reprovacao em vermelho-sangue metalico, com brilho de 3s no alerta
  e texto branco legivel. Respeita navegacao por teclado e reduced motion.
- Preserva calculos, sequencia e Tabelao; publicacao pendente dos gates.

## 2026-10-03 - Tabelao publicado e verificado

- Publica o PR #139 na versao 8e158cc e confirma layout, Maps, colunas,
  valores dourados e recursos na pagina autenticada de producao.
- Politica comercial permanece visivel, desabilitada e sem destino.
- Registro posterior somente documental, sem novo deploy ou restart.

## 2026-10-03 - Referencias revisadas do Tabelao

- Atualiza somente 11 capturas do Tabelao para o layout solicitado, mantendo
  outras 182 imagens e os limiares de comparacao.
- CI aprovou os testes funcionais, banco, restore e auditoria sem vulnerabilidades.

## 2026-10-03 - Dependencias de lint sem braces

- Substitui o buscador de diretorios do plugin Next por tinyglobby, com patch
  versionado e testes de compatibilidade. Mantem todas as regras de lint.
- Remove a cadeia vulneravel do lockfile e inclui patches no build Docker.
- Testes da regra mantem verificacao estrita de resultados presentes e validos.

## 2026-10-03 - Estado da politica comercial do Tabelao

- Confirma por solicitacao do usuario que Politica comercial permanece visivel,
  desabilitada e sem redirecionamento. Nenhum destino e necessario nesta entrega.
- A auditoria bloqueava a publicacao naquele momento; cadeia removida nesta data.

## 2026-10-02 - Layout e enderecos do Tabelao

- Compacta o cabecalho e alinha o icone de informacao ao titulo.
- Reordena colunas e destaca o valor do imovel em dourado.
- Adiciona links Google Maps aos enderecos da origem oficial existente.
- Inclui recursos finais com icones e impressao da consulta completa.
- Mantem textos legiveis e dourado de alto contraste na impressao dos tres temas.
- Politica comercial permanece desabilitada e sem destino, conforme confirmacao.

## 2026-10-02 - Contorno dourado no Associativo

- Escurece o dourado metalico da unidade selecionada.
- Remove os fundos dourado e escuro dos campos de edicao; conserva a paleta
  da pagina, com contorno dourado e linha de brilho a cada tres segundos.
- Mantem sequencia, acessibilidade, erros e calculos sem alterar o Tabelao.

## 2026-10-02 - Associativo com as cores do Tabelao

- Alinha fundo, paineis, campos, bordas e textos a paleta existente do Tabelao.
- Mantem selecoes e proximas acoes em dourado metalico, com brilho de 3s.
- Tabelao, temas compartilhados, layout e calculos permanecem inalterados.
- Atualiza duas referencias escuras revisadas; demais 191 preservadas.
- Publicado em 150b771 apos CI integral e verificacao da pagina no ar.

## 2026-10-02 - Titulos legiveis e texto compacto no Tabelao

- Atualiza sete referencias visuais revisadas; demais 186 capturas preservadas.
- Reduz a fonte da tabela para 11px e mantem os titulos completos na mesma linha.
- Troca Incorporadora por Empresa e aplica caixa de frase aos titulos e descricoes.
- Compacta Planta com quebra de linha e corrige acentos na apresentacao,
  preservando nomes proprios, siglas, filtros e todos os valores do estoque.

## 2026-10-02 - Associativo em azul noturno e dourado metalico

- Escurece o tema escuro para azul proximo do preto, com superficies distintas.
- Substitui os destaques prateados por dourado metalico, preservando o brilho
  de tres segundos enquanto a acao estiver pendente e a acessibilidade.
- Sem alteracoes nos calculos, nas etapas ou nas outras tabelas.
- Duas referencias visuais escuras revisadas; outras 191 capturas preservadas.
- Publicado no PR #134, runtime d79bf8c, com CI integral e verificacao ao vivo.

## 2026-10-02 - Regioes ordenadas no Tabelao

- Sete referencias visuais revisadas para a nova geometria e rotulo territorial;
  demais 186 capturas e criterios de aprovacao preservados.
- Reconcilia logradouros divergentes por CODLOG oficial via GeoSampa HTTPS,
  resolvendo os dois conflitos atuais sem tabela fixa de empreendimentos.
- Mostra regioes em letras verticais eretas; compacta as 14 colunas com texto
  integral e fonte de 12px e acompanha a rolagem com o cabecalho original.
- Agrupa as opcoes por Zona Leste, Sul, Norte, Oeste e Centro, com empreendimentos
  alfabeticos e precos crescentes dentro de cada empreendimento.
- Substitui o rotulo territorial antigo por estados distintos de consulta e
  indisponibilidade, preservando a verificacao da origem sem inferir zonas.
- Repete uma vez lotes com falha transitoria de transporte, sem aumentar chamadas
  simultaneas e sem repetir pedidos negados ou respostas contraditorias.

## 2026-10-02 - Validacao da documentacao

- Preserva a atualizacao paralela de identidade/cabecalho e suas referencias ao
  integrar a main, sem substituir capturas das outras paginas pelas antigas.
- Atualiza somente sete referencias visuais do hub para a documentacao disponivel,
  apos revisao das capturas autenticadas; preserva 186 imagens e os limiares existentes.
- Corrige a expectativa antiga de item desabilitado na matriz responsiva do menu.
  A matriz dedicada da calculadora passou tambem no navegador autenticado da CI.
- Atualiza E2E de autorizacao e menu para a guia liberada, sem abrir acesso a outros
  perfis ou habilitar o motor oficial WF16; preserva CAIXA bloqueada.
- Registra matriz local aprovada em tres temas e quatro larguras, com impressao e
  layout equivalente a zoom 200%; CI e publicacao acompanhadas no PR #130.
- Corrige classes dos estados sequenciais e recorte interno ao redimensionar a nova
  guia; reforca contraste e verificacao de geometria/zoom sem mudar formulas.

## 2026-10-02 - Calcular documentacao

- Habilita Calcular documentacao no menu Simulacao e na rota protegida existente.
- Reproduz integralmente formulario, etapas, ajudas, alertas, resultado, composicao,
  plano de parcelas, impressao e auditoria da pagina de referencia do usuario.
- Reutiliza as regras locais existentes, conferidas contra 2.048 casos da referencia,
  sem alterar formulas, publicar politicas ou acionar workflows.
- Acrescenta testes de limites, permissao e uma matriz de navegador dedicada.

## 2026-10-02 - Associativo prata e perfil sequencial

- Publicado com verificacao de producao, imagem imutavel e backup conferido.
  Fechamento documental sem alteracao adicional de runtime.
- Substitui o destaque dourado por prata metalizado, com brilho a cada tres
  segundos somente durante a acao pendente e respeito a movimento reduzido.
- Exige confirmar a modalidade entre renda e primeiro imovel, sem alterar
  enquadramento, regras comerciais ou calculos.
- Usa fundo #001C54 e paineis #002774 no tema escuro do Associativo.
- Compacta o cabecalho compartilhado e integra o D fornecido ao nome sem ponto.
- Iguala o vao central e as margens do fluxo; separa Linear e Decrescente com
  duas linhas e posiciona o simbolo de remuneracao junto da ultima data.
- Reorganiza resumo e aprovacao no celular, com rotulos completos por regra.
- Atualiza 44 referencias visuais das tabelas compartilhadas apos revisao,
  preservando as demais referencias e os criterios dos gates.

## 2026-10-02 - Consulta fria das regioes

- Ajusta os lotes de CEP a capacidade do servidor para evitar regioes ausentes
  por fila ocupada na primeira abertura, mantendo resultados progressivos.
- Valida a carga fria com paginas simultaneas e preserva o registro da release anterior.

## 2026-10-01 - Regioes e vagas no Tabelao

- Adiciona Regiao na primeira coluna, com consulta automatica por CEP e fontes
  de municipio, distrito e regiao; casos ambiguos permanecem nao confirmados.
- Separa os menores valores e o estoque por empreendimento, planta e vagas,
  com coluna e filtro de vagas, distinguindo zero de quantidade desconhecida.
- Preserva compactacao, textos completos, centralizacao e Endereco apos Empreendimento.
- Protege e limita as consultas de localizacao, sem bloquear o estoque.
- Atualiza sete referencias visuais revisadas, sem mudar as demais rotas.
- Preserva o guia atualizado do Associativo na integracao com a main.

## 2026-10-01 - Titulos e colunas do Tabelao

- Igualar a fonte dos cabecalhos ao tamanho das linhas, preservando a compactacao.
- Mover Endereco para depois de Empreendimento e centralizar textos e valores.
- Preservar quebras de linha, agrupamentos, filtros, plantas e valores distintos.
- Atualizar sete referencias visuais revisadas do Tabelao, preservando as demais.

## 2026-10-01 - Orientacao dourada no Associativo

- Disponivel em producao desde 02/10, runtime integrado 598e1171; PR #126.
- Destaca uma pergunta ou campo por vez com acabamento dourado metalizado.
- Corrige contornos excedentes e iguala os campos monetarios e de quantidade.
- Afasta a renda da borda, separa Linear dos blocos decrescentes e realca o $.
- Amplia levemente os botoes no hover, sem movimento quando reduzido no sistema.
- Preserva o alvo de toque de remuneracao sem translacao legada no celular.
- Usa % Maximo da renda mensal no painel, manual e FAQ; calculos preservados.

## 2026-10-01 - Associativo compacto e manual completo

- Publica f1d71da8 e confirma a pagina online nos tres temas.
- Reduz espacos da tela inicial, contornos duplicados e sombras dos paineis.
- Ajusta o guia a largura do texto e restaura o destaque dourado metalizado.
- Organiza o manual por assunto com as 43 perguntas do material fornecido,
  distinguindo referencias contratuais, exemplos e regras da pagina.
- Preserva os tres temas, dez unidades visiveis e os calculos existentes.
- Atualiza onze referencias visuais revisadas, somente do Associativo.

## 2026-10-01 - Rodape alinhado disponivel na web

- Publica a release 5878c3b com o contato da direita alinhado ao aviso da esquerda.
- Confirma desktop e celular sem sobreposicao, preservando estoque, temas e regras.

## 2026-10-01 - Rodape do Associativo alinhado

- Sobe o texto de contato da direita para a mesma linha inicial do aviso da esquerda.
- Preserva a leitura no celular, os tres temas e as regras da simulacao.

## 2026-10-01 - Filtros compactos disponiveis na web

- Publica de72d1b: selecao dourada, guia compacto, ajudas alinhadas e Limpar
  filtros no cabecalho, com menos espacos vazios e sem rotulos redundantes.
- Confirma a pagina online, preservando dez linhas, temas e regras financeiras.

## 2026-09-30 - Estoque e filtros mais compactos

- Atualiza onze referencias visuais revisadas do Associativo, sem mudar as demais.

- Evita sobreposicao do guia da proposta ao abrir uma unidade no tablet.

- Mantem o texto do guia em uma linha tambem no tablet com a fonte real.

- Atualiza a regressao autenticada para exigir o novo cabecalho sem rotulos extras.

- Restaura dourado na unidade selecionada e alinha as ajudas aos titulos.
- Remove rotulos redundantes e aproxima o botao do guia da linha do menu.
- Move Limpar filtros para o cabecalho e reduz os espacos vazios do estoque.
- Mantem os tres temas, dez unidades visiveis e o funcionamento da simulacao.

## 2026-09-30 - Topo compacto disponivel na web

- Publica 843fd11: titulo e Guia completo proximos da linha do menu.
- Confirma botao menor e guia funcional, preservando cores e regras do sistema.

## 2026-09-30 - Topo do Associativo mais proximo ao menu

- Atualiza onze referencias visuais revisadas do Associativo, sem alterar as demais.
- Aproxima o titulo e o Guia completo da linha inferior do menu.
- Reduz a altura do botao Iniciar passo a passo e os espacos do bloco.
- Preserva cores, tamanho do titulo, acesso por toque e regras do simulador.

## 2026-09-30 - Compactacao disponivel na web

- Publica os quatro ajustes do Associativo na release d9c2bee.
- Confirma dez unidades visiveis, destaque dourado, cabecalho compacto,
  temas somente com texto/icones e titulo reduzido, preservando as cores.
- Inclui foco resiliente do menu e patch de seguranca Next.js 16.3.6.

## 2026-09-30 - Interface mais compacta

- Atualiza 44 referencias visuais revisadas dos simuladores, preservando as demais.
- Corrige foco do menu ao alternar entre larguras mobile e desktop.
- Atualiza Next.js para 16.3.6 para atender a correcao de seguranca do gate.
- Associativo exibe dez unidades por vez e destaca a linha em dourado no mouse/teclado.
- Reduz espacos verticais do cabecalho e tamanho do titulo do Associativo.
- Seletor de temas mostra apenas texto e icones, com tema ativo sublinhado.
- Mantem estoque completo, tres paletas atuais e regras da simulacao.

## 2026-09-30 - Temas azuis disponiveis na web

- Publica a correcao na release b55fa6f e verifica Claro, Medio e Escuro no site.
- Confirma o fundo azul-marinho original, sem os destaques verdes anteriores.
- Mantem layout, calculos e controles; registra testes, backup e rollback.

## 2026-09-30 - Correcao das cores dos temas

- Restaura o fundo azul-marinho original do modo Escuro.
- Substitui verdes por azul na marca, destaques e estados dos tres temas.
- Preserva layout, funcionamento e calculos dos simuladores.
- Atualiza 44 referencias visuais revisadas, preservando as demais 149.

## 2026-09-30 - Nova identidade disponivel na web

- Publica cabecalho renovado e Claro, Medio e Escuro nos quatro simuladores.
- Confirma menu, temas e carregamento do estoque em producao na release 2c002df.
- Registra validacao, backup e rollback, sem alteracao de regras financeiras.

## 2026-09-30 - Correcao da dependencia de desenvolvimento

- Atualiza brace-expansion nas duas linhas utilizadas por ESLint/minimatch,
  corrigindo alertas de recursao e consumo excessivo de CPU antes do deploy.
- Mantem os gates de seguranca e verifica a compatibilidade com o build do CRM.

## 2026-09-30 - Referencias visuais da identidade

- Registra 44 capturas revisadas dos quatro simuladores, nos tres temas,
  desktop, tablet e celular; preserva as demais referencias e limites de QA.

## 2026-09-29 - Nova identidade nos simuladores

- Nova marca Descomplica sem subtitulo, cabecalho compacto e navegacao com icones.
- Menu recolhivel no celular e acesso direto aos tres temas de aparencia.
- Escolha do tema salva apenas com consentimento para preferencias funcionais.
- Validacao de temas aguarda a cor renderizada, com diagnostico incremental.
- Menu mobile permanece clicavel quando o atalho de cookies esta visivel.
- Corrige largura dos temas em tablets e separa Limpar filtros dos campos da Direta mobile.

## 2026-09-29 - Colunas compactas do Tabelao

- Compacta Empreendimento, Endereco e Limitador com quebra de linha e texto integral.
- Unifica enderecos e limitadores consecutivos iguais dentro de cada empreendimento.
- Preserva plantas, quantidades, valores distintos, filtros e ordenacao.
- Mantem a borda e a rolagem da grade dentro do painel em telas estreitas.
- Atualiza somente as sete referencias visuais afetadas, apos inspecao da CI.

## 2026-09-29 - Topo mais direto no Associativo

- Remove textos repetidos acima do titulo do simulador.
- Fecha os espacos excedentes sem alterar o restante da pagina.
- Atualiza somente as referencias visuais afetadas em desktop, tablet, celular e temas.

## 2026-09-28 - Robustez do carregamento do Tabelao

- Contem tentativas repetidas quando a fonte de estoque esta indisponivel.
- Encerra consultas travadas e permite recuperar o carregamento.
- Evita complemento de enderecos desnecessario e rejeita dados malformados
  antes que interrompam a tela.
- Preserva autorizacao individual, isolamento dos filtros e regras comerciais.

## 2026-09-28 - Explicacoes do Associativo

- Explica a renda nos indicadores, as finalidades de MCMV/SBPE e o impacto de
  primeiro imovel, preco e avaliacao na estimativa documental.
- Inclui guia de 27 topicos de informacao com local e aplicacao na pagina.
- Esclarece limites das estimativas locais e corrige textos de anuais e entrega,
  sem alterar regras, calculos ou outros simuladores.

## 2026-09-28 - Manual Associativo mais acessivel

- Destaca Politica e Perguntas com abas, icones e selecao visivel.
- Mantem cabecalho, navegacao e fechar disponiveis durante a leitura.
- Ajusta celular, teclado e tres temas sem alterar regras ou calculos.
- Preserva conteudo, fontes e comportamento dos demais manuais.
- Testes aguardam o fechamento nativo antes de conferir a limpeza da ancora.
- Impede que CSS legado sobrescreva contraste dos titulos e foco do manual.
- Matriz usa os controles de tema proprios do simulador.
- Corrige menu superior do Associativo cortado em tablets de largura intermediaria.
- Atualiza somente a referencia visual de 1024px, apos inspecao da captura da CI.
- Mantem o catalogo de QA coerente com a captura revisada e sua proveniencia.

## 2026-09-28 - Publicacao validada do Associativo

- Publica release 3d92b7a e registra evidencias de concorrencia, autorizacao,
  carregamento do estoque e validacoes de formulario em producao.
- Esclarece prova de identidade da imagem entre Docker classic e containerd.
- Preserva pendencias de fonte/autoridade comercial e limites do teste de carga.

## 2026-09-28 - Robustez e concorrencia do Associativo

- Parcelas invalidas permanecem visiveis para correcao, sem substituicao silenciosa.

- Diagnostico de QA identifica etapa da interacao sem expor logs sensiveis.

- Comprime estoque no proxy e rejeita payloads invalidos antes do cache.
- Impede enriquecimento financeiro por identificadores ambiguos.
- Corrige aprovacao de anuais invalidas, limites monetarios, parcelas extremas,
  datas de calendario, sinais e preservacao de anuais elegiveis.
- Considera evolucao em linhas de sinais/anuais sem cobrar em duplicidade.
- Acrescenta testes concorrentes e imagem imutavel produzida pela CI.
- Persiste autorizacao de publicacao automatica apos validacao neste projeto.

## 2026-09-28 - Caveman, diagnosticos locais e preservacao de propostas

- Integra Caveman Lite e Cavecrew a matriz automatica e aos sete perfis do CRM,
  com inventario das onze skills locais e verificacao de omissoes.
- Configura Next DevTools e Chrome DevTools somente para desenvolvimento local,
  com versoes fixas, navegador isolado e telemetria/CrUX desativados.
- Preserva propostas ao filtrar/limpar estoque, permite resposta viva durante
  exploracao e compartilha leitura fria concorrente do snapshot autorizado.
- Acrescenta testes de regressao sem mudar fonte, valores ou regras comerciais.
- Integra a correcao de seguranca Vitest 4.1.11 revisada no PR Dependabot #65.

## 2026-09-28 - prontidao das ferramentas de desenvolvimento

- Adiciona diagnostico local de runtime, pacotes, Chromium e CLIs de seguranca.
- Integra Codex Security ao roteamento por demanda, preservando preflight,
  aprovacoes e a distincao entre instalar uma ferramenta e conectar um servico.
- Registra instalacao verificada de Gitleaks/OSV no Windows e uso automatico
  dos recursos pertinentes, sem SDK novo, dependencia npm ou mudanca em producao.

## 2026-09-28 - agentes e memoria reutilizavel

- Busca aprendizados tecnicos por assunto entre worktrees, com fonte e limites.
- Acrescenta sete agentes e quatro skills proprios para tarefas do CRM inteiro.
- Verifica inventario de rotas e recursos na suite existente e documenta lacunas
  de configuracao, observabilidade e validacao sem alterar o runtime do CRM.

## 2026-09-27 — referências WF13 e estoque Associativo mobile

- Atualiza as oito referências canário do hub para as três jornadas atualmente
  autorizadas, sem alterar as referências das rotas de simuladores arquivados.
- Reserva duas linhas reais para os metadados e para as ações do estoque
  Associativo em telas de até 760 px, eliminando sobreposição e preservando o
  alvo mínimo de toque de 44 px em Limpar filtros.
- Atualiza somente as três referências mobile do Associativo afetadas pela
  correção; Tabelão, Direta, Investidor, dados e regras de cálculo não mudam.

## 2026-09-27 — memoria tecnica e ferramentas automaticas

- Integra notas tecnicas selecionadas com Obsidian local e historico por checkout.
- Define selecao automatica de skills/plugins e registro de aprendizados no
  AGENTS.md, preservando limites de autorizacao e dados sensiveis.
- Acrescenta comandos knowledge e hooks Git locais opcionais para sincronizar
  atualizacoes sem instalar dependencias ou plugins comunitarios.

## 2026-09-27 — alvo de toque do Associativo

- Garante 44 px em Limpar filtros no celular mesmo diante da regra compacta
  herdada e acrescenta verificacao da altura efetiva no navegador.

## 2026-09-27 — carregamento do estoque

- Inicia em paralelo as fontes do Associativo e Investidor, com cancelamento
  ao sair, preservacao do enriquecimento e da proposta em andamento.
- Reduz consultas repetidas com cache de 30 segundos no servidor e uma unica
  consulta por grupo simultaneo, mantendo autorizacao e respostas `no-store`.
- Otimiza filtros encadeados, ordenacao e renderizacao das opcoes de preco;
  melhora os estados de carregamento e registra tempos nos cabecalhos da API.
- Corrige a sobreposicao de Limpar filtros no Associativo mobile e acrescenta
  verificacao geometrica dos controles e metadados do estoque na matriz visual.
- Atualiza tres referencias visuais mobile do Associativo apos aprovacao da
  matriz completa, preservando as outras 190 imagens.

## 2026-09-26 — cabeçalhos compactos do Tabelão

- Encurta os rótulos visíveis para Entrega, Estoque, Valor Imóvel, Volta ao
  Caixa, Avaliação, Endereço, % Obra e Limitador, mantendo os nomes completos
  como rótulos acessíveis.
- Reduz literalmente 4 px nos cabeçalhos: Incorporadora passa de 8 px para 4 px
  e os outros onze passam de 10 px para 6 px; o corpo da tabela não muda.
- Preserva ordem, agrupamento, filtros, quantidade, fórmula do menor valor,
  detalhes da unidade vencedora, fonte, rota, autorização e APIs.

## 2026-09-26 — largura automática das colunas do Tabelão

- Substitui a grade fixa de 2.080 px pelo cálculo nativo de largura conforme o
  maior conteúdo real de cada coluna, preservando as doze colunas completas.
- Remove espaços horizontais artificiais e truncamento por reticências somente
  no Tabelão; o painel mantém a rolagem horizontal interna quando necessária.
- Reduz em exatamente 2 px o cabeçalho Incorporadora, sem alterar os valores da
  coluna, a densidade das linhas ou a tipografia das demais informações.
- Preserva agrupamento, filtros, quantidades, fórmula do menor valor, detalhes da
  unidade vencedora, fonte, rota, autorização e APIs.

## 2026-09-26 — detalhes completos no Tabelão

- Move Unidades para imediatamente antes de Menor valor e amplia a grade de sete
  para doze colunas, preservando agrupamento, filtros e densidade visual.
- Inclui Folga Volta ao Caixa, Valor de Avaliação Bancária, Logradouro Obra /
  Número / Bairro, Total do andamento da obra (%) e Outras descrições com os
  dados da unidade que determina o menor valor; endereço ausente pode receber
  uma referência protegida única e coerente da unidade ou do empreendimento.
- Preserva valores monetários iguais a zero, aceita somente a escala oficial de
  andamento entre zero e um e trata ausências explicitamente sem criar conteúdo.
- Mantém a fonte viva como autoridade do estoque e usa o snapshot protegido
  somente para completar endereço ausente, sem combinar registros ambíguos ou
  conflitantes, com referência visível, carga não bloqueante e falha segura.
- Identifica a data como “Estoque publicado em”, evitando apresentar a quantidade
  de uma fonte defasada como disponibilidade em tempo real.
- Adiciona largura mínima e rolagem horizontal interna para manter as doze
  colunas legíveis sem provocar overflow da página.

## 2026-09-26 — Tabelão expansivo por empreendimento

- Exibe todas as plantas em uma tabela que cresce com a página, sem rolagem
  vertical interna ou limite de linhas.
- Substitui Início pela quantidade disponível por empreendimento e planta,
  mantendo a contagem do estoque mesmo ao filtrar ou ordenar os resultados.
- Mescla incorporadora e empreendimento uma vez por grupo, com cabeçalhos
  acessíveis, sem eliminar opções ou alterar a fórmula do menor valor.
- Preserva os seis filtros; valida agrupamento e expansão acima de 60 linhas,
  inclusive após filtros e em telas estreitas.
- Atualiza sete referências visuais sintéticas após revisão e aprovação de todos
  os testes funcionais, de acessibilidade, teclado e zoom; preserva as outras 186.

## 2026-09-24 — filtros encadeados no Tabelão

- Restaura os filtros do print: incorporadora, empreendimento, região, planta,
  valor do imóvel e ordenação, com ajuda e Limpar filtros no visual existente.
- Aplica filtros e contagens às opções exclusivas, mantendo o menor líquido por
  empreendimento e planta, sem repetir por área ou usar o preço bruto.
- Preserva agrupamento por empreendimento nas duas ordens de preço; limpar e
  alterar filtros reiniciam a janela e rolagem da tabela.
- Amplia testes de combinação, contagem, preço líquido e responsividade dos controles.
- Ajusta contadores no singular e mantém rótulos acessíveis explícitos nos filtros.
- Corrige a altura do cabeçalho dos filtros no celular para preservar Limpar filtros
  sem sobreposição com os seletores e mantém os alvos de toque de 44 px.
- Atualiza dez referências visuais sintéticas após revisão e aprovação funcional
  da matriz completa, preservando outras 183 imagens e todos os limiares.

## 2026-09-24 — exclusividade por empreendimento e planta

- Corrige a seleção para uma única unidade de menor valor por empreendimento e
  pelo texto da coluna Planta, sem repetir a mesma planta por diferença de área.
- Substitui Empreendimento / Unidade por Empreendimento, exibindo somente seu nome.
  Mantém as demais colunas com os dados da unidade vencedora e todos os tipos de planta.
- Preserva a fórmula com kit, B.A. e folga em centavos e o agrupamento por empreendimento.
  Área inválida não impede a comparação; aparece como traço, sem inventar metragem.
- Atualiza regressões, auditoria independente, guia e validação visual para a nova chave.
- Sincroniza o teste de Escape com o foco assíncrono do guia, sem relaxar critérios.
- Atualiza nove referências visuais sintéticas após revisão e aprovação funcional
  da matriz completa, preservando as demais páginas e tolerâncias.

## 2026-09-24 — Tabelão agrupado por empreendimento

- Reúne as opções de cada empreendimento em sequência alfabética, com preços
  líquidos crescentes dentro do grupo e incorporadoras homônimas separadas.
- Preserva todas as combinações exclusivas de planta e área, a fórmula do menor
  valor, os dados completos e a rolagem virtual sem limite de opções.
- Ajusta a estimativa da altura de linha no desktop para incluir a borda e
  manter o posicionamento da rolagem virtual alinhado à grade renderizada.
- Atualiza dez referências visuais sintéticas do Tabelão após aprovação dos
  critérios funcionais da matriz completa e revisão das imagens, sem alterar
  tolerâncias ou referências de outras páginas.

## 2026-09-24 — Tabelão com menor valor por tipologia

- Exibe uma unidade por incorporadora, empreendimento, planta e área, mantendo
  todas as opções de tipologia e a identificação completa da unidade vencedora.
- Seleciona, ordena e mostra o valor `Valor Final Com Kit - (B.A. da Unidade +
Folga de Tabela)`, calculado em centavos, com desempate determinístico.
- Corrige os contadores, cabeçalhos e ajuda; campos inválidos não viram zero e
  linhas excluídas da comparação são informadas. Filtros permanecem removidos.
- Acrescenta testes de regras e auditoria independente da fonte; atualiza o QA
  visual para a seleção exclusiva e o guia de três passos.
- Corrige a altura do cabeçalho no celular para que contadores e data não
  sobreponham a tabela; a correção fica restrita ao Tabelão.

## 2026-09-24 — Tabelão sem barra de filtros

- Remove do Tabelão o painel “Filtros do estoque”, incluindo incorporadora,
  empreendimento, região, planta, valor, ordenação e ação de limpar filtros.
- Mantém o estoque completo somente leitura, a tabela de sete colunas, a janela
  virtual de 60 linhas, o atalho para a Tabela Direta e a ordenação padrão por
  menor valor.
- Atualiza o guia do Tabelão para não apontar para filtros ou ordenação
  removidos.
- Preserva rota, permissão, API de estoque, banco, dados, integrações e regras
  comerciais.

## 2026-09-24 — Tabelão no layout da Tabela Associativo

- Replica no Tabelão o shell, hero, guia, painel de estoque, filtros, cores,
  tipografia, densidade e rodapé da página Tabela Associativo, sem modificar a
  rota usada como referência.
- Restaura os cinco filtros encadeados e a ordenação por valor com os mesmos
  componentes e helpers do estoque, mantendo todas as unidades da fonte viva.
- Mantém a consulta somente leitura, uma linha por unidade, o atalho para a
  Tabela Direta, os estados de carregamento, vazio, erro e nova tentativa e a
  janela virtual de 60 linhas, sem mock ou fallback.
- Corrige o guia completo do Tabelão, o foco devolvido ao acionador e a grade
  virtual em telas estreitas; controles passam a respeitar alvos de 44 px sem
  causar overflow da página.
- Preserva rota, permissão, API, autenticação, banco, regras comerciais e as
  páginas Associativo e Tabela Direta.

## 2026-09-23 — Tabelão no padrão da Tabela Direta

- Remove do Tabelão a faixa de status, filtros e quatro indicadores solicitados.
- Substitui a visão resumida por todas as unidades do estoque vivo, com as sete
  colunas, fonte, tipografia e densidade de linhas da Tabela Direta.
- Mantém carregamento, vazio, erro, nova tentativa, foco visível e janela
  virtualizada de 60 linhas, sem mock nem fallback de dados.
- Preserva a rota, permissão, API e a página de Tabela Direta sem alterações.

## 2026-09-23 — Tabelão integral no CRM

- Publica a réplica completa do Tabelão em `/app/simulacao/tabelao`, mantendo a
  referência pública somente como fonte de conhecimento e sem alterá-la.
- Conecta o item Tabelão do menu à nova rota protegida por
  `crm.simulators.view`, com guard no Proxy, layout, página e API de estoque.
- Registra a rota como réplica arquivada no shell protegido, evitando cabeçalho
  e breadcrumb globais duplicados sobre a composição original.
- Preserva busca, filtros, ordenação, resumo, tabela desktop, cartões mobile,
  três temas e estados de carregamento, vazio, erro, atualização e desabilitado.
- Corrige contraste de breadcrumb, títulos, conteúdo dos cartões e banner de
  cookies nos três temas; elimina o aviso esperado de hidratação causado pela
  aplicação inicial do tema e o overflow do cabeçalho/tabela em tablets.
- Mantém o estoque real em `GET /api/inventory`, sem mock ou fallback, e garante
  uma linha por empreendimento + planta com o menor preço positivo disponível.
- Não altera banco, migration, papel, permissão, regra comercial, integração,
  fonte pública ou ambiente de produção.

## 2026-09-22 — acabamento visual da Tabela Investidor

- Interrompe as divisórias verticais entre as quatro opções de cada plano, com
  respiro superior e inferior igual ao padrão visual da Tabela Direta.
- Reduz a altura, os controles e a tipografia do fluxo editável para a mesma
  densidade do livro-caixa usado como referência, preservando todas as linhas.
- Compacta o cabeçalho da proposta selecionada, inclusive título, explicação e
  ação de fechar, sem ocultar a composição comercial.
- Corrige a organização do guia em telas estreitas e mantém alvos de toque,
  foco visível e leitura sem overflow da página.
- Limita todo o refinamento à Tabela Investidor; a Tabela Direta e os cálculos,
  dados, regras, rotas e integrações permanecem inalterados.

## 2026-09-22 — composição compacta e completa na Tabela Investidor

- Reduz a altura dos oito cartões de proposta para 88 px, mantendo as quatro
  opções de 18 parcelas na primeira linha e as quatro de 24 parcelas na segunda.
- Compacta o cabeçalho de “Proposta calculada” e aplica aos cartões a leitura
  segmentada da Tabela Direta, sem retirar títulos ou condições comerciais.
- Ao selecionar uma unidade, conduz a visualização para os planos prontos; ao
  selecionar uma opção, conduz para a composição completa centralizada.
- Substitui o resumo horizontal da opção aberta pelo livro-caixa já usado como
  referência visual na Tabela Direta, preservando entrada, sinais,
  intermediárias, saldo, quantidade de parcelas, datas e fechamento monetário.
- Substitui os seis cartões altos do fluxo editável por um livro-caixa central,
  com ações para inserir sinal, intermediária e desconto e resultado anunciado.
- Remove o painel redundante “Resultado da proposta” e move ajuda, documentos,
  impressão, Bora Vendas e Salesforce para uma barra horizontal antes da
  auditoria do cálculo.
- Limita a mudança à rota da Tabela Investidor; a Tabela Direta, suas regras e
  seus componentes não foram alterados.

## 2026-09-21 — propostas visíveis na Tabela Investidor

- Exibe simultaneamente as quatro opções de 18 parcelas em uma linha e as
  quatro opções de 24 parcelas na linha seguinte, sem acordeões.
- Alinha a leitura dos cartões ao padrão visual da Tabela Direta, com numeração,
  resumo do ato, sinais, intermediárias e indicação textual da opção selecionada.
- Mantém os oito cenários C1–C8 e todas as regras financeiras inalterados.
- Escopa o layout à Tabela Investidor para não modificar a Tabela Direta.

## 2026-09-16 — estoque contínuo e pagamentos completos na Tabela Direta

- Remove a paginação do estoque da Tabela Direta e mantém as 3.301 unidades em
  uma única barra de rolagem interna, com janela virtual para preservar a
  resposta da seleção, filtros e ordenação.
- Exibe Sinal 1, Sinal 2 e Sinal 3 separadamente nas opções 2 e 4, com a divisão
  monetária fechando no centavo.
- Exibe cada intermediária válida em linha própria nas opções 3 e 4, preservando
  valor, ordem, data, percentual e estado de validação de cada pagamento.
- Mantém a política especial de Vaga em 10% de entrada, 40% durante a obra e 50%
  pós-chaves em até 66 parcelas; plantas comuns continuam seguindo a regra geral
  do arquivo WF14.
- Aproxima o fluxo editável da usabilidade compacta do Associativo, incluindo
  avanço por Enter, sem alterar a rota ou o comportamento do Associativo.
- Corrige foco na rolagem virtual, alvo de toque dos ícones de ajuda, overflow e
  reconciliação automatizada das linhas individuais com os totais da proposta.

## 2026-09-10 — refinamento WF14 da Tabela Direta

- Simplifica o resumo calculado para exibir somente a opção selecionada, inclui
  a ajuda contextual com a política de vaga completa e remove o rodapé
  redundante de entrada total e percentual.
- Detalha Sinal 1, Sinal 2 e Sinal 3 nas opções com entrada distribuída,
  preservando ato de 6%, sinais somando 4% e entrada total de 10%.
- Exibe somente o valor da primeira mensal pré-chaves no ledger; a memória
  completa continua disponível na ajuda e no diálogo de parcelas.
- Replica no fluxo editável o ledger compacto do Associativo com os botões
  “Inserir Sinal”, “Inserir Intermediária” e “Inserir Desconto”, respeitando
  três sinais, teto individual de 5% e datas válidas antes da entrega.
- Mantém “Inserir Anual” exclusivamente no Associativo e não altera banco,
  autenticação, permissões, rotas, APIs ou integrações.
- Corrige semântica de lista, alvos de toque em tablet, tooltip em 375 px e
  overflow responsivo do fluxo.

## 2026-09-10 — elegibilidade e largura da comissão apartada

- Conecta o canal e a classificação escolhidos em “Comissão + Prêmio da venda”
  ao popup “Proposta pronta - Bora Vender”, eliminando o estado isolado que
  ocultava a coluna apartada.
- Exibe a comissão apartada para Imobiliária Ouro, Prata ou Bronze quando a
  Entrada é maior ou igual ao valor da comissão calculada, inclusive na
  igualdade monetária em centavos.
- Amplia o popup para 900 px no resumo e 1.180 px na comparação, preservando
  leitura sem rolagem horizontal de 375 px a 1.440 px.

## 2026-09-09 — comissão apartada na proposta associativa

- Alinha o popup “Proposta pronta - Bora Vender” à densidade visual do fluxo
  editável: linhas de 23 px, texto de 10 px, bloco de descrição destacado e
  separadores do mesmo livro-caixa.
- Exibe a coluna “Comissão apartada” somente quando a Entrada alcança 6% do VGV
  e o ranking possui regra na planilha `Pasta2.0.xlsx` (Ouro, Prata ou Bronze).
- Replica no centavo comissão, prêmio, desconto, contrato, B.A., financiamento
  e conciliação do modelo apartado, mantendo vazios os valores zerados.
- Mantém a proposta faturada sem alteração abaixo do limite e reorganiza as
  duas respostas em linhas empilhadas no mobile, sem rolagem horizontal.
- Atualiza Next.js, Sharp e a resolução transitiva de `js-yaml` para versões
  corrigidas após novos avisos críticos/altos bloquearem o gate de segurança.

## 2026-09-06 — Tabela Direta integral no CRM

- Implementa a réplica completa da Tabela Direta em
  `/app/simulacao/tabela-direta`, sob autenticação e permissão já existente
  `crm.simulators.view`, sem migration, novo papel ou integração externa.
- Preserva estoque SPC, filtros, quatro opções de proposta, fluxo personalizado,
  memória pré/pós-chaves, documentação, guias, impressão e todo o conteúdo do
  artefato anexado, sem substituir dados reais por mocks.
- Corrige fechamento monetário, entrada acima do mínimo, prazo pré-chaves zero,
  datas impossíveis ou posteriores à entrega e distingue `PENDENTE`,
  `AJUSTE NECESSÁRIO`, `APROVADO` e `REPROVADO`.
- Valida o snapshot integral de 3.301 unidades e 11.948 combinações de proposta
  calculáveis, incluindo limites de sinais, intermediárias e crédito.
- Retira o snapshot comercial do HEAD atual e da imagem, monta a cópia validada em
  volume privado somente leitura e a entrega por endpoint autenticado com
  `crm.simulators.view`, sem cache compartilhado.
- Faz toda a amortização pós-chaves em centavos, quita o resíduo na última
  competência e usa na decisão de crédito o mesmo valor exibido ao usuário.
- Falha fechado quando o snapshot privado não está disponível, sem substituir
  as 3.301 linhas anexadas pelo estoque vivo; a interface informa o erro e
  oferece nova tentativa.
- Unifica o arredondamento em centavos do ato mínimo entre cálculo, auditoria e
  interface, inclusive no limite em que 6% exige arredondamento para cima.
- Preserva propostas durante filtros, confirma qualquer descarte por troca de
  unidade ou navegação e reposiciona/anuncia a paginação para teclado e leitor
  de tela.
- Imprime somente propostas aprovadas e usa a composição atual completa:
  desconto, ato, sinais e intermediárias individuais, datas, percentuais,
  limites, pré/pós-chaves, renda, status e auditoria.
- Corrige menus em tablet/intermediário e evita truncamento dos valores do
  comparativo em 375 px, sem alterar as demais jornadas do simulador.
- Mantém dados comerciais fora do CI e das capturas: a QA visual usa um estoque
  sintético efêmero de 3.301 linhas, enquanto o runtime produtivo continua
  aceitando somente o snapshot privado validado pelo SHA-256 do anexo.

## 2026-09-06 — Tabela Investidor no CRM

- Publica a réplica completa da Tabela Investidor em
  `/app/simulacao/tabela-investidor`, sob autenticação e permissão
  `crm.simulators.view`, sem alterar banco, papéis ou integrações.
- Corrige o item “Tabela Investidor” do menu para a rota protegida do CRM e
  preserva estoque SPC, filtros, oito opções, fluxo personalizado, guias,
  impressão, estados de erro e conteúdo integral do artefato anexado.
- Valida o snapshot de 3.301 unidades, exclusão de 122 vagas avulsas,
  fechamento monetário no centavo, acessibilidade e responsividade.
- Protege o endpoint e o snapshot de estoque com a permissão dos simuladores,
  carrega a referência local sem aguardar o timeout da atualização ao vivo e
  mantém a consulta remota como atualização não bloqueante.
- Eleva os alvos compactos das réplicas para 24 px no desktop e 44 px no
  mobile/tablet, removendo a exceção legada de acessibilidade do Associativo.
- Corrige o caminho vivo do checkout no runbook de produção.

## 2026-09-02

- Restaura na rota “Simulador Associativo” a página WF13 do arquivo original:
  hero, cinco blocos de entrada, resultado lateral, memória pré/pós-obra,
  anuais, auditoria, impressão e responsividade, mantendo o gate Master.
- Renomeia a jornada WF13 para “Simulador Associativo” no menu, no hub e no
  cabeçalho da página, preservando rota, cálculo oficial, gates, permissões e
  conteúdo completo do fluxo linear.
- Atualiza `browserslist` para `4.28.7`, corrigindo os avisos de segurança
  `GHSA-c83g-rgw3-j3cx` e `GHSA-73wf-gq98-2v4g` detectados pelo CI.
- Atualiza o gate de restore isolado para o plano vigente de 1.042 testes pgTAP.
- Promove atomicamente a baseline autenticada canônica para a nova nomenclatura
  mantendo o conjunto canário WF13 separado.

## 2026-09-01

- Permite múltiplas identidades Master sem criar UI, endpoint ou RPC acessível:
  remove a unicidade legada, mantém lookup indexado e bloqueia elevação pela
  hierarquia, Data API e `service_role`.
- Adiciona autorização por digest no código, runner root-only preso ao SHA e
  ledger legal vigente. Conta, senha e aceite continuam obrigatoriamente no
  fluxo normal da própria pessoa; o runner falha fechado se qualquer etapa
  estiver ausente.
- Cobre dois Masters simultâneos, escopo global, idempotência, auditoria,
  privilégios mínimos e não regressão dos demais papéis em pgTAP e Vitest.
- Atualiza somente a resolução transitiva de `browserslist` para `4.28.7`,
  eliminando duas vulnerabilidades altas publicadas após o baseline sem
  adicionar dependência ou alterar código de runtime.
- Estabiliza a competência das fixtures visuais somente no modo QA loopback,
  evitando falso drift na virada do mês; qualquer uso fora desse ambiente
  isolado falha fechado e o runtime produtivo continua usando a data real.

## 2026-08-28

- Mantém o callback direto por `TokenHash` e adiciona compatibilidade segura
  com o `ConfirmationURL` padrão do Supabase hospedado: somente auth code UUID
  v4 PKCE é trocado, e a redefinição continua exigindo assurance recente de
  recuperação. A location exata permanece sem logs de query.

## 2026-08-27

- Impede o prefetch das quatro rotas de simuladores ainda bloqueadas no canário WF13, mantendo-as identificadas como indisponíveis e sem ampliar a matriz RBAC aprovada.
- Atualiza as 12 evidências visuais específicas do canário WF13 após validar 119 rotas responsivas, 68 temas, 160 auditorias Axe e 85 checks de zoom.
- Mantém o motivo dos itens bloqueados no nome acessível sem introduzir largura mínima ou overflow em tablet e celular.
- Restringe o estilo de aba aos itens de navegação bloqueados, sem atingir a explicação próxima do CTA indisponível.

## 2026-08-18 — Hotfix WF13: limite 84 e pró-soluto

- Fixa o limite comercial em 84 no servidor e na interface somente leitura;
  remove limite e confirmação manual do payload estrito.
- Valida parcelas solicitadas como inteiro de 1 a 84, sem arredondar ou reduzir
  entradas inválidas, com erro acessível, foco e bloqueio do cálculo.
- Corrige o numerador do comprometimento do pró-soluto: anuais usam somente a
  correção inicial de 0,5%, eliminando a divergência de 10,08% para 9,88% sem
  alterar saldo, parcela, calendário ou comprometimento de renda.
- Versiona fórmula `wf13-1.3.0`, memória com numerador/denominador e regressões
  do PDF; demais motores, integrações, RBAC e flags permanecem inalterados.

## 2026-08-14 — QA remoto acompanha canário oficial

- O runner visual da homologação passa a ler, sem imprimir, somente as duas
  configurações do simulador oficial no arquivo privado root-only. Assim o gate
  reconhece WF13 ativo no canário e continua exigindo os demais motores bloqueados.

## Unreleased

- Endpoints de integrações, relay e motores explicitamente desligados passam a
  ocultar a capacidade com `404` e `no-store`, sem autenticar, ler payload ou
  acessar banco. Configuração ativa inválida e falhas reais continuam `503`,
  preservando observabilidade sem produzir 5xx no smoke default-off.
- Substitui somente as duas verificações TOTP mutáveis por um Route Handler com
  resposta vazia e cookies SSR bufferizados. Enrollment e challenge preservam
  erro inline, exigem origem canônica, payload mínimo, fator pertencente à
  sessão e token AAL2 verificado antes do commit dos cookies; elimina o POST
  Server Action que podia ativar o fator e travar durante o stream RSC. O Proxy
  posterga cookies somente nessa rota para o handler consolidar refresh,
  deleções de chunks e sessão AAL2 sem duplicação.
- Torna o smoke de revogação de senha independente da ordem dos cenários: ele
  abre uma segunda sessão Master real antes do recovery, em vez de reutilizar
  um storage state já encerrado pelo logout da matriz hospedada.
- Alinha o contrato da evidência visual ao conjunto release-enabled de 17
  páginas; as quatro URLs futuras continuam cobertas pela matriz funcional de
  21 rotas e falham fechadas, sem produzir capturas de conteúdo indisponível. A
  baseline autenticada registra checkout limpo e promoção transacional íntegra.
- Reorganiza o cabeçalho em três linhas nos breakpoints móveis para impedir
  colisão entre marca, ações, Segurança e navegação; a auditoria visual agora
  detecta também `brand×actions` e colisões entre ações.
- Atualiza a baseline autenticada somente para o catálogo produtivo de 17
  páginas, os quatro cards de simuladores release-disabled e o cabeçalho móvel.
- Torna a matriz Playwright hospedada integralmente efêmera: nove contas são
  criadas via Auth Admin apenas em memória, recebem papéis/perfis/scopes exatos
  e são removidas em `finally` com prova de ausência de sessões, fatores,
  autorização e ledger legal. Somente o Master persistente segue como fixture
  visual, restaurado antes das capturas; credenciais e identidades são omitidas.
- Converge o catálogo RBAC pelo conjunto produtivo comprovado: Master 17 páginas,
  Admin 14, seis papéis legados sete e papéis futuros/pendente zero. As quatro
  rotas excedentes WF16, CAIXA, WF14 e WF15 permanecem no inventário HTTP, mas
  saem de `app_pages` e retornam `403` antes de renderizar.
- Adiciona contrato compartilhado dos 21 paths, pgTAP por conjunto exato e E2E
  9×21; grants de permissões permanecem 20/17/4/0 e nenhuma flag ou motor muda.
- Adiciona executor root-only para a homologação com baseline exato de 29
  versões, allowlist/hashes das duas migrations Auth/MFA, dry-run fail-closed,
  backup distinto com restore isolado comprovado, lock advisory, histórico
  atômico e pós-condições RBAC/RLS/Qlik; as 17 páginas exigem navegação ativa.
- Fixa todas as inspeções Docker do smoke hospedado no socket local root-owned
  `/var/run/docker.sock`; comandos capturados usam ambiente mínimo e não herdam
  `HOME`, `DOCKER_HOST` ou `DOCKER_CONTEXT` do chamador.
- Habilita SMTP Mailpit estritamente isolado na configuração de homologação e
  amplia o gate HTTPS para recuperação de senha, MFA/AAL2 e restauração
  comprovada da conta Master/QA sintética.
- Vincula o smoke hospedado ao mesmo SHA de checkout, env privado, imagem,
  container e `/api/health`; valida mount root-only do segredo, APP_ORIGIN,
  redirects, Nginx sem query logs, ausência de 5xx/restarts e limpeza de
  sessões, fatores e mensagens sem emitir material sensível.
- Reconcilia as sete versões existentes somente no histórico remoto com markers
  sanitizados: três equivalentes canônicos, duas alterações inseguras já
  supersedidas e dois contratos legados confidenciais permanecem fora do Git.
- Substitui o preflight Master-only obsoleto por comparação exata da matriz
  herdada, bloqueando perda ou ampliação de acesso antes do smoke E2E.
- Alinha também a matriz exibida na administração aos 17 grants de Admin e aos
  quatro grants dos seis papéis operacionais; Admin conserva as 14 páginas e
  consulta metas legadas sem receber gestão de política comercial.
- Antecipada no Proxy a mesma permissão das 21 rotas versionadas, preservando
  os guards SSR/API/RLS e retornando `403` real antes de qualquer shell streamed.
- Mantém a migration Auth portável entre produção e clean install: contratos
  opcionais ausentes não são criados; quando presentes, atributos e fingerprint
  devem corresponder ao contrato aprovado antes da correção de `pg_net`.
- Adiciona inventário produtivo somente leitura e rehearsal sobre restore
  sanitizado PostgreSQL 17. O gate aplica apenas as duas migrations Auth/MFA,
  preserva os fingerprints RBAC 8/20/61/17 e mantém tabelas Qlik fail-closed.
- Torna o artefato Docker promovível: homologação e produção usam a mesma
  imagem imutável por SHA, sem configuração Supabase, origem ou flags congeladas
  no build. O contrato runtime valida ambiente antes de iniciar o Next.js.
- Move o HMAC de persistência para arquivo root-only montado read-only, com
  configuradores atômicos, wrapper Compose de argumentos estritamente
  allowlisted e falha fechada para symlink, owner, modo ou conteúdo inválido.
- Adiciona prova automatizada do mesmo image ID nos dois Compose e execução real
  dos perfis de homologação e produção sobre o mesmo digest, sem eco de segredo.
- O configurador de homologação preserva somente o gate oficial de simuladores
  já válido; combinações incoerentes, chaves desconhecidas ou duplicadas
  interrompem a escrita, sem apagar uma ativação existente.
- O wrapper root-only fixa o manifest Compose no repositório versionado e não
  aceita resolução pelo diretório corrente do chamador. Ambiente herdado é
  removido e o Docker fica restrito ao socket Unix local.
- Adiciona recuperação de senha com resposta anti-enumeração, callback fixo por
  `APP_ORIGIN`, template `TokenHash` verificado por POST/body, política forte de
  12–128 caracteres e revogação de todas as sessões após alteração. Callback falso
  preserva sessão e marker existentes; AMR `otp`/`recovery` fica em quarentena.
- Adiciona MFA TOTP com QR Code/chave manual, páginas `/mfa` e
  `/conta/seguranca` e enforcement AAL2 em SSR, APIs, RPCs e RLS quando houver
  fator verificado. Remoção AAL2 revoga primeiro as demais sessões e falha fechado.
- Torna “Lembrar neste navegador” opt-in, com marker HMAC e limite absoluto de
  30 dias; valor ausente, inválido ou adulterado mantém cookie de sessão.
- Adiciona consentimento granular de cookies, documentos legais versionados e
  ledger privado append-only de aceites de Termos e Privacidade, separado das
  preferências de cookies.
- Atualiza somente o Supabase CLI de desenvolvimento para 2.115.0, que corrige
  a resolução/reload do `content_path` de templates Auth. O callback aceita os
  formatos oficiais SHA-224 puro e `pkce_` + SHA-224, rejeitando outros prefixos.
- Torna os probes de isolamento do relay Qlik e do motor comercial herméticos
  quando o schema opcional `net` estiver ausente, sem instalar `pg_net` nem
  liberar qualquer papel dedicado.
- Atualiza o rehearsal de restore para copiar templates Auth e validar o total
  atual de 1.018 pgTAP; fonte e alvo efêmeros continuam independentes.
- Faz a conta QA visual consentir explicitamente com cookies opcionais antes da
  matriz de temas; o produto continua opt-out e sem persistência por padrão.
- Registra a matriz local dos nove perfis e 21 rotas. A reconciliação preserva
  17 páginas para Master, 14 para Admin, sete para os perfis analíticos
  herdados e nenhuma herança comercial para os quatro perfis restantes.
  Alterações permanecem locais; nenhum ambiente remoto, migration, usuário ou
  configuração foi modificado. Os resultados finais deste novo SHA serão
  registrados após a repetição integral dos gates.

- Evolui somente o WF13 para `wf13-1.2.0`: ranking obrigatório e versionado,
  comparação exata por dois limites independentes e reprovação explícita de
  `NÃO ELEGÍVEL`, sempre revalidada no servidor.
- Gera anuais automaticamente nos dias 15/12 compreendidos entre data-base e
  entrega, mantém datas somente leitura e valida cada parcela contra 50% da
  renda sem misturar correção e saldo nominal.
- Separa visualmente ato, sinais e anuais; adiciona quadro intuitivo de
  aprovação, múltiplos motivos e erros acessíveis ligados aos campos causadores.
- Versiona 30 cenários Looker × site e nove fronteiras anuais. Documenta a única
  diferença deliberada: o Looker antigo usa `<`, enquanto a regra aprovada usa
  `<=` no limite exato. PDF 2 e demais motores permanecem inalterados.
- Atualiza somente as 11 capturas sanitizadas do canário WF13 ativo para o novo
  formulário de ranking e anuais; a baseline canônica com motores desligados
  permanece separada e intacta.

- Corrige a paridade do WF13 com o PDF 2: anuais corrigidas deixam de reduzir o
  saldo nominal, a primeira mensal não avança um mês duas vezes e o caso oficial
  fecha em R$ 17.000,00, R$ 202,38, R$ 288,67 e 15/09/2026.
- Substitui aritmética monetária por centavos/frações inteiras, reconcilia os
  oito centavos residuais, restringe vencimentos a 05/10/15 e exige datas
  explícitas para sinais sem criar cobranças silenciosas.
- Adiciona memória de cálculo visível, 14 casos de calendário, regressão dos 12
  cenários anteriores e E2E do caso PDF 2; RBAC, flags, integrações e demais
  motores permanecem inalterados.
- Atualiza transacionalmente a baseline autenticada após revisar a mudança de
  altura exclusiva dos novos campos do WF13; matriz responsiva, temas, zoom,
  teclado e 192 auditorias Axe permanecem verdes.
- Atualiza somente as 11 capturas sanitizadas do canário WF13 ativo após a
  validação HTTPS do PDF 2, preservando intacta a baseline canônica bloqueada.

- Converge o gate de página do WF13 com o gate de execução já aplicado: cria
  `crm.simulators.view` em nível 100, vincula somente Master e registra apenas o
  hub e a rota WF13 no catálogo remoto ausente.
- Remove a herança visual de simuladores dos demais papéis e bloqueia overrides
  diretos dessa permissão; `simulator.wf13` continua sendo o único motor na
  allowlist, sem ativar WF16, CAIXA, WF14, WF15 ou integrações.
- Alinha as matrizes REST e Playwright ao gate Master-only: não Master recebe
  `403` antes da renderização e não encontra CTA de cálculo.
- Estabiliza o gate visual do canário WF13: a validação de formulário não depende
  de `networkidle`, e o runner local propaga explicitamente as flags do simulador
  para o runtime Next.js e para a matriz visual.
- O GET autenticado de status dos simuladores passa a representar bloqueio com
  `200` e `executionEnabled: false`, evitando erro de console esperado; o POST
  continua fail-closed e sem mudança de autorização.
- Versiona o estado visual do hub quando somente WF13 está no canário, sem
  substituir a baseline canônica em que todos os motores permanecem bloqueados.

- Corrige o canário Master do WF13 para revalidar no servidor o estado efetivo
  de flag, implementação, papel e permissão, sem depender de payload RSC aberto
  antes da ativação. O hub e a rota passam a ser dinâmicos e o endpoint de
  status é autenticado, fail-closed e `no-store`; os outros motores continuam
  bloqueados.
- Versiona a baseline visual específica do canário WF13 e mantém a baseline
  canônica bloqueada intacta; o gate escolhe o conjunto somente pela chave
  oficial conhecida e continua reprovando drift ou baseline ausente.
- Corrige o gate visual autenticado para validar o estado habilitado somente nas
  rotas de simuladores explicitamente liberadas pelas mesmas flags do runtime;
  chaves desconhecidas falham fechadas e os demais simuladores continuam
  obrigatoriamente bloqueados.
- Atualiza o override transitivo de `nanoid` para 3.3.18 após novo advisory de
  alta severidade, sem alterar dependências diretas ou runtime da aplicação.
- Implementa o motor oficial WF13 com contrato estrito, fórmula versionada,
  memória de cálculo e 12 casos de ouro extraídos da referência viva com
  diferença zero; nenhuma dependência de Salesforce, n8n ou Qlik.
- Adiciona endpoint same-origin Master-only, body limitado, telemetria sem
  payload, flags `off` por padrão, allowlist independente e UI acionável apenas
  no canário autorizado.
- Adiciona migration isolada para `crm.simulators.execute` somente no papel
  `master`, zero override, mais 7 casos pgTAP e rollback fail-closed por flag.
- Alinha o catálogo TypeScript de `crm.partnerships.view` ao gate remoto
  Master-only: nível 100, rótulo comercial em português e regressão unitária
  explícita, sem nova migration ou alteração de permissões.
- Adiciona uma migration RBAC isolada para criar `crm.partnerships.view`,
  vinculá-la somente ao papel `master` e convergir o catálogo do Canal de
  Parcerias sem aplicar a pilha pendente nem alterar outras permissões.
- Remove vínculos e overrides residuais exclusivos desse gate, eleva o nível de
  gestão para Master e adiciona pgTAP que prova menu/guard na mesma chave.
- Adiciona migration emergencial isolada que força RLS, remove policies de
  leitura e revoga privilégios diretos de `PUBLIC`, `anon`, `authenticated` e
  `service_role` nas três tabelas Qlik, sem alterar dados ou RBAC do Canal.
- Registra backup/restore exato, 28 casos pgTAP e auditoria sanitizada da janela
  de exposição; leitura permanece fail-closed e nunca será reaberta como
  rollback. O publisher legado continua exceção transitória `anon`, com
  `search_path` seguro e sem execução por `PUBLIC`, `authenticated` ou
  `service_role`, até gate separado da identidade dedicada.
- Corrige o gate visual final: topbar sem colisão com identidade longa em
  `1440×900`, CTAs habilitado/bloqueado/indisponível visualmente distintos,
  contraste navy consistente, linguagem comercial localizada e nomenclatura
  única para imobiliárias e Metas de pontos.
- Mantém motores e políticas fail-closed enquanto apresenta o bloqueio junto ao
  CTA, com cadeado e motivo visível; nenhuma fórmula ou pontuação oficial foi
  adicionada.
- Adiciona regressão browser para identidade longa e três estados de CTA, além
  de evidências reproduzíveis de login, logout, 403, 404, 500, loading, empty,
  stale e error sem persistir credenciais.
- Promove 192 capturas finais e recebe aprovação do gate visual independente,
  com P0/P1/P2/P3 iguais a zero nas 21 rotas e sem acessar a homologação viva.
- Fecha lacunas determinísticas da especificação com rastreabilidade das 21
  rotas, breadcrumbs autorizados, aprovação Master-only por escopos oficiais,
  drafts privados de metas/pontos, ranking fail-closed, estados v3 estritos e
  estrutura completa dos cinco simuladores sem incorporar regra comercial.
- Completa estruturas seguras de Dashboard e Canal de Parcerias — ritmo,
  comparativos, roster indisponível, quatro visões, período, resumos, rankings e
  conciliação — e adiciona abas, repeaters, cenários, inventário e controles
  locais aos simuladores sem motor, persistência ou exportação comercial.
- Mantém compatibilidade app-first com o schema produtivo anterior: somente a
  ausência exata das foundations novas cai para leitura legada fail-closed;
  falhas de permissão, rede e validação continuam interrompendo a operação.
- Amplia o contrato de QA visual para sete viewports, zoom de 80% a 200%, mobile
  dark e três temas nas páginas administrativas; a nova baseline só pode ser
  promovida por execução limpa e transacional, sem reutilizar dados, contas ou
  credenciais de produção.
- Distingue controles estruturais locais dos botões de cálculo bloqueados no
  gate dos simuladores e corrige contraste dos estados ativos no tema escuro.
- Comprova backup produtivo criptografado e root-only por leitura, restore
  representativo sem rede, aplicação isolada das dez migrations futuras e
  rollback limpo; nenhuma migration, flag, grant ou dado remoto foi alterado.
- Consolida os riscos P0 das migrations, o merge train #26–#33, os bloqueios de
  caller/mappings/políticas e o pacote de decisões necessário para canário,
  cutover e produção.
- Atualiza o ensaio isolado para o manifesto atual de 27 migrations e 885 casos
  pgTAP distribuídos em 18 arquivos.
- Atualiza o contrato unitário da baseline promovida para preservar e validar o
  diagnóstico do baseline anterior sem tratar mudanças intencionais como drift
  do baseline novo.
- Alinha o E2E de permissões aos títulos oficiais restaurados do dashboard e do
  Canal de Parcerias e ao nome acessível do conjunto ampliado de filtros.
- Distingue no E2E dos simuladores os controles estruturais locais do único
  botão comercial, que continua sem submit, action ou estado habilitado.
- Estabiliza a comparação visual da administração sem ocultar a região dinâmica
  dos checks funcionais ou Axe: somente o screenshot omite a lista volátil de
  identidades QA, preservando o restante da página.
- Publica a homologação visual isolada em HTTPS com DNS/TLS exclusivos, Basic
  Auth antes do login, `noindex`, nove perfis e fixtures somente sintéticas;
  E2E remoto, 21 rotas, 87 checks visuais/Axe, quatro viewports, três temas,
  zoom, teclado, RLS e isolamento passam sem ativar relay ou motores.
- Estabiliza os harnesses Playwright contra a coexistência transitória do
  loading boundary e contra execução do init script antes do DOM, sem reduzir
  testes nem alterar comportamento da aplicação.
- Torna os dois gates locais que consomem `supabase status --output json`
  tolerantes às mensagens informativas do CLI ao redor do único objeto JSON,
  mantendo rejeição fail-closed para saída ausente, truncada ou ambígua.
- Adiciona E2E Playwright local com nove perfis, autenticação e matriz exata das
  21 rotas/permissões,
  superfícies comerciais, filtros, flags off, endpoints e simuladores
  bloqueados, usando apenas contas/fixtures efêmeras removidas no encerramento.
- Corrige o ciclo de redirect de identidades autenticadas sem contexto aprovado,
  retornando 403 genérico com logout seguro sem expor o estado do onboarding.
- Versiona quatro markers históricos no-op para migrations remotas sem copiar
  verifier, grants, fórmula ou DDL inseguro e atualiza a matriz com relay e
  runtime comercial.
- Adiciona ensaio reproduzível em dois projetos PostgreSQL 17 locais e
  independentes, com reset de 27 migrations, 885 pgTAP/lint/advisors em ambos,
  backup/restore lógico e fingerprint fail-closed de owners, privilégios, RLS,
  DDL, ledger e dados, sem mutar ACL no alvo.
- Remove dois warnings do lint SQL com inicialização tipada explícita dos arrays
  UUID internos do read model v3, sem alterar a regra de negócio.
- Consolida pacote de aprovações, auditoria #26–#31 e runbook de merge train,
  canário, rollback floor e deploy; toda mudança remota continua bloqueada.
- Identifica o SHA de release sanitizado no healthcheck e amplia CI com formato,
  banco, E2E, matriz visual e restore isolado.
- Propaga `IMAGE_TAG` como identidade de runtime do container para tornar a
  conferência de canário e rollback verificável pelo healthcheck.
- Torna a QA visual objetiva com 87 comparações de baseline e auditorias WCAG
  A/AA, mantendo candidatos separados, baseline imutável no modo de verificação
  e screenshots sanitizados sem credenciais.
- Corrige contraste do aviso de indisponibilidade dos simuladores e do rótulo
  de capacidade das metas nos três temas.
- Adiciona runtime determinístico e versionado para 14 motores comerciais, com
  DSL fechada, decimal exato, datas civis, casos de ouro obrigatórios e hashes
  canônicos, sem incorporar fórmula, meta, ponto, prêmio ou valor real.
- Cria catálogo/ledgers privados com `FORCE RLS`, versões estritamente
  monotônicas e imutáveis, preview/apply Master-only, owners/backup oficiais,
  gates shadow/active e evidência de execução somente por hashes.
- Isola lookup/auditoria em conexão PostgreSQL server-only e papel dedicado
  `NOLOGIN`, vinculada ao project ref da aplicação, sem acesso de Data
  API/tabela e com flags, allowlist e URL vazias; nenhuma policy, grant de
  execução ou gate é seedado.
- Adiciona endpoint autenticado e same-origin para os cinco simuladores, ainda
  desconectado dos formulários, com 256 KB, output somente após ledger, shadow
  sem resultado e indisponibilidade fail-closed.
- Adiciona verifier local sem rede, manifesto atômico `0600`, fixture de hash
  compartilhada TS/pgTAP e cobertura de RLS, ACL, replay, monotonicidade,
  rollback, concorrência de ator/owner e isolamento do papel.
- Adiciona relay Qlik autenticado por HMAC, desligado por padrão, com conexão
  PostgreSQL dedicada, papel/RPC de menor privilégio, replay distribuído, rate
  limit, duas janelas shadow, duas canary, saúde agregada e rollback lógico.
- Identifica por evidência somente leitura o publisher n8n ativo e seu owner
  técnico; owner operacional/backup e leitores residuais continuam bloqueando
  ativação. Nenhum valor de credencial foi copiado ou versionado.
- Adiciona importação de mappings com manifesto canônico, preview, conflitos,
  hash de plano, confirmação dupla e apply atômico Master-only, sem criar
  owners, targets ou associações presumidas.
- Fecha a primitiva elementar de mapping para Data API; mutações autenticadas
  passam pelo lote com autoridade e hashes, inclusive em replay histórico.
- Converte a migration Qlik anterior em ponte aditiva que preserva o caller
  legado; revogação/removal destrutiva permanece fora desta branch.
- Adiciona read model v3 local com runs/fatos imutáveis, hash semântico,
  publicação atômica, competências fechadas explícitas e estados separados de
  fonte, qualidade e publicação; nenhum número fictício é persistido.
- Exige manifesto imutável de cobertura por run/escopo, inclusive para escopos
  vazios; período ou escopo não certificado fica indisponível em vez de produzir
  totais parciais ou falso zero.
- Versiona IDs externos com vigência, owner, evidência, histórico e fila
  privada de reconciliação; IDs pendentes ou desconhecidos rejeitam o lote
  inteiro e nunca usam nome como associação.
- Registra lineage pai/raiz dos grants de reporting scope e exige cadeia
  efetiva nas leituras v3; grants históricos sem ancestry comprovável ficam
  marcados para reconciliação.
- Adiciona autoridade privada e única por dataset/fonte/workflow/produtor;
  owner, aprovação, evidência e cobertura são obrigatórios antes da ingestão.
- Disponibiliza Dashboard, cinco etapas, Canal de Parcerias e Ranking em rotas
  shadow `/app/read-model-v3/*`, ocultas por flag server-side e fora do catálogo,
  com filtros de período, origem, organização/House, equipe, carteira,
  coordenador, gestor, corretor, empreendimento e região/stand. As rotas de
  produção e seus leitores v2 permanecem inalterados.
- Limita cada catálogo dimensional a 100 opções com truncamento explícito e
  preserva toda seleção autorizada dentro do cap.
- Cataloga permissões v3 separadas para funil, ranking, parcerias e estoque sem
  concedê-las automaticamente a papel algum. Os testes ativam grants sintéticos
  locais para provar Master, Admin, gestor e corretor sem reabrir os read models
  v2 globais; o rollout real exige migration posterior e compatível com rollback.
- Preserva moeda em strings decimais exatas na ingestão/leitura v3 e na leitura
  Qlik escopada, inclusive acima da precisão segura do JavaScript.
- Atualiza os teardowns de QA local para remover o lineage privado antes dos
  grants efêmeros, mantendo contas e fixtures sintéticas autocontidas.
- Inventaria caller Qlik e consumidores de `service_role`; o publisher e owner
  técnico foram identificados, sem promover owner formal ou leitor residual por
  inferência. Não houve cutover, migration remota, alteração n8n/Salesforce/Qlik,
  deploy ou merge.
- Comprova por leitura o projeto Supabase remoto, versiona DDL/inventário
  sanitizados e valida backup oficial em restore isolado com contagens,
  checksums, Auth, Storage, grants, policies e pgTAP, sem mutação remota.
- Prepara onboarding `pending` deny-by-default, papéis técnicos, organizações,
  equipes, carteiras, pessoas e reporting scopes com aprovação atômica,
  auditoria e matriz RLS sintética.
- Endurece a topologia de autorização contra TOCTOU: locks por pessoa/carteira,
  perfis bloqueados em ordem determinística, revalidação pós-lock, fronteiras
  imutáveis, manutenção somente com usuário suspenso, aprovação/reativação
  Master ou Admin e cardinalidade central dos papéis de escopo único.
- Converge localmente o schema Qlik das três tabelas, remove ACL/policies
  diretas no estado proposto e limita ingestão/leitura a RPCs específicas;
  aplicação remota continua bloqueada até o cutover do caller legado.
- Documenta plano de `service_role`, conta QA, rollback, riscos e pacote
  completo das decisões comerciais ainda sem autoridade; simuladores, roleta
  e prêmios permanecem bloqueados.
- Adiciona gate de reconciliação local/remoto com matriz das 20 versões,
  evidência sanitizada do schema, plano de baseline/backup/restore/domínio,
  contratos tipados Salesforce/n8n/Qlik e estoque fail-closed, inventário de
  políticas e proposta deny-by-default de escopos/RLS; sem mutation remota.
- Consolida a paridade visual das 18 páginas: ranking, Canal de Parcerias,
  configurações, metas e cinco jornadas de simulação passam a compartilhar a
  mesma linguagem analítica navy/cyan/lime.
- Adiciona ao catálogo protegido o hub e as rotas WF13, WF16, CAIXA, WF14 e
  WF15 com `crm.simulators.view`, guard server-side e matriz de papéis
  versionada.
- Entrega formulários e painéis completos dos simuladores com motores
  fail-closed: validação acessível fica somente no navegador, sem submit,
  persistência, fórmula ou valor fictício; todo resultado permanece
  explicitamente indisponível.
- Restaura diagnóstico, gargalo e plano de ação do dashboard e ícones
  semânticos na navegação autorizada, sem ampliar acesso ou inferir regra
  comercial.
- Adiciona runner autenticado estritamente local que cria conta/fixtures
  efêmeras, valida marcador e contagens via RLS, captura as 18 rotas e remove
  tudo no encerramento, sem persistir credenciais.
- Versiona o inventário das 18 páginas da referência viva, matriz de paridade,
  catálogo de componentes/fontes e baseline visual com máscara opaca antes da
  captura.
- Adiciona design system analítico navy/cyan/lime, topbar hierárquica autorizada
  e componentes reutilizáveis de cards, filtros, roscas, funis, gauges,
  tabelas, rankings, skeletons e estados.
- Restaura dashboard e cinco etapas sobre o read model existente, preservando
  campos ausentes como “Indisponível” e sem copiar projeções, filtros ou regras
  comerciais sem fonte oficial.
- Adiciona Playwright apenas como dependência de desenvolvimento, com harness
  versionado para baseline sanitizada e verificação de acesso anônimo. O
  harness exige origem explícita, isola contextos, valida rota/headers/DOM antes
  e depois da captura e só persiste o conjunto após aprovação integral.
- Ajusta somente o proxy HTTPS de `crm.descomplicapro.com.br` para aceitar os
  headers de resposta da sessão Supabase, com buffers Nginx mínimos medidos e
  runbook de validação, reload e rollback.
- Integra visualmente o cadastro à experiência aprovada do login, reutilizando
  o cérebro mecânico, responsividade, temas, touch e redução de movimento sem
  alterar o fluxo de criação de conta ou qualquer contrato de segurança.
- Corrige o advisory `GHSA-2v37-7h3g-55p8` fixando `nanoid` transitivo em
  `3.3.17`, sem atualizar outras dependências.
- Reformula visualmente o login com layout responsivo em duas áreas e cérebro
  mecânico interativo, validado em desktop, tablet, celular, zoom, touch e
  redução de movimento, sem alterar o formulário ou o fluxo de autenticação.
- Adiciona implantação Docker Compose do build Next.js standalone, limitada a
  loopback, com healthcheck, limites de recursos, logs rotacionados e rollback
  por tag imutável.
- Adiciona endpoint de liveness e configurações Nginx separadas para a fase HTTP
  segura e para a ativação posterior de HTTPS.
- Adiciona assistente interativo para gravar o ambiente de produção
  atomicamente, sem eco de segredos, com validação das chaves atuais do Supabase
  e geração criptográfica dos Bearers Salesforce.
- Adiciona flags server-side independentes para ingestão e refresh Salesforce,
  desativadas por padrão, com endpoints e interface em estado fail-closed.
- Normaliza grants de tabelas, sequências e RPCs para os defaults fail-closed
  dos novos projetos Supabase, com matriz pgTAP de privilégio mínimo.
- Adiciona exportador candidato de sete relatórios Salesforce com projeção
  mínima sem PII, identidades estáveis, transformação para o contrato v2 e
  workflow n8n inativo/fail-closed para validação antes da primeira ingestão.
- Distingue metas e roleta sem fonte oficial de resultados comerciais iguais a
  zero, persiste flags fail-closed e mostra estados neutros na interface.
- Versiona o schema remoto do ranking Qlik de imobiliárias sem seed ou perda de
  dados e remove seus grants diretos não auditados de Data API/service role.
- Atualiza a baseline Salesforce após reconciliação somente leitura comprovar
  385 oportunidades criadas depois do snapshot e uma alteração legítima no
  status da base de corretores, sem escrita no Supabase ou ativação do n8n.
- Corrige o drift Qlik sem acesso direto à Data API e adiciona uma RPC
  transacional, idempotente e exclusiva do `service_role` para o workflow n8n.
- Localiza papéis, permissões e estados 403/404/500; compacta a gestão de
  usuários, exige motivo transacional para alterações sensíveis e adiciona a
  rota protegida do Canal de Parcerias sem leitura Qlik ou mudança de grants.

Todas as alterações relevantes deste projeto serão registradas aqui.

## [Não publicado]

### Adicionado

- Homologação visual isolada com Compose/volumes/rede/portas próprios, Supabase
  local sintético, nove perfis QA, Basic Auth, noindex, banner persistente,
  cadastro público bloqueado, firewall dedicado, E2E remoto e rollback sem
  cutover.
- Vitest e testes iniciais dos schemas de autenticação.
- Scripts de verificação, auditoria, scanners e Supabase local.
- Build Next.js `standalone` para a VPS.
- Documentação reproduzível de ambiente, arquitetura, banco, segurança, integrações, backup e migração.
- Workflow GitHub Actions com todos os gates obrigatórios da base.
- Catálogo PostgreSQL com 14 páginas e navegação filtrada por permissão efetiva.
- Painel administrativo inicial para papéis, exceções, status de usuários e visibilidade de páginas.
- Provisionamento automático de perfil e papel mínimo para novas contas Supabase Auth.
- Rotas protegidas para todas as superfícies inventariadas do CRM.
- Dashboard comercial server-rendered com três visões, três períodos, metas, conversões e destaques.
- Read model PostgreSQL normalizado do dashboard com quatro tabelas, constraints, grants e RLS.
- Metas mensais dos funis DV e parcerias com tabela tipada, cálculo server-side e histórico por mês.
- Server Action e RPC de metas protegidas por `crm.settings.manage`, RLS e auditoria atômica.
- Configuração normalizada de pesos e objetivos das sete atividades do ranking.
- Server Action e RPC de pontos com substituição integral, validação e auditoria atômica.
- Ranking server-rendered de corretores e gerentes, com quatro períodos, pódio e placar completo.
- Read model normalizado de atividades do ranking, recalculado com os pesos atuais.
- Detalhes server-rendered das cinco etapas com visões, períodos, conversão e comparações históricas.
- Route Handlers seguros para status, refresh e ingestão Salesforce, com contrato Zod versionado.
- Histórico de ingestão, RPC transacional, idempotência, rejeição de snapshot antigo e botão de refresh autorizado.
- Shell protegido com navegação ativa e temas claro, equilibrado e escuro persistidos localmente.

### Alterado

- Recompõe as 22 páginas protegidas segundo os 11 canvases aprovados, mantém
  uma única navbar global e adiciona ao QA autenticado uma comparação externa
  por rota para impedir que uma baseline autorreferente aprove layout
  divergente.
- Estabiliza o smoke MFA hospedado ao aguardar janela TOTP útil antes de
  enrollment/challenge e ampliar somente o teto desse cenário para 180
  segundos, sem registrar chave, código ou credencial.
- Base fixada em Node 24.19.0, pnpm 11.20.0, Next.js 16.3.0, React 19.2.8 e Supabase SDK 2.112.0.
- Supabase SSR passou a usar a publishable key e validação de claims no middleware.
- Política de scripts de instalação e overrides transitivos de segurança centralizados no workspace pnpm.
- Policies SELECT duplicadas consolidadas sem ampliar acesso.
- Dependências D1/JSON e `sf_relatorio_resumo` removidas do caminho de leitura do dashboard.
- API pública `/api/settings/goals` substituída pelo SDK SSR e pela RPC auditada.
- API D1 `/api/settings/points` substituída pelo SDK SSR e pela RPC auditada.
- Endpoints Cloudflare/n8n de status, refresh e ingestão substituídos por Supabase, segredos server-side e respostas sanitizadas.

### Segurança

- Converge o Canal de Parcerias para `crm.partnerships.view` exclusivamente
  Master, sem overrides ou autorização para outros papéis.
- Reaplica em migration exclusiva o hardening fail-closed das três tabelas
  Qlik após regressão remota: RLS forçada, zero policy de leitura e zero ACL
  direta para papéis da Data API, sem versionar as migrations inseguras.
- Flags da homologação falham fechadas; read model v3 pode ser visualizado
  apenas no ambiente sintético, enquanto relay Qlik, integrações externas e
  motores comerciais permanecem desligados.
- Removidas vulnerabilidades críticas/altas/moderadas conhecidas da árvore final.
- Arquivo de ambiente presente no ZIP de origem removido da árvore de entrega e colocado em quarentena local.
- Usuários inativos bloqueados no contexto de autorização e na resolução de permissões usada pela RLS.
- Mutações administrativas protegidas por guarda server-side, RPC hierárquica e auditoria no banco.
- Escrita direta das metas revogada para o navegador; perfil inativo ou sem permissão falha fechado.
- Pesos do ranking expostos somente para leitores autorizados; escrita direta permanece revogada.
- Snapshots e participantes do ranking protegidos por `crm.ranking.view`, sem fallback demonstrativo.
- Ingestão limitada a 1 MB e 20 snapshots/minuto com secret key server-only; refresh protegido por mesma origem, permissão, lock, cooldown e timeout.
