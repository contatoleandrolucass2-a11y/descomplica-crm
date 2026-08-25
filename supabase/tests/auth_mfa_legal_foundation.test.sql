begin;

select plan(52);

select has_table(
  'private',
  'legal_acceptance_requirements',
  'legal acceptance requirements are private'
);

select has_table(
  'private',
  'legal_acceptances',
  'legal acceptance ledger is private'
);

select is(
  (
    select array_agg(attribute.attname order by key_column.ordinality)
    from pg_catalog.pg_constraint constraint_entry
    cross join lateral unnest(constraint_entry.conkey)
      with ordinality as key_column(attnum, ordinality)
    join pg_catalog.pg_attribute attribute
      on attribute.attrelid = constraint_entry.conrelid
     and attribute.attnum = key_column.attnum
    where constraint_entry.conrelid =
      'private.legal_acceptance_requirements'::regclass
      and constraint_entry.contype = 'p'
  ),
  array['user_id', 'terms_version', 'privacy_version']::name[],
  'legal requirements use a composite user and document-version key'
);

select ok(
  (
    select bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname in (
        'legal_acceptance_requirements',
        'legal_acceptances'
      )
  ),
  'both legal tables enable and force RLS'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants grant_entry
    where grant_entry.table_schema = 'private'
      and grant_entry.table_name in (
        'legal_acceptance_requirements',
        'legal_acceptances'
      )
      and grant_entry.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
  ),
  'Data API roles and PUBLIC receive no legal-ledger table grant'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault('S', c.relowner))
    ) acl
    where n.nspname = 'private'
      and c.relname = 'legal_acceptances_id_seq'
      and (
        acl.grantee = 0
        or pg_catalog.pg_get_userbyid(acl.grantee) in (
          'anon',
          'authenticated',
          'service_role'
        )
      )
  ),
  'Data API roles and PUBLIC receive no legal-ledger sequence grant'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_trigger trigger_entry
    where not trigger_entry.tgisinternal
      and trigger_entry.tgrelid in (
        'private.legal_acceptance_requirements'::regclass,
        'private.legal_acceptances'::regclass
      )
      and trigger_entry.tgname in (
        'legal_acceptance_requirements_append_only',
        'legal_acceptances_append_only'
      )
  ),
  2::bigint,
  'both legal tables retain append-only triggers'
);

select throws_ok(
  $sql$
    insert into auth.users (
      id,
      email,
      raw_app_meta_data,
      raw_user_meta_data
    ) values (
      'ae000000-0000-4000-8000-000000000001',
      'legal-obsolete@example.test',
      '{"qa_ephemeral":true}'::jsonb,
      '{"legal_acceptance":{"termsAccepted":true,"termsVersion":"obsolete-terms","privacyAccepted":true,"privacyVersion":"obsolete-privacy"}}'::jsonb
    )
  $sql$,
  '23514',
  'current legal acceptance required',
  'wrong legal versions abort registration even with a forged QA marker'
);

select throws_ok(
  $sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      'ae000000-0000-4000-8000-000000000006',
      'legal-string-booleans@example.test',
      '{"legal_acceptance":{"termsAccepted":"true","termsVersion":"terms-2026-08-24-draft-1","privacyAccepted":"true","privacyVersion":"privacy-2026-08-24-draft-1"}}'::jsonb
    )
  $sql$,
  '23514',
  'current legal acceptance required',
  'string true values cannot impersonate boolean legal acceptance'
);

select ok(
  pg_get_functiondef(
    'private.capture_registration_legal_acceptance()'::regprocedure
  ) !~ 'qa_ephemeral',
  'ephemeral QA metadata cannot bypass exact legal acceptance'
);

