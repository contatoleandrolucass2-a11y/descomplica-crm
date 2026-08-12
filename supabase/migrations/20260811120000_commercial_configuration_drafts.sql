-- Safe configuration intake for goals and points. Drafts are deliberately
-- disconnected from policy versions, engine gates and production read paths.

create table private.crm_commercial_configuration_drafts (
  id uuid primary key default gen_random_uuid(),
  engine_key text not null
    references private.crm_commercial_engine_catalog(engine_key) on delete restrict,
  revision integer not null default 1 check (revision > 0),
  payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint crm_commercial_configuration_drafts_engine_key_key unique (engine_key),
  constraint crm_commercial_configuration_drafts_payload_check check (
    jsonb_typeof(payload) = 'object'
    and octet_length(convert_to(payload::text, 'UTF8')) <= 65536
  )
);

alter table private.crm_commercial_configuration_drafts enable row level security;
alter table private.crm_commercial_configuration_drafts force row level security;
revoke all on table private.crm_commercial_configuration_drafts
  from public, anon, authenticated, service_role, crm_qlik_relay, crm_commercial_engine;

create or replace function private.build_crm_commercial_configuration_draft_plan(
  p_engine_key text,
  p_payload jsonb,
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_current_revision integer;
  v_payload_hash text;
  v_plan_hash text;
  v_values jsonb;
  v_expected_keys text[];
  v_actual_keys text[];
  v_key text;
  v_valid boolean := true;
  v_reason text := null;
begin
  if p_engine_key is null
    or p_engine_key not in ('goals.dv', 'goals.partnerships', 'points.ranking') then
    v_valid := false;
    v_reason := 'unsupported_engine';
  elsif p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(convert_to(p_payload::text, 'UTF8')) > 65536
    or p_payload ->> 'schemaVersion' <> '1' then
    v_valid := false;
    v_reason := 'invalid_payload';
  end if;

  select draft.revision into v_current_revision
  from private.crm_commercial_configuration_drafts draft
  where draft.engine_key = p_engine_key;
  v_current_revision := coalesce(v_current_revision, 0);

  if v_valid and p_expected_revision is not null
    and p_expected_revision <> v_current_revision then
    v_valid := false;
    v_reason := 'stale_revision';
  end if;

  if v_valid and p_engine_key in ('goals.dv', 'goals.partnerships') then
    select array_agg(key order by key) into v_actual_keys from jsonb_object_keys(p_payload) key;
    if v_actual_keys is distinct from array[
        'effectiveMonth', 'kind', 'profile', 'schemaVersion', 'values'
      ]::text[]
      or p_payload ->> 'kind' <> 'funnel-goals'
      or (p_payload ->> 'profile') is distinct from (
        case when p_engine_key = 'goals.dv' then 'dv' else 'partnerships' end
      )
      or (p_payload ->> 'effectiveMonth') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-01$'
      or jsonb_typeof(p_payload -> 'values') <> 'object' then
      v_valid := false;
      v_reason := 'invalid_payload';
    else
      v_values := p_payload -> 'values';
      v_expected_keys := array[
        'appointmentsRate', 'approvedFoldersRate', 'brokerMinimumMonth1',
        'brokerMinimumMonth2', 'brokerMinimumMonth3', 'brokerMinimumMonth4Plus',
        'brokerWeeklyAppointments', 'brokerWeeklyFolders', 'brokerWeeklyVisits',
        'foldersRate', 'opportunitiesRate', 'productiveTeamAppointments',
        'productiveTeamFolders', 'productiveTeamSales', 'productiveTeamVisits',
        'sales', 'visitsRate'
      ];
      select array_agg(key order by key) into v_actual_keys from jsonb_object_keys(v_values) key;
      if v_actual_keys is distinct from v_expected_keys then
        v_valid := false;
        v_reason := 'invalid_payload';
      else
        foreach v_key in array v_expected_keys loop
          if jsonb_typeof(v_values -> v_key) <> 'string'
            or (v_values ->> v_key) !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,4})?$' then
            v_valid := false;
            v_reason := 'invalid_payload';
            exit;
          end if;
        end loop;
      end if;
    end if;
  elsif v_valid then
    select array_agg(key order by key) into v_actual_keys from jsonb_object_keys(p_payload) key;
    if v_actual_keys is distinct from array[
        'kind', 'schemaVersion', 'targets', 'weights'
      ]::text[]
      or p_payload ->> 'kind' <> 'point-settings'
      or jsonb_typeof(p_payload -> 'weights') <> 'object'
      or jsonb_typeof(p_payload -> 'targets') <> 'object' then
      v_valid := false;
      v_reason := 'invalid_payload';
    else
      v_expected_keys := array[
        'approved_folder', 'roulette', 'roulette_saturday',
        'roulette_sunday', 'sale', 'schedule', 'visit'
      ];
      foreach v_values in array array[p_payload -> 'weights', p_payload -> 'targets'] loop
        select array_agg(key order by key) into v_actual_keys from jsonb_object_keys(v_values) key;
        if v_actual_keys is distinct from v_expected_keys then
          v_valid := false;
          v_reason := 'invalid_payload';
          exit;
        end if;
        foreach v_key in array v_expected_keys loop
          if jsonb_typeof(v_values -> v_key) <> 'string'
            or (v_values ->> v_key) !~ '^(0|[1-9][0-9]{0,5})$'
            or (v_values ->> v_key)::integer > 100000 then
            v_valid := false;
            v_reason := 'invalid_payload';
            exit;
          end if;
        end loop;
      end loop;
    end if;
  end if;

  v_payload_hash := encode(extensions.digest(convert_to(coalesce(p_payload, '{}'::jsonb)::text, 'UTF8'), 'sha256'), 'hex');
  v_plan_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'engineKey', p_engine_key,
    'payloadHash', v_payload_hash,
    'currentRevision', v_current_revision,
    'nextRevision', v_current_revision + 1,
    'valid', v_valid,
    'reasonCode', v_reason
  )::text, 'UTF8'), 'sha256'), 'hex');

  return jsonb_build_object(
    'ok', true,
    'mode', 'preview',
    'valid', v_valid,
    'activationReady', false,
    'reasonCode', v_reason,
    'engineKey', p_engine_key,
    'payloadHash', v_payload_hash,
    'planHash', v_plan_hash,
    'currentRevision', v_current_revision,
    'nextRevision', v_current_revision + 1,
    'blockers', jsonb_build_array(
      'official_policy', 'owner', 'backup_owner', 'golden_cases', 'approval',
      'cohort_and_grant', 'effective_date', 'rollback'
    )
  );
