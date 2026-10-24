begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

insert into public.permissions (key, description, min_level)
values
  ('crm.leads.create', 'Cria leads e os cadastros de cliente e interesse associados.', 80),
  ('crm.leads.edit', 'Altera dados comerciais de leads existentes.', 80),
  ('crm.leads.assign', 'Atribui ou remove o responsavel de um lead.', 80),
  ('crm.leads.stage.move', 'Move leads entre etapas do funil.', 80),
  ('crm.leads.activities.manage', 'Registra atividades de atendimento em leads.', 80),
  ('crm.leads.messages.manage', 'Registra mensagens trocadas em leads.', 80),
  ('crm.leads.tags.manage', 'Gerencia etiquetas de leads.', 80),
  ('crm.leads.close', 'Fecha leads como ganhos ou perdidos.', 80),
  ('crm.leads.archive', 'Arquiva e resgata leads.', 80)
on conflict (key) do update set
  description = excluded.description,
  min_level = excluded.min_level;

insert into public.role_permissions (role_key, permission_key)
select role_key, permission_key
from (values ('master'), ('admin')) roles(role_key)
cross join (values
  ('crm.leads.create'), ('crm.leads.edit'), ('crm.leads.assign'),
  ('crm.leads.stage.move'), ('crm.leads.activities.manage'),
  ('crm.leads.messages.manage'), ('crm.leads.tags.manage'),
  ('crm.leads.close'), ('crm.leads.archive')
) permissions(permission_key)
on conflict (role_key, permission_key) do nothing;

create table public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_lead_channels (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_lead_lost_reasons (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_lead_stages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  position integer not null unique check (position between 0 and 1000),
  color text not null default '#64748b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_terminal boolean not null default false,
  is_won boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not is_won or is_terminal)
);

insert into public.crm_lead_sources (key, name) values
  ('manual', 'Cadastro manual'), ('site', 'Site'), ('referral', 'Indicacao'),
  ('social', 'Rede social'), ('campaign', 'Campanha'), ('other', 'Outro');
insert into public.crm_lead_channels (key, name) values
  ('phone', 'Telefone'), ('whatsapp', 'WhatsApp'), ('email', 'E-mail'),
  ('website', 'Site'), ('social', 'Rede social'), ('in_person', 'Presencial'), ('other', 'Outro');
insert into public.crm_lead_lost_reasons (key, name) values
  ('no_contact', 'Sem contato'), ('no_interest', 'Sem interesse'),
  ('budget', 'Orcamento incompativel'), ('competitor', 'Fechou com concorrente'),
  ('duplicate', 'Cadastro duplicado'), ('other', 'Outro');
insert into public.crm_lead_stages (key, name, position, color, is_terminal, is_won) values
  ('new', 'Novo', 10, '#2563eb', false, false),
  ('contact', 'Em contato', 20, '#7c3aed', false, false),
  ('qualified', 'Qualificado', 30, '#0891b2', false, false),
  ('proposal', 'Proposta', 40, '#d97706', false, false),
  ('won', 'Ganho', 90, '#16a34a', true, true),
  ('lost', 'Perdido', 100, '#dc2626', true, false);

create table public.crm_lead_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null unique check (workspace_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  kind text not null default 'organization' check (char_length(kind) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.crm_lead_workspace_members (
  workspace_id uuid not null references public.crm_lead_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

insert into public.crm_lead_workspaces (id, workspace_key, name)
values ('00000000-0000-4000-8000-000000000001', 'descomplica', 'Descomplica');

create table public.crm_lead_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_lead_workspaces(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 180),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) between 7 and 32),
  secondary_phone text check (secondary_phone is null or char_length(secondary_phone) between 7 and 32),
  city text check (city is null or char_length(city) <= 120),
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_lead_interests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_lead_workspaces(id) on delete restrict,
  title text check (title is null or char_length(title) <= 180),
  reference_code text check (reference_code is null or char_length(reference_code) <= 100),
  transaction_kind text check (transaction_kind is null or transaction_kind in ('buy', 'rent', 'invest', 'other')),
  property_kind text check (property_kind is null or char_length(property_kind) <= 80),
  city text check (city is null or char_length(city) <= 120),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  budget_min numeric(15,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(15,2) check (budget_max is null or budget_max >= 0),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_lead_workspaces(id) on delete restrict,
  customer_id uuid not null references public.crm_lead_customers(id) on delete restrict,
  interest_id uuid references public.crm_lead_interests(id) on delete set null,
  stage_id uuid not null references public.crm_lead_stages(id) on delete restrict,
  source_id uuid references public.crm_lead_sources(id) on delete restrict,
  channel_id uuid references public.crm_lead_channels(id) on delete restrict,
  lost_reason_id uuid references public.crm_lead_lost_reasons(id) on delete restrict,
  responsible_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  is_favorite boolean not null default false,
  archived_at timestamptz,
  closed_at timestamptz,
  summary text check (summary is null or char_length(summary) <= 1000),
  source_system text not null default 'native' check (source_system ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  source_record_id text check (source_record_id is null or char_length(source_record_id) <= 200),
  created_idempotency_key text not null check (char_length(created_idempotency_key) between 8 and 200),
  created_payload_hash text not null check (created_payload_hash ~ '^[0-9a-f]{64}$'),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, created_by, created_idempotency_key),
  check ((status = 'open' and closed_at is null and lost_reason_id is null)
      or (status = 'won' and closed_at is not null and lost_reason_id is null)
      or (status = 'lost' and closed_at is not null and lost_reason_id is not null))
);

create table public.crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  from_stage_id uuid references public.crm_lead_stages(id) on delete restrict,
  to_stage_id uuid not null references public.crm_lead_stages(id) on delete restrict,
  changed_by uuid not null references auth.users(id) on delete restrict,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create table public.crm_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('task', 'call', 'meeting', 'visit', 'follow_up', 'note')),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text check (description is null or char_length(description) <= 4000),
  due_at timestamptz,
  completed_at timestamptz,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lead_id, created_by, idempotency_key)
);

create table public.crm_lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel_id uuid references public.crm_lead_channels(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  occurred_at timestamptz not null default now(),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lead_id, created_by, idempotency_key)
);

