# Ranking Qlik v2

## Escopo e estado

Referencia: Canal de Parcerias. Destino: `/app/ranking`. Recorte fixo:
Direcional / SP CAPITAL / CANAL IMOB. A audiencia autorizada e quem possui
`crm.ranking.view`, com sessao e MFA validados no servidor e no banco.

Implementacao candidata em14/10/2026. A existencia destes arquivos nao comprova
migration aplicada, autenticacao QIX, coleta, conciliacao, publicacao ou agenda.
Nao ampliar para clientes, dados de fluxo, outras regionais ou Salesforce.

## Fronteiras

- Endpoint novo `/api/ingest/qlik/v2`, desligado por padrao. HMAC dedicado,
  dominio da assinatura inclui a rota v2, nonce UUID e timestamp UTC.
- RPC `ingest_qlik_ranking_v2` executavel somente por `service_role`, usada
  exclusivamente pelo servidor CRM. A VPS nao recebe a chave Supabase.
- Duas tabelas novas em `private`, RLS forcada, sem grants diretos para
  public, anon, authenticated ou service_role. Nenhuma ACL legada muda.
- Reader `get_qlik_ranking_v2(integer)` executavel somente por authenticated;
  valida UID, MFA e permissao. Ano omitido escolhe o ano mais recente publicado.
- Tabelas, relays e dados Qlik/Salesforce existentes permanecem separados.

## Contrato de coleta

