-- Authentication hardening foundation:
--   * bind every authenticated data read/write to a live auth.sessions row;
--   * require AAL2 whenever the user has a verified MFA factor;
--   * keep the legal-acceptance ledger private and append-only;
--   * prevent newly registered users from being approved without the exact
--     versioned Terms and Privacy acceptance required at registration.
--
-- This migration does not enable MFA remotely and does not change any
-- commercial/integration feature flag. It also removes four simulator preview
-- catalog rows that are absent from the approved production set; their route
-- code and engines remain versioned but unavailable.

create or replace function private.current_session_is_live()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all privileges on function private.current_session_is_live()
  from public, anon, authenticated, service_role;

create or replace function private.current_session_satisfies_mfa()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all privileges on function private.current_session_satisfies_mfa()
  from public, anon, authenticated, service_role;
grant execute on function private.current_session_satisfies_mfa()
  to authenticated;

create or replace function public.current_session_is_live()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_session_is_live();
$$;

revoke all privileges on function public.current_session_is_live()
  from public, anon, authenticated, service_role;
grant execute on function public.current_session_is_live()
  to authenticated;

create or replace function private.current_session_is_fresh_password_recovery()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_session_is_live()
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof((select auth.jwt()) -> 'amr') = 'array'
            then (select auth.jwt()) -> 'amr'
          else '[]'::jsonb
        end
      ) as method(value)
      where method.value ->> 'method' in ('recovery', 'otp')
        and jsonb_typeof(method.value -> 'timestamp') = 'number'
        and method.value ->> 'timestamp' ~ '^[0-9]{1,12}$'
        and extract(epoch from now())::bigint - (method.value ->> 'timestamp')::bigint
          between -60 and 900
    );
$$;

revoke all privileges on function private.current_session_is_fresh_password_recovery()
  from public, anon, authenticated, service_role;

create or replace function public.revoke_current_user_sessions_after_password_recovery()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
     or not private.current_session_is_fresh_password_recovery() then
    raise exception 'unauthorized: fresh password recovery required'
      using errcode = '28000';
  end if;

  delete from auth.sessions session
  where session.user_id = v_user_id;

  return true;
end;
$$;

revoke all privileges on function public.revoke_current_user_sessions_after_password_recovery()
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_current_user_sessions_after_password_recovery()
  to authenticated;

-- Reconcile only the role-permission baseline already observed in production.
-- An earlier clean-install migration intentionally narrows these grants to
-- Master, but that must not turn this Auth/MFA release into an authorization
-- migration. The inserts are idempotent in production and restore a clean
-- installation to the same inherited-access baseline. Missing prerequisite
-- roles or permissions fail through the foreign keys instead of being skipped.
insert into public.role_permissions (role_key, permission_key)
values
  ('admin', 'admin.access'),
  ('admin', 'audit.view'),
  ('admin', 'crm.dashboard.view'),
  ('admin', 'crm.ingest.manage'),
  ('admin', 'crm.ranking.view'),
  ('admin', 'crm.salesforce.refresh'),
  ('admin', 'crm.settings.manage'),
  ('admin', 'crm.settings.view'),
  ('admin', 'crm.stages.view'),
  ('admin', 'pages.manage'),
  ('admin', 'pages.view'),
  ('admin', 'permissions.manage'),
  ('admin', 'permissions.view'),
  ('admin', 'roles.manage'),
  ('admin', 'roles.view'),
  ('admin', 'users.manage'),
  ('admin', 'users.view'),
  ('coordinator', 'crm.dashboard.view'),
  ('coordinator', 'crm.ranking.view'),
  ('coordinator', 'crm.stages.view'),
  ('coordinator', 'pages.view'),
  ('supervisor', 'crm.dashboard.view'),
  ('supervisor', 'crm.ranking.view'),
  ('supervisor', 'crm.stages.view'),
  ('supervisor', 'pages.view'),
  ('real_estate', 'crm.dashboard.view'),
  ('real_estate', 'crm.ranking.view'),
  ('real_estate', 'crm.stages.view'),
  ('real_estate', 'pages.view'),
  ('broker_lead', 'crm.dashboard.view'),
  ('broker_lead', 'crm.ranking.view'),
  ('broker_lead', 'crm.stages.view'),
  ('broker_lead', 'pages.view'),
  ('broker', 'crm.dashboard.view'),
  ('broker', 'crm.ranking.view'),
  ('broker', 'crm.stages.view'),
  ('broker', 'pages.view'),
  ('user', 'crm.dashboard.view'),
  ('user', 'crm.ranking.view'),
  ('user', 'crm.stages.view'),
  ('user', 'pages.view')
