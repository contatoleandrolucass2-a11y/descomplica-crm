# Evidências da homologação isolada

Execução: 11/08/2026. Origem: `https://homolog.descomplicapro.com.br`.
Classificação: somente dados sintéticos `@local.invalid`; nenhum dado ou
credential de produção foi usado.

## Resultado

- Gate externo: `401` antes do login; Basic Auth obrigatório.
- Login/logout e autorização: nove perfis sintéticos aprovados.
- Matriz de acesso: 21 rotas protegidas verificadas por perfil.
- E2E HTTPS: 7/7 cenários aprovados.
- Responsividade: 72/72 checks — 18 páginas em `1440×900`, `1280×720`,
  `768×1024` e `390×844`.
- Temas: 54/54 checks — claro, equilibrado e escuro.
- Acessibilidade: 87/87 auditorias Axe WCAG A/AA sem violação.
- Comparação visual: 87/87 dentro do limite de 1%; maior diferença observada
  `0,0885%`.
- Zoom 200%: 18/18 rotas; teclado, foco, reduced-motion e validação acessível
  aprovados.
- Read model v3: visível somente nesta homologação sintética.
- Relay Qlik e Salesforce: desligados.
- Simuladores: visualmente completos; motores bloqueados, sem cálculo,
  persistência ou política comercial presumida.

## Proteções verificadas

- HTTPS válido para o subdomínio exclusivo; `X-Robots-Tag` e metadado
  `noindex, nofollow, noarchive`; `robots.txt` bloqueia todo crawler.
- Cadastro público ausente da UI, rota `/register` em `404` e Server Action
  fail-closed.
- Cookie restrito a `homolog.descomplicapro.com.br`, sem compartilhamento com
  produção.
- Aplicação em `127.0.0.1:3100`; banco/Auth/rede/volume exclusivos. Portas
  Docker do Supabase protegidas pela chain dedicada `DOCKER-USER`.
- Nove contas persistentes de QA, exatamente uma por papel, em arquivo
  root-only `0600`. E-mails, senhas, UUIDs e chaves não foram persistidos nas
  evidências.
- Nginx validado com `nginx -t`; backup anterior root-only com checksum válido.
- Produção respondeu `{"status":"ok"}` antes, durante e depois da ativação.

## Evidências visuais

- [Dashboard desktop](evidence/dashboard-desktop.webp)
- [Dashboard celular](evidence/dashboard-mobile.webp)
- [Ranking](evidence/ranking.webp)
- [Canal de Parcerias](evidence/canal-de-parcerias.webp)
- [Etapa — Oportunidades](evidence/etapa-oportunidades.webp)
- [Hub de Simulação](evidence/simulacao-hub.webp)
- [WF13](evidence/wf13.webp)
- [CAIXA](evidence/caixa.webp)
- Temas: [claro](evidence/theme-light.webp),
  [equilibrado](evidence/theme-balanced.webp) e
  [escuro](evidence/theme-dark.webp)

Os screenshots mostram apenas fixtures sintéticas com nomes terminados em
`QA`. O banner aparece nas capturas de checkpoint do Dashboard; foi ocultado
somente nas imagens usadas pelo comparador para manter compatibilidade com a
baseline versionada anterior.

## Recursos e rollback

Recursos exclusivos: container `descomplica-homologation-app`, projeto local
Supabase `descomplica-homologation`, rede
`supabase_network_descomplica-homologation`, cache exclusivo, vhost/logs Nginx
exclusivos, certificado TLS e apenas o novo registro DNS `homolog A`.

O rollback não toca produção: retirar o symlink do vhost após `nginx -t`,
recarregar Nginx, parar somente o Compose/Supabase de homologação, retirar a
chain dedicada e remover somente o novo registro DNS. O backup Nginx anterior
teve checksum validado e o inventário prova nomes, redes, volumes e portas sem
colisão. A desmontagem destrutiva não foi executada porque eliminaria o
ambiente entregue para revisão humana.

## Limites mantidos

Nenhum merge, migration remota, cutover ou deploy de produção foi executado.
Supabase de produção, n8n, Qlik, Salesforce, container da aplicação de
produção, dados, grants e flags de produção não foram alterados. Permanecem
pendentes as decisões do
[pacote único de aprovações](../../release-candidate/APPROVAL_PACKAGE.md).
