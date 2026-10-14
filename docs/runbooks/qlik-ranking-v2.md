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
backup separados. A primeira versao dessas operacoes habilita somente preflight
de metadados; nao confundir seu sucesso com coleta de fatos ou agenda ativa.
Sessao expirada/MFA deve produzir reautenticacao necessaria, preservar dados e
exigir acao autorizada, sem contornar controles do provedor.

## Recuperacao

Configuracao do aplicativo usa backup privado versionado do env completo,
CAS e `release:production recover` da tentativa exata. Nao apagar ledger/lock.
Sem carga nova valida, a ultima publicacao continua disponivel. Nao apagar
observacoes ou desfazer schema com DROP automatico; reversao de schema exige
avaliacao dos dados ja recebidos e autorizacao apropriada.

Evidencias locais: suites `qlik-contract-v2`, `qlik-handler-v2`, pgTAP
`qlik_ranking_v2`, `publish-ranking` e `qlik-app-release*`. Resultados reais
ficam no registro de auditoria; testes sinteticos nao comprovam conexao.
