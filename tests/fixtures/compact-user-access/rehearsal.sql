\set ON_ERROR_STOP on
-- Run as postgres only in a fresh disposable PostgreSQL database with pgTAP.
-- Example: psql -X -v ON_ERROR_STOP=1 -d "$COMPACT_TEST_DATABASE_URL" \
--   -f tests/fixtures/compact-user-access/rehearsal.sql
-- No production data, credentials or live database mutations are involved.

do $$
begin
  if session_user <> 'postgres'
     or to_regclass('public.profiles') is not null
     or to_regclass('auth.users') is not null then
    raise exception 'Compact rehearsal requires an empty disposable database owned by postgres';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create extension if not exists pgtap;
create schema auth;
create schema private;
grant usage on schema auth, public to anon, authenticated, service_role;
grant usage on schema private to authenticated;
create table auth.users (id uuid primary key, email text);
create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id), aal text, not_after timestamptz);
create table auth.mfa_factors (id uuid primary key, user_id uuid references auth.users(id), status text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

\ir ../../../supabase/migrations/20260519190726_access_control_foundation.sql
\ir ../../../supabase/migrations/20260522010552_access_control_admin_functions.sql
\ir production-authorization.sql

drop policy profiles_select_self on public.profiles;
drop policy profiles_select_with_users_view on public.profiles;
create policy profiles_select_self_or_users_view on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission((select auth.uid()), 'users.view'));
create policy authenticated_session_mfa_gate on public.profiles
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));

\ir ../../../supabase/migrations/20261011143218_protect_administrator_accounts_and_enable_simulator_view.sql
\ir ../../../supabase/migrations/20261014191212_local_user_access_checkboxes.sql
\ir ../../../supabase/migrations/20261014192616_local_simulator_access_all_roles.sql
\ir ../../../supabase/migrations/20261014193926_local_inventory_brand_access.sql
\ir ../../../supabase/migrations/20261014204014_local_user_presence.sql
-- The deployment prepares additive RPCs/catalogs while the previous runtime is
-- live. Brand defaults are exposed only after the compatible runtime activates.
do $$
begin
  if exists (select 1 from public.role_permissions where permission_key like 'crm.inventory.%')
     or exists (select 1 from public.user_permission_overrides where permission_key like 'crm.inventory.%') then
    raise exception 'Preparation phase must not expose a new inventory permission';
  end if;
end;
$$;
\ir ../../../supabase/migrations/20261014201400_local_admin_all_permission_defaults.sql
\ir ../../../supabase/migrations/20261015201949_master_all_permission_defaults.sql
\ir user-access.test.sql

\ir page-catalog.test.sql

\ir individual-pages.test.sql

\ir page-data.test.sql
