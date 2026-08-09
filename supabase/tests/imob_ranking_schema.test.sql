begin;

select plan(60);

select has_table('public', 'crm_imob_ranking_runs', 'partner ranking runs table exists');
select has_table('public', 'crm_imob_ranking_entries', 'partner ranking entries table exists');
select has_table(
  'public',
  'crm_imob_ranking_developments',
  'development ranking table exists'
);

select table_owner_is(
  'public',
  'crm_imob_ranking_runs',
  'postgres',
  'partner ranking runs are owned by postgres'
);
select table_owner_is(
  'public',
  'crm_imob_ranking_entries',
  'postgres',
  'partner ranking entries are owned by postgres'
);
select table_owner_is(
  'public',
  'crm_imob_ranking_developments',
  'postgres',
  'development ranking rows are owned by postgres'
);

select ok(
  (select bool_and(relrowsecurity)
   from pg_catalog.pg_class
   where oid in (
     'public.crm_imob_ranking_runs'::regclass,
     'public.crm_imob_ranking_entries'::regclass,
     'public.crm_imob_ranking_developments'::regclass
   )),
  'all Qlik tables have RLS enabled'
);
select ok(
  (select bool_and(relforcerowsecurity)
   from pg_catalog.pg_class
   where oid in (
     'public.crm_imob_ranking_runs'::regclass,
     'public.crm_imob_ranking_entries'::regclass,
     'public.crm_imob_ranking_developments'::regclass
   )),
  'all Qlik tables force RLS'
);

select is(
  (select count(*) from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'crm_imob_ranking_runs'),
  0::bigint,
  'runs expose no direct-table policy'
);
select is(
  (select count(*) from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'crm_imob_ranking_entries'),
  0::bigint,
  'entries expose no direct-table policy'
);
select is(
  (select count(*) from pg_catalog.pg_policies
   where schemaname = 'public' and tablename = 'crm_imob_ranking_developments'),
  0::bigint,
  'developments expose no direct-table policy'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class tables
    join pg_catalog.pg_namespace schemas on schemas.oid = tables.relnamespace
    cross join lateral aclexplode(
      coalesce(tables.relacl, acldefault('r', tables.relowner))
    ) acl
    where schemas.nspname = 'public'
      and tables.relname in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and acl.grantee = 0
  ),
  'PUBLIC has no privileges on Qlik tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'anon',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'anon has no Qlik table privileges'
);
select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'authenticated has no Qlik table privileges'
);
select ok(
  not exists (
    select 1
    from (values
      ('crm_imob_ranking_runs'),
      ('crm_imob_ranking_entries'),
      ('crm_imob_ranking_developments')
    ) tables(name)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) privileges(name)
    where has_table_privilege(
      'service_role',
      format('public.%I', tables.name),
      privileges.name
    )
  ),
  'service_role has no direct Qlik table privileges'
);

select ok(
  to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is null,
  'legacy token-in-argument Qlik function is absent'
);

select col_type_is('public', 'crm_imob_ranking_runs', 'id', 'uuid', 'run ID is uuid');
select col_default_is(
  'public',
  'crm_imob_ranking_runs',
  'id',
  'gen_random_uuid()',
  'run ID has a cryptographic UUID default'
);
select col_type_is(
  'public',
  'crm_imob_ranking_runs',
  'reference_year',
  'smallint',
  'reference year is constrained smallint'
);
select col_type_is(
  'public',
  'crm_imob_ranking_runs',
  'development_row_count',
  'integer',
  'development row count uses integer counts'
);
select is(
  (select column_default
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'crm_imob_ranking_runs'
     and column_name = 'development_row_count'),
  '0',
  'development row count defaults to zero'
);
select is(
  (select is_nullable
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'crm_imob_ranking_runs'
     and column_name = 'development_row_count'),
  'NO',
  'development row count is required'
);
select col_type_is(
  'public',
  'crm_imob_ranking_entries',
  'vgv',
  'numeric(18,2)',
  'partner VGV uses fixed precision'
);
select col_type_is(
  'public',
  'crm_imob_ranking_entries',
  'contracts',
  'integer',
  'partner contracts use integer counts'
);
select col_type_is(
  'public',
  'crm_imob_ranking_developments',
  'vgv',
  'numeric',
  'development VGV preserves source precision'
);
select col_type_is(
  'public',
  'crm_imob_ranking_developments',
  'contracts',
  'integer',
  'development contracts use integer counts'
);

select col_is_pk('public', 'crm_imob_ranking_runs', 'id', 'runs use id as primary key');
select col_is_pk(
  'public',
  'crm_imob_ranking_entries',
  array['run_id', 'period_month', 'imob_key'],
  'entries use the audited composite primary key'
);
select col_is_pk(
  'public',
  'crm_imob_ranking_developments',
  array['run_id', 'period_month', 'business_unit', 'development_key'],
  'developments use the audited composite primary key'
);
select col_is_fk(
  'public',
  'crm_imob_ranking_entries',
  'run_id',
  'entries reference their import run'
);
select is(
  (select pg_get_constraintdef(oid, true)
   from pg_catalog.pg_constraint
   where conname = 'crm_imob_ranking_entries_run_id_fkey'
     and conrelid = 'public.crm_imob_ranking_entries'::regclass),
  'FOREIGN KEY (run_id) REFERENCES crm_imob_ranking_runs(id) ON DELETE CASCADE',
  'entry cleanup follows its run through the audited cascade'
);
select col_is_fk(
  'public',
  'crm_imob_ranking_developments',
  'run_id',
  'developments reference their import run'
);
select is(
  (select pg_get_constraintdef(oid, true)
   from pg_catalog.pg_constraint
   where conname = 'crm_imob_ranking_developments_run_id_fkey'
     and conrelid = 'public.crm_imob_ranking_developments'::regclass),
  'FOREIGN KEY (run_id) REFERENCES crm_imob_ranking_runs(id) ON DELETE CASCADE',
  'development cleanup follows its run through the audited cascade'
);

