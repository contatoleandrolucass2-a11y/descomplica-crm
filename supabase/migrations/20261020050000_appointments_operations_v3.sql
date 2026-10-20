-- Operational appointment details v3. Existing v1/v2 snapshots remain readable.
alter table public.crm_dashboard_analysis drop constraint crm_dashboard_analysis_payload_view;
alter table public.crm_dashboard_analysis add constraint crm_dashboard_analysis_payload_view
  check (jsonb_typeof(payload) = 'object'
    and (payload->>'viewKey') is not distinct from view_key
    and payload->'version' is not null
    and payload->'version' in ('1'::jsonb, '2'::jsonb, '3'::jsonb));

alter function private.validate_crm_dashboard_analysis(jsonb,text)
  rename to validate_crm_dashboard_analysis_v2_base;

create function private.validate_crm_dashboard_analysis(p_analysis jsonb, p_reference_date text)
returns void language plpgsql set search_path = '' as $$
declare
  v_base jsonb;
  v_view jsonb;
  v_row jsonb;
  v_key text;
  v_value jsonb;
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if jsonb_typeof(p_analysis) is distinct from 'object'
     or p_analysis->'version' is distinct from '3'::jsonb then
    perform private.validate_crm_dashboard_analysis_v2_base(p_analysis, p_reference_date);
    return;
  end if;
  if not (p_analysis ?& array['version','coverageStart','referenceDate','brokerCount','views'])
     or p_analysis - array['version','coverageStart','referenceDate','brokerCount','views'] <> '{}'::jsonb
     or jsonb_typeof(p_analysis->'brokerCount') is distinct from 'number'
     or (p_analysis->>'brokerCount')::numeric <> trunc((p_analysis->>'brokerCount')::numeric)
     or (p_analysis->>'brokerCount')::numeric not between 0 and 1000000 then
    raise exception 'invalid dashboard analysis' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'version', 2,
    'coverageStart', p_analysis->'coverageStart',
    'referenceDate', p_analysis->'referenceDate',
    'views', coalesce(jsonb_agg(value - 'appointments' order by value->>'viewKey'), '[]'::jsonb)
  ) into v_base from jsonb_array_elements(p_analysis->'views');
  perform private.validate_crm_dashboard_analysis_v2_base(v_base, p_reference_date);

  for v_view in select value from jsonb_array_elements(p_analysis->'views') loop
    if not (v_view ? 'appointments')
       or v_view - array['viewKey','dimensions','facts','appointments'] <> '{}'::jsonb
       or jsonb_typeof(v_view->'appointments') is distinct from 'array'
       or jsonb_array_length(v_view->'appointments') > 20000 then
      raise exception 'invalid dashboard analysis' using errcode = '22023';
    end if;
    for v_row in select value from jsonb_array_elements(v_view->'appointments') loop
      if jsonb_typeof(v_row) is distinct from 'object'
         or not (v_row ?& array['createdAt','scheduledAt','attendedAt','visitPerformed',
           'regionalManager','salesManager','owner','accountName','accountRanking'])
         or v_row - array['createdAt','scheduledAt','attendedAt','visitPerformed',
           'regionalManager','salesManager','owner','accountName','accountRanking'] <> '{}'::jsonb
         or jsonb_typeof(v_row->'createdAt') is distinct from 'string'
         or jsonb_typeof(v_row->'visitPerformed') is distinct from 'boolean'
         or (v_row->'scheduledAt' <> 'null'::jsonb
           and jsonb_typeof(v_row->'scheduledAt') is distinct from 'string')
         or (v_row->'attendedAt' <> 'null'::jsonb
           and jsonb_typeof(v_row->'attendedAt') is distinct from 'string') then
        raise exception 'invalid dashboard analysis' using errcode = '22023';
      end if;
      if (v_row->>'createdAt')::timestamptz at time zone 'America/Sao_Paulo'
           not between (p_analysis->>'coverageStart')::date
             and (p_analysis->>'referenceDate')::date + interval '1 day' - interval '1 microsecond'
         or (v_row->'scheduledAt' <> 'null'::jsonb
           and (v_row->>'scheduledAt')::timestamptz is null)
         or (v_row->'attendedAt' <> 'null'::jsonb
           and (v_row->>'attendedAt')::timestamptz is null) then
        raise exception 'invalid dashboard analysis' using errcode = '22023';
      end if;
      foreach v_key in array array['regionalManager','salesManager','owner','accountName','accountRanking'] loop
        v_value := v_row->v_key;
        if jsonb_typeof(v_value) is distinct from 'string'
           or length(v_value #>> '{}') > 200
           or (v_value #>> '{}') is distinct from btrim(v_value #>> '{}', v_whitespace) then
          raise exception 'invalid dashboard analysis' using errcode = '22023';
        end if;
      end loop;
    end loop;
  end loop;
exception when data_exception then
  raise exception 'invalid dashboard analysis' using errcode = '22023';
end;
$$;
alter function private.validate_crm_dashboard_analysis(jsonb,text) owner to postgres;
revoke all on function private.validate_crm_dashboard_analysis(jsonb,text)
  from public, anon, authenticated, service_role;
revoke all on function private.validate_crm_dashboard_analysis_v2_base(jsonb,text)
  from public, anon, authenticated, service_role;

create or replace function private.project_crm_appointments_analysis(p_payload jsonb, p_can_rank boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_payload jsonb := p_payload;
  v_facts jsonb;
  v_dictionary jsonb;
  v_mapping jsonb;
  v_key text;
  v_position int;
  v_store boolean := p_payload->'version' in ('2'::jsonb, '3'::jsonb);
begin
  select coalesce(jsonb_agg(f order by f), '[]'::jsonb) into v_facts
  from jsonb_array_elements(p_payload->'facts') f where f->0 = '1'::jsonb;
  for v_key, v_position in select * from (values
    ('managers',2),('owners',3),('companies',4),('developments',6),('stores',10)
  ) d(key,position) loop
    if v_key = 'stores' and not v_store then continue; end if;
    select coalesce(jsonb_agg(label order by original), '[]'::jsonb),
      coalesce(jsonb_object_agg(original::text, new_index), '{}'::jsonb)
    into v_dictionary, v_mapping
    from (
      select labels.label, labels.ordinality - 1 as original,
        row_number() over (order by labels.ordinality) - 1 as new_index
      from jsonb_array_elements(p_payload#>array['dimensions',v_key])
        with ordinality labels(label,ordinality)
      where (p_can_rank or v_key not in ('developments','stores'))
        and exists (select 1 from jsonb_array_elements(v_facts) f
          where (f->>v_position)::int = labels.ordinality - 1)
    ) relevant;
    v_payload := jsonb_set(v_payload, array['dimensions',v_key], v_dictionary);
    select coalesce(jsonb_agg(jsonb_set(f, array[v_position::text],
      coalesce(v_mapping->(f->>v_position), '-1'::jsonb)) order by f), '[]'::jsonb)
      into v_facts from jsonb_array_elements(v_facts) f;
  end loop;
  select coalesce(jsonb_agg(g.key || jsonb_build_array(g.count,g.amount,g.approved)
    || case when v_store then jsonb_build_array(g.store) else '[]'::jsonb end order by g.key,g.store), '[]'::jsonb)
  into v_facts
  from (
    select jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6) as key,
      f->10 as store, sum((f->>7)::numeric) as count,
      sum((f->>8)::numeric) as amount, sum((f->>9)::numeric) as approved
    from jsonb_array_elements(v_facts) f
    group by jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6),f->10
  ) g;
  if exists (select 1 from jsonb_array_elements(v_facts) f
    where (f->>7)::numeric > 1000000000 or (f->>8)::numeric > 1000000000000000) then
    raise exception 'dashboard analysis aggregate exceeds contract bounds' using errcode = '22023';
  end if;
  v_payload := jsonb_set(v_payload, '{facts}', v_facts);
  if p_payload->'version' = '3'::jsonb and not p_can_rank then
    select jsonb_set(v_payload, '{appointments}', coalesce(jsonb_agg(
      jsonb_set(jsonb_set(row, '{accountName}', '""'::jsonb),
        '{accountRanking}', '""'::jsonb) order by row->>'createdAt'
    ), '[]'::jsonb)) into v_payload
    from jsonb_array_elements(v_payload->'appointments') row;
  end if;
  return v_payload;
end;
$$;
alter function private.project_crm_appointments_analysis(jsonb,boolean) owner to postgres;
revoke all on function private.project_crm_appointments_analysis(jsonb,boolean)
  from public, anon, authenticated, service_role;

create or replace function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_dashboard jsonb := p_payload->'dashboard';
  v_analysis jsonb := v_dashboard->'analysis';
  v_result jsonb;
  v_snapshot_id bigint;
begin
  v_result := private.ingest_crm_salesforce_snapshot_v2_internal(
    p_payload #- '{dashboard,analysis}'
  );
  if coalesce((v_result->>'ok')::boolean, false)
     and not coalesce((v_result->>'idempotent')::boolean, false) then
    select id into v_snapshot_id from public.crm_dashboard_snapshots
     where snapshot_key = v_dashboard->>'snapshotKey'
       and reference_date = (v_dashboard->>'referenceDate')::date
       and generated_at = (v_dashboard->>'generatedAt')::timestamptz;
    if not found then
      raise exception 'dashboard analysis snapshot mismatch' using errcode = '22023';
    end if;
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
        ) || case when v_analysis->'version' = '3'::jsonb
          then jsonb_build_object('brokerCount', v_analysis->'brokerCount')
          else '{}'::jsonb end || view
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
