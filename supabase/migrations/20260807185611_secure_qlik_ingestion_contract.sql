-- Repair the Qlik Data API drift without exposing the underlying tables.
--
-- PostgreSQL logs proved that the post-reconciliation GRANT/ALTER POLICY
-- statements came from an interactive Supabase MCP session. The Qlik exporter
-- only returns a validated snapshot and the n8n workflow previously wrote
-- directly to tables in another Supabase project. This RPC is the narrow,
-- transactional replacement for that direct-write contract.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;

alter table public.crm_imob_ranking_runs enable row level security;
alter table public.crm_imob_ranking_entries enable row level security;

revoke all privileges on table
  public.crm_imob_ranking_runs,
  public.crm_imob_ranking_entries
from public, anon, authenticated, service_role;

alter policy crm_imob_ranking_runs_select_completed
  on public.crm_imob_ranking_runs
  to authenticated
  using (status = 'succeeded');

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

create or replace function public.ingest_crm_imob_ranking_snapshot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_entries jsonb := p_payload->'entries';
  v_run_id uuid;
  v_reference_year smallint;
  v_generated_at timestamptz;
  v_source_updated_at timestamptz;
  v_entry_count integer;
  v_existing public.crm_imob_ranking_runs%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->>'schemaVersion' <> '1'
     or jsonb_typeof(v_entries) is distinct from 'array'
     or jsonb_array_length(v_entries) < 1
     or jsonb_array_length(v_entries) > 5000 then
    raise exception 'invalid Qlik ingestion envelope' using errcode = '22023';
  end if;

  begin
    v_run_id := (p_payload->>'requestId')::uuid;
    v_reference_year := (p_payload->>'referenceYear')::smallint;
    v_generated_at := (p_payload->>'generatedAt')::timestamptz;
    v_source_updated_at := coalesce(
      (p_payload->>'sourceUpdatedAt')::timestamptz,
      v_generated_at
    );
  exception when others then
    raise exception 'invalid Qlik ingestion metadata' using errcode = '22023';
  end;

  if v_run_id is null
     or v_reference_year is null
     or v_generated_at is null
     or v_source_updated_at is null
     or v_reference_year not between 2020 and 2100
     or v_generated_at > now() + interval '5 minutes'
     or v_source_updated_at > now() + interval '5 minutes' then
    raise exception 'invalid Qlik ingestion metadata' using errcode = '22023';
  end if;

  begin
    if exists (
      select 1
      from jsonb_to_recordset(v_entries) as entry(
        "periodMonth" date,
        "imobKey" text,
        "imobName" text,
        vgv numeric,
        contracts integer,
        "sourceRankVgv" integer,
        "sourceRankContracts" integer
      )
      where entry."periodMonth" is null
         or extract(year from entry."periodMonth")::smallint <> v_reference_year
         or entry."periodMonth" <> date_trunc(
           'month',
           entry."periodMonth"::timestamp without time zone
         )::date
         or entry."imobKey" !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
         or btrim(coalesce(entry."imobName", '')) = ''
         or entry.vgv is null
         or entry.vgv < 0
         or entry.contracts is null
         or entry.contracts < 0
         or (entry."sourceRankVgv" is not null and entry."sourceRankVgv" < 1)
         or (
           entry."sourceRankContracts" is not null
           and entry."sourceRankContracts" < 1
         )
    ) then
      raise exception 'invalid Qlik ranking entry' using errcode = '22023';
    end if;
  exception
    when sqlstate '22023' then
      raise;
    when others then
      raise exception 'invalid Qlik ranking entry' using errcode = '22023';
  end;

  v_entry_count := jsonb_array_length(v_entries);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_run_id::text, 20260807)
  );

  select * into v_existing
  from public.crm_imob_ranking_runs
  where id = v_run_id;

  if found then
    if v_existing.status = 'succeeded'
       and v_existing.reference_year = v_reference_year
       and v_existing.generated_at = v_generated_at
       and v_existing.source_updated_at is not distinct from v_source_updated_at
       and v_existing.source = 'qlik'
       and v_existing.regional = 'SP CAPITAL'
       and v_existing.company = 'Direcional'
       and v_existing.row_count = v_entry_count
       and not exists (
         (
           select
             stored.period_month,
             stored.imob_key,
             stored.imob_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_entries stored
           where stored.run_id = v_run_id
           except
           select
             incoming."periodMonth",
             incoming."imobKey",
             incoming."imobName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_entries) as incoming(
             "periodMonth" date,
             "imobKey" text,
             "imobName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
         )
         union all
         (
           select
             incoming."periodMonth",
             incoming."imobKey",
             incoming."imobName",
             incoming.vgv,
             incoming.contracts,
             incoming."sourceRankVgv",
             incoming."sourceRankContracts"
           from jsonb_to_recordset(v_entries) as incoming(
             "periodMonth" date,
             "imobKey" text,
             "imobName" text,
             vgv numeric,
             contracts integer,
             "sourceRankVgv" integer,
             "sourceRankContracts" integer
           )
           except
           select
             stored.period_month,
             stored.imob_key,
             stored.imob_name,
             stored.vgv,
             stored.contracts,
             stored.source_rank_vgv,
             stored.source_rank_contracts
           from public.crm_imob_ranking_entries stored
           where stored.run_id = v_run_id
         )
       ) then
      return jsonb_build_object(
        'ok', true,
        'status', 'succeeded',
        'runId', v_run_id,
        'recordCount', v_entry_count,
        'idempotent', true
      );
    end if;

    raise exception 'Qlik request ID conflict' using errcode = '23505';
  end if;

  insert into public.crm_imob_ranking_runs (
    id,
    status,
    reference_year,
    generated_at,
    source_updated_at,
    source,
    regional,
    company,
    row_count,
    started_at
  ) values (
    v_run_id,
    'running',
    v_reference_year,
    v_generated_at,
    v_source_updated_at,
    'qlik',
    'SP CAPITAL',
    'Direcional',
    v_entry_count,
    now()
  );

  insert into public.crm_imob_ranking_entries (
    run_id,
    period_month,
    imob_key,
    imob_name,
    vgv,
    contracts,
    source_rank_vgv,
    source_rank_contracts
  )
  select
    v_run_id,
    entry."periodMonth",
    entry."imobKey",
    entry."imobName",
    entry.vgv,
    entry.contracts,
    entry."sourceRankVgv",
    entry."sourceRankContracts"
  from jsonb_to_recordset(v_entries) as entry(
    "periodMonth" date,
    "imobKey" text,
    "imobName" text,
    vgv numeric,
    contracts integer,
    "sourceRankVgv" integer,
    "sourceRankContracts" integer
  );

  update public.crm_imob_ranking_runs
  set status = 'succeeded', completed_at = now()
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'succeeded',
    'runId', v_run_id,
    'recordCount', v_entry_count,
    'idempotent', false
  );
end;
$$;

comment on function public.ingest_crm_imob_ranking_snapshot(jsonb) is
  'Atomically stores one validated Qlik ranking snapshot for the n8n service-role caller.';

revoke all privileges on function public.ingest_crm_imob_ranking_snapshot(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_crm_imob_ranking_snapshot(jsonb)
  to service_role;
