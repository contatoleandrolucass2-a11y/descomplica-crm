begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Expand-only migration. Rollback before clients depend on this contract may
-- drop the five RPCs, helper functions, indexes and table in reverse order.
-- No existing row is rewritten or removed.
create table public.dashboard_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_key text not null references public.app_pages(key) on delete restrict,
  scope_key text,
  name text not null,
  is_default boolean not null default false,
  schema_version smallint not null default 2,
  version bigint not null default 1,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint dashboard_profiles_scope_key_format check (
    scope_key is null
    or scope_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  ),
  constraint dashboard_profiles_name_valid check (
    name = btrim(name)
    and char_length(name) between 1 and 80
    and name !~ '[[:cntrl:]<>]'
  ),
  constraint dashboard_profiles_schema_version_supported check (schema_version = 2),
  constraint dashboard_profiles_version_safe check (
    version between 1 and 9007199254740991
  ),
  constraint dashboard_profiles_cards_shape check (
    jsonb_typeof(cards) = 'array'
    and jsonb_array_length(cards) <= 50
    and pg_column_size(cards) <= 524288
  ),
  constraint dashboard_profiles_timestamps_ordered check (updated_at >= created_at)
);

comment on table public.dashboard_profiles is
  'Private, versioned dashboard canvas profiles owned by one authenticated user.';

create index dashboard_profiles_scope_idx
  on public.dashboard_profiles (user_id, page_key, scope_key, updated_at desc);

create unique index dashboard_profiles_one_default_idx
  on public.dashboard_profiles (user_id, page_key, coalesce(scope_key, ''))
  where is_default;

alter table public.dashboard_profiles enable row level security;
alter table public.dashboard_profiles force row level security;

create policy authenticated_session_mfa_gate on public.dashboard_profiles
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));

create policy dashboard_profiles_owner on public.dashboard_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Browser roles cannot bypass the RPC validation/version contract.
revoke all privileges on table public.dashboard_profiles
  from public, anon, authenticated, service_role;

create function private.dashboard_profile_json(p_profile public.dashboard_profiles)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', (p_profile).id,
    'userId', (p_profile).user_id,
    'pageKey', (p_profile).page_key,
    'scopeKey', (p_profile).scope_key,
    'name', (p_profile).name,
    'isDefault', (p_profile).is_default,
    'schemaVersion', (p_profile).schema_version,
    'version', (p_profile).version,
    'cards', (p_profile).cards,
    'createdAt', (p_profile).created_at,
    'updatedAt', (p_profile).updated_at
  );
$$;

