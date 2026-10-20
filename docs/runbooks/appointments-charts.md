# Gráficos de agendamentos

Fonte: relatório Salesforce `00OU600000ELaA6MAL`, página `/app/etapas/agendamentos`.
Implementação preparada em 19/10/2026; status operacional deve ser conferido em
`docs/knowledge/ATUALIZACOES.md`, PR/CI e health, sem confundir código e publicação.

## Definições

Os gráficos contam códigos de agendamento únicos após a deduplicação existente,
usando a data de criação no fuso America/Sao_Paulo, como a referência diária.
Somente fatos da etapa agendamentos entram na leitura. As visões comerciais e
a cobertura histórica permanecem as mesmas da coleta autorizada.

| Gráfico        | Coluna ou agrupamento                                              |
| -------------- | ------------------------------------------------------------------ |
| Dia            | Activity.CreatedDate                                               |
| Semana do mês  | Segunda a domingo; primeira/última podem ser parciais; 1ª até 6ª   |
| Mês            | Ano exclusivo deste gráfico; meses com contagem maior que zero     |
| Gerente        | Activity.Gerente_de_Vendas\_\_c                                    |
| Responsável    | Activity.Corretor\_\_c.Name                                        |
| Loja           | Activity.PDV\_\_c.Name                                             |
| Empreendimento | Activity.Nome_do_empreendimento\_\_c, label Nome do empreendimento |

O mês selecionado controla dia, semana e rankings. A troca do ano no gráfico
mensal não altera os demais. Rankings ordenam por quantidade decrescente,
desempatando pelo nome, e preservam a lista completa. Ausência de nome fica
explícita. Nenhum gráfico usa valores demonstrativos quando a fonte está ausente.
Cobertura parcial é informada; períodos fora da cobertura não viram zero.

Os sete cards usam a mesma altura. Valores e rótulos das colunas permanecem na
horizontal; séries extensas quebram em novas linhas. Cada card oferece rolagem
vertical própria quando o conteúdo ultrapassa a área, inclusive por teclado,
sem criar rolagem horizontal.

## Contrato e permissões

`dashboard.analysis.version=2` acrescenta `dimensions.stores` e índice de loja
na posição 10 de cada fato. As posições 0–9 permanecem iguais. Para agendamentos,
a posição 6 passa a apontar ao empreendimento real; snapshots v1 continham PDV
nessa posição. A interface mantém v1 como loja e exibe empreendimento indisponível
até a próxima coleta v2. Não converter dados antigos apenas trocando a versão.

`read_crm_appointments_analysis` exige `crm.stage.appointments.view` e a permissão
da visão solicitada. Retorna exclusivamente fatos de agendamentos e reindexa todos
os dicionários para excluir nomes de outras etapas. A proteção existente de
`crm.ranking.view` permanece para empreendimento e loja. Sem essa permissão,
o servidor colapsa dimensões e a interface informa a restrição. Não há grants
de leitura direta à tabela analítica para anon, authenticated ou service_role.

A leitura de metadados do snapshot antes e depois da RPC detecta ingestão
concorrente inclusive na precisão de microssegundos. Uma tentativa adicional é
permitida; persistindo a mudança, a leitura falha sem combinar gerações.

## Validação de exportação

Cada execução resolve a coluna de empreendimento nos metadados correntes,
validando label normalizado e campo técnico confirmado, e repete a conferência
no resultado. Coluna ausente do catálogo, label divergente/ambíguo ou campo
técnico diferente bloqueia a coleta. Quando o catálogo contém o campo e a
seleção não, a coluna é acrescentada somente à instância de execução; não há
PUT/PATCH do relatório salvo. A projeção usa os valores exportados daquele ciclo.

O relatório aberto em 19/10/2026 já continha essa coluna. Nenhuma edição remota
foi necessária para incluí-la. Isso não comprova que o coletor instalado já usa
o código novo nem que uma carga v2 real foi ingerida.

## Implantação e retorno

1. Aprovar CI do SHA exato: lint, tipos, testes, build, pgTAP/restore e release-gates.
2. Obter autorização específica para aplicar as duas migrations aditivas:
   `20261019031700_appointments_analysis_stores.sql` e
   `20261019031715_appointments_analysis_read.sql`. Preparar backup das definições,
   conferir histórico e ambiente e aplicar somente esses arquivos em transação.
3. Promover o CRM compatível v1/v2 pelo coordenador `pnpm release:production`,
   com CI/main, artefato imutável e consulta no minuto da troca, conforme runbooks.
4. Atualizar o coletor pelo procedimento de CAS/backup existente em
   `salesforce-vps-collector.md`, preservando agenda, credenciais e destinos.
   Não editar n8n: o workflow transporta o contrato já normalizado.
5. Aguardar coleta validada, confirmar versão 2 e reconciliar apenas agregados:
   total, somas diária/semanal/mensal e de cada ranking, sem exportar dados pessoais.
   Confirmar loja e empreendimento em dicionários independentes e valores vigentes.

Para retorno antes da primeira carga v2, manter o coletor anterior e as migrations
aditivas. Após uma carga v2, usar somente imagens/leitores compatíveis com ambas
as versões. Interromper a expansão do coletor se necessário, preservando o último
snapshot válido; não reetiquetar v2 como v1, não apagar snapshots e não remover
as funções de compatibilidade enquanto houver leitores/cargas dependentes.

## Verificações locais

`pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` são obrigatórios.
`node scripts/qa/appointments-preview.mjs --production-css` executa a matriz
sintética dos três temas e larguras 1440/1024/390/320, com acessibilidade,
legibilidade de rótulos, rankings completos, filtros independentes e ausência
de rolagem horizontal, com altura uniforme e rolagem vertical acessível quando
necessária. Capturas em `test-results/appointments-preview`
não contêm registros reais. Essa matriz isolada não substitui pgTAP nem smoke
autenticado da implantação.

A matriz autenticada geral usa uma fixture sem fatos analíticos e, portanto,
valida o estado indisponível da página, o shell e as permissões; não comprova
os sete gráficos preenchidos. As11 referências dessa página foram revisadas
do artefato12162399175 da CI39196528870, preservando231 imagens de outras rotas.
O manifesto mantém a comparação anterior, captura dirty e origem verify/falha;
a adoção parcial exige uma nova CI integral. O preview rico isolado é evidência
complementar e a conciliação da carga real v2 permanece obrigatória no rollout.
