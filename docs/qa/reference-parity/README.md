# Baseline e QA visual — fundação de paridade

Data: 2026-08-09. Branch: `codex/reference-parity-foundation`.

## Escopo executável

Os harnesses de QA visual cobrem três fronteiras:

1. captura das 18 páginas públicas da referência viva em `1440×900`, com
   máscara opaca irreversível aplicada antes do screenshot;
2. verificação sem sessão das 18 rotas CRM protegidas do catálogo, seguida
   de captura do login vazio em `1440×900`, `1280×720`, `768×1024` e
   `390×844`;
3. QA autenticado complementar das 21 rotas protegidas em Supabase local
   isolado, incluindo as três páginas administrativas, com
   conta QA efêmera, fixtures sintéticas e motores de simulação bloqueados.

Os resultados estruturados estão em [`results.json`](./results.json) e o
manifest com viewport, navegador, política de sanitização, tamanho e SHA-256 de
cada imagem está em [`manifest.json`](./manifest.json).
O QA local autenticado está em
[`authenticated-results.json`](./authenticated-results.json); suas 192 capturas
ficam em [`target-authenticated`](./target-authenticated/).

A baseline canônica continua comprovando todos os simuladores bloqueados. Quando
uma única chave oficial é liberada para canário, a rota correspondente e o hub
de simulação são comparados com suas baselines de estado habilitado em
[`target-authenticated-canary`](./target-authenticated-canary/). O primeiro
conjunto versionado é `simulator.wf13`; chave desconhecida ou rota sem conjunto
versionado falha fechada, sem aceitar diferença visual genérica.
As 11 capturas desse conjunto refletem também os campos de calendário, ranking,
anuais e memória auditável exigidos pela política WF13 `wf13-1.2.0`, sem alterar
a baseline canônica de motores bloqueados.

## Política de captura

- HTML, HAR, trace, vídeo, bodies, cookies e storage state não são gravados.
- A imagem PNG existe somente em memória e é convertida diretamente para WebP
  lossless pelo Sharp, sem metadados.
- Textos não incluídos na lista estrita de rótulos de navegação recebem máscara
  sólida `#173953`; blur não é usado.
- Tabelas, gráficos, funis, gauges, rankings, progressos, imagens, campos,
  embeds, custom elements, superfícies opacas, transforms, backgrounds gráficos
  e conteúdo gerado recebem máscara integral em toda a página, inclusive fora
  de `main`.
- Requisições de terceiros e todos os métodos não idempotentes são bloqueados
  durante a captura.
- Animações e transições são desligadas na baseline canônica.
- Rota, erros e mutações do DOM são validados antes e depois do screenshot; os
  pixels ficam em memória e só são promovidos após o conjunto inteiro passar.
- Capturas do login ficam com os campos vazios.

## Resultado da referência

As 18 rotas responderam `200`, sem erro de página ou erro de aplicação no
console, e 2.969 regiões foram mascaradas. Erros de rede produzidos pelo bloqueio
intencional do harness são contados separadamente e não ocultam erros da
aplicação. Os 26 WebP do conjunto completo foram inspecionados com o Sharp e não
contêm EXIF, ICC, XMP ou IPTC.

Capturas:

- [`dashboard`](./reference/dashboard-1440x900.webp)
- [`oportunidades`](./reference/etapas-oportunidades-1440x900.webp)
- [`agendamentos`](./reference/etapas-agendamentos-1440x900.webp)
- [`visitas`](./reference/etapas-visitas-1440x900.webp)
- [`pastas`](./reference/etapas-pastas-1440x900.webp)
- [`vendas`](./reference/etapas-vendas-1440x900.webp)
- [`ranking`](./reference/ranking-1440x900.webp)
- [`canal de parcerias`](./reference/canal-de-parcerias-1440x900.webp)
- [`configurações`](./reference/configuracoes-1440x900.webp)
- [`metas`](./reference/configuracoes-metas-1440x900.webp)
- [`metas de parcerias`](./reference/configuracoes-metas-parcerias-1440x900.webp)
- [`metas de pontos`](./reference/configuracoes-metas-pontos-1440x900.webp)
- [`índice de simulação`](./reference/simulacao-1440x900.webp)
- [`associativo fluxo linear`](./reference/simulacao-associativo-fluxo-linear-1440x900.webp)
- [`documentação`](./reference/simulacao-calcular-documentacao-1440x900.webp)
- [`CAIXA`](./reference/simulacao-caixa-1440x900.webp)
- [`tabela direta`](./reference/simulacao-tabela-direta-1440x900.webp)
- [`tabela investidor`](./reference/simulacao-tabela-investidor-1440x900.webp)

