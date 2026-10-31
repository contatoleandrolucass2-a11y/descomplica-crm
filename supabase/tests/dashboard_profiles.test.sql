begin;

select plan(46);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.dashboard_profiles'::regclass),
  'dashboard profiles enable and force RLS'
);
select is(
  (select count(*) from pg_policy where polrelid = 'public.dashboard_profiles'::regclass),
  2::bigint,
  'owner and restrictive MFA policies are installed'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) role_name(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privilege(name)
  where has_table_privilege(role_name.name, 'public.dashboard_profiles', privilege.name)
), 'API roles have no direct table privileges');
select ok(
  has_function_privilege('authenticated', 'public.get_dashboard_profiles(text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_dashboard_profile(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.create_dashboard_profile(text,text,text,jsonb,smallint,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.update_dashboard_profile(uuid,bigint,text,jsonb,smallint)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.delete_dashboard_profile(uuid,bigint)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_default_dashboard_profile(uuid,bigint)', 'EXECUTE'),
  'authenticated enters only guarded profile RPCs'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('service_role')) role_name(name)
  cross join (values
    ('public.get_dashboard_profiles(text,text)'),
    ('public.get_dashboard_profile(uuid)'),
    ('public.create_dashboard_profile(text,text,text,jsonb,smallint,boolean)'),
    ('public.update_dashboard_profile(uuid,bigint,text,jsonb,smallint)'),
    ('public.delete_dashboard_profile(uuid,bigint)'),
    ('public.set_default_dashboard_profile(uuid,bigint)')
  ) function_name(name)
  where has_function_privilege(role_name.name, function_name.name, 'EXECUTE')
), 'anon and service role cannot execute dashboard profile RPCs');
select ok(
  (select proc.prosecdef and owner.rolname = 'postgres'
    and proc.proconfig @> array['search_path=""', 'statement_timeout=10s', 'lock_timeout=5s']
   from pg_proc proc join pg_roles owner on owner.oid = proc.proowner
   where proc.oid = 'public.update_dashboard_profile(uuid,bigint,text,jsonb,smallint)'::regprocedure),
  'update keeps its trusted owner, security definer and bounded execution settings'
);
select ok(
  not has_function_privilege('authenticated', 'private.assert_dashboard_profile_read_context(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.assert_dashboard_profile_context(uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.assert_dashboard_profile_document(text,jsonb)', 'EXECUTE'),
  'private validators are not callable by browser roles'
);
select is(
  (
    select proc.provolatile::text
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'private'
      and proc.proname = 'assert_dashboard_profile_document'
      and pg_get_function_identity_arguments(proc.oid) = 'p_page_key text, p_cards jsonb'
  ),
  's',
  'document validator is stable because its normalized signature uses stable text functions'
);

insert into auth.users (id, email) values
  ('ad810000-0000-4000-8000-000000000001', 'dashboard-profile-one@example.test'),
  ('ad810000-0000-4000-8000-000000000002', 'dashboard-profile-two@example.test');
select public.bootstrap_master_user('ad810000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id, aal, not_after)
values
  (
    'ad860000-0000-4000-8000-000000000001',
    'ad810000-0000-4000-8000-000000000001',
    'aal1',
    now() + interval '1 hour'
  ),
  (
    'ad860000-0000-4000-8000-000000000002',
    'ad810000-0000-4000-8000-000000000002',
    'aal1',
    now() + interval '1 hour'
  );
insert into public.crm_organizations (id, organization_key, name, kind)
values (
  'ad820000-0000-4000-8000-000000000001',
  'dashboard-profiles-test',
  'Synthetic Dashboard Profiles',
  'house'
);
insert into public.crm_teams (id, organization_id, team_key, name)
values (
  'ad830000-0000-4000-8000-000000000001',
  'ad820000-0000-4000-8000-000000000001',
  'dashboard-profiles-test',
  'Synthetic Dashboard Profiles'
);
insert into public.crm_people (id, person_key, display_name, auth_user_id)
values (
  'ad850000-0000-4000-8000-000000000001',
  'dashboard-profiles-broker',
  'Synthetic Dashboard Broker',
  'ad810000-0000-4000-8000-000000000002'
);
insert into public.crm_team_memberships (
  team_id, person_id, membership_role, valid_from, valid_until
)
values (
  'ad830000-0000-4000-8000-000000000001',
  'ad850000-0000-4000-8000-000000000001',
  'broker',
  clock_timestamp() - interval '1 minute',
  clock_timestamp() + interval '1 day'
);
insert into public.crm_reporting_scopes (id, scope_key, scope_type, person_id)
values (
  'ad840000-0000-4000-8000-000000000001',
  'dashboard-profiles-broker',
  'person',
  'ad850000-0000-4000-8000-000000000001'
);
insert into public.crm_user_reporting_scope_grants (
  user_id, reporting_scope_id, granted_by, reason
) values (
  'ad810000-0000-4000-8000-000000000002',
  'ad840000-0000-4000-8000-000000000001',
  'ad810000-0000-4000-8000-000000000001',
  'Synthetic dashboard profile isolation fixture'
);
update public.user_roles
set role_key = 'broker_house', assigned_by = 'ad810000-0000-4000-8000-000000000001'
where user_id = 'ad810000-0000-4000-8000-000000000002';
update public.profiles
set is_active = true, access_status = 'approved', approved_at = clock_timestamp(),
    approved_by = 'ad810000-0000-4000-8000-000000000001'
where user_id = 'ad810000-0000-4000-8000-000000000002';
insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
) values (
  'ad810000-0000-4000-8000-000000000002',
  'crm.stage.appointments.view',
  'allow',
  'Synthetic dashboard profile isolation fixture',
  'ad810000-0000-4000-8000-000000000001'
);

