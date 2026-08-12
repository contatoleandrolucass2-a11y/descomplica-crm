# Detalhes das etapas

## Rotas

`/app/etapas/[stage]` aceita cinco slugs versionados: `oportunidades`, `agendamentos`, `visitas`, `pastas` e `vendas`. Slugs desconhecidos retornam 404; todas as rotas exigem `crm.stages.view`.

## Dados e apresentação

Os detalhes reutilizam o read model normalizado do dashboard, sem tabela paralela ou payload JSON. Cada etapa oferece:

- visões geral, com Canal Imob e sem Canal Imob;
- períodos mês, semana e hoje;
- realizado, meta, gauge de atingimento, gap matemático e relação com o volume
  da etapa anterior;
- comparações de mês, 14 dias, 7 dias, semana e dia;
- funil completo para contexto do período;
- navegação sequencial entre as cinco etapas.

Sem snapshot `global`, a rota mostra estado de espera e não usa dados
demonstrativos. Janelas históricas ausentes não viram zero nem recebem fallback
da semana atual. Meta ausente ou igual a zero não desenha arco e não é tratada
como progresso zero.

Classificações de ritmo e recomendações editoriais foram removidas da
apresentação desta fundação porque não existe fonte oficial versionada para seus
thresholds. A atualização Salesforce permanece separada e autenticada.

## Validação

Os testes unitários cobrem os cinco slugs, comparações, relações do funil e a
preservação de campos nulos. A segurança e integridade dos dados continuam
cobertas pelo conjunto pgTAP do dashboard. A nova comparação autenticada está
pendente da disponibilização de ambiente de homologação e conta QA dedicada.
