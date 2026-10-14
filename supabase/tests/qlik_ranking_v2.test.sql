begin;
set local timezone = 'UTC';
-- 77 single-row assertions + 177 assertions from explicit test matrices.
select plan(254);

-- Runs against either the standalone baseline (auth.uid, MFA and permission
-- helpers only) or the full local history. No customer/auth fixture is needed.
-- Helper doubles below test delegation, not the helpers' own implementation.
-- All replacement definitions and synthetic rows are rolled back at the end.
truncate private.crm_qlik_v2_publications, private.crm_qlik_v2_observations;

select has_function('public', 'ingest_qlik_ranking_v2',
  array['jsonb','text','text','timestamp with time zone','text'], 'writer signature');
select has_function('public', 'get_qlik_ranking_v2', array['integer'], 'year-specific reader signature');
select ok(c.relrowsecurity and c.relforcerowsecurity, c.relname || ' enforces RLS')
from pg_class c where c.oid in ('private.crm_qlik_v2_observations'::regclass,
  'private.crm_qlik_v2_publications'::regclass);
select ok(not has_table_privilege(r, t, p), r || ' has no ' || p || ' on ' || t)
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['private.crm_qlik_v2_observations','private.crm_qlik_v2_publications']) t
cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
select ok(not exists (
  select 1 from aclexplode(c.relacl) a where a.grantee = 0
), c.relname || ' has no PUBLIC table grants')
from pg_class c where c.oid in ('private.crm_qlik_v2_observations'::regclass,
  'private.crm_qlik_v2_publications'::regclass);
select ok(has_function_privilege('service_role',
  'public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text)', 'EXECUTE'), 'service writer allowed');
select ok(not has_function_privilege(r,
  'public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text)', 'EXECUTE'), r || ' cannot publish')
from unnest(array['anon','authenticated']) r;
select ok(has_function_privilege('authenticated', 'public.get_qlik_ranking_v2(integer)', 'EXECUTE'),
  'authenticated reader allowed');
select ok(not has_function_privilege(r, 'public.get_qlik_ranking_v2(integer)', 'EXECUTE'), r || ' cannot read')
from unnest(array['anon','service_role']) r;
select is(
  jsonb_build_object(
    'canExecute', has_function_privilege(r, f.signature, 'EXECUTE'),
    'volatility', (select p.provolatile::text from pg_proc p where p.oid = f.signature::regprocedure)
  ),
  jsonb_build_object('canExecute', false, 'volatility', f.volatility),
  r || ' private validator ACL and volatility: ' || f.signature
)
from unnest(array['anon','authenticated','service_role']) r
cross join (values
  ('private.crm_qlik_v2_keys(jsonb,text[])', 'i'),
  ('private.crm_qlik_v2_timestamp(text)', 's'),
  ('private.crm_qlik_v2_content(jsonb,timestamptz)', 's')
) f(signature, volatility);
select ok(p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres'
  and 'search_path=""' = any(p.proconfig), p.proname || ' definer has pinned search_path and owner')
from pg_proc p where p.oid in ('public.get_qlik_ranking_v2(integer)'::regprocedure,
  'public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text)'::regprocedure);

