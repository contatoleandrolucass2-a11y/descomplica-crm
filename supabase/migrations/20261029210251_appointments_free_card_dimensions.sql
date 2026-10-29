-- Extend only the appointments document with optional pixel width and free
-- dimensions. Existing cards remain schema v2; RPC authorization, RLS, grants,
-- ownership and optimistic version comparison are unchanged.
alter function private.assert_dashboard_profile_document(text, jsonb)
  rename to assert_dashboard_profile_document_presentation_v2;

create function private.assert_dashboard_profile_document(p_page_key text, p_cards jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
  v_layout jsonb;
  v_validation_cards jsonb := '[]'::jsonb;
begin
  if p_page_key is distinct from 'crm.stage.appointments' then
    -- Other pages retain the complete previous validator, including type limits
    -- and rejection of unknown layout fields such as width.
    perform private.assert_dashboard_profile_document_presentation_v2(p_page_key, p_cards);
    return;
  end if;

  if p_cards is null or jsonb_typeof(p_cards) is distinct from 'array'
     or jsonb_array_length(p_cards) > 50 or pg_column_size(p_cards) > 524288 then
    raise exception 'invalid_argument: invalid dashboard cards' using errcode = '22023';
  end if;

  for v_card in select value from jsonb_array_elements(p_cards) loop
    if jsonb_typeof(v_card) is distinct from 'object'
       or jsonb_typeof(v_card->'layout') is distinct from 'object' then
      raise exception 'invalid_argument: invalid dashboard card layout' using errcode = '22023';
    end if;
    v_layout := v_card->'layout';
    if not (v_layout ?& array['order','columnSpan','height'])
       or exists (select 1 from jsonb_object_keys(v_layout) key
         where key not in ('order','columnSpan','height','width'))
       or jsonb_typeof(v_layout->'order') is distinct from 'number'
       or jsonb_typeof(v_layout->'columnSpan') is distinct from 'number'
       or jsonb_typeof(v_layout->'height') is distinct from 'number'
       or (v_layout->>'order') !~ '^\d+$'
       or (v_layout->>'columnSpan') !~ '^\d+$'
       or (v_layout->>'height') !~ '^\d+$' then
      raise exception 'invalid_argument: invalid dashboard card layout' using errcode = '22023';
    end if;
    if (v_layout->>'order')::numeric not between 0 and 49
       or (v_layout->>'columnSpan')::numeric not between 1 and 12
       or (v_layout->>'height')::numeric not between 72 and 16384 then
      raise exception 'invalid_argument: invalid dashboard card layout' using errcode = '22023';
    end if;
    if v_layout ? 'width' then
      if jsonb_typeof(v_layout->'width') is distinct from 'number'
         or (v_layout->>'width') !~ '^\d+$' then
        raise exception 'invalid_argument: invalid dashboard card width' using errcode = '22023';
      end if;
      if (v_layout->>'width')::numeric not between 128 and 16384 then
        raise exception 'invalid_argument: invalid dashboard card width' using errcode = '22023';
      end if;
    end if;

    -- Validate every existing content, catalog, presentation and duplicate rule
    -- through the previous validator using a type-valid surrogate layout.
    -- This surrogate is never persisted: the original p_cards reaches the RPC
    -- insert/update unchanged after validation succeeds.
    v_layout := jsonb_build_object(
      'order', v_layout->'order',
      'columnSpan', case v_card->>'type'
        when 'kpi' then 2 when 'funnel' then 2 when 'table' then 6 else 3 end,
      'height', case v_card->>'type'
        when 'kpi' then 168 when 'horizontal-bars' then 264
        when 'funnel' then 312 when 'table' then 360 else 240 end
    );
    v_validation_cards := v_validation_cards || jsonb_build_array(
      jsonb_set(v_card, '{layout}', v_layout)
    );
  end loop;

  perform private.assert_dashboard_profile_document_presentation_v2(
    p_page_key, v_validation_cards
  );
end;
$$;

alter function private.assert_dashboard_profile_document(text, jsonb) owner to postgres;
revoke all on function private.assert_dashboard_profile_document(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.assert_dashboard_profile_document_presentation_v2(text, jsonb)
  from public, anon, authenticated, service_role;
