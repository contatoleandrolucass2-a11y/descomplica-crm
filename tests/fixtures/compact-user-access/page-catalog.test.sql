-- Reproduces the existing page table contract in the compact authorization fixture.
-- Production has the same columns and guarded visibility API; this file is local QA only.
create table public.app_pages (
  key text primary key,
  path text not null unique,
  name text not null,
  description text not null default '',
  section text not null,
  permission_key text not null references public.permissions(key),
  parent_key text references public.app_pages(key) on delete restrict,
  sort_order integer not null default 0,
  is_navigation boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_pages enable row level security;
revoke all on public.app_pages from public, anon, authenticated;
grant select on public.app_pages to authenticated;
create policy app_pages_select_authorized on public.app_pages for select to authenticated
using (is_active and public.has_permission((select auth.uid()), 'pages.view')
  and public.has_permission((select auth.uid()), permission_key));

create temporary table page_catalog_before as
select (select count(*) from public.permissions) as permission_count,
  (select count(*) from public.role_permissions where role_key='admin') as admin_count,
  (select jsonb_agg(to_jsonb(r) order by r.role_key, r.permission_key)
   from public.role_permissions r where role_key not in ('master','admin')) as other_defaults;

\ir ../../../supabase/migrations/20261015195915_unified_page_catalog.sql
update public.app_pages set is_active=false where key='crm.simulation.wf14';
\ir ../../../supabase/migrations/20261015195915_unified_page_catalog.sql

begin;
select plan(8);
select is((select count(*) from public.app_pages), 27::bigint, 'compact catalog includes every released page without duplicates');
select is((select count(*) from public.permissions), (select permission_count from page_catalog_before), 'existing compact permissions remain unchanged');
select is((select count(*) from public.role_permissions where role_key='admin'), (select admin_count from page_catalog_before), 'existing Admin defaults remain unchanged');
select is((select jsonb_agg(to_jsonb(r) order by r.role_key, r.permission_key) from public.role_permissions r where role_key not in ('master','admin')), (select other_defaults from page_catalog_before), 'other role defaults remain unchanged');
select ok((select not is_active from public.app_pages where key='crm.simulation.wf14'), 'synchronization preserves a deliberately disabled page');
select ok(not exists(select 1 from public.app_pages p where not exists(select 1 from public.role_permissions r where r.role_key='admin' and r.permission_key=p.permission_key)), 'Admin inherits every registered page permission');
select ok((select relrowsecurity from pg_class where oid='public.app_pages'::regclass), 'page RLS stays enabled');
select ok(not has_table_privilege('anon','public.app_pages','SELECT') and not has_table_privilege('authenticated','public.app_pages','INSERT, UPDATE, DELETE'), 'browser roles gain no direct page writes or anonymous reads');
select * from finish();
rollback;