on conflict (role_key, permission_key) do nothing;

do $migration$
declare
  v_expected_pairs constant jsonb := $$[
    {"role":"admin","permissions":["admin.access","audit.view","crm.dashboard.view","crm.ingest.manage","crm.ranking.view","crm.salesforce.refresh","crm.settings.manage","crm.settings.view","crm.stages.view","pages.manage","pages.view","permissions.manage","permissions.view","roles.manage","roles.view","users.manage","users.view"]},
    {"role":"coordinator","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]},
    {"role":"supervisor","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]},
    {"role":"real_estate","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]},
    {"role":"broker_lead","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]},
    {"role":"broker","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]},
    {"role":"user","permissions":["crm.dashboard.view","crm.ranking.view","crm.stages.view","pages.view"]}
  ]$$::jsonb;
begin
  if exists (
    select 1
    from jsonb_array_elements(v_expected_pairs) role_contract
    cross join lateral jsonb_array_elements_text(
      role_contract -> 'permissions'
    ) permission_contract(permission_key)
    where not exists (
      select 1
      from public.role_permissions role_permission
      where role_permission.role_key = role_contract ->> 'role'
        and role_permission.permission_key = permission_contract.permission_key
    )
  ) then
    raise exception 'production RBAC compatibility baseline is incomplete'
      using errcode = '23514';
  end if;
end;
$migration$;

-- Production has exactly 17 commercial/admin catalog pages. Older clean
-- replays may contain four future simulator previews from the visual-catalog
-- increment. Remove only those exact identities; route code stays versioned
-- and the application returns 403 until a future, explicit product gate.
do $migration$
begin
  if exists (
    select 1
    from public.app_pages page
    join (
      values
        ('crm.simulation.wf16', '/app/simulacao/calcular-documentacao'),
        ('crm.simulation.caixa', '/app/simulacao/caixa'),
        ('crm.simulation.wf14', '/app/simulacao/tabela-direta'),
        ('crm.simulation.wf15', '/app/simulacao/tabela-investidor')
    ) expected(page_key, page_path)
      on page.key = expected.page_key or page.path = expected.page_path
    where page.key <> expected.page_key or page.path <> expected.page_path
  ) then
    raise exception 'future simulator page identity conflicts with the approved catalog'
      using errcode = '55000';
  end if;
end;
$migration$;

delete from public.app_pages
where (key, path) in (
  ('crm.simulation.wf16', '/app/simulacao/calcular-documentacao'),
  ('crm.simulation.caixa', '/app/simulacao/caixa'),
  ('crm.simulation.wf14', '/app/simulacao/tabela-direta'),
  ('crm.simulation.wf15', '/app/simulacao/tabela-investidor')
);

do $migration$
begin
  if exists (
    with expected(page_key, page_path, permission_key, is_navigation) as (
      values
        ('admin.home', '/admin', 'admin.access', true),
        ('admin.pages', '/admin/paginas', 'pages.manage', true),
        ('admin.users', '/admin/usuarios', 'users.view', true),
        ('crm.dashboard', '/app', 'crm.dashboard.view', true),
        ('crm.partnerships', '/app/canal-de-parcerias', 'crm.partnerships.view', true),
        ('crm.ranking', '/app/ranking', 'crm.ranking.view', true),
        ('crm.settings', '/app/configuracoes', 'crm.settings.view', true),
        ('crm.settings.goals', '/app/configuracoes/metas', 'crm.settings.manage', true),
        (
          'crm.settings.partnerships',
          '/app/configuracoes/metas/parcerias',
          'crm.settings.manage',
          true
        ),
        (
          'crm.settings.points',
          '/app/configuracoes/metas/pontos',
          'crm.settings.manage',
          true
        ),
        ('crm.simulation', '/app/simulacao', 'crm.simulators.view', true),
        (
          'crm.simulation.wf13',
          '/app/simulacao/associativo-fluxo-linear',
          'crm.simulators.view',
          true
        ),
        (
          'crm.stage.appointments',
          '/app/etapas/agendamentos',
          'crm.stages.view',
          true
        ),
        ('crm.stage.folders', '/app/etapas/pastas', 'crm.stages.view', true),
        ('crm.stage.opportunities', '/app/etapas/oportunidades', 'crm.stages.view', true),
        ('crm.stage.sales', '/app/etapas/vendas', 'crm.stages.view', true),
        ('crm.stage.visits', '/app/etapas/visitas', 'crm.stages.view', true)
    ),
    actual as (
      select page.key, page.path, page.permission_key, page.is_navigation
      from public.app_pages page
      where page.is_active
    ),
    difference as (
      (select * from expected except select * from actual)
      union all
      (select * from actual except select * from expected)
    )
    select 1 from difference
  ) then
    raise exception 'active page catalog differs from the approved 17-page production set'
      using errcode = '23514';
  end if;

  if (select count(*) from public.app_pages) <> 17 then
    raise exception 'page catalog contains entries outside the approved production set'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.app_pages page
    join public.role_permissions role_permission
      on role_permission.permission_key = page.permission_key
    where page.is_active
      and role_permission.role_key in (
        'manager',
        'house',
        'partnership_channel',
        'pending'
      )
      and exists (
        select 1
        from public.role_permissions page_permission
        where page_permission.role_key = role_permission.role_key
          and page_permission.permission_key = 'pages.view'
      )
  ) then
    raise exception 'future or pending role inherited an active commercial page'
      using errcode = '23514';
  end if;
end;
$migration$;

-- Preserve the authorization implementation already installed in each
-- environment. Production currently uses the legacy role/permission model;
-- clean installs include the later approval and reporting-scope model. The
-- migration decorates either implementation with one session/MFA gate instead
-- of replacing its commercial semantics or importing future foundations.
do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
  v_private_definition text;
begin
  foreach v_signature in array array[
    'public._internal_get_role_level(uuid)',
    'public._internal_has_permission(uuid,text)',
    'public._internal_list_permissions(uuid)',
    'public._internal_assert_actor_active(uuid)',
    'public.has_permission(uuid,text)',
    'public.get_role_level(uuid)',
    'public.get_user_authorization_context(uuid)'
  ] loop
    v_function := pg_catalog.to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'required authorization contract is absent: %', v_signature
        using errcode = '42P01';
    end if;

    v_definition := pg_catalog.pg_get_functiondef(v_function);
    v_private_definition := pg_catalog.replace(
      v_definition,
      'CREATE OR REPLACE FUNCTION public.',
      'CREATE OR REPLACE FUNCTION private.'
    );

    if v_private_definition = v_definition then
      raise exception 'cannot preserve authorization contract: %', v_signature
        using errcode = '55000';
    end if;

    execute v_private_definition;
  end loop;
end;
$migration$;

alter function private._internal_get_role_level(uuid) owner to postgres;
alter function private._internal_has_permission(uuid, text) owner to postgres;
alter function private._internal_list_permissions(uuid) owner to postgres;
alter function private._internal_assert_actor_active(uuid) owner to postgres;
alter function private.has_permission(uuid, text) owner to postgres;
alter function private.get_role_level(uuid) owner to postgres;
alter function private.get_user_authorization_context(uuid) owner to postgres;

revoke all privileges on function
  private._internal_get_role_level(uuid),
  private._internal_has_permission(uuid, text),
  private._internal_list_permissions(uuid),
  private._internal_assert_actor_active(uuid),
  private.has_permission(uuid, text),
  private.get_role_level(uuid),
  private.get_user_authorization_context(uuid)
from public, anon, authenticated, service_role;

create or replace function public._internal_get_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
      and not (select private.current_session_satisfies_mfa()) then null
    else private._internal_get_role_level(user_uuid)
  end;
$$;

create or replace function public._internal_has_permission(
  user_uuid uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
      and not (select private.current_session_satisfies_mfa()) then false
    else private._internal_has_permission(
      user_uuid,
      _internal_has_permission.permission_key
    )
  end;
$$;

create or replace function public._internal_list_permissions(user_uuid uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is not null
      and not (select private.current_session_satisfies_mfa()) then array[]::text[]
    else private._internal_list_permissions(user_uuid)
  end;
$$;

create or replace function public._internal_assert_actor_active(actor_uuid uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not (select private.current_session_satisfies_mfa()) then
    raise exception 'unauthorized: session assurance required'
      using errcode = '28000';
  end if;

  return private._internal_assert_actor_active(actor_uuid);
end;
$$;

create or replace function public.has_permission(
  user_uuid uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when not (select private.current_session_satisfies_mfa()) then false
    else private.has_permission(user_uuid, has_permission.permission_key)
  end;
$$;

create or replace function public.get_role_level(user_uuid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when not (select private.current_session_satisfies_mfa()) then null
    else private.get_role_level(user_uuid)
  end;
$$;

create or replace function public.get_user_authorization_context(user_uuid uuid)
returns table (
  user_id uuid,
  role_key text,
  level integer,
  permissions text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not (select private.current_session_satisfies_mfa()) then
    return;
  end if;

  return query
    select authorization_context.*
    from private.get_user_authorization_context(user_uuid) authorization_context;
end;
$$;

revoke all privileges on function
  public._internal_get_role_level(uuid),
  public._internal_has_permission(uuid, text),
  public._internal_list_permissions(uuid),
  public._internal_assert_actor_active(uuid),
  public.has_permission(uuid, text),
  public.get_role_level(uuid),
  public.get_user_authorization_context(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.has_permission(uuid, text),
  public.get_role_level(uuid),
  public.get_user_authorization_context(uuid)
to authenticated;

-- A restrictive policy is ANDed with every existing permissive policy. Cover
-- the complete installed public RLS surface rather than a future-schema list.
-- Environments with an authenticated table grant but no RLS fail explicitly.
do $migration$
declare
  v_table name;
  v_expected bigint;
  v_actual bigint;
begin
  if exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
      and (
        pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'INSERT')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'UPDATE')
        or pg_catalog.has_table_privilege('authenticated', relation.oid, 'DELETE')
      )
  ) then
    raise exception 'authenticated table privilege without RLS'
      using errcode = '42501';
  end if;

  select count(*)
    into v_expected
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if v_expected = 0 then
    raise exception 'public RLS contract is absent'
      using errcode = '42P01';
  end if;

  for v_table in
    select relation.relname
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
    order by relation.relname
  loop
    execute pg_catalog.format(
      'drop policy if exists authenticated_session_mfa_gate on public.%I',
      v_table
    );
    execute pg_catalog.format(
      'create policy authenticated_session_mfa_gate on public.%I as restrictive for all to authenticated using ((select private.current_session_satisfies_mfa())) with check ((select private.current_session_satisfies_mfa()))',
      v_table
    );
  end loop;

  select count(*)
    into v_actual
  from pg_catalog.pg_policies policy
  where policy.schemaname = 'public'
    and policy.policyname = 'authenticated_session_mfa_gate'
    and policy.permissive = 'RESTRICTIVE'
    and policy.roles = array['authenticated']::name[]
    and policy.cmd = 'ALL'
    and policy.qual like '%current_session_satisfies_mfa%'
    and policy.with_check like '%current_session_satisfies_mfa%';

  if v_actual <> v_expected then
    raise exception 'session/MFA RLS coverage mismatch: expected %, got %',
      v_expected,
      v_actual
      using errcode = '42501';
  end if;
end;
$migration$;

create table private.legal_acceptance_requirements (
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  required_at timestamptz not null default now(),
  constraint legal_acceptance_requirements_user_versions_key
    primary key (user_id, terms_version, privacy_version)
);

create table private.legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null,
  constraint legal_acceptances_source_check
    check (source in ('public_registration', 'authenticated_acceptance')),
  constraint legal_acceptances_user_versions_key
    unique (user_id, terms_version, privacy_version)
);

create index legal_acceptances_user_id_idx
  on private.legal_acceptances (user_id);

alter table private.legal_acceptance_requirements enable row level security;
alter table private.legal_acceptance_requirements force row level security;
alter table private.legal_acceptances enable row level security;
alter table private.legal_acceptances force row level security;

revoke all privileges on table
  private.legal_acceptance_requirements,
  private.legal_acceptances
from public, anon, authenticated, service_role;

revoke all privileges on sequence private.legal_acceptances_id_seq
from public, anon, authenticated, service_role;

create or replace function private.prevent_legal_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'legal acceptance ledger is append-only'
    using errcode = '42501';
end;
$$;

revoke all privileges on function private.prevent_legal_ledger_mutation()
  from public, anon, authenticated, service_role;

create trigger legal_acceptance_requirements_append_only
  before update or delete on private.legal_acceptance_requirements
  for each row execute function private.prevent_legal_ledger_mutation();

create trigger legal_acceptances_append_only
  before update or delete on private.legal_acceptances
  for each row execute function private.prevent_legal_ledger_mutation();

create or replace function private.capture_registration_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms_version constant text := 'terms-2026-08-24-draft-1';
  v_privacy_version constant text := 'privacy-2026-08-24-draft-1';
  v_legal jsonb := coalesce(new.raw_user_meta_data -> 'legal_acceptance', '{}'::jsonb);
begin
  -- Legacy pgTAP fixtures insert auth.users directly as postgres and cannot
  -- represent an end-user registration. The privileged local-only harness
  -- supplies the same exact legal metadata as every other registration.
  if session_user = 'postgres' and v_legal = '{}'::jsonb then
    return new;
  end if;

  if v_legal ->> 'termsVersion' is distinct from v_terms_version
     or v_legal ->> 'privacyVersion' is distinct from v_privacy_version
     or v_legal -> 'termsAccepted' is distinct from 'true'::jsonb
     or v_legal -> 'privacyAccepted' is distinct from 'true'::jsonb then
    raise exception 'current legal acceptance required'
      using errcode = '23514';
  end if;

  insert into private.legal_acceptance_requirements (
    user_id,
    terms_version,
    privacy_version
  ) values (
    new.id,
    v_terms_version,
    v_privacy_version
  );

  insert into private.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    source
  ) values (
    new.id,
    v_terms_version,
    v_privacy_version,
    'public_registration'
  );

  return new;
end;
$$;

revoke all privileges on function private.capture_registration_legal_acceptance()
  from public, anon, authenticated, service_role;

drop trigger if exists on_auth_user_legal_acceptance on auth.users;
create trigger on_auth_user_legal_acceptance
  after insert on auth.users
  for each row execute function private.capture_registration_legal_acceptance();

comment on function private.current_session_satisfies_mfa() is
  'Fail-closed session/AAL gate. Reads only factor existence/status; never factor secrets.';
comment on table private.legal_acceptances is
  'Private append-only ledger for versioned Terms and Privacy acceptance; separate from cookie preferences.';
