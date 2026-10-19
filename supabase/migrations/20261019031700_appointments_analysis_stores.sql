-- Additive v2: store index at position 10; v1 snapshots remain readable.
-- No source records, direct table grants, role grants or existing rows change.
alter table public.crm_dashboard_analysis drop constraint crm_dashboard_analysis_payload_view;
alter table public.crm_dashboard_analysis add constraint crm_dashboard_analysis_payload_view
  check (jsonb_typeof(payload) = 'object'
    and (payload->>'viewKey') is not distinct from view_key
    and payload->'version' is not null
    and payload->'version' in ('1'::jsonb, '2'::jsonb));

create or replace function public.read_crm_dashboard_analysis(p_snapshot_id bigint, p_view_keys text[])
returns table(view_key text, payload jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_can_rank boolean;
  v_row record;
  v_facts jsonb;
begin
  if v_user_id is null
     or not coalesce(public.has_permission(v_user_id, 'crm.dashboard.view'), false) then
    return;
  end if;
  v_can_rank := coalesce(public.has_permission(v_user_id, 'crm.ranking.view'), false);

  for v_row in
    select a.view_key, a.payload
    from public.crm_dashboard_analysis a
    where a.snapshot_id = p_snapshot_id
      and a.view_key = any(p_view_keys)
      and case a.view_key
        when 'all' then public.has_permission(v_user_id, 'crm.dashboard.all.view')
        when 'with_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.with_canal_imob.view')
        when 'without_canal_imob' then public.has_permission(v_user_id, 'crm.dashboard.without_canal_imob.view')
        else false
      end
    order by a.view_key
  loop
    view_key := v_row.view_key;
    payload := v_row.payload;
    if not v_can_rank then
      -- Removing just labels would still reveal a ranked per-development series.
      -- Collapse the hidden dimension before returning any facts to the caller.
      select coalesce(jsonb_agg(
        g.fact_key || jsonb_build_array(g.fact_count, g.amount, g.approved_count)
        || case when v_row.payload->'version' = '2'::jsonb then '[-1]'::jsonb else '[]'::jsonb end
        order by g.fact_key
      ), '[]'::jsonb) into v_facts
      from (
        select jsonb_build_array(f->0, f->1, f->2, f->3, f->4, f->5, -1) as fact_key,
          sum((f->>7)::numeric) as fact_count,
          sum((f->>8)::numeric) as amount,
          sum((f->>9)::numeric) as approved_count
        from jsonb_array_elements(v_row.payload->'facts') f
        group by jsonb_build_array(f->0, f->1, f->2, f->3, f->4, f->5, -1)
      ) g;
      -- Fail closed instead of emitting tuples outside the unchanged read contract.
      if exists (
        select 1 from jsonb_array_elements(v_facts) f
        where (f->>7)::numeric > 1000000000 or (f->>8)::numeric > 1000000000000000
      ) then
        raise exception 'dashboard analysis aggregate exceeds contract bounds' using errcode = '22023';
      end if;
      payload := jsonb_set(jsonb_set(payload, '{dimensions,developments}', '[]'::jsonb), '{facts}', v_facts);
      if payload->'version' = '2'::jsonb then
        payload := jsonb_set(payload, '{dimensions,stores}', '[]'::jsonb);
      end if;
    end if;
    return next;
  end loop;
end;
$$;

