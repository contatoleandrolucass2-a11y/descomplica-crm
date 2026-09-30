# Identidade e navegacao dos simuladores

Data: 2026-09-29. Branch: codex/identidade-navegacao-temas.
Status: implementado; PR #109 em validacao visual. Ainda nao publicado.

## Escopo

Associativo, Tabela Direta, Tabela Investidor e Tabelao compartilham marca e
navegacao. Sem alteracoes de formulas, politicas financeiras, autorizacao das
rotas, estoque, banco, migrations ou n8n. Demais shells permanecem intactos.

## Decisoes

- Marca tipografica, monograma verde e ponto de assinatura; sem subtitulo.
- Cabecalho sem capsula decorativa; navegacao e preferencias separadas.
- Telas menores usam disclosure. Primeiro Escape fecha submenu, o seguinte
  fecha navegacao e devolve foco ao acionador. Icones Lucide ja instalados.
- Submenus sao links, sem semantica de menu de aplicativo. Remove a entrada
  duplicada do Associativo, preservando uma entrada por destino.
- Recursos indisponiveis identificados como Em breve dentro dos submenus.
- Temas com nome, icone e aria-pressed; nao dependem apenas de cor.
- Consentimento lido no servidor. Sem ele, tema funciona na pagina sem storage.

## Referencias

Consultadas em 2026-09-29; referencias de interacao, nao copias de marca:

- [Carbon: UI shell header](https://carbondesignsystem.com/components/UI-shell-header/usage/):
  identidade persistente, separacao de utilitarios e recolhimento responsivo.
- [Radix: segmented control](https://www.radix-ui.com/themes/docs/components/segmented-control):
  selecao exclusiva com estado reconhecivel.
- [Vercel: Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md):
  foco, semantica, toque e temas.
- Guias locais Next 16.3.3: Server and Client Components, CSS e Link.

## Verificacao

- Primeira implementacao: typecheck e build aprovados.
- CUA com componente real em harness local sem auth/dados reais: tres temas
  do cabecalho, submenu mobile e Escape em dois niveis. Nao substitui CI autenticada.
- Contratos das tres tabelas: 57 aprovados apos atualizar expectativas dos links.
- Suite completa inicial Windows: 976 aprovados, um skip, seis falhas POSIX,
  tres expectativas antigas de links corrigidas e dois timeouts do Obsidian
  durante concorrencia local. Reteste isolado Obsidian: 22 aprovados; CI Linux pendente.
- Lint inicial sem erros; diretiva desnecessaria apontada foi removida.
- Contraste calculado por luminancia sRGB no texto ativo do cabecalho: o par
  inicial #087e6a/#e4f5ee tinha 4.42:1 e foi corrigido para #087461/#e4f5ee.
  A medicao dos tokens nao substitui axe sobre o resultado renderizado.
- Inventario de recursos aprovado; onze testes de layout/shell/catalogo aprovados.
- Matriz ampliada, temas do conteudo e referencias visuais pendentes.
- Implementacao dos temas: 1.735 declaracoes de cores convertidas para tokens
  restritos ao conteudo dos simuladores. Comparacao PostCSS preservou 29.587 nos
  de estrutura, geometria, tipografia e media queries; regras de impressao preservadas.
- Auditoria local do Associativo sintetico: 1.055 elementos sem mudanca geometrica,
  210 pares de tokens aprovados (minimo 6,21:1), zero violacoes axe detectadas.
  Houve 52 nos inconclusivos por tema; essa analise nao certifica todos os estados.
- Revisao independente corrigiu perda de foco ao voltar para desktop e reset da
  escolha de tema ao conceder consentimento. Verificacao integrada pendente.
- Lint, typecheck, build e 62 testes focados aprovados na segunda rodada local.
  Suite completa Windows: 983 passaram, um skip, seis falhas POSIX e dois
  timeouts Obsidian; uma expectativa de cor literal falhou e foi corrigida,
  com reteste focado aprovado. CI Linux permanece obrigatoria.
- Matriz de navegacao detectou fechamento antecipado no pointerdown que
  deslocava o submenu Configuracoes antes do click mobile. A fronteira de
  dismiss agora abrange a navegacao, mantendo fechamento externo e exclusao
  mutua. Hook sem fronteira explicita preserva o comportamento anterior.
- Novo gate verifica quatro rotas, dez viewports e tres temas, sem reduzir
  o manifesto historico nem seus limites de regressao. Preview sem autenticacao
  nao aprova a evidencia integrada.
- Preview final do cabecalho: 40 combinacoes e tres temas aprovados, incluindo
  pontos 1180/1181, teclado, troca de disclosure e foco. Next APIs simuladas;
  nao e evidencia de autenticacao nem dos quatro conteudos completos.
- CI Linux 36650605575, candidato ecb015f: formatacao, lint, typecheck, testes,
  audit, compressao Nginx e build aprovados. Banco, advisors, restauracao
  isolada e E2E autenticado aprovados. Matriz parou no novo gate de navegacao:
  uma acao na Direta/320 expirou e seis leituras de cor ocorreram em transicao.
  Nenhuma baseline foi promovida com esse resultado.
- O gate aguarda tema, token computado, fim de transicao e duas amostras iguais.
  Acoes limitadas a dez segundos; timeout de navegacao preservado. Progresso e
  diagnostico estrutural sanitizado sao persistidos por caso, com screenshot
  de falha apenas na fixture CI isolada. Casos e thresholds inalterados.
- Preview completo dos quatro componentes, apos a estabilizacao: 40/40 checks,
  tres temas por caso, mudanca de pixels do conteudo e zero erros de navegador.
  Direta/320 aprovada. Evidencia local em test-results/identity-full-preview.json;
  APIs Next simuladas, inventario sintetico e fonte de sistema. Nao substitui
  autenticacao, fontes reais e verificacao financeira na CI.

## Publicacao

### Resultado final em 2026-09-30

- Publicada a release `2c002df10fa2777165fec5b96f707ed971422e74`, apos PRs #109
  e #110. CI main `36667629540` aprovada em todos os jobs: validate, release-gates,
  isolated-restore e promotable-image. Nenhum gate foi reduzido.
- Arquivo da imagem SHA-256 `df64c5c8fd17798ea8c55b562b8a742113e9f55fb6694301baab8ab5973649fc`.
  Config da CI `sha256:e468dcfb0ba6c6312fe3f250daadbed3d25a6ac940c3ef137809924678d029c0`;
  manifesto no destino `sha256:486b459bfe8805b36327945916be6ee2502eb26bb6b5473c03ab8f7f561cf5ce`.
  Onze camadas equivalentes, sem rebuild, dois perfis de runtime aprovados.
- Versao anterior `96410f928340d3a7c6ac29a54590d6df03237a37`; troca com CAS,
  backup privado em `/var/backups/descomplica-crm/releases/2c002df10fa2777165fec5b96f707ed971422e74.zHovSi`
  e rollback preparado. Nginx mantido e validado.
- Health interno e publico confirmaram a nova versao. Smoke publico somente
  leitura: doze GETs, concorrencia quatro, nenhum erro; health 200 e estoque/
  snapshot anonimos 401, todos no-store. Latencias observadas de 174 a 880 ms;
  amostra pequena, sem prova de capacidade ou melhoria de desempenho.
- Navegador autenticado no Associativo publicado confirmou marca sem subtitulo,
  Claro/Medio/Escuro, submenu Simulacao, Escape, estoque com linhas e filtros
  habilitados. Nenhum erro de console observado. Tema original Escuro restaurado.
- A CI cobre quatro rotas, quarenta combinacoes de navegacao, 193 auditorias axe
  e cem cenarios de zoom. Nao foram alteradas propostas, dados ou politicas.
- Este fechamento e documental e nao exige outra implantacao de runtime.

### Bloqueio da imagem e correcao de dependencia

- CI final do PR 36662908716 passou todos os gates, incluindo matriz visual.
  PR #109 integrado no SHA 83f1b2fe66f7026ae777406b740202ebc55360f5.
- CI main 36664719186 falhou no audit: quatro alertas altos e dois moderados
  de brace-expansion, transitivo de ESLint/minimatch. Imagem nao gerada e
  producao nao alterada. Nao se trata de regressao visual.
- Atualizacao pontual para 1.1.21 e 5.0.12, mesma linha major e Node compativel;
  demais resolucoes do lock preservadas. Instalacao frozen, supply-chain e
  audit sem vulnerabilidades conhecidas aprovados localmente.
- Fontes oficiais das correcoes:
  [recursao na expansao](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
  [recursao no parser](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) e
  [reescrita quadratica](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr).
- Nova CI e publicacao pendentes; gate de seguranca preservado.
- Smoke local Node 24.19: expansao comum preservada nas duas versoes;
  tres entradas sinteticas limitadas por versao (aninhamento, parser e reescrita)
  sem excecao, em 259/258 ms. Nao representa benchmark de capacidade do CRM.
- Lint, typecheck e build aprovados apos a atualizacao. Suite Windows: 987
  aprovados, um skip e seis falhas POSIX conhecidas; nenhuma falha nova.

### Referencias revisadas em 2026-09-30

- CI 36660701681 do candidato 8e6cb0c: validacao Linux, banco, advisors,
  restauracao isolada e E2E aprovados. Navegacao 40/40, 193 auditorias axe,
  100 cenarios de zoom e todos os contratos funcionais aprovados.
- Captura do merge e985f6791de4dfd5681cc47429a6d5f06bc61d25: somente 44
  diferencas visuais, limitadas aos quatro simuladores. Inspecao visual dos
  onze mosaicos confirmou espacamento dos temas/tablet, filtros/mobile e as
  tres paletas. As 32 capturas nao afetadas pelas duas ultimas correcoes
  mantiveram o mesmo hash da rodada anterior; as outras doze foram reinspecionadas.
- Gate funcional canonico aprovado antes da promocao transacional de 44 imagens.
  Outras 149 preservadas; proveniencia por imagem e SHA registrados. Limites
  de 1% e canal 16 inalterados. Nenhuma baseline mudou durante a captura.
- Reteste local: 63 testes focados e 40/40 combinacoes do preview com componente
  real de cookies. Revisao independente estatica sem novos achados concretos;
  nao equivale a validacao visual autenticada.
- Pendente: nova CI integrada das referencias, merge e publicacao.

### Rodadas anteriores

- CI 36655323860, candidato f6fa77c: navegacao 40/40, 193 auditorias axe,
  100 cenarios de zoom e contratos funcionais aprovados. 44 diferencas visuais,
  exclusivamente nas quatro rotas do escopo; outras 149 dentro do limite.
  Inspecao das capturas detectou largura legada de 44 px comprimindo icones e
  textos dos temas em tablets, e Limpar filtros colidindo com o primeiro campo
  na Direta/mobile. Isola a regra ao cabecalho antigo e aplica o espacamento
  mobile ja usado no Associativo. QA passa a medir conteudo dos botoes e filtros.
  Baselines nao promovidas; nova CI e inspecao exigidas.

- CI 36653241052: validacao Linux, banco, E2E e restore aprovados; navegacao
  39/40. Diagnostico e captura identificaram o atalho de cookies (camada 85)
  cobrindo Configuracoes na Direta/320. Cabecalho passa a camada 86, abaixo
  do painel de consentimento (90). Teste de regressao compara as tres camadas.
  Preview anterior nao incluia o componente global de cookies; harness ajustado
  para incluir o componente real, sem habilitar suas Server Actions.
- Reteste CUA Direta/320 com componente de cookies real: Simulacao -> Configuracoes,
  Escape, abertura e fechamento do painel aprovados. Seis testes do gate aprovados.

Exige CI do candidato, inspecao dos diffs visuais, PR, imagem imutavel validada,
backup, compare-and-swap, rollback e health pos-publicacao.
