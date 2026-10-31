-- Expand only the appointments presentation contract with an optional positive
-- safe integer pixel cap. No cards are rewritten, and the original document
-- (including layout, barScale and the new cap) reaches the existing RPC unchanged.
-- CREATE OR REPLACE preserves the private function owner and execute ACL.
-- Deploy this expansion before enabling the new writer. Rollback must retain
-- this validator while documents contain barMaxHeight; removing the key needs
-- a separately authorized data operation. No RPC, CAS, RLS or grants change.

create or replace function private.assert_dashboard_profile_document(p_page_key text, p_cards jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_card jsonb;
  v_layout jsonb;
  v_presentation jsonb;
  v_validation_card jsonb;
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
       or not (v_card ?& array['id','type','metric','period','groupBy','entityIds','layout']) then
      raise exception 'invalid_argument: invalid dashboard card' using errcode = '22023';
    end if;
    if jsonb_typeof(v_card->'layout') is distinct from 'object' then
      raise exception 'invalid_argument: invalid dashboard card layout' using errcode = '22023';
    end if;
    v_presentation := v_card->'presentation';
    if jsonb_typeof(v_presentation) = 'object' and v_presentation ? 'barMaxHeight' then
      if jsonb_typeof(v_presentation->'barMaxHeight') is distinct from 'number' then
        raise exception 'invalid_argument: invalid dashboard card presentation'
          using errcode = '22023';
      end if;
      if (v_presentation->>'barMaxHeight')::numeric not between 1 and 9007199254740991
         or trunc((v_presentation->>'barMaxHeight')::numeric)
            <> (v_presentation->>'barMaxHeight')::numeric then
        raise exception 'invalid_argument: invalid dashboard card presentation'
          using errcode = '22023';
      end if;
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
    v_validation_card := jsonb_set(v_card, '{layout}', v_layout);
    if jsonb_typeof(v_presentation) = 'object' and v_presentation ? 'barMaxHeight' then
      -- The previous strict presentation validator knows every legacy field.
      -- Remove only the new, already validated field from its validation copy.
      v_validation_card := v_validation_card #- '{presentation,barMaxHeight}';
    end if;
    v_validation_cards := v_validation_cards || jsonb_build_array(v_validation_card);
  end loop;

  perform private.assert_dashboard_profile_document_presentation_v2(
    p_page_key, v_validation_cards
  );
end;
$$;

