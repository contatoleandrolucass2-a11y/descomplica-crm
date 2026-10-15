-- Inventory brands require explicit per-user access. No current or future role
-- receives either permission from this migration, including Master.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values
  ('crm.inventory.riva.view', 'Visualizar o estoque RIVA', 10),
  ('crm.inventory.direcional.view', 'Visualizar o estoque DIRECIONAL', 10)
on conflict (key) do update
set description = excluded.description,
    min_level = excluded.min_level;

-- Keep the existing internal delegation guard and its grants. The narrow
-- exception allows permission managers to configure brand access without
-- implicitly giving them permission to read either brand themselves. Existing
-- mutation RPCs still enforce self, hierarchy, account status, and scope checks.
create or replace function public.can_grant_permission(actor_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'permissions.manage'), false)
    and (
      can_grant_permission.permission_key in (
        'crm.inventory.riva.view',
        'crm.inventory.direcional.view'
      )
      or coalesce(
        public._internal_has_permission(
          actor_uuid,
          can_grant_permission.permission_key
        ),
        false
      )
    )
    and exists (
      select 1
      from public.permissions permission
      where permission.key = can_grant_permission.permission_key
        and (
          exists (
            select 1
            from public.user_roles actor_role
            where actor_role.user_id = actor_uuid
              and actor_role.role_key = 'master'
          )
          or permission.min_level < coalesce(
            public._internal_get_role_level(actor_uuid),
            0
          )
        )
    );
$$;

alter function public.can_grant_permission(uuid, text) owner to postgres;
revoke all privileges on function public.can_grant_permission(uuid, text)
  from public, anon, authenticated, service_role;

comment on function public.can_grant_permission(uuid, text) is
  'Internal delegation guard: permission managers may configure the two explicit inventory-brand permissions without reading them; other permissions require ownership, and existing hierarchy minimums remain enforced.';

notify pgrst, 'reload schema';

commit;
