-- Gate 1 — Page catalog and CRM permissions
--
-- Adds the permission keys required by the CRM surfaces and a navigation
-- catalog whose rows are filtered by effective user permissions. Route and
-- data authorization remain independent server/RLS checks; hiding a catalog
-- row is never treated as the security boundary.

-- ============================================================================
-- Permission catalog
-- ============================================================================

insert into public.permissions (key, description, min_level) values
  ('pages.view',             'View the authorized page catalog',      10),
  ('pages.manage',           'Manage page catalog visibility',        80),
  ('crm.dashboard.view',     'View the CRM dashboard',                10),
  ('crm.stages.view',        'View CRM funnel stage details',         10),
  ('crm.ranking.view',       'View CRM rankings',                     10),
  ('crm.settings.view',      'View CRM settings',                     80),
  ('crm.settings.manage',    'Change CRM goals and point settings',   80),
  ('crm.salesforce.refresh', 'Request a Salesforce data refresh',     80),
  ('crm.ingest.manage',      'Run and inspect CRM ingestion',         80);

-- Master and admin receive the full Gate 1 catalog. Business roles receive
-- read-only CRM surfaces; settings and integration operations remain admin.
insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from (
  values
    ('master', 'pages.view'),
    ('master', 'pages.manage'),
    ('master', 'crm.dashboard.view'),
    ('master', 'crm.stages.view'),
    ('master', 'crm.ranking.view'),
    ('master', 'crm.settings.view'),
    ('master', 'crm.settings.manage'),
    ('master', 'crm.salesforce.refresh'),
    ('master', 'crm.ingest.manage'),
    ('admin', 'pages.view'),
    ('admin', 'pages.manage'),
    ('admin', 'crm.dashboard.view'),
    ('admin', 'crm.stages.view'),
    ('admin', 'crm.ranking.view'),
    ('admin', 'crm.settings.view'),
    ('admin', 'crm.settings.manage'),
    ('admin', 'crm.salesforce.refresh'),
    ('admin', 'crm.ingest.manage'),
    ('coordinator', 'pages.view'),
    ('coordinator', 'crm.dashboard.view'),
    ('coordinator', 'crm.stages.view'),
    ('coordinator', 'crm.ranking.view'),
    ('supervisor', 'pages.view'),
    ('supervisor', 'crm.dashboard.view'),
    ('supervisor', 'crm.stages.view'),
    ('supervisor', 'crm.ranking.view'),
    ('real_estate', 'pages.view'),
    ('real_estate', 'crm.dashboard.view'),
    ('real_estate', 'crm.stages.view'),
    ('real_estate', 'crm.ranking.view'),
    ('broker_lead', 'pages.view'),
    ('broker_lead', 'crm.dashboard.view'),
    ('broker_lead', 'crm.stages.view'),
    ('broker_lead', 'crm.ranking.view'),
    ('broker', 'pages.view'),
    ('broker', 'crm.dashboard.view'),
    ('broker', 'crm.stages.view'),
    ('broker', 'crm.ranking.view'),
    ('user', 'pages.view'),
    ('user', 'crm.dashboard.view'),
    ('user', 'crm.stages.view'),
    ('user', 'crm.ranking.view')
) as grants(role_key, permission_key);

-- Every account created by Supabase Auth receives a minimal active profile
-- and the least-privileged application role. Existing Auth users are
-- backfilled before the trigger is installed so authorization never depends
-- on an out-of-band manual insert.
insert into public.profiles (user_id, email, is_active, profile_completed)
select u.id, u.email, true, false
from auth.users u
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role_key)
select u.id, 'user'
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, is_active, profile_completed)
    values (new.id, new.email, true, false)
    on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_key)
    values (new.id, 'user')
    on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Inactive or incomplete authorization records fail closed everywhere that
