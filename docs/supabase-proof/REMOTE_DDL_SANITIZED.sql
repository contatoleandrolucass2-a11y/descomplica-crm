-- =============================================================================
-- EVIDENCE ONLY — DO NOT EXECUTE
--
-- Sanitized read-only snapshot of observed remote DDL. This is not a migration,
-- baseline, restore script or desired security state. It intentionally records
-- historical grants, policies and legacy RPCs that are unsafe. Never pass this
-- file to psql, Supabase db push/reset, CI migration runners or any remote DB.
-- =============================================================================

--
-- PostgreSQL database dump
--

-- \restrict c1fJeb6nKuUXmMhVF6cWl1DByEDRHGAPv2qiuVdT2ke6cfg2Tee5kOYseH9VIpa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_stat_statements"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "pg_stat_statements" IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: ingest_crm_salesforce_snapshot_v1_internal("jsonb"); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."ingest_crm_salesforce_snapshot_v1_internal"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "private"."ingest_crm_salesforce_snapshot_v1_internal"("p_payload" "jsonb") OWNER TO "postgres";

--
-- Name: _internal_assert_actor_active("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_internal_assert_actor_active"("actor_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_level  integer;
  v_active boolean;
begin
  if actor_uuid is null then
    raise exception 'unauthorized: no actor in session'
      using errcode = '28000';
  end if;

  v_level := public._internal_get_role_level(actor_uuid);

  if v_level is null then
    raise exception 'unauthorized: actor has no role'
      using errcode = '28000';
  end if;

  -- profiles row may legitimately be absent in M5.2; only an explicit
  -- is_active = false blocks. A null/missing row is treated as active.
  select p.is_active
    into v_active
    from public.profiles p
    where p.user_id = actor_uuid;

  if v_active is false then
    raise exception 'forbidden: actor is inactive'
      using errcode = '42501';
  end if;

  return v_level;
end;
$$;


ALTER FUNCTION "public"."_internal_assert_actor_active"("actor_uuid" "uuid") OWNER TO "postgres";

--
-- Name: _internal_get_role_level("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_internal_get_role_level"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select r.level
  from public.user_roles ur
  join public.roles r on r.key = ur.role_key
  where ur.user_id = user_uuid;
$$;


ALTER FUNCTION "public"."_internal_get_role_level"("user_uuid" "uuid") OWNER TO "postgres";

--
-- Name: _internal_has_permission("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_internal_has_permission"("user_uuid" "uuid", "permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when not exists (
      select 1
      from public.profiles p
      where p.user_id = user_uuid
        and p.is_active
    ) then false
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'deny'
    ) then false
    when exists (
      select 1 from public.user_permission_overrides o
      where o.user_id = user_uuid
        and o.permission_key = _internal_has_permission.permission_key
        and o.effect = 'allow'
    ) then true
    when exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_key = ur.role_key
      where ur.user_id = user_uuid
        and rp.permission_key = _internal_has_permission.permission_key
    ) then true
    else false
  end;
$$;


ALTER FUNCTION "public"."_internal_has_permission"("user_uuid" "uuid", "permission_key" "text") OWNER TO "postgres";

--
-- Name: _internal_list_permissions("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."_internal_list_permissions"("user_uuid" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with role_perms as (
    select rp.permission_key as perm_key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = user_uuid
  ),
  allow_overrides as (
    select o.permission_key as perm_key
    from public.user_permission_overrides o
    where o.user_id = user_uuid
      and o.effect  = 'allow'
  ),
  combined as (
    select perm_key from role_perms
    union
    select perm_key from allow_overrides
  )
  select coalesce(array_agg(c.perm_key order by c.perm_key), array[]::text[])
  from combined c
  where not exists (
    select 1
    from public.user_permission_overrides d
    where d.user_id        = user_uuid
      and d.permission_key = c.perm_key
      and d.effect         = 'deny'
  );
$$;


ALTER FUNCTION "public"."_internal_list_permissions"("user_uuid" "uuid") OWNER TO "postgres";

--
-- Name: assign_user_role("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."assign_user_role"("target_user_id" "uuid", "target_role_key" "text", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_level  integer;
  v_target_level integer;
  v_target_role  text;
  v_new_level    integer;
  v_audit_id     bigint;
  v_before       jsonb;
  v_after        jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if target_role_key is null then
    raise exception 'invalid_argument: target_role_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  select r.level
    into v_new_level
    from public.roles r
    where r.key = target_role_key;

  if v_new_level is null then
    raise exception 'invalid_argument: unknown role %', target_role_key
      using errcode = '22023';
  end if;

  -- Lock the target's existing user_roles row (if any) for the txn.
  select ur.role_key, r.level
    into v_target_role, v_target_level
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    where ur.user_id = target_user_id
    for update;

  -- Target hierarchy guard.
  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  -- New-role hierarchy + permission guard (delegated).
  if not public.can_assign_role(v_actor, target_role_key) then
    raise exception
      'forbidden: actor cannot assign role % (level %)',
      target_role_key, v_new_level
      using errcode = '42501';
  end if;

  v_before := case
    when v_target_role is null then null::jsonb
    else jsonb_build_object('role_key', v_target_role, 'level', v_target_level)
  end;
  v_after := jsonb_build_object('role_key', target_role_key, 'level', v_new_level);

  insert into public.user_roles (user_id, role_key, assigned_by)
    values (target_user_id, target_role_key, v_actor)
    on conflict (user_id) do update
      set role_key    = excluded.role_key,
          assigned_by = excluded.assigned_by,
          updated_at  = now();

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.role_assigned',
      jsonb_build_object('previous', v_before, 'reason', reason),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;


ALTER FUNCTION "public"."assign_user_role"("target_user_id" "uuid", "target_role_key" "text", "reason" "text") OWNER TO "postgres";

--
-- Name: begin_crm_salesforce_refresh("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."begin_crm_salesforce_refresh"("p_request_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."begin_crm_salesforce_refresh"("p_request_key" "text") OWNER TO "postgres";

--
-- Name: bootstrap_master_user("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."bootstrap_master_user"("master_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_existing_master uuid;
  v_existing_role   text;
  v_audit_id        bigint;
begin
  if master_user_id is null then
    raise exception 'invalid_argument: master_user_id is required'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = master_user_id) then
    raise exception 'not_found: master user does not exist in auth.users'
      using errcode = 'P0002';
  end if;

  -- Hold a lock against any existing master row throughout the txn.
  select ur.user_id
    into v_existing_master
    from public.user_roles ur
    where ur.role_key = 'master'
    for update;

  if v_existing_master is not null
     and v_existing_master <> bootstrap_master_user.master_user_id then
    raise exception 'conflict: a different master user already exists'
      using errcode = '23505';
  end if;

  -- Already the master — idempotent no-op.
  if v_existing_master = bootstrap_master_user.master_user_id then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  -- Lock the target's existing role row (if any).
  select ur.role_key
    into v_existing_role
    from public.user_roles ur
    where ur.user_id = bootstrap_master_user.master_user_id
    for update;

  -- Ensure a minimal profile row exists.
  insert into public.profiles (user_id, is_active)
    values (bootstrap_master_user.master_user_id, true)
    on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_key, assigned_by)
    values (bootstrap_master_user.master_user_id, 'master',
            bootstrap_master_user.master_user_id)
    on conflict (user_id) do update
      set role_key    = 'master',
          assigned_by = excluded.assigned_by,
          updated_at  = now();

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      bootstrap_master_user.master_user_id,
      bootstrap_master_user.master_user_id,
      'authorization.master_bootstrap',
      case
        when v_existing_role is null then null::jsonb
        else jsonb_build_object('role_key', v_existing_role)
      end,
      jsonb_build_object('role_key', 'master', 'level', 100)
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;


ALTER FUNCTION "public"."bootstrap_master_user"("master_user_id" "uuid") OWNER TO "postgres";

--
-- Name: can_assign_role("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_assign_role"("actor_uuid" "uuid", "target_role_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'roles.manage'), false)
    and coalesce(
      (select r.level from public.roles r where r.key = target_role_key),
      2147483647
    ) < coalesce(public._internal_get_role_level(actor_uuid), 0);
$$;


ALTER FUNCTION "public"."can_assign_role"("actor_uuid" "uuid", "target_role_key" "text") OWNER TO "postgres";

--
-- Name: can_grant_permission("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_grant_permission"("actor_uuid" "uuid", "permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    coalesce(public._internal_has_permission(actor_uuid, 'permissions.manage'), false)
    and coalesce(public._internal_has_permission(actor_uuid, can_grant_permission.permission_key), false)
    and coalesce(
      (select p.min_level from public.permissions p where p.key = can_grant_permission.permission_key),
      2147483647
    ) < coalesce(public._internal_get_role_level(actor_uuid), 0);
$$;


ALTER FUNCTION "public"."can_grant_permission"("actor_uuid" "uuid", "permission_key" "text") OWNER TO "postgres";

--
-- Name: finish_crm_salesforce_refresh("uuid", "text", integer, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."finish_crm_salesforce_refresh"("p_run_id" "uuid", "p_status" "text", "p_http_status" integer DEFAULT NULL::integer, "p_error_code" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."finish_crm_salesforce_refresh"("p_run_id" "uuid", "p_status" "text", "p_http_status" integer, "p_error_code" "text") OWNER TO "postgres";

--
-- Name: get_crm_sync_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_crm_sync_status"() RETURNS TABLE("generated_at" timestamp with time zone, "last_ingest_at" timestamp with time zone, "last_ingest_status" "text", "refresh_status" "text", "refresh_requested_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_crm_sync_status"() OWNER TO "postgres";

--
-- Name: get_role_level("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_role_level"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when (select auth.uid()) is null then null
    when user_uuid = (select auth.uid())
      then public._internal_get_role_level(user_uuid)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      then public._internal_get_role_level(user_uuid)
    else null
  end;
$$;


ALTER FUNCTION "public"."get_role_level"("user_uuid" "uuid") OWNER TO "postgres";

--
-- Name: get_user_authorization_context("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_user_authorization_context"("user_uuid" "uuid") RETURNS TABLE("user_id" "uuid", "role_key" "text", "level" integer, "permissions" "text"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_caller uuid := (select auth.uid());
begin
  if v_caller is null or user_uuid is null then
    return;
  end if;

  if user_uuid <> v_caller
     and not coalesce(public._internal_has_permission(v_caller, 'users.view'), false) then
    return;
  end if;

  return query
    select
      ur.user_id,
      ur.role_key,
      r.level,
      public._internal_list_permissions(ur.user_id) as permissions
    from public.user_roles ur
    join public.roles r on r.key = ur.role_key
    join public.profiles p on p.user_id = ur.user_id and p.is_active
    where ur.user_id = user_uuid;
end;
$$;


ALTER FUNCTION "public"."get_user_authorization_context"("user_uuid" "uuid") OWNER TO "postgres";

--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (user_id, email, is_active, profile_completed)
    values (new.id, new.email, true, false)
    on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_key)
    values (new.id, 'user')
    on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";

--
-- Name: has_permission("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."has_permission"("user_uuid" "uuid", "permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when (select auth.uid()) is null then false
    when user_uuid = (select auth.uid())
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    when public._internal_has_permission((select auth.uid()), 'users.view')
      then public._internal_has_permission(user_uuid, has_permission.permission_key)
    else false
  end;
$$;


ALTER FUNCTION "public"."has_permission"("user_uuid" "uuid", "permission_key" "text") OWNER TO "postgres";

--
-- Name: ingest_crm_salesforce_snapshot("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ingest_crm_salesforce_snapshot"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_dashboard jsonb := p_payload->'dashboard';
  v_ranking jsonb := p_payload->'ranking';
  v_result jsonb;
begin
  if p_payload is null
     or p_payload->>'schemaVersion' <> '2'
     or jsonb_typeof(v_dashboard) is distinct from 'object'
     or jsonb_typeof(v_dashboard->'goalsAvailable') is distinct from 'boolean'
     or (
       v_ranking is not null
       and (
         jsonb_typeof(v_ranking) is distinct from 'object'
         or jsonb_typeof(v_ranking->'rouletteAvailable') is distinct from 'boolean'
       )
     ) then
    raise exception 'invalid ingestion availability' using errcode = '22023';
  end if;

  if not (v_dashboard->>'goalsAvailable')::boolean
     and exists (
       select 1
       from jsonb_array_elements(v_dashboard->'metrics') as metric
       where coalesce((metric->>'goalMonth')::numeric, 0) <> 0
          or coalesce((metric->>'goalWeek')::numeric, 0) <> 0
          or coalesce((metric->>'goalToday')::numeric, 0) <> 0
     ) then
    raise exception 'unavailable goals must be zero' using errcode = '22023';
  end if;

  if jsonb_typeof(v_ranking) = 'object'
     and not (v_ranking->>'rouletteAvailable')::boolean
     and exists (
       select 1
       from jsonb_array_elements(v_ranking->'participants') as participant
       where coalesce((participant->>'roulette')::bigint, 0) <> 0
          or coalesce((participant->>'rouletteSaturday')::bigint, 0) <> 0
          or coalesce((participant->>'rouletteSunday')::bigint, 0) <> 0
     ) then
    raise exception 'unavailable roulette must be zero' using errcode = '22023';
  end if;

  v_result := private.ingest_crm_salesforce_snapshot_v1_internal(
    p_payload || jsonb_build_object('schemaVersion', 1)
  );

  -- An idempotent replay must never mutate the availability attached to the
  -- original request, even if a caller reuses its request ID with other flags.
  if coalesce((v_result->>'ok')::boolean, false)
     and not coalesce((v_result->>'idempotent')::boolean, false) then
    update public.crm_dashboard_snapshots
       set goals_available = (v_dashboard->>'goalsAvailable')::boolean
     where snapshot_key = v_dashboard->>'snapshotKey';
    if not found then
      raise exception 'dashboard availability was not persisted' using errcode = 'P0001';
    end if;

    if jsonb_typeof(v_ranking) = 'object' then
      update public.crm_ranking_snapshots
         set roulette_available = (v_ranking->>'rouletteAvailable')::boolean
       where snapshot_key = v_ranking->>'snapshotKey';
      if not found then
        raise exception 'ranking availability was not persisted' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."ingest_crm_salesforce_snapshot"("p_payload" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: app_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."app_pages" (
    "key" "text" NOT NULL,
    "path" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "section" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "parent_key" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_navigation" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_pages_key_format" CHECK (("key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "app_pages_path_absolute" CHECK (("path" ~ '^/[A-Za-z0-9/_{}-]*$'::"text")),
    CONSTRAINT "app_pages_sort_order_nonnegative" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."app_pages" OWNER TO "postgres";

--
-- Name: list_app_pages_for_management(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."list_app_pages_for_management"() RETURNS SETOF "public"."app_pages"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'pages.manage') then
    raise exception 'forbidden: actor cannot manage pages'
      using errcode = '42501';
  end if;

  return query
    select p.*
    from public.app_pages p
    order by p.section, p.sort_order, p.key;
end;
$$;


ALTER FUNCTION "public"."list_app_pages_for_management"() OWNER TO "postgres";

--
-- Name: publish_crm_imob_ranking("jsonb", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_run_id uuid;
  v_reference_year smallint;
  v_generated_at timestamptz;
  v_row_count integer;
  v_development_row_count integer;
  v_inserted integer;
  v_developments_inserted integer := 0;
  v_developments jsonb;
begin
  if encode(extensions.digest(coalesce(sync_token, ''), 'sha256'), 'hex') <>
     '[REDACTED_SHA256_VERIFIER]' then
    raise exception using errcode = '42501', message = 'invalid_sync_token';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_payload';
  end if;

  if jsonb_typeof(payload -> 'entries') <> 'array' then
    raise exception using errcode = '22023', message = 'entries_must_be_array';
  end if;

  v_developments := coalesce(payload -> 'developments', '[]'::jsonb);
  if jsonb_typeof(v_developments) <> 'array' then
    raise exception using errcode = '22023', message = 'developments_must_be_array';
  end if;

  v_run_id := (payload ->> 'run_id')::uuid;
  v_reference_year := (payload ->> 'reference_year')::smallint;
  v_generated_at := (payload ->> 'generated_at')::timestamptz;
  v_row_count := (payload ->> 'row_count')::integer;
  v_development_row_count := coalesce((payload ->> 'development_row_count')::integer, 0);

  if v_row_count <= 0 or jsonb_array_length(payload -> 'entries') <> v_row_count then
    raise exception using errcode = '22023', message = 'row_count_mismatch';
  end if;

  if v_development_row_count < 0 or jsonb_array_length(v_developments) <> v_development_row_count then
    raise exception using errcode = '22023', message = 'development_row_count_mismatch';
  end if;

  insert into public.crm_imob_ranking_runs (
    id, status, reference_year, generated_at, source_updated_at,
    source, regional, company, row_count, development_row_count, started_at
  ) values (
    v_run_id, 'running', v_reference_year, v_generated_at, v_generated_at,
    'qlik:23.1-painel-comercial-vendas', 'SP CAPITAL', 'Direcional',
    v_row_count, v_development_row_count, now()
  );

  insert into public.crm_imob_ranking_entries (
    run_id, period_month, imob_key, imob_name, vgv, contracts,
    source_rank_vgv, source_rank_contracts
  )
  select
    v_run_id,
    entry.period_month::date,
    entry.imob_key,
    entry.imob_name,
    entry.vgv,
    entry.contracts,
    entry.source_rank_vgv,
    entry.source_rank_contracts
  from jsonb_to_recordset(payload -> 'entries') as entry(
    period_month text,
    imob_key text,
    imob_name text,
    vgv numeric,
    contracts integer,
    source_rank_vgv integer,
    source_rank_contracts integer
  );

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_row_count then
    raise exception using errcode = '22023', message = 'insert_count_mismatch';
  end if;

  if v_development_row_count > 0 then
    insert into public.crm_imob_ranking_developments (
      run_id, period_month, business_unit, development_key, development_name,
      vgv, contracts, source_rank_vgv, source_rank_contracts
    )
    select
      v_run_id,
      development.period_month::date,
      development.business_unit,
      development.development_key,
      development.development_name,
      development.vgv,
      development.contracts,
      development.source_rank_vgv,
      development.source_rank_contracts
    from jsonb_to_recordset(v_developments) as development(
      period_month text,
      business_unit text,
      development_key text,
      development_name text,
      vgv numeric,
      contracts integer,
      source_rank_vgv integer,
      source_rank_contracts integer
    );

    get diagnostics v_developments_inserted = row_count;
    if v_developments_inserted <> v_development_row_count then
      raise exception using errcode = '22023', message = 'development_insert_count_mismatch';
    end if;

    if exists (
      with imob_totals as (
        select period_month, sum(vgv) as vgv, sum(contracts) as contracts
        from public.crm_imob_ranking_entries
        where run_id = v_run_id
        group by period_month
      ), development_totals as (
        select period_month, sum(vgv) as vgv, sum(contracts) as contracts
        from public.crm_imob_ranking_developments
        where run_id = v_run_id
        group by period_month
      )
      select 1
      from imob_totals
      full join development_totals using (period_month)
      where imob_totals.period_month is null
         or development_totals.period_month is null
         or imob_totals.vgv <> development_totals.vgv
         or imob_totals.contracts <> development_totals.contracts
    ) then
      raise exception using errcode = '22023', message = 'monthly_totals_mismatch';
    end if;
  end if;

  update public.crm_imob_ranking_runs
  set status = 'succeeded',
      row_count = v_inserted,
      development_row_count = v_developments_inserted,
      completed_at = now(),
      error_message = null
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'row_count', v_inserted,
    'development_row_count', v_developments_inserted,
    'generated_at', v_generated_at
  );
end;
$$;


ALTER FUNCTION "public"."publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text") OWNER TO "postgres";

--
-- Name: remove_user_permission_override("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."remove_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = remove_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      remove_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, permission_key) then
    raise exception 'forbidden: actor cannot manage permission %',
      permission_key
      using errcode = '42501';
  end if;

  -- All guards passed. Now check whether there is anything to remove.
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = remove_user_permission_override.permission_key
    for update;

  if v_previous_effect is null then
    return jsonb_build_object('ok', true, 'audit_id', null, 'noop', true);
  end if;

  -- FIX: alias the target table and fully-qualify both sides so the bare
  -- `permission_key` is no longer ambiguous between column and parameter.
  delete from public.user_permission_overrides as upo
    where upo.user_id = remove_user_permission_override.target_user_id
      and upo.permission_key = remove_user_permission_override.permission_key;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_removed',
      jsonb_build_object(
        'permission_key', permission_key,
        'effect',         v_previous_effect,
        'reason',         reason
      ),
      null
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;


ALTER FUNCTION "public"."remove_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "reason" "text") OWNER TO "postgres";

--
-- Name: replace_crm_point_settings("jsonb", "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."replace_crm_point_settings"("p_weights" "jsonb", "p_targets" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_metric_keys constant text[] := array[
    'roulette',
    'roulette_saturday',
    'roulette_sunday',
    'schedule',
    'visit',
    'approved_folder',
    'sale'
  ];
  v_metric text;
  v_weight numeric;
  v_target numeric;
  v_before jsonb;
  v_after jsonb;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage'
      using errcode = '42501';
  end if;

  if p_weights is null or jsonb_typeof(p_weights) <> 'object'
     or p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception 'invalid_argument: weights and targets must be objects'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_weights) as supplied(key)
    where not supplied.key = any(v_metric_keys)
  ) or exists (
    select 1
    from jsonb_object_keys(p_targets) as supplied(key)
    where not supplied.key = any(v_metric_keys)
  ) then
    raise exception 'invalid_argument: unknown point metric'
      using errcode = '22023';
  end if;

  foreach v_metric in array v_metric_keys loop
    if not p_weights ? v_metric or not p_targets ? v_metric
       or jsonb_typeof(p_weights -> v_metric) <> 'number'
       or jsonb_typeof(p_targets -> v_metric) <> 'number' then
      raise exception 'invalid_argument: incomplete point metric %', v_metric
        using errcode = '22023';
    end if;

    v_weight := (p_weights ->> v_metric)::numeric;
    v_target := (p_targets ->> v_metric)::numeric;

    if v_weight <> trunc(v_weight) or v_weight < 0 or v_weight > 100000
       or v_target <> trunc(v_target) or v_target < 0 or v_target > 100000 then
      raise exception 'invalid_argument: invalid point metric %', v_metric
        using errcode = '22023';
    end if;
  end loop;

  select jsonb_object_agg(
    m.metric_key,
    jsonb_build_object('weight', m.weight, 'target', m.target)
  )
  into v_before
  from public.crm_point_metrics m
  where m.setting_key = 'default';

  insert into public.crm_point_settings (setting_key, updated_by)
  values ('default', v_actor)
  on conflict (setting_key) do update set updated_by = excluded.updated_by;

  foreach v_metric in array v_metric_keys loop
    insert into public.crm_point_metrics (setting_key, metric_key, weight, target)
    values (
      'default',
      v_metric,
      (p_weights ->> v_metric)::integer,
      (p_targets ->> v_metric)::integer
    )
    on conflict (setting_key, metric_key) do update set
      weight = excluded.weight,
      target = excluded.target;
  end loop;

  select jsonb_object_agg(
    m.metric_key,
    jsonb_build_object('weight', m.weight, 'target', m.target)
  )
  into v_after
  from public.crm_point_metrics m
  where m.setting_key = 'default';

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'crm.point_settings.replaced',
    v_before,
    v_after
  );

  return jsonb_build_object('setting_key', 'default', 'metrics', v_after);
end;
$$;


ALTER FUNCTION "public"."replace_crm_point_settings"("p_weights" "jsonb", "p_targets" "jsonb") OWNER TO "postgres";

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

--
-- Name: set_app_page_active("text", boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_app_page_active"("target_page_key" "text", "target_is_active" boolean, "reason" "text" DEFAULT NULL::"text") RETURNS "public"."app_pages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_before public.app_pages;
  v_after public.app_pages;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'pages.manage') then
    raise exception 'forbidden: actor cannot manage pages'
      using errcode = '42501';
  end if;

  if target_page_key is null or btrim(target_page_key) = '' then
    raise exception 'invalid_argument: target_page_key is required'
      using errcode = '22023';
  end if;

  if target_is_active is null then
    raise exception 'invalid_argument: target_is_active is required'
      using errcode = '22023';
  end if;

  select p.* into v_before
  from public.app_pages p
  where p.key = target_page_key
  for update;

  if not found then
    raise exception 'not_found: page does not exist'
      using errcode = 'P0002';
  end if;

  update public.app_pages p
  set is_active = target_is_active
  where p.key = target_page_key
  returning p.* into v_after;

  if v_before.is_active is distinct from v_after.is_active then
    insert into public.audit_logs
      (actor_id, action, before, after)
    values
      (
        v_actor,
        'authorization.page_visibility_changed',
        jsonb_build_object(
          'key', v_before.key,
          'is_active', v_before.is_active
        ),
        jsonb_build_object(
          'key', v_after.key,
          'is_active', v_after.is_active,
          'reason', nullif(btrim(reason), '')
        )
      );
  end if;

  return v_after;
end;
$$;


ALTER FUNCTION "public"."set_app_page_active"("target_page_key" "text", "target_is_active" boolean, "reason" "text") OWNER TO "postgres";

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "profile_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: set_user_active("uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_user_active"("target_user_id" "uuid", "target_is_active" boolean, "reason" "text" DEFAULT NULL::"text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_level integer;
  v_target_level integer;
  v_before public.profiles;
  v_after public.profiles;
begin
  v_actor_level := public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'users.manage') then
    raise exception 'forbidden: actor cannot manage users'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_is_active is null then
    raise exception 'invalid_argument: target and status are required'
      using errcode = '22023';
  end if;

  if target_user_id = v_actor then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  v_target_level := public._internal_get_role_level(target_user_id);
  if v_target_level is null or v_target_level >= v_actor_level then
    raise exception 'forbidden: target hierarchy is not manageable'
      using errcode = '42501';
  end if;

  select p.* into v_before
  from public.profiles p
  where p.user_id = target_user_id
  for update;

  if not found then
    raise exception 'not_found: user profile does not exist'
      using errcode = 'P0002';
  end if;

  update public.profiles p
  set is_active = target_is_active
  where p.user_id = target_user_id
  returning p.* into v_after;

  if v_before.is_active is distinct from v_after.is_active then
    insert into public.audit_logs
      (actor_id, target_user_id, action, before, after)
    values
      (
        v_actor,
        target_user_id,
        'authorization.user_status_changed',
        jsonb_build_object('is_active', v_before.is_active),
        jsonb_build_object(
          'is_active', v_after.is_active,
          'reason', nullif(btrim(reason), '')
        )
      );
  end if;

  return v_after;
end;
$$;


ALTER FUNCTION "public"."set_user_active"("target_user_id" "uuid", "target_is_active" boolean, "reason" "text") OWNER TO "postgres";

--
-- Name: set_user_permission_override("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "effect" "text", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
-- plpgsql: prefer column references when identifiers clash with parameter
-- names (e.g. permission_key, effect, reason match columns of
-- user_permission_overrides). Parameters are still reachable via the
-- function-qualified name (set_user_permission_override.permission_key).
#variable_conflict use_column
declare
  v_actor            uuid := (select auth.uid());
  v_actor_level      integer;
  v_target_level     integer;
  v_previous_effect  text;
  v_audit_id         bigint;
  v_before           jsonb;
  v_after            jsonb;
begin
  if target_user_id is null then
    raise exception 'invalid_argument: target_user_id is required'
      using errcode = '22023';
  end if;

  if permission_key is null then
    raise exception 'invalid_argument: permission_key is required'
      using errcode = '22023';
  end if;

  if set_user_permission_override.effect is null
     or set_user_permission_override.effect not in ('allow', 'deny') then
    raise exception 'invalid_argument: effect must be allow or deny'
      using errcode = '22023';
  end if;

  v_actor_level := public._internal_assert_actor_active(v_actor);

  if v_actor = target_user_id then
    raise exception 'forbidden: self-modification is not allowed'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'not_found: target user does not exist'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.permissions p
    where p.key = set_user_permission_override.permission_key
  ) then
    raise exception 'invalid_argument: unknown permission %',
      set_user_permission_override.permission_key
      using errcode = '22023';
  end if;

  -- Lock existing override row (if any).
  select o.effect
    into v_previous_effect
    from public.user_permission_overrides o
    where o.user_id = target_user_id
      and o.permission_key = set_user_permission_override.permission_key
    for update;

  v_target_level := public._internal_get_role_level(target_user_id);

  if v_target_level is not null and v_target_level >= v_actor_level then
    raise exception
      'forbidden: target user level (%) is not below actor level (%)',
      v_target_level, v_actor_level
      using errcode = '42501';
  end if;

  if not public.can_grant_permission(v_actor, set_user_permission_override.permission_key) then
    raise exception 'forbidden: actor cannot grant permission %',
      set_user_permission_override.permission_key
      using errcode = '42501';
  end if;

  v_before := case
    when v_previous_effect is null then null::jsonb
    else jsonb_build_object('effect', v_previous_effect)
  end;
  v_after := jsonb_build_object('effect', set_user_permission_override.effect);

  insert into public.user_permission_overrides
    (user_id, permission_key, effect, reason, granted_by)
    values (
      target_user_id,
      set_user_permission_override.permission_key,
      set_user_permission_override.effect,
      set_user_permission_override.reason,
      v_actor
    )
    on conflict (user_id, permission_key) do update
      set effect     = excluded.effect,
          reason     = excluded.reason,
          granted_by = excluded.granted_by;

  insert into public.audit_logs (actor_id, target_user_id, action, before, after)
    values (
      v_actor,
      target_user_id,
      'authorization.permission_override_set',
      jsonb_build_object(
        'permission_key', set_user_permission_override.permission_key,
        'previous',       v_before,
        'reason',         set_user_permission_override.reason
      ),
      v_after
    )
    returning id into v_audit_id;

  return jsonb_build_object('ok', true, 'audit_id', v_audit_id);
end;
$$;


ALTER FUNCTION "public"."set_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "effect" "text", "reason" "text") OWNER TO "postgres";

--
-- Name: crm_funnel_goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_funnel_goals" (
    "id" bigint NOT NULL,
    "profile_key" "text" NOT NULL,
    "effective_month" "date" NOT NULL,
    "opportunities" bigint DEFAULT 0 NOT NULL,
    "appointments" bigint DEFAULT 0 NOT NULL,
    "visits" bigint DEFAULT 0 NOT NULL,
    "folders" bigint DEFAULT 0 NOT NULL,
    "approved_folders" bigint DEFAULT 0 NOT NULL,
    "sales" bigint DEFAULT 0 NOT NULL,
    "opportunities_rate" numeric(8,2) DEFAULT 0 NOT NULL,
    "appointments_rate" numeric(8,2) DEFAULT 0 NOT NULL,
    "visits_rate" numeric(8,2) DEFAULT 0 NOT NULL,
    "folders_rate" numeric(8,2) DEFAULT 0 NOT NULL,
    "approved_folders_rate" numeric(8,2) DEFAULT 0 NOT NULL,
    "broker_minimum_month_1" integer DEFAULT 0 NOT NULL,
    "broker_minimum_month_2" integer DEFAULT 0 NOT NULL,
    "broker_minimum_month_3" integer DEFAULT 0 NOT NULL,
    "broker_minimum_month_4_plus" integer DEFAULT 0 NOT NULL,
    "broker_weekly_appointments" integer DEFAULT 0 NOT NULL,
    "broker_weekly_visits" integer DEFAULT 0 NOT NULL,
    "broker_weekly_folders" integer DEFAULT 0 NOT NULL,
    "productive_team_appointments" smallint DEFAULT 0 NOT NULL,
    "productive_team_visits" smallint DEFAULT 0 NOT NULL,
    "productive_team_folders" smallint DEFAULT 0 NOT NULL,
    "productive_team_sales" smallint DEFAULT 0 NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_funnel_goals_broker_minimums" CHECK (((("broker_minimum_month_1" >= 0) AND ("broker_minimum_month_1" <= 100000)) AND (("broker_minimum_month_2" >= 0) AND ("broker_minimum_month_2" <= 100000)) AND (("broker_minimum_month_3" >= 0) AND ("broker_minimum_month_3" <= 100000)) AND (("broker_minimum_month_4_plus" >= 0) AND ("broker_minimum_month_4_plus" <= 100000)))),
    CONSTRAINT "crm_funnel_goals_broker_weekly" CHECK (((("broker_weekly_appointments" >= 0) AND ("broker_weekly_appointments" <= 100000)) AND (("broker_weekly_visits" >= 0) AND ("broker_weekly_visits" <= 100000)) AND (("broker_weekly_folders" >= 0) AND ("broker_weekly_folders" <= 100000)))),
    CONSTRAINT "crm_funnel_goals_effective_month_start" CHECK (("effective_month" = ("date_trunc"('month'::"text", ("effective_month")::timestamp with time zone))::"date")),
    CONSTRAINT "crm_funnel_goals_partnership_scope" CHECK ((("profile_key" <> 'partnerships'::"text") OR (("opportunities" = 0) AND ("appointments" = 0) AND ("opportunities_rate" = (0)::numeric) AND ("appointments_rate" = (0)::numeric) AND ("broker_weekly_appointments" = 0) AND ("productive_team_appointments" = 0)))),
    CONSTRAINT "crm_funnel_goals_productive_team" CHECK (((("productive_team_appointments" >= 0) AND ("productive_team_appointments" <= 100)) AND (("productive_team_visits" >= 0) AND ("productive_team_visits" <= 100)) AND (("productive_team_folders" >= 0) AND ("productive_team_folders" <= 100)) AND (("productive_team_sales" >= 0) AND ("productive_team_sales" <= 100)))),
    CONSTRAINT "crm_funnel_goals_profile_key" CHECK (("profile_key" = ANY (ARRAY['dv'::"text", 'partnerships'::"text"]))),
    CONSTRAINT "crm_funnel_goals_rates" CHECK (((("opportunities_rate" >= (0)::numeric) AND ("opportunities_rate" <= (10000)::numeric)) AND (("appointments_rate" >= (0)::numeric) AND ("appointments_rate" <= (10000)::numeric)) AND (("visits_rate" >= (0)::numeric) AND ("visits_rate" <= (10000)::numeric)) AND (("folders_rate" >= (0)::numeric) AND ("folders_rate" <= (10000)::numeric)) AND (("approved_folders_rate" >= (0)::numeric) AND ("approved_folders_rate" <= (10000)::numeric)))),
    CONSTRAINT "crm_funnel_goals_stage_values" CHECK (((("opportunities" >= 0) AND ("opportunities" <= 10000000)) AND (("appointments" >= 0) AND ("appointments" <= 10000000)) AND (("visits" >= 0) AND ("visits" <= 10000000)) AND (("folders" >= 0) AND ("folders" <= 10000000)) AND (("approved_folders" >= 0) AND ("approved_folders" <= 10000000)) AND (("sales" >= 0) AND ("sales" <= 10000000))))
);


ALTER TABLE "public"."crm_funnel_goals" OWNER TO "postgres";

--
-- Name: upsert_crm_funnel_goals("text", "date", bigint, numeric, numeric, numeric, numeric, numeric, integer, integer, integer, integer, integer, integer, integer, smallint, smallint, smallint, smallint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."upsert_crm_funnel_goals"("p_profile_key" "text", "p_effective_month" "date", "p_sales" bigint, "p_opportunities_rate" numeric, "p_appointments_rate" numeric, "p_visits_rate" numeric, "p_folders_rate" numeric, "p_approved_folders_rate" numeric, "p_broker_minimum_month_1" integer, "p_broker_minimum_month_2" integer, "p_broker_minimum_month_3" integer, "p_broker_minimum_month_4_plus" integer, "p_broker_weekly_appointments" integer, "p_broker_weekly_visits" integer, "p_broker_weekly_folders" integer, "p_productive_team_appointments" smallint, "p_productive_team_visits" smallint, "p_productive_team_folders" smallint, "p_productive_team_sales" smallint) RETURNS "public"."crm_funnel_goals"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := (select auth.uid());
  v_before jsonb;
  v_after public.crm_funnel_goals;
  v_effective_month date;
  v_opportunities bigint;
  v_appointments bigint;
  v_visits bigint;
  v_folders bigint;
  v_approved_folders bigint;
begin
  perform public._internal_assert_actor_active(v_actor);

  if not public._internal_has_permission(v_actor, 'crm.settings.manage') then
    raise exception 'forbidden: missing crm.settings.manage'
      using errcode = '42501';
  end if;

  if p_profile_key is null or p_profile_key not in ('dv', 'partnerships') then
    raise exception 'invalid_argument: invalid profile'
      using errcode = '22023';
  end if;

  if p_effective_month is null then
    raise exception 'invalid_argument: effective month is required'
      using errcode = '22023';
  end if;

  v_effective_month := date_trunc('month', p_effective_month)::date;

  if p_sales is null or p_sales < 0 or p_sales > 10000000
     or p_opportunities_rate is null or p_opportunities_rate < 0 or p_opportunities_rate > 10000
     or p_appointments_rate is null or p_appointments_rate < 0 or p_appointments_rate > 10000
     or p_visits_rate is null or p_visits_rate < 0 or p_visits_rate > 10000
     or p_folders_rate is null or p_folders_rate < 0 or p_folders_rate > 10000
     or p_approved_folders_rate is null or p_approved_folders_rate < 0 or p_approved_folders_rate > 10000
     or p_broker_minimum_month_1 is null or p_broker_minimum_month_1 < 0 or p_broker_minimum_month_1 > 100000
     or p_broker_minimum_month_2 is null or p_broker_minimum_month_2 < 0 or p_broker_minimum_month_2 > 100000
     or p_broker_minimum_month_3 is null or p_broker_minimum_month_3 < 0 or p_broker_minimum_month_3 > 100000
     or p_broker_minimum_month_4_plus is null or p_broker_minimum_month_4_plus < 0 or p_broker_minimum_month_4_plus > 100000
     or p_broker_weekly_appointments is null or p_broker_weekly_appointments < 0 or p_broker_weekly_appointments > 100000
     or p_broker_weekly_visits is null or p_broker_weekly_visits < 0 or p_broker_weekly_visits > 100000
     or p_broker_weekly_folders is null or p_broker_weekly_folders < 0 or p_broker_weekly_folders > 100000
     or p_productive_team_appointments is null or p_productive_team_appointments < 0 or p_productive_team_appointments > 100
     or p_productive_team_visits is null or p_productive_team_visits < 0 or p_productive_team_visits > 100
     or p_productive_team_folders is null or p_productive_team_folders < 0 or p_productive_team_folders > 100
     or p_productive_team_sales is null or p_productive_team_sales < 0 or p_productive_team_sales > 100 then
    raise exception 'invalid_argument: goal values are outside accepted ranges'
      using errcode = '22023';
  end if;

  if p_profile_key = 'partnerships' then
    p_opportunities_rate := 0;
    p_appointments_rate := 0;
    p_broker_weekly_appointments := 0;
    p_productive_team_appointments := 0;
  end if;

  v_approved_folders := round(p_sales * p_approved_folders_rate / 100.0);
  v_folders := round(v_approved_folders * p_folders_rate / 100.0);
  v_visits := round(v_folders * p_visits_rate / 100.0);
  v_appointments := case
    when p_profile_key = 'partnerships' then 0
    else round(v_visits * p_appointments_rate / 100.0)
  end;
  v_opportunities := case
    when p_profile_key = 'partnerships' then 0
    else round(v_appointments * p_opportunities_rate / 100.0)
  end;

  if greatest(
    v_opportunities,
    v_appointments,
    v_visits,
    v_folders,
    v_approved_folders,
    p_sales
  ) > 10000000 then
    raise exception 'invalid_argument: calculated goals exceed accepted range'
      using errcode = '22023';
  end if;

  select to_jsonb(g)
    into v_before
    from public.crm_funnel_goals g
    where g.profile_key = p_profile_key
      and g.effective_month = v_effective_month
    for update;

  insert into public.crm_funnel_goals (
    profile_key,
    effective_month,
    opportunities,
    appointments,
    visits,
    folders,
    approved_folders,
    sales,
    opportunities_rate,
    appointments_rate,
    visits_rate,
    folders_rate,
    approved_folders_rate,
    broker_minimum_month_1,
    broker_minimum_month_2,
    broker_minimum_month_3,
    broker_minimum_month_4_plus,
    broker_weekly_appointments,
    broker_weekly_visits,
    broker_weekly_folders,
    productive_team_appointments,
    productive_team_visits,
    productive_team_folders,
    productive_team_sales,
    updated_by
  ) values (
    p_profile_key,
    v_effective_month,
    v_opportunities,
    v_appointments,
    v_visits,
    v_folders,
    v_approved_folders,
    p_sales,
    p_opportunities_rate,
    p_appointments_rate,
    p_visits_rate,
    p_folders_rate,
    p_approved_folders_rate,
    p_broker_minimum_month_1,
    p_broker_minimum_month_2,
    p_broker_minimum_month_3,
    p_broker_minimum_month_4_plus,
    p_broker_weekly_appointments,
    p_broker_weekly_visits,
    p_broker_weekly_folders,
    p_productive_team_appointments,
    p_productive_team_visits,
    p_productive_team_folders,
    p_productive_team_sales,
    v_actor
  )
  on conflict (profile_key, effective_month) do update set
    opportunities = excluded.opportunities,
    appointments = excluded.appointments,
    visits = excluded.visits,
    folders = excluded.folders,
    approved_folders = excluded.approved_folders,
    sales = excluded.sales,
    opportunities_rate = excluded.opportunities_rate,
    appointments_rate = excluded.appointments_rate,
    visits_rate = excluded.visits_rate,
    folders_rate = excluded.folders_rate,
    approved_folders_rate = excluded.approved_folders_rate,
    broker_minimum_month_1 = excluded.broker_minimum_month_1,
    broker_minimum_month_2 = excluded.broker_minimum_month_2,
    broker_minimum_month_3 = excluded.broker_minimum_month_3,
    broker_minimum_month_4_plus = excluded.broker_minimum_month_4_plus,
    broker_weekly_appointments = excluded.broker_weekly_appointments,
    broker_weekly_visits = excluded.broker_weekly_visits,
    broker_weekly_folders = excluded.broker_weekly_folders,
    productive_team_appointments = excluded.productive_team_appointments,
    productive_team_visits = excluded.productive_team_visits,
    productive_team_folders = excluded.productive_team_folders,
    productive_team_sales = excluded.productive_team_sales,
    updated_by = excluded.updated_by
  returning * into v_after;

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'crm.funnel_goals.upserted',
    v_before,
    to_jsonb(v_after)
  );

  return v_after;
end;
$$;


ALTER FUNCTION "public"."upsert_crm_funnel_goals"("p_profile_key" "text", "p_effective_month" "date", "p_sales" bigint, "p_opportunities_rate" numeric, "p_appointments_rate" numeric, "p_visits_rate" numeric, "p_folders_rate" numeric, "p_approved_folders_rate" numeric, "p_broker_minimum_month_1" integer, "p_broker_minimum_month_2" integer, "p_broker_minimum_month_3" integer, "p_broker_minimum_month_4_plus" integer, "p_broker_weekly_appointments" integer, "p_broker_weekly_visits" integer, "p_broker_weekly_folders" integer, "p_productive_team_appointments" smallint, "p_productive_team_visits" smallint, "p_productive_team_folders" smallint, "p_productive_team_sales" smallint) OWNER TO "postgres";

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "actor_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "before" "jsonb",
    "after" "jsonb",
    "ip" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";


--
-- Name: crm_dashboard_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_dashboard_metrics" (
    "snapshot_id" bigint NOT NULL,
    "view_key" "text" NOT NULL,
    "stage_key" "text" NOT NULL,
    "current_month" bigint DEFAULT 0 NOT NULL,
    "current_week" bigint DEFAULT 0 NOT NULL,
    "current_today" bigint DEFAULT 0 NOT NULL,
    "goal_month" numeric(14,2) DEFAULT 0 NOT NULL,
    "goal_week" numeric(14,2) DEFAULT 0 NOT NULL,
    "goal_today" numeric(14,2) DEFAULT 0 NOT NULL,
    "previous_month" bigint,
    "year_closed_months_average" numeric(14,2),
    "last_three_closed_months_average" numeric(14,2),
    "previous_fourteen_days" bigint,
    "last_fourteen_days" bigint,
    "previous_seven_days" bigint,
    "last_seven_days" bigint,
    "previous_week" bigint,
    "yesterday" bigint,
    CONSTRAINT "crm_dashboard_metrics_nonnegative" CHECK ((("current_month" >= 0) AND ("current_week" >= 0) AND ("current_today" >= 0) AND ("goal_month" >= (0)::numeric) AND ("goal_week" >= (0)::numeric) AND ("goal_today" >= (0)::numeric) AND (COALESCE("previous_month", (0)::bigint) >= 0) AND (COALESCE("year_closed_months_average", (0)::numeric) >= (0)::numeric) AND (COALESCE("last_three_closed_months_average", (0)::numeric) >= (0)::numeric) AND (COALESCE("previous_fourteen_days", (0)::bigint) >= 0) AND (COALESCE("last_fourteen_days", (0)::bigint) >= 0) AND (COALESCE("previous_seven_days", (0)::bigint) >= 0) AND (COALESCE("last_seven_days", (0)::bigint) >= 0) AND (COALESCE("previous_week", (0)::bigint) >= 0) AND (COALESCE("yesterday", (0)::bigint) >= 0))),
    CONSTRAINT "crm_dashboard_metrics_stage_key" CHECK (("stage_key" = ANY (ARRAY['opportunities'::"text", 'appointments'::"text", 'visits'::"text", 'folders'::"text", 'sales'::"text"]))),
    CONSTRAINT "crm_dashboard_metrics_view_key" CHECK (("view_key" = ANY (ARRAY['all'::"text", 'with_canal_imob'::"text", 'without_canal_imob'::"text"])))
);


ALTER TABLE "public"."crm_dashboard_metrics" OWNER TO "postgres";

--
-- Name: crm_dashboard_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_dashboard_snapshots" (
    "id" bigint NOT NULL,
    "snapshot_key" "text" NOT NULL,
    "reference_date" "date" NOT NULL,
    "generated_at" timestamp with time zone NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "goals_available" boolean DEFAULT false NOT NULL,
    CONSTRAINT "crm_dashboard_snapshots_key_format" CHECK (("snapshot_key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "crm_dashboard_snapshots_source_nonempty" CHECK (("btrim"("source") <> ''::"text")),
    CONSTRAINT "crm_dashboard_snapshots_timezone_nonempty" CHECK (("btrim"("timezone") <> ''::"text"))
);


ALTER TABLE "public"."crm_dashboard_snapshots" OWNER TO "postgres";

--
-- Name: COLUMN "crm_dashboard_snapshots"."goals_available"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."crm_dashboard_snapshots"."goals_available" IS 'True only when all dashboard goals came from an authorized source.';


--
-- Name: crm_dashboard_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_dashboard_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."crm_dashboard_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_dashboard_top_developments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_dashboard_top_developments" (
    "snapshot_id" bigint NOT NULL,
    "view_key" "text" NOT NULL,
    "rank" smallint NOT NULL,
    "name" "text" NOT NULL,
    "total" bigint NOT NULL,
    CONSTRAINT "crm_dashboard_top_developments_name_nonempty" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "crm_dashboard_top_developments_rank" CHECK ((("rank" >= 1) AND ("rank" <= 5))),
    CONSTRAINT "crm_dashboard_top_developments_total_positive" CHECK (("total" > 0)),
    CONSTRAINT "crm_dashboard_top_developments_view_key" CHECK (("view_key" = ANY (ARRAY['all'::"text", 'with_canal_imob'::"text", 'without_canal_imob'::"text"])))
);


ALTER TABLE "public"."crm_dashboard_top_developments" OWNER TO "postgres";

--
-- Name: crm_dashboard_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_dashboard_views" (
    "snapshot_id" bigint NOT NULL,
    "view_key" "text" NOT NULL,
    "sales_value_month" numeric(16,2) DEFAULT 0 NOT NULL,
    "sales_value_week" numeric(16,2) DEFAULT 0 NOT NULL,
    "sales_value_today" numeric(16,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "crm_dashboard_views_sales_nonnegative" CHECK ((("sales_value_month" >= (0)::numeric) AND ("sales_value_week" >= (0)::numeric) AND ("sales_value_today" >= (0)::numeric))),
    CONSTRAINT "crm_dashboard_views_view_key" CHECK (("view_key" = ANY (ARRAY['all'::"text", 'with_canal_imob'::"text", 'without_canal_imob'::"text"])))
);


ALTER TABLE "public"."crm_dashboard_views" OWNER TO "postgres";

--
-- Name: crm_funnel_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_funnel_goals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."crm_funnel_goals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: crm_imob_ranking_developments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_imob_ranking_developments" (
    "run_id" "uuid" NOT NULL,
    "period_month" "date" NOT NULL,
    "business_unit" "text" NOT NULL,
    "development_key" "text" NOT NULL,
    "development_name" "text" NOT NULL,
    "vgv" numeric DEFAULT 0 NOT NULL,
    "contracts" integer DEFAULT 0 NOT NULL,
    "source_rank_vgv" integer,
    "source_rank_contracts" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_imob_ranking_developments_business_unit_check" CHECK (("btrim"("business_unit") <> ''::"text")),
    CONSTRAINT "crm_imob_ranking_developments_contracts_check" CHECK (("contracts" >= 0)),
    CONSTRAINT "crm_imob_ranking_developments_development_key_check" CHECK (("development_key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "crm_imob_ranking_developments_development_name_check" CHECK (("btrim"("development_name") <> ''::"text")),
    CONSTRAINT "crm_imob_ranking_developments_period_month_check" CHECK (("period_month" = ("date_trunc"('month'::"text", ("period_month")::timestamp with time zone))::"date")),
    CONSTRAINT "crm_imob_ranking_developments_source_rank_contracts_check" CHECK ((("source_rank_contracts" IS NULL) OR ("source_rank_contracts" > 0))),
    CONSTRAINT "crm_imob_ranking_developments_source_rank_vgv_check" CHECK ((("source_rank_vgv" IS NULL) OR ("source_rank_vgv" > 0))),
    CONSTRAINT "crm_imob_ranking_developments_vgv_check" CHECK (("vgv" >= (0)::numeric))
);


ALTER TABLE "public"."crm_imob_ranking_developments" OWNER TO "postgres";

--
-- Name: TABLE "crm_imob_ranking_developments"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."crm_imob_ranking_developments" IS 'Monthly development ranking rows from the same Qlik run and filters as the IMOB ranking.';


--
-- Name: crm_imob_ranking_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_imob_ranking_entries" (
    "run_id" "uuid" NOT NULL,
    "period_month" "date" NOT NULL,
    "imob_key" "text" NOT NULL,
    "imob_name" "text" NOT NULL,
    "vgv" numeric(18,2) DEFAULT 0 NOT NULL,
    "contracts" integer DEFAULT 0 NOT NULL,
    "source_rank_vgv" integer,
    "source_rank_contracts" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_imob_ranking_entries_contracts_check" CHECK (("contracts" >= 0)),
    CONSTRAINT "crm_imob_ranking_entries_imob_key_check" CHECK (("imob_key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "crm_imob_ranking_entries_imob_name_check" CHECK (("btrim"("imob_name") <> ''::"text")),
    CONSTRAINT "crm_imob_ranking_entries_period_month_check" CHECK (("period_month" = ("date_trunc"('month'::"text", ("period_month")::timestamp without time zone))::"date")),
    CONSTRAINT "crm_imob_ranking_entries_source_rank_contracts_check" CHECK ((("source_rank_contracts" IS NULL) OR ("source_rank_contracts" > 0))),
    CONSTRAINT "crm_imob_ranking_entries_source_rank_vgv_check" CHECK ((("source_rank_vgv" IS NULL) OR ("source_rank_vgv" > 0))),
    CONSTRAINT "crm_imob_ranking_entries_vgv_check" CHECK (("vgv" >= (0)::numeric))
);


ALTER TABLE "public"."crm_imob_ranking_entries" OWNER TO "postgres";

--
-- Name: TABLE "crm_imob_ranking_entries"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."crm_imob_ranking_entries" IS 'Monthly partner real-estate ranking rows associated with an import run.';


--
-- Name: crm_imob_ranking_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_imob_ranking_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "reference_year" smallint NOT NULL,
    "generated_at" timestamp with time zone NOT NULL,
    "source_updated_at" timestamp with time zone,
    "source" "text" DEFAULT 'qlik:23.1-painel-comercial-vendas'::"text" NOT NULL,
    "regional" "text" DEFAULT 'SP CAPITAL'::"text" NOT NULL,
    "company" "text" DEFAULT 'Direcional'::"text" NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "development_row_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "crm_imob_ranking_runs_check" CHECK (((("status" = 'succeeded'::"text") AND ("completed_at" IS NOT NULL)) OR ("status" <> 'succeeded'::"text"))),
    CONSTRAINT "crm_imob_ranking_runs_development_row_count_check" CHECK (("development_row_count" >= 0)),
    CONSTRAINT "crm_imob_ranking_runs_reference_year_check" CHECK ((("reference_year" >= 2020) AND ("reference_year" <= 2100))),
    CONSTRAINT "crm_imob_ranking_runs_row_count_check" CHECK (("row_count" >= 0)),
    CONSTRAINT "crm_imob_ranking_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."crm_imob_ranking_runs" OWNER TO "postgres";

--
-- Name: TABLE "crm_imob_ranking_runs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."crm_imob_ranking_runs" IS 'Execution metadata from the external Qlik partner-ranking import.';


--
-- Name: crm_ingestion_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_ingestion_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_key" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "status" "text" NOT NULL,
    "workflow" "text" NOT NULL,
    "requested_by" "uuid",
    "record_count" integer DEFAULT 0 NOT NULL,
    "http_status" smallint,
    "error_code" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_ingestion_runs_completion" CHECK (((("status" = 'running'::"text") AND ("finished_at" IS NULL)) OR (("status" = ANY (ARRAY['succeeded'::"text", 'failed'::"text"])) AND ("finished_at" IS NOT NULL)))),
    CONSTRAINT "crm_ingestion_runs_error_code" CHECK ((("error_code" IS NULL) OR ("error_code" ~ '^[a-z][a-z0-9_]{2,63}$'::"text"))),
    CONSTRAINT "crm_ingestion_runs_http_status" CHECK ((("http_status" IS NULL) OR (("http_status" >= 100) AND ("http_status" <= 599)))),
    CONSTRAINT "crm_ingestion_runs_kind" CHECK (("kind" = ANY (ARRAY['salesforce_ingest'::"text", 'salesforce_refresh'::"text"]))),
    CONSTRAINT "crm_ingestion_runs_record_count" CHECK ((("record_count" >= 0) AND ("record_count" <= 10000))),
    CONSTRAINT "crm_ingestion_runs_request_key_format" CHECK (("request_key" ~ '^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,127}$'::"text")),
    CONSTRAINT "crm_ingestion_runs_status" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text"]))),
    CONSTRAINT "crm_ingestion_runs_workflow_nonempty" CHECK ((("btrim"("workflow") <> ''::"text") AND ("length"("workflow") <= 100)))
);


ALTER TABLE "public"."crm_ingestion_runs" OWNER TO "postgres";

--
-- Name: crm_point_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_point_metrics" (
    "setting_key" "text" NOT NULL,
    "metric_key" "text" NOT NULL,
    "weight" integer DEFAULT 0 NOT NULL,
    "target" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "crm_point_metrics_key" CHECK (("metric_key" = ANY (ARRAY['roulette'::"text", 'roulette_saturday'::"text", 'roulette_sunday'::"text", 'schedule'::"text", 'visit'::"text", 'approved_folder'::"text", 'sale'::"text"]))),
    CONSTRAINT "crm_point_metrics_values" CHECK (((("weight" >= 0) AND ("weight" <= 100000)) AND (("target" >= 0) AND ("target" <= 100000))))
);


ALTER TABLE "public"."crm_point_metrics" OWNER TO "postgres";

--
-- Name: crm_point_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_point_settings" (
    "setting_key" "text" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "crm_point_settings_key" CHECK (("setting_key" = 'default'::"text"))
);


ALTER TABLE "public"."crm_point_settings" OWNER TO "postgres";

--
-- Name: crm_ranking_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_ranking_participants" (
    "snapshot_id" bigint NOT NULL,
    "period_key" "text" NOT NULL,
    "broker_key" "text" NOT NULL,
    "broker_name" "text" NOT NULL,
    "manager_name" "text" NOT NULL,
    "roulette" bigint DEFAULT 0 NOT NULL,
    "roulette_saturday" bigint DEFAULT 0 NOT NULL,
    "roulette_sunday" bigint DEFAULT 0 NOT NULL,
    "schedule" bigint DEFAULT 0 NOT NULL,
    "visit" bigint DEFAULT 0 NOT NULL,
    "approved_folder" bigint DEFAULT 0 NOT NULL,
    "sale" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "crm_ranking_participants_broker_key_format" CHECK (("broker_key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "crm_ranking_participants_counts_nonnegative" CHECK ((("roulette" >= 0) AND ("roulette_saturday" >= 0) AND ("roulette_sunday" >= 0) AND ("schedule" >= 0) AND ("visit" >= 0) AND ("approved_folder" >= 0) AND ("sale" >= 0))),
    CONSTRAINT "crm_ranking_participants_names_nonempty" CHECK ((("btrim"("broker_name") <> ''::"text") AND ("btrim"("manager_name") <> ''::"text"))),
    CONSTRAINT "crm_ranking_participants_period_key" CHECK (("period_key" = ANY (ARRAY['month'::"text", 'last_week'::"text", 'week'::"text", 'today'::"text"])))
);


ALTER TABLE "public"."crm_ranking_participants" OWNER TO "postgres";

--
-- Name: crm_ranking_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_ranking_snapshots" (
    "id" bigint NOT NULL,
    "snapshot_key" "text" NOT NULL,
    "reference_date" "date" NOT NULL,
    "generated_at" timestamp with time zone NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "roulette_available" boolean DEFAULT false NOT NULL,
    CONSTRAINT "crm_ranking_snapshots_key_format" CHECK (("snapshot_key" ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'::"text")),
    CONSTRAINT "crm_ranking_snapshots_source_nonempty" CHECK (("btrim"("source") <> ''::"text")),
    CONSTRAINT "crm_ranking_snapshots_timezone_nonempty" CHECK (("btrim"("timezone") <> ''::"text"))
);


ALTER TABLE "public"."crm_ranking_snapshots" OWNER TO "postgres";

--
-- Name: COLUMN "crm_ranking_snapshots"."roulette_available"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."crm_ranking_snapshots"."roulette_available" IS 'True only when roulette counts came from an authorized source.';


--
-- Name: crm_ranking_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_ranking_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."crm_ranking_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "key" "text" NOT NULL,
    "description" "text" NOT NULL,
    "min_level" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_key" "text" NOT NULL,
    "permission_key" "text" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."roles" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer NOT NULL,
    "is_system" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roles_level_positive" CHECK (("level" > 0))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";

--
-- Name: user_permission_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_permission_overrides" (
    "user_id" "uuid" NOT NULL,
    "permission_key" "text" NOT NULL,
    "effect" "text" NOT NULL,
    "reason" "text",
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_permission_overrides_effect_check" CHECK (("effect" = ANY (ARRAY['allow'::"text", 'deny'::"text"])))
);


ALTER TABLE "public"."user_permission_overrides" OWNER TO "postgres";

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_key" "text" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";

--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");


--
-- Name: app_pages app_pages_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_pages"
    ADD CONSTRAINT "app_pages_path_key" UNIQUE ("path");


--
-- Name: app_pages app_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_pages"
    ADD CONSTRAINT "app_pages_pkey" PRIMARY KEY ("key");


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: crm_dashboard_metrics crm_dashboard_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_metrics"
    ADD CONSTRAINT "crm_dashboard_metrics_pkey" PRIMARY KEY ("snapshot_id", "view_key", "stage_key");


--
-- Name: crm_dashboard_snapshots crm_dashboard_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_snapshots"
    ADD CONSTRAINT "crm_dashboard_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: crm_dashboard_snapshots crm_dashboard_snapshots_snapshot_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_snapshots"
    ADD CONSTRAINT "crm_dashboard_snapshots_snapshot_key_key" UNIQUE ("snapshot_key");


--
-- Name: crm_dashboard_top_developments crm_dashboard_top_developments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_top_developments"
    ADD CONSTRAINT "crm_dashboard_top_developments_pkey" PRIMARY KEY ("snapshot_id", "view_key", "rank");


--
-- Name: crm_dashboard_top_developments crm_dashboard_top_developments_snapshot_id_view_key_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_top_developments"
    ADD CONSTRAINT "crm_dashboard_top_developments_snapshot_id_view_key_name_key" UNIQUE ("snapshot_id", "view_key", "name");


--
-- Name: crm_dashboard_views crm_dashboard_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_views"
    ADD CONSTRAINT "crm_dashboard_views_pkey" PRIMARY KEY ("snapshot_id", "view_key");


--
-- Name: crm_funnel_goals crm_funnel_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_funnel_goals"
    ADD CONSTRAINT "crm_funnel_goals_pkey" PRIMARY KEY ("id");


--
-- Name: crm_funnel_goals crm_funnel_goals_profile_key_effective_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_funnel_goals"
    ADD CONSTRAINT "crm_funnel_goals_profile_key_effective_month_key" UNIQUE ("profile_key", "effective_month");


--
-- Name: crm_imob_ranking_developments crm_imob_ranking_developments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_imob_ranking_developments"
    ADD CONSTRAINT "crm_imob_ranking_developments_pkey" PRIMARY KEY ("run_id", "period_month", "business_unit", "development_key");


--
-- Name: crm_imob_ranking_entries crm_imob_ranking_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_imob_ranking_entries"
    ADD CONSTRAINT "crm_imob_ranking_entries_pkey" PRIMARY KEY ("run_id", "period_month", "imob_key");


--
-- Name: crm_imob_ranking_runs crm_imob_ranking_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_imob_ranking_runs"
    ADD CONSTRAINT "crm_imob_ranking_runs_pkey" PRIMARY KEY ("id");


--
-- Name: crm_ingestion_runs crm_ingestion_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ingestion_runs"
    ADD CONSTRAINT "crm_ingestion_runs_pkey" PRIMARY KEY ("id");


--
-- Name: crm_ingestion_runs crm_ingestion_runs_request_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ingestion_runs"
    ADD CONSTRAINT "crm_ingestion_runs_request_key_key" UNIQUE ("request_key");


--
-- Name: crm_point_metrics crm_point_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_point_metrics"
    ADD CONSTRAINT "crm_point_metrics_pkey" PRIMARY KEY ("setting_key", "metric_key");


--
-- Name: crm_point_settings crm_point_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_point_settings"
    ADD CONSTRAINT "crm_point_settings_pkey" PRIMARY KEY ("setting_key");


--
-- Name: crm_ranking_participants crm_ranking_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ranking_participants"
    ADD CONSTRAINT "crm_ranking_participants_pkey" PRIMARY KEY ("snapshot_id", "period_key", "broker_key");


--
-- Name: crm_ranking_snapshots crm_ranking_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ranking_snapshots"
    ADD CONSTRAINT "crm_ranking_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: crm_ranking_snapshots crm_ranking_snapshots_snapshot_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ranking_snapshots"
    ADD CONSTRAINT "crm_ranking_snapshots_snapshot_key_key" UNIQUE ("snapshot_key");


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("key");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_key", "permission_key");


--
-- Name: roles roles_level_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_level_unique" UNIQUE ("level");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("key");


--
-- Name: user_permission_overrides user_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id", "permission_key");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");


--
-- Name: app_pages_navigation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "app_pages_navigation_idx" ON "public"."app_pages" USING "btree" ("section", "sort_order", "key") WHERE ("is_navigation" AND "is_active");


--
-- Name: audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_actor_idx" ON "public"."audit_logs" USING "btree" ("actor_id", "created_at" DESC);


--
-- Name: audit_logs_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_target_idx" ON "public"."audit_logs" USING "btree" ("target_user_id", "created_at" DESC);


--
-- Name: crm_funnel_goals_profile_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_funnel_goals_profile_month_idx" ON "public"."crm_funnel_goals" USING "btree" ("profile_key", "effective_month" DESC);


--
-- Name: crm_imob_ranking_developments_month_contracts_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_imob_ranking_developments_month_contracts_idx" ON "public"."crm_imob_ranking_developments" USING "btree" ("run_id", "period_month", "business_unit", "contracts" DESC);


--
-- Name: crm_imob_ranking_developments_month_vgv_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_imob_ranking_developments_month_vgv_idx" ON "public"."crm_imob_ranking_developments" USING "btree" ("run_id", "period_month", "business_unit", "vgv" DESC);


--
-- Name: crm_imob_ranking_entries_month_contracts_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_imob_ranking_entries_month_contracts_idx" ON "public"."crm_imob_ranking_entries" USING "btree" ("run_id", "period_month", "contracts" DESC);


--
-- Name: crm_imob_ranking_entries_month_vgv_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_imob_ranking_entries_month_vgv_idx" ON "public"."crm_imob_ranking_entries" USING "btree" ("run_id", "period_month", "vgv" DESC);


--
-- Name: crm_imob_ranking_runs_completed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_imob_ranking_runs_completed_idx" ON "public"."crm_imob_ranking_runs" USING "btree" ("generated_at" DESC) WHERE ("status" = 'succeeded'::"text");


--
-- Name: crm_ingestion_runs_active_refresh_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_ingestion_runs_active_refresh_idx" ON "public"."crm_ingestion_runs" USING "btree" ("started_at" DESC) WHERE (("kind" = 'salesforce_refresh'::"text") AND ("status" = 'running'::"text"));


--
-- Name: crm_ingestion_runs_kind_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_ingestion_runs_kind_created_idx" ON "public"."crm_ingestion_runs" USING "btree" ("kind", "created_at" DESC);


--
-- Name: crm_ranking_participants_period_manager_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "crm_ranking_participants_period_manager_idx" ON "public"."crm_ranking_participants" USING "btree" ("snapshot_id", "period_key", "manager_name", "broker_name");


--
-- Name: app_pages app_pages_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "app_pages_set_updated_at" BEFORE UPDATE ON "public"."app_pages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: crm_dashboard_snapshots crm_dashboard_snapshots_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "crm_dashboard_snapshots_set_updated_at" BEFORE UPDATE ON "public"."crm_dashboard_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: crm_funnel_goals crm_funnel_goals_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "crm_funnel_goals_set_updated_at" BEFORE UPDATE ON "public"."crm_funnel_goals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: crm_ingestion_runs crm_ingestion_runs_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "crm_ingestion_runs_set_updated_at" BEFORE UPDATE ON "public"."crm_ingestion_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: crm_point_settings crm_point_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "crm_point_settings_set_updated_at" BEFORE UPDATE ON "public"."crm_point_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: crm_ranking_snapshots crm_ranking_snapshots_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "crm_ranking_snapshots_set_updated_at" BEFORE UPDATE ON "public"."crm_ranking_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: user_roles user_roles_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "user_roles_set_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: app_pages app_pages_parent_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_pages"
    ADD CONSTRAINT "app_pages_parent_key_fkey" FOREIGN KEY ("parent_key") REFERENCES "public"."app_pages"("key") ON DELETE RESTRICT;


--
-- Name: app_pages app_pages_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."app_pages"
    ADD CONSTRAINT "app_pages_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key");


--
-- Name: crm_dashboard_metrics crm_dashboard_metrics_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_metrics"
    ADD CONSTRAINT "crm_dashboard_metrics_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."crm_dashboard_snapshots"("id") ON DELETE CASCADE;


--
-- Name: crm_dashboard_top_developments crm_dashboard_top_developments_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_top_developments"
    ADD CONSTRAINT "crm_dashboard_top_developments_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."crm_dashboard_snapshots"("id") ON DELETE CASCADE;


--
-- Name: crm_dashboard_views crm_dashboard_views_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_dashboard_views"
    ADD CONSTRAINT "crm_dashboard_views_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."crm_dashboard_snapshots"("id") ON DELETE CASCADE;


--
-- Name: crm_funnel_goals crm_funnel_goals_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_funnel_goals"
    ADD CONSTRAINT "crm_funnel_goals_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: crm_imob_ranking_developments crm_imob_ranking_developments_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_imob_ranking_developments"
    ADD CONSTRAINT "crm_imob_ranking_developments_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."crm_imob_ranking_runs"("id") ON DELETE CASCADE;


--
-- Name: crm_imob_ranking_entries crm_imob_ranking_entries_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_imob_ranking_entries"
    ADD CONSTRAINT "crm_imob_ranking_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."crm_imob_ranking_runs"("id") ON DELETE CASCADE;


--
-- Name: crm_ingestion_runs crm_ingestion_runs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ingestion_runs"
    ADD CONSTRAINT "crm_ingestion_runs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: crm_point_metrics crm_point_metrics_setting_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_point_metrics"
    ADD CONSTRAINT "crm_point_metrics_setting_key_fkey" FOREIGN KEY ("setting_key") REFERENCES "public"."crm_point_settings"("setting_key") ON DELETE CASCADE;


--
-- Name: crm_point_settings crm_point_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_point_settings"
    ADD CONSTRAINT "crm_point_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: crm_ranking_participants crm_ranking_participants_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_ranking_participants"
    ADD CONSTRAINT "crm_ranking_participants_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."crm_ranking_snapshots"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_key_fkey" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE CASCADE;


--
-- Name: user_permission_overrides user_permission_overrides_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");


--
-- Name: user_permission_overrides user_permission_overrides_permission_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE CASCADE;


--
-- Name: user_permission_overrides user_permission_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");


--
-- Name: user_roles user_roles_role_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_key_fkey" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key");


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: app_pages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."app_pages" ENABLE ROW LEVEL SECURITY;

--
-- Name: app_pages app_pages_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "app_pages_select_authorized" ON "public"."app_pages" FOR SELECT TO "authenticated" USING (("is_active" AND "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'pages.view'::"text") AND "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), "permission_key")));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_select_with_audit_view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "audit_logs_select_with_audit_view" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'audit.view'::"text"));


--
-- Name: crm_dashboard_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_dashboard_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_dashboard_metrics crm_dashboard_metrics_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_dashboard_metrics_select_authorized" ON "public"."crm_dashboard_metrics" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.dashboard.view'::"text") AS "has_permission"));


--
-- Name: crm_dashboard_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_dashboard_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_dashboard_snapshots crm_dashboard_snapshots_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_dashboard_snapshots_select_authorized" ON "public"."crm_dashboard_snapshots" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.dashboard.view'::"text") AS "has_permission"));


--
-- Name: crm_dashboard_top_developments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_dashboard_top_developments" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_dashboard_top_developments crm_dashboard_top_developments_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_dashboard_top_developments_select_authorized" ON "public"."crm_dashboard_top_developments" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.dashboard.view'::"text") AS "has_permission"));


--
-- Name: crm_dashboard_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_dashboard_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_dashboard_views crm_dashboard_views_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_dashboard_views_select_authorized" ON "public"."crm_dashboard_views" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.dashboard.view'::"text") AS "has_permission"));


--
-- Name: crm_funnel_goals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_funnel_goals" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_funnel_goals crm_funnel_goals_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_funnel_goals_select_authorized" ON "public"."crm_funnel_goals" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.settings.manage'::"text") AS "has_permission"));


--
-- Name: crm_imob_ranking_developments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_imob_ranking_developments" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_imob_ranking_developments crm_imob_ranking_developments_select_completed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_imob_ranking_developments_select_completed" ON "public"."crm_imob_ranking_developments" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_imob_ranking_runs" "runs"
  WHERE (("runs"."id" = "crm_imob_ranking_developments"."run_id") AND ("runs"."status" = 'succeeded'::"text")))));


--
-- Name: crm_imob_ranking_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_imob_ranking_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_imob_ranking_entries crm_imob_ranking_entries_select_completed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_imob_ranking_entries_select_completed" ON "public"."crm_imob_ranking_entries" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."crm_imob_ranking_runs" "runs"
  WHERE (("runs"."id" = "crm_imob_ranking_entries"."run_id") AND ("runs"."status" = 'succeeded'::"text")))));


