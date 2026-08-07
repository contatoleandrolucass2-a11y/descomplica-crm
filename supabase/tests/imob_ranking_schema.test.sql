begin;

select plan(35);

select has_table('public', 'crm_imob_ranking_runs', 'partner ranking runs table exists');
select has_table('public', 'crm_imob_ranking_entries', 'partner ranking entries table exists');

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

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_imob_ranking_runs'::regclass),
  'partner ranking runs have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.crm_imob_ranking_entries'::regclass),
  'partner ranking entries have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.crm_imob_ranking_runs', 'SELECT')
  and not has_table_privilege('anon', 'public.crm_imob_ranking_entries', 'SELECT'),
  'anon cannot read partner ranking tables'
);
select ok(
  not has_table_privilege('authenticated', 'public.crm_imob_ranking_runs', 'SELECT')
  and not has_table_privilege('authenticated', 'public.crm_imob_ranking_entries', 'SELECT'),
  'authenticated has no unimplemented direct partner ranking read'
);
select ok(
  not has_table_privilege('service_role', 'public.crm_imob_ranking_runs', 'SELECT')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_runs', 'INSERT')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_runs', 'UPDATE')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_runs', 'DELETE')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_entries', 'SELECT')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_entries', 'INSERT')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_entries', 'UPDATE')
  and not has_table_privilege('service_role', 'public.crm_imob_ranking_entries', 'DELETE'),
  'service_role has no direct partner ranking table privileges'
);

select is(
  (
    select array_agg(policyname order by policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_runs'
  ),
  array['crm_imob_ranking_runs_select_completed']::name[],
  'partner ranking runs retain the named completed-run policy'
);
select is(
  (
    select array_agg(policyname order by policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_entries'
  ),
  array['crm_imob_ranking_entries_select_completed']::name[],
  'partner ranking entries retain the named completed-run policy'
);
select is(
  (
    select roles
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_runs'
      and policyname = 'crm_imob_ranking_runs_select_completed'
  ),
  array['authenticated']::name[],
  'partner ranking runs policy excludes anon'
);
select is(
  (
    select roles
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_entries'
      and policyname = 'crm_imob_ranking_entries_select_completed'
  ),
  array['authenticated']::name[],
  'partner ranking entries policy excludes anon'
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

select col_is_pk('public', 'crm_imob_ranking_runs', 'id', 'runs use id as primary key');
select col_is_pk(
  'public',
  'crm_imob_ranking_entries',
  array['run_id', 'period_month', 'imob_key'],
  'entries use the audited composite primary key'
);
select col_is_fk(
  'public',
  'crm_imob_ranking_entries',
  'run_id',
  'entries reference their import run'
);
select is(
  (
    select pg_get_constraintdef(oid, true)
    from pg_catalog.pg_constraint
    where conname = 'crm_imob_ranking_entries_run_id_fkey'
      and conrelid = 'public.crm_imob_ranking_entries'::regclass
  ),
  'FOREIGN KEY (run_id) REFERENCES crm_imob_ranking_runs(id) ON DELETE CASCADE',
  'entry cleanup follows its run only through the audited cascade'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_runs'::regclass
      and conname = 'crm_imob_ranking_runs_status_check'
      and contype = 'c'
  ),
  'run status is constrained'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_runs'::regclass
      and conname = 'crm_imob_ranking_runs_reference_year_check'
      and contype = 'c'
  ),
  'run reference year is constrained'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_runs'::regclass
      and conname = 'crm_imob_ranking_runs_row_count_check'
      and contype = 'c'
  ),
  'run row count is nonnegative'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_entries'::regclass
      and conname = 'crm_imob_ranking_entries_period_month_check'
      and contype = 'c'
  ),
  'entry periods are month-aligned'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_entries'::regclass
      and conname = 'crm_imob_ranking_entries_imob_key_check'
      and contype = 'c'
  ),
  'partner keys use the audited format'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_entries'::regclass
      and conname = 'crm_imob_ranking_entries_vgv_check'
      and contype = 'c'
  ),
  'partner VGV is nonnegative'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.crm_imob_ranking_entries'::regclass
      and conname = 'crm_imob_ranking_entries_contracts_check'
      and contype = 'c'
  ),
  'partner contracts are nonnegative'
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
  'monthly VGV ranking has an index'
);
select has_index(
  'public',
  'crm_imob_ranking_entries',
  'crm_imob_ranking_entries_month_contracts_idx',
  'monthly contract ranking has an index'
);

select is(
  (
    select permission_key
    from public.app_pages
    where key = 'crm.partnerships'
      and path = '/app/canal-de-parcerias'
  ),
  'crm.ranking.view',
  'partner ranking page retains its audited identity and permission'
);
select is(
  (
    select coalesce(sum(runs.row_count), 0)
    from public.crm_imob_ranking_runs runs
    where runs.status = 'succeeded'
  ),
  (
    select count(*)::bigint
    from public.crm_imob_ranking_entries entries
    join public.crm_imob_ranking_runs runs on runs.id = entries.run_id
    where runs.status = 'succeeded'
  ),
  'completed run row counts reconcile with stored ranking entries'
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

select * from finish();

rollback;
