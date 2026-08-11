# Auditoria visual final — correções da branch

Data: 11/08/2026. Branch: `codex/spec-gap-closure-production-readiness`.

## Correções incorporadas

| Prioridade | Achado                                                       | Correção                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1         | Identidade longa colidia com Configurações/Simulação em 1440 | Breakpoint antecipado para 90rem, cadeia `min-width: 0`, largura reservada e ellipsis; regressão browser mede truncamento e bounding boxes.                                                    |
| P1         | CTA comercial bloqueado parecia ação verde                   | Cinco simuladores usam o mesmo CTA não-verde, cadeado, motivo visível e `data-cta-state="blocked"`; controles locais seguem habilitados e estoque sem fonte usa estado indisponível tracejado. |
| P2         | Baixo contraste na conciliação do Canal                      | Heading dentro de card navy recebe cores explícitas para kicker, H2 e descrição nos três temas; botão bloqueado conserva contraste branco.                                                     |
| P2         | Ranking sugeria regra/pontuação oficial pendente             | Removidos “pontuação confirmada” e “Regra vigente” do estado bloqueado; texto obrigatório: “Nenhuma pontuação oficial foi calculada”.                                                          |
| P2         | Jargão técnico nas metas                                     | Interface usa política ativa, ativação, permissões e validar sem aplicar; hashes ficam em Detalhes técnicos.                                                                                   |
| P2         | H1 genérico nas metas de parcerias                           | H1 contextual: “Metas do funil de parcerias”.                                                                                                                                                  |
| P3         | Nomenclatura inconsistente de imobiliárias                   | Aplicação comercial padronizada para “imobiliárias”.                                                                                                                                           |
| P3         | “Meta por pontos” divergente                                 | Menu, breadcrumb, metadata, navegação local e H1 usam “Metas de pontos”.                                                                                                                       |
| P3         | Fonte sintética em inglês e ID exposto                       | Visão exibe “Dados sintéticos de homologação”; execução fica fechada em Detalhes técnicos.                                                                                                     |
| P3         | Origem dos valores do formulário ambígua                     | Ambos os formulários exibem “Base legada: somente leitura · Rascunho atual: editável”.                                                                                                         |

Flags comerciais permanecem desligadas, allowlists vazias e nenhuma política,
fórmula, pontuação ou valor oficial foi criada.

## Evidências

- [Matriz autenticada das 21 rotas](reference-parity/authenticated-results.json)
- [Capturas das 21 rotas](reference-parity/target-authenticated/)
- [Estados finais](final-states/README.md)
- [Resultado da homologação isolada](homologation/RESULTS.md)

## Resultado

O resultado final será registrado após promoção e verificação limpa da baseline,
execução integral das validações e nova revisão independente.
