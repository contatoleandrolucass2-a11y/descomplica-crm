# Tabelao: colunas compactas e repeticoes

Data: 2026-09-29.
Branch: codex/tabelao-colunas-compactas.

## Escopo

Pedido: reduzir aproximadamente pela metade as colunas Empreendimento, Endereco
e Limitador mostradas nos prints, quebrar o texto e eliminar repeticoes por
empreendimento. A alteracao e de apresentacao, sem excluir arquivos, registros,
plantas ou unidades do estoque. Nenhum calculo, API, permissao ou workflow n8n muda.

## Implementacao

- Conteudo delimitado em 100/130/58 px para Empreendimento/Endereco/Limitador,
  respectivamente; com padding e borda, as colunas medem 115/145/73 px. Sao
  medidas CSS, antes do zoom do navegador. A largura antiga era automatica e
  dependia do maior texto e da largura da janela, nao um tamanho fixo universal.
- Quebra por palavras; termos sem espacos tambem quebram, sem reduzir a fonte.
- Enderecos e limitadores consecutivos com o mesmo rotulo exibido compartilham
  uma celula HTML com rowspan. Diferencas de numero, bairro ou classificacao
  continuam visiveis na planta correspondente.
- A sequencia A/B/A nao e unificada atraves de B: isso atribuiria o valor errado
  a uma planta ou exigiria alterar a ordenacao de precos.
- Cada agrupamento respeita empreendimento e incorporadora e e reconstruido
  depois de filtros e ordenacao. Headers acessiveis e todas as linhas permanecem.
- Rolagem horizontal fica restrita a tabela quando a tela nao comporta a grade.
- A largura maxima desconta as margens de 24 px no desktop e 14 px no celular,
  evitando que fit-content leve a borda direita para fora do painel.

## Validacao

- Windows, Node 24.19.x, pnpm 11.20.x: 62 testes focados iniciais aprovados.
- Lint, typecheck, build, formatacao e Gitleaks aprovados.
- Suite Windows: 978 aprovados, quatro skips condicionais e seis falhas POSIX
  preexistentes (0600, 0700, ownership e symlink); nenhuma assercao alterada
  para mascara-las. Oito testes Node aprovados separadamente.
- Harness local com TabelaoClient/TabelaoFilters e CSS reais, estoque sintetico:
  sete cenarios aprovados, com viewports 375/390/768/1024/1440, filtros e ordem
  inversa. Colunas externas 115/145/73 px, textos integrais e quadro ajustado a
  largura da grade. Capturas desktop/celular inspecionadas. Nao substitui auth.
- Reexecucao final incluiu compactFrameInsidePanel: sete cenarios passaram,
  com 48 testes de layout/agrupamento aprovados apos o ajuste das margens.
- Revisao independente sem achados: nove cenarios Chromium, axe da tabela e
  9.841 sequencias do helper. Sem teste de leitor de tela real.
- 75 testes focados de Tabelao e contratos de QA aprovados apos a integracao.
- CI 36526268323, head 3801cbe e merge de teste 0f4616b: Linux aprovou 984
  testes Vitest (quatro skips), oito testes Node, lint, tipos, build e audit.
  Banco, advisors, E2E de autorizacao e restore isolado passaram.
- Matriz autenticada: 140 verificacoes responsivas, 80 de tema, 193 axe e
  100 de zoom aprovadas; todos os contratos do Tabelao passaram, incluindo
  celulas mescladas, geometria, filtros e acessos concorrentes.
- A comparacao visual falhou somente em sete capturas do Tabelao, pela mudanca
  solicitada. Desktop 1280/1440, tablet 768/1024 e tres temas foram inspecionados.
  Somente essas sete imagens foram promovidas; 186 referencias ficaram intactas.
  O catalogo registra hashes, comparacao anterior, SHA e URL da captura por item.
- Uma nova CI no commit com essas referencias e a publicacao seguem pendentes.

## Publicacao

Usar PR/CI, imagem imutavel do main, backup, CAS da versao anterior e verificacao
pos-publicacao conforme o runbook. Sem migrations nem mutacoes de dados remotos.
Resultados finais devem constar no PR com SHA, CI, identidade da imagem e limites.
