# Indicadores, gráficos e tabela de agendamentos

Fontes: relatórios Salesforce `00OU600000ELaA6MAL` e
`00OTT000009j0l32AA`, página `/app/etapas/agendamentos`. O estado operacional
deve ser conferido em `docs/knowledge/ATUALIZACOES.md`, PR/CI e health.

## Definições

Os gráficos históricos contam códigos de agendamento únicos após a deduplicação
existente. Data de criação é convertida para America/Sao_Paulo. O mês selecionado
controla indicadores, diário, semanas, rankings e tabela; o ano do gráfico mensal
é exclusivo.

| Bloco                     | Coluna ou cálculo                                                                 |
| ------------------------- | --------------------------------------------------------------------------------- |
| Meta mensal               | Agendamentos criados no mês / contatos únicos no relatório de corretores          |
| Corretores cadastrados    | `Contact.Name` distinto no relatório `00OTT000009j0l32AA`                         |
| Média no mês              | Agendamentos criados / dias cobertos do mês selecionado                           |
| Hoje e ontem              | `Activity.CreatedDate`                                                            |
| Dia, semana e mês         | `Activity.CreatedDate`; semanas de segunda a domingo                              |
| Previsto e realizado hoje | `Activity.ActivityDateTime` e `Activity.VisitaRealizada__c`                       |
| Gerente regional          | `Activity.Gerente_Regional__c`                                                    |
| Gerente e responsável     | `Activity.Gerente_de_Vendas__c` e `Activity.Corretor__c.Name`                     |
| Ranking das contas        | `Activity.Account.Ranking__c`                                                     |
| Tabela                    | criação, horário, comparecimento, realização, regional, gerente, corretor e conta |

Rankings ordenam quantidade decrescente e usam o nome como desempate. Ausência
de nome fica explícita. Cobertura ausente não vira zero; cobertura parcial é
informada.

Os 12 indicadores têm dimensões, títulos, números e textos auxiliares uniformes.
Em telas largas, formam seis colunas por duas linhas; o movimento sutil segue o
ponteiro e respeita a preferência por movimento reduzido. Os cinco gráficos
principais mantêm a mesma altura em uma grade compacta. Ranking Score escreve os
rótulos de baixo para cima. Os três rankings e as três faixas de recência formam
uma grade 3 × 2; conteúdos extensos usam rolagem vertical acessível por teclado.
A tabela usa largura fixa, quebra texto, cabeçalho aderente e rolagem apenas
vertical. Barras, rótulos, rankings e linhas da tabela recebem realce no hover.

Filtros dimensionais de canal, regional, gerente, responsável, empresa e ranking
recortam também o elenco cadastrado. A meta, a equipe produtiva e a contagem de
gerentes usam esse elenco filtrado. O período continua recortando as métricas
operacionais sem transformar o cadastro vigente em uma contagem de atividade.

## Contrato e permissões

`dashboard.analysis.version=2` introduziu `dimensions.stores` e o índice de
loja na posição 10 dos fatos. A versão 3 preserva os fatos v2 e acrescenta
`brokerCount` e `appointments` por visão. Cada detalhe contém somente:

- `createdAt`, `scheduledAt`, `attendedAt` e `visitPerformed`;
- `regionalManager`, `salesManager`, `owner`, `accountName` e
  `accountRanking`.

Código do agendamento, telefone, e-mail, CPF e demais campos do relatório não
entram no payload. Snapshots v1/v2 continuam legíveis; neles, os indicadores e
detalhes novos aparecem indisponíveis.

`read_crm_appointments_analysis` exige `crm.stage.appointments.view` e a
permissão da visão solicitada. A RPC retorna somente fatos de agendamentos e
reindexa os dicionários. Sem `crm.ranking.view`, o servidor colapsa
empreendimento/loja e apaga nome e ranking da conta dos detalhes. Não há SELECT
direto para `anon`, `authenticated` ou `service_role`.

A leitura confere o cabeçalho do snapshot antes e depois da RPC. Mudança
concorrente repete uma vez e depois falha sem combinar gerações.

## Validação da exportação

Cada coleta executa `describe` e resolve, por rótulo e campo técnico esperado:

- Nome do empreendimento;
- Gerente Regional;
- Horário;
- Data de comparecimento;
- Visita Realizada;
- Conta: Nome da conta;
- Conta: Ranking.

O valor booleano de visita e os timestamps são validados por tipo. Coluna
ausente, rótulo divergente ou campo técnico inesperado bloqueiam a coleta. As
colunas necessárias são acrescentadas somente à instância de execução; o
relatório salvo não recebe PUT/PATCH.

O describe observacional de 20/10/2026 confirmou os sete campos no relatório
vigente. Nenhuma linha ou dado pessoal foi copiado para documentação.

## Implantação e retorno

1. Exigir lint, tipos, testes, build, pgTAP/restauração isolada e release-gates
   verdes no SHA exato.
2. Obter autorização específica para aplicar a migration aditiva
   `20261020050000_appointments_operations_v3.sql`; conferir histórico e
   backup das definições antes da transação.
3. Promover o CRM compatível v1/v2/v3 somente pelo coordenador
   `pnpm release:production`, com artefato imutável e consulta no minuto.
4. Atualizar o coletor pelo procedimento de CAS/backup de
   `salesforce-vps-collector.md`, preservando agenda, credenciais e destinos.
   O workflow n8n não muda: transporta o contrato normalizado.
5. Aguardar duas coletas distintas e reconciliar contagens e projeções dentro
   da aplicação protegida, sem copiar nomes de clientes para logs.

Antes da primeira carga v3, o leitor continua exibindo v1/v2. Após uma carga v3,
rollback do coletor preserva o último snapshot válido. Não reetiquetar versões,
apagar snapshots nem remover leitores de compatibilidade.

## Verificações

`pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` são
obrigatórios. `node scripts/qa/appointments-preview.mjs --production-css`
executa os três temas em 1440/1024/390/320, verifica acessibilidade, rótulos,
filtros, rolagem e overflow e grava capturas sintéticas em
`test-results/appointments-preview`.

O preview isolado não substitui pgTAP, CI nem smoke autenticado. A implantação
precisa provar uma carga v3 recente e a leitura autorizada sem registrar linhas
reais como evidência.
