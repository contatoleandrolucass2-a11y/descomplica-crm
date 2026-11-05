# CAIXA: cálculo comercial em 05/11/2026

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

### Caso limite de compra sem financiamento

- Revisão da nova quitação identificou tarifa/seguro residual do motor quando
  principal era zero. Adaptador comercial passa encargo zero nesse caso e
  a apresentação informa compra coberta por recursos, sem financiamento.
  O motor bancário compartilhado não foi alterado.

### Publicação e validação final — 05/11/2026

- Escopo de runtime restrito às unidades disponíveis CAIXA, sua otimização e
  apresentação dependente. Não foram alterados layout, páginas externas,
  motores financeiros compartilhados, ranking, banco ou migrations.
- PR [500](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/500)
  integrado em `e407ecd9d10a10b7a794e4cb9d1b20466eed608e`. Candidato final
  `d900e02e220e5f66a89e7a04fb60c5fb2f8f8cdd`; CI
  [42020300912](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/42020300912)
  e CI main
  [42027654068](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/42027654068)
  concluídas com sucesso nos quatro jobs obrigatórios. Evidências do mesmo
  candidato reaproveitadas; não se repetiram testes locais sem invalidação.
- Validação local final: 63 testes financeiros e nove cenários browser, tipos,
  lint e formatação aprovados. Inclui compra sem financiamento, quitação do
  saldo comercial, fronteiras de taxa/cota, anuais, ranking por fluxo e bloqueio
  de proposta/impressão reprovadas. Não representa prova de todas as combinações
  possíveis nem equivalência com aprovação oficial da CAIXA.
- Imagem da CI conferida por hashes, revisão, plataforma e 14 camadas; prova
  dos dois perfis de runtime aprovada. Imagem publicada:
  `sha256:353b70c36c3e4ce9a883ec5649ac2d16605610d0826c756c20fb48d48d9b7ba6`.
  Backup protegido de ambiente/ledger em
  `/var/backups/descomplica-crm/caixa-calculo-e407ecd9-20261105`;
  imagem anterior preservada para rollback, sem copiar segredos para registros.
- Publicação exclusivamente por `release:production`, com consulta ao vivo,
  lock e CAS sobre `b1544dd13aacb12690fa75e60e43e9881e1627ff`/deployment
  `f834574b-d487-49fd-b7f8-b145be55fd4a`. Nenhum teste concorrente ativo no
  chat coordenado. Novo deployment `57305658-c920-4d9e-81d2-99d7deed9fa0`,
  publicado às **13:24:04.977 UTC**, sem pendência de publicação.
- GET público de https://crm.descomplicapro.com.br/api/health às 13:24:21 UTC:
  HTTP 200, status `ok`, versão `e407ecd9d10a10b7a794e4cb9d1b20466eed608e`.
  Conferência pelo Chrome na página CAIXA, com dados fictícios, após reload:
  renda R$ 4.000, nascimento 22/01/1987, SP/São Paulo, PRICE/MCMV, cotista,
  um proponente, apartamento de 32 m², dependentes, imóvel na planta,
  ranking Ouro, primeiro imóvel, entrada mínima R$ 150.
- Resultado observado: **383 opções**, estoque de **3.495 unidades**, referência
  UI 05/11/2026, 10:07:44. Antes: 35 opções/3.494 unidades, referência 07:07:30.
  Os snapshots diferem por uma unidade; os números são observações datadas,
  não comparação com estoque congelado nem promessa de quantidade permanente.
- Caso conferido na interface: compra R$ 253.790, avaliação R$ 340.000 e área
  25,77 m² preservadas; base comercial R$ 261.965,10, cota 80%, taxa 5,5% a.a.,
  financiamento R$ 209.572,08, subsídio R$ 3.357,01. Anuais: quatro de R$ 2.000
  em dezembro de 2026 a 2029; anual posterior zerada. Fluxo com 84 mensais.
  Pró-soluto 16,12%; comprometimento Linear/Decrescente 13,4%/16,53%; máximos
  mensais 43,4%/43,9%, dentro dos limites 20%/20%/50% do Ouro. Ambos os fluxos
  aprovados e ações de impressão habilitadas; nenhuma proposta enviada.
- Calculadora principal manteve crédito R$ 209.416,34, subsídio R$ 3.357,01 e
  parcela R$ 1.200 para imóvel inicial R$ 275.000. A exceção comercial aplica-se
  somente à busca das unidades e está identificada na composição e impressão
  como sujeita à aprovação bancária. Compra e avaliação reais não são reescritas.
- Registro final somente documental; Git/Obsidian devem receber esta evidência,
  sem novo restart. Reavaliar a política somente por instrução comercial
  explícita ou nova evidência oficial, sem estendê-la a outras páginas.
