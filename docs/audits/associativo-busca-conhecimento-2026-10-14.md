# Pesquisa no Associativo: registro preservado

Fonte: docs/knowledge/ATUALIZACOES.md em main0019690, PR220.
Registro integral arquivado em14/10 para manter o indice abaixo de256000bytes.
As pendencias abaixo refletem a fonte original, nao uma nova verificacao.

## 2026-10-14: Pesquisa manual de unidades no Associativo

- Busca com lupa combina código, descrição e empreendimento com filtros e
  ordenação do estoque carregado, antes da janela virtual de 60 linhas.
  Normaliza caixa, acentos e separadores; mantém a proposta selecionada.
  Implementação em inventory-search.ts e InvestorCalculator.tsx; PR #220.
- Base 16f4587; lint, tipos, 2.814 testes da aplicação (79 skips existentes),
  suites Node e build aprovados. Audit sem vulnerabilidades; diff sem segredos.
  Testes sintéticos de pesquisa com 3.301 unidades passaram em desktop/celular.
- QA geral do guia: 18 cenários aprovados na repetição integral, sem erros de
  console/chamadas externas. Primeira execução falhou em Cheque Moradia no
  cenário 320x568-dark; nenhuma asserção ou cálculo foi alterado para passar.
  O mesmo cenário isolado passou no código original.
- CI 38562897319 aprovou validate, restore, banco e E2E; falhou no alinhamento
  do contador/data com Limpar filtros em 320/375/390 px. Grade móvel corrigida;
  oito larguras passaram no contrato original. Fixture local passou a incluir
  data e verificar essa geometria. O helper de preenchimento aguarda o foco
  agendado pela qualificação e confere valores formatados; o artefato de falha
  mostrava o valor da Entrada digitado em Financiamento. Nova CI e deploy pendentes.
- Health público em 14/10 às 12:17:40Z: HTTP 200/status ok/version faae8e9.
  Main remoto permaneceu 16f4587. Fonte: /api/health e git ls-remote origin.
  Checkout macOS fora do Git comum Windows autorizado para sincronização
  automática do Obsidian e publicação permanente; esses fluxos não foram usados.
- CI 38568083961 concluiu todos os checks funcionais; 11 diferenças visuais
  somente no Associativo. A revisão das capturas identificou compressão do título
  em 768 px. Controles separados na linha seguinte entre 761 e 1.023 px; nova
  asserção reproduziu a falha e passou após a correção. Baseline não promovida;
  nova captura e CI pendentes. Main 8e015c6 integrado preservando as notas dos funis.
- CI 38574613120/d8e745c aprovou o predicado funcional integral e o título nas
  dez larguras/três temas. As 11 imagens do Associativo foram revisadas e
  promovidas, preservando 231 referências. Hashes e prova da captura constam no
  README de paridade e em reviewedUpdates. CI final em verify e publicação pendentes.
- CI 38580539350/e043c9d aprovada, incluindo as 242 comparações visuais. Main
  avançou para 5c4d95e durante a execução. A atualização de Rotina do PR #222
  foi integrada sem alterar seus arquivos; conflitos apenas nas notas foram
  reconciliados. Nova CI da versão combinada permanece necessária.
