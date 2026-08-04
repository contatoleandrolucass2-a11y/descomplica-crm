# Metas do funil

## Escopo migrado

As rotas `/app/configuracoes/metas` e `/app/configuracoes/metas/parcerias` substituem o `GoalsSettingsClient` e a API pública do CRM original. Os dois perfis preservados são:

- `dv`: funil completo de oportunidades até vendas;
- `partnerships`: funil reduzido de visitas até vendas.

As metas são mensais, no fuso `America/Sao_Paulo`. Não existe seed comercial nem fallback demonstrativo: a primeira abertura apresenta valores zero e informa que o mês ainda não foi configurado.

## Persistência e cálculo

`public.crm_funnel_goals` mantém uma linha por perfil e mês. Taxas, volumes de etapa, mínimos por tempo de operação, ritmo semanal e cobertura produtiva usam colunas tipadas e constraints; os objetos JSON não foram copiados.

O navegador envia somente a meta de vendas e os parâmetros operacionais. `upsert_crm_funnel_goals` recalcula o funil no PostgreSQL, normaliza o mês, força os campos não aplicáveis de parcerias para zero, faz o upsert e grava `crm.funnel_goals.upserted` em `audit_logs` na mesma transação.

## Segurança

- a rota e a Server Action exigem `crm.settings.manage`;
- `authenticated` possui somente `SELECT` na tabela;
- RLS exige a mesma permissão para leitura;
- `anon` não lê e nenhuma função privilegiada é exposta a esse papel;
- escrita direta do navegador permanece revogada;
- a RPC revalida sessão, perfil ativo, permissão e limites numéricos.

## Validação

`funnel_goals.test.sql` cobre schema, grants, RLS, cálculo, upsert idempotente, auditoria, escopo de parcerias e bloqueio de usuário comum/inativo. O teste autenticado no navegador confirmou criação e leitura dos dois perfis, cálculo do funil e redirecionamento sem permissão. Contas e registros temporários foram removidos com `supabase db reset`.