Os helpers SQL de timestamp/conteudo sao STABLE: casts e formatacao temporal
nao podem ser anunciados ao otimizador como IMMUTABLE. Manter o lint em
warning/fail-on warning e o ensaio de restore, alem do pgTAP. Referencia:
[volatilidade PostgreSQL](https://www.postgresql.org/docs/current/xfunc-volatility.html).

`contracts-v2.ts` define o envelope estrito. Cada observacao inclui batchId,
requestId, inicio/fim, app/pasta, hash do mapeamento, recarga, recorte e meses.
Cada mes contem os cubos IMOBs e empreendimentos completos, linhas com chave
estavel, nome, VGV decimal exato e contratos inteiros, mais totais nativos.

Entre uma e doze competencias ordenadas do mesmo ano; ausencia de competencia
nao significa zero. Cubo vazio exige cobertura completa e totais zero. VGV
usa centavos exatos; contagem e soma devem coincidir com os totais do proprio
cubo. Nao exigir igualdade artificial entre totais de dimensoes diferentes.
Maximo de5000 linhas por cubo e4.000.000 bytes; exceder rejeita a carga inteira.

O banco calcula o hash do conteudo, incluindo mapeamento/recarga e excluindo
somente IDs e tempos das execucoes. A primeira observacao fica staged. Uma
segunda execucao independente, com outro requestId e inicio posterior ao fim
da primeira, deve produzir o mesmo conteudo para publicar atomicamente.
Mudanca de recarga/conteudo exige novo par, nunca alterar uma observacao.

O HMAC autentica o emissor, mas nao prova sozinho independencia ou semantica
Qlik. O coletor deve abrir sessoes independentes, verificar selecoes, IDs,
formulas, paginacao completa e estabilidade da recarga. Essas evidencias sao
obrigatorias antes de habilitar dados reais. Replay idempotente nao conta
como segunda coleta. O publisher reutiliza os mesmos bytes/requestId apenas
em ate tres tentativas de transporte; o nonce muda a cada tentativa.

`ranking-cycle.mjs` recebe o coletor e abre duas chamadas sequenciais com
identidades UUID distintas. Copia cada resultado antes da proxima chamada,
valida o mesmo contrato do endpoint e compara fonte/meses antes de enviar.
Somente dois ACKs coerentes, staged e published, com o mesmo hash constituem
sucesso. Implementacao do coordenador nao prova sozinha sessao QIX independente.
`ranking-credential.mjs` le somente a credencial fixa do systemd, com caminhos,
ownership, limites e symlinks verificados; nenhum valor e exportado em logs.
`ranking-artifact.mjs` projeta apenas estado e recibo, nunca payload ou erros.
Falhas podem incluir um codigo de lista fixa, sem mensagens brutas. Diagnostico
so e preservado quando o loop aceita o resultado dentro do prazo; timeout,
cancelamento ou relogio invalido nao reutilizam o motivo de uma coleta tardia.

O coletor `browser-ranking.mjs` abre uma pagina dedicada por observacao e uma
identidade QIX UUID distinta, fecha pagina/sessao antes da segunda coleta e
mantem autenticacao/CSRF dentro do navegador. Nao exporta cookies nem usa CDP
ou bypass de CSP. O limite e180 segundos por observacao e ate5 segundos para
confirmar descarte; o ciclo completo tem480 segundos. Timeout invalida o
recibo, mesmo com event loop atrasado. Criacao/fechamento travados mantem o
contexto bloqueado. Somente o main Linux opta por encerrar o processo quando
o descarte nao e confirmado, permitindo recuperacao pela unit dedicada com
Restart=always/KillMode=control-group; a biblioteca nao encerra processos.

`qix-ranking.mjs` exige mapeamento aprovado a partir de metadados reais:
hashes integrais dos cubos/masters, dimensao nativa, campo de identidade,
indices das medidas, filtros e calendario. Verifica selecoes efetivas,
paginacao, totais nativos por mes e aditividade do ano. Alteracao de definicao
ou recarga, reducao, pagina incompleta ou identidade ambigua rejeita a carga.
Fixtures e `verified:true` nao comprovam o mapeamento do tenant. Em16/10/2026
o preflight privado forneceu os pins nativos configurados; ver
[mapeamento](qlik-partnerships-mapping.md). A coleta real conciliada permanece
exigida antes de afirmar conexao produtiva.

`aliasPins` cobre referencias diretas VENDAS/VGV a masters nomeados: alias,
indice nativo selecionado, ID e SHA256 de GetProperties integral. Em cada
checkpoint, um catalogo novo e limitado deve apontar um unico candidato por
titulo ou label; identidade/titulo aprovado e hash integral sao relidos.
Colisoes, mudancas e disposicao nao confirmada rejeitam a observacao. O
enriquecido usa qLibraryId explicito, sem reescrever o cubo nativo, e mantem
conciliacao por nome/mes/ano e totais. Espacos e colchetes nao dispensam pins;
qLibraryId nativo valido prevalece sobre o fallback inline.

Esse contrato opt-in nao resolve variaveis, macros ou dependencias transitivas
automaticamente. Cada definicao real ainda precisa de revisao. Referencias:
[masters em expressoes](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Measures/use-master-measures-expressions.htm)
e [precedencia de nomes](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Expressions/references-fields-measures-variables.htm).

Expressões nativas podem conter TAB, CR e LF, conforme o uso multilinha do
[editor de expressões](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Expressions/work-with-expression-editor.htm).
O coletor aceita esses três controles somente no corpo da expressão. O texto
original permanece intacto no hash e na definição entregue ao QIX; não há
normalização, substituição de fórmulas ou dispensa de pins. Outros controles,
surrogates isolados, conteúdo apenas em branco e mais de 16.384 caracteres
continuam recusados. Nomes, rótulos e identificadores mantêm regras separadas.

`ranking-mapping.mjs` rejeita definicao ausente ou nao revisada. A definicao
produtiva agora contem os pins nativos da conferencia00:58 UTC16/10/2026,
nao uma atestacao de coleta/publicacao. A factory deriva janeiro ate o mes corrente do
ano atual em America/Sao_Paulo. O SHA semantico inclui definicao estatica,
proveniencia e politica temporal explicita; exclui somente periodos derivados.
O launcher destaca/congela um snapshot por ciclo, valida sua serializacao antes
do HMAC e o compartilha entre as duas sessoes. O ciclo seguinte recria o mapa.
Motivos de falha QIX atravessam o browser somente pela allowlist versionada;
nenhuma mensagem bruta do SDK, formula ou linha de dados entra no recibo.

O catalogo de medidas trata qData/title/label opcionais sem transformar
metadados alheios em requisito financeiro. IDs/tipos/duplicatas e limite4096
continuam conferidos em toda a lista. Um alias so vincula o master aprovado,
com titulo nativo, hash integral e unicidade; nenhum texto alheio e publicado.
Codigos master_catalog_item, master_catalog_text, master_catalog_binding e
master_alias_identity distinguem recusas sem incluir valores da fonte.

Paginas completas podem conter qTails zeradas: [NxGroupTail](https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/EngineJSONAPI/Content/models-nxgrouptail.htm)
descreve contagens de elementos de grupos anteriores/seguintes. O coletor
aceita somente zeros explicitos em array limitado pela largura do cubo;
caudas nao-zero ou malformadas continuam recusadas. A area/matriz deve
corresponder exatamente a cada pagina solicitada, sem reducao ou lacunas.

Publicacoes sao preservadas por ano. O reader retorna atual/anterior sob um
snapshot SQL. Falha ou fonte mais antiga nao substitui a ultima carga valida.
Movimento exige periodo, cobertura e mapeamento comparaveis. Publicacao nao
transforma timestamp de coleta em timestamp de atualizacao da fonte.

## Ativacao controlada

1. Concluir CI exata, incluindo pgTAP e restore isolado. Conferir catalogo real
   e backup privado atualizado. Aplicar somente a migration aditiva aprovada;
   nunca `db push` da cadeia local divergente sobre producao.
2. Conferir grants/RLS e helpers de autorizacao reais. Os doubles transacionais
   pgTAP nao substituem esse preflight. Nao usar fixtures de clientes em producao.
3. Criar chave HMAC dedicada em arquivo privado protegido, sem argumentos de
   processo, Git, logs ou resposta do agente. Preparar seu consumo pelo owner
   dedicado; nao fornecer credenciais Supabase ao coletor.
4. Promover um novo SHA validado com `release:production deploy` e a opcao
   `--qlik-ranking enable`. Nao editar production.env/Compose diretamente.
5. Validar duas coletas reais e totais, persistencia/reader autorizado e pagina.
   Somente depois habilitar ciclo autonomo e provar execucao posterior sem
   intervencao. Registrar horario, requestIds, recarga, resultado e limites,
   sem publicar nomes/valores comerciais ou credenciais nas evidencias.

O owner Qlik usa as operacoes protegidas do mesmo coordenador, com ledger e
backup separados. O modo padrao continua somente metadados. O candidato
`qlik-deploy --ranking enable` troca para coleta de fatos, com `LoadCredential`
do systemd no caminho fixo, sem segredo nos argumentos ou na unit.
Preflight e ranking sao mutuamente exclusivos. Arquivo root0600 e ACL nominal
do usuario tecnico no credential runtime sao conferidos; a chave nao pode
estar disponivel ao grupo ou a outros usuarios.

O primeiro ciclo inicia imediatamente. O intervalo de uma hora comeca apos
seu termino, sem sobreposicao. A habilitacao no boot depende de recibo novo
de publicacao real, verificacao do owner e novas consultas ao CRM/main/CI sob
as mesmas travas/CAS. Falha preserva pendencia recuperavel; nunca habilitar
manualmente o servico para contornar esse gate. Status registrado nao substitui
leitura atual do recibo, banco e pagina. Provar tambem um ciclo horario posterior.
Sessao expirada/MFA deve produzir reautenticacao necessaria, preservar dados e
exigir acao autorizada, sem contornar controles do provedor.

## Status em Integrações

O cartão Qlik aparece entre Salesforce e n8n, com SVGs vetoriais para os temas
claro/médio e escuro. O painel separa o estado do último ciclo, o horário da
coleta validada, a confirmação de publicação no CRM, a recarga da fonte e a
próxima coleta prevista. Uma sessão do navegador aberta não comprova publicação.

O owner de ranking envia um heartbeat a cada 30 segundos para
`POST /api/ingest/qlik/status`, assinado pelo HMAC existente com domínio de rota
próprio. O contrato aceita somente metadados operacionais; não transporta linhas,
nomes comerciais, fórmulas, credenciais ou mensagens brutas de erro. O servidor
limita o corpo a 8 KiB e cinco segundos, valida assinatura, idade, ordem e nonce.
O `GET` exige acesso à página Integrações, incluindo as verificações existentes
de sessão, MFA, aprovação e escopo. Nenhuma tabela ou ACL é modificada.

Sem heartbeat por 90 segundos, o status expira. Um ciclo travado também expira
mesmo recebendo heartbeat. Falha e reautenticação preservam os horários da última
publicação confirmada durante a vida do owner. Reinício do servidor ou rotação
da chave exige novo heartbeat; reinício do owner exige nova publicação antes de
afirmar sucesso. Os dados duráveis do ranking continuam no banco existente.

Falha na entrega do status não dispara nova coleta nem altera a publicação.
O monitor não se sobrepõe; a interface consulta a cada 15 segundos e suspende
consultas em abas ocultas. O intervalo comercial permanece de uma hora após o
término do ciclo. Status e agenda previstos não substituem a prova de uma
execução automática posterior, exigida na ativação controlada.

## Recuperação operacional

Configuracao do aplicativo usa backup privado versionado do env completo,
CAS e `release:production recover` da tentativa exata. Nao apagar ledger/lock.
Sem carga nova valida, a ultima publicacao continua disponivel. Nao apagar
observacoes ou desfazer schema com DROP automatico; reversao de schema exige
avaliacao dos dados ja recebidos e autorizacao apropriada.

Evidencias locais: suites `qlik-contract-v2`, `qlik-handler-v2`, pgTAP
`qlik_ranking_v2`, `publish-ranking` e `qlik-app-release*`. Resultados reais
ficam no registro de auditoria; testes sinteticos nao comprovam conexao.