end;
$$;

revoke all on function private.build_crm_commercial_configuration_draft_plan(text,jsonb,integer)
  from public, anon, authenticated, service_role, crm_qlik_relay, crm_commercial_engine;

create or replace function public.preview_crm_commercial_configuration_draft(
  p_engine_key text,
  p_payload jsonb,
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null
    or not private.current_user_is_master()
    or not coalesce(public._internal_has_permission(v_actor, 'crm.commercial_policy.manage'), false) then
    raise exception 'forbidden: commercial configuration draft preview is not permitted'
      using errcode = '42501';
  end if;
  return private.build_crm_commercial_configuration_draft_plan(
    p_engine_key, p_payload, p_expected_revision
  );
end;
$$;

create or replace function public.get_crm_commercial_configuration_draft(
  p_engine_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_actor is null
    or not private.current_user_is_master()
    or not coalesce(public._internal_has_permission(v_actor, 'crm.commercial_policy.manage'), false) then
    raise exception 'forbidden: commercial configuration draft read is not permitted'
      using errcode = '42501';
  end if;
  select jsonb_build_object(
    'engineKey', draft.engine_key,
    'revision', draft.revision,
    'payload', draft.payload,
    'payloadHash', draft.payload_hash,
    'updatedAt', draft.updated_at
  ) into v_result
  from private.crm_commercial_configuration_drafts draft
  where draft.engine_key = p_engine_key;
  return v_result;
end;
$$;

create or replace function public.save_crm_commercial_configuration_draft(
  p_engine_key text,
  p_payload jsonb,
  p_expected_revision integer,
  p_expected_plan_hash text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_plan jsonb;
  v_previous private.crm_commercial_configuration_drafts%rowtype;
  v_revision integer;
begin
  if v_actor is null then
    raise exception 'forbidden: commercial configuration draft save is not permitted'
      using errcode = '42501';
  end if;
  perform private.lock_and_assert_actor(v_actor);
  if not private.current_user_is_master()
    or not coalesce(public._internal_has_permission(v_actor, 'crm.commercial_policy.manage'), false) then
    raise exception 'forbidden: commercial configuration draft save is not permitted'
      using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_expected_plan_hash is null or p_expected_plan_hash !~ '^[0-9a-f]{64}$'
    or p_reason is null or p_reason <> btrim(p_reason)
    or length(p_reason) < 8 or length(p_reason) > 500
    or p_reason ~ '[[:cntrl:]]' then
    raise exception 'invalid_argument: invalid commercial configuration draft command'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'crm-commercial-configuration-draft:' || coalesce(p_engine_key, ''), 0
  ));
  select draft.* into v_previous
  from private.crm_commercial_configuration_drafts draft
  where draft.engine_key = p_engine_key
  for update;

  v_plan := private.build_crm_commercial_configuration_draft_plan(
    p_engine_key, p_payload, p_expected_revision
  );
  if coalesce((v_plan ->> 'valid')::boolean, false) is not true
    or v_plan ->> 'planHash' <> p_expected_plan_hash then
    raise exception 'conflict: commercial configuration draft plan is stale or invalid'
      using errcode = '23505';
  end if;
  v_revision := (v_plan ->> 'nextRevision')::integer;

  insert into private.crm_commercial_configuration_drafts (
    engine_key, revision, payload, payload_hash, created_by, updated_by
  ) values (
    p_engine_key, v_revision, p_payload, v_plan ->> 'payloadHash', v_actor, v_actor
  )
  on conflict (engine_key) do update set
    revision = excluded.revision,
    payload = excluded.payload,
    payload_hash = excluded.payload_hash,
    updated_by = excluded.updated_by,
    updated_at = clock_timestamp();

  insert into public.audit_logs (actor_id, action, before, after)
  values (
    v_actor,
    'commercial.configuration_draft.saved',
    jsonb_build_object(
      'engine_key', p_engine_key,
      'revision', coalesce(v_previous.revision, 0),
      'payload_hash', v_previous.payload_hash
    ),
    jsonb_build_object(
      'engine_key', p_engine_key,
      'revision', v_revision,
      'payload_hash', v_plan ->> 'payloadHash',
      'plan_hash', v_plan ->> 'planHash',
      'reason_hash', encode(extensions.digest(convert_to(p_reason, 'UTF8'), 'sha256'), 'hex'),
      'activation_ready', false
    )
  );

  return v_plan || jsonb_build_object('mode', 'save', 'revision', v_revision);
end;
$$;

alter function private.build_crm_commercial_configuration_draft_plan(text,jsonb,integer) owner to postgres;
alter function public.preview_crm_commercial_configuration_draft(text,jsonb,integer) owner to postgres;
alter function public.get_crm_commercial_configuration_draft(text) owner to postgres;
alter function public.save_crm_commercial_configuration_draft(text,jsonb,integer,text,text) owner to postgres;

revoke all on function public.preview_crm_commercial_configuration_draft(text,jsonb,integer)
  from public, anon, service_role, crm_qlik_relay, crm_commercial_engine;
revoke all on function public.get_crm_commercial_configuration_draft(text)
  from public, anon, service_role, crm_qlik_relay, crm_commercial_engine;
revoke all on function public.save_crm_commercial_configuration_draft(text,jsonb,integer,text,text)
  from public, anon, service_role, crm_qlik_relay, crm_commercial_engine;
grant execute on function public.preview_crm_commercial_configuration_draft(text,jsonb,integer)
  to authenticated;
grant execute on function public.get_crm_commercial_configuration_draft(text)
  to authenticated;
grant execute on function public.save_crm_commercial_configuration_draft(text,jsonb,integer,text,text)
  to authenticated;

comment on table private.crm_commercial_configuration_drafts is
  'Master-only inactive configuration drafts; never consumed by runtime gates.';
