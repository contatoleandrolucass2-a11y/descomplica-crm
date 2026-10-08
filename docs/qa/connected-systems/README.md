# Conectar Sistemas

Rota: `/app/configuracoes/conectar-sistemas`.

A nova guia usa ManagementCanvas e a navegação autorizada de Configurações.
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

Validação: CI `37720363346`, artefato `11526388631`, captura limpa
`f3a209d28d6e7cac55af19ead398282aa5a5439b`, árvore idêntica a `4a21e26`.
Os nove cenários passaram sem overflow nem violações de acessibilidade.
As nove capturas foram inspecionadas, inclusive o contraste corrigido das
mensagens do refresh nos temas claro e médio. A matriz E2E das 25 rotas também
passou nos oito perfis. A verificação final das referências revisadas e a
publicação estão condicionadas à CI do PR #172.

A tela não comprova sessão Salesforce ou coleta ativa. A integração real exige
sessão dedicada, n8n e reconciliação da primeira carga. O resultado final de
merge e publicação será registrado no [PR #172](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/172).
