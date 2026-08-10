begin;

select plan(86);

select ok(
  exists (select 1 from pg_catalog.pg_roles where rolname = 'crm_qlik_relay'),
  'dedicated Qlik relay role exists'
);
select ok(
  (select not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolcanlogin and not rolreplication
      and not rolbypassrls and rolconnlimit = 2
      and 'search_path=pg_catalog' = any(rolconfig)
   from pg_catalog.pg_roles where rolname = 'crm_qlik_relay'),
  'relay role is NOLOGIN and has bounded least-privilege attributes'
);
select ok(
  (select pg_catalog.pg_get_userbyid(namespace.nspowner) = 'postgres'
     and not exists (
       select 1
       from pg_catalog.aclexplode(namespace.nspacl) acl
       where acl.grantee not in (
           (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
           (select role.oid from pg_catalog.pg_roles role where role.rolname = 'crm_qlik_relay')
         )
         or (
           acl.grantee = (
             select role.oid from pg_catalog.pg_roles role
             where role.rolname = 'crm_qlik_relay'
           )
           and (acl.privilege_type <> 'USAGE' or acl.is_grantable)
         )
     )
   from pg_catalog.pg_namespace namespace
   where namespace.nspname = 'qlik_relay'),
  'relay schema owner and delegated ACL are exact'
);
select ok(
  (select function_row.prosecdef
      and 'search_path=""' = any(function_row.proconfig)
      and 'statement_timeout=35s' = any(function_row.proconfig)
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
   from pg_catalog.pg_proc function_row
   where function_row.oid =
     'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure),
  'relay wrapper is bounded SECURITY DEFINER with an empty search path'
);
select ok(
  has_function_privilege(
    'crm_qlik_relay',
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(function_row.proacl) acl
    where function_row.oid =
      'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
      and (
        acl.grantee not in (
          (select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'),
          (select role.oid from pg_catalog.pg_roles role where role.rolname = 'crm_qlik_relay')
        )
        or (
          acl.grantee = (
            select role.oid from pg_catalog.pg_roles role
            where role.rolname = 'crm_qlik_relay'
          )
          and (acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
        )
      )
  ),
  'only the relay role has non-grantable EXECUTE on the wrapper'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_qlik_relay'
    )
      or (
        membership.roleid = (
          select role.oid from pg_catalog.pg_roles role
          where role.rolname = 'crm_qlik_relay'
        )
        and (
          membership.member <> (
            select role.oid from pg_catalog.pg_roles role where role.rolname = 'postgres'
          )
          or membership.inherit_option
          or membership.set_option
        )
      )
  ),
  'relay has no received or runtime-usable role membership'
);
select is(
  private.crm_qlik_relay_role_isolated(),
  false,
  'inherited pg_net and database PUBLIC privileges block LOGIN activation'
);
alter role crm_qlik_relay createrole;
select is(
  private.crm_qlik_relay_role_attributes_safe(),
  false,
  'runtime role attribute drift fails the activation preflight closed'
);
alter role crm_qlik_relay nocreaterole;
alter role crm_qlik_relay login;
select is(
  (qlik_relay.ingest_snapshot(
    '{}'::jsonb, 'shadow', 'probe', now(), repeat('a', 64), repeat('b', 64)
  )->>'reason'),
  'relay_role_not_isolated'::text,
  'LOGIN activation fails closed until owner-level ACL isolation is proven'
);
alter role crm_qlik_relay nologin;
select ok(
  pg_catalog.pg_get_functiondef(
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
  ) like '%session_user <> ''postgres''%'
  and pg_catalog.pg_get_functiondef(
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
  ) like '%session_user <> ''crm_qlik_relay''%'
  and pg_catalog.pg_get_functiondef(
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
  ) like '%rolcanlogin%'
  and pg_catalog.pg_get_functiondef(
    'qlik_relay.ingest_snapshot(jsonb,text,text,timestamptz,text,text)'::regprocedure
  ) like '%crm_qlik_relay_role_isolated%',
  'wrapper binds non-owner sessions to the enabled isolated relay login'
);
select ok(
  not has_function_privilege(
    'crm_qlik_relay', 'public.ingest_crm_imob_ranking_snapshot(jsonb)', 'EXECUTE'
  ),
  'relay role cannot bypass the wrapper through the base ingestion RPC'
);
create function qlik_relay._default_acl_probe()
returns integer language sql as $$ select 1 $$;
select ok(
  not has_function_privilege(
    'crm_qlik_relay', 'qlik_relay._default_acl_probe()', 'EXECUTE'
  ),
  'global default ACL keeps future relay functions closed until an explicit grant'
);
drop function qlik_relay._default_acl_probe();
select ok(
  not exists (
    select 1
    from (values
      ('public.crm_imob_ranking_runs'),
      ('public.crm_imob_ranking_entries'),
      ('public.crm_imob_ranking_developments'),
      ('private.crm_qlik_relay_credentials'),
      ('private.crm_integration_cutover_gates'),
      ('private.crm_qlik_relay_requests'),
      ('private.crm_mapping_source_authorities'),
      ('private.crm_mapping_import_batches'),
      ('private.crm_mapping_import_items')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege('crm_qlik_relay', tables.name, privileges.name)
  ),
  'relay role has no direct table privilege'
);

select has_table('private', 'crm_qlik_relay_credentials', 'relay registry exists');
select has_table('private', 'crm_integration_cutover_gates', 'cutover gate exists');
select has_table('private', 'crm_qlik_relay_requests', 'sanitized relay ledger exists');
select has_table('private', 'crm_mapping_source_authorities', 'mapping authority catalog exists');
select has_table('private', 'crm_mapping_import_batches', 'mapping batch ledger exists');
select has_table('private', 'crm_mapping_import_items', 'mapping item ledger exists');

select ok(
  (select bool_and(class.relrowsecurity and class.relforcerowsecurity)
   from pg_catalog.pg_class class
   where class.oid in (
     'private.crm_qlik_relay_credentials'::regclass,
     'private.crm_integration_cutover_gates'::regclass,
     'private.crm_qlik_relay_requests'::regclass,
     'private.crm_mapping_source_authorities'::regclass,
     'private.crm_mapping_import_batches'::regclass,
     'private.crm_mapping_import_items'::regclass
   )),
  'all relay and mapping control tables enable and force RLS'
);
select ok(
  not exists (
    select 1
    from (values
      ('anon'), ('authenticated'), ('service_role')
    ) roles(name)
    cross join (values
      ('private.crm_qlik_relay_credentials'),
      ('private.crm_integration_cutover_gates'),
      ('private.crm_qlik_relay_requests'),
      ('private.crm_mapping_source_authorities'),
      ('private.crm_mapping_import_batches'),
      ('private.crm_mapping_import_items')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(roles.name, tables.name, privileges.name)
  ),
  'Data API roles receive no direct control-table privilege'
);
select is(
  (select jsonb_build_array(
    (select count(*) from private.crm_qlik_relay_credentials),
    (select count(*) from private.crm_integration_cutover_gates),
    (select count(*) from private.crm_qlik_relay_requests),
    (select count(*) from private.crm_mapping_source_authorities),
    (select count(*) from private.crm_mapping_import_batches),
    (select count(*) from private.crm_mapping_import_items)
  )),
  '[0,0,0,0,0,0]'::jsonb,
  'migration seeds no credentials, gates, requests, authorities or mappings'
);
select ok(
  not exists (
    select 1 from information_schema.columns column_row
    where column_row.table_schema = 'private'
      and column_row.table_name = 'crm_qlik_relay_requests'
      and column_row.column_name ~ '(payload|secret|signature|token|nonce$)'
  ),
  'relay ledger has no raw payload, secret, signature, token or nonce column'
);

create function pg_temp.relay_sha(p_value text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create function pg_temp.relay_payload(
  p_request_id uuid,
  p_window integer default 0
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'requestId', p_request_id,
    'referenceYear', extract(year from now())::integer,
    'generatedAt', to_char(
      now() - interval '4 minutes' + make_interval(mins => p_window),
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ),
    'sourceUpdatedAt', to_char(
      now() - interval '5 minutes' + make_interval(mins => p_window),
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ),
    'entries', jsonb_build_array(jsonb_build_object(
      'periodMonth', to_char(date_trunc('month', now()), 'YYYY-MM-DD'),
      'imobKey', 'relay-fixture-partner',
      'imobName', 'Relay fixture partner',
      'vgv', 12345.67,
      'contracts', 2,
      'sourceRankVgv', 1,
      'sourceRankContracts', 1
    )),
    'developments', '[]'::jsonb
  );
$$;
grant execute on function pg_temp.relay_sha(text) to service_role;
grant execute on function pg_temp.relay_payload(uuid, integer) to service_role;
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000001'),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('missing-registry'),
    pg_temp.relay_sha('missing-registry-body')
  )->>'reason'),
  'cutover_gate_closed'::text,
  'empty credential registry fails closed'
);
select is(
  (select count(*) from private.crm_qlik_relay_requests),
  0::bigint,
  'gate rejection before authentication evidence creates no ledger row'
);

insert into auth.users (id, email)
values ('a2000000-0000-4000-8000-000000000001', 'relay-master@example.test');
select public.bootstrap_master_user('a2000000-0000-4000-8000-000000000001');

insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind, process_key
)
values (
  'a3000000-0000-4000-8000-000000000001',
  'relay-process-owner', 'Relay process owner', 'process', 'qlik-ranking-relay'
);
insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind
)
values (
  'a3000000-0000-4000-8000-000000000002',
  'relay-backup-owner', 'Relay backup owner', 'team'
);