create function pg_temp.dashboard_cards(p_id text, p_metric text default 'appointments.total')
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object(
    'id', p_id,
    'type', 'bars',
    'metric', p_metric,
    'period', 'month',
    'groupBy', 'day',
    'entityIds', null,
    'layout', jsonb_build_object('order', 0, 'columnSpan', 6, 'height', 360)
  ));
$$;

grant execute on function pg_temp.dashboard_cards(text, text) to authenticated;

-- Capture the PostgreSQL envelope separately from the compatible HTTP body.
create function pg_temp.dashboard_conflict(p_query text)
returns jsonb language plpgsql as $$
declare
  v_state text;
  v_message text;
  v_detail text;
begin
  execute p_query;
  return null;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate,
    v_message = message_text, v_detail = pg_exception_detail;
  return jsonb_build_object('sqlstate', v_state, 'message', v_message, 'detail', v_detail);
end;
$$;
create function pg_temp.expected_dashboard_conflict()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'sqlstate', 'PGRST',
    'message', jsonb_build_object(
      'code', '40001', 'message', 'conflict: dashboard profile version changed',
      'details', null, 'hint', null
    )::text,
    'detail', '{"status":409,"headers":{}}'
  );
$$;
grant execute on function pg_temp.dashboard_conflict(text),
  pg_temp.expected_dashboard_conflict() to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000001","role":"authenticated","session_id":"ad860000-0000-4000-8000-000000000001","aal":"aal1"}',
  true
);

select throws_ok(
  $$select * from public.dashboard_profiles$$,
  '42501',
  'permission denied for table dashboard_profiles',
  'direct table reads cannot bypass the RPC contract'
);
select throws_ok(
  $$select public.get_dashboard_profiles('crm.unknown', null)$$,
  '42501',
  'forbidden: dashboard page unavailable',
  'unknown pages fail closed'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Inválido',
    '[{"id":"bad","type":"pie"}]'::jsonb, 2::smallint, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard card',
  'database validates card shape independently from the API'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Métrica inválida',
    pg_temp.dashboard_cards('bad-metric','finance.revenue'), 2::smallint, false
  )$$,
  '22023',
  'invalid_argument: metric unavailable for dashboard page',
  'database rejects metrics outside the page catalog'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Entidade inválida',
    jsonb_set(pg_temp.dashboard_cards('bad-entity'), '{0,entityIds}', '["manager.untrusted"]'),
    2::smallint, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard card entities',
  'database rejects entity ids outside the page catalog'
);

create temporary table created_profiles (slot text primary key, id uuid not null);
create temporary table conflict_snapshots (slot text primary key, document jsonb not null);
insert into created_profiles
select 'shared', (public.create_dashboard_profile(
  'crm.stage.appointments', null, 'Principal',
  jsonb_set(
    jsonb_set(pg_temp.dashboard_cards('card-1'), '{0,type}', '"kpi"'),
    '{0,layout}', '{"order":0,"columnSpan":2,"height":168}'
  ),
  2::smallint, false
)->>'id')::uuid;

