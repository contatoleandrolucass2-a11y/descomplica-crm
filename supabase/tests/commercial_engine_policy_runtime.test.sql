begin;

select plan(93);

-- This suite uses an identity/echo document only to exercise governance and
-- isolation. It is not an approved commercial formula, value or golden case.

select ok(
  to_regclass('private.crm_commercial_engine_catalog') is not null
  and to_regclass('private.crm_commercial_policy_versions') is not null
  and to_regclass('private.crm_commercial_policy_imports') is not null
  and to_regclass('private.crm_commercial_engine_gates') is not null
  and to_regclass('private.crm_commercial_engine_executions') is not null,
  'commercial runtime tables exist only in the private schema'
);

select ok(
  exists (select 1 from pg_catalog.pg_roles where rolname = 'crm_commercial_engine')
  and (
    select not role.rolsuper
      and not role.rolcreatedb
      and not role.rolcreaterole
      and not role.rolinherit
      and not role.rolcanlogin
      and not role.rolreplication
      and not role.rolbypassrls
      and role.rolconnlimit = 2
    from pg_catalog.pg_roles role
    where role.rolname = 'crm_commercial_engine'
  ),
  'dedicated commercial runtime role is bounded and NOLOGIN'
);

select ok(
  (
    select pg_catalog.pg_get_userbyid(namespace.nspowner) = 'postgres'
      and has_schema_privilege('crm_commercial_engine', 'commercial_engine', 'USAGE')
      and not has_schema_privilege('anon', 'commercial_engine', 'USAGE')
      and not has_schema_privilege('authenticated', 'commercial_engine', 'USAGE')
      and not has_schema_privilege('service_role', 'commercial_engine', 'USAGE')
      and not has_schema_privilege('crm_qlik_relay', 'commercial_engine', 'USAGE')
    from pg_catalog.pg_namespace namespace
    where namespace.nspname = 'commercial_engine'
  ),
  'commercial runtime schema is postgres-owned and visible only to its capability role'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = (
      select role.oid from pg_catalog.pg_roles role
      where role.rolname = 'crm_commercial_engine'
    )
      or (
        membership.roleid = (
          select role.oid from pg_catalog.pg_roles role
          where role.rolname = 'crm_commercial_engine'
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
  'commercial runtime role has no runtime-usable membership path'
);

select is(
  (
    select array_agg(catalog.engine_key order by catalog.engine_key)
    from private.crm_commercial_engine_catalog catalog
  ),
  array[
    'awards.calculation',
    'campaign.eligibility',
    'goals.dv',
    'goals.partnerships',
    'points.ranking',
    'ranking.broker',
    'ranking.manager',
    'roulette.eligibility',
    'simulator.caixa',
    'simulator.wf13',
    'simulator.wf14',
    'simulator.wf15',
    'simulator.wf16',
    'sla.loss'
  ]::text[],
  'catalog contains exactly the fourteen authorized structural engine keys'
);

select is(
  (
    select jsonb_agg(jsonb_build_object(
      'engineKey', catalog.engine_key,
      'domain', catalog.domain,
      'permission', catalog.required_permission_key,
      'interactive', catalog.interactive
    ) order by catalog.engine_key)
    from private.crm_commercial_engine_catalog catalog
  ),
  '[
    {"engineKey":"awards.calculation","domain":"awards","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"campaign.eligibility","domain":"campaign","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"goals.dv","domain":"goals","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"goals.partnerships","domain":"goals","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"points.ranking","domain":"points","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"ranking.broker","domain":"ranking","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"ranking.manager","domain":"ranking","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"roulette.eligibility","domain":"roulette","permission":"crm.commercial_engine.execute","interactive":false},
    {"engineKey":"simulator.caixa","domain":"simulator","permission":"crm.simulators.execute","interactive":true},
    {"engineKey":"simulator.wf13","domain":"simulator","permission":"crm.simulators.execute","interactive":true},
    {"engineKey":"simulator.wf14","domain":"simulator","permission":"crm.simulators.execute","interactive":true},
    {"engineKey":"simulator.wf15","domain":"simulator","permission":"crm.simulators.execute","interactive":true},
    {"engineKey":"simulator.wf16","domain":"simulator","permission":"crm.simulators.execute","interactive":true},
    {"engineKey":"sla.loss","domain":"sla","permission":"crm.commercial_engine.execute","interactive":false}
  ]'::jsonb,
  'catalog maps each engine to its exact domain, permission and runtime surface'
);

select is(
  (
    select jsonb_build_array(
      (select count(*) from private.crm_commercial_policy_versions),
      (select count(*) from private.crm_commercial_policy_imports),
      (select count(*) from private.crm_commercial_engine_gates),
      (select count(*) from private.crm_commercial_engine_executions)
    )
  ),
  '[0,0,0,0]'::jsonb,
  'migration seeds no policy, import, gate or execution evidence'
);

select is(
  (
    select jsonb_agg(jsonb_build_object(
      'key', permission.key,
      'minLevel', permission.min_level
    ) order by permission.key)
    from public.permissions permission
    where permission.key in (
      'crm.commercial_engine.execute',
      'crm.commercial_policy.manage',
      'crm.simulators.execute'
    )
  ),
  '[
    {"key":"crm.commercial_engine.execute","minLevel":100},
    {"key":"crm.commercial_policy.manage","minLevel":100},
    {"key":"crm.simulators.execute","minLevel":100}
  ]'::jsonb,
  'commercial management and execution permissions have bounded hierarchy levels'
);

select is(
  (
    select array_agg(
      role_permission.role_key || ':' || role_permission.permission_key
      order by role_permission.role_key, role_permission.permission_key
    )
    from public.role_permissions role_permission
    where role_permission.permission_key in (
      'crm.commercial_engine.execute',
      'crm.commercial_policy.manage',
      'crm.simulators.execute'
    )
  ),
  array[
    'master:crm.commercial_policy.manage',
    'master:crm.simulators.execute'
  ]::text[],
  'commercial management and simulator execution are Master-only'
);

select ok(
  (
    select bool_and(class.relrowsecurity and class.relforcerowsecurity)
    from pg_catalog.pg_class class
    where class.oid in (
      'private.crm_commercial_engine_catalog'::regclass,
      'private.crm_commercial_policy_versions'::regclass,
      'private.crm_commercial_policy_imports'::regclass,
      'private.crm_commercial_engine_gates'::regclass,
      'private.crm_commercial_engine_executions'::regclass
    )
  ),
  'all commercial runtime tables enable and force RLS'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_policy policy
    where policy.polrelid in (
      'private.crm_commercial_engine_catalog'::regclass,
      'private.crm_commercial_policy_versions'::regclass,
      'private.crm_commercial_policy_imports'::regclass,
      'private.crm_commercial_engine_gates'::regclass,
      'private.crm_commercial_engine_executions'::regclass
    )
  ),
  'private tables expose no permissive RLS policy'
);