select throws_ok(
  $$insert into private.crm_qlik_relay_credentials (
      key_id, owner_id, backup_owner_id, enabled, valid_from,
      max_requests_per_minute, approved_by, approved_at, evidence_reference
    ) values (
      'invalid-same-owner',
      'a3000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000001',
      false, now() - interval '1 minute', 10,
      'a2000000-0000-4000-8000-000000000001', now(), 'test://relay/approval'
    )$$,
  '23514',
  null,
  'credential registry requires distinct primary and backup owners'
);

insert into private.crm_qlik_relay_credentials (
  key_id, owner_id, backup_owner_id, enabled, valid_from,
  max_requests_per_minute, approved_by, approved_at, evidence_reference
)
values (
  'relay-fixture',
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  false, now() - interval '1 minute', 60,
  'a2000000-0000-4000-8000-000000000001', now(), 'test://relay/approval'
);
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000002'),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('disabled-key'),
    pg_temp.relay_sha('disabled-key-body')
  )->>'reason'),
  'cutover_gate_closed'::text,
  'disabled relay credential fails closed'
);

update private.crm_qlik_relay_credentials set enabled = true
where key_id = 'relay-fixture';
insert into private.crm_integration_cutover_gates (
  integration_key, state, owner_id, backup_owner_id, approved_by,
  approved_at, evidence_reference, rollback_reference
)
values (
  'qlik_ranking', 'shadow',
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000001', now(),
  'test://relay/shadow-approval', 'test://relay/rollback'
);
select is(
  (select jsonb_build_array(enabled, max_requests_per_minute)
   from private.crm_qlik_relay_credentials where key_id = 'relay-fixture'),
  '[true,60]'::jsonb,
  'relay credential activation is explicit and rate bounded'
);

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000010')
  )->>'status'),
  'succeeded'::text,
  'legacy path stores first local shadow fixture'
);
reset role;
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000010'),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('shadow-one'),
    pg_temp.relay_sha('shadow-one-body')
  )->>'comparisonStatus'),
  'matched'::text,
  'shadow relay compares the first exact legacy snapshot'
);
select ok(
  exists (
    select 1 from private.crm_qlik_relay_requests
    where request_id = 'a1000000-0000-4000-8000-000000000010'
      and result_status = 'shadow_compared'
      and comparison_status = 'matched'
      and completed_at is not null
      and nonce_hash = pg_temp.relay_sha('shadow-one')
      and body_sha256 = pg_temp.relay_sha('shadow-one-body')
  ),
  'shadow outcome stores only sanitized hashes and metrics'
);
select is(
  (select matched_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  1,
  'first exact shadow snapshot records one matched window'
);
select is(
  (select jsonb_build_array(result ->> 'replay', result ? 'reason')
   from (select qlik_relay.ingest_snapshot(
     pg_temp.relay_payload('a1000000-0000-4000-8000-000000000010'),
     'shadow', 'relay-fixture', now(), pg_temp.relay_sha('shadow-one'),
     pg_temp.relay_sha('shadow-one-body')
   ) result) replay),
  '["true",false]'::jsonb,
  'exact nonce replay is idempotent and omits null optional fields'
);
select is(
  (select count(*) from private.crm_qlik_relay_requests
   where request_id = 'a1000000-0000-4000-8000-000000000010'),
  1::bigint,
  'idempotent relay replay creates no duplicate ledger row'
);

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000011', 1)
  )->>'status'),
  'succeeded'::text,
  'legacy path stores second local shadow fixture'
);
reset role;
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000011', 1),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('shadow-two'),
    pg_temp.relay_sha('shadow-two-body')
  )->>'comparisonStatus'),
  'matched'::text,
  'shadow relay compares a second exact legacy snapshot'
);
select is(
  (select matched_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  2,
  'two distinct exact snapshots satisfy the canary evidence threshold'
);

select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000010'),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('shadow-one-new-nonce'),
    pg_temp.relay_sha('shadow-one-body')
  )->>'comparisonStatus'),
  'matched'::text,
  'a historic request may still compare without becoming a new window'
);
select is(
  (select matched_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  2,
  'a historic matched request with a new nonce cannot manufacture another window'
);

set local role service_role;
select is(
  (public.ingest_crm_imob_ranking_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000012', 2)
  )->>'status'),
  'succeeded'::text,
  'legacy path stores mismatch fixture before shadow comparison'
);
reset role;
select is(
  (qlik_relay.ingest_snapshot(
    jsonb_set(
      pg_temp.relay_payload('a1000000-0000-4000-8000-000000000012', 2),
      '{entries,0,vgv}', '99999.99'::jsonb
    ),
    'shadow', 'relay-fixture', now(), pg_temp.relay_sha('shadow-mismatch'),
    pg_temp.relay_sha('shadow-mismatch-body')
  )->>'comparisonStatus'),
  'mismatch'::text,
  'shadow comparison detects changed commercial facts without writing them'
);
select is(
  (select matched_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  0,
  'a mismatch resets consecutive matched-window evidence'
);
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000013', 3),
    'canary', 'relay-fixture', now(), pg_temp.relay_sha('canary-closed'),
    pg_temp.relay_sha('canary-closed-body')
  )->>'reason'),
  'cutover_gate_closed'::text,
  'canary cannot write before gate state and two matched windows agree'
);

