-- Emergency P0 containment for the legacy Qlik ranking tables.
--
-- This migration changes table access only. It deliberately leaves the
-- existing publish_crm_imob_ranking(jsonb, text) write contract untouched so
-- the identified legacy caller keeps using the pre-existing SECURITY DEFINER
-- RPC. Its anonymous transport is a temporary exception, not a dedicated
-- identity or approved least-privilege end state.
-- Authenticated reads remain fail-closed until a separately approved,
-- permissioned and organization-scoped read contract is available.

alter table public.crm_imob_ranking_runs enable row level security;
alter table public.crm_imob_ranking_runs force row level security;
alter table public.crm_imob_ranking_entries enable row level security;
alter table public.crm_imob_ranking_entries force row level security;
alter table public.crm_imob_ranking_developments enable row level security;
alter table public.crm_imob_ranking_developments force row level security;

-- Remove every direct read policy, including remote-only names not present in
-- the repository. Future scoped reads must be implemented through an explicit
-- RPC instead of table SELECT.
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
