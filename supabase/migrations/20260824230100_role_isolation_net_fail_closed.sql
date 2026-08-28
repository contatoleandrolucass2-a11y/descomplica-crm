-- Portability repair for optional local-only isolation contracts.
--
-- Production does not contain either function or its dedicated role, so this
-- migration is a deliberate no-op there. A clean installation contains both
-- functions, but pg_net is optional; their original name-based privilege
-- lookup raises invalid_schema_name when `net` is absent. Patch only an exact
-- known predicate. If a function exists with an unknown definition, fail
-- instead of silently weakening its isolation contract.
--
-- No role, schema, function, grant, relay or engine foundation is created.

do $migration$
declare
  v_contract record;
  v_function regprocedure;
  v_definition text;
  v_patched_definition text;
  v_source_hash text;
  v_unsafe_predicate text;
  v_safe_predicate text;
begin
  for v_contract in
    select *
    from (values
      (
        'private.crm_qlik_relay_role_isolated()',
        'crm_qlik_relay',
        'afa303a358c89eb09e0ea17a792ffa94',
        'beb9f8cc531128627ddb8f9a32cb8ec0'
      ),
      (
        'private.crm_commercial_engine_role_isolated()',
        'crm_commercial_engine',
        '8eb23dd4f496f14969f0a9a022e4d2ff',
        'dc483726acb9310a57abb963a0b41502'
      )
    ) contracts(function_signature, dedicated_role, unsafe_source_hash, safe_source_hash)
  loop
    v_function := pg_catalog.to_regprocedure(v_contract.function_signature);
    if v_function is null then
      continue;
    end if;

    select pg_catalog.md5(function_row.prosrc)
    into v_source_hash
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_language language_row
      on language_row.oid = function_row.prolang
    where function_row.oid = v_function
      and function_row.prorettype = 'boolean'::pg_catalog.regtype
      and language_row.lanname = 'sql'
      and function_row.prokind = 'f'
      and not function_row.proretset
      and not function_row.proisstrict
      and function_row.provolatile = 's'
      and function_row.prosecdef
      and not function_row.proleakproof
      and function_row.proparallel = 'u'
      and coalesce(function_row.proconfig, array[]::text[]) =
        array['search_path=""']::text[]
      and pg_catalog.pg_get_userbyid(function_row.proowner) = 'postgres'
      and (
        select count(*)
        from pg_catalog.aclexplode(coalesce(
          function_row.proacl,
          pg_catalog.acldefault('f', function_row.proowner)
        )) privilege
      ) = 1
      and not exists (
        select 1
        from pg_catalog.aclexplode(coalesce(
          function_row.proacl,
          pg_catalog.acldefault('f', function_row.proowner)
        )) privilege
        where privilege.grantee <> function_row.proowner
           or privilege.privilege_type <> 'EXECUTE'
           or privilege.is_grantable
      );

    if v_source_hash is null
       or v_source_hash not in (v_contract.unsafe_source_hash, v_contract.safe_source_hash) then
      raise exception 'unknown optional net isolation contract: %',
        v_contract.function_signature
        using errcode = '55000';
    end if;

    v_definition := pg_catalog.pg_get_functiondef(v_function);
    v_unsafe_predicate := pg_catalog.format(
      'not has_schema_privilege(%L, ''net'', ''USAGE'')',
      v_contract.dedicated_role
    );
    v_safe_predicate := pg_catalog.format(
      'not coalesce(pg_catalog.has_schema_privilege(%L, pg_catalog.to_regnamespace(''net''), ''USAGE''), false)',
      v_contract.dedicated_role
    );
    if v_source_hash = v_contract.unsafe_source_hash then
      v_patched_definition := pg_catalog.replace(
        v_definition,
        v_unsafe_predicate,
        v_safe_predicate
      );
      if v_patched_definition = v_definition then
        raise exception 'known unsafe isolation contract could not be patched: %',
          v_contract.function_signature
          using errcode = '55000';
      end if;
      execute v_patched_definition;
    end if;

    select pg_catalog.md5(function_row.prosrc)
    into v_source_hash
    from pg_catalog.pg_proc function_row
    where function_row.oid = v_function;
    if v_source_hash <> v_contract.safe_source_hash then
      raise exception 'optional net isolation contract did not reach the approved fingerprint: %',
        v_contract.function_signature
        using errcode = '55000';
    end if;

    execute pg_catalog.format(
      'alter function %s owner to postgres',
      v_function
    );
    execute pg_catalog.format(
      'revoke all privileges on function %s from public, anon, authenticated, service_role',
      v_function
    );
    if pg_catalog.to_regrole(v_contract.dedicated_role) is not null then
      execute pg_catalog.format(
        'revoke all privileges on function %s from %I',
        v_function,
        v_contract.dedicated_role
      );
    end if;
  end loop;
end;
$migration$;
