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

## Usuários e acessos

O painel administrativo usa uma lista compacta e pesquisável por e-mail, papel
ou status. Cada linha expande sob demanda e separa explicitamente:

- permissões herdadas do papel, com nome e explicação em português;
- exceções individuais `allow`/`deny`, apresentadas como “permitida” ou “negada”;
- configurações avançadas para papel, status e exceções.

Antes do envio, a interface resume acessos adicionados e removidos e pede
confirmação. Motivos são obrigatórios no formulário quando há elevação,
desativação ou exceção; o banco repete essa regra de forma transacional. Depois
de mudar papel ou status, a tela explica que uma sessão já aberta deve sair e
entrar novamente caso precise renovar o estado local.

Controles usam elementos nativos (`input`, `select`, `details`, `summary` e
`button`), foco visível e áreas de toque mínimas. O layout não usa largura ou
altura fixa, quebra em uma coluna no celular e permanece legível a 200% de zoom
nos temas claro, equilibrado e escuro.

## Estados de navegação

- `AUTH-403`: “Você não possui acesso a esta página”, com retorno ao início;
- `ROUTE-404`: endereço não implementado ou inexistente, sem fingir restrição;
- `APP-500`/digest: falha inesperada, com nova tentativa e código de suporte.

O antigo `/unauthorized` permanece apenas como compatibilidade dinâmica e
aciona a mesma resposta HTTP 403. Isso evita regeneração de HTML dentro do
container read-only.