--
-- Name: crm_imob_ranking_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_imob_ranking_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_imob_ranking_runs crm_imob_ranking_runs_select_completed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_imob_ranking_runs_select_completed" ON "public"."crm_imob_ranking_runs" FOR SELECT TO "authenticated", "anon" USING (("status" = 'succeeded'::"text"));


--
-- Name: crm_ingestion_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_ingestion_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_point_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_point_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_point_metrics crm_point_metrics_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_point_metrics_select_authorized" ON "public"."crm_point_metrics" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.ranking.view'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.settings.manage'::"text") AS "has_permission")));


--
-- Name: crm_point_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_point_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_point_settings crm_point_settings_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_point_settings_select_authorized" ON "public"."crm_point_settings" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.ranking.view'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.settings.manage'::"text") AS "has_permission")));


--
-- Name: crm_ranking_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_ranking_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_ranking_participants crm_ranking_participants_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_ranking_participants_select_authorized" ON "public"."crm_ranking_participants" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.ranking.view'::"text") AS "has_permission"));


--
-- Name: crm_ranking_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_ranking_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_ranking_snapshots crm_ranking_snapshots_select_authorized; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_ranking_snapshots_select_authorized" ON "public"."crm_ranking_snapshots" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.ranking.view'::"text") AS "has_permission"));


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permissions_select_authenticated" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_self_or_users_view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "profiles_select_self_or_users_view" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'users.view'::"text")));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role_permissions_select_authenticated" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);


