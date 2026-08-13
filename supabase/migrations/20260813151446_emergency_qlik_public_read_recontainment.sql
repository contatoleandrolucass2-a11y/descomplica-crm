-- Emergency P0 roll-forward after direct Qlik table reads were reopened.
--
-- This migration intentionally repeats the fail-closed invariants from the
-- original containment. It does not version or reproduce the two unsafe
-- remote-only migrations that regressed the ACL. Public read access is never
-- an acceptable rollback.

alter table public.crm_imob_ranking_runs enable row level security;
alter table public.crm_imob_ranking_runs force row level security;
alter table public.crm_imob_ranking_entries enable row level security;
alter table public.crm_imob_ranking_entries force row level security;
alter table public.crm_imob_ranking_developments enable row level security;
alter table public.crm_imob_ranking_developments force row level security;

-- Remove every SELECT/ALL policy, including unknown remote-only names. Future
-- reads require an explicit, permissioned and scoped RPC.
do $$
declare
  read_policy record;
begin
  for read_policy in
    select policy.schemaname, policy.tablename, policy.policyname
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'crm_imob_ranking_runs',
        'crm_imob_ranking_entries',
        'crm_imob_ranking_developments'
      )
      and policy.cmd in ('SELECT', 'ALL')
  loop
    execute pg_catalog.format(
      'drop policy %I on %I.%I',
      read_policy.policyname,
      read_policy.schemaname,
      read_policy.tablename
    );
  end loop;
end;
$$;

revoke all privileges on table
  public.crm_imob_ranking_runs,
  public.crm_imob_ranking_entries,
  public.crm_imob_ranking_developments
from public, anon, authenticated, service_role;

-- Keep only the previously approved temporary publisher exception. This is a
-- compatibility bridge, not the final dedicated Qlik identity.
do $$
begin
  if to_regprocedure('public.publish_crm_imob_ranking(jsonb,text)') is not null then
    execute
      'alter function public.publish_crm_imob_ranking(jsonb, text) '
      'set search_path = pg_catalog, extensions, pg_temp';
    execute
      'revoke all privileges on function '
      'public.publish_crm_imob_ranking(jsonb, text) '
      'from public, authenticated, service_role';
    execute
      'grant execute on function '
      'public.publish_crm_imob_ranking(jsonb, text) to anon';
  end if;
end;
$$;
