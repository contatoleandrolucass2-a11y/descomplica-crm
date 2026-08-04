# Shell da interface protegida

O shell combina autenticação server-side com dois componentes client-side pequenos:

- `AuthorizedNavigation` recebe somente as páginas já filtradas por catálogo, RLS e permissões; usa a rota atual para `aria-current` e destaque visual.
- `ThemeSwitch` oferece `light`, `balanced` e `dark`, persiste apenas a preferência não sensível em `localStorage` e continua funcional sem armazenamento.

O tema não altera autorização, dados ou cookies de sessão. A preferência é aplicada em `data-theme` no elemento `html`; tokens globais ajustam superfícies, texto, bordas e campos sem copiar os milhares de estilos legados.

O CSS inclui foco visível e respeita `prefers-reduced-motion`. A navegação mantém rolagem horizontal em telas estreitas e quebra em múltiplas linhas a partir de `sm`.

## Validação

- Vitest valida o catálogo fechado dos três temas e rejeita valores persistidos desconhecidos.
- QA autenticada confirmou temas claro/equilibrado/escuro, persistência ao navegar para Ranking e item ativo.
- Em 1280 px, `clientWidth` e `scrollWidth` permaneceram iguais.

Filtros dimensionais do dashboard não pertencem a este incremento: eles dependem de registros normalizados por canal, gerente, responsável e empresa. Até esse read model existir, a interface não oferece filtros sem efeito ou dados demonstrativos.