create or replace function private.current_session_satisfies_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select nullif(current_setting('test.qlik_mfa', true), '')::boolean;
$$;
create or replace function public.has_permission(user_uuid uuid, permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select user_uuid = '91000000-0000-4000-8000-000000000001'::uuid
    and permission_key = 'crm.ranking.view'
    and nullif(current_setting('test.qlik_permission', true), '')::boolean;
$$;

create function pg_temp.qlik_uuid(n integer) returns text language sql immutable as $$
  select '92000000-0000-4000-8000-' || lpad(n::text, 12, '0');
$$;
create function pg_temp.qlik_payload(batch integer, request integer, step integer default 0,
  yr integer default 2026) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'schemaVersion', 2, 'batchId', pg_temp.qlik_uuid(batch), 'requestId', pg_temp.qlik_uuid(request),
    'startedAt', to_char(transaction_timestamp() - interval '2 hours' + step * interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'completedAt', to_char(transaction_timestamp() - interval '2 hours' + (step + 1) * interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'source', jsonb_build_object('appId','7c000871-8b32-4c0f-bfd5-4b9d46946575',
      'sheetId','772db774-0bc2-42d8-ac11-3e4917bd0d37', 'mappingSha256',repeat('a',64),
      'reloadTimestamp',to_char(transaction_timestamp() - interval '3 hours','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'scope', jsonb_build_object('businessUnit','Direcional','regional','SP CAPITAL','channel','CANAL IMOB'),
    'months', jsonb_build_array(jsonb_build_object('periodMonth', yr::text || '-09-01',
      'imobs', cube, 'developments', cube)))
  from (select '{"coverage":{"state":"complete","sourceRows":2},
    "nativeTotals":{"vgv":"9007199254740993.30","contracts":3},
    "rows":[{"key":"a","name":"Synthetic A","vgv":"9007199254740993.10","contracts":1},
            {"key":"b","name":"Synthetic B","vgv":"0.20","contracts":2}]}'::jsonb cube) fixture;
$$;
create function pg_temp.qlik_submit(payload jsonb, nonce integer, body_hash text default null)
returns jsonb language sql volatile as $$
  select public.ingest_qlik_ranking_v2(payload,
    encode(sha256(convert_to(nonce::text, 'UTF8')), 'hex'),
    coalesce(body_hash, encode(sha256(convert_to(payload::text,'UTF8')),'hex')),
    clock_timestamp(), 'qlik-ranking-v2');
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
select set_config('test.qlik_mfa', 'true', true);
select set_config('test.qlik_permission', 'true', true);
set local role authenticated;
select throws_ok('select public.get_qlik_ranking_v2()', '42501', 'ranking access denied', 'reader rejects missing user');
select throws_ok($$select public.ingest_qlik_ranking_v2('{}',repeat('a',64),repeat('b',64),now(),'qlik-ranking-v2')$$,
  '42501', null, 'authenticated cannot invoke writer');
select throws_ok('select * from private.crm_qlik_v2_observations', '42501', null, 'authenticated cannot read raw observations');
reset role;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(public.get_qlik_ranking_v2(), '{"current":null,"previous":null,"publishedAt":null,"availableYears":[]}'::jsonb,
  'empty reader; MFA helper approval does not require hardcoded aal2');
select set_config('test.qlik_mfa', 'false', true);
select throws_ok('select public.get_qlik_ranking_v2()', '42501', 'ranking access denied', 'MFA denial blocks reader');
select set_config('test.qlik_mfa', '', true);
select throws_ok('select public.get_qlik_ranking_v2()', '42501', 'ranking access denied', 'NULL MFA fails closed');
select set_config('test.qlik_mfa', 'true', true);
select set_config('test.qlik_permission', 'false', true);
select throws_ok('select public.get_qlik_ranking_v2()', '42501', 'ranking access denied', 'permission denial blocks reader');
select set_config('test.qlik_permission', '', true);
select throws_ok('select public.get_qlik_ranking_v2()', '42501', 'ranking access denied', 'NULL permission fails closed');
select set_config('test.qlik_permission', 'true', true);
select throws_ok('select public.get_qlik_ranking_v2(2019)', '22023', 'invalid ranking year', 'invalid year rejected');
reset role;
set local role anon;
select throws_ok('select public.get_qlik_ranking_v2()', '42501', null, 'anonymous cannot invoke reader');
reset role;
select set_config('test.qlik_payload', pg_temp.qlik_payload(1,101)::text, true);
set local role service_role;
select throws_ok('select public.get_qlik_ranking_v2()', '42501', null, 'service role cannot invoke reader');
select throws_ok('select * from private.crm_qlik_v2_publications', '42501', null, 'service role has no direct table read');
select is(public.ingest_qlik_ranking_v2(current_setting('test.qlik_payload')::jsonb,
  encode(sha256(convert_to('1','UTF8')),'hex'),
  encode(sha256(convert_to(current_setting('test.qlik_payload'),'UTF8')),'hex'),
  clock_timestamp(),'qlik-ranking-v2')->>'status', 'staged', 'service role can stage through RPC');
reset role;
select is(public.get_qlik_ranking_v2()->'current', 'null'::jsonb, 'single collection remains invisible');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,101),1)->>'reason','replay_conflict','nonce replay rejected');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,101),2)->>'idempotent','true','fresh nonce permits exact request replay');
select is((select count(*)::integer from private.crm_qlik_v2_observations where payload is not null),1,
  'retry is not an independent collection');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,101),3,repeat('f',64))->>'reason',
  'request_conflict','same request with changed body conflicts');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,101,1),4)->>'reason',
  'request_conflict','same request with changed payload conflicts');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,102,0),5)->>'reason',
  'batch_conflict','overlapping independent collections rejected');
