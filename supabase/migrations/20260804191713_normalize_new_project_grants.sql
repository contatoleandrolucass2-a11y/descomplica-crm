-- Normalize Data API privileges across legacy and new Supabase projects.
--
-- Supabase projects created with the new platform defaults do not receive
-- implicit SELECT/INSERT/UPDATE/DELETE grants for tables and functions. Older
-- projects may still carry those defaults. Revoke first and then grant the
-- audited application surface explicitly so both project types converge on
-- the same ACLs.

-- Keep future objects fail-closed. Migrations create application objects as
-- postgres, so these defaults cover the versioned schema path.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from public, anon, authenticated, service_role;

-- Normalize every existing public object before rebuilding the allowlist.
revoke all privileges on all tables in schema public
  from public, anon, authenticated, service_role;

revoke all privileges on all sequences in schema public
  from public, anon, authenticated, service_role;

revoke all privileges on all functions in schema public
  from public, anon, authenticated, service_role;

-- Direct browser reads proven by the Next.js server/client data access layer.
-- RLS remains the row-level authority on every table below.
grant select on table
  public.app_pages,
  public.audit_logs,
  public.crm_dashboard_metrics,
  public.crm_dashboard_snapshots,
  public.crm_dashboard_top_developments,
  public.crm_dashboard_views,
  public.crm_funnel_goals,
  public.crm_point_metrics,
  public.crm_point_settings,
  public.crm_ranking_participants,
  public.crm_ranking_snapshots,
  public.profiles,
  public.user_permission_overrides,
  public.user_roles
to authenticated;

-- Browser RPC surface. has_permission is also required by the existing RLS
-- policies; every other function listed here has a direct application caller.
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.get_user_authorization_context(uuid) to authenticated;
grant execute on function public.assign_user_role(uuid, text, text) to authenticated;
grant execute on function public.set_user_permission_override(uuid, text, text, text)
  to authenticated;
grant execute on function public.remove_user_permission_override(uuid, text, text)
  to authenticated;
grant execute on function public.list_app_pages_for_management() to authenticated;
grant execute on function public.set_app_page_active(text, boolean, text) to authenticated;
grant execute on function public.set_user_active(uuid, boolean, text) to authenticated;
grant execute on function public.upsert_crm_funnel_goals(
  text, date, bigint, numeric, numeric, numeric, numeric, numeric,
  integer, integer, integer, integer, integer, integer, integer,
  smallint, smallint, smallint, smallint
) to authenticated;
grant execute on function public.replace_crm_point_settings(jsonb, jsonb) to authenticated;
grant execute on function public.get_crm_sync_status() to authenticated;
grant execute on function public.begin_crm_salesforce_refresh(text) to authenticated;
grant execute on function public.finish_crm_salesforce_refresh(uuid, text, integer, text)
  to authenticated;

-- The only proven service-role operation is the server-only ingestion RPC.
-- Its SECURITY DEFINER owner performs the required table writes atomically, so
-- service_role needs no direct table or sequence privileges.
grant execute on function public.ingest_crm_salesforce_snapshot(jsonb) to service_role;

-- bootstrap_master_user, trigger helpers, internal authorization helpers and
-- the optional platform-managed rls_auto_enable event-trigger function remain
-- executable only by their owner (postgres). Revoking EXECUTE does not detach
-- or disable an existing ensure_rls event trigger.