create function private.assert_dashboard_profile_context(
  p_actor uuid,
  p_page_key text,
  p_scope_key text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permission text;
begin
  if p_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  if not (select private.current_session_satisfies_mfa()) then
    raise exception 'forbidden: multi-factor session required' using errcode = '42501';
  end if;
  perform public._internal_assert_actor_active(p_actor);
  if p_page_key is null or p_page_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or char_length(p_page_key) > 160
     or (p_scope_key is not null and p_scope_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$') then
    raise exception 'invalid_argument: invalid dashboard profile scope' using errcode = '22023';
  end if;

  select page.permission_key into v_permission
  from public.app_pages page
  where page.key = p_page_key and page.is_active;

  if v_permission is null
     or not public._internal_has_permission(p_actor, v_permission) then
    raise exception 'forbidden: dashboard page unavailable' using errcode = '42501';
  end if;
end;
$$;

create function private.assert_dashboard_profile_document(p_page_key text, p_cards jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
  v_entity jsonb;
  v_ids text[] := array[]::text[];
  v_orders integer[] := array[]::integer[];
  v_signatures text[] := array[]::text[];
  v_id text;
  v_order integer;
  v_signature text;
  v_start text;
  v_end text;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array'
     or jsonb_array_length(p_cards) > 50
     or pg_column_size(p_cards) > 524288 then
    raise exception 'invalid_argument: invalid dashboard cards' using errcode = '22023';
  end if;

  if p_page_key not in ('crm.dashboard', 'crm.stage.appointments') then
    raise exception 'invalid_argument: unsupported dashboard page catalog' using errcode = '22023';
  end if;

  for v_card in select value from jsonb_array_elements(p_cards) loop
    if jsonb_typeof(v_card) <> 'object'
       or not (v_card ?& array['id','type','metric','period','groupBy','entityIds','layout'])
       or exists (
         select 1 from jsonb_object_keys(v_card) key
         where key not in (
           'id','type','metric','title','period','startDate','endDate',
           'groupBy','entityIds','layout','options'
         )
       )
       or jsonb_typeof(v_card->'id') <> 'string'
       or (v_card->>'id') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
       or (v_card->>'id') in ('__proto__','prototype','constructor')
       or jsonb_typeof(v_card->'type') <> 'string'
       or (v_card->>'type') not in (
         'kpi','bars','horizontal-bars','line','area','donut','radar','scatter','funnel','table'
       )
       or jsonb_typeof(v_card->'metric') <> 'string'
       or (v_card->>'metric') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
       or jsonb_typeof(v_card->'period') <> 'string'
       or (v_card->>'period') not in ('global','today','week','month','custom')
       or jsonb_typeof(v_card->'groupBy') <> 'string'
       or (v_card->>'groupBy') not in ('entity','day','hour') then
      raise exception 'invalid_argument: invalid dashboard card' using errcode = '22023';
    end if;

    if (
      p_page_key = 'crm.dashboard'
      and (v_card->>'metric') not in (
        'overview.goal.month','overview.goal.expected','overview.current.month',
        'overview.period.month','overview.period.previous-week',
        'overview.period.current-week','overview.period.yesterday','overview.period.today',
        'overview.history.year-average','overview.history.three-month-average',
        'overview.history.previous','overview.history.current',
        'overview.history.sale-average'
      )
    ) or (
      p_page_key = 'crm.stage.appointments'
      and (v_card->>'metric') not in (
        'appointments.total','appointments.rate','appointments.daily','appointments.weekly',
        'appointments.monthly','appointments.yesterday','appointments.today',
        'appointments.today-comparison','appointments.planned-today',
        'appointments.performed-today','appointments.goal',
        'appointments.funnel-comparison','appointments.details','team.productive',
        'brokers.total','managers.total','visits.total','sales.total',
        'conversion.opportunity-appointment','conversion.appointment-visit',
        'conversion.appointment-sale','ranking.score','ranking.owner','ranking.manager',
        'ranking.regional-manager','conversion-ranking.owner',
        'conversion-ranking.manager','conversion-ranking.regional-manager',
        'recency.up-to-7-days','recency.8-to-14-days','recency.15-plus-days'
      )
    ) then
      raise exception 'invalid_argument: metric unavailable for dashboard page' using errcode = '22023';
    end if;

    if v_card ? 'title' and (
      jsonb_typeof(v_card->'title') <> 'string'
      or btrim(v_card->>'title') = ''
      or char_length(v_card->>'title') > 120
      or (v_card->>'title') ~ '[[:cntrl:]<>]'
    ) then
      raise exception 'invalid_argument: invalid dashboard card title' using errcode = '22023';
    end if;

    v_start := v_card->>'startDate';
    v_end := v_card->>'endDate';
    if (v_card->>'period') = 'custom' then
      if v_start is null or v_end is null
         or v_start !~ '^\d{4}-\d{2}-\d{2}$'
         or v_end !~ '^\d{4}-\d{2}-\d{2}$'
         or to_char(to_date(v_start, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_start
         or to_char(to_date(v_end, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_end
         or v_start > v_end then
        raise exception 'invalid_argument: invalid dashboard card period' using errcode = '22023';
      end if;
    elsif v_start is not null or v_end is not null then
      raise exception 'invalid_argument: unexpected dashboard card dates' using errcode = '22023';
    end if;

    if jsonb_typeof(v_card->'entityIds') not in ('array','null')
       or (jsonb_typeof(v_card->'entityIds') = 'array'
         and jsonb_array_length(v_card->'entityIds') > 200) then
      raise exception 'invalid_argument: invalid dashboard card entities' using errcode = '22023';
    end if;
    if jsonb_typeof(v_card->'entityIds') = 'array' then
      if exists (
        select 1 from jsonb_array_elements(v_card->'entityIds') entity
        where jsonb_typeof(entity) <> 'string'
           or (entity #>> '{}') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
           or (entity #>> '{}') not in ('channel.house','channel.partnerships')
      ) or (
        select count(*) from jsonb_array_elements(v_card->'entityIds')
      ) <> (
        select count(distinct entity #>> '{}') from jsonb_array_elements(v_card->'entityIds') entity
      ) then
        raise exception 'invalid_argument: invalid dashboard card entities' using errcode = '22023';
      end if;
    end if;

    if jsonb_typeof(v_card->'layout') <> 'object'
       or not ((v_card->'layout') ?& array['order','columnSpan','height'])
       or (select count(*) from jsonb_object_keys(v_card->'layout')) <> 3
       or jsonb_typeof(v_card#>'{layout,order}') <> 'number'
       or jsonb_typeof(v_card#>'{layout,columnSpan}') <> 'number'
       or jsonb_typeof(v_card#>'{layout,height}') <> 'number'
       or (v_card#>>'{layout,order}') !~ '^\d+$'
       or (v_card#>>'{layout,columnSpan}') !~ '^\d+$'
       or (v_card#>>'{layout,height}') !~ '^\d+$'
       or (v_card#>>'{layout,order}')::integer not between 0 and 49
       or (v_card#>>'{layout,columnSpan}')::integer not between 1 and 12
       or (v_card#>>'{layout,height}')::integer not between 1 and 1200 then
      raise exception 'invalid_argument: invalid dashboard card layout' using errcode = '22023';
    end if;

    if (v_card#>>'{layout,columnSpan}')::integer < (case (v_card->>'type')
         when 'kpi' then 2
         when 'funnel' then 2
         when 'table' then 6
         else 3
       end)
       or (v_card#>>'{layout,height}')::integer < (case (v_card->>'type')
         when 'kpi' then 168
         when 'horizontal-bars' then 264
         when 'funnel' then 312
         when 'table' then 360
         else 240
       end)
       or (v_card#>>'{layout,height}')::integer > (case (v_card->>'type')
         when 'kpi' then 480
         when 'funnel' then 888
         when 'table' then 1080
         else 816
       end) then
      raise exception 'invalid_argument: dashboard card layout outside type limits'
        using errcode = '22023';
    end if;

    if v_card ? 'options' and (
      jsonb_typeof(v_card->'options') <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_card->'options') key
        where key not in ('showLegend','showGoal','showCeiling','sharedScale')
      )
      or exists (
        select 1 from jsonb_each(v_card->'options') option
        where jsonb_typeof(option.value) <> 'boolean'
      )
    ) then
      raise exception 'invalid_argument: invalid dashboard card options' using errcode = '22023';
    end if;

    v_id := v_card->>'id';
    v_order := (v_card#>>'{layout,order}')::integer;
    if v_id = any(v_ids) or v_order = any(v_orders) then
      raise exception 'invalid_argument: duplicate dashboard card identity' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_id);
    v_orders := array_append(v_orders, v_order);

    v_signature := concat_ws('|',
      v_card->>'type', v_card->>'metric', v_card->>'groupBy', v_card->>'period',
      coalesce(v_start, ''), coalesce(v_end, ''),
      case when jsonb_typeof(v_card->'entityIds') = 'array' then (
        select coalesce(string_agg(entity #>> '{}', ',' order by entity #>> '{}'), '')
        from jsonb_array_elements(v_card->'entityIds') entity
      ) else '*' end
    );
    if v_signature = any(v_signatures) then
      raise exception 'invalid_argument: duplicate dashboard card signature' using errcode = '22023';
    end if;
    v_signatures := array_append(v_signatures, v_signature);
  end loop;
end;
$$;

create function public.get_dashboard_profiles(p_page_key text, p_scope_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profiles jsonb;
begin
  perform private.assert_dashboard_profile_context(v_actor, p_page_key, p_scope_key);
  select coalesce(
    jsonb_agg(private.dashboard_profile_json(profile)
      order by profile.is_default desc, profile.updated_at desc, profile.id),
    '[]'::jsonb
  ) into v_profiles
  from public.dashboard_profiles profile
  where profile.user_id = v_actor
    and profile.page_key = p_page_key
    and profile.scope_key is not distinct from p_scope_key;
  return v_profiles;
end;
$$;

create function public.get_dashboard_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_profile from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor;
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_context(v_actor, v_profile.page_key, v_profile.scope_key);
  return private.dashboard_profile_json(v_profile);
end;
$$;

create function public.create_dashboard_profile(
  p_page_key text,
  p_scope_key text,
  p_name text,
  p_cards jsonb,
  p_schema_version smallint default 2,
  p_is_default boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_saved public.dashboard_profiles%rowtype;
  v_make_default boolean;
begin
  perform private.assert_dashboard_profile_context(v_actor, p_page_key, p_scope_key);
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 80
     or p_name ~ '[[:cntrl:]<>]' or p_schema_version <> 2 then
    raise exception 'invalid_argument: invalid dashboard profile' using errcode = '22023';
  end if;
  perform private.assert_dashboard_profile_document(p_page_key, p_cards);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || '|' || p_page_key || '|' || coalesce(p_scope_key, ''), 0)
  );
  v_make_default := p_is_default or not exists (
    select 1 from public.dashboard_profiles profile
    where profile.user_id = v_actor and profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key and profile.is_default
  );
  if v_make_default then
    update public.dashboard_profiles profile
    set is_default = false, version = version + 1, updated_at = clock_timestamp()
    where profile.user_id = v_actor and profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key and profile.is_default;
  end if;
  insert into public.dashboard_profiles (
    user_id, page_key, scope_key, name, is_default, schema_version, cards
  ) values (
    v_actor, p_page_key, p_scope_key, p_name, v_make_default, p_schema_version, p_cards
  ) returning * into v_saved;
  return private.dashboard_profile_json(v_saved);
end;
$$;

create function public.update_dashboard_profile(
  p_profile_id uuid,
  p_expected_version bigint,
  p_name text default null,
  p_cards jsonb default null,
  p_schema_version smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.dashboard_profiles%rowtype;
  v_saved public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_current from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor;
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_context(v_actor, v_current.page_key, v_current.scope_key);
  if p_expected_version is null or p_expected_version not between 1 and 9007199254740991
     or (p_name is null and p_cards is null and p_schema_version is null)
     or (p_name is not null and (
       p_name <> btrim(p_name) or char_length(p_name) not between 1 and 80
       or p_name ~ '[[:cntrl:]<>]'
     ))
     or (p_schema_version is not null and p_schema_version <> 2) then
    raise exception 'invalid_argument: invalid dashboard profile patch' using errcode = '22023';
  end if;
  if p_cards is not null then
    perform private.assert_dashboard_profile_document(v_current.page_key, p_cards);
  end if;
  if v_current.version <> p_expected_version then
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  update public.dashboard_profiles profile
  set name = coalesce(p_name, profile.name),
      cards = coalesce(p_cards, profile.cards),
      schema_version = coalesce(p_schema_version, profile.schema_version),
      version = profile.version + 1,
      updated_at = clock_timestamp()
  where profile.id = p_profile_id and profile.user_id = v_actor
    and profile.version = p_expected_version
  returning * into v_saved;
  if not found then
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  return private.dashboard_profile_json(v_saved);
end;
$$;

create function public.set_default_dashboard_profile(
  p_profile_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.dashboard_profiles%rowtype;
  v_saved public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_current from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor;
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_context(v_actor, v_current.page_key, v_current.scope_key);
  if p_expected_version is null or p_expected_version not between 1 and 9007199254740991 then
    raise exception 'invalid_argument: invalid expected version' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || '|' || v_current.page_key || '|' || coalesce(v_current.scope_key, ''), 0
    )
  );
  select * into v_current from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor for update;
  if v_current.version <> p_expected_version then
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  update public.dashboard_profiles profile
  set is_default = false, version = version + 1, updated_at = clock_timestamp()
  where profile.user_id = v_actor and profile.page_key = v_current.page_key
    and profile.scope_key is not distinct from v_current.scope_key
    and profile.is_default and profile.id <> p_profile_id;
  update public.dashboard_profiles profile
  set is_default = true, version = version + 1, updated_at = clock_timestamp()
  where profile.id = p_profile_id and profile.user_id = v_actor
    and profile.version = p_expected_version
  returning * into v_saved;
  if not found then
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  return private.dashboard_profile_json(v_saved);
end;
$$;

create function public.delete_dashboard_profile(
  p_profile_id uuid,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.dashboard_profiles%rowtype;
  v_fallback public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_current from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor;
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_context(v_actor, v_current.page_key, v_current.scope_key);
  if p_expected_version is null or p_expected_version not between 1 and 9007199254740991 then
    raise exception 'invalid_argument: invalid expected version' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || '|' || v_current.page_key || '|' || coalesce(v_current.scope_key, ''), 0
    )
  );
  delete from public.dashboard_profiles profile
  where profile.id = p_profile_id and profile.user_id = v_actor
    and profile.version = p_expected_version;
  if not found then
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  if v_current.is_default then
    update public.dashboard_profiles profile
    set is_default = true, version = version + 1, updated_at = clock_timestamp()
    where profile.id = (
      select candidate.id from public.dashboard_profiles candidate
      where candidate.user_id = v_actor and candidate.page_key = v_current.page_key
        and candidate.scope_key is not distinct from v_current.scope_key
      order by candidate.updated_at desc, candidate.id
      limit 1
    )
    returning * into v_fallback;
  end if;
  return jsonb_build_object(
    'deletedId', p_profile_id,
    'defaultProfile', case when v_fallback.id is null then null
      else private.dashboard_profile_json(v_fallback) end,
    'savedAt', clock_timestamp()
  );
end;
$$;

alter function private.dashboard_profile_json(public.dashboard_profiles) owner to postgres;
alter function private.assert_dashboard_profile_context(uuid, text, text) owner to postgres;
alter function private.assert_dashboard_profile_document(text, jsonb) owner to postgres;
alter function public.get_dashboard_profiles(text, text) owner to postgres;
alter function public.get_dashboard_profile(uuid) owner to postgres;
alter function public.create_dashboard_profile(text, text, text, jsonb, smallint, boolean)
  owner to postgres;
alter function public.update_dashboard_profile(uuid, bigint, text, jsonb, smallint)
  owner to postgres;
alter function public.set_default_dashboard_profile(uuid, bigint) owner to postgres;
alter function public.delete_dashboard_profile(uuid, bigint) owner to postgres;

revoke all privileges on function
  private.dashboard_profile_json(public.dashboard_profiles),
  private.assert_dashboard_profile_context(uuid, text, text),
  private.assert_dashboard_profile_document(text, jsonb),
  public.get_dashboard_profiles(text, text),
  public.get_dashboard_profile(uuid),
  public.create_dashboard_profile(text, text, text, jsonb, smallint, boolean),
  public.update_dashboard_profile(uuid, bigint, text, jsonb, smallint),
  public.set_default_dashboard_profile(uuid, bigint),
  public.delete_dashboard_profile(uuid, bigint)
from public, anon, authenticated, service_role;

grant execute on function
  public.get_dashboard_profiles(text, text),
  public.get_dashboard_profile(uuid),
  public.create_dashboard_profile(text, text, text, jsonb, smallint, boolean),
  public.update_dashboard_profile(uuid, bigint, text, jsonb, smallint),
  public.set_default_dashboard_profile(uuid, bigint),
  public.delete_dashboard_profile(uuid, bigint)
to authenticated;

commit;
