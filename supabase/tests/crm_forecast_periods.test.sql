begin;
select plan(39);

insert into auth.users (id,email) values
  ('ad910000-0000-4000-8000-000000000001','forecast-periods@example.test'),
  ('ad910000-0000-4000-8000-000000000002','forecast-manager@example.test');
select public.bootstrap_master_user('ad910000-0000-4000-8000-000000000001');

insert into public.crm_organizations (id, organization_key, name, kind)
values (
  'ad920000-0000-4000-8000-000000000001',
  'forecast-periods-test',
  'Synthetic Forecast Periods',
  'house'
);
insert into public.crm_teams (id, organization_id, team_key, name)
values (
  'ad930000-0000-4000-8000-000000000001',
  'ad920000-0000-4000-8000-000000000001',
  'forecast-periods-test',
  'Synthetic Forecast Periods'
);
insert into public.crm_reporting_scopes (id, scope_key, scope_type, team_id)
values (
  'ad960000-0000-4000-8000-000000000001',
  'forecast-periods-team',
  'team',
  'ad930000-0000-4000-8000-000000000001'
);
insert into public.crm_user_reporting_scope_grants (
  user_id,
  reporting_scope_id,
  granted_by,
  reason
)
values (
  'ad910000-0000-4000-8000-000000000002',
  'ad960000-0000-4000-8000-000000000001',
  'ad910000-0000-4000-8000-000000000001',
  'Synthetic forecast period fixture'
);
update public.user_roles
set role_key = 'manager_house', assigned_by = 'ad910000-0000-4000-8000-000000000001'
where user_id = 'ad910000-0000-4000-8000-000000000002';
update public.profiles
set is_active = true, access_status = 'approved', approved_at = now(),
  approved_by = 'ad910000-0000-4000-8000-000000000001'
where user_id = 'ad910000-0000-4000-8000-000000000002';

create function pg_temp.period_doc(value text default '', action_plan text default '') returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'title','Equipe',
    'columns','[{"id":"broker","label":"Nome do corretor"},{"id":"f_one","label":"Empreendimento 1"},{"id":"a_one","label":"Empreendimento 1"},{"id":"action_plan","label":"Plano de ação"}]'::jsonb,
    'rows',jsonb_build_array(jsonb_build_object(
      'id','r1',
      'cells',jsonb_build_object('broker','Corretor 1','f_one',value,'a_one','2','action_plan',action_plan)
    ))
  );
$$;
grant execute on function pg_temp.period_doc(text,text) to authenticated;

create function pg_temp.period_doc_two_groups(value text default '') returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'title','Equipe',
    'columns','[{"id":"broker","label":"Nome do corretor"},{"id":"f_one","label":"Empreendimento 1"},{"id":"a_one","label":"Empreendimento 1"},{"id":"f_two","label":"Empreendimento 2"},{"id":"a_two","label":"Empreendimento 2"},{"id":"action_plan","label":"Plano de ação"}]'::jsonb,
    'rows',jsonb_build_array(jsonb_build_object(
      'id','r1',
      'cells',jsonb_build_object(
        'broker','Corretor 1','f_one',value,'a_one','2',
        'f_two','3','a_two','4','action_plan','Ação'
      )
    ))
  );
$$;
grant execute on function pg_temp.period_doc_two_groups(text) to authenticated;

insert into public.crm_forecasts(singleton,document,revision,updated_at) values (
  true,
  '{"title":"Legado","columns":[{"id":"name","label":"Nome"},{"id":"forecast","label":"Previsão"},{"id":"actual","label":"Realizado"}],"rows":[{"id":"legacy-row","cells":{"name":"Corretor legado","forecast":"99","actual":"88"}}]}',
  1,
  '2026-10-01T12:00:00Z'
);

select ok((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = 'public.crm_forecast_periods'::regclass), 'period forecast RLS is enabled and forced');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(name)
  where has_table_privilege(r.name, 'public.crm_forecast_periods', p.name)
), 'API roles have no direct table privilege');
select ok(has_function_privilege('authenticated','public.get_crm_forecast_period(date,text,text)','EXECUTE')
  and has_function_privilege('authenticated','public.save_crm_forecast_period(date,text,text,jsonb,bigint)','EXECUTE'),
  'authenticated can enter guarded period RPCs');
