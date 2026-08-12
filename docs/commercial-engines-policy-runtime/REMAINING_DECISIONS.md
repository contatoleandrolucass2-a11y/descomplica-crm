# Decisões comerciais ainda ausentes

Nenhuma resposta abaixo pode ser inferida do legado, referência visual, código
v2 ou fixture.

## Comum a cada motor

- owner, backup e aprovador oficial;
- documento de evidência e vigência;
- schema exato de entrada/saída;
- regras, constantes, moeda/precisão e arredondamento; o fuso-base
  `America/Sao_Paulo` está definido, mas dia útil/corte/uso temporal não;
- casos de ouro normais, limites, erro e indisponibilidade;
- fonte de cada input e comportamento quando faltar;
- coorte, janela, observabilidade, thresholds e rollback.

## Por domínio

- WF13/WF14/WF15/WF16/CAIXA: contratos oficiais completos e fonte única de
  estoque/produto quando aplicável.
- Metas DV/Parcerias: competência, funil, taxas, mínimos, produtividade,
  retroatividade e vínculo com snapshot.
- Pontos/ranking: métricas, pesos, bônus, desempate, agregação, IDs e fechamento
  de competência.
- SLA: evento inicial/final, status de perda, relógio, exceções, deduplicação e
  responsável.
- Roleta: fonte, elegibilidade, frequência, auditoria e relação com ranking.
- Campanhas: público, vigência, critérios, acumulação e precedência.
- Premiações: catálogo, valores, tributação, autorização, estorno e vínculo com
  resultado fechado.

## Integrações deliberadamente não feitas

- formulários visuais dos simuladores continuam sem submit;
- `crm_funnel_goals`, `crm_point_settings` e ranking v2 não foram migrados para
  policies;
- read model v3 não chama o runtime;
- nenhuma policy/gate/grant foi seeded;
- nenhuma alteração remota, workflow n8n, Salesforce, Qlik, VPS, DNS ou Nginx.
