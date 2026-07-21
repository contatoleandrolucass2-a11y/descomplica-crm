# Runbook — Bootstrap do Master Developer (M5.4)

## Objetivo

Promover **uma vez** um usuário existente ao papel `master` (nível 100),
usando o UUID definido em `MASTER_USER_ID`. Operação manual, server-side,
executada por um operador com acesso privilegiado ao banco. Não há UI, endpoint
público, Server Action nem Service Role no bundle do app.

## Contexto técnico

A lógica já existe no banco (migration M5.2):

```sql
public.bootstrap_master_user(master_user_id uuid)
```

- É `SECURITY DEFINER` com `search_path = ''`.
- É **idempotente**: rodar de novo com o **mesmo** UUID retorna
  `{ ok: true, noop: true }` sem novo registro de auditoria.
- **Recusa** um master divergente: se já existe um `master` com UUID diferente,
  levanta `conflict` (SQLSTATE `23505`) e não altera nada.
- Está **revogada** para `anon` e `authenticated`
  (`revoke execute ... from anon, authenticated`). Só `service_role`/`postgres`
  conseguem executá-la — por isso o bootstrap roda por conexão privilegiada,
  nunca pelo app.
- Garante um `profiles` mínimo, define `user_roles = master` e grava uma linha
  em `audit_logs` (`authorization.master_bootstrap`).

> **Não** exponha essa função via HTTP, Server Action ou Service Role embutido.
> O caminho autorizado é exclusivamente a conexão `postgres`/`psql`.

## Pré-requisitos / checklist antes de executar

- [ ] O usuário já existe em `auth.users` (foi criado via fluxo de login/Auth).
- [ ] O UUID foi conferido diretamente na fonte (Supabase Studio ou query
      privilegiada) — sem copiar de fontes não confiáveis.
- [ ] `MASTER_USER_ID` está definido **apenas** no ambiente local/seguro
      (`.env.local`, gitignored) — nunca commitado.
- [ ] O ambiente-alvo é o correto (local vs. produção). Este runbook cobre o
      ambiente **local**; produção exige autorização explícita à parte.
- [ ] Backup/controle adequado do banco no ambiente-alvo.
- [ ] O remoto **não** será tocado sem autorização.

## Passo 1 — Confirmar o UUID do usuário

No Supabase Studio (Authentication → Users) ou por query privilegiada:

```sql
select id, email from auth.users where email = '<email-do-master>';
```

Anote o `id` (UUID). Ele é o valor de `MASTER_USER_ID`.

## Passo 2 — Definir MASTER_USER_ID no ambiente seguro

Defina `MASTER_USER_ID=<uuid>` **somente** em `.env.local` (gitignored) ou no
gerenciador de segredos do ambiente. Nunca em `.env.example`, nunca no git.

## Passo 3 — Executar o bootstrap (conexão privilegiada)

Ambiente local (Supabase CLI usa a porta 54322 como `postgres`):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "select public.bootstrap_master_user('<MASTER_USER_ID>'::uuid);"
```

Substitua `<MASTER_USER_ID>` pelo UUID conferido no Passo 1. Nunca cole um UUID
real neste arquivo.

Retorno esperado:

- Primeira execução: `{ "ok": true, "audit_id": <n> }`
- Reexecução com o mesmo UUID: `{ "ok": true, "audit_id": null, "noop": true }`
- UUID diferente do master atual: erro `conflict: a different master user already exists`.

## Verificação pós-execução

```sql
select ur.user_id, ur.role_key, r.level
from public.user_roles ur
join public.roles r on r.key = ur.role_key
where ur.role_key = 'master';
```

Deve retornar exatamente uma linha, com `role_key = master` e `level = 100`,
apontando para o UUID esperado. Confira também a auditoria:

```sql
select id, actor_id, target_user_id, action, created_at
from public.audit_logs
where action = 'authorization.master_bootstrap'
order by created_at desc
limit 1;
```

## Rollback / correção

Não há downgrade automático. Corrigir um master incorreto é uma operação
manual no banco, por conexão privilegiada (revisar `user_roles`/`audit_logs`),
com o mesmo cuidado de auditoria. Não há caminho pelo app.

## Riscos e mitigação

| Risco                                | Mitigação                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| UUID errado promovido a master       | Conferir o UUID na fonte (Passo 1); a função registra em `audit_logs`; correção manual documentada acima.          |
| Execução acidental / repetida        | Função idempotente para o mesmo UUID (`noop`); master divergente é recusado com `23505`.                           |
| Vazamento de `MASTER_USER_ID`        | É apenas um UUID (não é segredo), mas mantê-lo só em `.env.local` gitignored; placeholder vazio em `.env.example`. |
| Uso indevido de Service Role         | Service Role **não** entra no app nem no `.env.example`; bootstrap usa a conexão `postgres`.                       |
| Tentativa via `anon`/`authenticated` | `execute` revogado para ambos na M5.2; a RPC não é chamável pelo cliente.                                          |
| Ambiente errado (prod vs local)      | Checklist exige confirmar o ambiente; produção só com autorização explícita.                                       |

## Referências

- Migration M5.2: `supabase/migrations/20260522010552_access_control_admin_functions.sql`
  (`bootstrap_master_user`).
- Migration M5.1: `supabase/migrations/20260519190726_access_control_foundation.sql`
  (tabelas, RLS, seed de roles/permissions).