update private.crm_integration_cutover_gates
set state = 'canary', matched_window_count = 2,
    last_matched_request_id = 'a1000000-0000-4000-8000-000000000012',
    last_matched_at = now(), last_matched_generated_at = now() - interval '2 minutes'
where integration_key = 'qlik_ranking';
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000014', 3),
    'canary', 'relay-fixture', now(), pg_temp.relay_sha('canary-open'),
    pg_temp.relay_sha('canary-open-body')
  )->>'status'),
  'succeeded'::text,
  'local canary writes only after explicit gate and evidence threshold'
);
select is(
  (select count(*) from public.crm_imob_ranking_entries
   where run_id = 'a1000000-0000-4000-8000-000000000014'),
  1::bigint,
  'canary commits the exact source fact count through the existing target RPC'
);
select is(
  (select canary_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  1,
  'first non-idempotent canary records one successful window'
);
select throws_ok(
  $$update private.crm_integration_cutover_gates
    set state = 'cutover' where integration_key = 'qlik_ranking'$$,
  '23514',
  null,
  'cutover state is impossible before two successful canary windows'
);
update private.crm_qlik_relay_credentials
set max_requests_per_minute = 1 where key_id = 'relay-fixture';
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000015', 4),
    'canary', 'relay-fixture', now(), pg_temp.relay_sha('canary-rate-limit'),
    pg_temp.relay_sha('canary-rate-limit-body')
  )->>'reason'),
  'rate_limited'::text,
  'a rate-limited canary fails the current evidence window'
);
select is(
  (select canary_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  0,
  'a rate-limited canary resets consecutive success evidence'
);
update private.crm_qlik_relay_credentials
set max_requests_per_minute = 60 where key_id = 'relay-fixture';
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000016', 5),
    'canary', 'relay-fixture', now(), pg_temp.relay_sha('canary-two'),
    pg_temp.relay_sha('canary-two-body')
  )->>'status'),
  'succeeded'::text,
  'first distinct canary after a failed window succeeds'
);
select is(
  (select canary_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  1,
  'a failed window cannot be bridged by one later canary success'
);
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000017', 6),
    'canary', 'relay-fixture', now(), pg_temp.relay_sha('canary-three'),
    pg_temp.relay_sha('canary-three-body')
  )->>'status'),
  'succeeded'::text,
  'second consecutive canary after a failed window succeeds'
);
select is(
  (select canary_window_count from private.crm_integration_cutover_gates
   where integration_key = 'qlik_ranking'),
  2,
  'two distinct successful canaries satisfy the cutover threshold'
);
update private.crm_integration_cutover_gates
set state = 'cutover', updated_at = now()
where integration_key = 'qlik_ranking';
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000018', 7),
    'active', 'relay-fixture', now(), pg_temp.relay_sha('active-open'),
    pg_temp.relay_sha('active-open-body')
  )->>'status'),
  'succeeded'::text,
  'active mode opens only after shadow and canary evidence thresholds'
);

