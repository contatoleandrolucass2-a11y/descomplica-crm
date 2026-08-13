# Convergência RBAC do Canal de Parcerias

## Causa comprovada

O catálogo produtivo mantinha `crm.partnerships` associado a
`crm.ranking.view`, enquanto o guard server-side da rota exigia
`crm.partnerships.view`. A permissão nova não existia no banco. Assim, Master
via o link pelo gate antigo e recebia `AUTH-403` no gate correto da rota.

## Migration isolada

`20260813140000_partnerships_rbac_convergence.sql`:

1. cria ou converge `crm.partnerships.view` com nível de gestão 100;
2. remove apenas vínculos não Master dessa permissão;
3. remove apenas overrides diretos dessa permissão;
4. vincula a permissão ao papel `master`;
5. atualiza exatamente `app_pages.crm.partnerships` para a mesma chave do
   guard; ausência ou duplicidade aborta a transação.

Nenhuma outra permissão, usuário, papel, página, integração ou dado comercial é
alterado. A migration usa transação curta, `lock_timeout` e
`statement_timeout` e pode ser aplicada isoladamente sem executar a pilha
pendente.

## Resultado esperado

- Master: link visível e rota autorizada;
- qualquer outro papel: link oculto e acesso direto 403;
- login/logout, Dashboard, Ranking e Configurações inalterados;
- rollback: nova migration explícita que retira o gate e volta a página ao
  estado indisponível; nunca executar SQL manual nem aplicar migrations em
  lote.
