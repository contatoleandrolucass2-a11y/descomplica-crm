# Tabelao: cabecalhos, endereco e alinhamento

Data: 2026-10-01. Branch: codex/tabelao-cabecalhos-centralizados.
Base: d954be71677b10006d3cfa5e1b708fbabaa0911f.

## Pedido e escopo

Dar aos titulos das colunas o mesmo tamanho de fonte das linhas, posicionar
Endereco imediatamente depois de Empreendimento e centralizar todos os textos
e valores. Preservar a compactacao e as quebras de linha da entrega anterior.
Somente apresentacao do Tabelao: sem alterar APIs, dados, calculos, permissoes,
migrations ou workflows n8n.

## Implementacao

- Fonte compartilhada por th/td: 10px no desktop e 12px abaixo de 1240px.
  Substitui os cabecalhos de 6px e a excecao de 4px da Incorporadora.
- Altura automatica e padding comportam o texto maior, sem diminuir fonte.
- Endereco e a terceira coluna no colgroup, thead e tbody. Rowspans continuam
  limitados a valores consecutivos do mesmo empreendimento/incorporadora.
- Text-align center e vertical-align middle abrangem todas as celulas;
  wrappers de texto tem margem horizontal automatica.
- Endereco conserva padding mesmo quando e a primeira celula fisica de uma
  linha, por causa dos rowspans das duas colunas anteriores.
- Larguras externas compactas preservadas: empreendimento 115px, endereco
  145px, limitador 73px. Fonte do corpo e valores comerciais preservados.

## Evidencias locais

- Node 24.19.x e pnpm 11.20.x, dependencias instaladas pelo lockfile congelado.
- Typecheck e 55 testes focados aprovados.
- Suite Windows: 992 aprovados, quatro skips e seis falhas POSIX conhecidas
  (0600/0700, ownership e symlink). Nenhuma assercao ou skip alterado para
  contornar essas limitacoes; aprovacao Linux obrigatoria antes do deploy.
- Harness com TabelaoClient/TabelaoFilters e CSS reais, APIs sinteticas isoladas:
  sete cenarios 375/390/768/1024/1440 e escala 150%, com cinco estados de
  filtros/ordenacao. Fonte igual, centralizacao, textos integrais, nova ordem,
  geometria por headers, agrupamento e rolagem horizontal aprovados.
- Os mesmos contratos rejeitam a versao anterior por fonte, ordem e alinhamento.
- Capturas desktop e tablet inspecionadas. Harness usa fonte local de fallback
  e nao substitui a matriz autenticada da CI com fontes reais, temas e axe.
- Lint simples encontrou bundles locais gerados em test-results (nao versionados).
  pnpm lint --ignore-pattern "test-results/\*\*" passou, excluindo somente esses
  artefatos. CI limpa continua executando pnpm lint sem exclusoes extras.
- Build Next 16.3.6 aprovado, com todas as 41 paginas geradas.

## Gates e publicacao

- CI 36916047513, head 0c2269315231df65666eb9c1423e64d3b314d8d9:
  lint simples, tipos, testes Linux, build, banco, restore isolado e E2E aprovados.
- Captura limpa 434dc8dafe2522bd775a17ecd8706f982be7cfce, arvore identica ao head.
  Apenas fixtures sinteticas locais, sem credenciais ou storage state persistidos.
- Toda a matriz funcional aprovada: 140 rotas, 80 temas, 193 axe, 100 verificacoes
  de zoom e os 20 contratos do Tabelao, incluindo concorrencia e recuperacao.
- Sete diferencas visuais esperadas inspecionadas individualmente: desktop,
  notebook, dois tablets e os tres temas. Cabecalhos legiveis, Endereco na
  terceira coluna e valores centralizados; rolamento restrito ao quadro.
- Promocao transacional pelas funcoes canonicas de authenticated-visual.mjs.
  Hashes e proveniencia verificados; 186 referencias restantes preservadas
  byte a byte. Sem mudar thresholds, fixtures, assercoes ou gates para passar.
- Manifesto promovido: eab74fdeb3c3ec59fe363044ea4af12c3321b38eee55982238db6b21d818e92f.

CI final e publicacao pendentes.
Publicar pelo PR/CI com imagem imutavel, backup, CAS e verificacao posterior,
conforme docs/runbooks/automatic-publication.md. Evidencias finais no PR com
SHA, CI, identidade da imagem, backup, saude, limites e sincronizacao.