select ok(
  not exists (
    select 1
    from (values
      ('anon'), ('authenticated'), ('service_role'), ('crm_qlik_relay')
    ) roles(name)
    cross join (values
      ('private.crm_commercial_engine_catalog'),
      ('private.crm_commercial_policy_versions'),
      ('private.crm_commercial_policy_imports'),
      ('private.crm_commercial_engine_gates'),
      ('private.crm_commercial_engine_executions')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(roles.name, tables.name, privileges.name)
  )
  and not exists (
    select 1
    from pg_catalog.pg_class class
    cross join lateral pg_catalog.aclexplode(class.relacl) acl
    where class.oid in (
      'private.crm_commercial_engine_catalog'::regclass,
      'private.crm_commercial_policy_versions'::regclass,
      'private.crm_commercial_policy_imports'::regclass,
      'private.crm_commercial_engine_gates'::regclass,
      'private.crm_commercial_engine_executions'::regclass
    )
      and acl.grantee = 0
  ),
  'PUBLIC, Data API and relay roles have zero direct table ACL'
);

select ok(
  to_regprocedure(
    'public.preview_crm_commercial_policy_import(jsonb)'
  ) is not null
  and to_regprocedure(
    'public.apply_crm_commercial_policy_import(jsonb,text)'
  ) is not null
  and to_regprocedure(
    'public.set_crm_commercial_engine_gate(text,text,text,text,text)'
  ) is not null
  and to_regprocedure(
    'commercial_engine.get_policy(uuid,text,text)'
  ) is not null
  and to_regprocedure(
    'commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)'
  ) is not null,
  'versioned management and interactive runtime RPC contracts exist'
);

select ok(
  (
    select bool_and(
      function_row.prosecdef
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
      and 'search_path=""' = any(function_row.proconfig)
      and exists (
        select 1 from unnest(function_row.proconfig) config(value)
        where config.value like 'statement_timeout=%'
      )
    )
    from pg_catalog.pg_proc function_row
    where function_row.oid in (
      'private.build_crm_commercial_policy_import_plan(jsonb)'::regprocedure,
      'public.preview_crm_commercial_policy_import(jsonb)'::regprocedure,
      'public.apply_crm_commercial_policy_import(jsonb,text)'::regprocedure,
      'public.set_crm_commercial_engine_gate(text,text,text,text,text)'::regprocedure,
      'commercial_engine.get_policy(uuid,text,text)'::regprocedure,
      'commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)'::regprocedure
    )
  ),
  'privileged RPCs are postgres-owned, bounded and use an empty search path'
);

select ok(
  not has_function_privilege(
    'anon', 'private.build_crm_commercial_policy_import_plan(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'private.build_crm_commercial_policy_import_plan(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'service_role', 'private.build_crm_commercial_policy_import_plan(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'crm_qlik_relay', 'private.build_crm_commercial_policy_import_plan(jsonb)', 'EXECUTE'
  )
  and not has_function_privilege(
    'anon', 'private.prevent_crm_commercial_immutable_change()', 'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated', 'private.prevent_crm_commercial_immutable_change()', 'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc function_row
    cross join lateral pg_catalog.aclexplode(function_row.proacl) acl
    where function_row.oid in (
      'private.build_crm_commercial_policy_import_plan(jsonb)'::regprocedure,
      'private.prevent_crm_commercial_immutable_change()'::regprocedure
    )
      and acl.grantee = 0
  ),
  'private helpers have zero PUBLIC, Data API and relay EXECUTE privilege'
);

select ok(
  (
    select bool_and(
      has_function_privilege('authenticated', function_oid, 'EXECUTE')
      and not has_function_privilege('anon', function_oid, 'EXECUTE')
      and not has_function_privilege('service_role', function_oid, 'EXECUTE')
      and not has_function_privilege('crm_qlik_relay', function_oid, 'EXECUTE')
    )
    from unnest(array[
      'public.preview_crm_commercial_policy_import(jsonb)'::regprocedure,
      'public.apply_crm_commercial_policy_import(jsonb,text)'::regprocedure,
      'public.set_crm_commercial_engine_gate(text,text,text,text,text)'::regprocedure
    ]) function_oid
  ),
  'only authenticated sessions can enter public management RPCs before authorization'
);

select ok(
  has_function_privilege(
    'crm_commercial_engine',
    'commercial_engine.get_policy(uuid,text,text)', 'EXECUTE'
  )
  and has_function_privilege(
    'crm_commercial_engine',
    'commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from (values
      ('anon'), ('authenticated'), ('service_role'), ('crm_qlik_relay')
    ) roles(name)
    cross join (values
      ('commercial_engine.get_policy(uuid,text,text)'),
      ('commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)')
    ) functions(signature)
    where has_function_privilege(roles.name, functions.signature, 'EXECUTE')
  ),
  'only dedicated runtime role can execute server policy functions'
);

select ok(
  not exists (
    select 1
    from (values
      ('public.profiles'),
      ('public.user_roles'),
      ('public.user_permission_overrides'),
      ('private.crm_commercial_engine_catalog'),
      ('private.crm_commercial_policy_versions'),
      ('private.crm_commercial_policy_imports'),
      ('private.crm_commercial_engine_gates'),
      ('private.crm_commercial_engine_executions')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'crm_commercial_engine', tables.name, privileges.name
    )
  ),
  'dedicated runtime role has no direct authorization or commercial table privilege'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'commercial_engine.get_policy(uuid,text,text)'::regprocedure
  ) like '%catalog.interactive%'
  and pg_catalog.pg_get_functiondef(
    'commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)'::regprocedure
  ) like '%catalog.interactive%',
  'interactive RPCs fail closed for server-only commercial engines'
);

