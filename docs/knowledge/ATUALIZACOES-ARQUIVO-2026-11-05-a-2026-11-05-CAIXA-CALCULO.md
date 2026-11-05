# CAIXA: cálculo comercial em05/11/2026

## 2026-11-05 — CAIXA: abertura da revisão de anuais e base da cota

- Escopo solicitado: somente cálculo das unidades disponíveis, anuais e relação
  entre preço de compra, avaliação e capacidade de financiamento. Sem alteração
  de layout ou de outras páginas. Valores dos prints são cenários de conferência,
  não autorização para substituir dados reais do imóvel.
- Git comum confirmado; branch codex/caixa-calculo-anuais-cota parte de main
  98d476f0776891e5482a0d3da40ac1242759adb3. GitHub consultado em 05/11/2026:
  CI42005074660 concluída com sucesso; avanço desde36b8fbe6 somente documental.
- GET observacional público /api/health: HTTP200, status ok, versão
  b1544dd13aacb12690fa75e60e43e9881e1627ff. Versão publicada e main distintas;
  a versão publicada corresponde à entrega CAIXA anterior. Fontes: Git local,
  API GitHub do repositório e https://crm.descomplicapro.com.br/api/health.
- Próxima verificação: regra oficial da cota e reprodução das anuais canônicas.
  Nenhuma equivalência nova com aprovação bancária foi demonstrada nesta abertura.

### Diagnóstico e candidato de cálculo

- Duas causas reproduzidas: teto de renda herdado do primeiro imóvel mesmo
  após mudança de taxa; exigência indevida de aprovação dos dois fluxos.
  Crédito agora usa a simulação da própria unidade; oferta aceita pelo menos
  um fluxo aprovado pelo ranking canônico. Opção reprovada não gera proposta
  ou impressão. Não altera motor Associativo, limites, layout ou outras páginas.
- Anuais do print já eram quatro de2000, máximo permitido para renda4000,
  e reduziam comprometimento16,08%/19,83%. Compra253790 mantém crédito203032
  pela cota80%; não se substituem compra e avaliação reais por261770,43.
- Fonte bancária: FAQCAIXA via índice público, consultada05/11/2026;
  abertura direta da FAQ e MFOM034 indisponível por redirecionamento.
  Limite e reprodução detalhados em docs/simulators/CAIXA.md.
- Validação local:39 testes financeiros e cinco cenários browser aprovados;
  revisão financeira independente confirmou prestação800 e cota60% preservadas.
  Sem nova contagem do estoque vivo, promessa de crédito bancário ou teste
  exaustivo de todas as combinações. CI/merge/deploy pendentes nesta etapa.

### Decisão posterior explícita: base comercial otimizada

- Usuário determinou desconsiderar a base bancária menor compra/avaliação para
  este cálculo comercial. Essa instrução supera a conclusão operacional anterior,
  mas não altera a fonte oficial nem autoriza reescrever compra/avaliação reais.
- Implementação restrita às unidades disponíveis CAIXA: busca em centavos entre
  compra e avaliação, com taxa por faixa, teto de renda, cota e saldo real. Subsídio
  calculado sobre compra real com taxa candidata; identificação comercial visível
  e na impressão, sujeita à aprovação bancária. Não altera motores compartilhados.
- Caso sintético253790/340000, renda4000: base261965,10, crédito209572,08,
  subsídio3357,01, prestação1200, juros5,5%. Anuais seguem quatro de2000.
- Revisão independente detectou que quitação do saldo comercial tornava o fluxo84
  inválido. Novo estado explícito sem dívida comercial preserva essas unidades,
  sem cortar crédito artificialmente nem inventar mensais ou anuais.
- Nova validação:63 testes financeiros e oito cenários browser aprovados,
  incluindo otimização, limites, quitação e impressão. Medição sintética3500
  cenários/NodeWindows: helper55,921s→11,830s,157500→38500chamadas ao motor;
  não representa latência de UI. Tipos/CI/publicação do candidato ainda pendentes.
  Evidência anterior/CI de9bb2944a não valida esta nova regra.
  Revisar a exceção apenas mediante instrução
  comercial explícita ou evidência oficial; nunca transportar para outras páginas.
