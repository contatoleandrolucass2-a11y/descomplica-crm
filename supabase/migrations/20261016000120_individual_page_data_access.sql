begin;

-- A page grant authorizes its own read model without granting the Dashboard or
-- settings editor. Existing channel restrictions and restrictive MFA policies
-- remain mandatory. No table grants or write policies are changed.
alter policy crm_dashboard_snapshots_select_authorized
  on public.crm_dashboard_snapshots using (
    (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
    or exists (
      select 1 from public.app_pages page
      where page.key in (
        'crm.stage.opportunities', 'crm.stage.appointments', 'crm.stage.visits',
        'crm.stage.folders', 'crm.stage.sales'
      ) and page.is_active
        and page.permission_key = page.key || '.view'
        and public.has_permission((select auth.uid()), page.permission_key)
    )
  );

alter policy crm_dashboard_metrics_select_authorized
  on public.crm_dashboard_metrics using (
    (
      (select public.has_permission((select auth.uid()), 'crm.dashboard.view'))
      or exists (
        select 1 from public.app_pages page
        where page.key = 'crm.stage.' || crm_dashboard_metrics.stage_key
          and page.is_active
          and page.permission_key = page.key || '.view'
          and public.has_permission((select auth.uid()), page.permission_key)
      )
    )
    and case view_key
      when 'all' then (select public.has_permission((select auth.uid()), 'crm.dashboard.all.view'))
      when 'with_canal_imob' then (select public.has_permission((select auth.uid()), 'crm.dashboard.with_canal_imob.view'))
      when 'without_canal_imob' then (select public.has_permission((select auth.uid()), 'crm.dashboard.without_canal_imob.view'))
      else false
    end
  );

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
  );

alter policy crm_point_settings_select_authorized
  on public.crm_point_settings using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
    or (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
    or exists (
      select 1 from public.app_pages page
      where page.key = 'crm.settings.points' and page.is_active
        and page.permission_key = 'crm.settings.points.view'
        and public.has_permission((select auth.uid()), page.permission_key)
    )
  );

alter policy crm_point_metrics_select_authorized
  on public.crm_point_metrics using (
    (select public.has_permission((select auth.uid()), 'crm.ranking.view'))
    or (select public.has_permission((select auth.uid()), 'crm.settings.manage'))
    or exists (
      select 1 from public.app_pages page
      where page.key = 'crm.settings.points' and page.is_active
        and page.permission_key = 'crm.settings.points.view'
        and public.has_permission((select auth.uid()), page.permission_key)
    )
  );

commit;
