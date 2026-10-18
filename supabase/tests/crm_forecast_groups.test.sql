begin;
select plan(36);

insert into auth.users (id,email) values ('ac810000-0000-4000-8000-000000000001','forecast-groups@example.test');
select public.bootstrap_master_user('ac810000-0000-4000-8000-000000000001');

create function pg_temp.grouped_forecast(cell text default '') returns jsonb
language sql immutable as $$
  select jsonb_build_object('title','Equipe','columns',
    '[{"id":"broker","label":"Nome do corretor"},{"id":"f_one","label":"Empreendimento 1"},{"id":"a_one","label":"Empreendimento 1"}]'::jsonb,
    'rows',jsonb_build_array(jsonb_build_object('id','r1','cells',jsonb_build_object('broker','Sintético','f_one',cell,'a_one',''))));
$$;
grant execute on function pg_temp.grouped_forecast(text) to authenticated;

-- Existing records are not rewritten or made unreadable by the new validator.
insert into public.crm_forecasts(singleton,document,revision) values (true,
  '{"title":"Legado","columns":[{"id":"old","label":"Nome"}],"rows":[{"id":"r1","cells":{"old":"Texto preservado"}}]}',1);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','',true);
select set_config('request.jwt.claim.sub','ac810000-0000-4000-8000-000000000001',true);
select is(public.get_crm_forecast()#>>'{forecast,rows,0,cells,old}','Texto preservado','legacy remains readable unchanged');

select throws_ok(format('select public.save_crm_forecast(%L::jsonb,1)',doc),
  '22023','invalid_argument: invalid forecast',reason)
from (values
  ('{"title":"Legado","columns":[{"id":"broker","label":"Nome"}],"rows":[]}'::jsonb,'legacy writes require grouped conversion'),
  (jsonb_set(pg_temp.grouped_forecast(),'{columns,0,id}','"other"'),'broker column is fixed'),
  (jsonb_set(pg_temp.grouped_forecast(),'{columns,1,id}','"x_one"'),'forecast prefix required'),
  (jsonb_set(pg_temp.grouped_forecast(),'{columns,2,id}','"a_other"'),'pair identity must match'),
  (jsonb_set(pg_temp.grouped_forecast(),'{columns,2,label}','"Other"'),'pair titles must match'),
  (jsonb_set(pg_temp.grouped_forecast(),'{columns}',(pg_temp.grouped_forecast()->'columns') - 2),'half group rejected')
) invalid(doc,reason);

select throws_ok(format('select public.save_crm_forecast(%L::jsonb,1)',pg_temp.grouped_forecast(value)),
  '22023','invalid_argument: invalid forecast','invalid numeric value rejected: '||quote_literal(value))
from (values ('text'),('-1'),('+1'),('1e3'),('1.234'),('1,234'),('1 000'),(' 1'),('1 '),
  ('Infinity'),('NaN'),('1000000000'),('.5'),(',5'),(E'12\n'),(E'12\t'),(E'\n12')) invalid(value);

select is(public.get_crm_forecast()#>>'{forecast,revision}','1','failed saves preserve legacy revision');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast(''),1)$$,'valid numeric value accepted: ');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast('0'),2)$$,'valid numeric value accepted: 0');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast('0.1'),3)$$,'valid numeric value accepted: 0.1');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast('0,20'),4)$$,'valid numeric value accepted: 0,20');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast('1,'),5)$$,'valid numeric value accepted: 1,');
select lives_ok($$select public.save_crm_forecast(pg_temp.grouped_forecast('999999999.99'),6)$$,'valid numeric value accepted: 999999999.99');
select is(public.get_crm_forecast()#>>'{forecast,rows,0,cells,f_one}','999999999.99','numeric wire strings remain unchanged');

-- Two complete groups can change order while their ID-keyed cells keep meaning.
select lives_ok($$select public.save_crm_forecast(
  '{"title":"Equipe","columns":[{"id":"broker","label":"Nome"},{"id":"f_two","label":"Dois"},{"id":"a_two","label":"Dois"},{"id":"f_one","label":"Um"},{"id":"a_one","label":"Um"}],"rows":[{"id":"r1","cells":{"broker":"Pessoa","f_one":"1","a_one":"2","f_two":"3","a_two":"4"}}]}',
  (public.get_crm_forecast()#>>'{forecast,revision}')::bigint)$$,'complete groups can be reordered');
select is(public.get_crm_forecast()#>>'{forecast,rows,0,cells,f_one}','1','reorder keeps associated cell');
reset role;
select ok(not has_table_privilege('authenticated','public.crm_forecasts','UPDATE'),'migration does not grant table writes');
select ok(not has_function_privilege('anon','public.save_crm_forecast(jsonb,bigint)','EXECUTE'),'migration preserves anon RPC denial');
select * from finish();
rollback;
