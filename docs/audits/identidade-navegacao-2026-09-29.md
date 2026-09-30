# Identidade e navegacao dos simuladores

Data: 2026-09-29. Branch: codex/identidade-navegacao-temas.
Status: implementacao e validacao em andamento; nao publicado.

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

## Publicacao

Exige CI do candidato, inspecao dos diffs visuais, PR, imagem imutavel validada,
backup, compare-and-swap, rollback e health pos-publicacao.
