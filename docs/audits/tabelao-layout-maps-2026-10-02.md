# Tabelao: layout e links de endereco

## Escopo

Pedido de 02/10/2026 com sete capturas. Destino explicitamente confirmado:
`/app/simulacao/tabelao`. Base `3960724`, branch `codex/tabelao-layout-maps`.
Preservar tipografia de 11px, paleta, filtros, agrupamento, formulas e demais
simuladores. A pagina publica de documentacao nao pertence a esta alteracao.

## Criterios de aceite

1. Cabecalho compacto como o Associativo, apenas Simulador Tabelao e icone de
   informacao alinhado; guia funcional e sem breadcrumb/eyebrow redundantes.
2. Apos Estoque: % obra, Limitador, Volta ao Caixa, Avaliacao, Valor do Imovel.
   Cabecalho, colgroup e corpo alinhados inclusive em linhas com rowspan.
3. Valor do Imovel dourado e destacado nos tres temas, preservando contraste.
4. Endereco da origem oficial atual, confirmada pelo usuario, com URL Google
   Maps montada a partir dos componentes presentes. Sem logradouro, sem link.
5. Recursos finais nesta ordem e com icones: Aprenda +, Politica comercial,
   Imprimir, Bora Vender e Salesforce. Aprenda + abre o guia existente.
   Em 03/10, usuario confirmou Politica comercial desabilitada e sem destino.
6. Impressao mostra a tabela e suas linhas, com contraste textual minimo 4,5:1
   nos tres temas; controles interativos nao aparecem.
7. Teclado, foco, celular, tablet, desktop, temas e ausencia de dados preservados.

## Limites de dados

- `/api/inventory` autoriza cada requisicao e consulta o endpoint oficial externo.
- `/api/inventory/snapshot` oferece a referencia protegida do ESTOQUE SPC.
- Nenhuma nova consulta SQL, migration, escrita remota, refresh ou regra comercial.
- Links externos conhecidos do projeto mantidos. O Maps so recebe o endereco
  quando o usuario aciona o link, sem geocodificacao automatica adicional.
