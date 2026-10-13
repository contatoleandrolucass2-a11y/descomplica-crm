# Estoque oficial dos simuladores

Em 13/10/2026, o usuário definiu o relatório Salesforce **ESTOQUE SPC**,
`00OU6000007yRpKMAU`, como fonte oficial das unidades. Os sete relatórios
comerciais continuam alimentando funil e ranking; não contêm esse estoque.

## Coleta automática completa

O scheduler `salesforce:export:watch`, com
`SALESFORCE_INVENTORY_AUTOMATIC_ENABLED=true`, executa o ESTOQUE SPC depois
dos sete relatórios comerciais, em cada ciclo de 30 minutos. Usa a sessão
dedicada já autenticada na VPS e a
mesma trava do coletor comercial. Exige caminhos absolutos em
`SALESFORCE_CANDIDATE_OUTPUT` (candidato comercial existente, para a trava) e
`SALESFORCE_INVENTORY_OUTPUT` (novo candidato privado de estoque). O scheduler publica o candidato validado automaticamente.
O comando manual `pnpm salesforce:inventory` continua disponível para diagnóstico
e escreve somente o candidato privado. Não altera o relatório Salesforce nem o n8n.

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
comercial para executar um diagnóstico manual. O scheduler espera as duas
etapas terminarem antes de agendar a próxima fronteira de 30 minutos.

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

Produção monta `/var/lib/descomplica-salesforce-inventory` somente para leitura.
A pasta pertence a `descomplica-salesforce:root`, modo **2710**; `current.json`
e `previous.json`, ao mesmo usuário/grupo e **0640**. O setgid da pasta permite
herdar o grupo de leitura do container sem adicionar o coletor ao grupo root.
Somente essa pasta de dados entra no `ReadWritePaths` do serviço, além do estado
privado que já existia. O coletor não pode escrever no env ou secrets de produção nem no código.

A publicação ocorre dentro da trava de exportação, após coleta completa. Valida
schema, tamanho, proprietário, data não futura e idade de até dez minutos.
Rejeita carga anterior ou diferente no mesmo horário. Preserva `previous.json`,
compara a base anterior, grava temporário exclusivo, fsync e rename atômico,
e relê o hash instalado. A aplicação renova o cache em até 30 segundos sem
reinício. Falhas antes da troca mantêm a base anterior. Se fsync ou releitura
falham depois do rename, o publicador restaura a base anterior somente se o inode
instalado ainda pertence à tentativa, e confirma a restauração antes de indicar
`inventory_failed`. Se o disco ou uma substituição concorrente impedem essa
confirmação, indica `inventory_publication_uncertain` e a interface mostra
**Publicação do estoque não confirmada**, sem afirmar qual base prevaleceu.
Não versionar candidatos, backups ou linhas comerciais.

A primeira adoção exige release validada pelo fluxo normal de PR, CI e
`pnpm release:production`. O wrapper verifica a base oficial antes de iniciar
produção. A planilha histórica permanece intacta para rollback da versão.
Uma nova carga não deve alterar silenciosamente uma proposta já selecionada.

## Evidência na tela e agenda

Conectar Sistemas mostra os sete relatórios comerciais e o ESTOQUE SPC. A
linha do estoque usa contagem e data do arquivo efetivamente servido; não
depende do progresso efêmero da sessão. O endpoint de status retorna somente
esses metadados, sem unidades ou preços. A descrição da unidade selecionada
apresenta o status original do Salesforce.

A tela totaliza **8 relatórios**. Uma carga publicada pelo scheduler recebe
`collectionMode: automatic` e aparece como **Coletado · automático (30 min)**.
O horário da linha é o da coleta efetivamente servida, separado dos sete relatórios.
Conexão ativa não prova coleta: verificar avanço de data e hash em ciclos distintos.

## Atualização do serviço existente

O instalador `install-collector.mjs` continua exclusivo da primeira instalação.
Não apagar seu registro nem simular uma instalação nova. Para atualizar o coletor:

1. Aprovar PR e os quatro jobs de main; preparar checkout imutável e dependências.
2. Criar a pasta de publicação com proprietário/modos acima; instalar a primeira
   base validada e preservar backup privado. Não conceder grupo root ao coletor.
3. Publicar o CRM pelo coordenador `release:production`; verificar SHA/health.
4. Revisar a unidade anterior, ausência de overrides, usuário dedicado, paths e
   hash exato. Preparar backup durável da unidade e do registro original.
5. Dentro das três travas de produção e da trava do instalador, consultar novamente
   release/data/health e CI/main no próprio minuto. Adquirir a trava de exportação:
   se ocupada, aguardar o ciclo terminar; nunca interrompê-lo nem apagar a trava.
6. Parar somente o coletor ocioso, substituir a unidade por CAS pelo template do
   SHA aprovado, validar com systemd-analyze e daemon-reload. Repetir consulta ao
   vivo no minuto antes de iniciar; liberar a trava de exportação antes do start.
7. Verificar enabled/active, WorkingDirectory, PID estável, oito coletas e avanço
   real da base. Registrar hash anterior/novo e horário. Se a troca falhar, restaurar
   por CAS a unidade guardada e confirmar o serviço anterior; preservar evidência
   de qualquer recuperação pendente. Não reiniciar navegador, n8n ou outros serviços.

O arquivo anterior do estoque permite diagnóstico; não o promover automaticamente
sobre uma coleta mais nova. A reversão de código já publicado segue novo PR/CI.

## Verificações

Testes cobrem partições completas e truncadas, mudança de filtros/contagens,
identidade de empreendimento, moedas, datas e precisão; as APIs verificam
autorização, origem única, arquivos inválidos, symlinks, metadados limitados e
renovação após troca atômica. Executar também lint, tipos, suite completa e build.

Fonte da API: [limites de relatórios do Salesforce](https://help.salesforce.com/s/articleView?id=rd_reports_dashboards_limits.htm&language=en_US&type=5).
Publicação de código: [consulta e trava obrigatórias](production-release-guard.md).
