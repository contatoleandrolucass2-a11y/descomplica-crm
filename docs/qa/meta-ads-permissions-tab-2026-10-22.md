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
