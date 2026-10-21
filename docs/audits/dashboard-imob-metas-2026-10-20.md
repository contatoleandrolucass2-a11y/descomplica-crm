# Dashboard Imob: metas e sincronizacao

## Escopo

- Exibir somente Visitas, Pastas, Pastas aprovadas e Vendas nos 13 funis Imob.
- Calcular as metas Imob a partir da meta ativa de Parcerias multiplicada por
  sete gerentes.
- Usar a mesma referencia persistida da coleta Salesforce no Dashboard, nas
  paginas de relatorio e no cartao da integracao.

## Validacao local

- Testes focais: 136 aprovados, 1 ignorado condicionalmente.
- Vitest integral: 3.963 aprovados, 102 ignorados condicionalmente.
- Lint, typecheck e build de 57 rotas: aprovados com Node 24.19.
- QA visual sintetico: 267 checks em cinco larguras (`320`, `390`, `768`, `1440`, `1920`),
  temas claro, medio e escuro, filtros, historicos, Axe, overflow, cortes e
  sobreposicoes.
- pgTAP: indisponivel localmente por ausencia de Docker ou Podman. A CI com
  restore isolado deve aprovar as 2.049 assercoes antes de qualquer aplicacao
  remota.
- Os testes fisicos de Meta Ads permanecem dependentes de ACL/diretorios Linux
  e falham no host Windows sem relacao com os arquivos funcionais alterados.

## Criterios esperados

- House permanece com seis estagios.
- Imob apresenta quatro estagios em todos os funis e modais historicos.
- Com meta por gerente 12/64/32/20, a Meta mes do grupo apresenta
  84/448/224/140.
- Em 20/10/2026, a Meta esperada ate hoje apresenta 54/289/144/90 apos
  arredondamento para baixo.
- O horario do cartao Salesforce coincide com o `generatedAt` do snapshot que
  alimenta os relatorios.
