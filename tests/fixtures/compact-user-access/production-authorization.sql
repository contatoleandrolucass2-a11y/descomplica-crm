-- Reproducible compact production authorization metadata captured read-only on
-- 2026-10-14 from project hnncxuerlcsaahdxoswb. No users or session data included.
-- This fixture must run only in a fresh disposable database.

alter table public.roles add column is_assignable boolean not null default false;
insert into public.roles (key,name,level,is_system,is_assignable) values ('admin','Administrator',80,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('broker','Broker',20,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('broker_house','Corretor House',25,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('broker_imob','Corretor Imob',24,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('broker_lead','Broker Lead',30,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('coordinator','Coordinator',60,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('manager_house','Gerente House',55,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('manager_imob','Gerente Imob',54,true,true) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('master','Master Developer',100,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('pending','Pendente',1,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('real_estate','Real Estate',40,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('supervisor','Supervisor',50,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
insert into public.roles (key,name,level,is_system,is_assignable) values ('user','User',10,true,false) on conflict (key) do update set name=excluded.name,level=excluded.level,is_system=excluded.is_system,is_assignable=excluded.is_assignable;
delete from public.role_permissions;
delete from public.permissions;
insert into public.permissions (key,description,min_level) values ('admin.access','Access admin surfaces',80);
insert into public.permissions (key,description,min_level) values ('audit.view','View audit log',80);
insert into public.permissions (key,description,min_level) values ('crm.dashboard.all.view','Visualizar a visao Geral do dashboard',10);
insert into public.permissions (key,description,min_level) values ('crm.dashboard.view','View the CRM dashboard',10);
insert into public.permissions (key,description,min_level) values ('crm.dashboard.with_canal_imob.view','Visualizar a visao do dashboard com Canal Imob',10);
insert into public.permissions (key,description,min_level) values ('crm.dashboard.without_canal_imob.view','Visualizar a visao do dashboard sem Canal Imob',10);
insert into public.permissions (key,description,min_level) values ('crm.ingest.manage','Run and inspect CRM ingestion',80);
insert into public.permissions (key,description,min_level) values ('crm.partnerships.view','Visualizar o Canal de Parcerias quando concedido pelo papel',10);
insert into public.permissions (key,description,min_level) values ('crm.ranking.view','View CRM rankings',10);
insert into public.permissions (key,description,min_level) values ('crm.salesforce.refresh','Request a Salesforce data refresh',80);
insert into public.permissions (key,description,min_level) values ('crm.settings.manage','Change CRM goals and point settings',80);
insert into public.permissions (key,description,min_level) values ('crm.settings.view','View CRM settings',80);
insert into public.permissions (key,description,min_level) values ('crm.simulators.execute','Executar simuladores oficiais em validação controlada',100);
insert into public.permissions (key,description,min_level) values ('crm.simulators.view','Acessar interfaces de simulacao autorizadas; a execucao oficial possui controle separado',100);
insert into public.permissions (key,description,min_level) values ('crm.stages.view','View CRM funnel stage details',10);
insert into public.permissions (key,description,min_level) values ('pages.manage','Manage page catalog visibility',80);
insert into public.permissions (key,description,min_level) values ('pages.view','View the authorized page catalog',10);
insert into public.permissions (key,description,min_level) values ('permissions.manage','Grant/revoke permissions',80);
insert into public.permissions (key,description,min_level) values ('permissions.view','View permissions catalog',10);
insert into public.permissions (key,description,min_level) values ('roles.manage','Assign/change user roles',80);
insert into public.permissions (key,description,min_level) values ('roles.view','View roles catalog',10);
insert into public.permissions (key,description,min_level) values ('users.manage','Create/update/disable users',80);
insert into public.permissions (key,description,min_level) values ('users.view','View users',10);
insert into public.role_permissions values ('admin','admin.access');
insert into public.role_permissions values ('admin','audit.view');
insert into public.role_permissions values ('admin','crm.dashboard.all.view');
insert into public.role_permissions values ('admin','crm.dashboard.view');
insert into public.role_permissions values ('admin','crm.dashboard.with_canal_imob.view');
insert into public.role_permissions values ('admin','crm.dashboard.without_canal_imob.view');
insert into public.role_permissions values ('admin','crm.ingest.manage');
insert into public.role_permissions values ('admin','crm.partnerships.view');
insert into public.role_permissions values ('admin','crm.ranking.view');
insert into public.role_permissions values ('admin','crm.salesforce.refresh');
insert into public.role_permissions values ('admin','crm.settings.manage');
insert into public.role_permissions values ('admin','crm.settings.view');
insert into public.role_permissions values ('admin','crm.simulators.view');
insert into public.role_permissions values ('admin','crm.stages.view');
insert into public.role_permissions values ('admin','pages.manage');
insert into public.role_permissions values ('admin','pages.view');
insert into public.role_permissions values ('admin','permissions.manage');
insert into public.role_permissions values ('admin','permissions.view');
insert into public.role_permissions values ('admin','roles.manage');
insert into public.role_permissions values ('admin','roles.view');
insert into public.role_permissions values ('admin','users.manage');
insert into public.role_permissions values ('admin','users.view');
insert into public.role_permissions values ('broker_house','crm.dashboard.view');
insert into public.role_permissions values ('broker_house','crm.dashboard.without_canal_imob.view');
insert into public.role_permissions values ('broker_house','crm.ranking.view');
insert into public.role_permissions values ('broker_house','crm.stages.view');
insert into public.role_permissions values ('broker_house','pages.view');
insert into public.role_permissions values ('broker_imob','crm.dashboard.view');
insert into public.role_permissions values ('broker_imob','crm.dashboard.with_canal_imob.view');
insert into public.role_permissions values ('broker_imob','crm.partnerships.view');
insert into public.role_permissions values ('broker_imob','crm.stages.view');
insert into public.role_permissions values ('broker_imob','pages.view');
insert into public.role_permissions values ('coordinator','crm.dashboard.view');
insert into public.role_permissions values ('coordinator','crm.dashboard.with_canal_imob.view');
insert into public.role_permissions values ('coordinator','crm.partnerships.view');
insert into public.role_permissions values ('coordinator','crm.stages.view');
insert into public.role_permissions values ('coordinator','pages.view');
insert into public.role_permissions values ('manager_house','crm.dashboard.view');
insert into public.role_permissions values ('manager_house','crm.dashboard.without_canal_imob.view');
insert into public.role_permissions values ('manager_house','crm.ranking.view');
insert into public.role_permissions values ('manager_house','crm.stages.view');
insert into public.role_permissions values ('manager_house','pages.view');
insert into public.role_permissions values ('manager_imob','crm.dashboard.view');
insert into public.role_permissions values ('manager_imob','crm.dashboard.with_canal_imob.view');
insert into public.role_permissions values ('manager_imob','crm.partnerships.view');
insert into public.role_permissions values ('manager_imob','crm.stages.view');
insert into public.role_permissions values ('manager_imob','pages.view');
insert into public.role_permissions values ('master','admin.access');
insert into public.role_permissions values ('master','audit.view');
insert into public.role_permissions values ('master','crm.dashboard.all.view');
insert into public.role_permissions values ('master','crm.dashboard.view');
insert into public.role_permissions values ('master','crm.dashboard.with_canal_imob.view');
insert into public.role_permissions values ('master','crm.dashboard.without_canal_imob.view');
insert into public.role_permissions values ('master','crm.ingest.manage');
insert into public.role_permissions values ('master','crm.partnerships.view');
insert into public.role_permissions values ('master','crm.ranking.view');
insert into public.role_permissions values ('master','crm.salesforce.refresh');
insert into public.role_permissions values ('master','crm.settings.manage');
insert into public.role_permissions values ('master','crm.settings.view');
insert into public.role_permissions values ('master','crm.simulators.execute');
insert into public.role_permissions values ('master','crm.simulators.view');
insert into public.role_permissions values ('master','crm.stages.view');
insert into public.role_permissions values ('master','pages.manage');
insert into public.role_permissions values ('master','pages.view');
insert into public.role_permissions values ('master','permissions.manage');
insert into public.role_permissions values ('master','permissions.view');
insert into public.role_permissions values ('master','roles.manage');
insert into public.role_permissions values ('master','roles.view');
insert into public.role_permissions values ('master','users.manage');
insert into public.role_permissions values ('master','users.view');

CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$;

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;

CREATE OR REPLACE FUNCTION private._internal_assert_actor_active(actor_uuid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_level  integer;
  v_active boolean;
begin
  if actor_uuid is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  v_level := public._internal_get_role_level(actor_uuid);

  if v_level is null then
    raise exception 'unauthorized: actor has no role'
      using errcode = '28000';
  end if;

  -- profiles row may legitimately be absent in M5.2; only an explicit
  -- is_active = false blocks. A null/missing row is treated as active.
  select p.is_active
    into v_active
    from public.profiles p
    where p.user_id = actor_uuid;

  if v_active is false then
    raise exception 'forbidden: actor is inactive'
      using errcode = '42501';
  end if;

  return v_level;
end;
$function$;

CREATE OR REPLACE FUNCTION private._internal_get_role_level(user_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.level
  from public.user_roles ur
  join public.roles r on r.key = ur.role_key
  where ur.user_id = user_uuid;
$function$;

CREATE OR REPLACE FUNCTION private._internal_has_permission(user_uuid uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when not exists (
      select 1
      from public.profiles p
      where p.user_id = user_uuid
        and p.is_active
    ) then false
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'deny'
    ) then false
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'allow'
    ) then true
    when exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_key = ur.role_key
      where ur.user_id = user_uuid
        and rp.permission_key = _internal_has_permission.permission_key
    ) then true
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION private.current_session_is_live()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_claims jsonb := (select auth.jwt());
  v_session_id text;
begin
  if v_user_id is null then
    return false;
  end if;

  v_session_id := nullif(v_claims ->> 'session_id', '');

  -- Existing pgTAP files historically model auth.uid() with the legacy
  -- per-claim GUCs while connected as postgres. That privileged, local-only
  -- harness is already able to bypass RLS. Real PostgREST requests run under
  -- session_user=authenticator and must always carry a session_id claim.
  if v_session_id is null then
    return session_user = 'postgres'
      and nullif(current_setting('request.jwt.claims', true), '') is null;
  end if;

  return exists (
    select 1
    from auth.sessions session
    where session.id::text = v_session_id
      and session.user_id = v_user_id
      and (session.not_after is null or session.not_after > now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.current_session_satisfies_mfa()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_claims jsonb := (select auth.jwt());
  v_session_id text := nullif(v_claims ->> 'session_id', '');
  v_session_aal text;
begin
  if not private.current_session_is_live() then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_claims -> 'amr') = 'array' then v_claims -> 'amr'
        else '[]'::jsonb
      end
    ) as method(value)
    where method.value #>> '{}' in ('recovery', 'otp')
       or method.value ->> 'method' in ('recovery', 'otp')
  ) then
    return false;
  end if;

  if v_session_id is null then
    return true;
  end if;

  select session.aal::text
    into v_session_aal
  from auth.sessions session
  where session.id::text = v_session_id
    and session.user_id = v_user_id;

  if exists (
    select 1
    from auth.mfa_factors factor
    where factor.user_id = v_user_id
      and factor.status = 'verified'
  ) then
    return coalesce(v_claims ->> 'aal', '') = 'aal2'
      and v_session_aal = 'aal2';
  end if;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.get_role_level(user_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is null then null
    when user_uuid = (select auth.uid())
      then public._internal_get_role_level(user_uuid)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      then public._internal_get_role_level(user_uuid)
    else null
  end;
$function$;

CREATE OR REPLACE FUNCTION private.has_permission(user_uuid uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is null then false
    when user_uuid = (select auth.uid())
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public._internal_assert_actor_active(actor_uuid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is not null
     and not (select private.current_session_satisfies_mfa()) then
    raise exception 'unauthorized: session assurance required'
      using errcode = '28000';
  end if;

  return private._internal_assert_actor_active(actor_uuid);
end;
$function$;

CREATE OR REPLACE FUNCTION public._internal_get_role_level(user_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is not null
      and not (select private.current_session_satisfies_mfa()) then null
    else private._internal_get_role_level(user_uuid)
  end;
$function$;

CREATE OR REPLACE FUNCTION public._internal_has_permission(user_uuid uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is not null
      and not (select private.current_session_satisfies_mfa()) then false
    else private._internal_has_permission(
      user_uuid,
      _internal_has_permission.permission_key
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_user_permission_access_draft(target_user_id uuid, allow_permission_keys text[], deny_permission_keys text[], inherit_permission_keys text[], reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
declare
  v_allow_permission_keys text[] := coalesce(allow_permission_keys, array[]::text[]);
  v_deny_permission_keys text[] := coalesce(deny_permission_keys, array[]::text[]);
  v_inherit_permission_keys text[] := coalesce(inherit_permission_keys, array[]::text[]);
  v_permission_keys text[];
  v_permission_count integer;
  v_allow_result jsonb;
  v_deny_result jsonb;
  v_inherit_result jsonb;
begin
  v_permission_keys := v_allow_permission_keys
    || v_deny_permission_keys
    || v_inherit_permission_keys;
  v_permission_count := cardinality(v_permission_keys);

  if target_user_id is null
     or v_permission_count < 1
     or v_permission_count > 100
     or nullif(btrim(coalesce(reason, '')), '') is null
     or char_length(btrim(reason)) > 240
     or array_position(v_permission_keys, null) is not null
     or (
       select count(distinct requested.permission_key)
       from unnest(v_permission_keys) requested(permission_key)
     ) <> v_permission_count then
    raise exception 'invalid_argument: target, 1-100 unique permissions and reason are required'
      using errcode = '22023';
  end if;

  if cardinality(v_allow_permission_keys) > 0 then
    v_allow_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_allow_permission_keys,
      'allow',
      reason
    );
  end if;

  if cardinality(v_deny_permission_keys) > 0 then
    v_deny_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_deny_permission_keys,
      'deny',
      reason
    );
  end if;

  if cardinality(v_inherit_permission_keys) > 0 then
    v_inherit_result := public.set_user_permission_overrides_bulk(
      target_user_id,
      v_inherit_permission_keys,
      'inherit',
      reason
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'changed_count', v_permission_count,
    'allow', v_allow_result,
    'deny', v_deny_result,
    'inherit', v_inherit_result
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id uuid, target_role_key text, reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_level  integer;
  v_target_level integer;
  v_target_role  text;
  v_new_level    integer;
  v_audit_id     bigint;
  v_before       jsonb;
  v_after        jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if target_role_key is null then
    raise exception 'invalid_argument: target_role_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  select r.level
    into v_new_level
    from public.roles r
    where r.key = target_role_key;

  if v_new_level is null then
    raise exception 'invalid_argument: unknown role %', target_role_key
      using errcode = '22023';
  end if;

  -- Lock the target's existing user_roles row (if any) for the txn.
  select ur.role_key, r.level
    into v_target_role, v_target_level
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    where ur.user_id = target_user_id
    for update;

  -- Target hierarchy guard.
  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  -- New-role hierarchy + permission guard (delegated).
  if not public.can_assign_role(v_actor, target_role_key) then
    raise exception
      'forbidden: actor cannot assign role % (level %)',
      target_role_key, v_new_level
      using errcode = '42501';
  end if;

  v_before := case
    when v_target_role is null then null::jsonb
    else jsonb_build_object('role_key', v_target_role, 'level', v_target_level)
  end;
  v_after := jsonb_build_object('role_key', target_role_key, 'level', v_new_level);

  insert into public.user_roles (user_id, role_key, assigned_by)
    values (target_user_id, target_role_key, v_actor)
    on conflict (user_id) do update
      set role_key    = excluded.role_key,
          assigned_by = excluded.assigned_by,
          updated_at  = now();

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.role_assigned',
      jsonb_build_object('previous', v_before, 'reason', reason),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_assign_role(actor_uuid uuid, target_role_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    target_role_key <> 'master'
    and (
      target_role_key <> 'admin'
      or exists (
        select 1
        from public.user_roles actor_role
        where actor_role.user_id = actor_uuid
          and actor_role.role_key = 'master'
      )
    )
    and coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (
        select role_entry.is_assignable
          and role_entry.level < coalesce(
            public._internal_get_role_level(actor_uuid),
            0
          )
        from public.roles role_entry
        where role_entry.key = target_role_key
      ),
      false
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_grant_permission(actor_uuid uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.current_session_is_live()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.current_session_is_live();
$function$;

CREATE OR REPLACE FUNCTION public.get_role_level(user_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is null then null
    when not (select private.current_session_satisfies_mfa()) then null
    else private.get_role_level(user_uuid)
  end;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (select auth.uid()) is null then false
    when not (select private.current_session_satisfies_mfa()) then false
    else private.has_permission(user_uuid, has_permission.permission_key)
  end;
$function$;

CREATE OR REPLACE FUNCTION public.remove_user_permission_override(target_user_id uuid, permission_key text, reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = remove_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      remove_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, permission_key) then
    raise exception 'forbidden: actor cannot manage permission %',
      permission_key
      using errcode = '42501';
  end if;

  -- All guards passed. Now check whether there is anything to remove.
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = remove_user_permission_override.permission_key
    for update;

  if v_previous_effect is null then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  -- FIX: alias the target table and fully-qualify both sides so the bare
  -- `permission_key` is no longer ambiguous between column and parameter.
  delete from public.user_permission_overrides as upo
    where upo.user_id = remove_user_permission_override.target_user_id
      and upo.permission_key = remove_user_permission_override.permission_key;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_removed',
      jsonb_build_object(
        'permission_key', permission_key,
        'effect',         v_previous_effect,
        'reason',         reason
      ),
      null
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_permission_override(target_user_id uuid, permission_key text, effect text, reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- plpgsql: prefer column references when identifiers clash with parameter
-- names (e.g. permission_key, effect, reason match columns of
-- user_permission_overrides). Parameters are still reachable via the
-- function-qualified name (set_user_permission_override.permission_key).
#variable_conflict use_column
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
  v_before           jsonb;
  v_after            jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  if set_user_permission_override.effect is null
     or set_user_permission_override.effect not in ('allow', 'deny') then
    raise exception 'invalid_argument: effect must be allow or deny'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = set_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      set_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  -- Lock existing override row (if any).
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = set_user_permission_override.permission_key
    for update;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, set_user_permission_override.permission_key) then
    raise exception 'forbidden: actor cannot grant permission %',
      set_user_permission_override.permission_key
      using errcode = '42501';
  end if;

  v_before := case
    when v_previous_effect is null then null::jsonb
    else jsonb_build_object('effect', v_previous_effect)
  end;
  v_after := jsonb_build_object('effect', set_user_permission_override.effect);

  insert into public.user_permission_overrides
    (user_id, permission_key, effect, reason, granted_by)
    values (
      target_user_id,
      set_user_permission_override.permission_key,
      set_user_permission_override.effect,
      set_user_permission_override.reason,
      v_actor
    )
    on conflict (user_id, permission_key) do update
      set effect     = excluded.effect,
          reason     = excluded.reason,
          granted_by = excluded.granted_by;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_set',
      jsonb_build_object(
        'permission_key', set_user_permission_override.permission_key,
        'previous',       v_before,
        'reason',         set_user_permission_override.reason
      ),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_permission_overrides_bulk(target_user_id uuid, permission_keys text[], effect text, reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
#variable_conflict use_column
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_target_is_active boolean;
  v_target_is_approved boolean;
  v_scope_allowed boolean := true;
  v_permission_count integer := coalesce(cardinality(permission_keys), 0);
  v_changed_count integer := 0;
  v_previous_effects jsonb := '{}'::jsonb;
  v_audit_id bigint;
begin
  if target_user_id is null
     or v_permission_count < 1
     or v_permission_count > 100
     or effect is null
     or effect not in ('allow', 'deny', 'inherit')
     or nullif(btrim(coalesce(reason, '')), '') is null
     or char_length(btrim(reason)) > 240 then
    raise exception 'invalid_argument: target, 1-100 permissions, effect and reason are required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(permission_keys) requested(permission_key)
    where requested.permission_key is null
       or nullif(btrim(requested.permission_key), '') is null
  ) or (
    select count(distinct requested.permission_key)
    from unnest(permission_keys) requested(permission_key)
  ) <> v_permission_count then
    raise exception 'invalid_argument: permissions must be nonempty and unique'
      using errcode = '22023';
  end if;

  if v_actor is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  perform 1
  from public.profiles profile
  where profile.user_id = v_actor
    and profile.is_active
  for update;

  if not found
     or not coalesce(
       public._internal_has_permission(v_actor, 'permissions.manage'),
       false
     ) then
    raise exception 'forbidden: actor cannot manage permission exceptions'
      using errcode = '42501';
  end if;

  v_actor_level := public._internal_get_role_level(v_actor);
  if v_actor_level is null then
    raise exception 'forbidden: actor has no active role'
      using errcode = '42501';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if to_regprocedure('private.can_manage_user(uuid)') is not null then
    execute 'select private.can_manage_user($1)'
      into v_scope_allowed
      using target_user_id;
  end if;

  if not coalesce(v_scope_allowed, false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  select profile.is_active
  into v_target_is_active
  from public.profiles profile
  where profile.user_id = target_user_id
  for update;

  if to_regprocedure('private.can_manage_user(uuid)') is not null then
    execute 'select private.can_manage_user($1)'
      into v_scope_allowed
      using target_user_id;
  end if;

  if not coalesce(v_scope_allowed, false) then
    raise exception 'forbidden: target is outside actor scope'
      using errcode = '42501';
  end if;

  if not found or not v_target_is_active then
    raise exception 'conflict: permission exceptions require an active target'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from information_schema.columns column_entry
    where column_entry.table_schema = 'public'
      and column_entry.table_name = 'profiles'
      and column_entry.column_name = 'access_status'
  ) then
    execute
      'select profile.access_status = ''approved'' '
      || 'from public.profiles profile where profile.user_id = $1'
      into v_target_is_approved
      using target_user_id;

    if not coalesce(v_target_is_approved, false) then
      raise exception 'conflict: permission exceptions require an approved target'
        using errcode = '23505';
    end if;
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.permissions permission
    where permission.key = any(permission_keys)
  ) <> v_permission_count then
    raise exception 'invalid_argument: unknown permission'
      using errcode = '22023';
  end if;

  perform permission.key
  from public.permissions permission
  where permission.key = any(permission_keys)
  order by permission.key
  for update;

  if exists (
    select 1
    from unnest(permission_keys) requested(permission_key)
    where not public.can_grant_permission(v_actor, requested.permission_key)
  ) then
    raise exception 'forbidden: actor cannot manage every requested permission'
      using errcode = '42501';
  end if;

  perform permission_override.permission_key
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = any(permission_keys)
  order by permission_override.permission_key
  for update;

  select coalesce(
    jsonb_object_agg(
      permission_override.permission_key,
      permission_override.effect
      order by permission_override.permission_key
    ),
    '{}'::jsonb
  )
  into v_previous_effects
  from public.user_permission_overrides permission_override
  where permission_override.user_id = target_user_id
    and permission_override.permission_key = any(permission_keys);

  if effect = 'inherit' then
    delete from public.user_permission_overrides permission_override
    where permission_override.user_id = target_user_id
      and permission_override.permission_key = any(permission_keys);
    get diagnostics v_changed_count = row_count;
  else
    insert into public.user_permission_overrides (
      user_id,
      permission_key,
      effect,
      reason,
      granted_by
    )
    select
      target_user_id,
      requested.permission_key,
      effect,
      btrim(reason),
      v_actor
    from unnest(permission_keys) requested(permission_key)
    order by requested.permission_key
    on conflict (user_id, permission_key) do update
    set effect = excluded.effect,
        reason = excluded.reason,
        granted_by = excluded.granted_by;
    get diagnostics v_changed_count = row_count;
  end if;

  insert into public.audit_logs (
    actor_id,
    target_user_id,
    action,
    before,
    after
  ) values (
    v_actor,
    target_user_id,
    'authorization.permission_overrides_bulk_set',
    jsonb_build_object(
      'permission_keys', to_jsonb(permission_keys),
      'effects', v_previous_effects,
      'reason', btrim(reason)
    ),
    jsonb_build_object(
      'effect', effect,
      'changed_count', v_changed_count
    )
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'ok', true,
    'audit_id', v_audit_id,
    'effect', effect,
    'changed_count', v_changed_count
  );
end;
$function$;

revoke all privileges on function auth.jwt() from public, anon, authenticated, service_role;
grant EXECUTE on function auth.jwt() to PUBLIC;

revoke all privileges on function auth.uid() from public, anon, authenticated, service_role;
grant EXECUTE on function auth.uid() to PUBLIC;

revoke all privileges on function private._internal_assert_actor_active(actor_uuid uuid) from public, anon, authenticated, service_role;

revoke all privileges on function private._internal_get_role_level(user_uuid uuid) from public, anon, authenticated, service_role;

revoke all privileges on function private._internal_has_permission(user_uuid uuid, permission_key text) from public, anon, authenticated, service_role;

revoke all privileges on function private.current_session_is_live() from public, anon, authenticated, service_role;

revoke all privileges on function private.current_session_satisfies_mfa() from public, anon, authenticated, service_role;
grant EXECUTE on function private.current_session_satisfies_mfa() to authenticated;

revoke all privileges on function private.get_role_level(user_uuid uuid) from public, anon, authenticated, service_role;

revoke all privileges on function private.has_permission(user_uuid uuid, permission_key text) from public, anon, authenticated, service_role;

revoke all privileges on function public._internal_assert_actor_active(actor_uuid uuid) from public, anon, authenticated, service_role;

revoke all privileges on function public._internal_get_role_level(user_uuid uuid) from public, anon, authenticated, service_role;

revoke all privileges on function public._internal_has_permission(user_uuid uuid, permission_key text) from public, anon, authenticated, service_role;

revoke all privileges on function public.apply_user_permission_access_draft(target_user_id uuid, allow_permission_keys text[], deny_permission_keys text[], inherit_permission_keys text[], reason text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.apply_user_permission_access_draft(target_user_id uuid, allow_permission_keys text[], deny_permission_keys text[], inherit_permission_keys text[], reason text) to authenticated;

revoke all privileges on function public.assign_user_role(target_user_id uuid, target_role_key text, reason text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.assign_user_role(target_user_id uuid, target_role_key text, reason text) to authenticated;

revoke all privileges on function public.can_assign_role(actor_uuid uuid, target_role_key text) from public, anon, authenticated, service_role;

revoke all privileges on function public.can_grant_permission(actor_uuid uuid, permission_key text) from public, anon, authenticated, service_role;

revoke all privileges on function public.current_session_is_live() from public, anon, authenticated, service_role;
grant EXECUTE on function public.current_session_is_live() to authenticated;

revoke all privileges on function public.get_role_level(user_uuid uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.get_role_level(user_uuid uuid) to authenticated;

revoke all privileges on function public.has_permission(user_uuid uuid, permission_key text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.has_permission(user_uuid uuid, permission_key text) to authenticated;

revoke all privileges on function public.remove_user_permission_override(target_user_id uuid, permission_key text, reason text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.remove_user_permission_override(target_user_id uuid, permission_key text, reason text) to authenticated;

revoke all privileges on function public.set_user_permission_override(target_user_id uuid, permission_key text, effect text, reason text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_user_permission_override(target_user_id uuid, permission_key text, effect text, reason text) to authenticated;

revoke all privileges on function public.set_user_permission_overrides_bulk(target_user_id uuid, permission_keys text[], effect text, reason text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_user_permission_overrides_bulk(target_user_id uuid, permission_keys text[], effect text, reason text) to authenticated;

revoke all privileges on table public.profiles,public.user_roles,public.user_permission_overrides,public.permissions,public.role_permissions,public.roles,public.audit_logs from anon,authenticated,service_role;
grant SELECT on public.user_permission_overrides to authenticated;
grant SELECT on public.user_roles to authenticated;
grant SELECT on public.audit_logs to authenticated;
grant SELECT on public.profiles to authenticated;

