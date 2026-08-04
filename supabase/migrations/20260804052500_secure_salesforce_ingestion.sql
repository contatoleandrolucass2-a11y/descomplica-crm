-- Gate 2 — secure Salesforce ingestion control plane
--
-- Replaces the public Cloudflare/D1 endpoints with PostgreSQL-backed,
-- idempotent operations. Browser roles cannot mutate or inspect this table
-- directly. Authenticated refreshes and safe status reads use guarded RPCs;
-- normalized machine ingestion is reserved to the server-only service role.

create table public.crm_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  kind text not null,
  status text not null,
  workflow text not null,
  requested_by uuid references auth.users(id) on delete set null,
  record_count integer not null default 0,
  http_status smallint,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_ingestion_runs_request_key_format
    check (request_key ~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,127}$'),
  constraint crm_ingestion_runs_kind
    check (kind in ('salesforce_ingest', 'salesforce_refresh')),
  constraint crm_ingestion_runs_status
    check (status in ('running', 'succeeded', 'failed')),
  constraint crm_ingestion_runs_workflow_nonempty
    check (btrim(workflow) <> '' and length(workflow) <= 100),
  constraint crm_ingestion_runs_record_count
    check (record_count between 0 and 10000),
  constraint crm_ingestion_runs_http_status
    check (http_status is null or http_status between 100 and 599),
  constraint crm_ingestion_runs_error_code
    check (
      error_code is null
      or error_code ~ '^[a-z][a-z0-9_]{2,63}$'
    ),
  constraint crm_ingestion_runs_completion
    check (
      (status = 'running' and finished_at is null)
      or (status in ('succeeded', 'failed') and finished_at is not null)
    )
);

create trigger crm_ingestion_runs_set_updated_at
  before update on public.crm_ingestion_runs
  for each row execute function public.set_updated_at();

create index crm_ingestion_runs_kind_created_idx
  on public.crm_ingestion_runs (kind, created_at desc);
create index crm_ingestion_runs_active_refresh_idx
  on public.crm_ingestion_runs (started_at desc)
  where kind = 'salesforce_refresh' and status = 'running';

revoke all on table public.crm_ingestion_runs from anon, authenticated;
grant all on table public.crm_ingestion_runs to service_role;
alter table public.crm_ingestion_runs enable row level security;

create or replace function public.get_crm_sync_status()
returns table (
  generated_at timestamptz,
  last_ingest_at timestamptz,
  last_ingest_status text,
  refresh_status text,
  refresh_requested_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.has_permission(auth.uid(), 'crm.dashboard.view') then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return query
  select
    (select s.generated_at
       from public.crm_dashboard_snapshots s
      where s.snapshot_key = 'global'),
    (select r.finished_at
       from public.crm_ingestion_runs r
      where r.kind = 'salesforce_ingest'
      order by r.created_at desc
      limit 1),
    (select r.status
       from public.crm_ingestion_runs r
      where r.kind = 'salesforce_ingest'
      order by r.created_at desc
      limit 1),
    (select r.status
       from public.crm_ingestion_runs r
      where r.kind = 'salesforce_refresh'
      order by r.created_at desc
      limit 1),
    (select r.created_at
       from public.crm_ingestion_runs r
      where r.kind = 'salesforce_refresh'
      order by r.created_at desc
      limit 1);
end;
$$;

revoke all on function public.get_crm_sync_status() from public, anon;
grant execute on function public.get_crm_sync_status() to authenticated;

create or replace function public.begin_crm_salesforce_refresh(p_request_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.crm_ingestion_runs%rowtype;
  v_run_id uuid;
  v_retry_after integer;
begin
  if v_actor is null
     or not public.has_permission(v_actor, 'crm.salesforce.refresh') then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if p_request_key is null
     or p_request_key !~ '^refresh:[0-9a-f-]{36}$' then
    raise exception 'invalid request key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2026080402);

  select * into v_existing
    from public.crm_ingestion_runs
   where request_key = p_request_key;
  if found then
    if v_existing.requested_by is distinct from v_actor then
      raise exception 'access denied' using errcode = '42501';
    end if;
    return jsonb_build_object(
      'ok', true,
      'status', v_existing.status,
      'runId', v_existing.id,
      'idempotent', true
    );
  end if;

  update public.crm_ingestion_runs
     set status = 'failed',
         error_code = 'refresh_timeout',
         finished_at = now()
   where kind = 'salesforce_refresh'
     and status = 'running'
     and started_at < now() - interval '5 minutes';

  select * into v_existing
    from public.crm_ingestion_runs
   where kind = 'salesforce_refresh'
     and status = 'running'
   order by started_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'ok', false,
      'status', 'already_running',
      'runId', v_existing.id
    );
  end if;

  select greatest(
           1,
           ceil(extract(epoch from (created_at + interval '60 seconds' - now())))::integer
         )
    into v_retry_after
    from public.crm_ingestion_runs
   where kind = 'salesforce_refresh'
     and requested_by = v_actor
     and created_at > now() - interval '60 seconds'
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'ok', false,
      'status', 'rate_limited',
      'retryAfter', v_retry_after
    );
  end if;

  insert into public.crm_ingestion_runs (
    request_key, kind, status, workflow, requested_by
  ) values (
    p_request_key, 'salesforce_refresh', 'running', 'salesforce_refresh', v_actor
  ) returning id into v_run_id;

  insert into public.audit_logs (actor_id, action, after)
  values (
    v_actor,
    'crm.salesforce.refresh.requested',
    jsonb_build_object('run_id', v_run_id)
  );

  return jsonb_build_object('ok', true, 'status', 'started', 'runId', v_run_id);
