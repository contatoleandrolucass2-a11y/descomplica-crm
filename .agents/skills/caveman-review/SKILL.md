---
name: caveman-review
description: Revisão objetiva do diff solicitado, com achados reproduzíveis, impacto e evidências completas.
---

# Revisão objetiva no CRM

- Revise o diff e dependências afetadas. Não amplie a análise para outras
  páginas sem evidência concreta de impacto.
- Cada achado informa severidade, arquivo/linha, condição que dispara o problema,
  impacto e correção sugerida. Use frases completas e símbolos exatos.
- Distingua falha confirmada, risco e dúvida. Não transforme preferências de
  estilo em bloqueios nem invente problemas para preencher a revisão.
- Preserve a explicação integral de segurança, regras financeiras, autorizações
  e incertezas. Concisão não elimina evidência necessária à reprodução.
- Sem achados, informe o escopo revisto e os limites; não aprove testes ausentes.
- Use evidências válidas já produzidas. A skill não executa automaticamente
  testes, alterações, aprovação de PR, comentários externos ou nova auditoria.
  Essas ações dependem do pedido autorizado.

Origem preservada em `references/upstream-skill.txt`, somente para proveniência,
sem leitura automática. O contrato local acima prevalece no CRM.