create table public.crm_lead_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_lead_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default '#64748b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.crm_lead_tag_links (
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  tag_id uuid not null references public.crm_lead_tags(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table public.crm_lead_audit_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  organization_id uuid not null references public.crm_lead_workspaces(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 100),
  changed_fields text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  command_digest text not null check (command_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, actor_id, idempotency_key)
);

create index crm_leads_browse_idx on public.crm_leads
  (organization_id, archived_at, stage_id, responsible_user_id, updated_at desc, id desc);
create index crm_leads_customer_idx on public.crm_leads (customer_id);
create unique index crm_leads_source_identity_uidx on public.crm_leads
  (organization_id, source_system, source_record_id) where source_record_id is not null;
create index crm_lead_customers_search_idx on public.crm_lead_customers
  using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')));
create index crm_lead_stage_history_timeline_idx on public.crm_lead_stage_history (lead_id, created_at desc);
create index crm_lead_activities_timeline_idx on public.crm_lead_activities (lead_id, created_at desc);
create index crm_lead_messages_timeline_idx on public.crm_lead_messages (lead_id, occurred_at desc);
create index crm_lead_audit_timeline_idx on public.crm_lead_audit_events (lead_id, created_at desc);

create or replace function private.crm_lead_user_can_access_organization(
  p_user_id uuid,
  p_organization_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and p_organization_id is not null
    and exists (select 1 from public.profiles p where p.user_id = p_user_id
      and p.is_active and p.access_status = 'approved')
    and exists (select 1 from public.crm_lead_workspaces w where w.id = p_organization_id and w.is_active)
    and (
      exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role_key in ('master','admin'))
      or exists (select 1 from public.crm_lead_workspace_members m
        where m.user_id = p_user_id and m.workspace_id = p_organization_id and m.is_active)
    );
$$;

revoke all privileges on function private.crm_lead_user_can_access_organization(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.crm_lead_assert_actor(p_permission text, p_organization_id uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, p_permission) then
    raise exception 'forbidden: missing lead permission' using errcode = '42501';
  end if;
  if p_organization_id is null or not private.crm_lead_user_can_access_organization(v_actor, p_organization_id) then
    raise exception 'forbidden: organization unavailable' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

revoke all privileges on function private.crm_lead_assert_actor(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.list_crm_lead_scopes_v1()
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare v_actor uuid := (select auth.uid()); v_scopes jsonb;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not (
    public._internal_has_permission(v_actor, 'crm.leads.view')
    or public._internal_has_permission(v_actor, 'crm.leads.list.view')
    or public._internal_has_permission(v_actor, 'crm.leads.pipeline.view')
    or public._internal_has_permission(v_actor, 'crm.leads.activities.view')
  ) then
    raise exception 'forbidden: missing lead read permission' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', organization.id,
    'key', organization.workspace_key,
    'name', organization.name,
    'kind', organization.kind
  ) order by organization.name, organization.id), '[]'::jsonb)
  into v_scopes
  from public.crm_lead_workspaces organization
  where organization.is_active
    and private.crm_lead_user_can_access_organization(v_actor, organization.id);
  return v_scopes;
end;
$$;

create or replace function public.get_crm_lead_catalogs_v1(p_organization_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  perform public._internal_assert_actor_active(v_actor);
  if not (
    public._internal_has_permission(v_actor, 'crm.leads.view')
    or public._internal_has_permission(v_actor, 'crm.leads.list.view')
    or public._internal_has_permission(v_actor, 'crm.leads.pipeline.view')
    or public._internal_has_permission(v_actor, 'crm.leads.activities.view')
  ) or not private.crm_lead_user_can_access_organization(v_actor, p_organization_id) then
    raise exception 'forbidden: lead catalogs unavailable' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'stages', coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name,'position',position,'color',color,'terminal',is_terminal,'won',is_won) order by position) from public.crm_lead_stages where is_active),'[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_sources where is_active),'[]'::jsonb),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_channels where is_active),'[]'::jsonb),
    'lostReasons', coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_lost_reasons where is_active),'[]'::jsonb),
    'responsibles', coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'label',case when public._internal_has_permission(v_actor,'crm.leads.list.view') then coalesce(p.email,p.user_id::text) else 'Responsavel '||left(p.user_id::text,8) end) order by p.user_id)
      from public.profiles p where p.is_active and p.access_status='approved'
        and private.crm_lead_user_can_access_organization(p.user_id,p_organization_id)),'[]'::jsonb)
  );
end;
$$;

