begin;

select plan(16);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.useful_links_documents'::regclass),
  'useful links documents enable and force RLS'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('authenticated'), ('service_role')) role_name(name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) privilege(name)
  where has_table_privilege(role_name.name, 'public.useful_links_documents', privilege.name)
), 'API roles have no direct table privileges');
select ok(
  has_function_privilege('authenticated', 'public.get_useful_links_document(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.save_useful_links_document(text,bigint,jsonb)', 'EXECUTE'),
  'authenticated enters only guarded useful links RPCs'
);
select ok(not exists (
  select 1
  from (values ('anon'), ('service_role')) role_name(name)
  cross join (values
    ('public.get_useful_links_document(text)'),
    ('public.save_useful_links_document(text,bigint,jsonb)')
  ) function_name(name)
  where has_function_privilege(role_name.name, function_name.name, 'EXECUTE')
), 'anon and service role cannot execute useful links RPCs');
select ok(
  not has_function_privilege('authenticated', 'private.assert_useful_links_context(uuid,text,boolean)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.assert_useful_links_document(text,jsonb)', 'EXECUTE'),
  'private useful links validators are not callable by browser roles'
);

insert into auth.users (id, email) values
  ('ae810000-0000-4000-8000-000000000001', 'useful-links-admin@example.test'),
  ('ae810000-0000-4000-8000-000000000002', 'useful-links-reader@example.test');
select public.bootstrap_master_user('ae810000-0000-4000-8000-000000000001');
update public.user_roles
set role_key = 'broker_house', assigned_by = 'ae810000-0000-4000-8000-000000000001'
where user_id = 'ae810000-0000-4000-8000-000000000002';
update public.profiles
set is_active = true,
    access_status = 'approved',
    approved_at = clock_timestamp(),
    approved_by = 'ae810000-0000-4000-8000-000000000001'
where user_id = 'ae810000-0000-4000-8000-000000000002';
insert into public.user_permission_overrides (
  user_id, permission_key, effect, reason, granted_by
) values (
  'ae810000-0000-4000-8000-000000000002',
  'crm.useful_links.grupos_whatsapp.view',
  'allow',
  'Synthetic useful links read fixture',
  'ae810000-0000-4000-8000-000000000001'
);
insert into auth.sessions (id, user_id, aal, not_after) values
  ('ae860000-0000-4000-8000-000000000001', 'ae810000-0000-4000-8000-000000000001', 'aal1', now() + interval '1 hour'),
  ('ae860000-0000-4000-8000-000000000002', 'ae810000-0000-4000-8000-000000000002', 'aal1', now() + interval '1 hour');

create function pg_temp.useful_links_document(p_href text default 'https://example.test/grupo')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'pageKey', 'crm.useful_links.grupos_whatsapp',
    'revision', 0,
    'updatedAt', null,
    'cards', jsonb_build_array(jsonb_build_object(
      'id', 'community',
      'kind', 'section',
      'title', 'Comunidade Direcional',
      'paragraphs', jsonb_build_array('Canal oficial.'),
      'items', jsonb_build_array(jsonb_build_object(
        'id', 'community-link', 'label', 'Acessar', 'href', p_href
      )),
      'table', null,
      'layout', jsonb_build_object('order', 0, 'columnSpan', 6, 'height', 360)
    ))
  );
$$;
grant execute on function pg_temp.useful_links_document(text) to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"ae810000-0000-4000-8000-000000000001","role":"authenticated","session_id":"ae860000-0000-4000-8000-000000000001","aal":"aal1"}',
  true
);

select throws_ok(
  $$select * from public.useful_links_documents$$,
  '42501',
  'permission denied for table useful_links_documents',
  'direct table reads cannot bypass the RPC contract'
);
select is(
  public.get_useful_links_document('crm.useful_links.grupos_whatsapp'),
  null::jsonb,
  'an authorized page returns no shared revision before the first save'
);
select is(
  public.save_useful_links_document(
    'crm.useful_links.grupos_whatsapp', 0, pg_temp.useful_links_document()
  )->>'revision',
  '1',
  'administrator creates the first shared revision'
);
select is(
  public.get_useful_links_document('crm.useful_links.grupos_whatsapp') #>> '{cards,0,title}',
  'Comunidade Direcional',
  'the shared document is readable after save'
);
select is(
  public.save_useful_links_document(
    'crm.useful_links.grupos_whatsapp', 1,
    jsonb_set(pg_temp.useful_links_document(), '{cards,0,title}', '"Comunidade atualizada"')
  )->>'revision',
  '2',
  'matching revision updates and increments the shared document'
);
select throws_ok(
  $$select public.save_useful_links_document(
    'crm.useful_links.grupos_whatsapp', 1, pg_temp.useful_links_document()
  )$$,
  '40001',
  'serialization_failure: useful links document changed',
  'a stale revision fails with a serializable conflict'
);
select throws_ok(
  $$select public.save_useful_links_document(
    'crm.useful_links.grupos_whatsapp', 2, pg_temp.useful_links_document('javascript:alert(1)')
  )$$,
  '22023',
  'invalid_argument: invalid useful links item',
  'the database rejects unsafe links independently of the client schema'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ae810000-0000-4000-8000-000000000002","role":"authenticated","session_id":"ae860000-0000-4000-8000-000000000002","aal":"aal1"}',
  true
);
select is(
  public.get_useful_links_document('crm.useful_links.grupos_whatsapp')->>'revision',
  '2',
  'an authorized non-administrator reads the shared document'
);
select throws_ok(
  $$select public.save_useful_links_document(
    'crm.useful_links.grupos_whatsapp', 2, pg_temp.useful_links_document()
  )$$,
  '42501',
  'forbidden: useful links editor unavailable',
  'an authorized non-administrator cannot edit shared content'
);
select throws_ok(
  $$select public.get_useful_links_document('crm.useful_links.lojas_horarios')$$,
  '42501',
  'forbidden: useful links page unavailable',
  'page authorization is checked independently for every useful links page'
);

reset role;
select is(
  (select count(*) from public.useful_links_documents),
  1::bigint,
  'fixture leaves one shared document before rollback'
);

select * from finish();
rollback;
