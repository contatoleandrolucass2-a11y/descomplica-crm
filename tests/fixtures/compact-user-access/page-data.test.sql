-- Reproduce the production read tables alongside its compact authorization contract.
\ir ../../../supabase/migrations/20260804043416_dashboard_read_model.sql
\ir ../../../supabase/migrations/20260804044701_funnel_goals.sql
\ir ../../../supabase/migrations/20260804045945_point_settings.sql

do $$ declare table_name text; begin
  foreach table_name in array array['crm_dashboard_snapshots','crm_dashboard_views','crm_dashboard_metrics','crm_dashboard_top_developments','crm_funnel_goals','crm_point_settings','crm_point_metrics'] loop
    execute format('create policy authenticated_session_mfa_gate on public.%I as restrictive for all to authenticated using ((select private.current_session_satisfies_mfa())) with check ((select private.current_session_satisfies_mfa()))',table_name);
  end loop;
end $$;
\ir ../../../supabase/migrations/20261016000120_individual_page_data_access.sql
\ir ../../../supabase/migrations/20261020130000_dashboard_imob_goals.sql
\ir ../../../supabase/tests/individual_page_data_access.test.sql