select ok(
  (
    select function_row.prosecdef
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
      and 'search_path=""' = any(function_row.proconfig)
    from pg_catalog.pg_proc function_row
    where function_row.oid =
      'private.crm_commercial_engine_role_isolated()'::regprocedure
  )
  and pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%not coalesce(pg_catalog.has_schema_privilege(''crm_commercial_engine'', pg_catalog.to_regnamespace(''net''), ''USAGE''), false)%'
  and pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%has_database_privilege(%'
  and pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%pg_get_userbyid(function_row.proowner) = ''postgres''%'
  and pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%function_row.prosecdef%'
  and pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  ) like '%statement_timeout=10s%'
  and not has_function_privilege(
    'crm_commercial_engine',
    'private.crm_commercial_engine_role_isolated()', 'EXECUTE'
  ),
  'runtime isolation checker is protected and validates inherited capabilities'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.apply_crm_commercial_policy_import(jsonb,text)'::regprocedure
  ) like '%private.lock_and_assert_actor(v_actor)%'
  and pg_catalog.pg_get_functiondef(
    'public.set_crm_commercial_engine_gate(text,text,text,text,text)'::regprocedure
  ) like '%private.lock_and_assert_actor(v_actor)%'
  and pg_catalog.pg_get_functiondef(
    'commercial_engine.record_execution(uuid,text,text,text,uuid,text,text,integer)'::regprocedure
  ) like '%private.lock_and_assert_actor(p_actor_user_id)%',
  'all commercial mutators lock and revalidate the actor before mutation'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid in (
      'private.crm_commercial_policy_versions'::regclass,
      'private.crm_commercial_policy_imports'::regclass,
      'private.crm_commercial_engine_executions'::regclass
    )
      and not trigger_row.tgisinternal
      and trigger_row.tgfoid =
        'private.prevent_crm_commercial_immutable_change()'::regprocedure
  ),
  3::bigint,
  'policy, import and execution histories have immutable triggers'
);

insert into auth.users (id, email) values
  ('c1000000-0000-4000-8000-000000000001', 'commercial-master@example.test'),
  ('c1000000-0000-4000-8000-000000000002', 'commercial-pending@example.test');

select public.bootstrap_master_user(
  'c1000000-0000-4000-8000-000000000001'
);

