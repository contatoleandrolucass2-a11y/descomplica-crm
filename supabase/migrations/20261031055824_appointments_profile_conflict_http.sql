-- Appointments CAS conflicts use the non-retryable PostgREST PGRST envelope.
-- HTTP 409 and the existing response code/message remain compatible with the
-- published application. Other dashboard pages keep their existing contract.
-- Replacing the same signature preserves ownership and EXECUTE privileges.
-- No profile rows, grants, policies, or validation rules are changed.

begin;

create or replace function public.update_dashboard_profile(
  p_profile_id uuid,
  p_expected_version bigint,
  p_name text default null,
  p_cards jsonb default null,
  p_schema_version smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '5s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current public.dashboard_profiles%rowtype;
  v_saved public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_current from public.dashboard_profiles profile
  where profile.id = p_profile_id
    and (profile.user_id = v_actor or profile.page_key = 'crm.stage.appointments');
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_context(
    v_actor, v_current.page_key, v_current.scope_key
  );
  if v_current.page_key = 'crm.stage.appointments'
     and v_current.id <> (
       select profile.id
       from public.dashboard_profiles profile
       where profile.page_key = v_current.page_key
         and profile.scope_key is not distinct from v_current.scope_key
       order by profile.is_default desc, profile.updated_at desc, profile.id
       limit 1
     ) then
    if v_current.page_key = 'crm.stage.appointments' then
      raise sqlstate 'PGRST' using
        message = jsonb_build_object(
          'code', '40001', 'message', 'conflict: dashboard profile version changed',
          'details', null, 'hint', null
        )::text,
        detail = '{"status":409,"headers":{}}';
    else
      raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
    end if;
  end if;
  if p_expected_version is null or p_expected_version not between 1 and 9007199254740991
     or (p_name is null and p_cards is null and p_schema_version is null)
     or (p_name is not null and (
       p_name <> btrim(p_name) or char_length(p_name) not between 1 and 80
       or p_name ~ '[[:cntrl:]<>]'
     ))
     or (p_schema_version is not null and p_schema_version <> 2) then
    raise exception 'invalid_argument: invalid dashboard profile patch' using errcode = '22023';
  end if;
  if p_cards is not null then
    perform private.assert_dashboard_profile_document(v_current.page_key, p_cards);
  end if;
  if v_current.version <> p_expected_version then
    if v_current.page_key = 'crm.stage.appointments' then
      raise sqlstate 'PGRST' using
        message = jsonb_build_object(
          'code', '40001', 'message', 'conflict: dashboard profile version changed',
          'details', null, 'hint', null
        )::text,
        detail = '{"status":409,"headers":{}}';
    else
      raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
    end if;
  end if;
  update public.dashboard_profiles profile
  set name = coalesce(p_name, profile.name),
      cards = coalesce(p_cards, profile.cards),
      schema_version = coalesce(p_schema_version, profile.schema_version),
      version = profile.version + 1,
      updated_at = clock_timestamp()
  where profile.id = p_profile_id and profile.version = p_expected_version
    and (profile.user_id = v_actor or profile.page_key = 'crm.stage.appointments')
  returning * into v_saved;
  if not found then
    if v_current.page_key = 'crm.stage.appointments' then
      raise sqlstate 'PGRST' using
        message = jsonb_build_object(
          'code', '40001', 'message', 'conflict: dashboard profile version changed',
          'details', null, 'hint', null
        )::text,
        detail = '{"status":409,"headers":{}}';
    else
      raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
    end if;
  end if;
  return private.dashboard_profile_json(v_saved);
end;
$$;

commit;