- Sintaxe conferida na [documentacao oficial Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
- Enriquecimento recusa conflitos conhecidos de cidade, UF ou CEP; ausencias
  nao criam divergencias ficticias e multiplos contextos ambiguos nao sao unidos.
- Politica comercial permanece visivel, desabilitada e sem destino, conforme
  confirmacao do usuario em 03/10. Nao ha documento pendente para esta entrega.

## Verificacao

- Windows, Node 24.19.0, pnpm 11.20.0.
- Lint, typecheck e build iniciais aprovados.
- Duas suites integrais interrompidas sob baixa memoria, incluindo repeticao com
  dois workers, apos seis falhas POSIX conhecidas e timeouts locais. Nenhum
  teste/limiar foi reduzido para obter verde. CI Linux permanece obrigatoria.
- Dados/apresentacao: 283 testes aprovados; um timeout do snapshot passou na
  repeticao isolada com um worker. Contratos de interface: 18/18 aprovados, com
  8/8 do Tabelao repetidos pelo coordenador. Oito testes Node aprovados.
- Preview local com componentes/CSS reais e dados sinteticos: cabecalho, ordem,
  enderecos Maps e recursos vistos no navegador. Header do preview e uma fixture,
  portanto nao substitui autenticacao e matriz completa da CI.
- Provas funcionais de layout passaram em seis larguras, de 320 a 1440px,
  incluindo impressao e quatro criterios de Maps. Dourado/negrito passam em
  seis larguras por tres temas. Runner completo registrou tres assets 404 do
  preview, portanto nao foi declarado integralmente aprovado.
- CI, referencias visuais revisadas, imagem, publicacao e smoke final pendentes.

## Revisao final e bloqueio de publicacao

- PR [#139](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/139).
  Main 506b9e3 integrado em 8bf5572, preservando o ajuste concorrente do Associativo.
- CI [37086002430](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37086002430)
  aprovou formatacao, lint, tipos, 1465 testes Vitest (4 ignorados) e oito Node.
  Audit falhou em braces@3.0.3, transitivo do eslint-config-next. Build e gates
  posteriores nao executaram nessa CI; nao declarar aprovacao integral.
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  advisory consultado em 02/10/2026 informa nenhuma versao corrigida. A consulta
  `pnpm view braces@3.0.4 version dist.integrity dist.tarball --json` retornou E404.
  Nenhuma dependencia, excecao de auditoria ou limiar de release foi alterado.
- Revisao das capturas detectou texto claro sobre fundo branco na impressao.
  Correcao restrita ao print do Tabelao, com dourado escuro e textos de alto contraste.
  QA agora examina a cor dos textos descendentes e contraste em cada tema.
- Preview sintetico reconstruido: 20/20 verificacoes em 1440px e 390px, incluindo
  print em tres temas, guia, foco, ordem e Maps. Capturas desktop/celular e print
  inspecionadas; a captura de impressao espera terminar as transicoes de cor.
- Apos a correcao final: `pnpm lint`, `pnpm typecheck`, `pnpm build` e os 73
  testes de tabelao-archive/tabelao-presentation aprovados novamente.
- Evidencias locais: `%TEMP%/descomplica-tabelao-preview/captures/`, incluindo
  seis PNGs de tela, PNG/PDF de impressao e results.json. Sem dados de clientes.
- Producao nao foi modificada. Referencias visuais autenticadas, imagem imutavel,
  backup/rollback de release e verificacao pos-publicacao permanecem pendentes.

## Rechecagem em 03/10/2026

- Pedido de concluir/publicar mantem Politica comercial desabilitada. O componente
  ja possui `disabled`, sem href ou handler; nenhuma mudanca de runtime necessaria.
- PR #139 aberto, mergeable_state blocked, head 562465b, base 506b9e3.
  CI [37086793201](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37086793201)
  passou formatacao, lint, tipos, 1465 Vitest (4 ignorados) e oito Node; audit
  falhou no mesmo GHSA. Build, release-gates, restore e imagem nao executados.
- `pnpm audit --audit-level high` local reproduziu uma vulnerabilidade alta.
  `pnpm view braces version time.modified dist.integrity dist.tarball --json`
  confirmou latest 3.0.3, nao uma correcao. Advisory oficial ainda lista None.
- Consultas oficiais npm de fast-glob, micromatch e @next/eslint-plugin-next:
  latest 3.3.3, 4.0.8 e 16.3.8 respectivamente. Todos preservam o caminho para
  braces; uma atualizacao direta desses consumidores nao elimina o bloqueio.
- Sem instalar fork, modificar auditoria ou reduzir verificacoes. Producao nao
  foi alterada; correcao da dependencia e gates posteriores continuam pendentes.

## Gates e revisao visual em 03/10/2026

- Bloqueio de braces resolvido por substituicao do glob no plugin Next, sem
  ignorar auditoria. Detalhes: next-eslint-glob-2026-10-03.md.
- CI 37134880142 em c6432d3 aprovou formatacao, lint, tipos, 1475 Vitest,
  oito Node, audit sem vulnerabilidades, build, banco/advisors, E2E e restore.
- Matriz funcional aprovada: 140 rotas, 80 temas, 193 auditorias de acessibilidade,
  100 zooms, teclado, simuladores e calculadora de documentacao em 12 combinacoes.
  Vinte criterios novos do Tabelao e quatro de Maps passaram; print legivel nos
  tres temas, politica desabilitada, foco e navegacao confirmados.
- Somente 11 comparacoes visuais do Tabelao divergiram. Capturas inspecionadas
  em 1440, 1280, 1024, 768, 390, 375 e 320px, tres temas desktop e escuro mobile.
  Layout compacto, ordem, dourado, links sublinhados e recursos correspondem ao
  pedido. Rolagem horizontal confinada a tabela nos tamanhos estreitos.
- Artefato 11278718828; ZIP SHA256
  `0c62d3c5da1fdcd64f4beaf54a62a5c05eded4b89c465e7764b1e7bab3942c46`.
  Captura limpa 9949368034252f31ee00e229b96ad18806636021, arvore igual ao head
  c6432d3d31b9e3e880b183c3fc7d9a1bbd953d20. Todos os hashes conferidos.
- Promotor transacional versionado executado com predicado funcional original;
  11 referencias atualizadas, outras 182 byte a byte preservadas. Limiares
  permanecem 1% de pixels e tolerancia de canal 16. CI final/deploy pendentes.

## Publicacao concluida em 03/10/2026

- PR #139 integrado com protecoes, head f618ba68ac32eb7da5d96940aa3d650ebcf0a429
  e CI [37136895575](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37136895575)
  verde. Merge `8e158cc9d13beeff0087064df6d9b58d87790379`, arvore identica.
- CI main [37144378453](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37144378453)
  aprovou validate, release-gates, isolated-restore e promotable-image. Nenhum
  gate ignorado. Nao houve rebuild na VPS nem alteracao em banco/n8n.
- Artefato imutavel `11281592674`, ZIP SHA256
  `dbef472b027aecdf900318c41c07849db50cdb0256282efed3d53dc4586f2b92`.
  Arquivo image.tar.gz SHA256
  `817e56d6900ab8ba9e47691f0178caec8b9b00b01b77f66b501a9a3612852f03`.
- Config da CI: `sha256:de36c035cdcd43785ee389e5bdfdd37e343725dbf008b34a033623e402115601`.
  Manifest/ID local: `sha256:9190939521727bda6f0baad406a432c2fa80224b894b0b9f523d79298aac9ecc`.
  Comprovados index, manifest, config, tamanhos, hashes, plataforma linux/amd64,
  revision e onze camadas, incluindo RootFS da imagem carregada.
- `image:prove` reexecutado pelo script versionado: ambos os perfis usam a mesma
  imagem e validam segredo sintetico sem imprimir valores. Nginx -t aprovado.
- Anterior: `506b9e3a98f27f246c278287d0486a2e51e8a993`, image ID
  `sha256:b8ca4df15442c152d15469a922722a5ed74d04f59a304e51d6928e1242b85352`.
  Backup privado, no proprio servidor:
  `/var/backups/descomplica-crm/releases/8e158cc9d13beeff0087064df6d9b58d87790379.O9F2cb`.
  Ambiente e configuracao Nginx copiados e comparados, imagem anterior preservada.
- CAS oficial e wrapper promoveram a imagem. Container healthy, health interno
  e publico retornaram status ok e SHA exato. Estoque/snapshot anonimos: 401;
  rota protegida: 307. Rollback preparado, nao necessario.
- Chrome autenticado: estoque carregou; cabecalho, ordem das colunas, precos
  dourados/negrito, links Maps e cinco recursos conferidos em DOM e capturas.
  Politica comercial retornou disabled=true, sem link. Pagina deixada aberta.
  Nenhum estoque bruto, captura privada, sessao ou credencial foi versionado.
- Linhas sem logradouro na origem permanecem sem link, conforme contrato de
  dados validado; nao criar endereco ficticio. Origem oficial mantida.
- Pendencias anteriores de CI/imagem/deploy encerradas. Este registro posterior
  e somente documental e nao requer restart nem substituicao da imagem publicada.

## Rollback disponivel

Seguir automatic-publication.md e o runbook de imagem promovivel. Reverter por
imagem anterior com CAS; nao alterar estoque ou demais dados para reverter layout.