select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', null)),
  1,
  'appointments exposes one shared layout in the requested page scope'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='shared'))->>'isDefault')::boolean,
  true,
  'shared appointments layout becomes default automatically'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared'))->>'schemaVersion',
  '2',
  'schema version 2 persists with a KPI at the 168px minimum'
);
select is(
  public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Alternativo',
    pg_temp.dashboard_cards('card-2','appointments.rate'), 2::smallint, false
  )->>'id',
  (select id::text from created_profiles where slot='shared'),
  'a second administrator reuses the shared appointments layout'
);
select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='shared'), 1, 'Principal novo', null, null
  )->>'version',
  '2',
  'matching optimistic version updates and increments version'
);
insert into conflict_snapshots
select 'stale', public.get_dashboard_profile((select id from created_profiles where slot='shared'));
select is(
  pg_temp.dashboard_conflict(format(
    'select public.update_dashboard_profile(%L::uuid, 1, %L, null, null)',
    (select id from created_profiles where slot='shared'), 'Obsoleto'
  )),
  pg_temp.expected_dashboard_conflict(),
  'stale appointments PATCH uses PGRST with compatible body and HTTP 409 detail'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared')),
  (select document from conflict_snapshots where slot='stale'),
  'stale PATCH leaves the complete saved document, version and timestamps unchanged'
);
select is(
  public.set_default_dashboard_profile(
    (select id from created_profiles where slot='shared'), 2
  )->>'version',
  '3',
  'set-default increments the selected profile version'
);
select is(
  (public.get_dashboard_profile((select id from created_profiles where slot='shared'))->>'isDefault')::boolean,
  true,
  'shared layout remains the only default'
);
select throws_ok(
  format(
    'select public.delete_dashboard_profile(%L::uuid, 2)',
    (select id from created_profiles where slot='shared')
  ),
  '40001',
  'conflict: dashboard profile version changed',
  'stale DELETE version fails with a conflict'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000002","role":"authenticated","session_id":"ad860000-0000-4000-8000-000000000002","aal":"aal1"}',
  true
);
select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', null)),
  1,
  'an authorized viewer reads the shared appointments layout'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared'))->>'id',
  (select id::text from created_profiles where slot='shared'),
  'an authorized viewer can address the shared layout by id'
);
insert into conflict_snapshots
select 'viewer', public.get_dashboard_profile((select id from created_profiles where slot='shared'));
select throws_ok(
  format('select public.update_dashboard_profile(%L::uuid, 3, %L, null, null)',
    (select id from created_profiles where slot='shared'), 'Denied update'),
  '42501',
  'forbidden: appointments dashboard editing requires administrator',
  'PGRST support does not let a viewer update the shared layout'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared')),
  (select document from conflict_snapshots where slot='viewer'),
  'denied viewer update leaves the complete saved document unchanged'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', null, 'Segundo usuário',
    pg_temp.dashboard_cards('card-user-2'), 2::smallint, false
  )$$,
  '42501',
  'forbidden: appointments dashboard editing requires administrator',
  'a non-administrator cannot create an appointments layout'
);
select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', null)),
  1,
  'the denied write leaves the shared layout unchanged'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ad810000-0000-4000-8000-000000000001","role":"authenticated","session_id":"ad860000-0000-4000-8000-000000000001","aal":"aal1"}',
  true
);
select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='shared'), 3, null,
    jsonb_set(
      jsonb_set(
        jsonb_set(pg_temp.dashboard_cards('card-1'), '{0,type}', '"kpi"'),
        '{0,layout}', '{"order":0,"columnSpan":2,"height":168}'
      ),
      '{0,presentation}',
      '{"fontScale":1.1,"textAlign":"center","verticalAlign":"center","textColor":"#d9e8f2","accentColor":"#55c4dc","barScale":1.2}'
    ),
    2::smallint
  )->>'version',
  '4',
  'administrator persists the shared presentation controls'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared'))
    #>>'{cards,0,presentation,barScale}',
  '1.2',
  'shared presentation is readable after the update'
);
select throws_ok(
  format(
    'select public.update_dashboard_profile(%L::uuid, 4, null, %L::jsonb, 2::smallint)',
    (select id from created_profiles where slot='shared'),
    jsonb_set(
      jsonb_set(
        jsonb_set(pg_temp.dashboard_cards('card-1'), '{0,type}', '"kpi"'),
        '{0,layout}', '{"order":0,"columnSpan":2,"height":168}'
      ),
      '{0,presentation}', '{"fontScale":9}'
    )::text
  ),
  '22023',
  'invalid_argument: invalid dashboard card presentation',
  'database rejects presentation values outside the allowed range'
);
select is(
  jsonb_array_length(public.get_dashboard_profiles('crm.stage.appointments', 'campaign-1')),
  0,
  'scopeKey isolates profiles within the same page'
);
select throws_ok(
  $$select public.create_dashboard_profile(
    'crm.stage.appointments', 'bad scope', 'Inválido', '[]'::jsonb, 2::smallint, false
  )$$,
  '22023',
  'invalid_argument: invalid dashboard profile scope',
  'invalid scopeKey is rejected by the database contract'
);

