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

Gate automatizado local aprovado no SHA de captura
`a33ec1b0f2f1ff1222288d032d84db1a6a12c6d9`:

- 147/147 combinações responsivas das 21 rotas;
- 84/84 checks de tema;
- 192/192 auditorias Axe e capturas promovidas;
- 105/105 checks de zoom;
- zero colisão de topbar;
- 100% dos contratos de truncamento e distinção de CTA aprovados;
- conta e fixtures QA efêmeras removidas.

A baseline foi promovida a partir de worktree limpa.

## Gate visual independente

Revisão read-only concluída no HEAD
`5271b2bb682ebe11fd5e6d7ea0f341c7360c7100`:

- **GATE VISUAL APROVADO**;
- P0: 0; P1: 0; P2: 0; P3: 0;
- 192/192 hashes de captura conferidos, sem divergência;
- topbar, cinco simuladores, Canal, Ranking, nomenclaturas, cópias e estados
  finais inspecionados;
- nenhum bloqueio visual residual.

Login, logout, 403 e 404 foram exercitados no fluxo real. As evidências de 500,
loading, empty, stale e error usam as superfícies compiladas no runtime local
isolado. A revisão não acessou a homologação viva e não autoriza política
comercial, merge, migration ou deploy.

## Validações finais

- `pnpm format` e `pnpm format:check`: aprovados;
- `pnpm lint`: aprovado;
- `pnpm typecheck`: aprovado;
- `pnpm test`: 263 aprovados e 1 skip remoto previsto;
- `pnpm build`: aprovado, 37 páginas/rotas geradas;
- `pnpm db:test`: 18 arquivos, 885 testes, aprovado;
- E2E local isolado: 8 aprovados e 1 skip remoto previsto; nove perfis e
  fixtures removidos;
- RLS via API local: nove perfis isolados, oito negações anônimas e zero linha
  anônima; nenhuma credencial persistida;
- `supabase db lint --local`: zero erro de schema;
- auditorias pnpm, OSV e gitleaks do diretório/histórico: zero achado;
- actionlint, shellcheck e os dois manifests Compose: aprovados.
