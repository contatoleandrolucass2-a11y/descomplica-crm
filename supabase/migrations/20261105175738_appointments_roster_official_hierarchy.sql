-- Additive hierarchy for Agendamentos. Existing consumers retain manager_name.
alter table public.crm_ingestion_runs
  add column roster_payload_sha256 text
  check (roster_payload_sha256 is null or roster_payload_sha256 ~ '^[0-9a-f]{64}$');

alter table public.crm_ranking_participants
  add column roster_manager_name text,
  add column regional_manager_name text,
  add constraint crm_ranking_roster_manager_label check (
    roster_manager_name is null or
    (roster_manager_name = btrim(roster_manager_name) and length(roster_manager_name) between 1 and 200)),
  add constraint crm_ranking_regional_manager_label check (
    regional_manager_name is null or
    (regional_manager_name = btrim(regional_manager_name) and length(regional_manager_name) between 1 and 200)),
  add constraint crm_ranking_regional_requires_roster_manager check (
    regional_manager_name is null or roster_manager_name is not null);

-- Preserve the existing implementation, including its locking and replay logic.
alter function public.ingest_crm_salesforce_snapshot(jsonb)
  rename to ingest_crm_salesforce_snapshot_roster_base;
alter function public.ingest_crm_salesforce_snapshot_roster_base(jsonb) set schema private;
revoke all on function private.ingest_crm_salesforce_snapshot_roster_base(jsonb)
  from public, anon, authenticated, service_role;

create function public.ingest_crm_salesforce_snapshot(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
set statement_timeout = '30s' as $$
declare
  v_ranking jsonb := p_payload->'ranking';
  v_participant jsonb;
  v_field text;
  v_result jsonb;
  v_snapshot_id bigint;
  v_updated integer;
  v_enriched boolean := false;
  v_payload_sha256 text;
  v_existing_sha256 text;
begin
  if jsonb_typeof(v_ranking) = 'object' and
     jsonb_typeof(v_ranking->'participants') = 'array' then
    for v_participant in select value from jsonb_array_elements(v_ranking->'participants') loop
      v_enriched := v_enriched or (v_participant ? 'rosterManagerName')
        or (v_participant ? 'regionalManagerName');
      foreach v_field in array array['rosterManagerName', 'regionalManagerName'] loop
        if v_participant ? v_field and v_participant->v_field <> 'null'::jsonb then
          if jsonb_typeof(v_participant->v_field) <> 'string'
             or length(btrim(v_participant->>v_field)) not between 1 and 200 then
            raise exception 'invalid participant hierarchy label' using errcode = '22023';
          end if;
        end if;
      end loop;
      if v_participant->>'regionalManagerName' is not null
         and v_participant->>'rosterManagerName' is null then
        raise exception 'regional manager requires roster manager' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Legacy requests keep their established request-ID-only replay contract.
  -- Enriched requests bind the ID to the full original JSONB, before any base
  -- wrapper removes analysis/availability fields. Share the existing lock.
  if v_enriched then
    perform pg_catalog.pg_advisory_xact_lock(2026080403);
    v_payload_sha256 := pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex');
    select roster_payload_sha256 into v_existing_sha256
      from public.crm_ingestion_runs
      where request_key = 'ingest:' || (p_payload->>'requestId');
    if found and v_existing_sha256 is distinct from v_payload_sha256 then
      raise exception 'enriched ingestion replay payload mismatch' using errcode = '22023';
    end if;
  end if;

  v_result := private.ingest_crm_salesforce_snapshot_roster_base(p_payload);
  if coalesce((v_result->>'ok')::boolean, false)
     and not coalesce((v_result->>'idempotent')::boolean, false)
     and jsonb_typeof(v_ranking) = 'object' then
    select id into v_snapshot_id from public.crm_ranking_snapshots
      where snapshot_key = v_ranking->>'snapshotKey'
        and reference_date = (v_ranking->>'referenceDate')::date
        and generated_at = (v_ranking->>'generatedAt')::timestamptz;
    if not found then
      raise exception 'ranking hierarchy snapshot mismatch' using errcode = '22023';
    end if;
    update public.crm_ranking_participants p set
      roster_manager_name = nullif(btrim(x."rosterManagerName"), ''),
      regional_manager_name = nullif(btrim(x."regionalManagerName"), '')
    from jsonb_to_recordset(v_ranking->'participants') as x(
      "periodKey" text, "brokerKey" text, "rosterManagerName" text, "regionalManagerName" text)
    where p.snapshot_id = v_snapshot_id
      and p.period_key = x."periodKey" and p.broker_key = x."brokerKey";
    get diagnostics v_updated = row_count;
    if v_updated <> jsonb_array_length(v_ranking->'participants') then
      raise exception 'ranking hierarchy participant mismatch' using errcode = '22023';
    end if;
    if v_enriched then
      update public.crm_ingestion_runs set roster_payload_sha256 = v_payload_sha256
        where request_key = 'ingest:' || (p_payload->>'requestId') and status = 'succeeded';
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'ranking hierarchy ingestion run mismatch' using errcode = '22023';
      end if;
    end if;
  end if;
  return v_result;
end;
$$;
alter function public.ingest_crm_salesforce_snapshot(jsonb) owner to postgres;
revoke all on function public.ingest_crm_salesforce_snapshot(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_crm_salesforce_snapshot(jsonb) to service_role;

-- Rollback: restore the preserved base as the public entry point after stopping
-- the new producer/reader. Keep nullable columns; do not drop saved hierarchy.
notify pgrst, 'reload schema';
