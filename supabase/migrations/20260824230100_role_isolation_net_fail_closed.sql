-- Make the dedicated-role isolation probes independent of optional pg_net.
--
-- The original predicates address the `net` schema by name. PostgreSQL raises
-- `invalid_schema_name` when the optional extension is absent, instead of
-- reporting that the role lacks USAGE. Patch only that lookup while retaining
-- every previously audited role, database, schema, relation and function check.

do $migration$
declare
  v_definition text;
  v_patched_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.crm_qlik_relay_role_isolated()'::regprocedure
  )
  into v_definition;

  v_patched_definition := pg_catalog.replace(
    v_definition,
    'not has_schema_privilege(''crm_qlik_relay'', ''net'', ''USAGE'')',
    'not coalesce(pg_catalog.has_schema_privilege(''crm_qlik_relay'', pg_catalog.to_regnamespace(''net''), ''USAGE''), false)'
  );

  if v_patched_definition = v_definition then
    raise exception 'expected Qlik relay net privilege predicate was not found';
  end if;

  execute v_patched_definition;
end;
$migration$;

alter function private.crm_qlik_relay_role_isolated() owner to postgres;
revoke all privileges on function private.crm_qlik_relay_role_isolated()
from public, anon, authenticated, service_role, crm_qlik_relay;

do $migration$
declare
  v_definition text;
  v_patched_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.crm_commercial_engine_role_isolated()'::regprocedure
  )
  into v_definition;

  v_patched_definition := pg_catalog.replace(
    v_definition,
    'not has_schema_privilege(''crm_commercial_engine'', ''net'', ''USAGE'')',
    'not coalesce(pg_catalog.has_schema_privilege(''crm_commercial_engine'', pg_catalog.to_regnamespace(''net''), ''USAGE''), false)'
  );

  if v_patched_definition = v_definition then
    raise exception 'expected commercial engine net privilege predicate was not found';
  end if;

  execute v_patched_definition;
end;
$migration$;

alter function private.crm_commercial_engine_role_isolated() owner to postgres;
revoke all privileges on function private.crm_commercial_engine_role_isolated()
from public, anon, authenticated, service_role, crm_commercial_engine;