-- relies on permission resolution (including RLS), and cannot obtain an
-- application authorization context.
create or replace function public._internal_has_permission(user_uuid uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public._internal_has_permission(uuid, text)
  from public, anon, authenticated;

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
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null or user_uuid is null then
    return;
  end if;

  if user_uuid <> v_caller
     and not coalesce(public._internal_has_permission(v_caller, 'users.view'), false) then
    return;
  end if;

  return query
    select
      ur.user_id,
      ur.role_key,
      r.level,
      public._internal_list_permissions(ur.user_id) as permissions
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    join public.profiles p on p.user_id = ur.user_id and p.is_active
    where ur.user_id = user_uuid;
end;
$$;

revoke execute on function public.get_user_authorization_context(uuid) from public, anon;
grant execute on function public.get_user_authorization_context(uuid) to authenticated;

-- ============================================================================
-- Authorized navigation catalog
-- ============================================================================

create table public.app_pages (
  key             text primary key,
  path            text not null unique,
  name            text not null,
  description     text not null default '',
  section         text not null,
  permission_key  text not null references public.permissions(key),
  parent_key      text references public.app_pages(key) on delete restrict,
  sort_order      integer not null default 0,
  is_navigation   boolean not null default true,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint app_pages_key_format check (key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint app_pages_path_absolute check (path ~ '^/[A-Za-z0-9/_{}-]*$'),
  constraint app_pages_sort_order_nonnegative check (sort_order >= 0)
);

create index app_pages_navigation_idx
  on public.app_pages (section, sort_order, key)
  where is_navigation and is_active;

create trigger app_pages_set_updated_at
  before update on public.app_pages
  for each row execute function public.set_updated_at();

insert into public.app_pages
  (key, path, name, description, section, permission_key, parent_key, sort_order, is_navigation)
values
  ('crm.dashboard', '/app', 'Dashboard', 'Visão geral do funil comercial', 'crm', 'crm.dashboard.view', null, 10, true),
  ('crm.stage.opportunities', '/app/etapas/oportunidades', 'Oportunidades', 'Detalhe da etapa de oportunidades', 'crm', 'crm.stages.view', 'crm.dashboard', 20, true),
  ('crm.stage.appointments', '/app/etapas/agendamentos', 'Agendamentos', 'Detalhe da etapa de agendamentos', 'crm', 'crm.stages.view', 'crm.dashboard', 30, true),
  ('crm.stage.visits', '/app/etapas/visitas', 'Visitas', 'Detalhe da etapa de visitas', 'crm', 'crm.stages.view', 'crm.dashboard', 40, true),
  ('crm.stage.folders', '/app/etapas/pastas', 'Pastas', 'Detalhe da etapa de pastas', 'crm', 'crm.stages.view', 'crm.dashboard', 50, true),
  ('crm.stage.sales', '/app/etapas/vendas', 'Vendas', 'Detalhe da etapa de vendas', 'crm', 'crm.stages.view', 'crm.dashboard', 60, true),
  ('crm.ranking', '/app/ranking', 'Ranking', 'Ranking comercial', 'crm', 'crm.ranking.view', null, 70, true),
  ('crm.settings', '/app/configuracoes', 'Configurações', 'Metas e pontuação do CRM', 'settings', 'crm.settings.view', null, 10, true),
  ('crm.settings.goals', '/app/configuracoes/metas', 'Metas do funil', 'Metas do funil DV', 'settings', 'crm.settings.manage', 'crm.settings', 20, true),
  ('crm.settings.partnerships', '/app/configuracoes/metas/parcerias', 'Metas de parcerias', 'Metas do canal de parcerias', 'settings', 'crm.settings.manage', 'crm.settings', 30, true),
  ('crm.settings.points', '/app/configuracoes/metas/pontos', 'Metas de pontos', 'Pesos e metas de pontuação', 'settings', 'crm.settings.manage', 'crm.settings', 40, true),
  ('admin.home', '/admin', 'Administração', 'Gestão de usuários e permissões', 'admin', 'admin.access', null, 10, true),
  ('admin.users', '/admin/usuarios', 'Usuários', 'Papéis e permissões por usuário', 'admin', 'users.view', 'admin.home', 20, true),
  ('admin.pages', '/admin/paginas', 'Páginas', 'Catálogo de páginas autorizadas', 'admin', 'pages.manage', 'admin.home', 30, true);

-- Explicit Data API privileges. RLS controls row visibility; no direct writes
-- are granted to browser roles.
revoke all on table public.app_pages from anon, authenticated;
grant select on table public.app_pages to authenticated;
grant all on table public.app_pages to service_role;

alter table public.app_pages enable row level security;

create policy app_pages_select_authorized on public.app_pages
  for select to authenticated
  using (
    is_active
    and public.has_permission((select auth.uid()), 'pages.view')
    and public.has_permission((select auth.uid()), permission_key)
  );

-- ============================================================================
-- Guarded management read + audited visibility mutation
-- ============================================================================

create or replace function public.list_app_pages_for_management()
returns setof public.app_pages
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'pages.manage') then
    raise exception 'forbidden: actor cannot manage pages'
      using errcode = '42501';
  end if;

  return query
    select p.*
    from public.app_pages p
    order by p.section, p.sort_order, p.key;
end;
$$;

revoke execute on function public.list_app_pages_for_management() from public, anon;
grant execute on function public.list_app_pages_for_management() to authenticated;

create or replace function public.set_app_page_active(
  target_page_key text,
  target_is_active boolean,
  reason text default null
)
returns public.app_pages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before public.app_pages;
  v_after public.app_pages;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'pages.manage') then
    raise exception 'forbidden: actor cannot manage pages'
      using errcode = '42501';
  end if;

  if target_page_key is null or btrim(target_page_key) = '' then
    raise exception 'invalid_argument: target_page_key is required'
      using errcode = '22023';
  end if;

  if target_is_active is null then
    raise exception 'invalid_argument: target_is_active is required'
      using errcode = '22023';
  end if;

  select p.* into v_before
  from public.app_pages p
  where p.key = target_page_key
  for update;

  if not found then
    raise exception 'not_found: page does not exist'
      using errcode = 'P0002';
  end if;

  update public.app_pages p
  set is_active = target_is_active
  where p.key = target_page_key
  returning p.* into v_after;

  if v_before.is_active is distinct from v_after.is_active then
    insert into public.audit_logs
      (actor_id, action, before, after)
    values
      (
        v_actor,
        'authorization.page_visibility_changed',
        jsonb_build_object(
          'key', v_before.key,
          'is_active', v_before.is_active
        ),
        jsonb_build_object(
          'key', v_after.key,
          'is_active', v_after.is_active,
          'reason', nullif(btrim(reason), '')
        )
      );
  end if;

  return v_after;
