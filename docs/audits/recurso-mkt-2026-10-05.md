# Recurso MKT - publicacao de 05/10/2026

## Escopo

- PR: [#152](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/152).
- Head validado: `0cd87d7f05ed7e78bb84a66ca9cdf55edd432da6`.
- Merge e runtime publicado: `edbfcd13d77e0c93f2acac894f620eac8427d4cf`.
- Arvore identica entre head e merge: `d3d53b58b49aff3e9fc382dfb8d8387b354af3a9`.
- Destino: `https://crm.descomplicapro.com.br/app/configuracoes/recurso-mkt`.

A guia fica em Configuracoes, com o cabecalho e os tokens da Tabela Associativo.
Preserva fundo de R$ 2.500,00, custo de R$ 1.000,00, duas vendas, rateio
40/30/20/10, todos os destinos e cinco conversoes do print. Alteracoes de fundo
e custo existem apenas no estado local; nenhuma politica ativa e gravada.
Acesso exige `crm.settings.manage`, pai autorizado e gate de release.

## Gates

- CI do PR: [37314518298](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37314518298),
  com validate, isolated-restore e release-gates aprovados.
- CI da main: [37322433490](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37322433490),
  com os quatro jobs aprovados, incluindo promotable-image.
- E2E dos nove perfis e rota direta; 154 checks responsivos, 88 temas,
  209 Axe/comparacoes, 110 zooms e 40 menus. Nova guia: 12 combinacoes de
  quatro larguras e tres temas, valores, recalculo, erros, reset e teclado.
- Oito referencias de Configuracoes revisadas na base combinada com o PR #154.
  Outras 201 imagens e os contratos de canvas foram preservados.
- Lint, tipos e build locais aprovados. Suite Windows na base combinada:
  1950 testes aprovados, sete condicionais ignorados e seis falhas POSIX.
  Suite Linux integral aprovada na CI, sem mascarar essas falhas.
- Nenhuma migration adicionada ou aplicada; nenhum workflow n8n alterado.

## Imagem imutavel

- Artefato `11351136035`, `promotable-image-edbfcd13d77e0c93f2acac894f620eac8427d4cf`.
- SHA-256 do arquivo: `f04d8bbf87fa20b89b41093d86d7a9159e2ec9ef196715e8c9fe63121be9b25b`.
- Configuracao CI: `sha256:985d4e919584fa39bd912a81325ee7c744752378b0dedebafb7df091136fe48c`.
- Manifesto OCI/local: `sha256:81e3822fd4b8feb2276f79960d5b39e644cad4c1aafe9958534f9d413fa0b1c7`.
- Index, manifesto, configuracao, label, plataforma, camadas legadas e 11
  diff_ids conferidos sobre o mesmo arquivo aprovado. Dois perfis de runtime
  comprovados novamente na VPS com fixtures sinteticas. Sem rebuild ou retag.

## Backup e rollback

- Versao anterior: `afdb1c98cecdfb2b6ba7bbaf59192c448835cfbb`.
- Imagem anterior: `sha256:837c32d9e5a6ba0d04f90a7d170fe7483a134b71fe2238dd7ab5f25789cbb5a1`.
- Backup: `/var/backups/descomplica-crm/releases/edbfcd13d77e0c93f2acac894f620eac8427d4cf.TFSIHE`.
- SHA-256 de SHA256SUMS: `7141f20b2828889db1044d3723aa99b50e4f907a2fc75d57253e377453e90bed`.
- Diretorio root-only 0700; tres arquivos e manifesto 0600, checksums e fsync
  verificados. Conteudo privado nao exportado para Git ou logs.
- Bind por CAS da versao anterior exata, seguido pelo wrapper root-only.
  Rollback preparado pelo CAS reverso para a imagem anterior, sem reversao de banco.

## Smoke e limites

- Container iniciou em `2026-10-05T14:47:04.297Z` (11:47 BRT).
- Cinco healthchecks publicos consecutivos: HTTP 200, status ok e SHA exato.
- Container healthy, zero reinicios, sem OOM e zero padroes criticos nos logs.
- Nova rota sem sessao: HTTP 307 para `/login`, no-store e cabecalhos de
  seguranca presentes. Nenhum conteudo comercial exposto.
- A jornada autenticada MKT foi comprovada na CI com identidade sintetica.
  Nenhuma conta pessoal foi usada para QA dessa guia em producao.
- DNS, contas, cobrancas, dados remotos e politicas comerciais nao alterados.
- Este registro posterior e apenas documental; nao exige outro restart.