alter function public.read_crm_dashboard_analysis(bigint, text[]) owner to postgres;
revoke all on function public.read_crm_dashboard_analysis(bigint, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_crm_dashboard_analysis(bigint, text[]) to authenticated;

create or replace function private.validate_crm_dashboard_analysis(p_analysis jsonb, p_reference_date text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_keys text[];
  v_v2 boolean;
  v_view jsonb;
  v_labels jsonb;
  v_dimensions jsonb;
  -- Match JavaScript String.trim for dictionary validation.
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  v_start date;
  v_reference date;
begin
  if jsonb_typeof(p_analysis) is distinct from 'object' then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;
  if not (p_analysis ?& array['version', 'coverageStart', 'referenceDate', 'views'])
     or p_analysis - array['version', 'coverageStart', 'referenceDate', 'views'] <> '{}'::jsonb
     or p_analysis->'version' not in ('1'::jsonb, '2'::jsonb)
     or jsonb_typeof(p_analysis->'coverageStart') is distinct from 'string'
     or jsonb_typeof(p_analysis->'referenceDate') is distinct from 'string'
     or jsonb_typeof(p_analysis->'views') is distinct from 'array' then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;
  if p_analysis->>'referenceDate' is distinct from p_reference_date
     or p_analysis->>'coverageStart' !~ '^[0-9]{4}-[0-9]{2}-01$'
     or p_analysis->>'referenceDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or jsonb_array_length(p_analysis->'views') <> 3 then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;
  v_start := (p_analysis->>'coverageStart')::date;
  v_reference := (p_analysis->>'referenceDate')::date;
  if v_start > v_reference
     or v_start < date_trunc('month', v_reference::timestamp) - interval '15 months' then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;

  v_v2 := p_analysis->'version' = '2'::jsonb;
  v_keys := array['managers','owners','companies','developments'] || case when v_v2 then array['stores'] else array[]::text[] end;
  for v_view in select value from jsonb_array_elements(p_analysis->'views') loop
    if jsonb_typeof(v_view) is distinct from 'object' then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    if not (v_view ?& array['viewKey', 'dimensions', 'facts'])
       or v_view - array['viewKey', 'dimensions', 'facts'] <> '{}'::jsonb
       or jsonb_typeof(v_view->'viewKey') is distinct from 'string'
       or v_view->>'viewKey' not in ('all', 'with_canal_imob', 'without_canal_imob')
       or jsonb_typeof(v_view->'dimensions') is distinct from 'object'
       or jsonb_typeof(v_view->'facts') is distinct from 'array' then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    v_dimensions := v_view->'dimensions';
    if not (v_dimensions ?& v_keys)
       or v_dimensions - v_keys <> '{}'::jsonb
       or jsonb_array_length(v_view->'facts') > 100000 then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    for v_labels in select value from jsonb_each(v_dimensions) loop
      if jsonb_typeof(v_labels) is distinct from 'array' then
        raise exception 'invalid dashboard analysis' using errcode = '22023';
      end if;
      if jsonb_array_length(v_labels) > 10000
         or exists (
           select 1 from jsonb_array_elements(v_labels) label
           where jsonb_typeof(label) <> 'string'
              or length(label #>> '{}') > 200
              or length(btrim(label #>> '{}', v_whitespace)) not between 1 and 200
         )
         or (select count(distinct btrim(value, v_whitespace)) from jsonb_array_elements_text(v_labels))
            <> jsonb_array_length(v_labels) then
        raise exception 'invalid dashboard analysis' using errcode = '22023';
      end if;
    end loop;

    -- Validate container and scalar types before any casts or array indexing.
    if exists (
      select 1 from jsonb_array_elements(v_view->'facts') fact
      where jsonb_typeof(fact) <> 'array'
    ) then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_view->'facts') fact
      where jsonb_array_length(fact) <> case when v_v2 then 11 else 10 end
         or jsonb_typeof(fact->1) is distinct from 'string'
         or fact->>1 !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or exists (
           select 1 from unnest(array[0,2,3,4,5,6,7,8,9] || case when v_v2 then array[10] else array[]::int[] end) as positions(i)
           where jsonb_typeof(fact->i) is distinct from 'number'
         )
    ) then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_view->'facts') fact
      where (fact->>1)::date not between v_start and v_reference
         or exists (
           select 1 from unnest(array[0,2,3,4,5,6,7,9] || case when v_v2 then array[10] else array[]::int[] end) as positions(i)
           where (fact->>i)::numeric <> trunc((fact->>i)::numeric)
         )
         or (fact->>0)::numeric not between 0 and 4
         or (fact->>2)::numeric not between -1 and jsonb_array_length(v_dimensions->'managers') - 1
         or (fact->>3)::numeric not between -1 and jsonb_array_length(v_dimensions->'owners') - 1
         or (fact->>4)::numeric not between -1 and jsonb_array_length(v_dimensions->'companies') - 1
         or (fact->>5)::numeric not between 0 and 1
         or (fact->>6)::numeric not between -1 and jsonb_array_length(v_dimensions->'developments') - 1
         or (v_v2 and ((fact->>10)::numeric not between -1 and jsonb_array_length(v_dimensions->'stores') - 1
           or ((fact->>0)::numeric <> 1 and (fact->>10)::numeric <> -1)))
         or (fact->>7)::numeric not between 1 and 1000000000
         or (fact->>8)::numeric not between 0 and 1000000000000000
         or (fact->>9)::numeric not between 0 and (fact->>7)::numeric
         or ((fact->>0)::numeric <> 3 and (fact->>9)::numeric <> 0)
         or ((fact->>0)::numeric <> 4 and (fact->>8)::numeric <> 0)
    ) then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_view->'facts') fact
      group by jsonb_build_array(fact->0, fact->1, fact->2, fact->3, fact->4, fact->5, fact->6) || case when v_v2 then jsonb_build_array(fact->10) else '[]'::jsonb end
      having count(*) > 1
    ) then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct value->>'viewKey') from jsonb_array_elements(p_analysis->'views')) <> 3 then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;
