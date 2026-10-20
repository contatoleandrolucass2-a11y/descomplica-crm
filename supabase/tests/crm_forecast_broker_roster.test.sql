begin;
select plan(8);

insert into auth.users (id,email) values
  ('ad920000-0000-4000-8000-000000000001','forecast-roster@example.test');
select public.bootstrap_master_user('ad920000-0000-4000-8000-000000000001');

insert into public.crm_dashboard_snapshots
  (snapshot_key,reference_date,generated_at,timezone,source)
values ('forecast-roster','2026-10-20','2026-10-20T12:00:00Z','America/Sao_Paulo','synthetic test');

insert into public.crm_dashboard_analysis(snapshot_id,view_key,payload)
select id,'without_canal_imob','{
  "version":1,"coverageStart":"2026-10-01","referenceDate":"2026-10-20",
  "viewKey":"without_canal_imob",
  "dimensions":{"managers":["AMANDA STEFANI NUNES TEIXEIRA"],"owners":["Zélia Corretora","Ana Corretora"],"companies":[],"developments":[]},
  "facts":[[0,"2026-10-20",0,0,-1,0,-1,1,0,0],[1,"2026-10-20",0,1,-1,0,-1,2,0,0],[2,"2026-10-20",0,0,-1,0,-1,3,0,0]]
}'::jsonb from public.crm_dashboard_snapshots where snapshot_key='forecast-roster';

insert into public.crm_dashboard_analysis(snapshot_id,view_key,payload)
select id,'with_canal_imob','{
  "version":1,"coverageStart":"2026-10-01","referenceDate":"2026-10-20",
  "viewKey":"with_canal_imob",
  "dimensions":{"managers":["JHONNATA FRANCA DA SILVA"],"owners":["Bruno Corretor"],"companies":[],"developments":[]},
  "facts":[[0,"2026-10-20",0,0,-1,0,-1,1,0,0]]
}'::jsonb from public.crm_dashboard_snapshots where snapshot_key='forecast-roster';

select ok(has_function_privilege('authenticated',
  'public.get_crm_forecast_brokers(text,text)','EXECUTE'),
  'authenticated can enter the guarded broker roster RPC');
select ok(not exists (
  select 1 from (values ('anon'),('service_role')) role_name(name)
  where has_function_privilege(role_name.name,
    'public.get_crm_forecast_brokers(text,text)','EXECUTE')
), 'anon and service role cannot execute the broker roster RPC');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','',true);
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.get_crm_forecast_brokers('house','amanda')$$,
  '28000','unauthorized: authenticated user required','missing UID cannot read broker names');

select set_config('request.jwt.claim.sub','ad920000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.get_crm_forecast_brokers('general','amanda')$$,
  '22023','invalid_argument: invalid forecast selection','general cannot request a broker roster');
select throws_ok($$select public.get_crm_forecast_brokers('house','alvaro')$$,
  '22023','invalid_argument: invalid forecast selection','manager must belong to the selected segment');
select is(public.get_crm_forecast_brokers('house','amanda'),
  '["Ana Corretora", "Zélia Corretora"]'::jsonb,
  'House returns distinct broker names in stable alphabetical order');
select is(public.get_crm_forecast_brokers('imob','jonathan'),
  '["Bruno Corretor"]'::jsonb,'Imob accepts the operational Jhonnata spelling');
select is(public.get_crm_forecast_brokers('house','cleber'),
  '[]'::jsonb,'a manager absent from the latest snapshot returns an empty roster');
reset role;

select * from finish();
rollback;