select ok(not exists (
  select 1 from (values ('anon'), ('service_role')) r(name)
  cross join (values
    ('public.get_crm_forecast_period(date,text,text)'),
    ('public.save_crm_forecast_period(date,text,text,jsonb,bigint)')
  ) f(name)
  where has_function_privilege(r.name, f.name, 'EXECUTE')
), 'anon and service cannot execute period RPCs');
select ok(not has_function_privilege('authenticated',
  'private._internal_validate_crm_forecast_document(jsonb)','EXECUTE'),
  'document validator is private');
select is(
  (
    select count(*)
    from public.role_permissions
    where permission_key in (
      'crm.management.forecast.view',
      'crm.management.forecast.values.edit'
    )
      and role_key in (
        'coordinator','manager_house','manager_imob','broker_house','broker_imob'
      )
  ),
  10::bigint,
  'coordinator, managers and brokers inherit forecast page and value editing'
);
select is((select document#>>'{rows,0,cells,forecast}' from public.crm_forecasts where singleton),
  '99','expand migration does not rewrite legacy singleton');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','',true);
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_crm_forecast_period('2026-10-16','house','amanda')$$,
  '28000','unauthorized: authenticated user required','missing UID cannot read periods');
select throws_ok($$select public.save_crm_forecast_period('2026-10-16','house','amanda',pg_temp.period_doc(),0)$$,
  '28000','unauthorized: authenticated user required','missing UID cannot save periods');

select set_config('request.jwt.claim.sub','ad910000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_crm_forecast_period('2026-10-17','house','amanda')$$,
  '22023','invalid_argument: invalid forecast selection','database requires canonical Friday');
select throws_ok($$select public.get_crm_forecast_period('2026-10-16',null,null)$$,
  '22023','invalid_argument: invalid forecast selection','null segment is rejected explicitly');
select throws_ok($$select public.get_crm_forecast_period('2026-10-16','general','amanda')$$,
  '22023','invalid_argument: invalid forecast selection','general rejects a manager');
select throws_ok($$select public.save_crm_forecast_period('2026-10-16','house',null,pg_temp.period_doc(),0)$$,
  '22023','invalid_argument: invalid forecast selection','null manager is rejected explicitly');
select throws_ok($$select public.save_crm_forecast_period('2026-10-16','house','alvaro',pg_temp.period_doc(),0)$$,
  '22023','invalid_argument: invalid forecast selection','manager must belong to segment');

select is(public.get_crm_forecast_period('2026-10-16','house','amanda')->'forecasts',
  '[]'::jsonb,'new period starts without an invented saved record');
select is(public.get_crm_forecast_period('2026-10-16','house','amanda')#>>'{template,title}',
  'Legado','legacy singleton supplies the initial template');
select is(public.get_crm_forecast_period('2026-10-16','house','amanda')->>'can_edit',
  'true','authorized editor can edit a manager scope');
select is(public.get_crm_forecast_period('2026-10-16','general',null)->>'can_edit',
  'false','general is always read-only');

select is(public.save_crm_forecast_period('2026-10-16','house','amanda',pg_temp.period_doc('1','Ação'),0)->>'revision',
  '1','first scoped save creates revision one');
select is(public.save_crm_forecast_period('2026-10-16','imob','alvaro',pg_temp.period_doc('3'),0)->>'revision',
  '1','another manager has an independent revision');
select is(jsonb_array_length(public.get_crm_forecast_period('2026-10-16','general',null)->'forecasts'),
  2,'general returns every manager document as a separate section');
select is(public.get_crm_forecast_period('2026-10-16','general',null)#>>'{forecasts,0,manager}',
  'amanda','general sections start with House in deterministic manager order');
select is(public.get_crm_forecast_period('2026-10-16','general',null)#>>'{forecasts,1,manager}',
  'alvaro','general sections then contain Imob in deterministic manager order');
select is(public.save_crm_forecast_period('2026-10-16','house','amanda',pg_temp.period_doc_two_groups('4'),1)->>'revision',
  '2','matching CAS updates only the selected manager');
select throws_ok($$select public.save_crm_forecast_period('2026-10-16','imob','alvaro',pg_temp.period_doc('5'),2)$$,
  '40001','conflict: forecast revision changed','CAS conflict is isolated by manager scope');