## Limite anônimo antes e depois

As doze rotas já existentes responderam `307` para `/login` tanto na versão
anterior implantada quanto no build local desta branch:

- `/app`;
- `/app/etapas/oportunidades`;
- `/app/etapas/agendamentos`;
- `/app/etapas/visitas`;
- `/app/etapas/pastas`;
- `/app/etapas/vendas`;
- `/app/ranking`;
- `/app/canal-de-parcerias`;
- `/app/configuracoes`;
- `/app/configuracoes/metas`;
- `/app/configuracoes/metas/parcerias`;
- `/app/configuracoes/metas/pontos`.

No build local, as seis rotas novas também responderam `307` para `/login`:

- `/app/simulacao`;
- `/app/simulacao/associativo-fluxo-linear`;
- `/app/simulacao/calcular-documentacao`;
- `/app/simulacao/caixa`;
- `/app/simulacao/tabela-direta`;
- `/app/simulacao/tabela-investidor`.

Nos quatro viewports, a navegação terminou em `/login`, o campo comercial
detectado foi zero, CSP/X-Frame-Options/nosniff permaneceram presentes e
nenhuma credencial foi fornecida. Cada rota usou contexto anônimo isolado; o
formulário público e a ausência de mutações foram confirmados antes e depois da
captura. Os WebP de antes e depois têm SHA-256 idêntico em cada viewport. As
imagens comparáveis estão em
[`target-before`](./target-before/) e
[`target-after`](./target-after/).

Esta comparação comprova a barreira anônima. A paridade interna é coberta pelo
QA local autenticado abaixo.

## QA autenticado local complementar

Um build de produção local foi conectado exclusivamente ao Supabase local. O
runner descobre as chaves locais somente em memória, reserva uma porta loopback,
inicia e encerra `pnpm start`, cria uma identidade `qa.*@local.invalid` com senha
efêmera e não persiste credenciais ou storage state. A conta recebe o único
papel `master` local somente durante a execução, pois os read models v2 globais
permanecem Master-only até o cutover v3. Dashboard, metas, pontos e ranking recebem
fixtures marcadas internamente por execução; a visão comercial exibe somente
`Dados sintéticos de homologação` e mantém o identificador sob `Detalhes
técnicos`. Contagens e marcador são validados novamente pela sessão QA através
da RLS antes de qualquer captura. Fixtures e conta são apagadas no `finally`,
inclusive em falha ou sinal.

O setup falha fechado se os slots locais `global`, `default` ou as metas do mês
já estiverem ocupados; nenhum dado local existente é sobrescrito. O serviço
local, o banco e a aplicação precisam usar endpoints loopback. Chave privilegiada
nunca é enviada ao navegador ou ao harness de captura.

### Matriz autenticada aprovada no SHA de fechamento

O harness executou a captura autenticada local, limpa e transacional com:

- sete viewports: `1440×900`, `1280×720`, `1024×768`, `768×1024`, `390×844`,
  `375×812` e `320×568`;
- 21 rotas em tema claro nos sete viewports;
- as 21 rotas em tema escuro móvel no viewport `390×844`;
- capturas desktop dos temas claro, equilibrado e escuro para as três páginas
  administrativas, além das amostras visuais já existentes;
- reflow equivalente a zoom de `80%`, `100%`, `125%`, `150%` e `200%`, sempre
  sobre canvas físico de `1440×900`;
- reduced motion e Axe nas 147 combinações responsivas, nas 24 amostras desktop
  de tema e nas 21 combinações mobile dark.

A matriz aprovou 147 capturas responsivas, 45 capturas de tema, 192 auditorias
de acessibilidade, 192 comparações e 105 checks de zoom. A promoção ocorreu por
rename transacional com rollback, a partir de worktree limpa e sem alteração do
fingerprint durante a captura.

Resultados aprovados:

- 147/147 checks responsivos: 21 rotas em sete viewports;
- 84/84 checks de tema: 21 rotas em mobile dark e oito amostras desktop nos
  temas claro, equilibrado e escuro;
- 192/192 auditorias WCAG A/AA com Axe: matriz responsiva completa e amostras
  de tema, sem violações;
- 105/105 checks de zoom: 21 rotas em `80%`, `100%`, `125%`, `150%` e `200%`;
- disclosure aberto por teclado, fechado com `Escape`, foco devolvido e `Tab`
  alcançando controle interativo;
- campo obrigatório de simulador sinalizado após blur com `aria-invalid`,
  mensagem associada e retorno ao estado válido após preenchimento local;
- `prefers-reduced-motion: reduce` ativo em todos os contextos;
- zero overflow raiz, erro de console, erro de página, rota desviada ou motor de
  simulador habilitado;
- zero colisão entre navegação e identidade de sessão, com truncamento pronto
  para nomes longos;
- CTAs habilitado, bloqueado e indisponível com estilos computados distintos;
- 147 capturas rota×viewport e 45 amostras de tema, sem metadados;
- 192/192 comparações contra o baseline versionado dentro do limiar máximo de 1%
  de pixels alterados, com tolerância de 16 níveis por canal.

As capturas autenticadas usam somente identidades e valores sintéticos com
prefixo QA. Elas permitem comparar composição, densidade, reflow e estados com
o baseline versionado de regressão do próprio alvo. A comparação com as
capturas da referência viva continua sendo uma revisão visual humana separada;
nenhuma dessas evidências constitui comparação de métricas comerciais.

## Comparação autenticada em homologação

A homologação isolada existe em `https://homolog.descomplicapro.com.br/`, com
Basic Auth, contas QA sintéticas e banco próprio. A evidência remota versionada
ainda corresponde ao SHA-base; deve ser regenerada depois do SHA final deste
incremento. Produção não é substituta e contas Master/Admin pessoais continuam
proibidas.

Cada execução registra o commit base, se a árvore estava alterada e um SHA-256
determinístico do diff e dos arquivos não rastreados, excluindo os próprios
artefatos de captura. Assim, uma captura feita antes do commit final não é
atribuída falsamente a uma árvore limpa.

## Comandos

```bash
pnpm qa:browser:install
pnpm qa:visual:reference
pnpm db:start
pnpm build
pnpm qa:visual:authenticated
# somente após revisar os candidatos e autorizar a nova baseline local:
pnpm qa:visual:authenticated --update-baseline
QA_TARGET_ORIGIN=https://crm.descomplicapro.com.br \
  QA_TARGET_LABEL=target-before \
  pnpm qa:security:anonymous
QA_TARGET_ORIGIN=http://127.0.0.1:3100 \
  QA_TARGET_LABEL=target-after \
  pnpm qa:security:anonymous
```

Em uma imagem mínima de CI, instale também as bibliotecas do sistema com
`pnpm exec playwright install --with-deps chromium`. A origem é obrigatória,
deve ser apenas `http(s)://host[:porta]`, sem credenciais, caminho, query ou
fragmento; o rótulo aceita somente `target-before` ou `target-after`.

O runner autenticado aceita `QA_AUTH_ORIGIN` somente como origem HTTP loopback
opcional; sem ela, escolhe uma porta local livre. Os comandos de fronteira
anônima não recebem cookies. Nenhum deles autoriza usar produção para QA
autenticada.

O modo padrão nunca altera a baseline versionada. Capturas e diagnóstico da
execução ficam em `test-results/authenticated-visual/`, ignorado pelo Git. O
modo `--update-baseline` também exige que a baseline inicial corresponda ao
`HEAD` e só a promove, por troca atômica com rollback, depois de todos os checks
funcionais e de acessibilidade passarem. Hashes dos 192 arquivos usados ficam
registrados na evidência; uma falha nunca atualiza a baseline.

## Estados do gate final

As superfícies atuais de login, logout, 403, 404, 500, loading, empty, stale e
error ficam em [`../final-states`](../final-states/). O E2E usa contas QA
sintéticas e diferencia capturas do fluxo real das composições dos componentes
de estado. Identificadores técnicos permanecem fechados em disclosure.