create or replace function public.list_crm_leads_v1(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization uuid;
  v_limit integer := least(greatest(coalesce((p_filters->>'limit')::integer, 50), 1), 100);
  v_offset integer := greatest(coalesce((p_filters->>'offset')::integer, 0), 0);
  v_query text := nullif(btrim(p_filters->>'query'), '');
  v_total bigint;
  v_items jsonb;
begin
  if jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_argument: filters must be an object' using errcode = '22023';
  end if;
  begin v_organization := (p_filters->>'organizationId')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid_argument: invalid organization' using errcode = '22023'; end;
  if v_actor is null then raise exception 'unauthorized: authenticated user required' using errcode = '28000'; end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.leads.list.view') then
    raise exception 'forbidden: missing lead read permission' using errcode = '42501'; end if;
  if v_organization is null or not private.crm_lead_user_can_access_organization(v_actor, v_organization) then
    raise exception 'forbidden: organization unavailable' using errcode = '42501';
  end if;

  with matches as (
    select l.id
    from public.crm_leads l join public.crm_lead_customers c on c.id = l.customer_id
    where l.organization_id = v_organization
      and ((p_filters->>'includeArchived')::boolean is true or l.archived_at is null)
      and (p_filters->>'stageId' is null or l.stage_id = (p_filters->>'stageId')::uuid)
      and (p_filters->>'responsibleUserId' is null or l.responsible_user_id = (p_filters->>'responsibleUserId')::uuid)
      and (p_filters->>'sourceId' is null or l.source_id = (p_filters->>'sourceId')::uuid)
      and (p_filters->>'channelId' is null or l.channel_id = (p_filters->>'channelId')::uuid)
      and (p_filters->>'status' is null or l.status = p_filters->>'status')
      and (p_filters->>'favorite' is null or l.is_favorite = (p_filters->>'favorite')::boolean)
      and (v_query is null or to_tsvector('simple', coalesce(c.full_name,'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,''))
        @@ plainto_tsquery('simple', v_query))
  ) select count(*) into v_total from matches;

  select coalesce(jsonb_agg(item order by item_updated_at desc, item_id desc), '[]'::jsonb)
  into v_items from (
    select l.updated_at item_updated_at, l.id item_id, jsonb_build_object(
      'id', l.id, 'organizationId', l.organization_id, 'stageId', l.stage_id,
      'sourceId', l.source_id, 'channelId', l.channel_id,
      'responsibleUserId', l.responsible_user_id, 'status', l.status,
      'priority', l.priority, 'favorite', l.is_favorite,
      'archivedAt', l.archived_at, 'closedAt', l.closed_at,
      'summary', l.summary, 'version', l.version, 'createdAt', l.created_at,
      'updatedAt', l.updated_at,
      'customer', jsonb_build_object('id', c.id, 'name', c.full_name, 'email', c.email, 'phone', c.phone),
      'interest', case when i.id is null then null else jsonb_build_object(
        'id', i.id, 'title', i.title, 'transactionKind', i.transaction_kind,
        'propertyKind', i.property_kind, 'city', i.city, 'neighborhood', i.neighborhood) end,
      'tags', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by t.name)
        from public.crm_lead_tag_links tl join public.crm_lead_tags t on t.id = tl.tag_id where tl.lead_id = l.id), '[]'::jsonb)
    ) item
    from public.crm_leads l
    join public.crm_lead_customers c on c.id = l.customer_id
    left join public.crm_lead_interests i on i.id = l.interest_id
    where l.organization_id = v_organization
      and ((p_filters->>'includeArchived')::boolean is true or l.archived_at is null)
      and (p_filters->>'stageId' is null or l.stage_id = (p_filters->>'stageId')::uuid)
      and (p_filters->>'responsibleUserId' is null or l.responsible_user_id = (p_filters->>'responsibleUserId')::uuid)
      and (p_filters->>'sourceId' is null or l.source_id = (p_filters->>'sourceId')::uuid)
      and (p_filters->>'channelId' is null or l.channel_id = (p_filters->>'channelId')::uuid)
      and (p_filters->>'status' is null or l.status = p_filters->>'status')
      and (p_filters->>'favorite' is null or l.is_favorite = (p_filters->>'favorite')::boolean)
      and (v_query is null or to_tsvector('simple', coalesce(c.full_name,'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,''))
        @@ plainto_tsquery('simple', v_query))
    order by l.updated_at desc, l.id desc limit v_limit offset v_offset
  ) rows;
  return jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
exception when invalid_text_representation then
  raise exception 'invalid_argument: invalid filter' using errcode = '22023';
end;
$$;

create or replace function public.list_crm_lead_activities_v1(p_filters jsonb)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare v_actor uuid := (select auth.uid()); v_org uuid; v_bucket text := coalesce(p_filters->>'bucket','all');
  v_limit integer := least(greatest(coalesce((p_filters->>'limit')::integer,50),1),100);
  v_offset integer := greatest(coalesce((p_filters->>'offset')::integer,0),0); v_items jsonb; v_total bigint; v_counts jsonb;
begin
  begin v_org := (p_filters->>'organizationId')::uuid;
  exception when invalid_text_representation then raise exception 'invalid_argument: invalid organization' using errcode='22023'; end;
  if v_actor is null then raise exception 'unauthorized: authenticated user required' using errcode='28000'; end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor,'crm.leads.activities.view') or not private.crm_lead_user_can_access_organization(v_actor, v_org) then
    raise exception 'forbidden: lead activities unavailable' using errcode='42501'; end if;
  if v_bucket not in ('all','overdue','today','upcoming','completed') then raise exception 'invalid_argument: invalid activity bucket' using errcode='22023'; end if;
  select count(*) into v_total from public.crm_lead_activities a join public.crm_leads l on l.id=a.lead_id
    where l.organization_id=v_org and l.archived_at is null and case v_bucket
      when 'overdue' then a.completed_at is null and a.due_at<now()
      when 'today' then a.completed_at is null and a.due_at::date=current_date
      when 'upcoming' then a.completed_at is null and (a.due_at is null or a.due_at::date>current_date)
      when 'completed' then a.completed_at is not null else true end;
  select jsonb_build_object(
    'all',count(*),'overdue',count(*) filter(where a.completed_at is null and a.due_at<now()),
    'today',count(*) filter(where a.completed_at is null and a.due_at::date=current_date),
    'upcoming',count(*) filter(where a.completed_at is null and (a.due_at is null or a.due_at::date>current_date)),
    'completed',count(*) filter(where a.completed_at is not null)
  ) into v_counts from public.crm_lead_activities a join public.crm_leads l on l.id=a.lead_id
    where l.organization_id=v_org and l.archived_at is null;
  select coalesce(jsonb_agg(row_value order by due_sort asc nulls last, created_sort desc),'[]'::jsonb) into v_items from (
    select a.due_at due_sort,a.created_at created_sort,jsonb_build_object(
      'id',a.id,'leadId',l.id,'leadName','Lead '||left(l.id::text,8),'title',a.title,'type',a.activity_type,
      'description',null,'dueAt',a.due_at,'completedAt',a.completed_at,
      'responsibleUserId',l.responsible_user_id,'responsibleLabel',case when rp.user_id is null then null else 'Responsavel '||left(rp.user_id::text,8) end,
      'isOverdue',a.completed_at is null and a.due_at<now(),'createdAt',a.created_at
    ) row_value
    from public.crm_lead_activities a join public.crm_leads l on l.id=a.lead_id
    join public.crm_lead_customers c on c.id=l.customer_id left join public.profiles rp on rp.user_id=l.responsible_user_id
    where l.organization_id=v_org and l.archived_at is null and case v_bucket
      when 'overdue' then a.completed_at is null and a.due_at<now()
      when 'today' then a.completed_at is null and a.due_at::date=current_date
      when 'upcoming' then a.completed_at is null and (a.due_at is null or a.due_at::date>current_date)
      when 'completed' then a.completed_at is not null else true end
    order by a.due_at asc nulls last,a.created_at desc limit v_limit offset v_offset
  ) rows;
  return jsonb_build_object('items',v_items,'counts',v_counts,'total',v_total,'limit',v_limit,'offset',v_offset);
exception when invalid_text_representation then raise exception 'invalid_argument: invalid activity filter' using errcode='22023';
end;
$$;

create or replace function public.get_crm_lead_funnel_v1(p_organization_id uuid, p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare v_actor uuid := (select auth.uid()); v_stages jsonb; v_total bigint; v_favorites bigint;
begin
  if v_actor is null then raise exception 'unauthorized: authenticated user required' using errcode='28000'; end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor,'crm.leads.pipeline.view') or not private.crm_lead_user_can_access_organization(v_actor, p_organization_id) then
    raise exception 'forbidden: lead funnel unavailable' using errcode='42501'; end if;
  if nullif(btrim(p_filters->>'query'),'') is not null
    and not public._internal_has_permission(v_actor,'crm.leads.list.view') then
    raise exception 'forbidden: nominal funnel search requires list permission' using errcode='42501'; end if;
  select count(*),count(*) filter(where l.is_favorite) into v_total,v_favorites from public.crm_leads l
    join public.crm_lead_customers c on c.id=l.customer_id
    where l.organization_id=p_organization_id and l.archived_at is null
      and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid)
      and (p_filters->>'query' is null or to_tsvector('simple',coalesce(c.full_name,'')||' '||coalesce(c.email,'')||' '||coalesce(c.phone,'')) @@ plainto_tsquery('simple',p_filters->>'query'));
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'key',s.key,'name',s.name,'position',s.position,'color',s.color,'terminal',s.is_terminal,'won',s.is_won,
    'count',coalesce(cards.card_count,0),'cards',coalesce(cards.card_values,'[]'::jsonb)
  ) order by s.position),'[]'::jsonb) into v_stages
  from public.crm_lead_stages s
  left join lateral (
    select count(*) card_count,jsonb_agg(card order by updated_at desc,id desc) filter(where row_number<=100) card_values from (
      select l.id,l.updated_at,row_number() over(order by l.updated_at desc,l.id desc) row_number,jsonb_build_object(
        'id',l.id,'name','Lead '||left(l.id::text,8),'responsibleUserId',l.responsible_user_id,'responsibleLabel',case when rp.user_id is null then null else 'Responsavel '||left(rp.user_id::text,8) end,
        'priority',l.priority,'favorite',l.is_favorite,'updatedAt',l.updated_at,'version',l.version,
        'interestTitle',i.title,'tags',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color) order by t.name)
          from public.crm_lead_tag_links tl join public.crm_lead_tags t on t.id=tl.tag_id where tl.lead_id=l.id),'[]'::jsonb)
      ) card
      from public.crm_leads l join public.crm_lead_customers c on c.id=l.customer_id
      left join public.crm_lead_interests i on i.id=l.interest_id left join public.profiles rp on rp.user_id=l.responsible_user_id
      where l.organization_id=p_organization_id and l.stage_id=s.id and l.archived_at is null
        and (p_filters->>'responsibleUserId' is null or l.responsible_user_id=(p_filters->>'responsibleUserId')::uuid)
        and (p_filters->>'query' is null or to_tsvector('simple',coalesce(c.full_name,'')||' '||coalesce(c.email,'')||' '||coalesce(c.phone,'')) @@ plainto_tsquery('simple',p_filters->>'query'))
    ) selected
  ) cards on true where s.is_active;
  return jsonb_build_object('stages',v_stages,'metrics',jsonb_build_object('total',v_total,'favorites',v_favorites));