exception when data_exception then
  raise exception 'invalid dashboard analysis' using errcode = '22023';
end;
$$;

alter function private.validate_crm_dashboard_analysis(jsonb, text) owner to postgres;
revoke all on function private.validate_crm_dashboard_analysis(jsonb, text)
  from public, anon, authenticated, service_role;

create or replace function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dashboard jsonb := p_payload->'dashboard';
  v_analysis jsonb := v_dashboard->'analysis';
  v_result jsonb;
  v_snapshot_id bigint;
begin
  -- The existing primitive owns locking, stale checks, replay and run records.
  v_result := private.ingest_crm_salesforce_snapshot_v2_internal(
    p_payload #- '{dashboard,analysis}'
  );
  if coalesce((v_result->>'ok')::boolean, false)
     and not coalesce((v_result->>'idempotent')::boolean, false) then
    select id into v_snapshot_id
      from public.crm_dashboard_snapshots
     where snapshot_key = v_dashboard->>'snapshotKey'
       and reference_date = (v_dashboard->>'referenceDate')::date
       and generated_at = (v_dashboard->>'generatedAt')::timestamptz;
    if not found then
      raise exception 'dashboard analysis snapshot mismatch' using errcode = '22023';
    end if;

    -- Raising here rolls back the base snapshot, its run/audit and analysis.
    -- Replays (including altered extensions) never reach validation or writes.
    if v_dashboard ? 'analysis' then
      perform private.validate_crm_dashboard_analysis(v_analysis, v_dashboard->>'referenceDate');
    end if;
    delete from public.crm_dashboard_analysis where snapshot_id = v_snapshot_id;
    if v_dashboard ? 'analysis' then
      insert into public.crm_dashboard_analysis (snapshot_id, view_key, payload)
      select v_snapshot_id, view->>'viewKey',
        jsonb_build_object(
          'version', v_analysis->'version',
          'coverageStart', v_analysis->'coverageStart',
          'referenceDate', v_analysis->'referenceDate'
        ) || view
      from jsonb_array_elements(v_analysis->'views') view;
    end if;
  end if;
  return v_result;
end;
$$;

alter function public.ingest_crm_salesforce_snapshot(jsonb) owner to postgres;
revoke all on function public.ingest_crm_salesforce_snapshot(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_crm_salesforce_snapshot(jsonb) to service_role;
