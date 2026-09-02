begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (
    select 1
    from public.app_pages
    where key = 'crm.simulation.wf13'
      and path = '/app/simulacao/associativo-fluxo-linear'
      and parent_key = 'crm.simulation'
      and permission_key = 'crm.simulators.view'
      and is_navigation
      and is_active
  ) then
    raise exception 'WF13 navigation entry is absent or does not match the guarded route'
      using errcode = '55000';
  end if;
end;
$$;

update public.app_pages
set name = 'Simulador Associativo',
    description = 'Simulação do fluxo linear associativo'
where key = 'crm.simulation.wf13'
  and path = '/app/simulacao/associativo-fluxo-linear';

do $$
begin
  if (
    select count(*)
    from public.app_pages
    where key = 'crm.simulation.wf13'
      and path = '/app/simulacao/associativo-fluxo-linear'
      and name = 'Simulador Associativo'
      and description = 'Simulação do fluxo linear associativo'
  ) <> 1 then
    raise exception 'WF13 navigation rename did not converge'
      using errcode = '55000';
  end if;
end;
$$;

commit;
