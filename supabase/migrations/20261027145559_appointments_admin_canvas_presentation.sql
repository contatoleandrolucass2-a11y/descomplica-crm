-- Share the appointments canvas with every authorized viewer, restrict its
-- editor to administrators and extend the card document without weakening v2.

create function private.assert_dashboard_profile_read_context(
  p_actor uuid,
  p_page_key text,
  p_scope_key text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permission text;
begin
  if p_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  if not (select private.current_session_satisfies_mfa()) then
    raise exception 'forbidden: multi-factor session required' using errcode = '42501';
  end if;
  perform public._internal_assert_actor_active(p_actor);
  if p_page_key is null or p_page_key !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
     or char_length(p_page_key) > 160
     or (p_scope_key is not null and p_scope_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$') then
    raise exception 'invalid_argument: invalid dashboard profile scope' using errcode = '22023';
  end if;

  select page.permission_key into v_permission
  from public.app_pages page
  where page.key = p_page_key and page.is_active;

  if v_permission is null
     or not public._internal_has_permission(p_actor, v_permission) then
    raise exception 'forbidden: dashboard page unavailable' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.assert_dashboard_profile_context(
  p_actor uuid,
  p_page_key text,
  p_scope_key text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_dashboard_profile_read_context(p_actor, p_page_key, p_scope_key);

  if p_page_key = 'crm.stage.appointments'
     and not exists (
       select 1
       from public.user_roles user_role
       where user_role.user_id = p_actor
         and user_role.role_key in ('admin', 'master')
     ) then
    raise exception 'forbidden: appointments dashboard editing requires administrator'
      using errcode = '42501';
  end if;
end;
$$;

alter function private.assert_dashboard_profile_document(text, jsonb)
  rename to assert_dashboard_profile_document_v2;

create function private.assert_dashboard_profile_document(p_page_key text, p_cards jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
  v_presentation jsonb;
  v_base_cards jsonb;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'invalid_argument: invalid dashboard cards' using errcode = '22023';
  end if;

  for v_card in select value from jsonb_array_elements(p_cards) loop
    if v_card ? 'presentation' then
      v_presentation := v_card->'presentation';
      if jsonb_typeof(v_presentation) <> 'object'
         or exists (
           select 1 from jsonb_object_keys(v_presentation) key
           where key not in (
             'content','fontScale','textAlign','verticalAlign',
             'textColor','accentColor','barScale'
           )
         )
         or (v_presentation ? 'content' and (
           jsonb_typeof(v_presentation->'content') <> 'string'
           or char_length(v_presentation->>'content') > 240
           or (v_presentation->>'content') ~ '[[:cntrl:]<>]'
         ))
         or (v_presentation ? 'fontScale' and (
           jsonb_typeof(v_presentation->'fontScale') <> 'number'
           or (v_presentation->>'fontScale')::numeric not between 0.75 and 1.5
         ))
         or (v_presentation ? 'barScale' and (
           jsonb_typeof(v_presentation->'barScale') <> 'number'
           or (v_presentation->>'barScale')::numeric not between 0.5 and 1.5
         ))
         or (v_presentation ? 'textAlign' and (
           jsonb_typeof(v_presentation->'textAlign') <> 'string'
           or (v_presentation->>'textAlign') not in ('left','center','right')
         ))
         or (v_presentation ? 'verticalAlign' and (
           jsonb_typeof(v_presentation->'verticalAlign') <> 'string'
           or (v_presentation->>'verticalAlign') not in ('start','center','end')
         ))
         or (v_presentation ? 'textColor' and (
           jsonb_typeof(v_presentation->'textColor') <> 'string'
           or (v_presentation->>'textColor') !~ '^#[0-9A-Fa-f]{6}$'
         ))
         or (v_presentation ? 'accentColor' and (
           jsonb_typeof(v_presentation->'accentColor') <> 'string'
           or (v_presentation->>'accentColor') !~ '^#[0-9A-Fa-f]{6}$'
         )) then
        raise exception 'invalid_argument: invalid dashboard card presentation'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  select coalesce(jsonb_agg(card - 'presentation'), '[]'::jsonb)
  into v_base_cards
  from jsonb_array_elements(p_cards) card;

  perform private.assert_dashboard_profile_document_v2(p_page_key, v_base_cards);
end;
$$;

create or replace function public.get_dashboard_profiles(p_page_key text, p_scope_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.dashboard_profiles%rowtype;
  v_profiles jsonb;
begin
  perform private.assert_dashboard_profile_read_context(v_actor, p_page_key, p_scope_key);
  if p_page_key = 'crm.stage.appointments' then
    select * into v_profile
    from public.dashboard_profiles profile
    where profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key
    order by profile.is_default desc, profile.updated_at desc, profile.id
    limit 1;
    return case when v_profile.id is null then '[]'::jsonb
      else jsonb_build_array(private.dashboard_profile_json(v_profile)) end;
  end if;

  select coalesce(
    jsonb_agg(private.dashboard_profile_json(profile)
      order by profile.is_default desc, profile.updated_at desc, profile.id),
    '[]'::jsonb
  ) into v_profiles
  from public.dashboard_profiles profile
  where profile.user_id = v_actor
    and profile.page_key = p_page_key
    and profile.scope_key is not distinct from p_scope_key;
  return v_profiles;
end;
$$;

create or replace function public.get_dashboard_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.dashboard_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'unauthorized: authenticated user required' using errcode = '28000';
  end if;
  select * into v_profile from public.dashboard_profiles profile
  where profile.id = p_profile_id
    and (profile.user_id = v_actor or profile.page_key = 'crm.stage.appointments');
  if not found then
    raise exception 'not_found: dashboard profile' using errcode = 'P0002';
  end if;
  perform private.assert_dashboard_profile_read_context(
    v_actor, v_profile.page_key, v_profile.scope_key
  );
  return private.dashboard_profile_json(v_profile);
end;
$$;

create or replace function public.create_dashboard_profile(
  p_page_key text,
  p_scope_key text,
  p_name text,
  p_cards jsonb,
  p_schema_version smallint default 2,
  p_is_default boolean default false
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
  v_saved public.dashboard_profiles%rowtype;
  v_make_default boolean;
  v_lock_key text;
begin
  perform private.assert_dashboard_profile_context(v_actor, p_page_key, p_scope_key);
  if p_name is null or p_name <> btrim(p_name) or char_length(p_name) not between 1 and 80
     or p_name ~ '[[:cntrl:]<>]' or p_schema_version <> 2 then
    raise exception 'invalid_argument: invalid dashboard profile' using errcode = '22023';
  end if;
  perform private.assert_dashboard_profile_document(p_page_key, p_cards);
  v_lock_key := case when p_page_key = 'crm.stage.appointments'
    then p_page_key || '|' || coalesce(p_scope_key, '')
    else v_actor::text || '|' || p_page_key || '|' || coalesce(p_scope_key, '') end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock_key, 0));

  if p_page_key = 'crm.stage.appointments' then
    select * into v_saved
    from public.dashboard_profiles profile
    where profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key
    order by profile.is_default desc, profile.updated_at desc, profile.id
    limit 1;
    if found then
      return private.dashboard_profile_json(v_saved);
    end if;
  end if;

  v_make_default := p_is_default or not exists (
    select 1 from public.dashboard_profiles profile
    where profile.user_id = v_actor and profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key and profile.is_default
  );
  if v_make_default then
    update public.dashboard_profiles profile
    set is_default = false, version = version + 1, updated_at = clock_timestamp()
    where profile.user_id = v_actor and profile.page_key = p_page_key
      and profile.scope_key is not distinct from p_scope_key and profile.is_default;
  end if;
  insert into public.dashboard_profiles (
    user_id, page_key, scope_key, name, is_default, schema_version, cards
  ) values (
    v_actor, p_page_key, p_scope_key, p_name, v_make_default, p_schema_version, p_cards
  ) returning * into v_saved;
  return private.dashboard_profile_json(v_saved);
end;
$$;

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
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
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
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
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
    raise exception 'conflict: dashboard profile version changed' using errcode = '40001';
  end if;
  return private.dashboard_profile_json(v_saved);
end;
$$;

alter function private.assert_dashboard_profile_read_context(uuid, text, text) owner to postgres;
alter function private.assert_dashboard_profile_context(uuid, text, text) owner to postgres;
alter function private.assert_dashboard_profile_document_v2(text, jsonb) owner to postgres;
alter function private.assert_dashboard_profile_document(text, jsonb) owner to postgres;

revoke all on function private.assert_dashboard_profile_read_context(uuid, text, text) from public;
revoke all on function private.assert_dashboard_profile_context(uuid, text, text) from public;
revoke all on function private.assert_dashboard_profile_document_v2(text, jsonb) from public;
revoke all on function private.assert_dashboard_profile_document(text, jsonb) from public;
