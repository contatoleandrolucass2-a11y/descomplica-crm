-- Additive Agendamentos catalog and one-time profile expansion. Existing card
-- identities, dimensions and presentation are preserved; only order is reindexed.
-- No RPC, authorization, RLS, grants or schema version changes. Apply before the
-- new writer. Rollback must keep a reader/validator accepting these metrics;
-- deleting saved cards is not a rollback and requires separate authorization.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create or replace function private.assert_dashboard_profile_document_v2(p_page_key text, p_cards jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
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
        'appointments.funnel-comparison','appointments.details','appointments.overdue','team.productive',
        'brokers.total','managers.total','visits.total','sales.total',
        'conversion.opportunity-appointment','conversion.appointment-visit',
        'conversion.appointment-sale','ranking.score','ranking.owner','ranking.manager',
        'ranking.regional-manager','ranking.pdv','ranking.development','conversion-ranking.owner',
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
    if p_page_key is distinct from 'crm.stage.appointments'
       and v_signature = any(v_signatures) then
      raise exception 'invalid_argument: duplicate dashboard card signature' using errcode = '22023';
    end if;
    v_signatures := array_append(v_signatures, v_signature);
  end loop;
end;
$$;

-- Pure document expansion: no reads or writes outside the input JSON.
create or replace function private.expand_appointments_reading_cards(p_cards jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ids text[];
  v_metrics text[];
  v_seed jsonb;
  v_card jsonb;
  v_id text;
  v_suffix integer;
  v_rankings jsonb := '[]'::jsonb;
  v_overdue jsonb := '[]'::jsonb;
  v_result jsonb := '[]'::jsonb;
  v_sorted jsonb;
  v_rank_anchor integer := 0;
  v_detail_anchor integer := 0;
  v_index integer := 0;
begin
  perform private.assert_dashboard_profile_document('crm.stage.appointments', p_cards);
  select coalesce(array_agg(card->>'id'), array[]::text[]),
         coalesce(array_agg(card->>'metric'), array[]::text[])
  into v_ids, v_metrics from jsonb_array_elements(p_cards) card;

  for v_seed in select value from jsonb_array_elements('[
    {"id":"ranking-pdv","metric":"ranking.pdv","title":"Ranking por PDV: Nome do Empreendimento","type":"horizontal-bars","columnSpan":6},
    {"id":"ranking-development","metric":"ranking.development","title":"Ranking por Nome do empreendimento","type":"horizontal-bars","columnSpan":6},
    {"id":"appointments-overdue","metric":"appointments.overdue","title":"Agendamentos vencidos sem visita realizada","type":"table","columnSpan":12}
  ]'::jsonb) loop
    if (v_seed->>'metric') = any(v_metrics) then continue; end if;
    v_id := v_seed->>'id';
    v_suffix := 0;
    while v_id = any(v_ids) loop
      v_suffix := v_suffix + 1;
      v_id := (v_seed->>'id') || '-' || v_suffix::text;
    end loop;
    v_ids := array_append(v_ids, v_id);
    v_card := jsonb_build_object(
      'id', v_id, 'type', v_seed->'type', 'metric', v_seed->'metric',
      'title', v_seed->'title', 'period', 'month', 'groupBy', 'entity',
      'entityIds', null,
      'layout', jsonb_build_object('order', 0, 'columnSpan', v_seed->'columnSpan', 'height', 500)
    );
    if (v_seed->>'metric') = 'appointments.overdue' then
      v_overdue := v_overdue || jsonb_build_array(v_card);
    else
      v_rankings := v_rankings || jsonb_build_array(v_card);
    end if;
  end loop;
  if jsonb_array_length(v_rankings) + jsonb_array_length(v_overdue) = 0 then
    return p_cards;
  end if;
  if jsonb_array_length(p_cards) + jsonb_array_length(v_rankings)
       + jsonb_array_length(v_overdue) > 50 then
    raise exception 'invalid_argument: appointments expansion exceeds card limit' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(card order by (card#>>'{layout,order}')::integer), '[]'::jsonb)
  into v_sorted from jsonb_array_elements(p_cards) card;
  for v_card in select value from jsonb_array_elements(v_sorted) loop
    v_index := v_index + 1;
    if (v_card->>'metric') in ('recency.up-to-7-days','recency.8-to-14-days','recency.15-plus-days') then
      v_rank_anchor := v_index;
    end if;
    if (v_card->>'metric') = 'appointments.details' then v_detail_anchor := v_index; end if;
  end loop;
  v_index := 0;
  for v_card in select value from jsonb_array_elements(v_sorted) loop
    v_index := v_index + 1;
    v_result := v_result || jsonb_build_array(v_card);
    if v_index = v_rank_anchor then v_result := v_result || v_rankings; end if;
    if v_index = v_detail_anchor then v_result := v_result || v_overdue; end if;
  end loop;
  if v_rank_anchor = 0 then v_result := v_result || v_rankings; end if;
  if v_detail_anchor = 0 then v_result := v_result || v_overdue; end if;
  select jsonb_agg(jsonb_set(card, '{layout,order}', to_jsonb(ordinality - 1)) order by ordinality)
  into v_result from jsonb_array_elements(v_result) with ordinality as cards(card, ordinality);
  -- Enforce document bytes, new identities and all existing presentation rules.
  perform private.assert_dashboard_profile_document('crm.stage.appointments', v_result);
  return v_result;
end;
$$;

alter function private.expand_appointments_reading_cards(jsonb) owner to postgres;
revoke all on function private.expand_appointments_reading_cards(jsonb)
  from public, anon, authenticated, service_role;

-- Serialize with the existing profile writers. Prepare and validate EVERY
-- candidate before any UPDATE; one limit/version failure aborts the transaction.
lock table public.dashboard_profiles in share row exclusive mode;
create temporary table appointments_reading_profile_expansion on commit drop as
select id, version, updated_at, cards as original_cards,
       private.expand_appointments_reading_cards(cards) as expanded_cards
from public.dashboard_profiles where page_key = 'crm.stage.appointments';
delete from pg_temp.appointments_reading_profile_expansion
where expanded_cards = original_cards;
do $$
declare
  v_expected bigint;
  v_updated bigint;
begin
  if exists (select 1 from pg_temp.appointments_reading_profile_expansion
             where version >= 9007199254740991) then
    raise exception 'invalid_argument: dashboard profile version exhausted' using errcode = '22023';
  end if;
  select count(*) into v_expected from pg_temp.appointments_reading_profile_expansion;
  update public.dashboard_profiles profile
  set cards = prepared.expanded_cards,
      version = profile.version + 1,
      updated_at = greatest(clock_timestamp(), profile.updated_at + interval '1 microsecond')
  from pg_temp.appointments_reading_profile_expansion prepared
  where profile.id = prepared.id and profile.version = prepared.version
    and profile.updated_at = prepared.updated_at and profile.cards = prepared.original_cards
    and profile.page_key = 'crm.stage.appointments';
  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'conflict: dashboard profiles changed during expansion' using errcode = '40001';
  end if;
end;
$$;
commit;