insert into private.crm_integration_owners (
  id, owner_key, display_name, owner_kind
) values
  (
    'c2000000-0000-4000-8000-000000000001',
    'qa-policy-owner', 'QA policy owner', 'team'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'qa-policy-backup', 'QA policy backup', 'team'
  ),
  (
    'c2000000-0000-4000-8000-000000000003',
    'qa-policy-inactive', 'QA inactive owner', 'team'
  );

update private.crm_integration_owners
set is_active = false
where owner_key = 'qa-policy-inactive';

create function pg_temp.qa_commercial_manifest(
  p_request_id uuid,
  p_engine_key text default 'simulator.wf13',
  p_version integer default 1,
  p_owner_key text default 'qa-policy-owner',
  p_backup_owner_key text default 'qa-policy-backup',
  p_effective_from timestamptz default '2026-01-01T00:00:00Z',
  p_effective_until timestamptz default '2099-01-01T00:00:00Z',
  p_policy_hash text default '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
  p_golden_report_hash text default 'fcf45056ed2df1bcf392ff842ef30e2818ac297ae3467e44ccde5001043cdf0a'
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'requestId', p_request_id::text,
    'policy', jsonb_build_object(
      'schemaVersion', 1,
      'engineKey', p_engine_key,
      'version', p_version,
      'effectiveFrom', to_char(
        p_effective_from at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'effectiveUntil', to_char(
        p_effective_until at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'timezone', 'America/Sao_Paulo',
      'ownerKey', p_owner_key,
      'backupOwnerKey', p_backup_owner_key,
      'evidenceReference', 'test://commercial/structural-only',
      'changeReason', 'QA structural identity fixture; no commercial authority',
      'definition', jsonb_build_object(
        'schemaVersion', 1,
        'runtimeVersion', 1,
        'inputs', jsonb_build_array(jsonb_build_object(
          'key', 'qa_value',
          'valueType', 'decimal'
        )),
        'outputs', jsonb_build_array(jsonb_build_object(
          'key', 'qa_echo',
          'valueType', 'decimal',
          'expression', jsonb_build_object(
            'op', 'input',
            'key', 'qa_value'
          )
        ))
      ),
      'goldenCases', jsonb_build_array(jsonb_build_object(
        'caseKey', 'qa.identity.zero',
        'input', jsonb_build_object('qa_value', '0'),
        'expected', jsonb_build_object('qa_echo', '0')
      ))
    ),
    'policyHash', p_policy_hash,
    'goldenReportHash', p_golden_report_hash
  );
$$;

grant execute on function pg_temp.qa_commercial_manifest(
  uuid, text, integer, text, text, timestamptz, timestamptz, text, text
) to authenticated;

select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
  $$select public.preview_crm_commercial_policy_import('{}'::jsonb)$$,
  '42501',
  null,
  'anonymous caller cannot execute policy preview'
);

select throws_ok(
  $$select commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'shadow')$$,
  '42501',
  null,
  'anonymous caller cannot execute interactive policy lookup'
);

reset role;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;

select throws_ok(
  $$select public.preview_crm_commercial_policy_import('{}'::jsonb)$$,
  '42501',
  'forbidden: commercial policy preview is not permitted',
  'authenticated session without an identity cannot preview policies'
);

select throws_ok(
  $$select commercial_engine.get_policy(
      'c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow'
    )$$,
  '42501',
  null,
  'authenticated session cannot enter the server-only runtime schema'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000001',
      repeat('c', 64), repeat('d', 64), 1
    )$$,
  '42501',
  null,
  'authenticated session cannot call the server-only execution ledger RPC'
);

select set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000002'
      )
    )$$,
  '42501',
  'forbidden: commercial policy preview is not permitted',
  'pending user without management permission cannot preview policies'
);

reset role;

alter role crm_commercial_engine login;

select is(
  private.crm_commercial_engine_role_isolated(),
  false,
  'Supabase baseline PUBLIC capabilities keep the commercial role fail-closed'
);

select throws_ok(
  $$select commercial_engine.get_policy(
      'c1000000-0000-4000-8000-000000000002',
      'simulator.wf13', 'shadow'
    )$$,
  '42501',
  'forbidden: commercial engine role is not isolated',
  'runtime policy lookup rejects an unisolated capability role'
);

alter role crm_commercial_engine nologin;

select is(
  commercial_engine.get_policy(
    'c1000000-0000-4000-8000-000000000002',
    'simulator.wf13', 'shadow'
  ),
  null::jsonb,
  'dedicated runtime returns no policy for a pending actor without permission'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
update public.profiles
set is_active = false
where user_id = 'c1000000-0000-4000-8000-000000000001';
select set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true
);
set local role authenticated;

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000003'
      )
    )$$,
  '42501',
  'forbidden: commercial policy preview is not permitted',
  'inactive Master cannot preview policies'
);

reset role;
select throws_ok(
  $$select commercial_engine.record_execution(
      'c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000004',
      repeat('c', 64), repeat('d', 64), 1
    )$$,
  '42501',
  'forbidden: actor is not approved',
  'runtime evidence revalidates and blocks an inactive actor'
);

reset request.jwt.claim.sub;
reset request.jwt.claim.role;
update public.profiles
set is_active = true
where user_id = 'c1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true
);
set local role authenticated;

