-- Standalone Qlik v2. No legacy cutover, role, mapping or ingestion dependency.
set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
begin
  if to_regprocedure('auth.uid()') is null
     or to_regprocedure('private.current_session_satisfies_mfa()') is null
     or to_regprocedure('public.has_permission(uuid,text)') is null
     or to_regprocedure('pg_catalog.sha256(bytea)') is null then
    raise exception 'Qlik v2 prerequisites unavailable' using errcode = '55000';
  end if;
end;
$$;

create table private.crm_qlik_v2_observations (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  key_id text not null check (key_id = 'qlik-ranking-v2'),
  requested_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  request_id uuid,
  batch_id uuid,
  reference_year integer check (reference_year between 2020 and 2100),
  started_at timestamptz,
  completed_at timestamptz,
  source_reload_at timestamptz,
  payload jsonb,
  content_sha256 text check (content_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('staged', 'published', 'rejected')),
  reason text check (reason in ('invalid_payload', 'request_conflict', 'replay_conflict', 'batch_conflict', 'stale_source', 'rate_limited')),
  idempotent boolean not null default false,
  check (payload is null or (
    request_id is not null and batch_id is not null and reference_year is not null
    and started_at is not null and completed_at is not null and completed_at >= started_at
    and source_reload_at is not null and source_reload_at <= started_at and content_sha256 is not null
    and status in ('staged', 'published') and not idempotent
  ))
);
create index crm_qlik_v2_rate_idx on private.crm_qlik_v2_observations (received_at);
create unique index crm_qlik_v2_request_idx on private.crm_qlik_v2_observations (request_id)
  where payload is not null;
create index crm_qlik_v2_batch_idx on private.crm_qlik_v2_observations (batch_id)
  where payload is not null;

create table private.crm_qlik_v2_publications (
  batch_id uuid primary key,
  reference_year integer not null check (reference_year between 2020 and 2100),
  first_nonce text not null unique references private.crm_qlik_v2_observations(nonce_hash),
  second_nonce text not null unique references private.crm_qlik_v2_observations(nonce_hash),
  published_at timestamptz not null default clock_timestamp(),
  check (first_nonce <> second_nonce)
);
create index crm_qlik_v2_year_idx on private.crm_qlik_v2_publications
  (reference_year, published_at desc, batch_id);

alter table private.crm_qlik_v2_observations owner to postgres;
alter table private.crm_qlik_v2_publications owner to postgres;
alter table private.crm_qlik_v2_observations enable row level security;
alter table private.crm_qlik_v2_observations force row level security;
alter table private.crm_qlik_v2_publications enable row level security;
alter table private.crm_qlik_v2_publications force row level security;
revoke all on private.crm_qlik_v2_observations, private.crm_qlik_v2_publications
  from public, anon, authenticated, service_role;

create function private.crm_qlik_v2_keys(p_value jsonb, p_keys text[])
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_value) = 'object' then
    p_value ?& p_keys and (select count(*) from jsonb_object_keys(p_value)) = cardinality(p_keys)
  else false end;
$$;

create function private.crm_qlik_v2_timestamp(p_value text)
returns timestamptz language plpgsql immutable set search_path = '' set timezone = 'UTC' as $$
declare v_value timestamptz;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$' then
    return null;
  end if;
  v_value := p_value::timestamptz;
  if not isfinite(v_value) or to_char(v_value, 'YYYY-MM-DD"T"HH24:MI:SS') <> left(p_value, 19) then
    return null;
  end if;
  return v_value;
exception when data_exception then return null;
end;
$$;

-- Returns the exact JSONB content hashed by the writer, or NULL. Arrays must
-- be canonically ordered; money is canonical decimal text, never float.
create function private.crm_qlik_v2_content(p_payload jsonb, p_now timestamptz)
returns jsonb language plpgsql immutable set search_path = '' set timezone = 'UTC' as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_reload timestamptz;
  v_month jsonb;
  v_cube jsonb;
  v_row jsonb;
  v_kind text;
  v_period text;
  v_previous_period text := '';
  v_year text;
  v_previous_key text;
  v_key text;
  v_sum_vgv numeric;
  v_sum_contracts numeric;
  v_money_pattern constant text := '^(0|[1-9][0-9]{0,15})\.[0-9]{2}$';
  v_count_pattern constant text := '^(0|[1-9][0-9]{0,9})$';
  v_uuid_pattern constant text := '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';
