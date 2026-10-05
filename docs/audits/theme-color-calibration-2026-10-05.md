# Calibracao dos temas Claro, Medio e Escuro

Data: 2026-10-05

## Resultado esperado

- Claro: superficie branca, pagina `#f3f6fa`, texto navy e azul de preenchimento
  com contraste para rotulos escuros.
- Medio: superficie cinza-azulada, pagina `#d9e1eb`, sem se confundir com Claro.
- Escuro: pagina navy `#061f35` e topbar `#071a31`, preservando os canvases.
- Azul/ciano identifica navegacao, foco e destaque. Aviso e erro permanecem
  separados. O dourado intencional do Associativo nao foi recalibrado.

## Causa corrigida

Os tokens globais de Claro e Medio eram visualmente proximos. Ranking, Canal de
Parcerias e Configuracoes ainda declaravam uma paleta escura completa dentro do
proprio canvas; por isso o seletor de tema alterava a topbar, mas nao a pagina.
As redefinicoes foram removidas e os canvases passaram a consumir o contrato
semantico global.

## Seguranca e limites

- Nenhuma rota, permissao, guard, loader, API, RLS ou fonte de dados foi alterada.
- Nenhum valor comercial, migration, dependencia ou segredo foi adicionado.
- Integracoes, feature flags e motores mantem exatamente o estado anterior.
- A conta e as fixtures do QA sao sinteticas, locais e removidas pelo runner.

## Gates

O gate final aprovou e versionou, de forma transacional:

- 154 cenarios responsivos em sete viewports;
- 88 verificacoes dedicadas dos tres temas;
- 242 auditorias Axe e 242 comparacoes de baseline;
- 22 comparacoes com os canvases externos aprovados;
- 110 verificacoes de zoom e 40 cenarios de navegacao dos simuladores;
- teclado, foco, reduced-motion, ausencia de overflow e console critico.

A fonte verificavel dos totais, hashes e horario e
`docs/qa/reference-parity/authenticated-results.json`. Baselines so podem ser
substituidas quando todos os predicados funcionais e visuais estiverem verdes.

## Rollback

Reverter o commit restaura os tokens e as imagens anteriores. Nao ha rollback
de banco, porque o incremento nao contem migration nem mutacao remota.