update private.crm_qlik_relay_credentials
set max_requests_per_minute = 1 where key_id = 'relay-fixture';
select is(
  (qlik_relay.ingest_snapshot(
    pg_temp.relay_payload('a1000000-0000-4000-8000-000000000019', 8),
    'active', 'relay-fixture', now(), pg_temp.relay_sha('rate-limited'),
    pg_temp.relay_sha('rate-limited-body')
  )->>'reason'),
  'rate_limited'::text,
  'database rate cap rejects bursts independently of HTTP process state'
);
select throws_ok(
  $$select qlik_relay.ingest_snapshot(
      '{}'::jsonb, 'shadow', 'relay-fixture', now(), repeat('a', 64), repeat('b', 64)
    )$$,
  '22023',
  null,
  'relay wrapper rejects malformed payload metadata before touching facts'
);

set local role anon;
select throws_ok(
  $$select public.get_qlik_relay_health(now() - interval '1 hour')$$,
  '42501',
  null,
  'anonymous caller cannot read relay health'
);
reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
select ok(
  (public.get_qlik_relay_health(now() - interval '1 hour') ->> 'requestCount')::integer >= 4,
  'authorized Master can read bounded aggregate relay health'
);
reset role;

select ok(
  has_function_privilege(
    'authenticated',
    'public.preview_crm_source_identity_mapping_import(jsonb,text)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.preview_crm_source_identity_mapping_import(jsonb,text)', 'EXECUTE'
  ),
  'mapping preview is exposed only to authenticated sessions before server authorization'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_crm_source_identity_mapping_import(jsonb,text,text)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.apply_crm_source_identity_mapping_import(jsonb,text,text)', 'EXECUTE'
  ),
  'mapping apply is exposed only to authenticated sessions before server authorization'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.review_crm_source_identity_mapping(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'public.review_crm_source_identity_mapping(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'service_role', 'public.review_crm_source_identity_mapping(jsonb)', 'EXECUTE'
  ),
  'Data API roles cannot bypass the authority-gated mapping batch'
);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select public.preview_crm_source_identity_mapping_import('{}'::jsonb, repeat('a', 64))$$,
  '42501',
  'forbidden: mapping import preview is not permitted',
  'authenticated session without an authorized Master identity cannot preview mappings'
);
reset role;

