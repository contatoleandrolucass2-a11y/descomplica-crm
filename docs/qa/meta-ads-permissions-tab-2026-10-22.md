# Guia Meta ADS nos acessos efetivos

Data: 2026-10-22.

Na tela `/admin/usuarios`, a guia **Meta ADS** aparece após **Comercial** e
reúne as permissões de visão geral, campanhas, contas de anúncios e relatórios.
A classificação usa o prefixo `crm.meta_ads.`. Essas permissões deixam de ser
incluídas pelo fallback da guia Comercial. Busca e navegação por teclado
continuam usando o mecanismo comum das categorias.

A alteração não modifica permissões efetivas, papéis, persistência ou guardas
de autorização. O teste existente de renderização verifica cinco guias,
quatro controles Meta Ads e sua ausência no painel Comercial.

Base analisada: `ce5fe0488804be2c7316e0e34fd548df7f6af6bb`, obtida de
`origin/main` em 22/10/2026. A implementação local não comprova publicação.

Validação local: lint, typecheck, testes e build aprovados. Vitest: 4.101
aprovados e 107 ignorados. Os testes Node e de release terminaram sem falhas.
Verificações exclusivas de Linux continuam dependentes da CI. Não foi
executada uma sessão autenticada no navegador nem um deploy nesta etapa.

Após sincronizar a branch com `main`, o gate visual encontrou deriva de 1,011%
em `/admin/usuarios` e 1,002% na tela de documentação. A inspeção das capturas
confirmou a nova guia e a navegação Meta Ads, Gestão e alertas já integrada em
`main`, sem corte ou overflow. As duas referências de 1280 × 720 foram
atualizadas usando o artefato candidato da própria CI; a repetição integral
continua obrigatória antes do merge.
