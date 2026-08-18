# Gate de QA — WF13 ranking e anuais

## Resultado local

Executado em 18/08/2026 sobre a branch `codex/wf13-ranking-annual-parity`,
base `189a9d34c115f5153ecff5693a6d2bc5320c101c`.

| Gate                                 | Resultado                                                 |
| ------------------------------------ | --------------------------------------------------------- |
| Matriz Looker × site                 | 30/30 cenários reconciliados; diferença exata documentada |
| Fronteiras anuais                    | 9/9 cobertas                                              |
| Regressão PDF 2                      | R$ 17.000,00 · R$ 202,38 · R$ 288,67 · 15/09/2026         |
| E2E isolado                          | 8/8 executados; 1 remoto corretamente ignorado            |
| Perfis                               | Master executa WF13; oito perfis bloqueados; anônimo 401  |
| Rotas responsivas                    | 147/147                                                   |
| Temas                                | 84/84                                                     |
| Axe e acessibilidade                 | 192/192                                                   |
| Comparações visuais                  | 192/192                                                   |
| Zoom                                 | 105/105 rotas; 80%, 100%, 125%, 150% e 200%               |
| Teclado e foco                       | aprovado                                                  |
| Reduced-motion                       | aprovado                                                  |
| Persistência de fixtures/credenciais | zero; conta efêmera removida                              |

Os sete viewports são `1440×900`, `1280×720`, `1024×768`, `768×1024`,
`390×844`, `375×812` e `320×568`. Os três temas são claro, equilibrado e
escuro.

## Evidências versionadas

- resultado integral: `docs/qa/reference-parity/authenticated-results.json`;
- desktop WF13: `docs/qa/reference-parity/target-authenticated/simulacao-associativo-fluxo-linear-1440x900.webp`;
- celular WF13: `docs/qa/reference-parity/target-authenticated/simulacao-associativo-fluxo-linear-390x844.webp`;
- temas WF13: arquivos
  `docs/qa/reference-parity/target-authenticated/themes/simulacao-associativo-fluxo-linear-*-1440x900.webp`;
- matriz de ranking: `looker-site-ranking-matrix.csv`;
- matriz anual: `annual-boundary-matrix.csv`;
- auditoria das fórmulas: `docs/simulators-official/WF13_LOOKER_AUDIT.md`.
- hotfix do comprometimento e limite 84:
  `docs/simulators-official/WF13_PRO_SOLUTO_HOTFIX.md`.

As capturas representam dados sintéticos e não contêm credenciais. O gate
funcional ativo foi exercitado pelo E2E Master; a baseline canônica preserva o
estado fail-closed quando a flag está desligada. A validação HTTPS ativa será
repetida na homologação antes do canário produtivo.
