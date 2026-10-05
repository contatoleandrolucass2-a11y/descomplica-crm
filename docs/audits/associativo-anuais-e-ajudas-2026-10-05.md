# Associativo: saldo, ajudas e brilho

- Fonte: cinco capturas do usuario em 05/10/2026.
- Branch: `codex/associativo-saldo-anuais`, base `de57b6a`.
- Status: implementado; validacao global e publicacao pendentes.

## Causa e contrato financeiro

A linha Saldo parcelado mostrava `balanceBeforeCorrection`, que no archive
representa o Pro-Soluto e ainda inclui anuais. As mensais ja descontavam as
anuais corrigidas em `installmentBalanceBeforeCorrection`; nao havia omissao
desse abatimento no calculo das mensais.

O ledger passa a usar `installmentNominalBalance` e `annualNominalTotal`, em
centavos, para reconciliar os valores digitados. Caso sintetico equivalente:

```text
43.444,22 - 1.500,00 - 0,00 - (3 x 2.450,00) = 34.594,22
```

O campo expositivo nao alimenta o motor. Com data-base 05/10/2026 e entrega
31/12/2029, o motor archive preserva anuais corrigidas de 8419.560293005581,
base mensal de 33524.65970699442 e mensal linear de 544.4850913267475.
As ajudas distinguem valores digitados de base com anuais reajustadas.

O Pro-Soluto comercial continua incluindo mensais e anuais. Comprometimento
usa a maior mensal corrigida; maximo da renda usa mensal + evolucao de obra,
sem somar a anual diretamente. Falta de andamento continua impedindo o maximo
e a aprovacao, sem transformar dado ausente em zero.

Nao unificar silenciosamente archive e WF13 oficial: possuem contratos
distintos, documentados em `docs/simulators-official/WF13_LOOKER_AUDIT.md`.
Nenhuma taxa, limite, politica, fonte de estoque, workflow ou dado remoto mudou.

## Interface

- Retira eyebrow, subtitulo e badge indicados somente no Associativo; props
  opcionais do cabecalho preservam os outros simuladores.
- Simplifica ajudas de perfil, recursos, pagamentos, indicadores, proposta
  pronta e documentacao; mantem formulas, condicoes e ressalvas.
- Brilho documental deve atravessar a passagem entre os dois cards sem pausa
  visivel. Validacao mede pixels pintados, nao apenas delays CSS.

## Evidencias

- 33 testes iniciais de ledger, layout e proposta pronta aprovados.
- Auditoria independente: 364 testes de politica, WF13, Looker, archive,
  matriz e regressoes aprovados em Node 24.19.0 no Windows.
- Lint, typecheck e build aprovados no Windows; oito testes Node aprovados.
- Suite integral Windows: 1997 aprovados, cinco condicionais ignorados, seis
  falhas POSIX e um timeout no teste de conhecimento (22/22 aprovados na repeticao isolada).
  Nao foram alterados assertions, limites ou skips para encobrir essas falhas.
- Preview React real em loopback: nove etapas aprovadas, incluindo anuais,
  indicadores dos dois fluxos, documentacao inalterada e restauracao ao remover
  anuais. Confere tambem dados ausentes, recuperacao e isolamento entre unidades.
- CI Linux, jornada autenticada, baseline revisada e publicacao ainda pendentes.
  Preview de componentes nao comprova autenticacao ou guards.
- Regressao final de ledger, layout, FAQ, ajudas e proposta: 81/81 aprovados.
- Brilho: 13/13 testes; nove combinacoes de viewport/tema, dois ciclos cada,
  intervalo pintado medido de 0 ms. Injetar keyframes antigos reproduz falha
  com 3986.71875 ms de intervalo. Reduced-motion e geometria preservados.