select is(pg_temp.qlik_submit(jsonb_set(pg_temp.qlik_payload(1,102,1),'{source,mappingSha256}',to_jsonb(repeat('b',64))),6)->>'reason',
  'batch_conflict','mapping mismatch rejected');
select is(pg_temp.qlik_submit(jsonb_set(pg_temp.qlik_payload(1,102,1),'{months,0,periodMonth}','"2026-10-01"'),16)->>'reason',
  'batch_conflict','month coverage mismatch rejected');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,102,1,2025),17)->>'reason',
  'batch_conflict','batch identity cannot cross years');
select is(pg_temp.qlik_submit(jsonb_set(pg_temp.qlik_payload(1,102,1),'{source,reloadTimestamp}',
  to_jsonb(to_char(transaction_timestamp()-interval '4 hours','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),18)->>'reason',
  'batch_conflict','reload mismatch rejected');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,102,1),7)->>'status','published',
  'equal content with distinct request and non-overlapping collection publishes');
select is((select content_sha256 from private.crm_qlik_v2_observations where request_id = pg_temp.qlik_uuid(102)::uuid and payload is not null),
  encode(sha256(convert_to((pg_temp.qlik_payload(1,102,1) - array['batchId','requestId','startedAt','completedAt'])::text,'UTF8')),'hex'),
  'database derives canonical content hash excluding only collection identity/time');
select is(public.get_qlik_ranking_v2()->'current',pg_temp.qlik_payload(1,102,1),'reader returns original second payload');
select is(public.get_qlik_ranking_v2()->'previous','null'::jsonb,'first publication has no previous');
select ok((public.get_qlik_ranking_v2()->>'publishedAt')::timestamptz <= clock_timestamp(), 'publication has actual database timestamp');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,102,1),8)->>'status','published','published request retry retains receipt');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(1,103,2),9)->>'reason','batch_conflict','published batch cannot collect a third time');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(2,201,0),10)->>'reason','stale_source','older collection cannot replace last valid');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(2,201,3),11)->>'status','staged','next generation first collection stages');
select is(public.get_qlik_ranking_v2()->'current',pg_temp.qlik_payload(1,102,1),'stage preserves last valid');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(2,202,4),12)->>'status','published','next generation second collection publishes');
select is(public.get_qlik_ranking_v2()->'previous',pg_temp.qlik_payload(1,102,1),'previous generation preserved');
-- Simulate wall-clock regression without changing collection order. This
-- fixture mutation is rolled back with the rest of this isolated test file.
update private.crm_qlik_v2_publications set published_at = (
  select published_at + interval '1 second' from private.crm_qlik_v2_publications
  where batch_id = pg_temp.qlik_uuid(2)::uuid
) where batch_id = pg_temp.qlik_uuid(1)::uuid;
select is(public.get_qlik_ranking_v2()->'current',pg_temp.qlik_payload(2,202,4),
  'wall-clock regression cannot reorder current');
select is(public.get_qlik_ranking_v2()->'previous',pg_temp.qlik_payload(1,102,1),
  'wall-clock regression cannot reorder previous');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(4,401,2),20)->>'reason','stale_source',
  'wall-clock regression cannot weaken stale-source guard');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(3,301,0,2025),13)->>'status','staged','older reference year stages independently');