end;
$$;

revoke all on function public.begin_crm_salesforce_refresh(text) from public, anon;
grant execute on function public.begin_crm_salesforce_refresh(text) to authenticated;

create or replace function public.finish_crm_salesforce_refresh(
  p_run_id uuid,
  p_status text,
  p_http_status integer default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.crm_ingestion_runs%rowtype;
begin
  if v_actor is null
     or not public.has_permission(v_actor, 'crm.salesforce.refresh') then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if p_status not in ('succeeded', 'failed')
     or (p_http_status is not null and p_http_status not between 100 and 599)
     or (p_error_code is not null and p_error_code !~ '^[a-z][a-z0-9_]{2,63}$') then
    raise exception 'invalid completion data' using errcode = '22023';
  end if;

  select * into v_run
    from public.crm_ingestion_runs
   where id = p_run_id
     and kind = 'salesforce_refresh'
   for update;
  if not found or v_run.requested_by is distinct from v_actor then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if v_run.status <> 'running' then
    return jsonb_build_object('ok', true, 'status', v_run.status, 'idempotent', true);
  end if;

  update public.crm_ingestion_runs
     set status = p_status,
         http_status = p_http_status,
         error_code = p_error_code,
         finished_at = now()
   where id = p_run_id;

  insert into public.audit_logs (actor_id, action, after)
  values (
    v_actor,
    'crm.salesforce.refresh.' || p_status,
    jsonb_build_object('run_id', p_run_id, 'http_status', p_http_status)
  );

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function public.finish_crm_salesforce_refresh(uuid, text, integer, text)
  from public, anon;
grant execute on function public.finish_crm_salesforce_refresh(uuid, text, integer, text)
  to authenticated;

create or replace function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_key text := 'ingest:' || coalesce(p_payload->>'requestId', '');
  v_workflow text := p_payload->>'workflow';
  v_dashboard jsonb := p_payload->'dashboard';
  v_ranking jsonb := p_payload->'ranking';
  v_run_id uuid;
  v_dashboard_id bigint;
  v_ranking_id bigint;
  v_existing_status text;
  v_record_count integer := 0;
begin
  if p_payload is null
     or p_payload->>'schemaVersion' <> '1'
     or v_request_key !~ '^ingest:[0-9a-f-]{36}$'
     or v_workflow is null
     or btrim(v_workflow) = ''
     or jsonb_typeof(v_dashboard) <> 'object' then
    raise exception 'invalid ingestion envelope' using errcode = '22023';
  end if;
  if jsonb_typeof(v_dashboard->'views') <> 'array'
     or jsonb_array_length(v_dashboard->'views') <> 3
     or jsonb_typeof(v_dashboard->'metrics') <> 'array'
     or jsonb_array_length(v_dashboard->'metrics') <> 15
     or jsonb_typeof(v_dashboard->'topDevelopments') <> 'array'
     or jsonb_array_length(v_dashboard->'topDevelopments') > 15
     or (
       v_ranking is not null
       and (
         jsonb_typeof(v_ranking) <> 'object'
         or jsonb_typeof(v_ranking->'participants') <> 'array'
         or jsonb_array_length(v_ranking->'participants') > 2000
         or v_ranking->>'generatedAt' <> v_dashboard->>'generatedAt'
         or v_ranking->>'referenceDate' <> v_dashboard->>'referenceDate'
       )
     ) then
    raise exception 'invalid ingestion snapshot' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2026080403);
  select status into v_existing_status
    from public.crm_ingestion_runs
   where request_key = v_request_key;
  if found then
    return jsonb_build_object(
      'ok', v_existing_status = 'succeeded',
      'status', v_existing_status,
      'idempotent', true
    );
  end if;
  if (
    select count(*) >= 20
      from public.crm_ingestion_runs
     where kind = 'salesforce_ingest'
       and created_at > now() - interval '1 minute'
  ) then
    return jsonb_build_object(
      'ok', false,
      'status', 'rate_limited',
      'retryAfter', 60
    );
  end if;

  insert into public.crm_ingestion_runs (
    request_key, kind, status, workflow
  ) values (
    v_request_key, 'salesforce_ingest', 'running', v_workflow
  ) returning id into v_run_id;

  begin
    if exists (
      select 1
        from public.crm_dashboard_snapshots s
       where s.snapshot_key = v_dashboard->>'snapshotKey'
         and s.generated_at > (v_dashboard->>'generatedAt')::timestamptz
    ) then
      raise exception 'stale snapshot' using errcode = '22023';
    end if;
    if jsonb_typeof(v_ranking) = 'object'
       and exists (
         select 1
           from public.crm_ranking_snapshots s
          where s.snapshot_key = v_ranking->>'snapshotKey'
            and s.generated_at > (v_ranking->>'generatedAt')::timestamptz
       ) then
      raise exception 'stale ranking snapshot' using errcode = '22023';
    end if;

    insert into public.crm_dashboard_snapshots (
      snapshot_key, reference_date, generated_at, timezone, source
    ) values (
      v_dashboard->>'snapshotKey',
      (v_dashboard->>'referenceDate')::date,
      (v_dashboard->>'generatedAt')::timestamptz,
      v_dashboard->>'timezone',
      v_dashboard->>'source'
    )
    on conflict (snapshot_key) do update set
      reference_date = excluded.reference_date,
      generated_at = excluded.generated_at,
      timezone = excluded.timezone,
      source = excluded.source
    returning id into v_dashboard_id;

    delete from public.crm_dashboard_views where snapshot_id = v_dashboard_id;
    delete from public.crm_dashboard_metrics where snapshot_id = v_dashboard_id;
    delete from public.crm_dashboard_top_developments where snapshot_id = v_dashboard_id;

    insert into public.crm_dashboard_views (
      snapshot_id, view_key, sales_value_month, sales_value_week, sales_value_today
    )
    select
      v_dashboard_id,
      x."viewKey",
      x."salesValueMonth",
      x."salesValueWeek",
      x."salesValueToday"
    from jsonb_to_recordset(v_dashboard->'views') as x(
      "viewKey" text,
      "salesValueMonth" numeric,
      "salesValueWeek" numeric,
      "salesValueToday" numeric
    );

    insert into public.crm_dashboard_metrics (
      snapshot_id, view_key, stage_key,
      current_month, current_week, current_today,
      goal_month, goal_week, goal_today,
      previous_month, year_closed_months_average,
      last_three_closed_months_average, previous_fourteen_days,
      last_fourteen_days, previous_seven_days, last_seven_days,
      previous_week, yesterday
    )
    select
      v_dashboard_id, x."viewKey", x."stageKey",
      x."currentMonth", x."currentWeek", x."currentToday",
      x."goalMonth", x."goalWeek", x."goalToday",
      x."previousMonth", x."yearClosedMonthsAverage",
      x."lastThreeClosedMonthsAverage", x."previousFourteenDays",
      x."lastFourteenDays", x."previousSevenDays", x."lastSevenDays",
      x."previousWeek", x."yesterday"
    from jsonb_to_recordset(v_dashboard->'metrics') as x(
      "viewKey" text, "stageKey" text,
      "currentMonth" bigint, "currentWeek" bigint, "currentToday" bigint,
      "goalMonth" numeric, "goalWeek" numeric, "goalToday" numeric,
      "previousMonth" bigint, "yearClosedMonthsAverage" numeric,
      "lastThreeClosedMonthsAverage" numeric, "previousFourteenDays" bigint,
      "lastFourteenDays" bigint, "previousSevenDays" bigint,
      "lastSevenDays" bigint, "previousWeek" bigint, "yesterday" bigint
    );

    insert into public.crm_dashboard_top_developments (
      snapshot_id, view_key, rank, name, total
    )
    select v_dashboard_id, x."viewKey", x.rank, x.name, x.total
    from jsonb_to_recordset(v_dashboard->'topDevelopments') as x(
      "viewKey" text, rank smallint, name text, total bigint
    );

    if jsonb_typeof(v_ranking) = 'object' then
      insert into public.crm_ranking_snapshots (
        snapshot_key, reference_date, generated_at, timezone, source
      ) values (
        v_ranking->>'snapshotKey',
        (v_ranking->>'referenceDate')::date,
        (v_ranking->>'generatedAt')::timestamptz,
        v_ranking->>'timezone',
        v_ranking->>'source'
      )
      on conflict (snapshot_key) do update set
        reference_date = excluded.reference_date,
        generated_at = excluded.generated_at,
        timezone = excluded.timezone,
        source = excluded.source
      returning id into v_ranking_id;

      delete from public.crm_ranking_participants where snapshot_id = v_ranking_id;
      insert into public.crm_ranking_participants (
        snapshot_id, period_key, broker_key, broker_name, manager_name,
        roulette, roulette_saturday, roulette_sunday, schedule, visit,
        approved_folder, sale
      )
      select
        v_ranking_id, x."periodKey", x."brokerKey", x."brokerName", x."managerName",
        x.roulette, x."rouletteSaturday", x."rouletteSunday", x.schedule,
        x.visit, x."approvedFolder", x.sale
      from jsonb_to_recordset(v_ranking->'participants') as x(
        "periodKey" text, "brokerKey" text, "brokerName" text, "managerName" text,
        roulette bigint, "rouletteSaturday" bigint, "rouletteSunday" bigint,
        schedule bigint, visit bigint, "approvedFolder" bigint, sale bigint
      );
    end if;

    v_record_count := jsonb_array_length(v_dashboard->'metrics')
      + coalesce(jsonb_array_length(v_ranking->'participants'), 0);

    update public.crm_ingestion_runs
       set status = 'succeeded', record_count = v_record_count, finished_at = now()
     where id = v_run_id;
    insert into public.audit_logs (action, after)
    values (
      'crm.ingestion.succeeded',
      jsonb_build_object('run_id', v_run_id, 'record_count', v_record_count)
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'succeeded',
      'runId', v_run_id,
      'recordCount', v_record_count
    );
  exception when others then
    update public.crm_ingestion_runs
       set status = 'failed', error_code = 'ingestion_rejected', finished_at = now()
     where id = v_run_id;
    insert into public.audit_logs (action, after)
    values ('crm.ingestion.failed', jsonb_build_object('run_id', v_run_id));
    return jsonb_build_object(
      'ok', false,
      'status', 'failed',
      'runId', v_run_id,
      'error', 'ingestion_rejected'
    );
  end;
end;
$$;

revoke all on function public.ingest_crm_salesforce_snapshot(jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_crm_salesforce_snapshot(jsonb)
  to service_role;
