begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Expand-only migration. The application keeps the versioned static document
-- as a read fallback until an administrator saves the first shared revision.
create table public.useful_links_documents (
  page_key text primary key references public.app_pages(key) on delete restrict,
  schema_version smallint not null default 1,
  revision bigint not null default 1,
  document jsonb not null,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint useful_links_documents_page_key check (
    page_key ~ '^crm\.useful_links\.[a-z0-9_]+$'
  ),
  constraint useful_links_documents_schema_version check (schema_version = 1),
  constraint useful_links_documents_revision check (
    revision between 1 and 9007199254740991
  ),
  constraint useful_links_documents_shape check (
    jsonb_typeof(document) = 'object'
    and document->>'pageKey' = page_key
    and document->>'schemaVersion' = '1'
    and jsonb_typeof(document->'cards') = 'array'
    and jsonb_array_length(document->'cards') between 1 and 50
    and pg_column_size(document) <= 524288
  ),
  constraint useful_links_documents_timestamps check (updated_at >= created_at)
);

comment on table public.useful_links_documents is
  'Shared, versioned content and grid layout for one authorized Links Uteis page.';

alter table public.useful_links_documents enable row level security;
alter table public.useful_links_documents force row level security;

create policy authenticated_session_mfa_gate on public.useful_links_documents
  as restrictive for all to authenticated
  using ((select private.current_session_satisfies_mfa()))
  with check ((select private.current_session_satisfies_mfa()));

-- The table is intentionally RPC-only. Browser and service roles cannot bypass
-- validation, page authorization, MFA or compare-and-swap revisions.
revoke all privileges on table public.useful_links_documents
  from public, anon, authenticated, service_role;

