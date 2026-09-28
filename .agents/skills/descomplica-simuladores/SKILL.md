---
name: descomplica-simuladores
description: Implementar ou conferir Associativo, Tabela Direta, Investidor, Tabelao, documentacao e CAIXA no DESCOMPLICA-CRM. Usar em calculos, datas, estoque selecionado, politicas oficiais e contratos de simulacao.
---

# Simuladores e exatidao

- Localize a rota em app/(protected)/app/simulacao e os contratos em
  lib/crm/simulators/official, lib/crm/commercial-engine e lib/archive-investor.
- Confira qual runtime esta habilitado. Catalogo, interface disponivel, canario
  Master e motor oficial ativo sao estados distintos.
- Busque knowledge:search com simulador e regra. Confirme a politica versionada
  e vigencia no codigo; memoria e prototipos nao criam regras comerciais.
- Preserve arredondamento, totais, parcelas e fronteiras de datas. Teste valores
  de limite, mes de transicao, troca de fuso, fontes ausentes e entrada invalida.
- Em Associativo confira a regra vigente de evolucao da obra e os casos golden
  antes de modificar; nao estenda a regra automaticamente aos outros motores.
- Utilize testes do simulador, wf13-policy, wf13-official, matriz Looker e
  fixtures golden conforme o caminho afetado. Nao invente aprovacao oficial.
- Alteracao visual/desempenho nao autoriza mudar taxas, limites ou formulas.
  Propostas em andamento nao podem ser sobrescritas por respostas atrasadas.
- Nao invoque workflows reais para validar inputs sinteticos sem autorizacao.
  N8n existente segue estritamente a regra MCP do projeto.