select is(
  (
    public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      )
    ) ->> 'disposition'
  ),
  'create'::text,
  'authorized Master preview plans a new policy version'
);

select is(
  (
    public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      )
    ) ->> 'ready'
  ),
  'true'::text,
  'valid governance and one structural golden case make preview ready'
);

reset role;
select is(
  (
    select jsonb_build_array(
      (select count(*) from private.crm_commercial_policy_versions),
      (select count(*) from private.crm_commercial_policy_imports),
      (select count(*) from private.crm_commercial_engine_gates),
      (select count(*) from private.crm_commercial_engine_executions)
    )
  ),
  '[0,0,0,0]'::jsonb,
  'preview performs no mutation'
);
set local role authenticated;

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000011',
        'simulator.wf13', 1, 'qa-policy-owner', 'qa-policy-owner'
      )
    )$$,
  '22023',
  null,
  'preview rejects the same owner and backup'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000012',
        'simulator.wf13', 1, 'qa-policy-owner', 'qa-policy-missing'
      )
    )$$,
  '23505',
  'conflict: commercial policy owners are unavailable',
  'preview rejects a missing backup owner'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000013',
        'simulator.wf13', 1, 'qa-policy-owner', 'qa-policy-inactive'
      )
    )$$,
  '23505',
  'conflict: commercial policy owners are unavailable',
  'preview rejects an inactive backup owner'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      jsonb_set(
        pg_temp.qa_commercial_manifest(
          'c3000000-0000-4000-8000-000000000014'
        ),
        '{policy,goldenCases}',
        '[]'::jsonb
      )
    )$$,
  '22023',
  null,
  'preview rejects policy documents without a mandatory golden case'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000015'
      ) || jsonb_build_object('unexpected', true)
    )$$,
  '22023',
  null,
  'preview rejects an unknown manifest field'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      jsonb_set(
        pg_temp.qa_commercial_manifest(
          'c3000000-0000-4000-8000-000000000016'
        ),
        '{policyHash}',
        to_jsonb('not-a-hash'::text)
      )
    )$$,
  '22023',
  null,
  'preview rejects a malformed runtime policy hash'
);

select throws_ok(
  $$select public.preview_crm_commercial_policy_import(
      jsonb_set(
        pg_temp.qa_commercial_manifest(
          'c3000000-0000-4000-8000-000000000017'
        ),
        '{policy,effectiveUntil}',
        to_jsonb('2000-01-01T00:00:00Z'::text)
      )
    )$$,
  '22023',
  null,
  'preview rejects an inverted policy effectivity window'
);

select set_config(
  'test.qa_commercial_plan_hash',
  public.preview_crm_commercial_policy_import(
    pg_temp.qa_commercial_manifest(
      'c3000000-0000-4000-8000-000000000010'
    )
  ) ->> 'planHash',
  true
);

select throws_ok(
  $$select public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      ),
      repeat('f', 64)
    )$$,
  '23505',
  'conflict: commercial policy import plan is stale',
  'apply rejects a stale or unreviewed plan hash'
);

select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      ),
      current_setting('test.qa_commercial_plan_hash')
    ) ->> 'disposition'
  ),
  'create'::text,
  'apply imports the exact reviewed create plan'
);

reset role;
select is(
  (
    select jsonb_build_object(
      'engineKey', policy.engine_key,
      'version', policy.version,
      'goldenCount', policy.golden_case_count,
      'owner', owner.owner_key,
      'backup', backup_owner.owner_key,
      'approvedBy', policy.approved_by,
      'timezone', policy.timezone
    )
    from private.crm_commercial_policy_versions policy
    join private.crm_integration_owners owner on owner.id = policy.owner_id
    join private.crm_integration_owners backup_owner
      on backup_owner.id = policy.backup_owner_id
    where policy.engine_key = 'simulator.wf13'
      and policy.version = 1
  ),
  jsonb_build_object(
    'engineKey', 'simulator.wf13',
    'version', 1,
    'goldenCount', 1,
    'owner', 'qa-policy-owner',
    'backup', 'qa-policy-backup',
    'approvedBy', 'c1000000-0000-4000-8000-000000000001'::uuid,
    'timezone', 'America/Sao_Paulo'
  ),
  'import persists version, distinct owners, golden count, approver and timezone'
);

select ok(
  (
    select policy.db_document_hash = encode(extensions.digest(
      convert_to(policy.policy_document::text, 'UTF8'), 'sha256'
    ), 'hex')
      and policy.db_document_hash = 'bdb575423c016f69c67f99924c2e4fe94603476c18f49a31d73dca6ff8d7d239'
      and policy.runtime_policy_hash = '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774'
      and policy.golden_report_hash = 'fcf45056ed2df1bcf392ff842ef30e2818ac297ae3467e44ccde5001043cdf0a'
    from private.crm_commercial_policy_versions policy
    where policy.engine_key = 'simulator.wf13' and policy.version = 1
  ),
  'import binds the fixed shared SQL document, runtime and golden report hashes'
);