select is(
  (
    select count(*)
    from auth.users
    where id = 'ae000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'rejected forged-QA registration leaves no auth user'
);

select is(
  (
    select count(*)
    from private.legal_acceptance_requirements
    where user_id = 'ae000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'rejected registration leaves no partial legal requirement'
);

select lives_ok(
  $sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      'ae000000-0000-4000-8000-000000000002',
      'legal-valid@example.test',
      '{"legal_acceptance":{"termsAccepted":true,"termsVersion":"terms-2026-08-24-draft-1","privacyAccepted":true,"privacyVersion":"privacy-2026-08-24-draft-1"}}'::jsonb
    )
  $sql$,
  'exact current Terms and Privacy acceptance permits registration'
);

select is(
  (
    select terms_version || '|' || privacy_version
    from private.legal_acceptance_requirements
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  'terms-2026-08-24-draft-1|privacy-2026-08-24-draft-1',
  'registration records the exact required legal versions'
);

select is(
  (
    select terms_version || '|' || privacy_version || '|' || source
    from private.legal_acceptances
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  'terms-2026-08-24-draft-1|privacy-2026-08-24-draft-1|public_registration',
  'exact consent creates one versioned public-registration acceptance'
);

insert into private.legal_acceptance_requirements (
  user_id,
  terms_version,
  privacy_version
) values (
  'ae000000-0000-4000-8000-000000000002',
  'terms-2026-09-01-draft-2',
  'privacy-2026-09-01-draft-2'
);

select is(
  (
    select count(*)
    from private.legal_acceptance_requirements
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'composite key retains multiple legal-version requirements per user'
);

insert into private.legal_acceptances (
  user_id,
  terms_version,
  privacy_version,
  source
) values (
  'ae000000-0000-4000-8000-000000000002',
  'terms-2026-09-01-draft-2',
  'privacy-2026-09-01-draft-2',
  'authenticated_acceptance'
);

select is(
  (
    select array_agg(function_entry.oid::regprocedure::text order by function_entry.oid::regprocedure::text)
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    where namespace.nspname = 'private'
      and function_entry.oid::regprocedure::text in (
        'private._internal_assert_actor_active(uuid)',
        'private._internal_get_role_level(uuid)',
        'private._internal_has_permission(uuid,text)',
        'private._internal_list_permissions(uuid)',
        'private.get_role_level(uuid)',
        'private.get_user_authorization_context(uuid)',
        'private.has_permission(uuid,text)'
      )
  ),
  array[
    'private._internal_assert_actor_active(uuid)',
    'private._internal_get_role_level(uuid)',
    'private._internal_has_permission(uuid,text)',
    'private._internal_list_permissions(uuid)',
    'private.get_role_level(uuid)',
    'private.get_user_authorization_context(uuid)',
    'private.has_permission(uuid,text)'
  ]::text[],
  'authorization implementations are preserved behind private session-gated wrappers'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_entry
    join pg_catalog.pg_namespace namespace on namespace.oid = function_entry.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(function_entry.proacl, pg_catalog.acldefault('f', function_entry.proowner))
    ) privilege
    where namespace.nspname = 'private'
      and function_entry.oid::regprocedure::text in (
        'private._internal_assert_actor_active(uuid)',
        'private._internal_get_role_level(uuid)',
        'private._internal_has_permission(uuid,text)',
        'private._internal_list_permissions(uuid)',
        'private.get_role_level(uuid)',
        'private.get_user_authorization_context(uuid)',
        'private.has_permission(uuid,text)'
      )
      and (
        privilege.grantee = 0
        or pg_catalog.pg_get_userbyid(privilege.grantee) in (
          'anon',
          'authenticated',
          'service_role'
        )
      )
  ),
  'preserved authorization implementations are not executable by Data API roles'
);

select throws_ok(
  $$update private.legal_acceptance_requirements
    set terms_version = terms_version
    where user_id = 'ae000000-0000-4000-8000-000000000002'$$,
  '42501',
  'legal acceptance ledger is append-only',
  'legal requirement cannot be updated'
);

select throws_ok(
  $$delete from private.legal_acceptance_requirements
    where user_id = 'ae000000-0000-4000-8000-000000000002'$$,
  '42501',
  'legal acceptance ledger is append-only',
  'legal requirement cannot be deleted'
);

select throws_ok(
  $$update private.legal_acceptances
    set source = source
    where user_id = 'ae000000-0000-4000-8000-000000000002'$$,
  '42501',
  'legal acceptance ledger is append-only',
  'legal acceptance cannot be updated'
);

select throws_ok(
  $$delete from private.legal_acceptances
    where user_id = 'ae000000-0000-4000-8000-000000000002'$$,
  '42501',
  'legal acceptance ledger is append-only',
  'legal acceptance cannot be deleted'
);

insert into auth.users (id, email)
values (
  'ae000000-0000-4000-8000-000000000005',
  'session-other@example.test'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}'::jsonb::text, true);

select is(
  private.current_session_satisfies_mfa(),
  false,
  'session gate rejects a request without an authenticated user'
);

select is(
  public.current_session_is_live(),
  false,
  'public live-session probe rejects a request without a user'
);

insert into auth.sessions (id, user_id, aal, not_after)
values
  (
    'ae100000-0000-4000-8000-000000000001',
    'ae000000-0000-4000-8000-000000000002',
    'aal1',
    now() + interval '1 hour'
  ),
  (
    'ae100000-0000-4000-8000-000000000002',
    'ae000000-0000-4000-8000-000000000005',
    'aal1',
    now() + interval '1 hour'
  ),
  (
    'ae100000-0000-4000-8000-000000000003',
    'ae000000-0000-4000-8000-000000000002',
    'aal1',
    now() + interval '1 hour'
  );

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal1'
  )::text,
  true
);