select is(pg_temp.qlik_submit(pg_temp.qlik_payload(3,302,1,2025),14)->>'status','published','older reference year publishes independently');
select is(public.get_qlik_ranking_v2()->'current',pg_temp.qlik_payload(2,202,4),'null year selects greatest published year, not latest write');
select is(public.get_qlik_ranking_v2(2025)->'current',pg_temp.qlik_payload(3,302,1,2025),'explicit older year retained');
select is(public.get_qlik_ranking_v2(2025)->'previous','null'::jsonb,'previous never crosses years');
select is(public.get_qlik_ranking_v2()->'availableYears','[2026,2025]'::jsonb,'published years descending');
select is(public.get_qlik_ranking_v2(2024),'{"current":null,"previous":null,"publishedAt":null,"availableYears":[2026,2025]}'::jsonb,
  'unpublished year has truthful absence and retains available years');
select is(pg_temp.qlik_submit(jsonb_set(pg_temp.qlik_payload(4,401,10),'{source,reloadTimestamp}',
  to_jsonb(to_char(transaction_timestamp()-interval '4 hours','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))),19)->>'reason',
  'stale_source','new collection from older reload cannot replace current');
select set_config('test.qlik_current',pg_temp.qlik_payload(2,202,4)::text,true);
set local role authenticated;
select is(public.get_qlik_ranking_v2()->'current',current_setting('test.qlik_current')::jsonb,
  'authorized reader sees complete fixed scope without table access');
reset role;

-- Validation matrix exercises NULLs and exact arithmetic without consuming
-- nonce/rate capacity. Writer integration above covers the same validator.
select ok(private.crm_qlik_v2_content(pg_temp.qlik_payload(9,901),clock_timestamp()) is not null,
  'decimal cents above JS safe integer remain exact');
select ok(private.crm_qlik_v2_content(pg_temp.qlik_payload(9,901,121),clock_timestamp()) is not null,
  'collection clock skew within five minutes accepted');
select ok(private.crm_qlik_v2_content(pg_temp.qlik_payload(9,901,126),clock_timestamp()) is null,
  'collection clock skew above five minutes rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{requestId}',
  to_jsonb('92000000-0000-' || version::text || '000-8000-000000000901')),clock_timestamp()) is not null,
  'UUID version ' || version || ' accepted like Zod') from generate_series(1,8) version;
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{requestId}',to_jsonb(value)),clock_timestamp()) is not null,
  'UUID boundary accepted like Zod: ' || value)
from unnest(array['9F37407B-251C-43F3-8370-01B49E37AC40',
  '00000000-0000-0000-0000-000000000000','ffffffff-ffff-ffff-ffff-ffffffffffff']) value;
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901), path, replacement),clock_timestamp()) is null, description)
from (values
  ('{schemaVersion}'::text[], 'null'::jsonb, 'null version'),
  ('{schemaVersion}', '2.0', 'noncanonical numeric version'),
  ('{requestId}', '"not-a-uuid"', 'invalid request UUID'),
  ('{requestId}', '"92000000-0000-9000-8000-000000000901"', 'unsupported UUID version'),
  ('{batchId}', 'null', 'null batch UUID'),
  ('{source}', '{}', 'missing source fields'),
  ('{source,appId}', '"unrelated"', 'unrelated app'),
  ('{source,sheetId}', '"unrelated"', 'unrelated sheet'),
  ('{source,mappingSha256}', 'null', 'null mapping'),
  ('{scope,regional}', '"OTHER"', 'wrong regional'),
  ('{scope,businessUnit}', '"Riva"', 'wrong unit'),
  ('{scope,channel}', '"OTHER"', 'wrong channel'),
  ('{scope}', 'null', 'null scope'),
  ('{months}', '[]', 'empty months'),
  ('{months}', 'null', 'null months'),
  ('{months,0,periodMonth}', '"2026-09-02"', 'non-month date'),
  ('{months,0,periodMonth}', '"2026-13-01"', 'invalid month'),
  ('{months,0,periodMonth}', '"2019-01-01"', 'year below bound'),
  ('{months,0,periodMonth}', '"2101-01-01"', 'year above bound'),
  ('{months,0,imobs,coverage,state}', '"partial"', 'partial coverage'),
  ('{months,0,imobs,coverage,sourceRows}', '3', 'source row count mismatch'),
  ('{months,0,imobs,coverage,sourceRows}', 'null', 'null source row count'),
  ('{months,0,imobs,rows}', 'null', 'null rows'),
  ('{months,0,imobs,rows,0,key}', '" b"', 'untrimmed key'),
  ('{months,0,imobs,rows,0,key}', '"b"', 'duplicate key'),
  ('{months,0,imobs,rows,0,key}', '"z"', 'unsorted keys'),
  ('{months,0,imobs,rows,0,key}', '"A"', 'uppercase key rejected like TS'),
  ('{months,0,imobs,rows,0,key}', '"a/b"', 'slash in key rejected like TS'),
  ('{months,0,imobs,rows,0,key}', '"a b"', 'space in key rejected like TS'),
  ('{months,0,imobs,rows,0,key}', '"a--b"', 'repeated separator rejected like TS'),
  ('{months,0,imobs,rows,0,name}', '""', 'empty label'),
  ('{months,0,imobs,rows,0,name}', '"bad\nlabel"', 'control character in label'),
  ('{months,0,imobs,rows,0,vgv}', '"-1.00"', 'negative money'),
  ('{months,0,imobs,rows,0,vgv}', '1.00', 'numeric money instead of canonical text'),
  ('{months,0,imobs,rows,0,vgv}', '"1e2"', 'exponential money'),
  ('{months,0,imobs,rows,0,vgv}', '"1.001"', 'fractional cents'),
  ('{months,0,imobs,rows,0,contracts}', '1.5', 'fractional contract'),
  ('{months,0,imobs,rows,0,contracts}', 'null', 'null contract'),
  ('{months,0,imobs,nativeTotals,vgv}', '"9007199254740993.31"', 'native VGV differs by cent'),
  ('{months,0,developments,nativeTotals,contracts}', '4', 'native development contracts mismatch'),
  ('{startedAt}', '"2026-02-30T12:00:00Z"', 'invalid timestamp date'),
  ('{startedAt}', '"2026-01-01T24:00:00Z"', 'timestamp rollover'),
  ('{startedAt}', '"2026-01-01T01:00:00-03:00"', 'timestamp not canonical UTC'),
  ('{completedAt}', '"2100-01-01T00:00:00Z"', 'future completion'),
  ('{source,reloadTimestamp}', '"2100-01-01T00:00:00Z"', 'reload after collection')
) cases(path,replacement,description);
select ok(private.crm_qlik_v2_content(pg_temp.qlik_payload(9,901) || '{"contentSha256":"untrusted"}',clock_timestamp()) is null,
  'caller supplied content hash forbidden');