create function pg_temp.mapping_manifest(
  p_batch_request_id uuid,
  p_command_request_id uuid,
  p_external_id text,
  p_owner_key text
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'batchRequestId', p_batch_request_id,
    'generatedAt', to_char(now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'evidenceReference', 'test://mapping/manifest',
    'mappings', jsonb_build_array(jsonb_build_object(
      'requestId', p_command_request_id,
      'source', 'cutover-test',
      'entityKind', 'organization',
      'externalId', p_external_id,
      'ownerKey', p_owner_key,
      'targetId', 'a4000000-0000-4000-8000-000000000001',
      'decision', 'verify',
      'effectiveFrom', to_char(now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'evidenceReference', 'test://mapping/item',
      'reason', 'official_test_fixture_review'
    ))
  );
$$;

create function pg_temp.reject_mapping_manifest(
  p_batch_request_id uuid,
  p_command_request_id uuid,
  p_external_id text
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'batchRequestId', p_batch_request_id,
    'generatedAt', to_char(now() - interval '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'evidenceReference', 'test://mapping/reject-manifest',
    'mappings', jsonb_build_array(jsonb_build_object(
      'requestId', p_command_request_id,
      'source', 'cutover-test',
      'entityKind', 'organization',
      'externalId', p_external_id,
      'decision', 'reject',
      'reason', 'official_test_fixture_rejected'
    ))
  );
$$;

create function pg_temp.manifest_hash(p_payload jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    convert_to(private.canonical_crm_mapping_import_manifest(p_payload), 'UTF8'),
    'sha256'
  ), 'hex');
$$;
grant execute on function pg_temp.mapping_manifest(uuid, uuid, text, text) to authenticated;
grant execute on function pg_temp.reject_mapping_manifest(uuid, uuid, text) to authenticated;
grant execute on function pg_temp.manifest_hash(jsonb) to authenticated;

insert into public.crm_organizations (
  id, organization_key, name, kind
)
values (
  'a4000000-0000-4000-8000-000000000001',
  'mapping-import-fixture', 'Mapping import fixture', 'house'
);

create temporary table mapping_plan_evidence (
  phase text primary key,
  manifest jsonb not null,
  result jsonb not null
) on commit drop;
grant select, insert on mapping_plan_evidence to authenticated;

create temporary table mapping_apply_result (
  result jsonb not null
) on commit drop;
grant select, insert on mapping_apply_result to authenticated;

select set_config(
  'request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true
);
set local role authenticated;
insert into mapping_plan_evidence (phase, manifest, result)
select 'blocked', manifest, public.preview_crm_source_identity_mapping_import(
  manifest, pg_temp.manifest_hash(manifest)
)
from (
  select pg_temp.mapping_manifest(
    'a5000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    'owner-missing', 'missing-owner'
  ) as manifest
) input;
reset role;
select is(
  (select result #>> '{items,0,reasonCode}' from mapping_plan_evidence
   where phase = 'blocked'),
  'mapping_owner_missing'::text,
  'preview reports missing mapping owner instead of inventing an association'
);
select is(
  (select jsonb_build_array(
    (select count(*) from private.crm_mapping_commands),
    (select count(*) from public.crm_source_identities
      where source = 'cutover-test'),
    (select count(*) from private.crm_mapping_import_batches)
  )),
  '[0,0,0]'::jsonb,
  'preview remains read-only when conflicts are present'
);

insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind
)
values (
  'a3000000-0000-4000-8000-000000000003',
  'mapping-authority-owner', 'Mapping authority owner', 'team'
);
insert into private.crm_mapping_source_authorities (
  source, entity_kind, owner_id, apply_enabled, valid_from,
  approved_by, approved_at, evidence_reference
)
values (
  'cutover-test', 'organization',
  'a3000000-0000-4000-8000-000000000003', true, now() - interval '1 minute',
  'a2000000-0000-4000-8000-000000000001', now(), 'test://mapping/authority'
);

set local role authenticated;
select is(
  (public.preview_crm_source_identity_mapping_import(
    manifest, pg_temp.manifest_hash(manifest)
  ) #>> '{items,0,disposition}'),
  'record_rejection'::text,
  'SQL preview accepts reject items with omitted optional evidence like Zod'
)
from (
  select pg_temp.reject_mapping_manifest(
    'a5000000-0000-4000-8000-000000000010',
    'a6000000-0000-4000-8000-000000000010',
    'officially-rejected'
  ) manifest
) input;
select throws_ok(
  $test$select public.preview_crm_source_identity_mapping_import(
    jsonb_set(
      pg_temp.reject_mapping_manifest(
        'a5000000-0000-4000-8000-000000000011',
        'a6000000-0000-4000-8000-000000000011',
        'null-evidence'
      ),
      '{mappings,0,evidenceReference}', 'null'::jsonb
    ),
    repeat('a', 64)
  )$test$,
  '22023',
  'invalid_argument: invalid mapping import item shape',
  'SQL rejects a null optional evidence value before canonical hashing'
);
select throws_ok(
  $test$select public.preview_crm_source_identity_mapping_import(
    jsonb_set(
      pg_temp.reject_mapping_manifest(
        'a5000000-0000-4000-8000-000000000012',
        'a6000000-0000-4000-8000-000000000012',
        'numeric-evidence'
      ),
      '{mappings,0,evidenceReference}', '7'::jsonb
    ),
    repeat('a', 64)
  )$test$,
  '22023',
  'invalid_argument: invalid mapping import item shape',
  'SQL rejects a non-string optional evidence value before canonical hashing'
);
select throws_ok(
  $test$select public.preview_crm_source_identity_mapping_import(
    manifest, repeat('a', 64)
  ) from (
    select pg_temp.reject_mapping_manifest(
      'a5000000-0000-4000-8000-000000000013',
      'a6000000-0000-4000-8000-000000000013',
      'wrong-manifest-hash'
    ) manifest
  ) input$test$,
  '23505',
  'conflict: mapping manifest hash mismatch',
  'valid reject manifests still reject every untrusted manifest hash'
);
select throws_ok(
  $test$select public.preview_crm_source_identity_mapping_import(
    manifest, pg_temp.manifest_hash(manifest)
  ) from (
    select jsonb_set(
      pg_temp.reject_mapping_manifest(
        'a5000000-0000-4000-8000-000000000014',
        'a6000000-0000-4000-8000-000000000014',
        'uppercase-request-id'
      ),
      '{mappings,0,requestId}',
      '"A6000000-0000-4000-8000-000000000014"'::jsonb
    ) manifest
  ) input$test$,
  '22023',
  'invalid_argument: incomplete mapping import item',
  'SQL rejects noncanonical uppercase UUIDs before execution'
);
select throws_ok(
  $test$select public.preview_crm_source_identity_mapping_import(
    manifest, pg_temp.manifest_hash(manifest)
  ) from (
    select jsonb_set(
      pg_temp.reject_mapping_manifest(
        'a5000000-0000-4000-8000-000000000015',
        'a6000000-0000-4000-8000-000000000015',
        'canonical-external-id'
      ),
      '{mappings,0,externalId}',
      '" canonical-external-id "'::jsonb
    ) manifest
  ) input$test$,
  '22023',
  'invalid_argument: incomplete mapping import item',
  'SQL rejects whitespace aliases before duplicate identity checks'
);
reset role;

set local role authenticated;
insert into mapping_plan_evidence (phase, manifest, result)
select 'ready', manifest, public.preview_crm_source_identity_mapping_import(
  manifest, pg_temp.manifest_hash(manifest)
)
from (
  select pg_temp.mapping_manifest(
    'a5000000-0000-4000-8000-000000000002',
    'a6000000-0000-4000-8000-000000000002',
    'authorized-organization', 'mapping-authority-owner'
  ) as manifest
) input;
reset role;
select is(
  (select jsonb_build_array(
    result -> 'ready', result #> '{items,0,disposition}', result -> 'conflictCount'
  ) from mapping_plan_evidence where phase = 'ready'),
  '[true,"create_verified",0]'::jsonb,
  'authorized preview produces a conflict-free create plan'
);
select is(
  (select first.result ->> 'planHash'
   from mapping_plan_evidence first where first.phase = 'ready'),
  (select second.result ->> 'planHash'
   from mapping_plan_evidence first
   cross join lateral (
     select public.preview_crm_source_identity_mapping_import(
       first.manifest, pg_temp.manifest_hash(first.manifest)
     ) result
   ) second
   where first.phase = 'ready'),
  'unchanged mapping state produces the same deterministic plan hash'
);

set local role authenticated;
select throws_ok(
  $test$select public.apply_crm_source_identity_mapping_import(
      evidence.manifest,
      pg_temp.manifest_hash(evidence.manifest),
      repeat('a', 64)
    )
    from mapping_plan_evidence evidence where evidence.phase = 'ready'$test$,
  '23505',
  'conflict: mapping import plan is stale',
  'apply rejects a stale or unreviewed plan hash'
);
reset role;
select is(
  (select count(*) from private.crm_mapping_import_batches),
  0::bigint,
  'stale plan rejection rolls back the entire mapping batch'
);

set local role authenticated;
insert into mapping_apply_result (result)
select public.apply_crm_source_identity_mapping_import(
  evidence.manifest,
  pg_temp.manifest_hash(evidence.manifest),
  evidence.result ->> 'planHash'
) as result
from mapping_plan_evidence evidence where evidence.phase = 'ready';
reset role;
select is(
  (select jsonb_build_array(
    result ->> 'mode', result ->> 'ok', result ->> 'appliedCount', result ->> 'noop'
  ) from mapping_apply_result),
  '["apply","true","1","false"]'::jsonb,
  'reviewed mapping plan applies atomically with explicit evidence'
);
select ok(
  exists (
    select 1 from public.crm_source_identities identity
    where identity.source = 'cutover-test'
      and identity.entity_kind = 'organization'
      and identity.external_id = 'authorized-organization'
      and identity.organization_id = 'a4000000-0000-4000-8000-000000000001'
      and identity.mapping_status = 'verified'
      and identity.mapping_owner_id = 'a3000000-0000-4000-8000-000000000003'
  ),
  'apply stores only the reviewed canonical target and authority owner'
);
select is(
  (select jsonb_build_array(
    (select count(*) from private.crm_mapping_import_batches
      where batch_request_id = 'a5000000-0000-4000-8000-000000000002'),
    (select count(*) from private.crm_mapping_import_items
      where batch_request_id = 'a5000000-0000-4000-8000-000000000002'),
    (select count(*) from public.audit_logs
      where action = 'integration.mapping_import_apply'
        and after ->> 'manifest_hash' = pg_temp.manifest_hash(
          (select manifest from mapping_plan_evidence where phase = 'ready')
        ))
  )),
  '[1,1,1]'::jsonb,
  'apply records one batch, one item and one sanitized audit event'
);

select is(
  (public.review_crm_source_identity_mapping(jsonb_build_object(
    'requestId', 'a6000000-0000-4000-8000-000000000020',
    'source', 'cutover-test',
    'entityKind', 'organization',
    'externalId', 'authorized-organization',
    'decision', 'reject',
    'evidenceReference', 'test://mapping/state-change',
    'reason', 'official_test_fixture_state_changed'
  )) ->> 'ok'),
  'true'::text,
  'the owner-only primitive can record a later audited state change'
);
set local role authenticated;
select is(
  (public.preview_crm_source_identity_mapping_import(
    manifest, pg_temp.manifest_hash(manifest)
  ) #>> '{items,0,reasonCode}'),
  'request_id_reused'::text,
  'a new batch treats every historical command request ID as a conflict'
)
from (
  select pg_temp.mapping_manifest(
    'a5000000-0000-4000-8000-000000000020',
    'a6000000-0000-4000-8000-000000000002',
    'authorized-organization', 'mapping-authority-owner'
  ) manifest
) input;
reset role;

set local role authenticated;
select throws_ok(
  $test$select public.apply_crm_source_identity_mapping_import(
    jsonb_set(
      evidence.manifest,
      '{evidenceReference}',
      '"test://mapping/tampered-replay"'::jsonb
    ),
    pg_temp.manifest_hash(evidence.manifest),
    evidence.result ->> 'planHash'
  )
  from mapping_plan_evidence evidence where evidence.phase = 'ready'$test$,
  '23505',
  'conflict: mapping manifest hash mismatch',
  'historical batch replay validates the supplied body before returning noop'
);
select is(
  (public.apply_crm_source_identity_mapping_import(
    evidence.manifest,
    pg_temp.manifest_hash(evidence.manifest),
    evidence.result ->> 'planHash'
  )->>'noop'),
  'true'::text,
  'exact batch replay is an audited-state no-op'
)
from mapping_plan_evidence evidence where evidence.phase = 'ready';
reset role;
select is(
  (select count(*) from public.crm_source_identities
   where source = 'cutover-test' and external_id = 'authorized-organization'),
  1::bigint,
  'mapping batch replay creates no duplicate identity'
);

update private.crm_mapping_source_authorities set apply_enabled = false
where source = 'cutover-test' and entity_kind = 'organization';
set local role authenticated;
select is(
  (public.preview_crm_source_identity_mapping_import(
    manifest, pg_temp.manifest_hash(manifest)
  ) #>> '{items,0,reasonCode}'),
  'mapping_authority_missing'::text,
  'database authority kill switch blocks new mapping plans'
)
from (
  select pg_temp.mapping_manifest(
    'a5000000-0000-4000-8000-000000000003',
    'a6000000-0000-4000-8000-000000000003',
    'authority-disabled', 'mapping-authority-owner'
  ) manifest
) input;
reset role;

set local role authenticated;
select throws_ok(
  $$select count(*) from private.crm_mapping_import_batches$$,
  '42501',
  null,
  'authenticated sessions cannot read private mapping batch evidence directly'
);
reset role;
set local role service_role;
select throws_ok(
  $$select qlik_relay.ingest_snapshot(
      '{}'::jsonb, 'shadow', 'x', now(), repeat('a', 64), repeat('b', 64)
    )$$,
  '42501',
  null,
  'service_role cannot execute the relay wrapper'
);
reset role;
select ok(
  not has_function_privilege(
    'crm_qlik_relay',
    'public.preview_crm_source_identity_mapping_import(jsonb,text)',
    'EXECUTE'
  ),
  'relay role cannot execute mapping reconciliation RPCs'
);

select * from finish();
rollback;
