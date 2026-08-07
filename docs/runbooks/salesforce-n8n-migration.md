# Migração Salesforce → n8n → Supabase

## Estado seguro

A automação ativa anterior foi preservada. O workflow
`Descomplica CRM - Salesforce Ingest Candidate (inactive)` foi criado inativo,
sem credencial e sem node HTTP externo. Ele valida apenas a forma agregada e
rejeita campos de PII conhecidos. O workflow não deve ser ativado nem receber o
destino de produção antes dos gates deste runbook.

O workflow ativo `Funil de Vendas` recebeu em 6 de agosto uma alteração externa
de estoque que grava e remove linhas no Supabase antigo. Essa alteração não faz
parte desta migração, não foi modificada e não deve ser copiada para a candidata.

O `Atualizar Funil Salesforce` responde em cerca de 200 ms porque apenas aceita
o disparo assíncrono do exportador. Por isso suas execuções `success` não provam
o processamento completo. Após a inclusão externa de estoque, o exportador
passou a expirar aguardando o download de interface e não alcança o envio final;
o último processamento completo observado no transformador foi às 16:04 UTC de
6 de agosto. A candidata usa API para todos os sete relatórios e valida o fim da
coleta antes de produzir o snapshot.

## Fonte autorizada

| Chave         | Report ID            | Identidade usada na transformação                  |
| ------------- | -------------------- | -------------------------------------------------- |
| oportunidades | `00OU600000DrfDeMAJ` | `Opportunity` 006 retornado em `recordId`          |
| agendamentos  | `00OU600000ELaA6MAL` | código de agendamento, único e obrigatório         |
| visitas       | `00OU600000EboNZMAZ` | código de agendamento, sem exigir correspondência  |
| pastas        | `00OU600000EjufWMAR` | avaliação a1V e vínculo 006 quando disponível      |
| vendas        | `00OU600000EjFyyMAF` | `Opportunity` 006 retornado em `recordId`          |
| corretores    | `00OTT000009j0l32AA` | `Contact` 003, convertido para hash no `brokerKey` |
| Canal Imob    | `00OU6000006RqzxMAC` | conta 001 e nome da conta, sem campos de contato   |

Os IDs brutos existem na resposta da API, mas eram descartados pela geração do
XLSX legado. A candidata mantém os IDs apenas durante a transformação. O
`brokerKey` persistido é `sf-contact-` seguido de 32 caracteres hexadecimais de
SHA-256; IDs Salesforce brutos não entram no payload final.

## Projeção mínima

O exportador envia ao transformador somente os campos necessários:

- oportunidade: ID, criação, corretor, gerente, imobiliária, unidade e empreendimento;
- agendamento/visita: código, data, corretor, gerente, imobiliária e empreendimento;
- pasta: ID da avaliação, vínculo de oportunidade, data, corretor, gerente,
  imobiliária, empreendimento e status;
- venda: ID da oportunidade, data, corretor, gerente, imobiliária,
  empreendimento e valor;
- corretor: Contact ID, nome e status;
- Canal Imob: conjunto único de nomes de contas.

CPF, CNPJ, dados bancários, telefone, e-mail, data de nascimento e endereço não
são projetados, transportados ou persistidos.

## Regras

- as três visões são completas e mutuamente exclusivas: geral, contas presentes
  no relatório Canal Imob e restante;
- pastas do dashboard preservam todas as linhas únicas da avaliação;
- `approvedFolder` do ranking conta somente `Análise aprovada`;
- visitas sem agendamento, pastas sem oportunidade e vendas sem oportunidade
  permanecem nas métricas e aparecem somente como contagens diagnósticas;
- top empreendimentos usa oportunidades, evitando contar novamente a mesma
  passagem por pasta e venda;
- corretor ativo usa Contact ID estável; associação com atividades ocorre por
  nome normalizado e falha de gerente fica explícita;
- roleta não existe nos sete relatórios. O contrato v2 envia
  `rouletteAvailable=false`, mantém zero apenas como armazenamento técnico,
  exclui roleta da pontuação e mostra “Dados indisponíveis” na interface;
- metas não são calculadas pelo exportador. O contrato v2 envia
  `goalsAvailable=false`; o dashboard mostra “Fonte não configurada” e não
  apresenta progresso, atingimento ou gap como indicador comercial.

## Primeira coleta candidata

A execução controlada de 6 de agosto de 2026 retornou:

| Relatório     | Linhas |
| ------------- | -----: |
| corretores    |     27 |
| contas Imob   |      4 |
| oportunidades | 11.914 |
| agendamentos  |    816 |
| visitas       |    352 |
| pastas        |    465 |
| vendas        |    595 |

O contrato final contém três views, quinze métricas e 108 participantes de
ranking (27 corretores × quatro períodos). A validação encontrou 63 visitas sem
agendamento, 19 vínculos de pasta fora do recorte de oportunidades, 18 vínculos
de venda fora do recorte e 122 pastas aprovadas. As comparações por ID e por nome
produziram os mesmos totais. Nada foi descartado por essas divergências. O
relatório de oportunidades é recortado pela criação em 2026, enquanto pastas e
vendas podem referenciar oportunidades anteriores. Cinco dos 27 corretores
ativos ainda não possuem gerente resolvido e 195 nomes históricos/externos das
atividades não pertencem à base ativa atual; ambos permanecem diagnósticos, sem
criar identidades sintéticas.

## Gates antes da primeira escrita

1. aplicar isoladamente a migration de reconciliação do drift Qlik e obter 229/229 ou mais testes pgTAP remotos aprovados;
2. confirmar que `anon` não acessa tabelas e `service_role` conserva somente a RPC Salesforce autorizada;
3. manter a candidata inativa e validar o snapshot pelo schema Zod;
4. manter `goalsAvailable=false` até existir fonte oficial de metas;
5. manter `rouletteAvailable=false` até existir fonte oficial de roleta;
6. fazer backup protegido do Supabase novo e validar leitura/checksum;
7. gerar Bearers exclusivos para origem→n8n e n8n→CRM;
8. habilitar somente `SALESFORCE_INGEST_ENABLED` e manter refresh desativado;
9. enviar uma única requisição e reconciliar contagens, RLS, Auth e auditoria;
10. repetir exatamente o mesmo `requestId` e confirmar resposta idempotente;
11. somente depois ativar uma agenda de 30 minutos com lock não bloqueante.

O estado indisponível de metas e roleta foi autorizado para a primeira carga em
6 de agosto de 2026. Ele não autoriza inventar metas, percentuais ou eventos de
roleta. Antes da escrita, o PR deve ter todos os checks do GitHub Actions verdes
e a migration v2 deve passar por dry-run/auditoria e ser aplicada isoladamente.

## Rollback

- desativar imediatamente a candidata;
- definir `SALESFORCE_INGEST_ENABLED=false` e reiniciar somente o container da aplicação;
- manter o workflow antigo e seus backups sem alterações;
- o snapshot anterior do CRM permanece substituível por uma nova ingestão mais
  recente; não executar SQL manual, reset, seed ou limpeza;
- para restaurar configuração n8n, usar o export protegido e checksum capturados
  antes da mudança, nunca um JSON copiado para o repositório.