select ok(private.crm_qlik_v2_content(pg_temp.qlik_payload(9,901) || '{"referenceYear":2026}',clock_timestamp()) is null,
  'year comes from months, not caller field');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months}',
  (pg_temp.qlik_payload(9,901)#>'{months}') || (pg_temp.qlik_payload(9,901,0,2027)#>'{months}')),clock_timestamp()) is null,
  'mixed years rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months}',
  (pg_temp.qlik_payload(9,901)#>'{months}') || (pg_temp.qlik_payload(9,901)#>'{months}')),clock_timestamp()) is null,
  'duplicate months rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months}',
  (pg_temp.qlik_payload(9,901)#>'{months}') ||
  jsonb_build_array(jsonb_set(pg_temp.qlik_payload(9,901)#>'{months,0}','{periodMonth}','"2026-08-01"'))),clock_timestamp()) is null,
  'descending months rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months}',
  (pg_temp.qlik_payload(9,901)#>'{months}') ||
  jsonb_build_array(jsonb_set(pg_temp.qlik_payload(9,901)#>'{months,0}','{periodMonth}','"2026-10-01"'))),clock_timestamp()) is not null,
  'ascending nonempty multiple-month coverage accepted');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{startedAt}',
  pg_temp.qlik_payload(9,901,3)->'startedAt'),clock_timestamp()) is null,'start after completion rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{source,reloadTimestamp}',
  pg_temp.qlik_payload(9,901)->'completedAt'),clock_timestamp()) is null,'reload during collection rejected');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs}',
  '{"coverage":{"state":"complete","sourceRows":0},"nativeTotals":{"vgv":"0.00","contracts":0},"rows":[]}'),clock_timestamp()) is not null,
  'explicitly complete zero-result cube accepted');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs,rows,0,name}',to_jsonb(repeat('x',257))),clock_timestamp()) is null,
  'label length bounded');
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs,rows,0,name}',to_jsonb(repeat('x',4000000))),clock_timestamp()) is null,
  'canonical JSONB body capped at 4000000 bytes');