end;
$$;

revoke execute on function public.set_app_page_active(text, boolean, text) from public, anon;
grant execute on function public.set_app_page_active(text, boolean, text) to authenticated;

-- Audited account activation. Direct profile writes remain blocked by RLS;
-- managers can only affect users strictly below their own hierarchy level.
create or replace function public.set_user_active(
  target_user_id uuid,
  target_is_active boolean,
  reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_before public.profiles;
  v_after public.profiles;
begin
  v_actor_level := public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'users.manage') then
    raise exception 'forbidden: actor cannot manage users'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_is_active is null then
    raise exception 'invalid_argument: target and status are required'
      using errcode = '22023';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  select p.* into v_before
  from public.profiles p
  where p.user_id = target_user_id
  for update;

  if not found then
    raise exception 'not_found: user profile does not exist'
      using errcode = 'P0002';
  end if;

  update public.profiles p
  set is_active = target_is_active
  where p.user_id = target_user_id
  returning p.* into v_after;

  if v_before.is_active is distinct from v_after.is_active then
    insert into public.audit_logs
      (actor_id, target_user_id, action, before, after)
    values
      (
        v_actor,
        target_user_id,
        'authorization.user_status_changed',
        jsonb_build_object('is_active', v_before.is_active),
        jsonb_build_object(
          'is_active', v_after.is_active,
          'reason', nullif(btrim(reason), '')
        )
      );
  end if;

  return v_after;
end;
$$;

revoke execute on function public.set_user_active(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_active(uuid, boolean, text) to authenticated;

-- Defense in depth: catalog writes remain unavailable even if project-level
-- default grants change in the future.
revoke insert, update, delete, truncate, references, trigger
  on table public.app_pages
  from authenticated, anon;

-- Consolidate equivalent SELECT policies introduced by the login baseline.
-- One permissive policy per table avoids evaluating duplicate policies while
-- preserving the exact self-or-manager access rule.
drop policy profiles_select_self on public.profiles;
drop policy profiles_select_with_users_view on public.profiles;
create policy profiles_select_self_or_users_view on public.profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission((select auth.uid()), 'users.view')
  );

drop policy user_roles_select_self on public.user_roles;
drop policy user_roles_select_with_users_view on public.user_roles;
create policy user_roles_select_self_or_users_view on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission((select auth.uid()), 'users.view')
  );

drop policy user_permission_overrides_select_self on public.user_permission_overrides;
drop policy user_permission_overrides_select_with_perm on public.user_permission_overrides;
create policy user_permission_overrides_select_self_or_permissions_view
  on public.user_permission_overrides
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission((select auth.uid()), 'permissions.view')
  );
