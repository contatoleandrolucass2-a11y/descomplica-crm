begin;

select plan(25);

select has_table('public', 'crm_ranking_snapshots', 'ranking snapshots table exists');
select has_table('public', 'crm_ranking_participants', 'ranking participants table exists');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_ranking_snapshots'::regclass),
  'ranking snapshots have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_ranking_participants'::regclass),
  'ranking participants have RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.crm_ranking_snapshots', 'select')
  and has_table_privilege('authenticated', 'public.crm_ranking_participants', 'select'),
  'authenticated receives SELECT on the ranking read model'
);
select ok(
  not has_table_privilege('authenticated', 'public.crm_ranking_snapshots', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_ranking_snapshots', 'update')
  and not has_table_privilege('authenticated', 'public.crm_ranking_participants', 'insert')
  and not has_table_privilege('authenticated', 'public.crm_ranking_participants', 'update'),
  'authenticated cannot mutate ranking rows directly'
);
select ok(
  not has_table_privilege('anon', 'public.crm_ranking_snapshots', 'select')
  and not has_table_privilege('anon', 'public.crm_ranking_participants', 'select'),
  'anon cannot read ranking rows'
);
select ok(
  not has_sequence_privilege('authenticated', 'public.crm_ranking_snapshots_id_seq', 'usage'),
  'authenticated cannot use the ranking sequence'
);
select is((select count(*) from public.crm_ranking_snapshots), 0::bigint, 'migration seeds no snapshot');
select is((select count(*) from public.crm_ranking_participants), 0::bigint, 'migration seeds no participants');

insert into public.crm_ranking_snapshots (
  snapshot_key,
  reference_date,
  generated_at,
  source
) values (
  'global',
  '2026-08-04',
  '2026-08-04T05:00:00Z',
  'pgTAP ranking fixture'
);

insert into public.crm_ranking_participants (
  snapshot_id,
  period_key,
  broker_key,
  broker_name,
  manager_name,
  roulette,
  schedule,
  visit,
  approved_folder,
  sale
)
select id, 'month', 'ana-silva', 'Ana Silva', 'Gerente A', 2, 10, 5, 2, 1
from public.crm_ranking_snapshots where snapshot_key = 'global';

select is((select count(*) from public.crm_ranking_snapshots), 1::bigint, 'fixture creates one snapshot');
select is((select count(*) from public.crm_ranking_participants), 1::bigint, 'fixture creates one participant');
select throws_ok(
  $$insert into public.crm_ranking_snapshots
    (snapshot_key, reference_date, generated_at, source)
    values ('global', '2026-08-04', now(), 'duplicate')$$,
  '23505',
  null,
  'snapshot key is unique'
);
select throws_ok(
  $$insert into public.crm_ranking_participants
    (snapshot_id, period_key, broker_key, broker_name, manager_name)
    select id, 'month', 'ana-silva', 'Outra Ana', 'Gerente B'
    from public.crm_ranking_snapshots where snapshot_key = 'global'$$,
  '23505',
  null,
  'participant identity is unique per period'
);
select throws_ok(
  $$insert into public.crm_ranking_participants
    (snapshot_id, period_key, broker_key, broker_name, manager_name)
    select id, 'year', 'bia', 'Bia', 'Gerente A'
    from public.crm_ranking_snapshots where snapshot_key = 'global'$$,
  '23514',
  null,
  'unknown presentation period is rejected'
);
select throws_ok(
  $$update public.crm_ranking_participants set sale = -1$$,
  '23514',
  null,
  'negative activity count is rejected'
);
select throws_ok(
  $$update public.crm_ranking_participants set manager_name = '   '$$,
  '23514',
  null,
  'blank participant names are rejected'
);
select throws_ok(
  $$update public.crm_ranking_snapshots set source = ''$$,
  '23514',
  null,
  'blank ranking source is rejected'
);
select has_index(
  'public',
  'crm_ranking_participants',
  'crm_ranking_participants_period_manager_idx',
  'period and manager lookup is indexed'
);
select ok(
  not has_table_privilege('service_role', 'public.crm_ranking_snapshots', 'insert')
  and not has_table_privilege('service_role', 'public.crm_ranking_participants', 'insert'),
  'service role writes ranking only through the audited ingestion RPC'
);

insert into auth.users (id, email)
values ('50000000-0000-0000-0000-000000000001', 'ranking-user@example.test');
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is((select count(*) from public.crm_ranking_snapshots), 1::bigint, 'ranking reader sees snapshot');
select is((select count(*) from public.crm_ranking_participants), 1::bigint, 'ranking reader sees participant');

reset role;
insert into public.user_permission_overrides (user_id, permission_key, effect, reason)
values (
  '50000000-0000-0000-0000-000000000001',
  'crm.ranking.view',
  'deny',
  'ranking RLS test'
);
set local role authenticated;

select is((select count(*) from public.crm_ranking_snapshots), 0::bigint, 'deny override hides snapshot');
select is((select count(*) from public.crm_ranking_participants), 0::bigint, 'deny override hides participants');

reset role;
insert into public.crm_ranking_snapshots (snapshot_key, reference_date, generated_at, source)
values ('temporary', '2026-08-04', now(), 'cascade fixture');
insert into public.crm_ranking_participants (
  snapshot_id, period_key, broker_key, broker_name, manager_name
)
select id, 'today', 'temporary', 'Temporário', 'Gerente T'
from public.crm_ranking_snapshots where snapshot_key = 'temporary';
delete from public.crm_ranking_snapshots where snapshot_key = 'temporary';
select is(
  (select count(*) from public.crm_ranking_participants where broker_key = 'temporary'),
  0::bigint,
  'deleting a snapshot cascades to its participant rows'
);

select * from finish();
rollback;
