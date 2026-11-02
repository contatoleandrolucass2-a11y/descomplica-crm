begin;
select plan(18);

-- Historical implementation copied verbatim from the applied 20261025180000 migration.
create function pg_temp.appointments_projection_baseline(
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
      where (p_can_rank or v_key not in ('developments','stores'))
        and exists (select 1 from jsonb_array_elements(v_facts) f
          where (f->>v_position)::int = labels.ordinality - 1)
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

create function pg_temp.projection_fixture(p_rows int, p_labels int, p_sparse boolean default false)
returns jsonb language sql as $$
  with labels as (
    select jsonb_agg('Synthetic label ' || i order by i) as entries
    from generate_series(0,p_labels-1) i
  ), facts as (
    select coalesce(jsonb_agg(jsonb_build_array(
      i%5, (date '2026-01-01'+(i%28))::text,
      case when p_sparse and i%7=0 then -1 else (i/p_labels)%p_labels end,
      i%p_labels, (i/(p_labels*p_labels))%p_labels, i%2, (i*11)%p_labels,
      1, case when i%5=4 then 100 else 0 end,
      case when i%5=3 and i%2=1 then 1 else 0 end,
      case when i%5=1 then i%p_labels else -1 end
    ) order by i),'[]'::jsonb) as entries from generate_series(0,p_rows-1) i
  )
  select jsonb_build_object(
    'version',4,'viewKey','all','coverageStart','2026-01-01','referenceDate','2026-10-31',
    'brokerCount',p_labels,'brokerManagerCount',p_labels,
    'dimensions',jsonb_build_object('managers',labels.entries,'owners',labels.entries,
      'companies',labels.entries,'developments',labels.entries,'stores',labels.entries),
    'facts',facts.entries,
    'appointments',jsonb_build_array(jsonb_build_object(
      'createdAt','2026-01-02T12:00:00.000Z','scheduledAt',null,'attendedAt',null,
      'visitPerformed',false,'regionalManager','Synthetic regional',
      'salesManager','Synthetic label 0','owner','Synthetic label 0',
      'accountName','Protected synthetic account','accountRanking','Synthetic classification',
      'channel',1,'company','Synthetic label 0','registeredBroker',true))
  ) from labels cross join facts;
$$;
create function pg_temp.projection_error(p_baseline boolean,p_payload jsonb) returns text
language plpgsql as $$
begin
  if p_baseline then perform pg_temp.appointments_projection_baseline(p_payload,true);
  else perform private.project_crm_appointments_analysis(p_payload,true); end if;
  return 'no_error';
exception when others then return sqlstate;
end;
$$;

-- Compare the complete JSONB object, including tuple ordering and masked operations.
select is(private.project_crm_appointments_analysis(payload,can_rank),
  pg_temp.appointments_projection_baseline(payload,can_rank),label)
from (values
 (pg_temp.projection_fixture(300,30),true,'ranking view is exactly equivalent'),
 (pg_temp.projection_fixture(300,30),false,'masked view is exactly equivalent'),
 (jsonb_set(pg_temp.projection_fixture(300,30),'{facts}',
   (select jsonb_agg(f order by n desc) from jsonb_array_elements(pg_temp.projection_fixture(300,30)->'facts') with ordinality a(f,n))),true,'shuffled ranking view is equivalent'),
 (jsonb_set(pg_temp.projection_fixture(300,30),'{facts}',
   (select jsonb_agg(f order by n desc) from jsonb_array_elements(pg_temp.projection_fixture(300,30)->'facts') with ordinality a(f,n))),false,'shuffled masked view is equivalent'),
 (pg_temp.projection_fixture(0,30),true,'empty ranking facts stay empty'),
 (pg_temp.projection_fixture(0,30),false,'empty masked facts stay empty'),
 (pg_temp.projection_fixture(300,30,true),true,'sparse and minus-one ranking indices remain equivalent'),
 (pg_temp.projection_fixture(300,30,true),false,'sparse and minus-one masked indices remain equivalent')
) cases(payload,can_rank,label);
select is(private.project_crm_appointments_analysis(payload,true),
  pg_temp.appointments_projection_baseline(payload,true),'version '||version||' fallback is unchanged')
from (select version,jsonb_set(pg_temp.projection_fixture(50,5),'{version}',to_jsonb(version)) as payload
  from generate_series(2,3) version) versions;
select is(pg_temp.projection_error(true,payload)||'/'||pg_temp.projection_error(false,payload),
  '22023/22023',label)
from (
 select jsonb_set(pg_temp.projection_fixture(1,1),'{facts}',
   jsonb_build_array(jsonb_set(fact,array[field_index::text],to_jsonb(bound)),
     jsonb_set(fact,array[field_index::text],to_jsonb(bound)))) as payload,label
 from (select pg_temp.projection_fixture(1,1)#>'{facts,0}' as fact) fixture
 cross join (values (7,1000000000::numeric,'count overflow remains rejected'),
   (8,1000000000000000::numeric,'amount overflow remains rejected'),
   (9,1000000000::numeric,'approved-count overflow remains rejected')) limits(field_index,bound,label)
) overflow_cases;
select ok(not has_function_privilege(role_name,'private.project_crm_appointments_analysis(jsonb,boolean)','execute'),
  role_name||' cannot bypass the authorized public RPC through the replaced projector')
from unnest(array['anon','authenticated','service_role']) role_name;
select is((select provolatile::text from pg_proc where oid='private.project_crm_appointments_analysis(jsonb,boolean)'::regprocedure),
  's','the projector remains stable');
select ok(not (select prosecdef from pg_proc where oid='private.project_crm_appointments_analysis(jsonb,boolean)'::regprocedure),
  'the projector does not acquire definer privileges');
select * from finish();
rollback;
