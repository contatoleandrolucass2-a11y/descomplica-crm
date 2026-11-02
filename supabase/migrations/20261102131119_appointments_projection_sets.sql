begin;

-- Match dictionary positions against one set of used fact indices per dimension.
-- Keep all intermediate/final ordering, numeric aggregation, version fallback,
-- account masking and the permission-checked public RPC unchanged.
create or replace function private.project_crm_appointments_analysis(
  p_payload jsonb, p_can_rank boolean
)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_payload jsonb := p_payload;
  v_facts jsonb;
  v_dictionary jsonb;
  v_mapping jsonb;
  v_key text;
  v_position int;
begin
  if p_payload->'version' is distinct from '4'::jsonb then
    return private.project_crm_appointments_analysis_v3_base(p_payload, p_can_rank);
  end if;
  select coalesce(jsonb_agg(f order by f), '[]'::jsonb) into v_facts
  from jsonb_array_elements(p_payload->'facts') f
  where (f->>0)::int in (0,1,2,3,4);
  for v_key, v_position in select * from (values
    ('managers',2),('owners',3),('companies',4),('developments',6),('stores',10)
  ) d(key,position) loop
    select coalesce(jsonb_agg(label order by original), '[]'::jsonb),
      coalesce(jsonb_object_agg(original,new_index), '{}'::jsonb)
      into v_dictionary,v_mapping
    from (
      select labels.label, labels.ordinality - 1 as original,
        row_number() over (order by labels.ordinality) - 1 as new_index
      from jsonb_array_elements(p_payload#>array['dimensions',v_key])
        with ordinality labels(label,ordinality)
      join (
        select distinct (f->>v_position)::int as original
        from jsonb_array_elements(v_facts) f
      ) used on used.original = labels.ordinality - 1
      where (p_can_rank or v_key not in ('developments','stores'))
    ) relevant;
    v_payload := jsonb_set(v_payload, array['dimensions',v_key], v_dictionary);
    select coalesce(jsonb_agg(jsonb_set(f, array[v_position::text],
      coalesce(v_mapping->(f->>v_position), '-1'::jsonb)) order by f), '[]'::jsonb)
      into v_facts from jsonb_array_elements(v_facts) f;
  end loop;
  select coalesce(jsonb_agg(g.key || jsonb_build_array(g.count,g.amount,g.approved,g.store)
    order by g.key,g.store), '[]'::jsonb)
  into v_facts
  from (
    select jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6) as key,
      f->10 as store,
      sum((f->>7)::numeric) as count,
      sum((f->>8)::numeric) as amount,
      sum((f->>9)::numeric) as approved
    from jsonb_array_elements(v_facts) f
    group by jsonb_build_array(f->0,f->1,f->2,f->3,f->4,f->5,f->6),f->10
  ) g;
  if exists (select 1 from jsonb_array_elements(v_facts) f
    where (f->>7)::numeric > 1000000000
       or (f->>8)::numeric > 1000000000000000
       or (f->>9)::numeric > 1000000000) then
    raise exception 'dashboard analysis aggregate exceeds contract bounds' using errcode = '22023';
  end if;
  v_payload := jsonb_set(v_payload, '{facts}', v_facts);
  if not p_can_rank then
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

commit;
