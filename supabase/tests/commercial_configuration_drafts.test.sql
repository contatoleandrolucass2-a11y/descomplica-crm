begin;

select plan(22);

select ok(
  to_regclass('private.crm_commercial_configuration_drafts') is not null,
  'commercial configuration draft table exists only in private schema'
);

select ok(
  (
    select class.relrowsecurity and class.relforcerowsecurity
    from pg_catalog.pg_class class
    where class.oid = 'private.crm_commercial_configuration_drafts'::regclass
  ),
  'draft table enables and forces RLS'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_policy policy
    where policy.polrelid = 'private.crm_commercial_configuration_drafts'::regclass
  ),
  'draft table has no permissive policy'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role'),
      ('crm_qlik_relay'), ('crm_commercial_engine')) roles(name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) privileges(name)
    where has_table_privilege(
      roles.name, 'private.crm_commercial_configuration_drafts', privileges.name
    )
  ),
  'browser and machine roles have no direct draft table privilege'
);

select ok(
  to_regprocedure('public.preview_crm_commercial_configuration_draft(text,jsonb,integer)') is not null
  and to_regprocedure('public.get_crm_commercial_configuration_draft(text)') is not null
  and to_regprocedure('public.save_crm_commercial_configuration_draft(text,jsonb,integer,text,text)') is not null,
  'draft preview, read and save RPCs exist'
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
      'public.preview_crm_commercial_configuration_draft(text,jsonb,integer)'::regprocedure,
      'public.get_crm_commercial_configuration_draft(text)'::regprocedure,
      'public.save_crm_commercial_configuration_draft(text,jsonb,integer,text,text)'::regprocedure
    )
  ),
  'public draft RPCs are bounded postgres-owned security definers'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.build_crm_commercial_configuration_draft_plan(text,jsonb,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.preview_crm_commercial_configuration_draft(text,jsonb,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.preview_crm_commercial_configuration_draft(text,jsonb,integer)',
    'EXECUTE'
  ),
  'only authenticated sessions enter public draft RPCs before authorization'
);

select is(
  (select count(*) from private.crm_commercial_configuration_drafts),
  0::bigint,
  'migration seeds no configuration draft'
);

insert into auth.users (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'draft-master@example.test'),
  ('d1000000-0000-4000-8000-000000000002', 'draft-pending@example.test');
select public.bootstrap_master_user('d1000000-0000-4000-8000-000000000001');

create function pg_temp.qa_goal_payload()
returns jsonb language sql immutable as $$
  select '{
    "schemaVersion":1,
    "kind":"funnel-goals",
    "profile":"dv",
    "effectiveMonth":"2026-08-01",
    "values":{
      "sales":"0","opportunitiesRate":"0","appointmentsRate":"0",
      "visitsRate":"0","foldersRate":"0","approvedFoldersRate":"0",
      "brokerMinimumMonth1":"0","brokerMinimumMonth2":"0",
      "brokerMinimumMonth3":"0","brokerMinimumMonth4Plus":"0",
      "brokerWeeklyAppointments":"0","brokerWeeklyVisits":"0",
      "brokerWeeklyFolders":"0","productiveTeamAppointments":"0",
      "productiveTeamVisits":"0","productiveTeamFolders":"0",
      "productiveTeamSales":"0"
    }
  }'::jsonb;
$$;

create function pg_temp.qa_point_payload()
returns jsonb language sql immutable as $$
  select '{
    "schemaVersion":1,
    "kind":"point-settings",
    "weights":{"roulette":"0","roulette_saturday":"0","roulette_sunday":"0","schedule":"0","visit":"0","approved_folder":"0","sale":"0"},
    "targets":{"roulette":"0","roulette_saturday":"0","roulette_sunday":"0","schedule":"0","visit":"0","approved_folder":"0","sale":"0"}
  }'::jsonb;
$$;

grant execute on function pg_temp.qa_goal_payload() to authenticated;
grant execute on function pg_temp.qa_point_payload() to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.preview_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 0
  ) ->> 'valid',
  'true',
  'Master can validate a structurally complete goals draft'
);

select is(
  public.preview_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 0
  ) ->> 'activationReady',
  'false',
  'draft preview can never authorize activation'
);

select is(
  jsonb_array_length(public.preview_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 0
  ) -> 'blockers'),
  8,
  'preview returns every mandatory external activation blocker'
);

select is(
  public.get_crm_commercial_configuration_draft('goals.dv'),
  null::jsonb,
  'preview is a dry-run with no write'
);

select lives_ok($$
  with plan as (
    select public.preview_crm_commercial_configuration_draft(
      'goals.dv', pg_temp.qa_goal_payload(), 0
    ) value
  )
  select public.save_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 0,
    plan.value ->> 'planHash', 'QA validates an inactive draft'
  ) from plan
$$, 'Master can save the exact previewed draft');

select is(
  (public.get_crm_commercial_configuration_draft('goals.dv') ->> 'revision')::integer,
  1::integer,
  'first saved draft receives revision one'
);

select is(
  public.get_crm_commercial_configuration_draft('goals.dv') ->> 'payloadHash',
  public.preview_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 1
  ) ->> 'payloadHash',
  'authorized read returns the persisted draft fingerprint'
);

select ok(
  exists (
    select 1 from public.audit_logs log
    where log.action = 'commercial.configuration_draft.saved'
      and log.after ? 'payload_hash'
      and log.after ? 'plan_hash'
      and log.after ? 'reason_hash'
      and not log.after ? 'payload'
      and not log.after ? 'reason'
  ),
  'draft audit stores hashes and metadata, never payload or reason'
);

select throws_ok(
  $$
    select public.save_crm_commercial_configuration_draft(
      'goals.dv', pg_temp.qa_goal_payload(), 0,
      public.preview_crm_commercial_configuration_draft(
        'goals.dv', pg_temp.qa_goal_payload(), null
      ) ->> 'planHash',
      'QA stale revision must fail closed'
    )
  $$,
  '23505',
  'conflict: commercial configuration draft plan is stale or invalid',
  'optimistic revision prevents lost updates'
);

select is(
  public.preview_crm_commercial_configuration_draft(
    'points.ranking', pg_temp.qa_point_payload(), 0
  ) ->> 'valid',
  'true',
  'point settings use the same inactive preview contract'
);

select is(
  public.preview_crm_commercial_configuration_draft(
    'points.ranking', pg_temp.qa_point_payload() || '{"unexpected":true}'::jsonb, 0
  ) ->> 'valid',
  'false',
  'point draft rejects unknown envelope fields'
);

select is(
  public.preview_crm_commercial_configuration_draft(
    'ranking.broker', '{}'::jsonb, 0
  ) ->> 'reasonCode',
  'unsupported_engine',
  'engines without a configuration form fail closed'
);

select is(
  public.preview_crm_commercial_configuration_draft(
    null, pg_temp.qa_point_payload(), 0
  ) ->> 'reasonCode',
  'unsupported_engine',
  'a null engine key fails closed during preview'
);

select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select public.preview_crm_commercial_configuration_draft(
    'goals.dv', pg_temp.qa_goal_payload(), 0
  ) $$,
  '42501',
  'forbidden: commercial configuration draft preview is not permitted',
  'non-Master cannot preview a configuration draft'
);

select * from finish();
rollback;
