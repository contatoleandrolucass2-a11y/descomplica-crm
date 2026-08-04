-- Gate 2 — Ranking read model
--
-- Stores normalized activity counts per broker and presentation period. The
-- application calculates scores with the current authorized point settings,
-- so changing a weight never requires rewriting ranking activity rows.

create table public.crm_ranking_snapshots (
  id bigint generated always as identity primary key,
  snapshot_key text not null unique,
  reference_date date not null,
  generated_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_ranking_snapshots_key_format
    check (snapshot_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_ranking_snapshots_timezone_nonempty check (btrim(timezone) <> ''),
  constraint crm_ranking_snapshots_source_nonempty check (btrim(source) <> '')
);

create trigger crm_ranking_snapshots_set_updated_at
  before update on public.crm_ranking_snapshots
  for each row execute function public.set_updated_at();

create table public.crm_ranking_participants (
  snapshot_id bigint not null
    references public.crm_ranking_snapshots(id) on delete cascade,
  period_key text not null,
  broker_key text not null,
  broker_name text not null,
  manager_name text not null,
  roulette bigint not null default 0,
  roulette_saturday bigint not null default 0,
  roulette_sunday bigint not null default 0,
  schedule bigint not null default 0,
  visit bigint not null default 0,
  approved_folder bigint not null default 0,
  sale bigint not null default 0,
  primary key (snapshot_id, period_key, broker_key),
  constraint crm_ranking_participants_period_key
    check (period_key in ('month', 'last_week', 'week', 'today')),
  constraint crm_ranking_participants_broker_key_format
    check (broker_key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint crm_ranking_participants_names_nonempty
    check (btrim(broker_name) <> '' and btrim(manager_name) <> ''),
  constraint crm_ranking_participants_counts_nonnegative
    check (
      roulette >= 0
      and roulette_saturday >= 0
      and roulette_sunday >= 0
      and schedule >= 0
      and visit >= 0
      and approved_folder >= 0
      and sale >= 0
    )
);

create index crm_ranking_participants_period_manager_idx
  on public.crm_ranking_participants (snapshot_id, period_key, manager_name, broker_name);

revoke all on table public.crm_ranking_snapshots, public.crm_ranking_participants
  from anon, authenticated;
grant select on table public.crm_ranking_snapshots, public.crm_ranking_participants
  to authenticated;
grant all on table public.crm_ranking_snapshots, public.crm_ranking_participants
  to service_role;
grant usage, select on sequence public.crm_ranking_snapshots_id_seq
  to service_role;

alter table public.crm_ranking_snapshots enable row level security;
alter table public.crm_ranking_participants enable row level security;

create policy crm_ranking_snapshots_select_authorized
  on public.crm_ranking_snapshots
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
  );

create policy crm_ranking_participants_select_authorized
  on public.crm_ranking_participants
  for select to authenticated
  using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
  );

revoke insert, update, delete, truncate, references, trigger
  on table public.crm_ranking_snapshots, public.crm_ranking_participants
  from anon, authenticated;
