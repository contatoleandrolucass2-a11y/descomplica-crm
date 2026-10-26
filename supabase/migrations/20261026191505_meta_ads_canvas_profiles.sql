begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.meta_ads_canvas_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('macro', 'micro-sets', 'micro-ads')),
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and pg_column_size(state) <= 524288
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, scope)
);

comment on table public.meta_ads_canvas_profiles is
  'Private per-user Meta Ads canvas profiles. Browser storage is only a local cache.';

alter table public.meta_ads_canvas_profiles enable row level security;
alter table public.meta_ads_canvas_profiles force row level security;

create policy meta_ads_canvas_profiles_owner on public.meta_ads_canvas_profiles
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.current_session_satisfies_mfa())
  )
  with check (
    user_id = (select auth.uid())
    and (select private.current_session_satisfies_mfa())
  );

revoke all privileges on table public.meta_ads_canvas_profiles
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.meta_ads_canvas_profiles to authenticated;

commit;