--
-- Name: user_permission_overrides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_permission_overrides" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permission_overrides user_permission_overrides_select_self_or_permissions_view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_permission_overrides_select_self_or_permissions_view" ON "public"."user_permission_overrides" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'permissions.view'::"text")));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_select_self_or_users_view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_select_self_or_users_view" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."has_permission"(( SELECT "auth"."uid"() AS "uid"), 'users.view'::"text")));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

-- CREATE PUBLICATION "supabase_realtime" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "dashboard_user";


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."crypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."dearmor"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_uuid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text", integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "dashboard_user";


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v4"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_nil"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_dns"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_oid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_url"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_x500"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "dashboard_user";


--
-- Name: FUNCTION "ingest_crm_salesforce_snapshot_v1_internal"("p_payload" "jsonb"); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."ingest_crm_salesforce_snapshot_v1_internal"("p_payload" "jsonb") FROM PUBLIC;


--
-- Name: FUNCTION "_internal_assert_actor_active"("actor_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."_internal_assert_actor_active"("actor_uuid" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "_internal_get_role_level"("user_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."_internal_get_role_level"("user_uuid" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "_internal_has_permission"("user_uuid" "uuid", "permission_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."_internal_has_permission"("user_uuid" "uuid", "permission_key" "text") FROM PUBLIC;


--
-- Name: FUNCTION "_internal_list_permissions"("user_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."_internal_list_permissions"("user_uuid" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "assign_user_role"("target_user_id" "uuid", "target_role_key" "text", "reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."assign_user_role"("target_user_id" "uuid", "target_role_key" "text", "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_user_role"("target_user_id" "uuid", "target_role_key" "text", "reason" "text") TO "authenticated";


--
-- Name: FUNCTION "begin_crm_salesforce_refresh"("p_request_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."begin_crm_salesforce_refresh"("p_request_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_crm_salesforce_refresh"("p_request_key" "text") TO "authenticated";


--
-- Name: FUNCTION "bootstrap_master_user"("master_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."bootstrap_master_user"("master_user_id" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "can_assign_role"("actor_uuid" "uuid", "target_role_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."can_assign_role"("actor_uuid" "uuid", "target_role_key" "text") FROM PUBLIC;


--
-- Name: FUNCTION "can_grant_permission"("actor_uuid" "uuid", "permission_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."can_grant_permission"("actor_uuid" "uuid", "permission_key" "text") FROM PUBLIC;


--
-- Name: FUNCTION "finish_crm_salesforce_refresh"("p_run_id" "uuid", "p_status" "text", "p_http_status" integer, "p_error_code" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."finish_crm_salesforce_refresh"("p_run_id" "uuid", "p_status" "text", "p_http_status" integer, "p_error_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_crm_salesforce_refresh"("p_run_id" "uuid", "p_status" "text", "p_http_status" integer, "p_error_code" "text") TO "authenticated";


--
-- Name: FUNCTION "get_crm_sync_status"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_crm_sync_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_crm_sync_status"() TO "authenticated";


--
-- Name: FUNCTION "get_role_level"("user_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_role_level"("user_uuid" "uuid") FROM PUBLIC;


--
-- Name: FUNCTION "get_user_authorization_context"("user_uuid" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_user_authorization_context"("user_uuid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_authorization_context"("user_uuid" "uuid") TO "authenticated";


--
-- Name: FUNCTION "handle_new_auth_user"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;


--
-- Name: FUNCTION "has_permission"("user_uuid" "uuid", "permission_key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."has_permission"("user_uuid" "uuid", "permission_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_permission"("user_uuid" "uuid", "permission_key" "text") TO "authenticated";


--
-- Name: FUNCTION "ingest_crm_salesforce_snapshot"("p_payload" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."ingest_crm_salesforce_snapshot"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingest_crm_salesforce_snapshot"("p_payload" "jsonb") TO "service_role";


--
-- Name: TABLE "app_pages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."app_pages" TO "authenticated";


--
-- Name: FUNCTION "list_app_pages_for_management"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."list_app_pages_for_management"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_app_pages_for_management"() TO "authenticated";


--
-- Name: FUNCTION "publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."publish_crm_imob_ranking"("payload" "jsonb", "sync_token" "text") TO "service_role";


--
-- Name: FUNCTION "remove_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."remove_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "reason" "text") TO "authenticated";


--
-- Name: FUNCTION "replace_crm_point_settings"("p_weights" "jsonb", "p_targets" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."replace_crm_point_settings"("p_weights" "jsonb", "p_targets" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_crm_point_settings"("p_weights" "jsonb", "p_targets" "jsonb") TO "authenticated";


--
-- Name: FUNCTION "rls_auto_enable"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;


--
-- Name: FUNCTION "set_app_page_active"("target_page_key" "text", "target_is_active" boolean, "reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_app_page_active"("target_page_key" "text", "target_is_active" boolean, "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_app_page_active"("target_page_key" "text", "target_is_active" boolean, "reason" "text") TO "authenticated";


--
-- Name: FUNCTION "set_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";


--
-- Name: FUNCTION "set_user_active"("target_user_id" "uuid", "target_is_active" boolean, "reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_user_active"("target_user_id" "uuid", "target_is_active" boolean, "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_active"("target_user_id" "uuid", "target_is_active" boolean, "reason" "text") TO "authenticated";


--
-- Name: FUNCTION "set_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "effect" "text", "reason" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "effect" "text", "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_user_permission_override"("target_user_id" "uuid", "permission_key" "text", "effect" "text", "reason" "text") TO "authenticated";


--
-- Name: TABLE "crm_funnel_goals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_funnel_goals" TO "authenticated";


--
-- Name: FUNCTION "upsert_crm_funnel_goals"("p_profile_key" "text", "p_effective_month" "date", "p_sales" bigint, "p_opportunities_rate" numeric, "p_appointments_rate" numeric, "p_visits_rate" numeric, "p_folders_rate" numeric, "p_approved_folders_rate" numeric, "p_broker_minimum_month_1" integer, "p_broker_minimum_month_2" integer, "p_broker_minimum_month_3" integer, "p_broker_minimum_month_4_plus" integer, "p_broker_weekly_appointments" integer, "p_broker_weekly_visits" integer, "p_broker_weekly_folders" integer, "p_productive_team_appointments" smallint, "p_productive_team_visits" smallint, "p_productive_team_folders" smallint, "p_productive_team_sales" smallint); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."upsert_crm_funnel_goals"("p_profile_key" "text", "p_effective_month" "date", "p_sales" bigint, "p_opportunities_rate" numeric, "p_appointments_rate" numeric, "p_visits_rate" numeric, "p_folders_rate" numeric, "p_approved_folders_rate" numeric, "p_broker_minimum_month_1" integer, "p_broker_minimum_month_2" integer, "p_broker_minimum_month_3" integer, "p_broker_minimum_month_4_plus" integer, "p_broker_weekly_appointments" integer, "p_broker_weekly_visits" integer, "p_broker_weekly_folders" integer, "p_productive_team_appointments" smallint, "p_productive_team_visits" smallint, "p_productive_team_folders" smallint, "p_productive_team_sales" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_crm_funnel_goals"("p_profile_key" "text", "p_effective_month" "date", "p_sales" bigint, "p_opportunities_rate" numeric, "p_appointments_rate" numeric, "p_visits_rate" numeric, "p_folders_rate" numeric, "p_approved_folders_rate" numeric, "p_broker_minimum_month_1" integer, "p_broker_minimum_month_2" integer, "p_broker_minimum_month_3" integer, "p_broker_minimum_month_4_plus" integer, "p_broker_weekly_appointments" integer, "p_broker_weekly_visits" integer, "p_broker_weekly_folders" integer, "p_productive_team_appointments" smallint, "p_productive_team_visits" smallint, "p_productive_team_folders" smallint, "p_productive_team_sales" smallint) TO "authenticated";


--
-- Name: FUNCTION "_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "service_role";


--
-- Name: FUNCTION "create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: TABLE "pg_stat_statements"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "dashboard_user";


--
-- Name: TABLE "pg_stat_statements_info"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements_info" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "dashboard_user";


--
-- Name: TABLE "audit_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."audit_logs" TO "authenticated";


--
-- Name: TABLE "crm_dashboard_metrics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_dashboard_metrics" TO "authenticated";


--
-- Name: TABLE "crm_dashboard_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_dashboard_snapshots" TO "authenticated";


--
-- Name: TABLE "crm_dashboard_top_developments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_dashboard_top_developments" TO "authenticated";


--
-- Name: TABLE "crm_dashboard_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_dashboard_views" TO "authenticated";


--
-- Name: TABLE "crm_imob_ranking_developments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_imob_ranking_developments" TO "anon";
GRANT SELECT ON TABLE "public"."crm_imob_ranking_developments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."crm_imob_ranking_developments" TO "service_role";


--
-- Name: TABLE "crm_imob_ranking_entries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_imob_ranking_entries" TO "anon";
GRANT SELECT ON TABLE "public"."crm_imob_ranking_entries" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."crm_imob_ranking_entries" TO "service_role";


--
-- Name: TABLE "crm_imob_ranking_runs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_imob_ranking_runs" TO "anon";
GRANT SELECT ON TABLE "public"."crm_imob_ranking_runs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."crm_imob_ranking_runs" TO "service_role";


--
-- Name: TABLE "crm_point_metrics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_point_metrics" TO "authenticated";


--
-- Name: TABLE "crm_point_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_point_settings" TO "authenticated";


--
-- Name: TABLE "crm_ranking_participants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_ranking_participants" TO "authenticated";


--
-- Name: TABLE "crm_ranking_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."crm_ranking_snapshots" TO "authenticated";


--
-- Name: TABLE "user_permission_overrides"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."user_permission_overrides" TO "authenticated";


--
-- Name: TABLE "user_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";


--
-- Name: TABLE "secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."secrets" TO "service_role";


--
-- Name: TABLE "decrypted_secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."decrypted_secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."decrypted_secrets" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: ensure_rls; Type: EVENT TRIGGER; Schema: -; Owner: postgres
--

-- CREATE EVENT TRIGGER "ensure_rls" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
--    EXECUTE FUNCTION "public"."rls_auto_enable"();


-- ALTER EVENT TRIGGER "ensure_rls" OWNER TO "postgres";

--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_graphql_placeholder" ON "sql_drop"
--          WHEN TAG IN ('DROP EXTENSION')
--    EXECUTE FUNCTION "extensions"."set_graphql_placeholder"();


-- ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_cron_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_cron_access"();


-- ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_graphql_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_graphql_access"();


-- ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_net_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_net_access"();


-- ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_ddl_watch" ON "ddl_command_end"
--    EXECUTE FUNCTION "extensions"."pgrst_ddl_watch"();


-- ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_drop_watch" ON "sql_drop"
--    EXECUTE FUNCTION "extensions"."pgrst_drop_watch"();


-- ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

--
-- PostgreSQL database dump complete
--

-- \unrestrict c1fJeb6nKuUXmMhVF6cWl1DByEDRHGAPv2qiuVdT2ke6cfg2Tee5kOYseH9VIpa
