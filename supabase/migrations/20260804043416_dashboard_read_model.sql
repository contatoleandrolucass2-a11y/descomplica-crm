-- Gate 2 — CRM dashboard read model
--
-- Replaces the D1 collaborator_dashboards JSON row and the unversioned
-- sf_relatorio_resumo dependency with a normalized PostgreSQL read model.
-- This migration is read-only for browser roles. A later ingestion migration
-- will own transactional writes; no demo or production data is seeded here.

create table public.crm_dashboard_snapshots (
  id bigint generated always as identity primary key,
  snapshot_key text not null unique,
  reference_date date not null,
  generated_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_dashboard_snapshots_key_format
    check (snapshot_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_dashboard_snapshots_source_nonempty
    check (btrim(source) <> ''),
  constraint crm_dashboard_snapshots_timezone_nonempty
    check (btrim(timezone) <> '')
);

create trigger crm_dashboard_snapshots_set_updated_at
  before update on public.crm_dashboard_snapshots
  for each row execute function public.set_updated_at();

create table public.crm_dashboard_views (
  snapshot_id bigint not null
    references public.crm_dashboard_snapshots(id) on delete cascade,
  view_key text not null,
  sales_value_month numeric(16, 2) not null default 0,
  sales_value_week numeric(16, 2) not null default 0,
  sales_value_today numeric(16, 2) not null default 0,
  primary key (snapshot_id, view_key),
  constraint crm_dashboard_views_view_key
    check (view_key in ('all', 'with_canal_imob', 'without_canal_imob')),
  constraint crm_dashboard_views_sales_nonnegative
    check (
      sales_value_month >= 0
      and sales_value_week >= 0
      and sales_value_today >= 0
    )
);

create table public.crm_dashboard_metrics (
  snapshot_id bigint not null
    references public.crm_dashboard_snapshots(id) on delete cascade,
  view_key text not null,
  stage_key text not null,
  current_month bigint not null default 0,
  current_week bigint not null default 0,
  current_today bigint not null default 0,
  goal_month numeric(14, 2) not null default 0,
  goal_week numeric(14, 2) not null default 0,
  goal_today numeric(14, 2) not null default 0,
  previous_month bigint,
  year_closed_months_average numeric(14, 2),
  last_three_closed_months_average numeric(14, 2),
  previous_fourteen_days bigint,
  last_fourteen_days bigint,
  previous_seven_days bigint,
  last_seven_days bigint,
  previous_week bigint,
  yesterday bigint,
  primary key (snapshot_id, view_key, stage_key),
  constraint crm_dashboard_metrics_view_key
    check (view_key in ('all', 'with_canal_imob', 'without_canal_imob')),
  constraint crm_dashboard_metrics_stage_key
    check (stage_key in ('opportunities', 'appointments', 'visits', 'folders', 'sales')),
  constraint crm_dashboard_metrics_nonnegative
    check (
      current_month >= 0
      and current_week >= 0
      and current_today >= 0
      and goal_month >= 0
      and goal_week >= 0
      and goal_today >= 0
      and coalesce(previous_month, 0) >= 0
      and coalesce(year_closed_months_average, 0) >= 0
      and coalesce(last_three_closed_months_average, 0) >= 0
      and coalesce(previous_fourteen_days, 0) >= 0
      and coalesce(last_fourteen_days, 0) >= 0
      and coalesce(previous_seven_days, 0) >= 0
      and coalesce(last_seven_days, 0) >= 0
      and coalesce(previous_week, 0) >= 0
      and coalesce(yesterday, 0) >= 0
    )
);

create table public.crm_dashboard_top_developments (
  snapshot_id bigint not null
    references public.crm_dashboard_snapshots(id) on delete cascade,
  view_key text not null,
  rank smallint not null,
  name text not null,
  total bigint not null,
  primary key (snapshot_id, view_key, rank),
  unique (snapshot_id, view_key, name),
  constraint crm_dashboard_top_developments_view_key
    check (view_key in ('all', 'with_canal_imob', 'without_canal_imob')),
  constraint crm_dashboard_top_developments_rank
    check (rank between 1 and 5),
  constraint crm_dashboard_top_developments_name_nonempty
    check (btrim(name) <> ''),
  constraint crm_dashboard_top_developments_total_positive
    check (total > 0)
);

-- Explicit Data API exposure with least privilege. Browser writes remain
-- unavailable; future ingestion must use a separately guarded server path.
revoke all on table
  public.crm_dashboard_snapshots,
  public.crm_dashboard_views,
  public.crm_dashboard_metrics,
  public.crm_dashboard_top_developments
from anon, authenticated;

grant select on table
  public.crm_dashboard_snapshots,
  public.crm_dashboard_views,
  public.crm_dashboard_metrics,
  public.crm_dashboard_top_developments
to authenticated;

grant all on table
  public.crm_dashboard_snapshots,
  public.crm_dashboard_views,
  public.crm_dashboard_metrics,
  public.crm_dashboard_top_developments
to service_role;

grant usage, select on sequence public.crm_dashboard_snapshots_id_seq to service_role;

alter table public.crm_dashboard_snapshots enable row level security;
alter table public.crm_dashboard_views enable row level security;
alter table public.crm_dashboard_metrics enable row level security;
alter table public.crm_dashboard_top_developments enable row level security;

create policy crm_dashboard_snapshots_select_authorized
  on public.crm_dashboard_snapshots
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
  );

create policy crm_dashboard_metrics_select_authorized
  on public.crm_dashboard_metrics
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
  );

create policy crm_dashboard_views_select_authorized
  on public.crm_dashboard_views
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
  );

create policy crm_dashboard_top_developments_select_authorized
  on public.crm_dashboard_top_developments
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
  );

-- Defense in depth against future default-grant changes.
revoke insert, update, delete, truncate, references, trigger
  on table
    public.crm_dashboard_snapshots,
    public.crm_dashboard_views,
    public.crm_dashboard_metrics,
    public.crm_dashboard_top_developments
  from anon, authenticated;
