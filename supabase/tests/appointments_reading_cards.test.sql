begin;
select plan(22);

create function pg_temp.reading_card(p_id text, p_metric text, p_order integer default 0)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', p_id, 'metric', p_metric, 'type', 'bars', 'period', 'month',
    'groupBy', 'entity', 'entityIds', null,
    'layout', jsonb_build_object('order', p_order, 'columnSpan', 6, 'height', 500)
  );
$$;
create function pg_temp.reading_many(p_count integer)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(pg_temp.reading_card('card-' || n, 'appointments.total', n) order by n), '[]'::jsonb)
  from generate_series(0, p_count - 1) n;
$$;
create temporary table reading_documents (original jsonb, expanded jsonb);
insert into reading_documents (original) values (
  jsonb_build_array(
    jsonb_set(pg_temp.reading_card('original-kpi', 'appointments.total', 0), '{layout}',
      '{"order":0,"columnSpan":2,"height":194,"width":194}')
      || '{"title":"Meu título","presentation":{"fontScale":1.2,"textAlign":"left","accentColor":"#abcdef","barMaxHeight":64}}'::jsonb,
    pg_temp.reading_card('original-recency', 'recency.15-plus-days', 6),
    pg_temp.reading_card('original-monthly', 'appointments.monthly', 8),
    jsonb_set(pg_temp.reading_card('original-details', 'appointments.details', 10), '{layout}',
      '{"order":10,"columnSpan":12,"height":450,"width":1200}')
  )
);
update reading_documents set expanded = private.expand_appointments_reading_cards(original);

select lives_ok($$select private.assert_dashboard_profile_document('crm.stage.appointments',
  jsonb_build_array(pg_temp.reading_card('pdv', 'ranking.pdv')))$$, 'PDV metric accepted in appointments');
select lives_ok($$select private.assert_dashboard_profile_document('crm.stage.appointments',
  jsonb_build_array(pg_temp.reading_card('development', 'ranking.development')))$$, 'development metric accepted in appointments');
select lives_ok($$select private.assert_dashboard_profile_document('crm.stage.appointments',
  jsonb_build_array(pg_temp.reading_card('overdue', 'appointments.overdue')))$$, 'overdue metric accepted in appointments');
select throws_ok($$select private.assert_dashboard_profile_document('crm.dashboard',
  jsonb_build_array(pg_temp.reading_card('pdv', 'ranking.pdv')))$$,
  '22023', 'invalid_argument: metric unavailable for dashboard page', 'PDV rejected in overview');
select throws_ok($$select private.assert_dashboard_profile_document('crm.dashboard',
  jsonb_build_array(pg_temp.reading_card('development', 'ranking.development')))$$,
  '22023', 'invalid_argument: metric unavailable for dashboard page', 'development rejected in overview');
select throws_ok($$select private.assert_dashboard_profile_document('crm.dashboard',
  jsonb_build_array(pg_temp.reading_card('overdue', 'appointments.overdue')))$$,
  '22023', 'invalid_argument: metric unavailable for dashboard page', 'overdue rejected in overview');
select is((select jsonb_array_length(expanded) from reading_documents), 7, 'three missing cards added');
select is((select jsonb_agg(c->>'metric' order by ordinality)
  from reading_documents, jsonb_array_elements(expanded) with ordinality t(c, ordinality)),
  '["appointments.total","recency.15-plus-days","ranking.pdv","ranking.development","appointments.monthly","appointments.details","appointments.overdue"]'::jsonb,
  'rankings follow last recency and overdue follows details');
select is((select jsonb_agg(c#>'{layout,order}' order by ordinality)
  from reading_documents, jsonb_array_elements(expanded) with ordinality t(c, ordinality)),
  '[0,1,2,3,4,5,6]'::jsonb, 'orders reindexed within the existing limit');
select is((select jsonb_agg(c #- '{layout,order}' order by ordinality)
  from reading_documents, jsonb_array_elements(expanded) with ordinality t(c, ordinality)
  where c->>'id' like 'original-%'),
  (select jsonb_agg(c #- '{layout,order}' order by ordinality)
  from reading_documents, jsonb_array_elements(original) with ordinality t(c, ordinality)),
  'all original IDs, dimensions, content and presentation preserved');
select is((select private.expand_appointments_reading_cards(expanded) from reading_documents),
  (select expanded from reading_documents), 'expansion idempotent');
select is((select jsonb_agg((c->'layout') - 'order' order by ordinality)
  from reading_documents, jsonb_array_elements(expanded) with ordinality t(c, ordinality)
  where c->>'id' not like 'original-%'),
  '[{"columnSpan":6,"height":500},{"columnSpan":6,"height":500},{"columnSpan":12,"height":500}]'::jsonb,
  'new cards have requested size without persisted pixel width');
select is(jsonb_array_length(private.expand_appointments_reading_cards('[]')), 3,
  'missing anchors fall back to the document end, including an empty profile');
select is((select c->>'id' from jsonb_array_elements(private.expand_appointments_reading_cards(
  jsonb_build_array(pg_temp.reading_card('ranking-pdv', 'appointments.total')))) c
  where c->>'metric' = 'ranking.pdv'), 'ranking-pdv-1', 'ID collision does not replace an original');
select is((select count(*) from jsonb_array_elements(private.expand_appointments_reading_cards(
  jsonb_build_array(pg_temp.reading_card('my-pdv', 'ranking.pdv')))) c
  where c->>'metric' = 'ranking.pdv'), 1::bigint, 'existing metric with custom ID not duplicated');
select is(jsonb_array_length(private.expand_appointments_reading_cards(pg_temp.reading_many(47))), 50,
  'exactly fifty cards remains valid');
select throws_ok($$select private.expand_appointments_reading_cards(pg_temp.reading_many(48))$$,
  '22023', 'invalid_argument: appointments expansion exceeds card limit',
  'overflow fails without truncating or deleting cards');
select throws_ok($$select private.expand_appointments_reading_cards(
  jsonb_build_array(pg_temp.reading_card('oversize', 'appointments.total')
    || jsonb_build_object('title', repeat('x', 524289))))$$,
  '22023', 'invalid_argument: invalid dashboard cards', 'byte overflow rejected');
select ok(not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name)
  where has_function_privilege(name, 'private.expand_appointments_reading_cards(jsonb)', 'EXECUTE')),
  'expansion helper unavailable to API roles');
select ok(not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name)
  where has_function_privilege(name, 'private.assert_dashboard_profile_document_v2(text,jsonb)', 'EXECUTE')),
  'existing base validator ACL remains private');
select ok((select not prosecdef and provolatile = 's' and proconfig @> array['search_path=""']
  from pg_proc where oid = 'private.expand_appointments_reading_cards(jsonb)'::regprocedure),
  'helper uses invoker, stable execution and an empty search path');
select ok(not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name)
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) privileges(name)
  where has_table_privilege(roles.name, 'public.dashboard_profiles', privileges.name)),
  'profile table direct grants remain absent');

select * from finish();
rollback;
