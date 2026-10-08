# Conectar Sistemas

Rota: `/app/configuracoes/conectar-sistemas`.

A nova guia usa ManagementCanvas e a navegação autorizada de Configurações.
Não possui canvas de referência aprovado no manifesto histórico de 23 páginas.
As imagens fornecidas mostram o menu e o Salesforce, não um baseline desta
nova página. Nenhum baseline histórico foi alterado.

`scripts/qa/connected-systems.mjs`, ligado à matriz autenticada, verifica:

- entrada pela página Configurações e título do destino;
- links oficiais, sete relatórios e ausência de campo de senha;
- larguras 320, 768 e 1440 nos temas Claro, Médio e Escuro;
- ausência de overflow e violações axe no conteúdo principal;
- nove screenshots sintéticos em `connected-systems/` e resultado JSON.

Status inicial: harness implementado, execução autenticada e inspeção das
capturas pendentes na CI. A tela não comprova sessão Salesforce ou coleta ativa.
