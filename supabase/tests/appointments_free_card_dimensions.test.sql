begin;
select plan(13);

create function pg_temp.free_card_dimensions(p_layout jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'id', 'pixel-card', 'type', 'kpi', 'metric', 'visits.total',
    'period', 'month', 'groupBy', 'day', 'entityIds', null, 'layout', p_layout
  ));
$$;

select lives_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":128}'
  ))$$, 'appointments accepts the minimum pixel dimensions');
select lives_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":12,"height":16384,"width":16384}'
  ))$$, 'appointments accepts bounded maximum pixel dimensions');
select lives_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":2,"height":288}'
  ))$$, 'legacy schema v2 cards remain valid without width');

select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":127}'
  ))$$, '22023', 'invalid_argument: invalid dashboard card width', 'width below the technical minimum is rejected');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":71,"width":128}'
  ))$$, '22023', 'invalid_argument: invalid dashboard card layout', 'height below the technical minimum is rejected');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":128.5}'
  ))$$, '22023', 'invalid_argument: invalid dashboard card width', 'fractional pixel width is rejected');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":16385}'
  ))$$, '22023', 'invalid_argument: invalid dashboard card width', 'unbounded pixel width is rejected');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":128,"unexpected":1}'
  ))$$, '22023', 'invalid_argument: invalid dashboard card layout', 'unknown layout fields remain rejected');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', jsonb_set(pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":128}'
  ), '{0,metric}', '"finance.revenue"'))$$,
  '22023', 'invalid_argument: metric unavailable for dashboard page', 'pixel layout cannot escape the appointments catalog');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.stage.appointments', jsonb_set(pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72,"width":128}'
  ), '{0,presentation}', '{"fontScale":9}'))$$,
  '22023', 'invalid_argument: invalid dashboard card presentation', 'presentation validation is preserved');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.dashboard', jsonb_set(pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":2,"height":168,"width":128}'
  ), '{0,metric}', '"overview.current.month"'))$$,
  '22023', 'invalid_argument: invalid dashboard card layout', 'other pages reject pixel width');
select throws_ok($$select private.assert_dashboard_profile_document(
  'crm.dashboard', jsonb_set(pg_temp.free_card_dimensions(
    '{"order":0,"columnSpan":1,"height":72}'
  ), '{0,metric}', '"overview.current.month"'))$$,
  '22023', 'invalid_argument: dashboard card layout outside type limits', 'other pages retain their type minimums');

select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) actor(name)
  cross join (values
    ('private.assert_dashboard_profile_document(text,jsonb)'),
    ('private.assert_dashboard_profile_document_presentation_v2(text,jsonb)')
  ) validator(name)
  where has_function_privilege(actor.name, validator.name, 'EXECUTE')
), 'the new and previous private validators remain inaccessible to API roles');

select * from finish();
rollback;
