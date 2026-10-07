-- A denied inherited state is a role default, not an absolute ceiling for a
-- Master. Preserve the existing permission ownership requirement and the
-- separate target hierarchy guard, but let Master delegate held permissions
-- whose min_level is equal to the Master role level.

do $$
begin
  if to_regprocedure('public.can_grant_permission(uuid,text)') is null
     or to_regprocedure('public._internal_has_permission(uuid,text)') is null
     or to_regprocedure('public._internal_get_role_level(uuid)') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.permissions') is null then
    raise exception 'Master permission delegation requires the access-control foundation'
      using errcode = '42P01';
  end if;
end;
$$;

create or replace function public.can_grant_permission(actor_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'permissions.manage'), false)
    and coalesce(
      public._internal_has_permission(
        actor_uuid,
        can_grant_permission.permission_key
      ),
      false
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
  'Internal delegation guard: Master may delegate any held permission; other roles remain constrained by min_level.';