select is(public.get_crm_forecast_period('2026-10-16','imob','alvaro')#>>'{forecasts,0,forecast,revision}',
  '1','conflict preserves the other manager revision');
select is(public.get_crm_forecast_period('2026-10-23','house','amanda')->'forecasts',
  '[]'::jsonb,'periods are isolated by canonical Friday');
select throws_ok($$select public.save_crm_forecast_period('2026-10-16','house','cleber',pg_temp.period_doc('texto'),0)$$,
  '22023','invalid_argument: invalid forecast','period RPC validates numeric comparison cells itself');
select throws_ok(format(
  'select public.save_crm_forecast_period(''2026-10-16'',''house'',''cleber'',%L::jsonb,0)',
  pg_temp.period_doc('',repeat('A',4001))
), '22023','invalid_argument: invalid forecast','period RPC validates action plan length itself');

select set_config('request.jwt.claim.sub','ad910000-0000-4000-8000-000000000002',true);
select is(public.get_crm_forecast_period('2026-10-16','house','amanda')->>'can_edit',
  'true','manager can edit forecast values');
select is(public.get_crm_forecast_period('2026-10-16','house','amanda')->>'can_manage_structure',
  'false','manager cannot manage forecast structure');
select is(public.save_crm_forecast_period(
  '2026-10-16','house','amanda',pg_temp.period_doc_two_groups('7'),2
)->>'revision','3','manager can save cell values');
select throws_ok(format(
  'select public.save_crm_forecast_period(''2026-10-16'',''house'',''amanda'',%L::jsonb,3)',
  jsonb_set(
    pg_temp.period_doc_two_groups('8'),
    '{rows}',
    pg_temp.period_doc_two_groups('8')->'rows' ||
      jsonb_build_array(jsonb_build_object(
        'id','r2','cells',jsonb_build_object(
          'broker','Corretor 2','f_one','','a_one','','f_two','','a_two','','action_plan',''
        )
      ))
  )
), '42501','forbidden: forecast structure is read only','manager cannot insert rows');
select throws_ok(format(
  'select public.save_crm_forecast_period(''2026-10-16'',''house'',''amanda'',%L::jsonb,3)',
  jsonb_set(pg_temp.period_doc_two_groups('8'),'{rows}','[]'::jsonb)
), '42501','forbidden: forecast structure is read only','manager cannot delete rows');
select throws_ok(format(
  'select public.save_crm_forecast_period(''2026-10-16'',''house'',''amanda'',%L::jsonb,3)',
  jsonb_build_object(
    'title','Equipe',
    'columns','[{"id":"broker","label":"Nome do corretor"},{"id":"f_one","label":"Empreendimento 1"},{"id":"a_one","label":"Empreendimento 1"},{"id":"f_two","label":"Empreendimento 2"},{"id":"a_two","label":"Empreendimento 2"},{"id":"f_three","label":"Empreendimento 3"},{"id":"a_three","label":"Empreendimento 3"},{"id":"action_plan","label":"Plano de ação"}]'::jsonb,
    'rows',jsonb_build_array(jsonb_build_object(
      'id','r1','cells',jsonb_build_object(
        'broker','Corretor 1','f_one','8','a_one','2','f_two','3','a_two','4',
        'f_three','','a_three','','action_plan','Ação'
      )
    ))
  )
), '42501','forbidden: forecast structure is read only','manager cannot insert columns');
select throws_ok(format(
  'select public.save_crm_forecast_period(''2026-10-16'',''house'',''amanda'',%L::jsonb,3)',
  pg_temp.period_doc('8','Ação')
), '42501','forbidden: forecast structure is read only','manager cannot delete columns');
select is(public.get_crm_forecast_period('2026-10-16','house','amanda')#>>'{forecasts,0,forecast,revision}',
  '3','rejected structure changes preserve saved revision');
reset role;

select is((select count(*) from public.audit_logs where action='crm.forecast.period.saved'),
  4::bigint,'only successful scoped saves create audit events');
select ok(not exists (select 1 from public.audit_logs where action='crm.forecast.period.saved'
  and (before ? 'document' or after ? 'document')),
  'period audit stores metadata without forecast contents');
select * from finish();
rollback;
