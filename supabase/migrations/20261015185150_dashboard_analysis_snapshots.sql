-- Optional packed daily aggregates. No ranking rows or customer records.
-- The machine RPC remains v2; only a newly applied snapshot replaces analysis.
create table public.crm_dashboard_analysis (
  snapshot_id bigint not null
    references public.crm_dashboard_snapshots(id) on delete cascade,
  view_key text not null,
  payload jsonb not null,
  primary key (snapshot_id, view_key),
  constraint crm_dashboard_analysis_view_key
    check (view_key in ('all', 'with_canal_imob', 'without_canal_imob')),
  constraint crm_dashboard_analysis_payload_view
    check (
      jsonb_typeof(payload) = 'object'
      and (payload->>'viewKey') is not distinct from view_key
      and (payload->'version') is not distinct from '1'::jsonb
    )
);

alter table public.crm_dashboard_analysis enable row level security;
revoke all on public.crm_dashboard_analysis from public, anon, authenticated, service_role;
grant select on public.crm_dashboard_analysis to authenticated;

-- Match crm_dashboard_views: owner labels are authorized filter dimensions,
-- not ranked participant records, and do not require crm.ranking.view.
create policy crm_dashboard_analysis_select_authorized
  on public.crm_dashboard_analysis for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
    and case view_key
      when 'all' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.all.view')
      )
      when 'with_canal_imob' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.with_canal_imob.view')
      )
      when 'without_canal_imob' then (
        select public.has_permission((select auth.uid()), 'crm.dashboard.without_canal_imob.view')
      )
      else false
    end
  );

create function private.validate_crm_dashboard_analysis(p_analysis jsonb, p_reference_date text)
returns void
language plpgsql
set search_path = ''
as $$
declare
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
     or p_analysis->'version' is distinct from '1'::jsonb
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
    if not (v_dimensions ?& array['managers', 'owners', 'companies', 'developments'])
       or v_dimensions - array['managers', 'owners', 'companies', 'developments'] <> '{}'::jsonb
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
      where jsonb_array_length(fact) <> 10
         or jsonb_typeof(fact->1) is distinct from 'string'
         or fact->>1 !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or exists (
           select 1 from unnest(array[0,2,3,4,5,6,7,8,9]) as positions(i)
           where jsonb_typeof(fact->i) is distinct from 'number'
         )
    ) then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_view->'facts') fact
      where (fact->>1)::date not between v_start and v_reference
         or exists (
           select 1 from unnest(array[0,2,3,4,5,6,7,9]) as positions(i)
           where (fact->>i)::numeric <> trunc((fact->>i)::numeric)
         )
         or (fact->>0)::numeric not between 0 and 4
         or (fact->>2)::numeric not between -1 and jsonb_array_length(v_dimensions->'managers') - 1
         or (fact->>3)::numeric not between -1 and jsonb_array_length(v_dimensions->'owners') - 1
         or (fact->>4)::numeric not between -1 and jsonb_array_length(v_dimensions->'companies') - 1
         or (fact->>5)::numeric not between 0 and 1
         or (fact->>6)::numeric not between -1 and jsonb_array_length(v_dimensions->'developments') - 1
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
      group by jsonb_build_array(fact->0, fact->1, fact->2, fact->3, fact->4, fact->5, fact->6)
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

alter function public.ingest_crm_salesforce_snapshot(jsonb)
  rename to ingest_crm_salesforce_snapshot_v2_internal;
alter function public.ingest_crm_salesforce_snapshot_v2_internal(jsonb) set schema private;
revoke all on function private.ingest_crm_salesforce_snapshot_v2_internal(jsonb)
  from public, anon, authenticated, service_role;

create function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
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
          'version', 1,
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
