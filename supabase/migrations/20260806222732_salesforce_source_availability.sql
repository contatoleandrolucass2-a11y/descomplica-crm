-- Salesforce source availability
--
-- Goals and roulette currently have no authorized source. Numeric zeros remain
-- only as constrained storage values; these flags let readers distinguish that
-- state from an actual commercial result equal to zero. Existing rows fail
-- closed as unavailable. The ingestion contract moves to schema version 2.

alter table public.crm_dashboard_snapshots
  add column goals_available boolean not null default false;

alter table public.crm_ranking_snapshots
  add column roulette_available boolean not null default false;

comment on column public.crm_dashboard_snapshots.goals_available is
  'True only when all dashboard goals came from an authorized source.';
comment on column public.crm_ranking_snapshots.roulette_available is
  'True only when roulette counts came from an authorized source.';

-- Preserve the audited v1 implementation as a non-exposed internal primitive.
-- The public wrapper below performs the stricter v2 availability checks and
-- persists both flags in the same outer transaction.
create schema if not exists private authorization postgres;
revoke all on schema private from public;

alter function public.ingest_crm_salesforce_snapshot(jsonb)
  rename to ingest_crm_salesforce_snapshot_v1_internal;
alter function public.ingest_crm_salesforce_snapshot_v1_internal(jsonb)
  set schema private;

revoke all on function private.ingest_crm_salesforce_snapshot_v1_internal(jsonb)
  from public, anon, authenticated, service_role;

create function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.ingest_crm_salesforce_snapshot(jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_crm_salesforce_snapshot(jsonb)
  to service_role;
