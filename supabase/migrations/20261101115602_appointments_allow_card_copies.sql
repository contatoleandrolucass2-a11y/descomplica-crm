-- Allow intentional copies only in the appointments dashboard. Identity and
-- order remain unique, document/card limits and all content validation remain.
-- CREATE OR REPLACE preserves the trusted owner, invoker mode and private ACL.
-- No profiles are rewritten and no RPC, authorization, RLS, grants or CAS change.
-- Apply this expansion before enabling the new writer. Once copies are saved,
-- rollback must retain readers/validators that accept appointments duplicates;
-- do not deduplicate or delete saved cards without separate authorization.

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
    if p_page_key is distinct from 'crm.stage.appointments'
       and v_signature = any(v_signatures) then
      raise exception 'invalid_argument: duplicate dashboard card signature' using errcode = '22023';
    end if;
    v_signatures := array_append(v_signatures, v_signature);
  end loop;
end;
$$;