select is(
  public.current_session_is_live(),
  true,
  'public probe accepts a live session owned by the JWT subject'
);

select is(
  private.current_session_satisfies_mfa(),
  true,
  'live AAL1 session passes when no verified factor exists'
);

insert into auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  created_at,
  updated_at
) values (
  'ae200000-0000-4000-8000-000000000001',
  'ae000000-0000-4000-8000-000000000002',
  'pgTAP TOTP',
  'totp',
  'verified',
  now(),
  now()
);

select is(
  private.current_session_satisfies_mfa(),
  false,
  'verified factor rejects AAL1 session'
);

update auth.sessions
set aal = 'aal2'
where id = 'ae100000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2'
  )::text,
  true
);

select is(
  private.current_session_satisfies_mfa(),
  true,
  'verified factor passes only when JWT and live session are AAL2'
);

set local role authenticated;

select is(
  (
    select count(*)
    from public.profiles
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'direct self read passes restrictive RLS with a live AAL2 session'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal1'
  )::text,
  true
);

select is(
  private.current_session_satisfies_mfa(),
  false,
  'AAL1 JWT cannot reuse an AAL2 database session'
);

set local role authenticated;

select is(
  (
    select count(*)
    from public.profiles
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'direct self read fails closed under restrictive RLS at AAL1'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array('recovery')
  )::text,
  true
);

select is(
  private.current_session_satisfies_mfa(),
  false,
  'string recovery AMR cannot satisfy the MFA gate'
);

set local role authenticated;

select is(
  (
    select count(*)
    from public.profiles
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'string recovery AMR is denied by restrictive RLS'
);

reset role;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  )::text,
  true
);

select is(
  private.current_session_satisfies_mfa(),
  false,
  'fresh Auth OTP AMR object cannot satisfy the MFA gate'
);

set local role authenticated;

select is(
  (
    select count(*)
    from public.profiles
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'fresh Auth OTP AMR object is denied by restrictive RLS'
);

reset role;

update auth.sessions
set not_after = now() - interval '1 minute'
where id = 'ae100000-0000-4000-8000-000000000001';

select is(
  public.current_session_is_live(),
  false,
  'expired session fails the live-session probe'
);

update auth.sessions
set not_after = now() + interval '1 hour'
where id = 'ae100000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000002',
    'aal', 'aal2'
  )::text,
  true
);

