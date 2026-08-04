# Banco de dados

## Estado atual

O schema da base de login usa PostgreSQL 17 no Supabase local. Existem quatro migrations versionadas. A validação local encontrou sete tabelas públicas e RLS habilitada em todas; os seeds estruturais criam oito papéis e oito permissões.

## Migrations

1. `20260519190726_access_control_foundation.sql`: tabelas, papéis, permissões, RLS e auditoria.
2. `20260522010552_access_control_admin_functions.sql`: funções administrativas e bootstrap master.
3. `20260527120000_authorization_context_rpc.sql`: contexto efetivo de autorização.
4. `20260721120000_fix_remove_user_permission_override_ambiguity.sql`: correção de ambiguidade em override.

## Desenvolvimento local

```bash
pnpm db:start
pnpm exec supabase migration list --local
pnpm exec supabase db lint --local
pnpm exec supabase db reset
pnpm db:stop
```

O reset é destrutivo para o banco local. Não use comandos equivalentes contra ambiente remoto sem backup e autorização.

`supabase test db` está configurado e o runner pgTAP inicia corretamente, mas a base original não contém testes SQL. A cobertura inicial vive no Vitest; a migração de cada domínio do CRM deverá adicionar testes pgTAP para schema, grants e policies.

## RLS e grants

RLS e grants são camadas complementares. Cada nova tabela exposta precisa:

- grants mínimos por papel;
- RLS ativada;
- policies separadas por ação quando necessário;
- índice para colunas usadas pelas policies;
- teste com usuário autorizado e não autorizado;
- auditoria para alterações administrativas.

Os advisors locais não apontaram erro de segurança. O advisor de performance registrou múltiplas policies permissivas de `SELECT` em `profiles`, `user_permission_overrides` e `user_roles`; isso é dívida de desempenho preexistente a revisar durante a migração, sem afrouxar autorização.

## D1 para PostgreSQL

Modelos e queries do CRM original não serão copiados literalmente. Cada tabela D1 será mapeada para tipo PostgreSQL, constraints, índices, grants e policies; o acesso ocorrerá pelo Supabase SDK/server-side. Drizzle/D1, bindings `env.DB` e imports `cloudflare:` não entram na aplicação final.