select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='shared'), 4, null,
    jsonb_set(pg_temp.dashboard_cards('card-1'), '{0,layout}',
      '{"order":0,"columnSpan":1,"height":72,"width":129}'
    ), 2::smallint
  )->>'version',
  '5',
  'administrator persists free dimensions with the existing version comparison'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared'))
    #>'{cards,0,layout}',
  '{"order":0,"columnSpan":1,"height":72,"width":129}'::jsonb,
  'the shared profile round trip preserves exact dimensions without the validation surrogate'
);

-- Fixture-only noncanonical profile exercises the first conflict guard.
reset role;
insert into public.dashboard_profiles (id, user_id, page_key, name, cards)
values (
  'ad870000-0000-4000-8000-000000000001',
  'ad810000-0000-4000-8000-000000000001', 'crm.stage.appointments',
  'Noncanonical fixture', pg_temp.dashboard_cards('noncanonical')
);
insert into conflict_snapshots
select 'noncanonical', jsonb_agg(to_jsonb(profile) order by profile.id)
from public.dashboard_profiles profile;
set local role authenticated;
select is(
  pg_temp.dashboard_conflict($$select public.update_dashboard_profile(
    'ad870000-0000-4000-8000-000000000001'::uuid, 1, 'Rejected', null, null
  )$$),
  pg_temp.expected_dashboard_conflict(),
  'the noncanonical guard uses PGRST with compatible body and HTTP 409 detail'
);
reset role;
select is(
  (select jsonb_agg(to_jsonb(profile) order by profile.id) from public.dashboard_profiles profile),
  (select document from conflict_snapshots where slot='noncanonical'),
  'the canonical guard leaves every profile unchanged'
);
delete from public.dashboard_profiles where id = 'ad870000-0000-4000-8000-000000000001';

-- A test-only trigger suppresses the write to exercise the zero-row CAS guard.
-- This is deterministic guard coverage, not a simulated concurrent transaction.
create function pg_temp.suppress_dashboard_profile_update()
returns trigger language plpgsql as $$ begin return null; end; $$;
create trigger suppress_dashboard_profile_update before update on public.dashboard_profiles
for each row execute function pg_temp.suppress_dashboard_profile_update();
set local role authenticated;
insert into conflict_snapshots
select 'cas', public.get_dashboard_profile((select id from created_profiles where slot='shared'));
select is(
  pg_temp.dashboard_conflict(format('select public.update_dashboard_profile(%L::uuid, 5, %L, null, null)',
    (select id from created_profiles where slot='shared'), 'Suppressed update')),
  pg_temp.expected_dashboard_conflict(),
  'zero-row CAS uses PGRST with compatible body and HTTP 409 detail'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='shared')),
  (select document from conflict_snapshots where slot='cas'),
  'zero-row CAS leaves the complete saved document unchanged'
);
reset role;
drop trigger suppress_dashboard_profile_update on public.dashboard_profiles;
set local role authenticated;
select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='shared'), 5, 'Recovered update', null, null
  )->>'version',
  '6', 'a matching version still saves exactly once after the conflict'
);

insert into created_profiles
select 'legacy', (public.create_dashboard_profile(
  'crm.dashboard', null, 'Legacy fixture',
  jsonb_set(
    jsonb_set(pg_temp.dashboard_cards('legacy', 'overview.current.month'), '{0,type}', '"kpi"'),
    '{0,layout}', '{"order":0,"columnSpan":2,"height":168}'
  ), 2::smallint, false
)->>'id')::uuid;
select is(
  public.update_dashboard_profile(
    (select id from created_profiles where slot='legacy'), 1, 'Legacy updated', null, null
  )->>'version',
  '2', 'other dashboard pages keep their successful update contract'
);
insert into conflict_snapshots
select 'legacy', public.get_dashboard_profile((select id from created_profiles where slot='legacy'));
select throws_ok(
  format('select public.update_dashboard_profile(%L::uuid, 1, %L, null, null)',
    (select id from created_profiles where slot='legacy'), 'Legacy stale'),
  '40001', 'conflict: dashboard profile version changed',
  'other dashboard pages retain the existing 40001 conflict contract'
);
select is(
  public.get_dashboard_profile((select id from created_profiles where slot='legacy')),
  (select document from conflict_snapshots where slot='legacy'),
  'legacy conflict also leaves the saved document unchanged'
);
select public.delete_dashboard_profile((select id from created_profiles where slot='legacy'), 2);

reset role;
select is(
  (select count(*) from public.dashboard_profiles),
  1::bigint,
  'fixture leaves one shared appointments layout before rollback'
);
select is(
  (select count(*) from public.dashboard_profiles where is_default),
  1::bigint,
  'the shared appointments scope has exactly one default'
);

select * from finish();
rollback;