exception when invalid_text_representation then raise exception 'invalid_argument: invalid funnel filter' using errcode='22023';
end;
$$;

create or replace function public.get_crm_lead_v1(p_lead_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '10s' as $$
declare v_actor uuid := (select auth.uid()); v_lead public.crm_leads%rowtype; v_result jsonb;
begin
  if v_actor is null then raise exception 'unauthorized: authenticated user required' using errcode = '28000'; end if;
  perform public._internal_assert_actor_active(v_actor);
  if not public._internal_has_permission(v_actor, 'crm.leads.list.view') then
    raise exception 'forbidden: missing lead read permission' using errcode = '42501'; end if;
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if v_lead.id is null or not private.crm_lead_user_can_access_organization(v_actor, v_lead.organization_id) then
    raise exception 'not_found: lead unavailable' using errcode = 'P0002'; end if;
  select jsonb_build_object(
    'lead', (select to_jsonb(x) - 'created_idempotency_key' - 'source_record_id' from (
      select v_lead.id, v_lead.organization_id as "organizationId", v_lead.stage_id as "stageId",
        v_lead.source_id as "sourceId", v_lead.channel_id as "channelId", v_lead.lost_reason_id as "lostReasonId",
        v_lead.responsible_user_id as "responsibleUserId", v_lead.status, v_lead.priority,
        v_lead.is_favorite as favorite, v_lead.archived_at as "archivedAt", v_lead.closed_at as "closedAt",
        v_lead.summary, v_lead.version, v_lead.created_at as "createdAt", v_lead.updated_at as "updatedAt"
    ) x),
    'customer', (select jsonb_build_object('id',c.id,'name',c.full_name,'email',c.email,'phone',c.phone,
      'secondaryPhone',c.secondary_phone,'city',c.city,'stateCode',c.state_code) from public.crm_lead_customers c where c.id=v_lead.customer_id),
    'interest', (select to_jsonb(x) from (select i.id,i.title,i.reference_code as "referenceCode",
      i.transaction_kind as "transactionKind",i.property_kind as "propertyKind",i.city,i.neighborhood,
      i.budget_min as "budgetMin",i.budget_max as "budgetMax",i.notes
      from public.crm_lead_interests i where i.id=v_lead.interest_id) x),
    'activities', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'type',a.activity_type,'title',a.title,
      'description',a.description,'dueAt',a.due_at,'completedAt',a.completed_at,'createdBy',a.created_by,'createdAt',a.created_at)
      order by a.created_at desc) from public.crm_lead_activities a where a.lead_id=v_lead.id),'[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'direction',m.direction,'channelId',m.channel_id,
      'body',m.body,'occurredAt',m.occurred_at,'createdBy',m.created_by) order by m.occurred_at desc)
      from public.crm_lead_messages m where m.lead_id=v_lead.id),'[]'::jsonb),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color) order by t.name)
      from public.crm_lead_tag_links tl join public.crm_lead_tags t on t.id=tl.tag_id where tl.lead_id=v_lead.id),'[]'::jsonb),
    'stageHistory', coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'fromStageId',h.from_stage_id,
      'toStageId',h.to_stage_id,'changedBy',h.changed_by,'reason',h.reason,'createdAt',h.created_at) order by h.created_at desc)
      from public.crm_lead_stage_history h where h.lead_id=v_lead.id),'[]'::jsonb),
    'catalogs', jsonb_build_object(
      'stages',(select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name,'position',position,'color',color,'terminal',is_terminal,'won',is_won) order by position) from public.crm_lead_stages where is_active),
      'sources',(select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_sources where is_active),
      'channels',(select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_channels where is_active),
      'lostReasons',(select jsonb_agg(jsonb_build_object('id',id,'key',key,'name',name) order by name) from public.crm_lead_lost_reasons where is_active)
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.save_crm_lead_v1(
  p_lead_id uuid, p_expected_version bigint, p_input jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout = '10s' set lock_timeout = '5s' as $$
declare
  v_actor uuid; v_org uuid; v_customer uuid; v_interest uuid; v_lead public.crm_leads%rowtype;
  v_stage uuid; v_source uuid; v_channel uuid; v_responsible uuid; v_payload_hash text; v_command_digest text;
  v_audit public.crm_lead_audit_events%rowtype;
begin
  if jsonb_typeof(coalesce(p_input,'null'::jsonb)) <> 'object'
    or char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then
    raise exception 'invalid_argument: invalid lead command' using errcode='22023'; end if;
  begin
    v_org := (p_input->>'organizationId')::uuid; v_stage := (p_input->>'stageId')::uuid;
    v_source := nullif(p_input->>'sourceId','')::uuid; v_channel := nullif(p_input->>'channelId','')::uuid;
    v_responsible := nullif(p_input->>'responsibleUserId','')::uuid;
  exception when invalid_text_representation then raise exception 'invalid_argument: invalid identifier' using errcode='22023'; end;
  v_actor := private.crm_lead_assert_actor(case when p_lead_id is null then 'crm.leads.create' else 'crm.leads.edit' end, v_org);
  if char_length(btrim(coalesce(p_input#>>'{customer,name}',''))) not between 2 and 180
    or char_length(coalesce(p_input#>>'{customer,email}','')) > 320
    or char_length(coalesce(p_input#>>'{customer,phone}','')) > 32
    or char_length(coalesce(p_input->>'summary','')) > 1000
    or coalesce(p_input->>'priority','normal') not in ('low','normal','high','urgent')
    or not exists(select 1 from public.crm_lead_stages where id=v_stage and is_active)
    or (v_source is not null and not exists(select 1 from public.crm_lead_sources where id=v_source and is_active))
    or (v_channel is not null and not exists(select 1 from public.crm_lead_channels where id=v_channel and is_active))
    or (v_responsible is not null and not private.crm_lead_user_can_access_organization(v_responsible,v_org)) then
    raise exception 'invalid_argument: invalid lead data' using errcode='22023'; end if;

  if p_lead_id is null then
    v_payload_hash:=encode(extensions.digest(convert_to(p_input::text,'UTF8'),'sha256'),'hex');
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_org::text||':'||v_actor::text||':'||p_idempotency_key,0)
    );
    select * into v_audit from public.crm_lead_audit_events
      where organization_id=v_org and actor_id=v_actor and idempotency_key=p_idempotency_key;
    if v_audit.id is not null and (v_audit.action<>'lead.created' or v_audit.command_digest<>v_payload_hash) then
      raise exception 'conflict: lead idempotency key reused' using errcode='40001';
    end if;
    select * into v_lead from public.crm_leads where organization_id=v_org and created_by=v_actor and created_idempotency_key=p_idempotency_key;
    if v_lead.id is not null then
      if v_lead.created_payload_hash<>v_payload_hash then raise exception 'conflict: lead idempotency key reused' using errcode='40001';end if;
      return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'created',false);
    end if;
    if v_audit.id is not null then raise exception 'conflict: lead idempotency state unavailable' using errcode='40001';end if;
    insert into public.crm_lead_customers(organization_id,full_name,email,phone,secondary_phone,city,state_code)
    values(v_org,btrim(p_input#>>'{customer,name}'),nullif(btrim(p_input#>>'{customer,email}'),''),nullif(btrim(p_input#>>'{customer,phone}'),''),
      nullif(btrim(p_input#>>'{customer,secondaryPhone}'),''),nullif(btrim(p_input#>>'{customer,city}'),''),upper(nullif(btrim(p_input#>>'{customer,stateCode}'),''))) returning id into v_customer;
    if p_input ? 'interest' and jsonb_typeof(p_input->'interest')='object' then
      insert into public.crm_lead_interests(organization_id,title,reference_code,transaction_kind,property_kind,city,neighborhood,budget_min,budget_max,notes)
      values(v_org,nullif(btrim(p_input#>>'{interest,title}'),''),nullif(btrim(p_input#>>'{interest,referenceCode}'),''),nullif(p_input#>>'{interest,transactionKind}',''),
        nullif(btrim(p_input#>>'{interest,propertyKind}'),''),nullif(btrim(p_input#>>'{interest,city}'),''),nullif(btrim(p_input#>>'{interest,neighborhood}'),''),
        nullif(p_input#>>'{interest,budgetMin}','')::numeric,nullif(p_input#>>'{interest,budgetMax}','')::numeric,nullif(btrim(p_input#>>'{interest,notes}'),'')) returning id into v_interest;
    end if;
    insert into public.crm_leads(organization_id,customer_id,interest_id,stage_id,source_id,channel_id,responsible_user_id,priority,is_favorite,summary,source_system,source_record_id,created_idempotency_key,created_payload_hash,created_by,updated_by)
    values(v_org,v_customer,v_interest,v_stage,v_source,v_channel,v_responsible,coalesce(p_input->>'priority','normal'),coalesce((p_input->>'favorite')::boolean,false),nullif(btrim(p_input->>'summary'),''),
      coalesce(nullif(p_input->>'sourceSystem',''),'native'),nullif(p_input->>'sourceRecordId',''),p_idempotency_key,v_payload_hash,v_actor,v_actor) returning * into v_lead;
    insert into public.crm_lead_stage_history(lead_id,to_stage_id,changed_by,reason) values(v_lead.id,v_stage,v_actor,'Lead criado');
    insert into public.crm_lead_audit_events(lead_id,organization_id,actor_id,action,changed_fields,idempotency_key,command_digest)
    values(v_lead.id,v_org,v_actor,'lead.created',array['customer','interest','stage'],p_idempotency_key,v_payload_hash);
    return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'created',true);
  end if;

  select * into v_lead from public.crm_leads where id=p_lead_id for update;
  if v_lead.id is null or v_lead.organization_id<>v_org then raise exception 'not_found: lead unavailable' using errcode='P0002'; end if;
  v_command_digest:=encode(extensions.digest(convert_to(jsonb_build_object('leadId',p_lead_id,'operation','save_update','payload',p_input)::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_org::text||':'||v_actor::text||':'||p_idempotency_key,0)
  );
  select * into v_audit from public.crm_lead_audit_events
    where organization_id=v_org and actor_id=v_actor and idempotency_key=p_idempotency_key;
  if v_audit.id is not null then
    if v_audit.lead_id<>p_lead_id or v_audit.action<>'lead.updated' or v_audit.command_digest<>v_command_digest then
      raise exception 'conflict: lead idempotency key reused' using errcode='40001';
    end if;
    return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'created',false);
  end if;
  if p_expected_version is null or v_lead.version<>p_expected_version then raise exception 'conflict: lead version changed' using errcode='40001'; end if;
  update public.crm_lead_customers set full_name=btrim(p_input#>>'{customer,name}'),email=nullif(btrim(p_input#>>'{customer,email}'),''),phone=nullif(btrim(p_input#>>'{customer,phone}'),''),
    secondary_phone=nullif(btrim(p_input#>>'{customer,secondaryPhone}'),''),city=nullif(btrim(p_input#>>'{customer,city}'),''),state_code=upper(nullif(btrim(p_input#>>'{customer,stateCode}'),'')),updated_at=now() where id=v_lead.customer_id;
  if p_input ? 'interest' and jsonb_typeof(p_input->'interest')='object' then
    if v_lead.interest_id is null then
      insert into public.crm_lead_interests(organization_id,title,reference_code,transaction_kind,property_kind,city,neighborhood,budget_min,budget_max,notes)
      values(v_org,nullif(btrim(p_input#>>'{interest,title}'),''),nullif(btrim(p_input#>>'{interest,referenceCode}'),''),nullif(p_input#>>'{interest,transactionKind}',''),nullif(btrim(p_input#>>'{interest,propertyKind}'),''),nullif(btrim(p_input#>>'{interest,city}'),''),nullif(btrim(p_input#>>'{interest,neighborhood}'),''),nullif(p_input#>>'{interest,budgetMin}','')::numeric,nullif(p_input#>>'{interest,budgetMax}','')::numeric,nullif(btrim(p_input#>>'{interest,notes}'),'')) returning id into v_interest;
    else v_interest:=v_lead.interest_id; update public.crm_lead_interests set title=nullif(btrim(p_input#>>'{interest,title}'),''),reference_code=nullif(btrim(p_input#>>'{interest,referenceCode}'),''),transaction_kind=nullif(p_input#>>'{interest,transactionKind}',''),property_kind=nullif(btrim(p_input#>>'{interest,propertyKind}'),''),city=nullif(btrim(p_input#>>'{interest,city}'),''),neighborhood=nullif(btrim(p_input#>>'{interest,neighborhood}'),''),budget_min=nullif(p_input#>>'{interest,budgetMin}','')::numeric,budget_max=nullif(p_input#>>'{interest,budgetMax}','')::numeric,notes=nullif(btrim(p_input#>>'{interest,notes}'),''),updated_at=now() where id=v_interest; end if;
  else v_interest:=v_lead.interest_id; end if;
  if v_stage<>v_lead.stage_id then raise exception 'invalid_argument: use transition RPC to move stage' using errcode='22023'; end if;
  update public.crm_leads set interest_id=v_interest,source_id=v_source,channel_id=v_channel,responsible_user_id=v_responsible,
    priority=coalesce(p_input->>'priority','normal'),is_favorite=coalesce((p_input->>'favorite')::boolean,false),summary=nullif(btrim(p_input->>'summary'),''),
    version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  insert into public.crm_lead_audit_events(lead_id,organization_id,actor_id,action,changed_fields,idempotency_key,command_digest)
  values(v_lead.id,v_org,v_actor,'lead.updated',array['customer','interest','lead'],p_idempotency_key,v_command_digest);
  return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'created',false);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_argument: invalid lead data' using errcode='22023';
end;
$$;

create or replace function public.mutate_crm_lead_v1(
  p_lead_id uuid, p_operation text, p_payload jsonb, p_expected_version bigint, p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path = '' set statement_timeout='10s' set lock_timeout='5s' as $$
declare v_actor uuid; v_lead public.crm_leads%rowtype; v_permission text; v_stage public.crm_lead_stages%rowtype; v_target uuid; v_tags uuid[]; v_result_id uuid;
  v_command_digest text; v_audit public.crm_lead_audit_events%rowtype;
begin
  if p_operation not in ('assign','move_stage','set_favorite','archive','rescue','close','add_activity','update_activity','delete_activity','add_message','delete_message','set_tags')
    or jsonb_typeof(coalesce(p_payload,'null'::jsonb))<>'object' or char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then
    raise exception 'invalid_argument: invalid mutation' using errcode='22023'; end if;
  select * into v_lead from public.crm_leads where id=p_lead_id for update;
  if v_lead.id is null then raise exception 'not_found: lead unavailable' using errcode='P0002'; end if;
  v_permission := case p_operation when 'assign' then 'crm.leads.assign' when 'move_stage' then 'crm.leads.stage.move'
    when 'set_favorite' then 'crm.leads.edit' when 'archive' then 'crm.leads.archive' when 'rescue' then 'crm.leads.archive'
    when 'close' then 'crm.leads.close'
    when 'add_activity' then 'crm.leads.activities.manage'
    when 'update_activity' then 'crm.leads.activities.manage'
    when 'delete_activity' then 'crm.leads.activities.manage'
    when 'add_message' then 'crm.leads.messages.manage'
    when 'delete_message' then 'crm.leads.messages.manage'
    when 'set_tags' then 'crm.leads.tags.manage' end;
  v_actor := private.crm_lead_assert_actor(v_permission,v_lead.organization_id);
  v_command_digest:=encode(extensions.digest(convert_to(jsonb_build_object('leadId',p_lead_id,'operation',p_operation,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_lead.organization_id::text||':'||v_actor::text||':'||p_idempotency_key,0)
  );
  select * into v_audit from public.crm_lead_audit_events
    where organization_id=v_lead.organization_id and actor_id=v_actor and idempotency_key=p_idempotency_key;
  if v_audit.id is not null then
    if v_audit.lead_id<>p_lead_id or v_audit.action<>'lead.'||p_operation or v_audit.command_digest<>v_command_digest then
      raise exception 'conflict: lead idempotency key reused' using errcode='40001';
    end if;
    return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'resultId',nullif(v_audit.metadata->>'resultId','')::uuid,'replayed',true);
  end if;
  if p_operation not in ('add_activity','update_activity','delete_activity','add_message','delete_message')
    and (p_expected_version is null or p_expected_version<>v_lead.version) then
    raise exception 'conflict: lead version changed' using errcode='40001'; end if;

  if p_operation='assign' then
    v_target:=nullif(p_payload->>'responsibleUserId','')::uuid;
    if v_target is not null and not private.crm_lead_user_can_access_organization(v_target,v_lead.organization_id) then raise exception 'invalid_argument: responsible user unavailable' using errcode='22023'; end if;
    update public.crm_leads set responsible_user_id=v_target,version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  elsif p_operation='set_favorite' then
    update public.crm_leads set is_favorite=(p_payload->>'favorite')::boolean,version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  elsif p_operation='archive' then
    update public.crm_leads set archived_at=coalesce(archived_at,now()),version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  elsif p_operation='rescue' then
    update public.crm_leads set archived_at=null,version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  elsif p_operation in ('move_stage','close') then
    select * into v_stage from public.crm_lead_stages where id=(p_payload->>'stageId')::uuid and is_active;
    if v_stage.id is null or (p_operation='move_stage' and v_stage.is_terminal) or (p_operation='close' and not v_stage.is_terminal)
      or (v_stage.is_won and p_payload->>'lostReasonId' is not null)
      or (not v_stage.is_won and p_operation='close' and not exists(select 1 from public.crm_lead_lost_reasons where id=(p_payload->>'lostReasonId')::uuid and is_active)) then
      raise exception 'invalid_argument: invalid stage transition' using errcode='22023'; end if;
    update public.crm_leads set stage_id=v_stage.id,status=case when p_operation='move_stage' then 'open' when v_stage.is_won then 'won' else 'lost' end,
      lost_reason_id=case when p_operation='close' and not v_stage.is_won then (p_payload->>'lostReasonId')::uuid else null end,
      closed_at=case when p_operation='close' then now() else null end,version=version+1,updated_by=v_actor,updated_at=now()
      where id=v_lead.id returning * into v_lead;
    insert into public.crm_lead_stage_history(lead_id,from_stage_id,to_stage_id,changed_by,reason)
    values(v_lead.id,(select h.to_stage_id from public.crm_lead_stage_history h where h.lead_id=v_lead.id order by h.created_at desc limit 1),v_stage.id,v_actor,nullif(btrim(p_payload->>'reason'),''));
  elsif p_operation='add_activity' then
    insert into public.crm_lead_activities(lead_id,activity_type,title,description,due_at,completed_at,idempotency_key,payload_hash,created_by)
    values(v_lead.id,p_payload->>'type',btrim(p_payload->>'title'),nullif(btrim(p_payload->>'description'),''),nullif(p_payload->>'dueAt','')::timestamptz,nullif(p_payload->>'completedAt','')::timestamptz,p_idempotency_key,v_command_digest,v_actor)
    returning id into v_result_id;
  elsif p_operation='update_activity' then
    update public.crm_lead_activities set
      activity_type=coalesce(nullif(p_payload->>'type',''),activity_type),
      title=coalesce(nullif(btrim(p_payload->>'title'),''),title),
      description=case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'),'') else description end,
      due_at=case when p_payload ? 'dueAt' then nullif(p_payload->>'dueAt','')::timestamptz else due_at end,
      completed_at=case when p_payload ? 'completedAt' then nullif(p_payload->>'completedAt','')::timestamptz else completed_at end
    where id=(p_payload->>'activityId')::uuid and lead_id=v_lead.id returning id into v_result_id;
    if v_result_id is null then raise exception 'not_found: activity unavailable' using errcode='P0002'; end if;
  elsif p_operation='delete_activity' then
    delete from public.crm_lead_activities where id=(p_payload->>'activityId')::uuid and lead_id=v_lead.id returning id into v_result_id;
    if v_result_id is null then raise exception 'not_found: activity unavailable' using errcode='P0002'; end if;
  elsif p_operation='add_message' then
    insert into public.crm_lead_messages(lead_id,direction,channel_id,body,occurred_at,idempotency_key,payload_hash,created_by)
    values(v_lead.id,p_payload->>'direction',nullif(p_payload->>'channelId','')::uuid,btrim(p_payload->>'body'),coalesce(nullif(p_payload->>'occurredAt','')::timestamptz,now()),p_idempotency_key,v_command_digest,v_actor)
    returning id into v_result_id;
  elsif p_operation='delete_message' then
    delete from public.crm_lead_messages where id=(p_payload->>'messageId')::uuid and lead_id=v_lead.id returning id into v_result_id;
    if v_result_id is null then raise exception 'not_found: message unavailable' using errcode='P0002'; end if;
  elsif p_operation='set_tags' then
    if jsonb_typeof(coalesce(p_payload->'tagIds','[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(p_payload->'newTags','[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(p_payload->'tagIds','[]'::jsonb)) > 50
      or jsonb_array_length(coalesce(p_payload->'newTags','[]'::jsonb)) > 50 then
      raise exception 'invalid_argument: invalid tags' using errcode='22023'; end if;
    insert into public.crm_lead_tags(organization_id,name,color,created_by)
    select v_lead.organization_id,btrim(entry->>'name'),coalesce(nullif(entry->>'color',''),'#64748b'),v_actor
    from jsonb_array_elements(coalesce(p_payload->'newTags','[]'::jsonb)) entry
    on conflict(organization_id,name) do update set color=excluded.color;
    select coalesce(array_agg(id),'{}'::uuid[]) into v_tags from (
      select value::uuid id from jsonb_array_elements_text(coalesce(p_payload->'tagIds','[]'::jsonb))
      union
      select t.id from public.crm_lead_tags t
      join jsonb_array_elements(coalesce(p_payload->'newTags','[]'::jsonb)) entry
        on t.organization_id=v_lead.organization_id and t.name=btrim(entry->>'name')
    ) selected;
    if exists(select 1 from unnest(v_tags) id where not exists(select 1 from public.crm_lead_tags t where t.id=id and t.organization_id=v_lead.organization_id)) then raise exception 'invalid_argument: tag unavailable' using errcode='22023'; end if;
    delete from public.crm_lead_tag_links where lead_id=v_lead.id and not(tag_id=any(v_tags));
    insert into public.crm_lead_tag_links(lead_id,tag_id,created_by) select v_lead.id,id,v_actor from unnest(v_tags) id on conflict do nothing;
    update public.crm_leads set version=version+1,updated_by=v_actor,updated_at=now() where id=v_lead.id returning * into v_lead;
  end if;
  insert into public.crm_lead_audit_events(lead_id,organization_id,actor_id,action,changed_fields,metadata,idempotency_key,command_digest)
  values(v_lead.id,v_lead.organization_id,v_actor,'lead.'||p_operation,array[p_operation],jsonb_strip_nulls(jsonb_build_object('resultId',v_result_id)),p_idempotency_key,v_command_digest);
  return jsonb_build_object('id',v_lead.id,'version',v_lead.version,'resultId',v_result_id,'replayed',false);
exception when invalid_text_representation or check_violation or not_null_violation then
  raise exception 'invalid_argument: invalid mutation payload' using errcode='22023';
end;
$$;

alter table public.crm_lead_workspaces enable row level security; alter table public.crm_lead_workspaces force row level security;
alter table public.crm_lead_workspace_members enable row level security; alter table public.crm_lead_workspace_members force row level security;
alter table public.crm_lead_sources enable row level security; alter table public.crm_lead_sources force row level security;
alter table public.crm_lead_channels enable row level security; alter table public.crm_lead_channels force row level security;
alter table public.crm_lead_lost_reasons enable row level security; alter table public.crm_lead_lost_reasons force row level security;
alter table public.crm_lead_stages enable row level security; alter table public.crm_lead_stages force row level security;
alter table public.crm_lead_customers enable row level security; alter table public.crm_lead_customers force row level security;
alter table public.crm_lead_interests enable row level security; alter table public.crm_lead_interests force row level security;
alter table public.crm_leads enable row level security; alter table public.crm_leads force row level security;
alter table public.crm_lead_stage_history enable row level security; alter table public.crm_lead_stage_history force row level security;
alter table public.crm_lead_activities enable row level security; alter table public.crm_lead_activities force row level security;
alter table public.crm_lead_messages enable row level security; alter table public.crm_lead_messages force row level security;
alter table public.crm_lead_tags enable row level security; alter table public.crm_lead_tags force row level security;
alter table public.crm_lead_tag_links enable row level security; alter table public.crm_lead_tag_links force row level security;
alter table public.crm_lead_audit_events enable row level security; alter table public.crm_lead_audit_events force row level security;

do $mfa_policies$
declare
  v_table text;
begin
  foreach v_table in array array[
    'crm_lead_workspaces', 'crm_lead_workspace_members',
    'crm_lead_sources', 'crm_lead_channels', 'crm_lead_lost_reasons',
    'crm_lead_stages', 'crm_lead_customers', 'crm_lead_interests',
    'crm_leads', 'crm_lead_stage_history', 'crm_lead_activities',
    'crm_lead_messages', 'crm_lead_tags', 'crm_lead_tag_links',
    'crm_lead_audit_events'
  ] loop
    execute format(
      'create policy authenticated_session_mfa_gate on public.%I as restrictive for all to authenticated using ((select private.current_session_satisfies_mfa())) with check ((select private.current_session_satisfies_mfa()))',
      v_table
    );
  end loop;
end
$mfa_policies$;

revoke all privileges on table
  public.crm_lead_workspaces, public.crm_lead_workspace_members,
  public.crm_lead_sources, public.crm_lead_channels, public.crm_lead_lost_reasons,
  public.crm_lead_stages, public.crm_lead_customers, public.crm_lead_interests,
  public.crm_leads, public.crm_lead_stage_history, public.crm_lead_activities,
  public.crm_lead_messages, public.crm_lead_tags, public.crm_lead_tag_links,
  public.crm_lead_audit_events
from public, anon, authenticated, service_role;

revoke all privileges on function
  public.list_crm_lead_scopes_v1(), public.get_crm_lead_catalogs_v1(uuid),
  public.list_crm_leads_v1(jsonb), public.list_crm_lead_activities_v1(jsonb),
  public.get_crm_lead_funnel_v1(uuid,jsonb), public.get_crm_lead_v1(uuid),
  public.save_crm_lead_v1(uuid,bigint,jsonb,text),
  public.mutate_crm_lead_v1(uuid,text,jsonb,bigint,text)
from public, anon, authenticated, service_role;
grant execute on function
  public.list_crm_lead_scopes_v1(), public.get_crm_lead_catalogs_v1(uuid),
  public.list_crm_leads_v1(jsonb), public.list_crm_lead_activities_v1(jsonb),
  public.get_crm_lead_funnel_v1(uuid,jsonb), public.get_crm_lead_v1(uuid),
  public.save_crm_lead_v1(uuid,bigint,jsonb,text),
  public.mutate_crm_lead_v1(uuid,text,jsonb,bigint,text)
to authenticated;

commit;