create function private.assert_useful_links_context(
  p_actor uuid,
  p_page_key text,
  p_write boolean default false
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
  if p_page_key is null or p_page_key !~ '^crm\.useful_links\.[a-z0-9_]+$' then
    raise exception 'invalid_argument: invalid useful links page' using errcode = '22023';
  end if;

  select page.permission_key into v_permission
  from public.app_pages page
  where page.key = p_page_key and page.is_active;

  if v_permission is null or not public._internal_has_permission(p_actor, v_permission) then
    raise exception 'forbidden: useful links page unavailable' using errcode = '42501';
  end if;
  if p_write and not exists (
    select 1 from public.user_roles assignment
    where assignment.user_id = p_actor and assignment.role_key in ('admin', 'master')
  ) then
    raise exception 'forbidden: useful links editor unavailable' using errcode = '42501';
  end if;
end;
$$;

create function private.assert_useful_links_document(p_page_key text, p_document jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
  v_item jsonb;
  v_node jsonb;
  v_row jsonb;
  v_cell jsonb;
  v_cursor text;
  v_node_ids text[] := array[]::text[];
  v_parent_ids text[] := array[]::text[];
  v_card_ids text[] := array[]::text[];
  v_orders integer[] := array[]::integer[];
  v_index integer;
  v_depth integer;
begin
  if p_document is null or jsonb_typeof(p_document) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_document)) <> 5
     or exists (
       select 1 from jsonb_object_keys(p_document) as object_key(value)
       where value <> all(array['schemaVersion', 'pageKey', 'revision', 'cards', 'updatedAt'])
     )
     or p_document->>'pageKey' is distinct from p_page_key
     or p_document->>'schemaVersion' is distinct from '1'
     or jsonb_typeof(p_document->'cards') is distinct from 'array'
     or jsonb_array_length(p_document->'cards') not between 1 and 50
     or pg_column_size(p_document) > 524288 then
    raise exception 'invalid_argument: invalid useful links document' using errcode = '22023';
  end if;

  for v_card in select value from jsonb_array_elements(p_document->'cards') loop
    if jsonb_typeof(v_card) is distinct from 'object'
       or jsonb_typeof(v_card->'id') is distinct from 'string'
       or (v_card->>'id') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
       or (v_card->>'id') in ('__proto__', 'prototype', 'constructor')
       or jsonb_typeof(v_card->'kind') is distinct from 'string'
       or (v_card->>'kind') not in ('section', 'org-chart')
       or jsonb_typeof(v_card->'title') is distinct from 'string'
       or char_length(btrim(v_card->>'title')) not between 1 and 160
       or jsonb_typeof(v_card->'layout') is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_card->'layout')) <> 3
       or jsonb_typeof(v_card->'layout'->'order') is distinct from 'number'
       or jsonb_typeof(v_card->'layout'->'columnSpan') is distinct from 'number'
       or jsonb_typeof(v_card->'layout'->'height') is distinct from 'number'
       or (v_card->'layout'->>'order')::integer not between 0 and 49
       or (v_card->'layout'->>'order') !~ '^(0|[1-9][0-9]*)$'
       or (v_card->'layout'->>'columnSpan')::integer not between 3 and 12
       or (v_card->'layout'->>'columnSpan') !~ '^(0|[1-9][0-9]*)$'
       or (v_card->'layout'->>'height') !~ '^(0|[1-9][0-9]*)$'
       or (v_card->'layout'->>'height')::integer not between 220 and 1200 then
      raise exception 'invalid_argument: invalid useful links card' using errcode = '22023';
    end if;
    v_card_ids := array_append(v_card_ids, v_card->>'id');
    v_orders := array_append(v_orders, (v_card->'layout'->>'order')::integer);

    if v_card->>'kind' = 'section' then
      if (select count(*) from jsonb_object_keys(v_card)) <> 7
         or exists (
           select 1 from jsonb_object_keys(v_card) as object_key(value)
           where value <> all(array['id', 'kind', 'title', 'paragraphs', 'items', 'table', 'layout'])
         )
         or jsonb_typeof(v_card->'paragraphs') is distinct from 'array'
         or jsonb_array_length(v_card->'paragraphs') > 20
         or jsonb_typeof(v_card->'items') is distinct from 'array'
         or jsonb_array_length(v_card->'items') > 40
         or (v_card->'table' is distinct from 'null'::jsonb
           and jsonb_typeof(v_card->'table') is distinct from 'object') then
        raise exception 'invalid_argument: invalid useful links section' using errcode = '22023';
      end if;
      for v_item in select value from jsonb_array_elements(v_card->'paragraphs') loop
        if jsonb_typeof(v_item) is distinct from 'string'
           or char_length(btrim(v_item #>> '{}')) not between 1 and 4000 then
          raise exception 'invalid_argument: invalid useful links paragraph' using errcode = '22023';
        end if;
      end loop;
      for v_item in select value from jsonb_array_elements(v_card->'items') loop
        if jsonb_typeof(v_item) is distinct from 'object'
           or (select count(*) from jsonb_object_keys(v_item)) <> 4
           or exists (
             select 1 from jsonb_object_keys(v_item) as object_key(value)
             where value <> all(array['id', 'label', 'href', 'description'])
           )
           or jsonb_typeof(v_item->'id') is distinct from 'string'
           or (v_item->>'id') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
           or jsonb_typeof(v_item->'label') is distinct from 'string'
           or char_length(btrim(v_item->>'label')) not between 1 and 240
           or jsonb_typeof(v_item->'description') is distinct from 'string'
           or char_length(btrim(v_item->>'description')) > 2000
           or (v_item->'href' is distinct from 'null'::jsonb and (
             jsonb_typeof(v_item->'href') is distinct from 'string'
             or char_length(v_item->>'href') > 2000
             or (v_item->>'href') !~* '^(https?://|tel:|mailto:)'
           )) then
          raise exception 'invalid_argument: invalid useful links item' using errcode = '22023';
        end if;
      end loop;
      if v_card->'table' is distinct from 'null'::jsonb then
        if (select count(*) from jsonb_object_keys(v_card->'table')) <> 2
           or exists (
             select 1 from jsonb_object_keys(v_card->'table') as object_key(value)
             where value <> all(array['headers', 'rows'])
           )
           or jsonb_typeof(v_card->'table'->'headers') is distinct from 'array'
           or jsonb_array_length(v_card->'table'->'headers') not between 1 and 12
           or jsonb_typeof(v_card->'table'->'rows') is distinct from 'array'
           or jsonb_array_length(v_card->'table'->'rows') > 100 then
          raise exception 'invalid_argument: invalid useful links table' using errcode = '22023';
        end if;
        for v_cell in select value from jsonb_array_elements(v_card->'table'->'headers') loop
          if jsonb_typeof(v_cell) is distinct from 'string'
             or char_length(btrim(v_cell #>> '{}')) not between 1 and 160 then
            raise exception 'invalid_argument: invalid useful links table header' using errcode = '22023';
          end if;
        end loop;
        for v_row in select value from jsonb_array_elements(v_card->'table'->'rows') loop
          if jsonb_typeof(v_row) is distinct from 'array'
             or jsonb_array_length(v_row) <> jsonb_array_length(v_card->'table'->'headers') then
            raise exception 'invalid_argument: invalid useful links table row' using errcode = '22023';
          end if;
          for v_cell in select value from jsonb_array_elements(v_row) loop
            if jsonb_typeof(v_cell) is distinct from 'string'
               or char_length(btrim(v_cell #>> '{}')) > 500 then
              raise exception 'invalid_argument: invalid useful links table cell' using errcode = '22023';
            end if;
          end loop;
        end loop;
      end if;
    else
      if (select count(*) from jsonb_object_keys(v_card)) <> 6
         or exists (
           select 1 from jsonb_object_keys(v_card) as object_key(value)
           where value <> all(array['id', 'kind', 'title', 'note', 'nodes', 'layout'])
         )
         or jsonb_typeof(v_card->'note') is distinct from 'string'
         or char_length(btrim(v_card->>'note')) > 1000
         or jsonb_typeof(v_card->'nodes') is distinct from 'array'
         or jsonb_array_length(v_card->'nodes') not between 1 and 50 then
        raise exception 'invalid_argument: invalid useful links org chart' using errcode = '22023';
      end if;
      v_node_ids := array[]::text[];
      v_parent_ids := array[]::text[];
      for v_node in select value from jsonb_array_elements(v_card->'nodes') loop
        if jsonb_typeof(v_node) is distinct from 'object'
           or (select count(*) from jsonb_object_keys(v_node)) <> 7
           or exists (
             select 1 from jsonb_object_keys(v_node) as object_key(value)
             where value <> all(array['id', 'parentId', 'role', 'name', 'phone', 'href', 'order'])
           )
           or jsonb_typeof(v_node->'id') is distinct from 'string'
           or (v_node->>'id') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
           or jsonb_typeof(v_node->'role') is distinct from 'string'
           or char_length(btrim(v_node->>'role')) not between 1 and 120
           or jsonb_typeof(v_node->'name') is distinct from 'string'
           or char_length(btrim(v_node->>'name')) > 160
           or jsonb_typeof(v_node->'phone') is distinct from 'string'
           or char_length(btrim(v_node->>'phone')) > 40
           or jsonb_typeof(v_node->'order') is distinct from 'number'
           or (v_node->>'order') !~ '^(0|[1-9][0-9]*)$'
           or (v_node->>'order')::integer not between 0 and 99
           or (v_node->'parentId' is distinct from 'null'::jsonb
             and jsonb_typeof(v_node->'parentId') is distinct from 'string')
           or (v_node->'href' is distinct from 'null'::jsonb and (
             jsonb_typeof(v_node->'href') is distinct from 'string'
             or char_length(v_node->>'href') > 2000
             or (v_node->>'href') !~* '^(https?://|tel:|mailto:)'
           )) then
          raise exception 'invalid_argument: invalid useful links org node' using errcode = '22023';
        end if;
        v_node_ids := array_append(v_node_ids, v_node->>'id');
        v_parent_ids := array_append(v_parent_ids, v_node->>'parentId');
      end loop;
      if cardinality(v_node_ids) <> cardinality(array(select distinct unnest(v_node_ids))) then
        raise exception 'invalid_argument: duplicate useful links org node' using errcode = '22023';
      end if;
      for v_index in 1..cardinality(v_node_ids) loop
        if v_parent_ids[v_index] is not null
           and (v_parent_ids[v_index] = v_node_ids[v_index]
             or not (v_parent_ids[v_index] = any(v_node_ids))) then
          raise exception 'invalid_argument: invalid useful links org parent' using errcode = '22023';
        end if;
        v_cursor := v_parent_ids[v_index];
        for v_depth in 1..cardinality(v_node_ids) loop
          exit when v_cursor is null;
          if v_cursor = v_node_ids[v_index] then
            raise exception 'invalid_argument: cyclic useful links org chart' using errcode = '22023';
          end if;
          select node->>'parentId' into v_cursor
          from jsonb_array_elements(v_card->'nodes') node
          where node->>'id' = v_cursor;
        end loop;
      end loop;
    end if;
  end loop;

  if cardinality(v_card_ids) <> cardinality(array(select distinct unnest(v_card_ids)))
     or cardinality(v_orders) <> cardinality(array(select distinct unnest(v_orders))) then
    raise exception 'invalid_argument: duplicate useful links card identity' using errcode = '22023';
  end if;
end;
$$;

create function private.useful_links_document_json(p_row public.useful_links_documents)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select (p_row).document || jsonb_build_object(
    'revision', (p_row).revision,
    'updatedAt', (p_row).updated_at
  );
$$;

create function public.get_useful_links_document(p_page_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.useful_links_documents%rowtype;
begin
  perform private.assert_useful_links_context(v_actor, p_page_key, false);
  select * into v_row from public.useful_links_documents document
  where document.page_key = p_page_key;
  if not found then return null; end if;
  return private.useful_links_document_json(v_row);
end;
$$;

create function public.save_useful_links_document(
  p_page_key text,
  p_expected_revision bigint,
  p_document jsonb
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
  v_current public.useful_links_documents%rowtype;
  v_saved public.useful_links_documents%rowtype;
  v_document jsonb;
begin
  perform private.assert_useful_links_context(v_actor, p_page_key, true);
  if p_expected_revision is null or p_expected_revision not between 0 and 9007199254740991 then
    raise exception 'invalid_argument: invalid useful links revision' using errcode = '22023';
  end if;
  perform private.assert_useful_links_document(p_page_key, p_document);
  v_document := p_document - 'revision' - 'updatedAt';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_page_key, 0));
  select * into v_current from public.useful_links_documents document
  where document.page_key = p_page_key for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'serialization_failure: useful links document changed' using errcode = '40001';
    end if;
    insert into public.useful_links_documents (
      page_key, schema_version, revision, document, updated_by
    ) values (
      p_page_key, 1, 1, v_document, v_actor
    ) returning * into v_saved;
  else
    if v_current.revision <> p_expected_revision then
      raise exception 'serialization_failure: useful links document changed' using errcode = '40001';
    end if;
    update public.useful_links_documents document
    set document = v_document,
        revision = document.revision + 1,
        updated_by = v_actor,
        updated_at = clock_timestamp()
    where document.page_key = p_page_key
    returning * into v_saved;
  end if;
  return private.useful_links_document_json(v_saved);
end;
$$;

alter function private.assert_useful_links_context(uuid, text, boolean) owner to postgres;
alter function private.assert_useful_links_document(text, jsonb) owner to postgres;
alter function private.useful_links_document_json(public.useful_links_documents) owner to postgres;
alter function public.get_useful_links_document(text) owner to postgres;
alter function public.save_useful_links_document(text, bigint, jsonb) owner to postgres;

revoke all privileges on function
  private.assert_useful_links_context(uuid, text, boolean),
  private.assert_useful_links_document(text, jsonb),
  private.useful_links_document_json(public.useful_links_documents),
  public.get_useful_links_document(text),
  public.save_useful_links_document(text, bigint, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.get_useful_links_document(text),
  public.save_useful_links_document(text, bigint, jsonb)
to authenticated;

commit;