select is(
  (
    select count(*) from public.audit_logs audit
    where audit.action = 'commercial.policy_import_apply'
      and audit.actor_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'policy import creates one sanitized audit event'
);

set local role authenticated;
select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      ),
      current_setting('test.qa_commercial_plan_hash')
    ) ->> 'replay'
  ),
  'true'::text,
  'exact request replay is idempotent'
);

reset role;
select is(
  (select count(*) from private.crm_commercial_policy_versions),
  1::bigint,
  'exact replay creates no duplicate policy version'
);

update private.crm_integration_owners
set is_active = false
where owner_key = 'qa-policy-owner';
set local role authenticated;
select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000010'
      ),
      current_setting('test.qa_commercial_plan_hash')
    ) ->> 'replay'
  ),
  'true'::text,
  'historical replay remains idempotent after owner deactivation'
);
reset role;
update private.crm_integration_owners
set is_active = true
where owner_key = 'qa-policy-owner';
set local role authenticated;

select throws_ok(
  $$select public.apply_crm_commercial_policy_import(
      jsonb_set(
        pg_temp.qa_commercial_manifest(
          'c3000000-0000-4000-8000-000000000010'
        ),
        '{policyHash}',
        to_jsonb(repeat('c', 64))
      ),
      current_setting('test.qa_commercial_plan_hash')
    )$$,
  '23505',
  'conflict: commercial policy request id was reused',
  'altered replay with the same request id is rejected'
);

select is(
  (
    public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000020'
      )
    ) ->> 'disposition'
  ),
  'noop'::text,
  'new request for an identical engine version plans a no-op'
);

select set_config(
  'test.qa_commercial_noop_plan_hash',
  public.preview_crm_commercial_policy_import(
    pg_temp.qa_commercial_manifest(
      'c3000000-0000-4000-8000-000000000020'
    )
  ) ->> 'planHash',
  true
);

select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000020'
      ),
      current_setting('test.qa_commercial_noop_plan_hash')
    ) ->> 'noop'
  ),
  'true'::text,
  'reviewed no-op creates only an idempotency record'
);

reset role;
select is(
  (
    select jsonb_build_array(
      (select count(*) from private.crm_commercial_policy_versions),
      (select count(*) from private.crm_commercial_policy_imports)
    )
  ),
  '[1,2]'::jsonb,
  'create plus no-op preserve one policy and two request records'
);

set local role authenticated;
select is(
  (
    public.preview_crm_commercial_policy_import(
      jsonb_set(
        pg_temp.qa_commercial_manifest(
          'c3000000-0000-4000-8000-000000000021'
        ),
        '{policy,changeReason}',
        to_jsonb('QA altered structural fixture'::text)
      )
    ) ->> 'reasonCode'
  ),
  'engine_version_conflict'::text,
  'same engine version with different content reports a deterministic conflict'
);

select set_config(
  'test.qa_commercial_monotonic_plan_hash',
  public.preview_crm_commercial_policy_import(
    pg_temp.qa_commercial_manifest(
      'c3000000-0000-4000-8000-000000000060',
      'simulator.wf15', 2
    )
  ) ->> 'planHash',
  true
);

select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000060',
        'simulator.wf15', 2
      ),
      current_setting('test.qa_commercial_monotonic_plan_hash')
    ) ->> 'disposition'
  ),
  'create'::text,
  'first reviewed policy establishes the engine version watermark'
);

select is(
  (
    public.preview_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000061',
        'simulator.wf15', 1
      )
    ) ->> 'reasonCode'
  ),
  'non_monotonic_version'::text,
  'preview rejects creation below the latest engine version'
);

reset role;

select throws_ok(
  $$update private.crm_commercial_policy_versions
    set change_reason = change_reason
    where engine_key = 'simulator.wf13' and version = 1$$,
  '55000',
  'immutable: commercial policy history cannot be changed',
  'approved policy versions cannot be updated'
);

select throws_ok(
  $$delete from private.crm_commercial_policy_imports
    where request_id = 'c3000000-0000-4000-8000-000000000020'$$,
  '55000',
  'immutable: commercial policy history cannot be changed',
  'policy import idempotency history cannot be deleted'
);

set local role authenticated;

select is(
  (
    public.set_crm_commercial_engine_gate(
      'simulator.wf13', null, 'disabled',
      'QA initialize closed gate', 'test://commercial/gate-disabled'
    ) ->> 'state'
  ),
  'disabled'::text,
  'commercial gate must be initialized disabled'
);

select throws_ok(
  $$select public.set_crm_commercial_engine_gate(
      'simulator.wf13', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'active',
      'QA invalid direct activation', 'test://commercial/invalid-active'
    )$$,
  '23505',
  'conflict: active requires shadow on the same policy',
  'disabled gate cannot transition directly to active'
);

select throws_ok(
  $$select public.set_crm_commercial_engine_gate(
      'simulator.wf13', repeat('c', 64), 'shadow',
      'QA wrong policy hash', 'test://commercial/wrong-hash'
    )$$,
  '23505',
  'conflict: approved commercial policy is unavailable',
  'shadow transition rejects an unknown policy hash'
);