select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_runs'::regclass
            and conname = 'crm_imob_ranking_runs_status_check' and contype = 'c'),
  'run status is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_runs'::regclass
            and conname = 'crm_imob_ranking_runs_reference_year_check' and contype = 'c'),
  'run reference year is constrained'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_runs'::regclass
            and conname = 'crm_imob_ranking_runs_row_count_check' and contype = 'c'),
  'run entry count is nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_runs'::regclass
            and conname = 'crm_imob_ranking_runs_development_row_count_check'
            and contype = 'c'),
  'run development count is nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_entries'::regclass
            and conname = 'crm_imob_ranking_entries_period_month_check'
            and contype = 'c'),
  'entry periods are month-aligned'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_entries'::regclass
            and conname = 'crm_imob_ranking_entries_imob_key_check' and contype = 'c'),
  'partner keys use the audited format'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_entries'::regclass
            and conname = 'crm_imob_ranking_entries_vgv_check' and contype = 'c'),
  'partner VGV is nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_entries'::regclass
            and conname = 'crm_imob_ranking_entries_contracts_check' and contype = 'c'),
  'partner contracts are nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_period_month_check'
            and contype = 'c'),
  'development periods are month-aligned'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_business_unit_check'
            and contype = 'c'),
  'development business units cannot be blank'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_development_key_check'
            and contype = 'c'),
  'development keys use the audited format'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_development_name_check'
            and contype = 'c'),
  'development names cannot be blank'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_vgv_check' and contype = 'c'),
  'development VGV is nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_contracts_check'
            and contype = 'c'),
  'development contracts are nonnegative'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_source_rank_vgv_check'
            and contype = 'c'),
  'development VGV ranks are positive when present'
);
select ok(
  exists (select 1 from pg_catalog.pg_constraint
          where conrelid = 'public.crm_imob_ranking_developments'::regclass
            and conname = 'crm_imob_ranking_developments_source_rank_contracts_check'
            and contype = 'c'),
  'development contract ranks are positive when present'
);

select has_index(
  'public',
  'crm_imob_ranking_runs',
  'crm_imob_ranking_runs_completed_idx',
  'completed runs have a recency index'
);
select has_index(
  'public',
  'crm_imob_ranking_entries',
  'crm_imob_ranking_entries_month_vgv_idx',
  'monthly partner VGV ranking has an index'
);
select has_index(
  'public',
  'crm_imob_ranking_entries',
  'crm_imob_ranking_entries_month_contracts_idx',
  'monthly partner contract ranking has an index'
);
select has_index(
  'public',
  'crm_imob_ranking_entries',
  'crm_imob_ranking_entries_imob_key_run_idx',
  'source identity joins have an index'
);
select has_index(
  'public',
  'crm_imob_ranking_developments',
  'crm_imob_ranking_developments_month_vgv_idx',
  'monthly development VGV ranking has an index'
);
select has_index(
  'public',
  'crm_imob_ranking_developments',
  'crm_imob_ranking_developments_month_contracts_idx',
  'monthly development contract ranking has an index'
);

select is(
  (select permission_key
   from public.app_pages
   where key = 'crm.partnerships' and path = '/app/canal-de-parcerias'),
  'crm.partnerships.view',
  'partner ranking page retains its audited navigation permission'
);
select is(
  (select coalesce(sum(runs.row_count), 0)
   from public.crm_imob_ranking_runs runs where runs.status = 'succeeded'),
  (select count(*)::bigint
   from public.crm_imob_ranking_entries entries
   join public.crm_imob_ranking_runs runs on runs.id = entries.run_id
   where runs.status = 'succeeded'),
  'completed run entry counts reconcile with stored entries'
);
select is(
  (select coalesce(sum(runs.development_row_count), 0)
   from public.crm_imob_ranking_runs runs where runs.status = 'succeeded'),
  (select count(*)::bigint
   from public.crm_imob_ranking_developments developments
   join public.crm_imob_ranking_runs runs on runs.id = developments.run_id
   where runs.status = 'succeeded'),
  'completed run development counts reconcile with stored developments'
);
select ok(
  not exists (
    select 1
    from public.crm_imob_ranking_entries entries
    left join public.crm_imob_ranking_runs runs on runs.id = entries.run_id
    where runs.id is null
  ),
  'partner ranking entries never become orphaned'
);
select ok(
  not exists (
    select 1
    from public.crm_imob_ranking_developments developments
    left join public.crm_imob_ranking_runs runs on runs.id = developments.run_id
    where runs.id is null
  ),
  'development ranking rows never become orphaned'
);

select * from finish();

rollback;