select is(
  public.current_session_is_live(),
  false,
  'session owned by another user fails the live-session probe'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'aal', 'aal2'
  )::text,
  true
);

select is(
  public.current_session_is_live(),
  false,
  'missing session identifier fails closed outside the legacy pgTAP shape'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'private.current_session_satisfies_mfa()',
    'EXECUTE'
  ),
  'only authenticated may execute the private MFA session gate'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_session_is_live()',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.revoke_current_user_sessions_after_password_recovery()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.current_session_is_live()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.revoke_current_user_sessions_after_password_recovery()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.current_session_is_live()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.revoke_current_user_sessions_after_password_recovery()',
    'EXECUTE'
  ),
  'only authenticated may probe or revoke its own live sessions'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = 'authenticated_session_mfa_gate'
  ),
  (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  'every installed public RLS table receives the session/MFA gate'
);

select is(
  (
    select array_agg(tablename order by tablename)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = 'authenticated_session_mfa_gate'
  ),
  (
    select array_agg(relation.relname order by relation.relname)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  'session/MFA gates cover the complete installed public RLS surface'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = 'authenticated_session_mfa_gate'
      and permissive = 'RESTRICTIVE'
      and roles = array['authenticated']::name[]
      and cmd = 'ALL'
      and qual like '%current_session_satisfies_mfa%'
      and with_check like '%current_session_satisfies_mfa%'
  ),
  (
    select count(*)
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ),
  'all session/MFA policies are restrictive authenticated ALL gates'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  )::text,
  true
);

select throws_ok(
  $$select public.revoke_current_user_sessions_after_password_recovery()$$,
  '28000',
  'unauthorized: fresh password recovery required',
  'normal authenticated session cannot revoke every session'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array('recovery')
  )::text,
  true
);

select throws_ok(
  $$select public.revoke_current_user_sessions_after_password_recovery()$$,
  '28000',
  'unauthorized: fresh password recovery required',
  'string recovery AMR cannot revoke every session'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', extract(epoch from now() - interval '1 hour')::bigint
      )
    )
  )::text,
  true
);

select throws_ok(
  $$select public.revoke_current_user_sessions_after_password_recovery()$$,
  '28000',
  'unauthorized: fresh password recovery required',
  'stale Auth OTP recovery proof cannot revoke every session'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', extract(epoch from now() + interval '1 hour')::bigint
      )
    )
  )::text,
  true
);

select throws_ok(
  $$select public.revoke_current_user_sessions_after_password_recovery()$$,
  '28000',
  'unauthorized: fresh password recovery required',
  'far-future Auth OTP recovery proof cannot revoke every session'
);

select is(
  (
    select count(*)
    from auth.sessions
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  2::bigint,
  'rejected recovery proofs preserve every caller session'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ae000000-0000-4000-8000-000000000002',
    'role', 'authenticated',
    'session_id', 'ae100000-0000-4000-8000-000000000001',
    'aal', 'aal2',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', extract(epoch from now())::bigint
      )
    )
  )::text,
  true
);

select is(
  public.revoke_current_user_sessions_after_password_recovery(),
  true,
  'fresh Auth OTP recovery proof revokes caller sessions'
);

select is(
  (
    select count(*)
    from auth.sessions
    where user_id = 'ae000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'fresh recovery removes every caller session'
);

select is(
  (
    select count(*)
    from auth.sessions
    where user_id = 'ae000000-0000-4000-8000-000000000005'
  ),
  1::bigint,
  'recovery revocation preserves another user sessions'
);

select is(
  public.current_session_is_live(),
  false,
  'revoked recovery session fails the public live-session probe immediately'
);

select * from finish();

rollback;
