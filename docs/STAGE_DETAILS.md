# Detalhes das etapas

## Rotas

`/app/etapas/[stage]` aceita cinco slugs versionados: `oportunidades`, `agendamentos`, `visitas`, `pastas` e `vendas`. Slugs desconhecidos retornam 404; todas as rotas exigem `crm.stages.view`.

## Dados e apresentação

Os detalhes reutilizam o read model normalizado do dashboard, sem tabela paralela ou payload JSON. Cada etapa oferece:

- visões geral, com Canal Imob e sem Canal Imob;
- períodos mês, semana e hoje;
- realizado, meta, atingimento, gap e conversão da etapa anterior;
- comparações de mês, 14 dias, 7 dias, semana e dia;
- classificação de ritmo e plano de ação por etapa;
- navegação sequencial entre as cinco etapas.

Sem snapshot `global`, a rota mostra estado de espera e não usa dados demonstrativos. A atualização Salesforce permanece fora deste incremento e será adicionada somente pela integração autenticada.

## Validação

Os testes unitários cobrem o catálogo, comparações e limites de atingimento. A segurança e integridade dos dados continuam cobertas pelos 26 testes pgTAP do dashboard. A QA autenticada verificou visão, período, conversão, histórico, navegação entre etapas e ausência de overflow; conta e fixture foram removidas por reset.
