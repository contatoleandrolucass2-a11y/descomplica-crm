-- Qlik CANAL IMOB belongs only to Canal de Parcerias.
-- House ranking keeps its separate Salesforce read model and permission.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.get_qlik_ranking_v2(p_year integer default null)
returns jsonb language plpgsql stable security definer
set search_path = '' set timezone = 'UTC' set statement_timeout = '10s'
as $$
declare v_result jsonb;
begin
  if auth.uid() is null
     or private.current_session_satisfies_mfa() is not true
     or public.has_permission(auth.uid(), 'crm.partnerships.view') is not true then
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

alter function public.get_qlik_ranking_v2(integer) owner to postgres;
revoke all on function public.get_qlik_ranking_v2(integer) from public, anon, authenticated, service_role;
grant execute on function public.get_qlik_ranking_v2(integer) to authenticated;

commit;