select is(
  (
    public.set_crm_commercial_engine_gate(
      'simulator.wf13', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'shadow',
      'QA structural shadow', 'test://commercial/gate-shadow'
    ) ->> 'state'
  ),
  'shadow'::text,
  'disabled gate advances to shadow on the approved policy'
);

reset role;

select isnt(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'shadow'),
  null::jsonb,
  'Master receives the shadow simulator policy after the explicit execution grant'
);

select is(
  (
    commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000030',
      repeat('c', 64), repeat('d', 64), 1
    ) ->> 'replay'
  ),
  'false'::text,
  'Master can record simulator execution evidence after the explicit grant'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
) values (
  'c1000000-0000-4000-8000-000000000001',
  'crm.simulators.execute',
  'allow',
  'QA transaction-only runtime fixture',
  'c1000000-0000-4000-8000-000000000001'
), (
  'c1000000-0000-4000-8000-000000000001',
  'crm.commercial_engine.execute',
  'allow',
  'QA transaction-only server-engine fixture',
  'c1000000-0000-4000-8000-000000000001'
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true
);
select is(
  (
    select jsonb_build_object(
      'gateState', fetched.result ->> 'gateState',
      'policyHash', fetched.result ->> 'policyHash',
      'goldenReportHash', fetched.result ->> 'goldenReportHash',
      'goldenInput', fetched.result -> 'policy' -> 'goldenCases' -> 0 -> 'input'
    )
    from (
      select commercial_engine.get_policy(
        'c1000000-0000-4000-8000-000000000001',
        'simulator.wf13', 'shadow'
      ) result
    ) fetched
  ),
  jsonb_build_object(
    'gateState', 'shadow',
    'policyHash', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
    'goldenReportHash', 'fcf45056ed2df1bcf392ff842ef30e2818ac297ae3467e44ccde5001043cdf0a',
    'goldenInput', jsonb_build_object('qa_value', '0')
  ),
  'permitted actor receives the exact TS-verified shadow policy and goldens'
);

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'active'),
  null::jsonb,
  'shadow gate does not satisfy an active policy lookup'
);

select is(
  (
    commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000031',
      repeat('c', 64), repeat('d', 64), 7
    ) ->> 'replay'
  ),
  'false'::text,
  'permitted actor records first shadow execution evidence'
);

select is(
  (
    commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000031',
      repeat('c', 64), repeat('d', 64), 999
    ) ->> 'replay'
  ),
  'true'::text,
  'exact execution evidence replay is idempotent and ignores timing drift'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000031',
      repeat('e', 64), repeat('d', 64), 7
    )$$,
  '23505',
  'conflict: commercial execution request id was reused',
  'execution request id cannot be replayed with a different input hash'
);

reset role;

select is(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'crm_commercial_engine_executions'
  ),
  array[
    'id', 'engine_key', 'policy_id', 'actor_user_id', 'request_id',
    'mode', 'input_hash', 'output_hash', 'duration_ms', 'received_at'
  ]::text[],
  'execution ledger schema stores hashes and metadata only'
);

select is(
  (
    select jsonb_build_object(
      'engineKey', execution.engine_key,
      'mode', execution.mode,
      'inputHash', execution.input_hash,
      'outputHash', execution.output_hash,
      'durationMs', execution.duration_ms
    )
    from private.crm_commercial_engine_executions execution
    where execution.request_id =
      'c3000000-0000-4000-8000-000000000031'
  ),
  jsonb_build_object(
    'engineKey', 'simulator.wf13',
    'mode', 'shadow',
    'inputHash', repeat('c', 64),
    'outputHash', repeat('d', 64),
    'durationMs', 7
  ),
  'execution ledger records only the original hashes and bounded duration'
);

select throws_ok(
  $$delete from private.crm_commercial_engine_executions
    where request_id = 'c3000000-0000-4000-8000-000000000031'$$,
  '55000',
  'immutable: commercial policy history cannot be changed',
  'execution evidence cannot be deleted'
);

set local role authenticated;

select is(
  (
    public.set_crm_commercial_engine_gate(
      'simulator.wf13', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'active',
      'QA structural active', 'test://commercial/gate-active'
    ) ->> 'state'
  ),
  'active'::text,
  'same approved policy advances from shadow to active'
);

reset role;

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'shadow'),
  null::jsonb,
  'active gate no longer satisfies shadow lookup'
);

select is(
  (
    commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'active', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000032',
      repeat('c', 64), repeat('d', 64), 9
    ) ->> 'replay'
  ),
  'false'::text,
  'active gate accepts evidence only for active mode'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000033',
      repeat('c', 64), repeat('d', 64), 9
    )$$,
  '55000',
  'conflict: commercial policy gate is unavailable',
  'active gate rejects shadow execution evidence'
);

