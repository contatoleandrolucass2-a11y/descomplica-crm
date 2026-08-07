-- Reconcile application schema drift created by the external Qlik/partner
-- ranking integration. The two tables and catalog entry already exist in the
-- production project; CREATE IF NOT EXISTS and ON CONFLICT DO NOTHING preserve
-- those rows while making a clean database reproduce the same objects.

create table if not exists public.crm_imob_ranking_runs (
  id                 uuid primary key default gen_random_uuid(),
  status             text not null default 'running',
  reference_year     smallint not null,
  generated_at       timestamptz not null,
  source_updated_at  timestamptz,
  source             text not null default 'qlik:23.1-painel-comercial-vendas',
  regional           text not null default 'SP CAPITAL',
  company            text not null default 'Direcional',
  row_count          integer not null default 0,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  error_message      text,
  created_at         timestamptz not null default now(),
  constraint crm_imob_ranking_runs_status_check
    check (status = any (array['running', 'succeeded', 'failed'])),
  constraint crm_imob_ranking_runs_reference_year_check
    check (reference_year between 2020 and 2100),
  constraint crm_imob_ranking_runs_row_count_check
    check (row_count >= 0),
  constraint crm_imob_ranking_runs_check
    check ((status = 'succeeded' and completed_at is not null) or status <> 'succeeded')
);

create index if not exists crm_imob_ranking_runs_completed_idx
  on public.crm_imob_ranking_runs (generated_at desc)
  where status = 'succeeded';

create table if not exists public.crm_imob_ranking_entries (
  run_id                 uuid not null
    references public.crm_imob_ranking_runs(id) on delete cascade,
  period_month           date not null,
  imob_key               text not null,
  imob_name              text not null,
  vgv                    numeric(18, 2) not null default 0,
  contracts              integer not null default 0,
  source_rank_vgv        integer,
  source_rank_contracts  integer,
  created_at             timestamptz not null default now(),
  primary key (run_id, period_month, imob_key),
  constraint crm_imob_ranking_entries_period_month_check
    check (
      period_month = date_trunc('month', period_month::timestamp without time zone)::date
    ),
  constraint crm_imob_ranking_entries_imob_key_check
    check (imob_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_imob_ranking_entries_imob_name_check
    check (btrim(imob_name) <> ''),
  constraint crm_imob_ranking_entries_vgv_check
    check (vgv >= 0),
  constraint crm_imob_ranking_entries_contracts_check
    check (contracts >= 0),
  constraint crm_imob_ranking_entries_source_rank_vgv_check
    check (source_rank_vgv is null or source_rank_vgv > 0),
  constraint crm_imob_ranking_entries_source_rank_contracts_check
    check (source_rank_contracts is null or source_rank_contracts > 0)
);

create index if not exists crm_imob_ranking_entries_month_vgv_idx
  on public.crm_imob_ranking_entries (run_id, period_month, vgv desc);

create index if not exists crm_imob_ranking_entries_month_contracts_idx
  on public.crm_imob_ranking_entries (run_id, period_month, contracts desc);

alter table public.crm_imob_ranking_runs owner to postgres;
alter table public.crm_imob_ranking_entries owner to postgres;

comment on table public.crm_imob_ranking_runs is
  'Execution metadata from the external Qlik partner-ranking import.';
comment on table public.crm_imob_ranking_entries is
  'Monthly partner real-estate ranking rows associated with an import run.';

alter table public.crm_imob_ranking_runs enable row level security;
alter table public.crm_imob_ranking_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_runs'
      and policyname = 'crm_imob_ranking_runs_select_completed'
  ) then
    create policy crm_imob_ranking_runs_select_completed
      on public.crm_imob_ranking_runs
      for select to authenticated
      using (status = 'succeeded');
  end if;
end;
$$;

alter policy crm_imob_ranking_runs_select_completed
  on public.crm_imob_ranking_runs
  to authenticated
  using (status = 'succeeded');

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'crm_imob_ranking_entries'
      and policyname = 'crm_imob_ranking_entries_select_completed'
  ) then
    create policy crm_imob_ranking_entries_select_completed
      on public.crm_imob_ranking_entries
      for select to authenticated
      using (
        exists (
          select 1
          from public.crm_imob_ranking_runs runs
          where runs.id = crm_imob_ranking_entries.run_id
            and runs.status = 'succeeded'
        )
      );
  end if;
end;
$$;

alter policy crm_imob_ranking_entries_select_completed
  on public.crm_imob_ranking_entries
  to authenticated
  using (
    exists (
      select 1
      from public.crm_imob_ranking_runs runs
      where runs.id = crm_imob_ranking_entries.run_id
        and runs.status = 'succeeded'
    )
  );

-- Preserve the remotely created catalog identity without inventing a route or
-- broadening its existing CRM ranking permission.
insert into public.app_pages (
  key,
  path,
  name,
  description,
  section,
  permission_key,
  parent_key,
  sort_order,
  is_navigation,
  is_active
) values (
  'crm.partnerships',
  '/app/canal-de-parcerias',
  'Canal de Parcerias',
  'Ranking das imobiliárias parceiras',
  'crm',
  'crm.ranking.view',
  null,
  65,
  true,
  true
)
on conflict (key) do nothing;

-- Objects created by versioned migrations use postgres. Keep that path
-- fail-closed even on projects retaining older Supabase platform defaults.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;

-- Rebuild the complete audited Data API allowlist. The Qlik ranking objects
-- have no caller in the application repository, so they remain unreachable by
-- Data API roles until a separately reviewed read/write contract exists.
revoke all privileges on all tables in schema public
  from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema public
  from public, anon, authenticated, service_role;
revoke all privileges on all functions in schema public
  from public, anon, authenticated, service_role;

grant select on table
  public.app_pages,
  public.audit_logs,
  public.crm_dashboard_metrics,
  public.crm_dashboard_snapshots,
  public.crm_dashboard_top_developments,
  public.crm_dashboard_views,
  public.crm_funnel_goals,
  public.crm_point_metrics,
  public.crm_point_settings,
  public.crm_ranking_participants,
  public.crm_ranking_snapshots,
  public.profiles,
  public.user_permission_overrides,
  public.user_roles
to authenticated;

grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.get_user_authorization_context(uuid) to authenticated;
grant execute on function public.assign_user_role(uuid, text, text) to authenticated;
grant execute on function public.set_user_permission_override(uuid, text, text, text)
  to authenticated;
grant execute on function public.remove_user_permission_override(uuid, text, text)
  to authenticated;
grant execute on function public.list_app_pages_for_management() to authenticated;
grant execute on function public.set_app_page_active(text, boolean, text) to authenticated;
grant execute on function public.set_user_active(uuid, boolean, text) to authenticated;
grant execute on function public.upsert_crm_funnel_goals(
  text, date, bigint, numeric, numeric, numeric, numeric, numeric,
  integer, integer, integer, integer, integer, integer, integer,
  smallint, smallint, smallint, smallint
) to authenticated;
grant execute on function public.replace_crm_point_settings(jsonb, jsonb) to authenticated;
grant execute on function public.get_crm_sync_status() to authenticated;
grant execute on function public.begin_crm_salesforce_refresh(text) to authenticated;
grant execute on function public.finish_crm_salesforce_refresh(uuid, text, integer, text)
  to authenticated;

grant execute on function public.ingest_crm_salesforce_snapshot(jsonb)
  to service_role;