begin
  if p_now is null or not isfinite(p_now) or p_payload is null
     or octet_length(convert_to(p_payload::text, 'UTF8')) > 4000000
     or not private.crm_qlik_v2_keys(p_payload, array['schemaVersion','batchId','requestId','startedAt','completedAt','source','scope','months']) then
    return null;
  end if;
  if jsonb_typeof(p_payload->'schemaVersion') <> 'number'
     or p_payload->>'schemaVersion' is distinct from '2'
     or jsonb_typeof(p_payload->'batchId') <> 'string'
     or jsonb_typeof(p_payload->'requestId') <> 'string'
     or (p_payload->>'batchId') !~* v_uuid_pattern
     or (p_payload->>'requestId') !~* v_uuid_pattern
     or jsonb_typeof(p_payload->'startedAt') <> 'string'
     or jsonb_typeof(p_payload->'completedAt') <> 'string'
     or not private.crm_qlik_v2_keys(p_payload->'source', array['appId','sheetId','mappingSha256','reloadTimestamp'])
     or p_payload->'scope' <> '{"businessUnit":"Direcional","regional":"SP CAPITAL","channel":"CANAL IMOB"}'::jsonb then
    return null;
  end if;
  if p_payload#>>'{source,appId}' is distinct from '7c000871-8b32-4c0f-bfd5-4b9d46946575'
     or p_payload#>>'{source,sheetId}' is distinct from '772db774-0bc2-42d8-ac11-3e4917bd0d37'
     or jsonb_typeof(p_payload#>'{source,mappingSha256}') <> 'string'
     or (p_payload#>>'{source,mappingSha256}') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload#>'{source,reloadTimestamp}') <> 'string' then
    return null;
  end if;
  v_start := private.crm_qlik_v2_timestamp(p_payload->>'startedAt');
  v_end := private.crm_qlik_v2_timestamp(p_payload->>'completedAt');
  v_reload := private.crm_qlik_v2_timestamp(p_payload#>>'{source,reloadTimestamp}');
  if v_start is null or v_end is null or v_reload is null
     or v_reload > v_start or v_start > v_end or v_end > p_now + interval '5 minutes' then return null; end if;
  if jsonb_typeof(p_payload->'months') is distinct from 'array' then return null; end if;
  if jsonb_array_length(p_payload->'months') not between 1 and 12 then return null; end if;

  for v_month in select value from jsonb_array_elements(p_payload->'months') loop
    if not private.crm_qlik_v2_keys(v_month, array['periodMonth','imobs','developments'])
       or jsonb_typeof(v_month->'periodMonth') <> 'string' then return null; end if;
    v_period := v_month->>'periodMonth';
    if v_period !~ '^(20[2-9][0-9]|2100)-(0[1-9]|1[0-2])-01$'
       or v_period collate "C" <= v_previous_period collate "C" then return null; end if;
    if v_year is not null and left(v_period, 4) <> v_year then return null; end if;
    v_year := left(v_period, 4);
    v_previous_period := v_period;
    foreach v_kind in array array['imobs','developments'] loop
      v_cube := v_month->v_kind;
      if not private.crm_qlik_v2_keys(v_cube, array['coverage','nativeTotals','rows'])
         or not private.crm_qlik_v2_keys(v_cube->'coverage', array['state','sourceRows'])
         or not private.crm_qlik_v2_keys(v_cube->'nativeTotals', array['vgv','contracts'])
         or v_cube#>>'{coverage,state}' is distinct from 'complete'
         or jsonb_typeof(v_cube#>'{coverage,sourceRows}') <> 'number'
         or (v_cube#>>'{coverage,sourceRows}') !~ v_count_pattern
         or jsonb_typeof(v_cube#>'{nativeTotals,vgv}') <> 'string'
         or (v_cube#>>'{nativeTotals,vgv}') !~ v_money_pattern
         or jsonb_typeof(v_cube#>'{nativeTotals,contracts}') <> 'number'
         or (v_cube#>>'{nativeTotals,contracts}') !~ v_count_pattern
         or jsonb_typeof(v_cube->'rows') is distinct from 'array' then return null; end if;
      if (v_cube#>>'{coverage,sourceRows}')::numeric <> jsonb_array_length(v_cube->'rows')
         or jsonb_array_length(v_cube->'rows') > 5000
         or (v_cube#>>'{nativeTotals,contracts}')::numeric > 1000000000 then return null; end if;
      v_sum_vgv := 0;
      v_sum_contracts := 0;
      v_previous_key := '';
      for v_row in select value from jsonb_array_elements(v_cube->'rows') loop
        if not private.crm_qlik_v2_keys(v_row, array['key','name','vgv','contracts'])
           or jsonb_typeof(v_row->'key') <> 'string'
           or jsonb_typeof(v_row->'name') <> 'string'
           or length(v_row->>'key') not between 1 and 128
           or (v_row->>'key') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
           or length(v_row->>'name') not between 1 and 256
           or btrim(v_row->>'key') <> v_row->>'key'
           or btrim(v_row->>'name') <> v_row->>'name'
           or (v_row->>'key') ~ '[[:cntrl:]]' or (v_row->>'name') ~ '[[:cntrl:]]'
           or jsonb_typeof(v_row->'vgv') <> 'string' or (v_row->>'vgv') !~ v_money_pattern
           or jsonb_typeof(v_row->'contracts') <> 'number' or (v_row->>'contracts') !~ v_count_pattern then
          return null;
        end if;
        v_key := v_row->>'key';
        if v_key collate "C" <= v_previous_key collate "C" or (v_row->>'contracts')::numeric > 1000000000 then return null; end if;
        v_previous_key := v_key;
        v_sum_vgv := v_sum_vgv + (v_row->>'vgv')::numeric;
        v_sum_contracts := v_sum_contracts + (v_row->>'contracts')::numeric;
      end loop;
      if v_sum_vgv <> (v_cube#>>'{nativeTotals,vgv}')::numeric
         or v_sum_contracts <> (v_cube#>>'{nativeTotals,contracts}')::numeric then return null; end if;
    end loop;
  end loop;
  return p_payload - array['batchId','requestId','startedAt','completedAt'];
exception when data_exception then return null;
end;
$$;

create function public.ingest_qlik_ranking_v2(
  p_payload jsonb, p_nonce_hash text, p_body_sha256 text,
  p_requested_at timestamptz, p_key_id text
)
returns jsonb language plpgsql security definer
set search_path = '' set timezone = 'UTC' set statement_timeout = '35s' set lock_timeout = '5s'
as $$
declare
  v_now timestamptz;
  v_content jsonb;
  v_hash text;
  v_request uuid;
  v_batch uuid;
  v_year integer;
  v_start timestamptz;
  v_end timestamptz;
  v_reload timestamptz;
  v_existing private.crm_qlik_v2_observations%rowtype;
  v_first private.crm_qlik_v2_observations%rowtype;
  v_latest private.crm_qlik_v2_observations%rowtype;
  v_reason text;
  v_status text;
begin
  if p_nonce_hash is null or p_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_body_sha256 is null or p_body_sha256 !~ '^[0-9a-f]{64}$'
     or p_key_id is distinct from 'qlik-ranking-v2'
     or p_requested_at is null or not isfinite(p_requested_at) then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'invalid_payload');
  end if;
  -- One bounded writer lock for this fixed scope: nonce, rate, pairing and
  -- year-specific publication all share the same transaction boundary.
  perform pg_advisory_xact_lock(714117, 2);
  v_now := clock_timestamp();
  if p_requested_at < v_now - interval '5 minutes' or p_requested_at > v_now + interval '5 minutes' then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'invalid_payload');
  end if;
  if exists (select 1 from private.crm_qlik_v2_observations where nonce_hash = p_nonce_hash) then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'replay_conflict');
  end if;
  if (select count(*) from private.crm_qlik_v2_observations where received_at >= v_now - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'rate_limited');
  end if;
  insert into private.crm_qlik_v2_observations(nonce_hash, body_sha256, key_id, requested_at, received_at, status, reason)
  values (p_nonce_hash, p_body_sha256, p_key_id, p_requested_at, v_now, 'rejected', 'invalid_payload');

  v_content := private.crm_qlik_v2_content(p_payload, v_now);
  if v_content is null then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'invalid_payload');
  end if;
  v_hash := encode(sha256(convert_to(v_content::text, 'UTF8')), 'hex');
  v_request := (p_payload->>'requestId')::uuid;
  v_batch := (p_payload->>'batchId')::uuid;
  v_year := left(p_payload#>>'{months,0,periodMonth}', 4)::integer;
  v_start := private.crm_qlik_v2_timestamp(p_payload->>'startedAt');
  v_end := private.crm_qlik_v2_timestamp(p_payload->>'completedAt');
  v_reload := private.crm_qlik_v2_timestamp(p_payload#>>'{source,reloadTimestamp}');

  select * into v_existing from private.crm_qlik_v2_observations
  where request_id = v_request and payload is not null;
  if found then
    if v_existing.payload <> p_payload or v_existing.body_sha256 <> p_body_sha256 then
      update private.crm_qlik_v2_observations set reason = 'request_conflict' where nonce_hash = p_nonce_hash;
      return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'request_conflict');
    end if;
    v_status := case when exists(select 1 from private.crm_qlik_v2_publications where batch_id = v_batch)
      then 'published' else 'staged' end;
    update private.crm_qlik_v2_observations set request_id = v_request, batch_id = v_batch,
      content_sha256 = v_hash, status = v_status, reason = null, idempotent = true
    where nonce_hash = p_nonce_hash;
    return jsonb_build_object('ok', true, 'status', v_status, 'requestId', v_request, 'contentSha256', v_hash, 'idempotent', true);
  end if;

  select observation.* into v_latest
  from private.crm_qlik_v2_publications publication
  join private.crm_qlik_v2_observations observation on observation.nonce_hash = publication.second_nonce
  where publication.reference_year = v_year
  -- Accepted completion strictly increases per year. Wall-clock corrections
  -- must not reorder generations or weaken the stale-source check.
  order by observation.completed_at desc, publication.batch_id desc limit 1;
  if found and (v_reload < v_latest.source_reload_at or v_end <= v_latest.completed_at) then
    v_reason := 'stale_source';
  end if;
  select * into v_first from private.crm_qlik_v2_observations
  where batch_id = v_batch and payload is not null order by received_at, nonce_hash limit 1;
  if found and (
    exists(select 1 from private.crm_qlik_v2_publications where batch_id = v_batch)
    or v_first.request_id = v_request or v_start < v_first.completed_at
    or v_hash <> v_first.content_sha256
    or v_content <> (v_first.payload - array['batchId','requestId','startedAt','completedAt'])
  ) then v_reason := 'batch_conflict'; end if;
  if v_reason is not null then
    update private.crm_qlik_v2_observations set reason = v_reason where nonce_hash = p_nonce_hash;
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', v_reason);
  end if;

  v_status := case when v_first.nonce_hash is null then 'staged' else 'published' end;
  update private.crm_qlik_v2_observations set request_id = v_request, batch_id = v_batch,
    reference_year = v_year, started_at = v_start, completed_at = v_end, source_reload_at = v_reload,
    payload = p_payload, content_sha256 = v_hash, status = v_status, reason = null
  where nonce_hash = p_nonce_hash;
  if v_status = 'published' then
    insert into private.crm_qlik_v2_publications(batch_id, reference_year, first_nonce, second_nonce)
    values (v_batch, v_year, v_first.nonce_hash, p_nonce_hash);
  end if;
  return jsonb_build_object('ok', true, 'status', v_status, 'requestId', v_request, 'contentSha256', v_hash, 'idempotent', false);
end;
$$;

create function public.get_qlik_ranking_v2(p_year integer default null)
returns jsonb language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set statement_timeout = '10s'
as $$
declare v_result jsonb;
begin
  if auth.uid() is null
     or private.current_session_satisfies_mfa() is not true
     or public.has_permission(auth.uid(), 'crm.ranking.view') is not true then
    raise exception 'ranking access denied' using errcode = '42501';
  end if;
  if p_year is not null and p_year not between 2020 and 2100 then
    raise exception 'invalid ranking year' using errcode = '22023';
  end if;
  -- One SQL snapshot for both generations and the list of years; never mix cubes.
  with years as (
    select distinct reference_year from private.crm_qlik_v2_publications
  ), selected as (
    select coalesce(p_year, max(reference_year)) as year from years
  ), ranked as (
    select observation.payload, publication.published_at,
      row_number() over(order by observation.completed_at desc, publication.batch_id desc) as position
    from private.crm_qlik_v2_publications publication
    join private.crm_qlik_v2_observations observation on observation.nonce_hash = publication.second_nonce
    where publication.reference_year = (select year from selected)
    order by observation.completed_at desc, publication.batch_id desc limit 2
  )
  select jsonb_build_object(
    'current', (select payload from ranked where position = 1),
    'previous', (select payload from ranked where position = 2),
    'publishedAt', (select to_char(published_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from ranked where position = 1),
    'availableYears', coalesce((select jsonb_agg(reference_year order by reference_year desc) from years), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

alter function private.crm_qlik_v2_keys(jsonb,text[]) owner to postgres;
alter function private.crm_qlik_v2_timestamp(text) owner to postgres;
alter function private.crm_qlik_v2_content(jsonb,timestamptz) owner to postgres;
alter function public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text) owner to postgres;
alter function public.get_qlik_ranking_v2(integer) owner to postgres;
revoke all on function private.crm_qlik_v2_keys(jsonb,text[]),
  private.crm_qlik_v2_timestamp(text), private.crm_qlik_v2_content(jsonb,timestamptz),
  public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text), public.get_qlik_ranking_v2(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_qlik_ranking_v2(jsonb,text,text,timestamptz,text) to service_role;
grant execute on function public.get_qlik_ranking_v2(integer) to authenticated;