reset role;
update private.crm_integration_owners
set is_active = false
where owner_key = 'qa-policy-owner';

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'active'),
  null::jsonb,
  'inactive policy owner makes active lookup fail closed'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'active', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000034',
      repeat('c', 64), repeat('d', 64), 9
    )$$,
  '55000',
  'conflict: commercial policy gate is unavailable',
  'inactive policy owner blocks execution evidence'
);

reset role;
update private.crm_integration_owners
set is_active = true
where owner_key = 'qa-policy-owner';
set local role authenticated;

select is(
  (
    public.set_crm_commercial_engine_gate(
      'simulator.wf13', null, 'rolled_back',
      'QA rollback closes runtime', 'test://commercial/gate-rollback'
    ) ->> 'state'
  ),
  'rolled_back'::text,
  'running gate can be rolled back explicitly'
);

reset role;

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'simulator.wf13', 'active'),
  null::jsonb,
  'rolled-back gate returns no active policy'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'simulator.wf13', 'active', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000035',
      repeat('c', 64), repeat('d', 64), 9
    )$$,
  '55000',
  'conflict: commercial policy gate is unavailable',
  'rolled-back gate blocks new execution evidence'
);

reset role;
set local role authenticated;

select throws_ok(
  $$select public.set_crm_commercial_engine_gate(
      'simulator.wf13', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'shadow',
      'QA invalid rollback reopening', 'test://commercial/invalid-reopen'
    )$$,
  '23505',
  'conflict: invalid commercial shadow transition',
  'rolled-back gate cannot reopen directly to shadow'
);

-- Future-dated policy may be imported for review but cannot enter shadow.
select set_config(
  'test.qa_commercial_future_plan_hash',
  public.preview_crm_commercial_policy_import(
    pg_temp.qa_commercial_manifest(
      'c3000000-0000-4000-8000-000000000040',
      'simulator.wf14', 1,
      'qa-policy-owner', 'qa-policy-backup',
      now() + interval '1 day', now() + interval '2 days'
    )
  ) ->> 'planHash',
  true
);

select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000040',
        'simulator.wf14', 1,
        'qa-policy-owner', 'qa-policy-backup',
        now() + interval '1 day', now() + interval '2 days'
      ),
      current_setting('test.qa_commercial_future_plan_hash')
    ) ->> 'disposition'
  ),
  'create'::text,
  'future-dated policy can be versioned without activating it'
);

select lives_ok(
  $$select public.set_crm_commercial_engine_gate(
      'simulator.wf14', null, 'disabled',
      'QA future gate closed', 'test://commercial/future-disabled'
    )$$,
  'future-dated engine gate initializes disabled'
);

select throws_ok(
  $$select public.set_crm_commercial_engine_gate(
      'simulator.wf14', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'shadow',
      'QA future policy rejected', 'test://commercial/future-shadow'
    )$$,
  '23505',
  'conflict: approved commercial policy is unavailable',
  'future-dated policy cannot enter shadow before effectivity'
);

-- A server-only engine can be governed and gated, but never fetched or
-- evidenced through the interactive browser RPCs in this increment.
select set_config(
  'test.qa_commercial_awards_plan_hash',
  public.preview_crm_commercial_policy_import(
    pg_temp.qa_commercial_manifest(
      'c3000000-0000-4000-8000-000000000050',
      'awards.calculation'
    )
  ) ->> 'planHash',
  true
);

select is(
  (
    public.apply_crm_commercial_policy_import(
      pg_temp.qa_commercial_manifest(
        'c3000000-0000-4000-8000-000000000050',
        'awards.calculation'
      ),
      current_setting('test.qa_commercial_awards_plan_hash')
    ) ->> 'disposition'
  ),
  'create'::text,
  'server-only policy uses the same versioned governance path'
);

select lives_ok(
  $$select public.set_crm_commercial_engine_gate(
      'awards.calculation', null, 'disabled',
      'QA awards gate closed', 'test://commercial/awards-disabled'
    )$$,
  'server-only engine gate initializes disabled'
);

select lives_ok(
  $$select public.set_crm_commercial_engine_gate(
      'awards.calculation', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774', 'shadow',
      'QA awards structural shadow', 'test://commercial/awards-shadow'
    )$$,
  'server-only engine can enter governed shadow without browser exposure'
);

reset role;

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'awards.calculation', 'shadow'),
  null::jsonb,
  'server-only awards policy is unavailable through interactive lookup'
);

select is(
  commercial_engine.get_policy('c1000000-0000-4000-8000-000000000001', 'goals.dv', 'shadow'),
  null::jsonb,
  'server-only goals policy is unavailable through interactive lookup'
);

select throws_ok(
  $$select commercial_engine.record_execution('c1000000-0000-4000-8000-000000000001',
      'awards.calculation', 'shadow', '79c9cd65725a73aeb7a7763750bd820241d62e9474e48adf6da609be38ca1774',
      'c3000000-0000-4000-8000-000000000051',
      repeat('c', 64), repeat('d', 64), 2
    )$$,
  '42501',
  'forbidden: commercial execution is not permitted',
  'server-only awards engine cannot record via interactive RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

select * from finish();
rollback;
