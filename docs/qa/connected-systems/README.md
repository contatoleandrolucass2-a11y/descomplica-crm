# Conectar Sistemas

Rota: `/app/configuracoes/conectar-sistemas`.

A guia usa SimulationCanvasHeader e o canvas compacto da Tabela Associativo,
com CSS local e a navegacao autorizada de Configuracoes.
Não possui canvas de referência aprovado no manifesto histórico.
As imagens fornecidas mostram o menu e o Salesforce, não um baseline desta
nova página. Somente as onze referências da visão geral de Configurações foram
atualizadas para incluir a nova entrada; as outras 231 permaneceram intactas.

`scripts/qa/connected-systems.mjs`, ligado à matriz autenticada, verifica:

- entrada pela página Configurações e título do destino;
- links oficiais, sete relatórios e ausência de campo de senha;
- larguras 320, 768 e 1440 nos temas Claro, Médio e Escuro;
- ausência de overflow e violações axe no conteúdo principal;
- nove screenshots sintéticos em `connected-systems/` e resultado JSON.

A revisao de 08/10 acrescenta estados de conexao, contagens e publicacao
separadas. O QA sintetico cobre polling sem sobreposicao, timeout, aba oculta,
cleanup, seis estados e zoom de 200%. Os cenarios nao realizam login real nem
publicam relatorios. Capturas locais em `output/playwright/connected-systems/`.
Nao houve alteracao de baseline do Associativo ou de CSS global.

Validacao da versao anterior (PR #172): CI `37720363346`, artefato `11526388631`, captura limpa
`f3a209d28d6e7cac55af19ead398282aa5a5439b`, árvore idêntica a `4a21e26`.
Os nove cenários passaram sem overflow nem violações de acessibilidade.
As nove capturas foram inspecionadas, inclusive o contraste corrigido das
mensagens do refresh nos temas claro e médio. A matriz E2E das 25 rotas também
passou nos oito perfis. A verificação final das referências revisadas e a
publicação estão condicionadas à CI do PR #172.

A tela so comprova sessao apos recibo autenticado e recente do coletor, nunca
pela abertura do link ou configuracao da flag. A integracao real exige sessao
dedicada, n8n e reconciliacao da primeira carga. A evidencia da nova revisao deve
ser registrada no respectivo PR, sem reutilizar os gates do PR #172.
