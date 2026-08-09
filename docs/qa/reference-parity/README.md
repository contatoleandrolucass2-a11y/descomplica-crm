# Baseline e QA visual — fundação de paridade

Data: 2026-08-09. Branch: `codex/reference-parity-foundation`.

## Escopo executável

O harness `scripts/qa/reference-parity.mjs` cobre duas fronteiras:

1. captura das 18 páginas públicas da referência viva em `1440×900`, com
   máscara opaca irreversível aplicada antes do screenshot;
2. verificação sem sessão das doze rotas CRM protegidas do catálogo, seguida
   de captura do login vazio em `1440×900`, `1280×720`, `768×1024` e
   `390×844`.

Os resultados estruturados estão em [`results.json`](./results.json) e o
manifest com viewport, navegador, política de sanitização, tamanho e SHA-256 de
cada imagem está em [`manifest.json`](./manifest.json).

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

As 18 rotas responderam `200`, nenhuma gerou erro de página ou console e 2.969
regiões foram mascaradas. Os 26 WebP do conjunto completo foram inspecionados
com o Sharp e não contêm EXIF, ICC, XMP ou IPTC.

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

As doze rotas abaixo responderam `307` para `/login` tanto na versão anterior
implantada quanto no build local desta branch:

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

Nos quatro viewports, a navegação terminou em `/login`, o campo comercial
detectado foi zero, CSP/X-Frame-Options/nosniff permaneceram presentes e
nenhuma credencial foi fornecida. Cada rota usou contexto anônimo isolado; o
formulário público e a ausência de mutações foram confirmados antes e depois da
captura. Os WebP de antes e depois têm SHA-256 idêntico em cada viewport. As
imagens comparáveis estão em
[`target-before`](./target-before/) e
[`target-after`](./target-after/).

Esta comparação comprova a barreira anônima, não a paridade interna das páginas
protegidas.

## Bloqueio da comparação autenticada

A comparação autenticada foi interrompida somente nesta etapa. URL e credencial
QA de homologação não foram disponibilizadas nem localizadas no repositório, nos
environments/variables/secrets/deployments consultados do GitHub ou no ambiente
local. O Supabase local possui zero usuários e a documentação de homologação
contém apenas um placeholder. O Auth remoto não foi interrogado sem credencial
segura, portanto não se afirma a inexistência de conta remota.

Produção não foi usada para comparação autenticada; houve somente a leitura
anônima do limite já implantado para o conjunto “antes”. Contas Master/Admin
pessoais não foram usadas e nenhum usuário foi criado. Capturas internas, QA por
perfil, temas, teclado, zoom de 200% e reduced-motion no dashboard protegido
permanecem pendentes até o proprietário fornecer homologação e contas QA
dedicadas. O harness autenticado dessas interações ainda deverá ser implementado
nessa retomada; os comandos atuais não aceitam credenciais nem storage state.

Cada execução registra o commit base, se a árvore estava alterada e um SHA-256
determinístico do diff e dos arquivos não rastreados, excluindo os próprios
artefatos de captura. Assim, uma captura feita antes do commit final não é
atribuída falsamente a uma árvore limpa.

## Comandos

```bash
pnpm qa:browser:install
pnpm qa:visual:reference
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

O último comando deve apontar para um build local isolado com Supabase local ou
destino inacessível, sem cookies. Ele não autoriza uso de produção para QA
autenticada.