with cube as (
  select jsonb_build_object('coverage',jsonb_build_object('state','complete','sourceRows',5001),
    'nativeTotals',jsonb_build_object('vgv','0.00','contracts',0),
    'rows',jsonb_agg(jsonb_build_object('key',lpad(n::text,6,'0'),'name','Synthetic','vgv','0.00','contracts',0) order by n)) value
  from generate_series(1,5001) n
)
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs}',value),clock_timestamp()) is null,
  'more than 5000 rows rejected') from cube;
with cube as (
  select jsonb_build_object('coverage',jsonb_build_object('state','complete','sourceRows',5000),
    'nativeTotals',jsonb_build_object('vgv','0.00','contracts',0),
    'rows',jsonb_agg(jsonb_build_object('key',lpad(n::text,6,'0'),'name','Synthetic','vgv','0.00','contracts',0) order by n)) value
  from generate_series(1,5000) n
)
select ok(private.crm_qlik_v2_content(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs}',value),clock_timestamp()) is not null,
  'exactly 5000 valid rows accepted') from cube;
with cube as (
  select jsonb_build_object('coverage',jsonb_build_object('state','complete','sourceRows',5000),
    'nativeTotals',jsonb_build_object('vgv','0.00','contracts',0),
    'rows',jsonb_agg(jsonb_build_object('key',lpad(n::text,128,'0'),'name',repeat('x',256),'vgv','0.00','contracts',0) order by n)) value
  from generate_series(1,5000) n
), oversized as (
  select jsonb_set(jsonb_set(pg_temp.qlik_payload(9,901),'{months,0,imobs}',value),'{months,0,developments}',value) payload
  from cube
)
select ok(octet_length(convert_to(payload::text,'UTF8')) > 4000000
  and private.crm_qlik_v2_content(payload,clock_timestamp()) is null,
  'body cap rejects otherwise valid labels, rows and totals') from oversized;
select is(pg_temp.qlik_submit('{}',15)->>'reason','invalid_payload','writer rejects invalid payload');
select is(public.get_qlik_ranking_v2()->'current',pg_temp.qlik_payload(2,202,4),'invalid writes never clear current');
select is(public.ingest_qlik_ranking_v2(pg_temp.qlik_payload(9,901),repeat('a',64),repeat('b',64),now()-interval '6 minutes','qlik-ranking-v2')->>'reason',
  'invalid_payload','expired request timestamp rejected');
select is(public.ingest_qlik_ranking_v2(pg_temp.qlik_payload(9,901),repeat('a',64),repeat('b',64),now()+interval '6 minutes','qlik-ranking-v2')->>'reason',
  'invalid_payload','future request skew rejected');
select is(public.ingest_qlik_ranking_v2(pg_temp.qlik_payload(9,901),repeat('a',64),repeat('b',64),now(),'other-key')->>'reason',
  'invalid_payload','key id fixed');

truncate private.crm_qlik_v2_publications, private.crm_qlik_v2_observations;
select is(pg_temp.qlik_submit('{}',n)->>'reason','invalid_payload','registered attempt ' || n || ' consumes rate budget')
from generate_series(1,60) n;
select is(pg_temp.qlik_submit('{}',61)->>'reason','rate_limited','61st attempt rejected');
select is((select count(*)::integer from private.crm_qlik_v2_observations),60,'rate rejection does not grow durable table');
select is(pg_temp.qlik_submit('{}',1)->>'reason','replay_conflict','nonce replay remains durable even at rate limit');

select * from finish();
rollback;
