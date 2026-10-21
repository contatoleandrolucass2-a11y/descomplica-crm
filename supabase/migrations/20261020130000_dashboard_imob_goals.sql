begin;

-- Dashboard Imob readers need only the active partnership goal used to render
-- their authorized funnel. Editing remains restricted to crm.settings.manage.
alter policy crm_funnel_goals_select_authorized
  on public.crm_funnel_goals using (
    (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
    or exists (
      select 1 from public.app_pages page
      where page.key = case crm_funnel_goals.profile_key
        when 'dv' then 'crm.settings.goals'
        when 'partnerships' then 'crm.settings.partnerships'
      end
        and page.is_active
        and page.permission_key = page.key || '.view'
        and public.has_permission((select auth.uid()), page.permission_key)
    )
    or (
      crm_funnel_goals.profile_key = 'partnerships'
      and exists (
        select 1 from public.app_pages page
        where page.key = 'crm.dashboard'
          and page.is_active
          and page.permission_key = 'crm.dashboard.view'
          and public.has_permission((select auth.uid()), page.permission_key)
      )
      and public.has_permission(
        (select auth.uid()),
        'crm.dashboard.with_canal_imob.view'
      )
    )
  );

commit;
