# Estoque oficial dos simuladores

Em 13/10/2026, o usuário definiu o relatório Salesforce **ESTOQUE SPC**,
`00OU6000007yRpKMAU`, como fonte oficial das unidades. Os sete relatórios
comerciais continuam alimentando funil e ranking; não contêm esse estoque.

## Coleta completa

`pnpm salesforce:inventory` usa a sessão dedicada já autenticada na VPS e a
mesma trava do coletor comercial. Exige caminhos absolutos em
`SALESFORCE_CANDIDATE_OUTPUT` (candidato comercial existente, para a trava) e
`SALESFORCE_INVENTORY_OUTPUT` (novo candidato privado de estoque). O comando
não publica dados, não muda o relatório Salesforce e não altera o n8n.

A API limita os detalhes a 2.000 linhas. A coleta obtém primeiro contagens
agrupadas por empreendimento, mantendo os filtros e o intervalo originais.
Depois executa uma partição por empreendimento e verifica `allData`, contagens,
colunas, filtros e IDs. Uma nova leitura de contagens e metadados precisa
coincidir no encerramento. Exportação incompleta, agrupamento ambíguo, mudança
de escopo ou duplicata conflitante preservam o candidato anterior. Um
empreendimento que sozinho ultrapasse o limite também bloqueia a publicação.

O limite total é cinco minutos; SIGTERM/SIGINT cancelam a coleta. A sessão
continua exigindo login e MFA manuais quando o Salesforce solicitar. Não
remover uma trava pertencente a outro processo nem interromper o coletor
comercial para executar a coleta avulsa.

Valores usam os campos oficiais; o preço segue a fórmula já utilizada pelo CRM:
Valor Final Com Kit menos B.A. da Unidade menos Folga de Tabela, em centavos.
Campos ausentes permanecem nulos. Valores monetários com ISO omitido só são
aceitos quando o rótulo do próprio Salesforce identifica BRL/R$. Outra moeda
ou ausência dessa indicação bloqueia o candidato. Status é preservado; o
relatório pode conter estados Mirror e reservados, não apenas disponíveis.
O enriquecimento da interface também preserva componentes de preço ausentes;
uma unidade sem preço completo permanece sem opção de seleção para simulação.

## Consumo e publicação

`SALESFORCE_INVENTORY_PATH` seleciona o arquivo oficial no servidor. Quando
configurado, `/api/inventory` e `/api/inventory/snapshot` servem a mesma carga
validada, com cache compartilhado de até 30 segundos e autorização em cada
requisição. Isso alcança Tabelão, Associativo, Investidor e Tabela Direta.
Falhas não recorrem aos preços da planilha ou do feed antigo. Sem configuração,
ambientes de desenvolvimento e versões anteriores conservam o fluxo legado.

O JSON deve passar por `salesforceInventorySchema`, com relatório fixo, IDs
únicos, contagens reconciliadas e valores tipados. Arquivos simbólicos, não
regulares, maiores que 8 MiB ou com data futura são recusados. A leitura usa
arquivo aberto e a publicação deve trocar `current.json` por rename atômico.
`generatedAt` identifica a conclusão da coleta; não é data de alteração de
cada registro Salesforce nem horário de deploy da aplicação.

Produção monta `/etc/descomplica-crm/inventory` somente para leitura. A pasta
deve pertencer a root:root, modo 0710; `current.json`, root:root e 0640. O
coletor não recebe permissão para escrever nesse diretório. Antes de promover
um candidato, conferir o schema, SHA-256, data, contagens e arquivo anterior;
guardar backup privado e repetir a conferência do estado esperado antes da
substituição. Não versionar o candidato ou suas linhas comerciais no Git.

A primeira adoção exige release validada pelo fluxo normal de PR, CI e
`pnpm release:production`. O wrapper verifica a base oficial antes de iniciar
produção. A planilha histórica permanece intacta para rollback da versão.
Uma nova carga não deve alterar silenciosamente uma proposta já selecionada.

## Evidência na tela e limite da agenda

Conectar Sistemas mostra os sete relatórios comerciais e o ESTOQUE SPC. A
linha do estoque usa contagem e data do arquivo efetivamente servido; não
depende do progresso efêmero da sessão. O endpoint de status retorna somente
esses metadados, sem unidades ou preços. A descrição da unidade selecionada
apresenta o status original do Salesforce.

Esta implementação realiza **coleta avulsa** de estoque. A agenda existente
de 30 minutos continua restrita aos sete relatórios comerciais. Não apresentar
o estoque como automaticamente atualizado. Integrar uma agenda de estoque
exige publicar e reconciliar cada nova carga; conexão ativa não prova coleta.

## Verificações

Testes cobrem partições completas e truncadas, mudança de filtros/contagens,
identidade de empreendimento, moedas, datas e precisão; as APIs verificam
autorização, origem única, arquivos inválidos, symlinks, metadados limitados e
renovação após troca atômica. Executar também lint, tipos, suite completa e build.

Fonte da API: [limites de relatórios do Salesforce](https://help.salesforce.com/s/articleView?id=rd_reports_dashboards_limits.htm&language=en_US&type=5).
Publicação de código: [consulta e trava obrigatórias](production-release-guard.md).
